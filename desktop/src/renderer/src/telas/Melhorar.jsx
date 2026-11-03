import { useEffect, useMemo, useRef, useState } from "react";
import { PRESETS, completarAjuste } from "@core/index.js";
import { executar, limparFila, urlFoto } from "../motor.js";
import { Controle, Secao, Histograma, SeletorPosicao } from "./componentes.jsx";

export default function Melhorar({ cfg, mudarCfg, fotos, apagar, logoUrl, scan, irPara }) {
  const [presetId, setPresetId] = useState(cfg.filtroPadrao.presetId);
  const [ajuste, setAjuste] = useState(() => completarAjuste(cfg.filtroPadrao.ajuste));
  const [escopo, setEscopo] = useState("boas");
  const [atual, setAtual] = useState(0);
  const [previa, setPrevia] = useState(null);
  const [vista, setVista] = useState("depois"); // depois | dividir
  const [corte, setCorte] = useState(50);
  const [original, setOriginal] = useState(false);
  const [proc, setProc] = useState(null);
  const cancelou = useRef(false);
  const marca = cfg.marca;

  const ficam = useMemo(
    () => fotos.filter((f) => f.medidas && !apagar.has(f.caminho) && (escopo === "todas" || f.categoria === "boa" || f.categoria === "duvida")),
    [fotos, apagar, escopo],
  );
  const idx = Math.min(atual, Math.max(0, ficam.length - 1));
  const foto = ficam[idx];

  useEffect(() => {
    if (!foto) return;
    let vivo = true;
    const t = setTimeout(async () => {
      try {
        const r = await executar("previa", { url: urlFoto(foto.caminho), ajuste, niveis: foto.medidas.niveis, marca, maxLado: 1600 });
        if (!vivo) return;
        const u = URL.createObjectURL(r.blob);
        setPrevia((ant) => (ant && URL.revokeObjectURL(ant), u));
      } catch {}
    }, 160);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [foto?.caminho, ajuste, marca, logoUrl]);

  // Atalhos: ← → trocam de foto, "\" segura pra ver o original.
  useEffect(() => {
    const baixo = (e) => {
      if (e.target.tagName === "INPUT" && e.target.type !== "range") return;
      if (e.key === "\\") setOriginal(true);
      if (e.key === "ArrowRight" && e.target.type !== "range") setAtual((i) => Math.min(ficam.length - 1, i + 1));
      if (e.key === "ArrowLeft" && e.target.type !== "range") setAtual((i) => Math.max(0, i - 1));
    };
    const cima = (e) => e.key === "\\" && setOriginal(false);
    window.addEventListener("keydown", baixo);
    window.addEventListener("keyup", cima);
    return () => {
      window.removeEventListener("keydown", baixo);
      window.removeEventListener("keyup", cima);
    };
  }, [ficam.length]);

  const mudar = (k, v) => {
    setPresetId("personalizado");
    setAjuste((a) => ({ ...a, [k]: v }));
  };
  const escolherPreset = (p) => {
    setPresetId(p.id);
    setAjuste(completarAjuste(p.ajuste));
  };
  const ehPadrao =
    presetId === cfg.filtroPadrao.presetId && JSON.stringify(completarAjuste(cfg.filtroPadrao.ajuste)) === JSON.stringify(ajuste);
  const setMarca = (p) => mudarCfg({ marca: { ...marca, ...p } });

  async function aplicarTodas() {
    cancelou.current = false;
    const p = { feitas: 0, total: ficam.length, erros: 0, fim: false };
    setProc({ ...p });
    await Promise.all(
      ficam.map((f) =>
        executar("melhorar", { url: urlFoto(f.caminho), ajuste, niveis: f.medidas.niveis, marca, qualidade: cfg.qualidadeJpeg / 100 })
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
        <p>Importe uma pasta de fotos primeiro.</p>
        <button className="btn primario" onClick={() => irPara("inicio")}>
          Importar fotos
        </button>
      </section>
    );

  const mostrarAntes = original || !previa;
  const info = foto && `${foto.largura} × ${foto.altura} px · nota ${foto.medidas.nota}`;

  return (
    <section className="revelar">
      <div className="palco">
        {foto ? (
          <div className={"comparar vista-" + vista} style={{ "--corte": corte + "%" }}>
            <img className="antes" src={urlFoto(foto.caminho)} alt="Antes" />
            {previa && !original && <img className="depois" src={previa} alt="Depois" />}
            {vista === "dividir" && !original && (
              <>
                <span className="rot rot-antes">Antes</span>
                <span className="rot rot-depois">Depois</span>
                <input className="corte" type="range" min="0" max="100" value={corte} onChange={(e) => setCorte(+e.target.value)} aria-label="Comparar" />
              </>
            )}
            {mostrarAntes && vista === "depois" && <span className="rot rot-antes">Original</span>}
          </div>
        ) : (
          <p className="dica centro">Nenhuma foto sobrou nesse filtro.</p>
        )}
      </div>

      <div className="barra-palco">
        <div className="grupo-seg">
          <button className={vista === "depois" ? "ativo" : ""} onClick={() => setVista("depois")} title="Só o resultado">
            ▢
          </button>
          <button className={vista === "dividir" ? "ativo" : ""} onClick={() => setVista("dividir")} title="Antes | Depois">
            ◧
          </button>
        </div>
        <button className="btn-fantasma" onMouseDown={() => setOriginal(true)} onMouseUp={() => setOriginal(false)} onMouseLeave={() => setOriginal(false)}>
          Segure para ver o original <kbd>\</kbd>
        </button>
        <span className="nome-foto" title={foto?.caminho}>
          {foto?.nome} <small>{foto && `${idx + 1} de ${ficam.length}`}</small>
        </span>
      </div>

      <aside className="painel-dir">
        <div className="painel-rolagem">
          <Histograma url={previa} info={info} />

          <Secao titulo="Predefinições">
            <ul className="lista-presets">
              {PRESETS.map((p) => (
                <li key={p.id}>
                  <button className={presetId === p.id ? "ativo" : ""} onClick={() => escolherPreset(p)}>
                    {p.nome}
                    {cfg.filtroPadrao.presetId === p.id && <em>padrão</em>}
                  </button>
                </li>
              ))}
              {presetId === "personalizado" && (
                <li>
                  <button className="ativo">Personalizado</button>
                </li>
              )}
            </ul>
          </Secao>

          <Secao
            titulo="Básico"
            extra={
              <button className={"mini" + (ajuste.autoAjuste ? " ativo" : "")} onClick={() => mudar("autoAjuste", ajuste.autoAjuste ? 0 : 100)}>
                Auto
              </button>
            }
          >
            <div className="sub-rot">Tom</div>
            <Controle rotulo="Auto" valor={ajuste.autoAjuste} min={0} max={100} onChange={(v) => mudar("autoAjuste", v)} />
            <Controle rotulo="Brilho" valor={ajuste.brilho} onChange={(v) => mudar("brilho", v)} trilho="luz" />
            <Controle rotulo="Contraste" valor={ajuste.contraste} onChange={(v) => mudar("contraste", v)} />
            <div className="sub-rot">Cor</div>
            <Controle rotulo="Temp." valor={ajuste.temperatura} onChange={(v) => mudar("temperatura", v)} trilho="temp" />
            <Controle rotulo="Saturação" valor={ajuste.saturacao} onChange={(v) => mudar("saturacao", v)} trilho="sat" />
          </Secao>

          <Secao titulo="Detalhe">
            <Controle rotulo="Nitidez" valor={ajuste.nitidez} min={0} max={100} onChange={(v) => mudar("nitidez", v)} />
          </Secao>

          <Secao titulo="Efeitos">
            <Controle rotulo="Vinheta" valor={ajuste.vinheta} min={0} max={100} onChange={(v) => mudar("vinheta", v)} trilho="luz-inv" />
          </Secao>

          <Secao
            titulo="Marca d'água"
            extra={
              logoUrl && (
                <label className="interruptor" title="Ligar/desligar">
                  <input type="checkbox" checked={marca.ativa} onChange={(e) => setMarca({ ativa: e.target.checked })} />
                  <span />
                </label>
              )
            }
          >
            {logoUrl ? (
              <div className={"marca-rapida" + (marca.ativa ? "" : " desligada")}>
                <SeletorPosicao valor={marca.posicao} onChange={(posicao) => setMarca({ posicao })} />
                <div className="flex1">
                  <Controle rotulo="Tamanho" valor={marca.tamanho} min={5} max={40} sufixo="%" onChange={(tamanho) => setMarca({ tamanho })} />
                  <Controle rotulo="Opac." valor={marca.opacidade} min={20} max={100} sufixo="%" onChange={(opacidade) => setMarca({ opacidade })} />
                </div>
              </div>
            ) : (
              <p className="dica">
                Nenhum logo cadastrado.{" "}
                <button className="link" onClick={() => irPara("config")}>
                  Cadastrar em Ajustes
                </button>
              </p>
            )}
          </Secao>
        </div>

        <div className="painel-rodape">
          <div className="linha-acoes">
            <button className="btn pequeno" onClick={() => escolherPreset(PRESETS[0])}>
              Redefinir
            </button>
            <button className="btn pequeno" disabled={ehPadrao} onClick={() => mudarCfg({ filtroPadrao: { presetId, ajuste: { ...ajuste } } })}>
              {ehPadrao ? "✓ Padrão" : "Salvar como padrão"}
            </button>
          </div>
          <select value={escopo} onChange={(e) => setEscopo(e.target.value)} aria-label="Aplicar em">
            <option value="boas">Boas e duvidosas que ficam</option>
            <option value="todas">Todas que não foram recusadas</option>
          </select>
          <button className="btn primario" disabled={!ficam.length || (proc && !proc.fim)} onClick={aplicarTodas}>
            Exportar {ficam.length} fotos
          </button>
        </div>
      </aside>

      <div className="filmstrip">
        {ficam.map((f, i) => (
          <button key={f.caminho} className={i === idx ? "ativa" : ""} onClick={() => setAtual(i)} title={f.nome}>
            <img src={f.miniatura} alt="" loading="lazy" />
          </button>
        ))}
      </div>

      {proc && (
        <div className="modal">
          <div className="caixa">
            <h2>{proc.fim ? (proc.cancelado ? "Exportação parada" : "Exportação concluída") : "Exportando…"}</h2>
            <p>
              {proc.feitas} de {proc.total}
              {proc.erros > 0 && ` · ${proc.erros} com erro`}
            </p>
            <div className="barra">
              <div style={{ width: (proc.total ? (proc.feitas / proc.total) * 100 : 0) + "%" }} />
            </div>
            <p className="dica">Salvas em "Fotos Melhoradas", ao lado das originais. As originais não mudam.</p>
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
