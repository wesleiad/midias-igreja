// Filtros de melhoria. O ajuste de cor vira UMA matriz 4x5 (rápida no canvas e no Skia do celular);
// nitidez e vinheta são passadas extras sobre os pixels.

export const AJUSTE_NEUTRO = {
  autoAjuste: 0, // 0-100: corrige níveis e cor automaticamente
  brilho: 0, // -100..100
  contraste: 0, // -100..100
  saturacao: 0, // -100..100
  temperatura: 0, // -100 (frio) .. 100 (quente)
  nitidez: 0, // 0-100
  vinheta: 0, // 0-100
};

export const PRESETS = [
  { id: "original", nome: "Original", ajuste: {} },
  { id: "auto", nome: "Automático", ajuste: { autoAjuste: 100, nitidez: 25 } },
  { id: "vivo", nome: "Vivo", ajuste: { autoAjuste: 100, contraste: 15, saturacao: 25, nitidez: 30 } },
  { id: "culto", nome: "Luz baixa (culto)", ajuste: { autoAjuste: 100, brilho: 15, contraste: 10, saturacao: 10, nitidez: 20 } },
  { id: "quente", nome: "Quente", ajuste: { autoAjuste: 80, temperatura: 30, saturacao: 10, nitidez: 15 } },
  { id: "frio", nome: "Frio", ajuste: { autoAjuste: 80, temperatura: -25, nitidez: 15 } },
  { id: "suave", nome: "Suave", ajuste: { autoAjuste: 60, brilho: 5, contraste: -10, vinheta: 25 } },
  { id: "pb", nome: "Preto e branco", ajuste: { autoAjuste: 100, saturacao: -100, contraste: 20, nitidez: 20 } },
];

export const completarAjuste = (a) => ({ ...AJUSTE_NEUTRO, ...(a || {}) });

// Matrizes 5x5 (linhas r,g,b,a,1) para compor; offsets em unidades 0-255.
const I5 = () => [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1];
function multiplicar(a, b) {
  const r = new Array(25).fill(0);
  for (let i = 0; i < 5; i++)
    for (let j = 0; j < 5; j++) {
      let s = 0;
      for (let k = 0; k < 5; k++) s += a[i * 5 + k] * b[k * 5 + j];
      r[i * 5 + j] = s;
    }
  return r;
}
function escalaOffset(s, o) {
  const m = I5();
  for (let c = 0; c < 3; c++) {
    m[c * 6] = s[c];
    m[c * 5 + 4] = o[c];
  }
  return m;
}

/** niveis = [[min,max] r, g, b] vindos da análise (pode ser null). Devolve matriz 4x5 (20 números). */
export function montarMatriz(ajusteParcial, niveis) {
  const a = completarAjuste(ajusteParcial);
  let m = I5();
  const passo = (n) => (m = multiplicar(n, m));

  if (a.autoAjuste > 0 && niveis) {
    const k = a.autoAjuste / 100;
    const loC = Math.min(...niveis.map((n) => n[0]));
    const hiC = Math.max(...niveis.map((n) => n[1]));
    const s = [];
    const o = [];
    for (let c = 0; c < 3; c++) {
      // Metade por canal (tira tom amarelado/azulado), metade comum (preserva a cena).
      const lo = (niveis[c][0] + loC) / 2;
      const hi = Math.max(lo + 40, (niveis[c][1] + hiC) / 2);
      const esc = Math.min(2.2, 255 / (hi - lo));
      s.push(1 + k * (esc - 1));
      o.push(-k * lo * esc);
    }
    passo(escalaOffset(s, o));
  }
  if (a.brilho) passo(escalaOffset([1, 1, 1], Array(3).fill(a.brilho * 0.6)));
  if (a.contraste) {
    const f = a.contraste > 0 ? 1 + a.contraste / 100 : 1 + a.contraste / 200;
    passo(escalaOffset([f, f, f], Array(3).fill(128 * (1 - f))));
  }
  if (a.saturacao) {
    const s = Math.max(0, 1 + a.saturacao / 100);
    const [lr, lg, lb] = [0.2126, 0.7152, 0.0722];
    const n = I5();
    n.splice(0, 3, lr * (1 - s) + s, lg * (1 - s), lb * (1 - s));
    n.splice(5, 3, lr * (1 - s), lg * (1 - s) + s, lb * (1 - s));
    n.splice(10, 3, lr * (1 - s), lg * (1 - s), lb * (1 - s) + s);
    passo(n);
  }
  if (a.temperatura) {
    const t = a.temperatura / 100;
    passo(escalaOffset([1 + 0.08 * t, 1, 1 - 0.08 * t], [18 * t, 3 * t, -18 * t]));
  }
  return m.slice(0, 20);
}

/** Matriz no formato do Skia (offsets 0-1). */
export const matrizParaSkia = (m) => m.map((v, i) => (i % 5 === 4 ? v / 255 : v));

/** Aplica o ajuste completo nos pixels RGBA (altera img.data). */
export function aplicarAjuste(img, ajusteParcial, niveis) {
  const a = completarAjuste(ajusteParcial);
  const { data, width: w, height: h } = img;
  const m = montarMatriz(a, niveis);
  const identidade = m.every((v, i) => v === (i % 6 === 0 ? 1 : 0));
  if (!identidade) {
    for (let p = 0; p < data.length; p += 4) {
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      data[p] = m[0] * r + m[1] * g + m[2] * b + m[4];
      data[p + 1] = m[5] * r + m[6] * g + m[7] * b + m[9];
      data[p + 2] = m[10] * r + m[11] * g + m[12] * b + m[14];
    }
  }
  if (a.nitidez > 0) nitidezPixels(data, w, h, (a.nitidez / 100) * 1.4);
  if (a.vinheta > 0) vinhetaPixels(data, w, h, a.vinheta / 100);
  return img;
}

// Máscara de nitidez (unsharp) com desfoque 3x3, linha a linha pra gastar pouca memória.
function nitidezPixels(data, w, h, k) {
  const linha = w * 4;
  let ant = data.slice(0, linha);
  let atual = data.slice(0, linha);
  for (let y = 1; y < h - 1; y++) {
    const prox = data.slice((y + 1) * linha, (y + 2) * linha);
    const base = y * linha;
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        const i = x * 4 + c;
        const v = atual[i];
        const blur =
          (ant[i - 4] + ant[i] + ant[i + 4] + atual[i - 4] + v + atual[i + 4] + prox[i - 4] + prox[i] + prox[i + 4]) / 9;
        data[base + i] = v + k * (v - blur);
      }
    }
    ant = atual;
    atual = prox;
  }
}

function vinhetaPixels(data, w, h, forca) {
  const cx = w / 2;
  const cy = h / 2;
  const rmax = Math.hypot(cx, cy);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = Math.hypot(x - cx, y - cy) / rmax;
      if (r < 0.45) continue;
      const t = Math.min(1, (r - 0.45) / 0.55);
      const f = 1 - forca * 0.55 * t * t * (3 - 2 * t);
      const p = (y * w + x) * 4;
      data[p] *= f;
      data[p + 1] *= f;
      data[p + 2] *= f;
    }
  }
}
