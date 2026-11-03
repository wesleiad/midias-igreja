import { useEffect, useMemo, useRef, useState } from "react";
import { PRESETS, completarAjuste } from "@core/index.js";
import { executar, limparFila, urlFoto } from "../motor.js";
import { Controle, SeletorPosicao } from "./componentes.jsx";

const CONTROLES = [
  ["autoAjuste", "Ajuste automático", 0, 100],
  ["brilho", "Brilho"],
  ["contraste", "Contraste"],
  ["saturacao", "Cor (saturação)"],
  ["temperatura", "Temperatura (frio ↔ quente)"],
  ["nitidez", "Nitidez", 0, 100],
  ["vinheta", "Vinheta (bordas escuras)", 0, 100],
];

export default function Melhorar({ cfg, mudarCfg, fotos, apagar, logoUrl, scan, irPara }) {
  const [presetId, setPresetId] = useState(cfg.filtroPadrao.presetId);
  const [ajuste, setAjuste] = useState(() => completarAjuste(cfg.filtroPadrao.ajuste));
  const [escopo, setEscopo] = useState("boas");
  const [atual, setAtual] = useState(0);
  const [previa, setPrevia] = useState(null);
  const [corte, setCorte] = useState(50);
  const [proc, setProc] = useState(null); // { feitas, total, erros, fim }
  const cancelou = useRef(false);
  const marca = cfg.marca;

  const ficam = useMemo(
    () =>
      fotos.filter(
        (f) => f.medidas && !apagar.has(f.caminho) && (escopo === "todas" || f.categoria === "boa" || f.categoria === "duvida"),
      ),
    [fotos, apagar, escopo],
  );
  const foto = ficam[Math.min(atual, ficam.length - 1)];

  // Prévia com atraso curto pra não recalcular a cada pixel do slider.
  useEffect(() => {
    if (!foto) return;
    let vivo = true;
    const t = setTimeout(async () => {
      try {
        const r = await executar("previa", { url: urlFoto(foto.caminho), ajuste, niveis: foto.medidas.niveis, marca, maxLado: 1400 });
        if (!vivo) return;
        const u = URL.createObjectURL(r.blob);
        setPrevia((ant) => (ant && URL.revokeObjectURL(ant), u));
      } catch {}
    }, 180);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [foto?.caminho, ajuste, marca, logoUrl]);

  const mudar = (k, v) => {
    setPresetId("personalizado");
    setAjuste((a) => ({ ...a, [k]: v }));
  };
  const escolherPreset = (p) => {
    setPresetId(p.id);
    setAjuste(completarAjuste(p.ajuste));
  };
  const ehPadrao = presetId === cfg.filtroPadrao.presetId && JSON.stringify(completarAjuste(cfg.filtroPadrao.ajuste)) === JSON.stringify(ajuste);

  async function aplicarTodas() {
    cancelou.current = false;
    const lista = ficam;
    const p = { feitas: 0, total: lista.length, erros: 0, fim: false };
    setProc({ ...p });
    await Promise.all(
      lista.map((f) =>
        executar("melhorar", {
          url: urlFoto(f.caminho),
          ajuste,
          niveis: f.medidas.niveis,
          marca,
          qualidade: cfg.qualidadeJpeg / 100,
        })
          .then((r) => window.api.salvarMelhorada(f.caminho, r.bytes))
          .catch((e) => e.message !== "cancelado" && p.erros++)
          .finally(() => {
            p.feitas++;
            setProc({ ...p });
          }),
      ),
    );
    setProc({ ...p, fim: true, cancelado: cancelou.current });
  }

  if (!fotos.length)
    return (
      <section className="tela vazia">
        <p>Escaneie uma pasta primeiro.</p>
        <button className="btn primario" onClick={() => irPara("inicio")}>
          Escolher pasta
        </button>
      </section>
    );

  return (
    <section className="tela melhorar">
      <div className="melhorar-previa">
        {foto ? (
          <>
            <div className="comparar" style={{ "--corte": corte + "%" }}>
              <img className="antes" src={urlFoto(foto.caminho)} alt="Antes" />
              {previa && <img className="depois" src={previa} alt="Depois" />}
              <span className="rot rot-antes">Antes</span>
              <span className="rot rot-depois">Depois</span>
              <input
                className="corte"
                type="range"
                min="0"
                max="100"
                value={corte}
                onChange={(e) => setCorte(+e.target.value)}
                aria-label="Comparar antes e depois"
              />
            </div>
            <div className="tira">
              {ficam.slice(0, 60).map((f, i) => (
                <button key={f.caminho} className={i === atual ? "ativa" : ""} onClick={() => setAtual(i)}>
                  <img src={f.miniatura} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="dica centro">Nenhuma foto sobrou nesse filtro.</p>
        )}
      </div>

      <aside className="painel">
        <h3>Filtro</h3>
        <div className="presets">
          {PRESETS.map((p) => (
            <button key={p.id} className={"chip" + (presetId === p.id ? " ativo" : "")} onClick={() => escolherPreset(p)}>
              {p.nome}
            </button>
          ))}
          {presetId === "personalizado" && <span className="chip ativo">Personalizado</span>}
        </div>
        {CONTROLES.map(([k, nome, min, max]) => (
          <Controle key={k} rotulo={nome} valor={ajuste[k]} min={min} max={max} onChange={(v) => mudar(k, v)} />
        ))}
        <button
          className="btn"
          disabled={ehPadrao}
          onClick={() => mudarCfg({ filtroPadrao: { presetId, ajuste: { ...ajuste } } })}
        >
          {ehPadrao ? "✓ Este é o filtro padrão" : "Salvar como filtro padrão"}
        </button>

        <h3>Marca d'água</h3>
        {logoUrl ? (
          <>
            <label className="check">
              <input type="checkbox" checked={marca.ativa} onChange={(e) => mudarCfg({ marca: { ...marca, ativa: e.target.checked } })} />
              Colocar o logo da igreja
            </label>
            {marca.ativa && (
              <div className="marca-rapida">
                <SeletorPosicao valor={marca.posicao} onChange={(posicao) => mudarCfg({ marca: { ...marca, posicao } })} />
                <div>
                  <Controle rotulo="Tamanho" valor={marca.tamanho} min={5} max={40} sufixo="%" onChange={(tamanho) => mudarCfg({ marca: { ...marca, tamanho } })} />
                  <Controle rotulo="Opacidade" valor={marca.opacidade} min={20} max={100} sufixo="%" onChange={(opacidade) => mudarCfg({ marca: { ...marca, opacidade } })} />
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="dica">
            Nenhum logo cadastrado.{" "}
            <button className="link" onClick={() => irPara("config")}>
              Cadastrar em Ajustes
            </button>
          </p>
        )}

        <h3>Aplicar em</h3>
        <div className="opcoes">
          <label className="check">
            <input type="radio" checked={escopo === "boas"} onChange={() => setEscopo("boas")} /> Boas e duvidosas que vão ficar
          </label>
          <label className="check">
            <input type="radio" checked={escopo === "todas"} onChange={() => setEscopo("todas")} /> Todas que não estão marcadas pra apagar
          </label>
        </div>
        <button className="btn primario grande" disabled={!ficam.length || (proc && !proc.fim)} onClick={aplicarTodas}>
          Melhorar {ficam.length} fotos
        </button>
        <small className="dica">As originais não mudam. As melhoradas vão para a pasta "Fotos Melhoradas", ao lado das originais.</small>
      </aside>

      {proc && (
        <div className="modal">
          <div className="caixa">
            <h2>{proc.fim ? (proc.cancelado ? "Parado" : "Pronto!") : "Melhorando fotos…"}</h2>
            <p>
              {proc.feitas} de {proc.total}
              {proc.erros > 0 && ` · ${proc.erros} com erro`}
            </p>
            <div className="barra">
              <div style={{ width: (proc.total ? (proc.feitas / proc.total) * 100 : 0) + "%" }} />
            </div>
            <div className="linha-acoes fim">
              {!proc.fim ? (
                <button
                  className="btn"
                  onClick={() => {
                    cancelou.current = true;
                    limparFila();
                  }}
                >
                  Parar
                </button>
              ) : (
                <>
                  <button className="btn" onClick={() => setProc(null)}>
                    Fechar
                  </button>
                  <button className="btn primario" onClick={() => window.api.abrirPasta(scan.pasta + "\\Fotos Melhoradas")}>
                    Abrir pasta
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
