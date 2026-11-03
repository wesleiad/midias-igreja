export const NOMES_CATEGORIA = {
  boa: "Boas",
  duvida: "Duvidosas",
  ruim: "Ruins",
  duplicada: "Repetidas",
  pendente: "Analisando",
};

export function contarCategorias(fotos) {
  const c = {};
  for (const f of fotos) c[f.categoria] = (c[f.categoria] || 0) + 1;
  return c;
}

export const formatarBytes = (b) =>
  b > 1e9 ? (b / 1e9).toFixed(1) + " GB" : b > 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.round(b / 1e3) + " KB";
