// Fila de workers: usa vários núcleos sem travar a tela.
const QTD = Math.max(2, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));

const workers = [];
const fila = [];
const pendentes = new Map();
let seq = 0;

function criar() {
  const w = new Worker(new URL("./motor.worker.js", import.meta.url), { type: "module" });
  w.ocupado = false;
  w.onmessage = ({ data }) => {
    const p = pendentes.get(data.id);
    pendentes.delete(data.id);
    if (p?.exclusivo) {
      w.ocupado = false;
      proximo();
    }
    if (!p) return;
    data.ok ? p.resolve(data) : p.reject(new Error(data.erro));
  };
  return w;
}
for (let i = 0; i < QTD; i++) workers.push(criar());

function proximo() {
  for (const w of workers) {
    if (w.ocupado || !fila.length) continue;
    const t = fila.shift();
    w.ocupado = true;
    pendentes.set(t.id, t);
    w.postMessage(t.msg);
  }
}

/** Manda uma tarefa pro primeiro worker livre. */
export function executar(tipo, args = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    fila.push({ id, resolve, reject, exclusivo: true, msg: { id, tipo, ...args } });
    proximo();
  });
}

/** Cancela o que ainda não começou. */
export function limparFila() {
  for (const t of fila.splice(0)) t.reject(new Error("cancelado"));
}

/** Envia o logo (ou null) para todos os workers. */
export async function definirLogo(blob) {
  await Promise.all(
    workers.map(async (w) => {
      const bitmap = blob ? await createImageBitmap(blob) : null;
      const id = ++seq;
      return new Promise((resolve) => {
        pendentes.set(id, { resolve, reject: resolve });
        w.postMessage({ id, tipo: "logo", bitmap }, bitmap ? [bitmap] : []);
      });
    }),
  );
}

export const urlFoto = (caminho) => "foto://local/" + encodeURIComponent(caminho);
