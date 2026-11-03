import { avaliar, agruparDuplicadas } from "./analise.js";

/**
 * Junta medidas + rigor + repetidas e decide a categoria de cada foto:
 * "boa" | "duvida" | "ruim" | "duplicada" | "pendente".
 * fotos = [{ medidas, erro, ... }]; chave(f) = identificador único.
 */
export function classificar(fotos, limites, chave) {
  const medidas = fotos.filter((f) => f.medidas);
  const grupos = agruparDuplicadas(
    medidas.map((f) => ({ id: chave(f), hash: f.medidas.hash, nota: f.medidas.nota })),
    limites.distanciaDuplicada,
  );
  const dup = new Map();
  grupos.forEach((g, gi) => g.forEach((it, k) => dup.set(it.id, { grupo: gi, melhor: k === 0 })));
  return fotos.map((f) => {
    if (f.erro) return { ...f, categoria: "ruim", problemas: ["Arquivo não abriu (pode estar corrompido)"], grupo: null };
    if (!f.medidas) return { ...f, categoria: "pendente", problemas: [], grupo: null };
    const { veredito, problemas } = avaliar(f.medidas, limites);
    const d = dup.get(chave(f));
    const duplicada = d && !d.melhor;
    return {
      ...f,
      problemas: duplicada ? ["Repetida (há uma versão melhor)", ...problemas] : problemas,
      categoria: veredito === "ruim" ? "ruim" : duplicada ? "duplicada" : veredito,
      grupo: d?.grupo ?? null,
      melhorDoGrupo: !!d?.melhor,
    };
  });
}

/** O que já vem marcado pra apagar: ruins que abriram + repetidas. */
export const sugeridasParaApagar = (classificadas) =>
  classificadas.filter((f) => (f.categoria === "ruim" && !f.erro) || f.categoria === "duplicada");
