// Marca d'água: posição em grade 3x3, tamanho proporcional à largura da foto.

export const POSICOES = [
  { id: "sup-esq", nome: "Em cima, à esquerda" },
  { id: "sup-centro", nome: "Em cima, no centro" },
  { id: "sup-dir", nome: "Em cima, à direita" },
  { id: "meio-esq", nome: "No meio, à esquerda" },
  { id: "centro", nome: "Centro" },
  { id: "meio-dir", nome: "No meio, à direita" },
  { id: "inf-esq", nome: "Embaixo, à esquerda" },
  { id: "inf-centro", nome: "Embaixo, no centro" },
  { id: "inf-dir", nome: "Embaixo, à direita" },
];

export const MARCA_PADRAO = {
  ativa: false,
  posicao: "inf-dir",
  tamanho: 18, // % do lado menor da foto
  opacidade: 85, // %
  margem: 3, // % do lado menor
};

/** Retângulo { x, y, w, h } onde desenhar a marca (wmW/wmH = tamanho original do logo). */
export function retanguloMarca(W, H, wmW, wmH, opcoes) {
  const o = { ...MARCA_PADRAO, ...opcoes };
  const lado = Math.min(W, H);
  // Logo largo usa a largura; logo alto/quadrado usa a altura, pra não ficar gigante.
  const alvo = (lado * o.tamanho) / 100;
  const escala = wmW >= wmH ? (alvo * 1.6) / wmW : alvo / wmH;
  const w = wmW * escala;
  const h = wmH * escala;
  const m = (lado * o.margem) / 100;
  const [v, hz] = o.posicao === "centro" ? ["meio", "centro"] : o.posicao.split("-");
  const x = hz === "esq" ? m : hz === "dir" ? W - w - m : (W - w) / 2;
  const y = v === "sup" ? m : v === "inf" ? H - h - m : (H - h) / 2;
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}
