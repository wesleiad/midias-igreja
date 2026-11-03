import { useEffect, useRef, useState } from "react";
import { File, Paths } from "expo-file-system";
import { Skia } from "@shopify/react-native-skia";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { MARCA_PADRAO, LIMITES_PADRAO, PRESETS } from "../../core/index.js";

export const RIGOR = {
  leve: { nome: "Leve", nitidezRuim: 15, nitidezDuvida: 22 },
  normal: { nome: "Normal", nitidezRuim: LIMITES_PADRAO.nitidezRuim, nitidezDuvida: LIMITES_PADRAO.nitidezDuvida },
  rigoroso: { nome: "Rigoroso", nitidezRuim: 25, nitidezDuvida: 37 },
};
export const limitesDoRigor = (rigor) => {
  const { nome, ...r } = RIGOR[rigor] || RIGOR.normal;
  return { ...LIMITES_PADRAO, ...r };
};

const PADRAO = {
  filtroPadrao: { presetId: "auto", ajuste: { ...PRESETS.find((p) => p.id === "auto").ajuste } },
  marca: { ...MARCA_PADRAO },
  rigor: "normal",
  qualidadeJpeg: 92,
  modo: "revisar", // "revisar" = mostra antes · "automatico" = varre ao abrir e apaga sozinho
  ultimaBusca: null, // { albumId, limite } da última varredura
};

const arqConfig = () => new File(Paths.document, "config.json");
const arqLogo = () => new File(Paths.document, "logo.png");

export function useConfig() {
  const [cfg, setCfg] = useState(null);
  const pronto = useRef(false);
  useEffect(() => {
    let salva = null;
    try {
      const f = arqConfig();
      if (f.exists) salva = JSON.parse(f.textSync());
    } catch {}
    setCfg({ ...PADRAO, ...(salva || {}), marca: { ...PADRAO.marca, ...(salva?.marca || {}) } });
    pronto.current = true;
  }, []);
  useEffect(() => {
    if (!pronto.current || !cfg) return;
    const f = arqConfig();
    if (!f.exists) f.create();
    f.write(JSON.stringify(cfg));
  }, [cfg]);
  const mudar = (p) => setCfg((c) => ({ ...c, ...(typeof p === "function" ? p(c) : p) }));
  return [cfg, mudar];
}

/** Logo salvo como SkImage (ou null). */
export async function carregarLogo() {
  const f = arqLogo();
  if (!f.exists) return null;
  const dados = await Skia.Data.fromURI(f.uri);
  return Skia.Image.MakeImageFromEncoded(dados);
}

/** Copia o logo escolhido como PNG (preserva transparência), até 1200px. */
export async function salvarLogo(uri) {
  const ref = await ImageManipulator.manipulate(uri, { maxWidth: 1200, maxHeight: 1200 }).renderAsync();
  const r = await ref.saveAsync({ format: SaveFormat.PNG });
  const origem = new File(r.uri);
  const destino = arqLogo();
  if (destino.exists) destino.delete();
  await origem.copy(destino);
  try {
    origem.delete();
  } catch {}
}

export function removerLogo() {
  const f = arqLogo();
  if (f.exists) f.delete();
}
