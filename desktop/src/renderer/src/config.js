import { useEffect, useRef, useState } from "react";
import { MARCA_PADRAO, LIMITES_PADRAO, PRESETS } from "@core/index.js";

export const RIGOR = {
  leve: { nome: "Leve (apaga só o que está muito ruim)", nitidezRuim: 15, nitidezDuvida: 22 },
  normal: { nome: "Normal", nitidezRuim: LIMITES_PADRAO.nitidezRuim, nitidezDuvida: LIMITES_PADRAO.nitidezDuvida },
  rigoroso: { nome: "Rigoroso (só fica foto bem nítida)", nitidezRuim: 25, nitidezDuvida: 37 },
};

export const limitesDoRigor = (rigor) => {
  const { nome, ...r } = RIGOR[rigor] || RIGOR.normal;
  return { ...LIMITES_PADRAO, ...r };
};

export const CONFIG_PADRAO = {
  filtroPadrao: { presetId: "auto", ajuste: { ...PRESETS.find((p) => p.id === "auto").ajuste } },
  marca: { ...MARCA_PADRAO },
  rigor: "normal",
  incluirSubpastas: true,
  modo: "revisar", // "revisar" = mostra antes de apagar · "automatico" = varre ao abrir e apaga sozinho
  ultimaPasta: null,
  qualidadeJpeg: 92,
};

/** Config persistida em disco (userData/config.json). */
export function useConfig() {
  const [cfg, setCfg] = useState(null);
  const pronto = useRef(false);
  useEffect(() => {
    window.api.lerConfig().then((salva) => {
      setCfg({
        ...CONFIG_PADRAO,
        ...(salva || {}),
        marca: { ...CONFIG_PADRAO.marca, ...(salva?.marca || {}) },
        filtroPadrao: salva?.filtroPadrao || CONFIG_PADRAO.filtroPadrao,
      });
      pronto.current = true;
    });
  }, []);
  useEffect(() => {
    if (pronto.current && cfg) window.api.salvarConfig(cfg);
  }, [cfg]);
  const mudar = (parcial) => setCfg((c) => ({ ...c, ...(typeof parcial === "function" ? parcial(c) : parcial) }));
  return [cfg, mudar];
}
