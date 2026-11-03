// Trabalho pesado fora da tela: decodificar, analisar, aplicar filtro e marca d'água.
import { analisarImagem, aplicarAjuste, retanguloMarca, LADO_ANALISE } from "@core/index.js";

let logo = null; // ImageBitmap do logo da igreja

async function abrir(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Não consegui ler o arquivo");
  return createImageBitmap(await r.blob()); // já respeita a rotação EXIF
}

function desenhar(bmp, maxLado) {
  const esc = Math.min(1, maxLado / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * esc));
  const h = Math.max(1, Math.round(bmp.height * esc));
  const cv = new OffscreenCanvas(w, h);
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  return { cv, ctx, w, h };
}

function tratar({ cv, ctx, w, h }, ajuste, niveis, marca) {
  if (ajuste) {
    const img = ctx.getImageData(0, 0, w, h);
    aplicarAjuste(img, ajuste, niveis);
    ctx.putImageData(img, 0, 0);
  }
  if (marca?.ativa && logo) {
    const r = retanguloMarca(w, h, logo.width, logo.height, marca);
    ctx.globalAlpha = (marca.opacidade ?? 85) / 100;
    ctx.drawImage(logo, r.x, r.y, r.w, r.h);
    ctx.globalAlpha = 1;
  }
  return cv;
}

const tarefas = {
  async logo({ bitmap }) {
    logo?.close?.();
    logo = bitmap || null;
    return {};
  },

  async analisar({ url }) {
    const bmp = await abrir(url);
    const original = { largura: bmp.width, altura: bmp.height };
    const a = desenhar(bmp, LADO_ANALISE);
    const resultado = analisarImagem(a.ctx.getImageData(0, 0, a.w, a.h), original);
    const t = desenhar(bmp, 360);
    bmp.close();
    const miniatura = await t.cv.convertToBlob({ type: "image/jpeg", quality: 0.8 });
    return { resultado, ...original, miniatura };
  },

  async previa({ url, ajuste, niveis, marca, maxLado = 1400 }) {
    const bmp = await abrir(url);
    const d = desenhar(bmp, maxLado);
    bmp.close();
    const blob = await tratar(d, ajuste, niveis, marca).convertToBlob({ type: "image/jpeg", quality: 0.9 });
    return { blob };
  },

  async melhorar({ url, ajuste, niveis, marca, qualidade = 0.92 }) {
    const bmp = await abrir(url);
    const d = desenhar(bmp, Infinity);
    bmp.close();
    const blob = await tratar(d, ajuste, niveis, marca).convertToBlob({ type: "image/jpeg", quality: qualidade });
    const bytes = await blob.arrayBuffer();
    return { bytes, transferir: [bytes] };
  },
};

self.onmessage = async ({ data }) => {
  const { id, tipo, ...args } = data;
  try {
    const { transferir, ...r } = await tarefas[tipo](args);
    self.postMessage({ id, ok: true, ...r }, transferir || []);
  } catch (e) {
    self.postMessage({ id, ok: false, erro: String(e?.message || e) });
  }
};
