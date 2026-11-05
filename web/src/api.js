// Ponte do navegador: imita o window.api do app do PC (Electron) com o que o navegador permite.
// Fotos escolhidas viram blob:, config fica no localStorage, logo no IndexedDB.
// Não dá pra apagar da galeria: "lixeira" só tira da lista.

const arquivos = new Map(); // caminho -> { file, url }
const melhoradas = new Map(); // caminho -> File (jpg pronto)
let lista = [];
let seq = 0;

function registrar(prefixo, file) {
  const caminho = `${prefixo}-${++seq}/${file.name}`;
  arquivos.set(caminho, { file, url: URL.createObjectURL(file) });
  return caminho;
}
function soltar(caminho) {
  const a = arquivos.get(caminho);
  if (a) URL.revokeObjectURL(a.url);
  arquivos.delete(caminho);
}

function escolherArquivos(accept, multiple) {
  return new Promise((resolve) => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = accept;
    inp.multiple = multiple;
    inp.style.display = "none";
    document.body.appendChild(inp);
    const fim = (files) => {
      inp.remove();
      resolve(files);
    };
    inp.addEventListener("change", () => fim([...inp.files]));
    inp.addEventListener("cancel", () => fim([]));
    inp.click();
  });
}

// IndexedDB mínimo pro logo.
function db() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("midias-igreja", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function kv(modo, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction("kv", modo);
    const req = fn(t.objectStore("kv"));
    t.oncomplete = () => res(req?.result);
    t.onerror = () => rej(t.error);
  });
}

const nomeSaida = (nome) => nome.replace(/\.[^.]+$/, "") + "-melhorada.jpg";
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const ehIphone = /iPhone|iPad|iPod/.test(navigator.userAgent);

window.api = {
  navegador: true,
  maxWorkers: ehIphone ? 2 : undefined, // iPhone: menos fotos abertas de uma vez, evita a aba fechar por memória
  urlFoto: (caminho) => arquivos.get(caminho)?.url || "",

  async escolherPasta() {
    const files = (await escolherArquivos("image/*", true)).filter((f) => !f.type || f.type.startsWith("image/"));
    if (!files.length) return null;
    lista.forEach((f) => soltar(f.caminho));
    melhoradas.clear();
    lista = files.map((file) => ({ caminho: registrar("foto", file), nome: file.name, bytes: file.size, data: file.lastModified }));
    return `${files.length} ${files.length === 1 ? "foto escolhida" : "fotos escolhidas"}`;
  },
  async listarFotos() {
    return { fotos: [...lista], ignoradas: [] };
  },
  async lixeira(caminhos) {
    const sai = new Set(caminhos);
    lista = lista.filter((f) => !sai.has(f.caminho));
    caminhos.forEach((c) => melhoradas.delete(c));
    setTimeout(() => caminhos.forEach(soltar), 2000); // deixa a tela trocar antes de soltar
    return { movidas: caminhos.length, falhas: [] };
  },

  async salvarMelhorada(caminho, bytes) {
    const nome = arquivos.get(caminho)?.file.name || "foto.jpg";
    melhoradas.set(caminho, new File([bytes], nomeSaida(nome), { type: "image/jpeg" }));
  },
  // iPhone/Android: abre o "Compartilhar" (Salvar imagens). PC: baixa os arquivos.
  async salvarMelhoradas() {
    const files = [...melhoradas.values()];
    if (!files.length) return;
    if (navigator.canShare?.({ files })) {
      try {
        await navigator.share({ files });
        return;
      } catch (e) {
        if (e.name === "AbortError") return;
      }
    }
    for (const f of files) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(f);
      a.download = f.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      await espera(300);
    }
  },
  async abrirPasta() {},

  async lerConfig() {
    try {
      const c = JSON.parse(localStorage.getItem("midias-cfg") || "null");
      return c && { ...c, modo: "revisar" };
    } catch {
      return null;
    }
  },
  async salvarConfig(cfg) {
    localStorage.setItem("midias-cfg", JSON.stringify(cfg));
  },

  async escolherLogo() {
    const [file] = await escolherArquivos("image/*,.svg", false);
    return file ? registrar("logo-escolhido", file) : null;
  },
  async salvarLogo(bytes) {
    await kv("readwrite", (s) => s.put(new Blob([bytes], { type: "image/png" }), "logo"));
  },
  async removerLogo() {
    await kv("readwrite", (s) => s.delete("logo"));
  },
  async caminhoLogo() {
    const blob = await kv("readonly", (s) => s.get("logo")).catch(() => null);
    for (const c of [...arquivos.keys()]) if (c.startsWith("logo")) soltar(c);
    return blob ? registrar("logo", new File([blob], "logo.png", { type: "image/png" })) : null;
  },

  async versao() {
    return __VERSAO__;
  },
  onAtualizacao: () => () => {},
  async instalarAtualizacao() {},
};
