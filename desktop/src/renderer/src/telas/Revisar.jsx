import { useEffect, useMemo, useState } from "react";
import { urlFoto } from "../motor.js";
import { contarCategorias, NOMES_CATEGORIA, formatarBytes } from "../util.js";

const ORDEM = ["ruim", "duplicada", "duvida", "boa"];
const DICAS = {
  ruim: "Desfocadas, tremidas, escuras ou estouradas. Já vêm marcadas pra apagar.",
  duplicada: "Fotos quase iguais. A melhor de cada grupo fica; as outras vêm marcadas pra apagar.",
  duvida: "Passáveis, mas com algum defeito. Nada marcado: você decide.",
  boa: "Boas. Nada marcado.",
};

function Cartao({ f, marcada, alternar, abrir }) {
  return (
    <div className={"foto" + (marcada ? " marcada" : "")}>
      <button className="foto-img" onClick={abrir} title={f.nome}>
        {f.miniatura ? <img src={f.miniatura} alt="" loading="lazy" /> : <div className="sem-mini">?</div>}
        {f.medidas && <span className="nota">{f.medidas.nota}</span>}
        {f.melhorDoGrupo && <span className="fica">Melhor · fica</span>}
      </button>
      <label className="foto-sel">
        <input type="checkbox" checked={marcada} onChange={alternar} />
        <span>{marcada ? "Apagar" : "Manter"}</span>
      </label>
      {f.problemas?.length > 0 && <div className="foto-prob">{f.problemas[0]}</div>}
    </div>
  );
}

export default function Revisar({ fotos, apagar, setApagar, moverParaLixeira, scan, irPara }) {
  const cont = contarCategorias(fotos);
  const [cat, setCat] = useState(() => ORDEM.find((c) => cont[c]) || "boa");
  const [aberta, setAberta] = useState(null); // índice na lista da aba
  const [confirmar, setConfirmar] = useState(false);
  const [msg, setMsg] = useState(null);
  const [trabalhando, setTrabalhando] = useState(false);

  const lista = useMemo(() => {
    if (cat !== "duplicada") return fotos.filter((f) => f.categoria === cat);
    // Repetidas: mostra o grupo inteiro (inclusive a que fica), grupo a grupo.
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

  // Teclado no visualizador: ← → navegam, Espaço alterna, Esc fecha.
  useEffect(() => {
    if (aberta == null) return;
    const tecla = (e) => {
      if (e.key === "Escape") setAberta(null);
      if (e.key === "ArrowRight") setAberta((i) => Math.min(lista.length - 1, i + 1));
      if (e.key === "ArrowLeft") setAberta((i) => Math.max(0, i - 1));
      if (e.key === " ") {
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
        <p>Nenhuma foto escaneada ainda.</p>
        <button className="btn primario" onClick={() => irPara("inicio")}>
          Escolher pasta
        </button>
      </section>
    );

  const f = aberta != null ? lista[aberta] : null;

  return (
    <section className="tela revisar">
      <div className="filtros-cat">
        {ORDEM.map((c) => (
          <button key={c} className={"chip cat-" + c + (cat === c ? " ativo" : "")} onClick={() => setCat(c)}>
            {NOMES_CATEGORIA[c]} <b>{cont[c] || 0}</b>
          </button>
        ))}
      </div>
      <div className="barra-acoes">
        <p className="dica">{DICAS[cat]}</p>
        <div className="linha-acoes">
          <button className="btn pequeno" onClick={() => marcarTodas(true)}>
            Marcar todas daqui
          </button>
          <button className="btn pequeno" onClick={() => marcarTodas(false)}>
            Desmarcar todas daqui
          </button>
        </div>
      </div>

      {scan.estado === "analisando" && <div className="cartao aviso">Ainda analisando… a lista vai se completar sozinha.</div>}
      {msg && (
        <div className="cartao ok" onClick={() => setMsg(null)}>
          {msg}
        </div>
      )}

      {lista.length === 0 ? (
        <p className="dica centro">Nada aqui. 🎉</p>
      ) : (
        <div className="grade">
          {lista.map((f, i) => (
            <Cartao
              key={f.caminho}
              f={f}
              marcada={apagar.has(f.caminho)}
              alternar={() => alternar(f.caminho)}
              abrir={() => setAberta(i)}
            />
          ))}
        </div>
      )}

      <div className="rodape-fixo">
        <span>
          <b>{marcadas.length}</b> marcadas pra apagar {bytes > 0 && <small>({formatarBytes(bytes)})</small>}
        </span>
        <button className="btn perigo" disabled={!marcadas.length} onClick={() => setConfirmar(true)}>
          Mover para a Lixeira
        </button>
      </div>

      {f && (
        <div className="modal visualizador" onClick={() => setAberta(null)}>
          <div className="vis-corpo" onClick={(e) => e.stopPropagation()}>
            <img src={urlFoto(f.caminho)} alt={f.nome} />
            <aside className="vis-info">
              <strong title={f.caminho}>{f.nome}</strong>
              {f.medidas && (
                <ul>
                  <li>
                    Nota <b>{f.medidas.nota}</b>/100
                  </li>
                  <li>Nitidez {f.medidas.nitidez}</li>
                  <li>Luz {Math.round((f.medidas.brilho / 255) * 100)}%</li>
                  <li>
                    {f.largura}×{f.altura} · {formatarBytes(f.bytes)}
                  </li>
                </ul>
              )}
              {f.problemas?.map((p) => (
                <span key={p} className="tag-prob">
                  {p}
                </span>
              ))}
              <button className={"btn " + (apagar.has(f.caminho) ? "perigo" : "")} onClick={() => alternar(f.caminho)}>
                {apagar.has(f.caminho) ? "✕ Vai apagar (clique pra manter)" : "✓ Vai manter (clique pra apagar)"}
              </button>
              <div className="linha-acoes">
                <button className="btn" disabled={aberta === 0} onClick={() => setAberta(aberta - 1)}>
                  ←
                </button>
                <span>
                  {aberta + 1}/{lista.length}
                </span>
                <button className="btn" disabled={aberta === lista.length - 1} onClick={() => setAberta(aberta + 1)}>
                  →
                </button>
                <button className="btn" onClick={() => setAberta(null)}>
                  Fechar
                </button>
              </div>
              <small className="dica">Teclado: ← → navegar · Espaço marcar · Esc fechar</small>
            </aside>
          </div>
        </div>
      )}

      {confirmar && (
        <div className="modal" onClick={() => !trabalhando && setConfirmar(false)}>
          <div className="caixa" onClick={(e) => e.stopPropagation()}>
            <h2>Mover {marcadas.length} fotos para a Lixeira?</h2>
            <p>
              Elas saem da pasta, mas ficam na Lixeira do Windows. Dá pra restaurar enquanto você não esvaziar a Lixeira.
            </p>
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
