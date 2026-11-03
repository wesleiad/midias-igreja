import { useEffect, useMemo, useState } from "react";
import { urlFoto } from "../motor.js";
import { contarCategorias, NOMES_CATEGORIA, formatarBytes } from "../util.js";
import { Histograma } from "./componentes.jsx";

const ORDEM = ["ruim", "duplicada", "duvida", "boa"];
const DICAS = {
  ruim: "Desfocadas, tremidas, escuras ou estouradas. Já vêm recusadas.",
  duplicada: "Fotos quase iguais. A melhor de cada grupo fica; as outras vêm recusadas.",
  duvida: "Passáveis, mas com algum defeito. Você decide.",
  boa: "Boas. Nada recusado.",
};

function Celula({ f, n, recusada, alternar, abrir, tam }) {
  return (
    <div className={"celula" + (recusada ? " recusada" : "")} style={{ "--tam": tam + "px" }}>
      <span className="cel-num">{n}</span>
      <button className="cel-img" onClick={abrir} title={`${f.nome}\nClique para ampliar`}>
        {f.miniatura ? <img src={f.miniatura} alt="" loading="lazy" /> : <span className="sem-mini">?</span>}
      </button>
      <div className="cel-rodape">
        <button className={"bandeira" + (recusada ? " on" : "")} onClick={alternar} title={recusada ? "Recusada (vai apagar). Clique pra manter" : "Clique pra recusar"}>
          {recusada ? "⚑ Recusada" : "⚐"}
        </button>
        {f.melhorDoGrupo && <span className="fica">★ melhor</span>}
        {f.medidas && <span className="cel-nota">{f.medidas.nota}</span>}
      </div>
      {f.problemas?.length > 0 && <div className="cel-prob">{f.problemas[0]}</div>}
    </div>
  );
}

export default function Revisar({ fotos, apagar, setApagar, moverParaLixeira, scan, irPara }) {
  const cont = contarCategorias(fotos);
  const [cat, setCat] = useState(() => ORDEM.find((c) => cont[c]) || "boa");
  const [aberta, setAberta] = useState(null);
  const [confirmar, setConfirmar] = useState(false);
  const [msg, setMsg] = useState(null);
  const [trabalhando, setTrabalhando] = useState(false);
  const [tam, setTam] = useState(190);

  const lista = useMemo(() => {
    if (cat !== "duplicada") return fotos.filter((f) => f.categoria === cat);
    const grupos = new Set(fotos.filter((f) => f.categoria === "duplicada").map((f) => f.grupo));
    return fotos.filter((f) => grupos.has(f.grupo)).sort((a, b) => a.grupo - b.grupo || b.melhorDoGrupo - a.melhorDoGrupo);
  }, [fotos, cat]);

  const alternar = (c) =>
    setApagar((s) => {
      const n = new Set(s);
      n.has(c) ? n.delete(c) : n.add(c);
      return n;
    });
  const marcarTodas = (v) =>
    setApagar((s) => {
      const n = new Set(s);
      lista.forEach((f) => (f.melhorDoGrupo && cat === "duplicada" ? null : v ? n.add(f.caminho) : n.delete(f.caminho)));
      return n;
    });

  const marcadas = fotos.filter((f) => apagar.has(f.caminho));
  const bytes = marcadas.reduce((s, f) => s + (f.bytes || 0), 0);

  async function apagarAgora() {
    setTrabalhando(true);
    const r = await moverParaLixeira(marcadas.map((f) => f.caminho));
    setTrabalhando(false);
    setConfirmar(false);
    setMsg(
      r.falhas.length
        ? `${r.movidas} foram para a Lixeira. ${r.falhas.length} não deu pra mover (arquivo em uso ou sem permissão).`
        : `${r.movidas} fotos foram para a Lixeira. Se precisar, dá pra restaurar por lá.`,
    );
  }

  useEffect(() => {
    if (aberta == null) return;
    const tecla = (e) => {
      if (e.key === "Escape") setAberta(null);
      if (e.key === "ArrowRight") setAberta((i) => Math.min(lista.length - 1, i + 1));
      if (e.key === "ArrowLeft") setAberta((i) => Math.max(0, i - 1));
      if (e.key === "x" || e.key === "X" || e.key === " ") {
        e.preventDefault();
        alternar(lista[aberta].caminho);
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberta, lista]);

  if (!fotos.length)
    return (
      <section className="tela vazia">
        <p>Nenhuma foto importada ainda.</p>
        <button className="btn primario" onClick={() => irPara("inicio")}>
          Importar fotos
        </button>
      </section>
    );

  const f = aberta != null ? lista[aberta] : null;

  return (
    <section className="biblioteca">
      <aside className="painel-esq">
        <div className="painel-titulo">Catálogo</div>
        <ul className="catalogo">
          {ORDEM.map((c) => (
            <li key={c}>
              <button className={cat === c ? "ativo" : ""} onClick={() => setCat(c)}>
                <i className={"ponto cat-" + c} />
                {NOMES_CATEGORIA[c]}
                <b>{cont[c] || 0}</b>
              </button>
            </li>
          ))}
        </ul>
        <div className="painel-titulo">Pasta</div>
        <p className="pasta-atual" title={scan.pasta}>
          {scan.pasta?.split("\\").pop()}
          <small>{fotos.length} fotos</small>
        </p>
        <div className="painel-titulo">Recusadas</div>
        <p className="pasta-atual">
          {marcadas.length} fotos
          <small>{formatarBytes(bytes)} a liberar</small>
        </p>
      </aside>

      <div className="centro-grade">
        <div className="barra-ferramentas">
          <span className="dica">{DICAS[cat]}</span>
          <div className="linha-acoes">
            <button className="btn pequeno" onClick={() => marcarTodas(true)}>
              Recusar todas
            </button>
            <button className="btn pequeno" onClick={() => marcarTodas(false)}>
              Manter todas
            </button>
          </div>
        </div>
        {scan.estado === "analisando" && <div className="faixa aviso">Ainda analisando… a lista vai se completar sozinha.</div>}
        {msg && (
          <div className="faixa ok" onClick={() => setMsg(null)}>
            {msg}
          </div>
        )}

        {lista.length === 0 ? (
          <p className="dica centro">Nada aqui.</p>
        ) : (
          <div className="grade" style={{ "--tam": tam + "px" }}>
            {lista.map((f, i) => (
              <Celula key={f.caminho} f={f} n={i + 1} tam={tam} recusada={apagar.has(f.caminho)} alternar={() => alternar(f.caminho)} abrir={() => setAberta(i)} />
            ))}
          </div>
        )}

        <div className="barra-inferior">
          <label className="zoom" title="Tamanho das miniaturas">
            ▫
            <input type="range" min="120" max="320" value={tam} onChange={(e) => setTam(+e.target.value)} />▣
          </label>
          <span className="dica">
            <b>{marcadas.length}</b> recusadas
          </span>
          <button className="btn perigo" disabled={!marcadas.length} onClick={() => setConfirmar(true)}>
            Mover recusadas para a Lixeira
          </button>
        </div>
      </div>

      {f && (
        <div className="modal lupa" onClick={() => setAberta(null)}>
          <div className="lupa-corpo" onClick={(e) => e.stopPropagation()}>
            <img src={urlFoto(f.caminho)} alt={f.nome} />
            <aside className="lupa-info">
              <Histograma url={f.miniatura} />
              <strong title={f.caminho}>{f.nome}</strong>
              {f.medidas && (
                <dl>
                  <dt>Nota</dt>
                  <dd>{f.medidas.nota}/100</dd>
                  <dt>Nitidez</dt>
                  <dd>{f.medidas.nitidez}</dd>
                  <dt>Luz</dt>
                  <dd>{Math.round((f.medidas.brilho / 255) * 100)}%</dd>
                  <dt>Tamanho</dt>
                  <dd>
                    {f.largura}×{f.altura}
                  </dd>
                  <dt>Arquivo</dt>
                  <dd>{formatarBytes(f.bytes)}</dd>
                </dl>
              )}
              {f.problemas?.map((p) => (
                <span key={p} className="tag-prob">
                  {p}
                </span>
              ))}
              <button className={"btn " + (apagar.has(f.caminho) ? "perigo" : "")} onClick={() => alternar(f.caminho)}>
                {apagar.has(f.caminho) ? "⚑ Recusada (clique pra manter)" : "⚐ Recusar"}
              </button>
              <div className="linha-acoes">
                <button className="btn" disabled={aberta === 0} onClick={() => setAberta(aberta - 1)}>
                  ←
                </button>
                <span className="dica">
                  {aberta + 1}/{lista.length}
                </span>
                <button className="btn" disabled={aberta === lista.length - 1} onClick={() => setAberta(aberta + 1)}>
                  →
                </button>
                <button className="btn" onClick={() => setAberta(null)}>
                  Fechar
                </button>
              </div>
              <small className="dica">← → navegar · X recusar · Esc fechar</small>
            </aside>
          </div>
        </div>
      )}

      {confirmar && (
        <div className="modal" onClick={() => !trabalhando && setConfirmar(false)}>
          <div className="caixa" onClick={(e) => e.stopPropagation()}>
            <h2>Mover {marcadas.length} fotos para a Lixeira?</h2>
            <p>Elas saem da pasta, mas ficam na Lixeira do Windows. Dá pra restaurar enquanto você não esvaziar a Lixeira.</p>
            <div className="linha-acoes fim">
              <button className="btn" disabled={trabalhando} onClick={() => setConfirmar(false)}>
                Cancelar
              </button>
              <button className="btn perigo" disabled={trabalhando} onClick={apagarAgora}>
                {trabalhando ? "Movendo…" : "Sim, mover"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
