import { contarCategorias, NOMES_CATEGORIA, NAVEGADOR } from "../util.js";

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const resumoLimpeza = (l) =>
  [l.ruins && plural(l.ruins, "tremida/feia", "tremidas/feias"), l.repetidas && plural(l.repetidas, "repetida", "repetidas")].filter(Boolean).join(" e ");

export function EscolhaModo({ cfg, mudarCfg, desabilitado }) {
  const opcoes = [
    { id: "revisar", titulo: "Me mostrar antes", texto: "Separa tudo e você confere na Biblioteca o que vai apagar." },
    {
      id: "automatico",
      titulo: "Apagar automaticamente",
      texto: "Ao abrir, varre a última pasta e já manda as tremidas, feias e repetidas pra Lixeira.",
    },
  ];
  return (
    <div className="escolha-modo" role="radiogroup" aria-label="O que fazer com fotos ruins e repetidas">
      {opcoes.map((o) => (
        <button key={o.id} role="radio" aria-checked={cfg.modo === o.id} className={cfg.modo === o.id ? "ativo" : ""} disabled={desabilitado} onClick={() => mudarCfg({ modo: o.id })}>
          <span className="radio" />
          <span>
            <strong>{o.titulo}</strong>
            <small>{o.texto}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

export default function Inicio({ cfg, mudarCfg, fotos, scan, apagar, escanear, cancelar, irPara, limpeza }) {
  const ocupado = scan.estado === "listando" || scan.estado === "analisando" || scan.estado === "limpando";
  const pct = scan.total ? Math.round((scan.feitas / scan.total) * 100) : 0;
  const cont = contarCategorias(fotos);

  async function escolher() {
    const pasta = await window.api.escolherPasta();
    if (pasta) escanear(pasta);
  }

  return (
    <section className="tela inicio">
      <div className="cartao destaque">
        <h1>Separe as fotos boas em poucos minutos</h1>
        {NAVEGADOR ? (
          <p className="sub">
            Escolha as fotos (dá pra marcar várias de uma vez). O app verifica nitidez, luz e repetidas, mostra quais estão ruins
            e melhora as que ficaram, com a marca d'água da igreja se quiser. Nada sai do seu celular.
          </p>
        ) : (
          <p className="sub">
            Escolha a pasta das fotos. O app verifica nitidez, luz e repetidas, sugere o que apagar (vai para a Lixeira, dá pra
            recuperar) e depois melhora as que ficaram, com a marca d'água da igreja se quiser.
          </p>
        )}
        <div className="linha-acoes">
          <button className="btn primario grande" onClick={escolher} disabled={ocupado}>
            {NAVEGADOR ? (scan.pasta ? "Escolher outras fotos" : "Escolher fotos") : scan.pasta ? "Escanear outra pasta" : "Escolher pasta das fotos"}
          </button>
          {scan.pasta && !ocupado && !NAVEGADOR && (
            <button className="btn" onClick={() => escanear(scan.pasta)}>
              Escanear de novo
            </button>
          )}
          {!NAVEGADOR && (
            <label className="check">
              <input
                type="checkbox"
                checked={cfg.incluirSubpastas}
                onChange={(e) => mudarCfg({ incluirSubpastas: e.target.checked })}
                disabled={ocupado}
              />
              Incluir subpastas
            </label>
          )}
        </div>
        {!NAVEGADOR && (
          <>
            <div className="sub-rot-modo">Quando encontrar fotos tremidas, feias ou repetidas:</div>
            <EscolhaModo cfg={cfg} mudarCfg={mudarCfg} desabilitado={ocupado} />
          </>
        )}
        {NAVEGADOR && (
          <p className="dica">
            O navegador não consegue apagar fotos da galeria: o app mostra as ruins e repetidas, e você apaga no app Fotos.
          </p>
        )}
        {cfg.modo === "automatico" && !NAVEGADOR && (
          <p className="dica">
            As duvidosas nunca são apagadas sozinhas. Tudo vai para a Lixeira do Windows, então dá pra recuperar.
          </p>
        )}
      </div>

      {limpeza && (
        <div className="cartao ok-limpeza">
          <h2>Limpeza automática concluída</h2>
          <p>
            {limpeza.movidas > 0 ? (
              <>
                <b>{limpeza.movidas}</b> de {limpeza.total} fotos foram para a Lixeira: {resumoLimpeza(limpeza)}.
              </>
            ) : (
              <>Nenhuma foto ruim ou repetida entre as {limpeza.total} analisadas.</>
            )}
            {limpeza.falhas > 0 && ` ${limpeza.falhas} não puderam ser movidas (arquivo em uso).`}
          </p>
          <div className="linha-acoes">
            <button className="btn primario" onClick={() => irPara("melhorar")}>
              Melhorar as que ficaram
            </button>
            <button className="btn" onClick={() => irPara("revisar")}>
              Ver na Biblioteca
            </button>
          </div>
        </div>
      )}

      {ocupado && (
        <div className="cartao">
          <div className="progresso-topo">
            <strong>{scan.estado === "listando"
                ? "Procurando fotos…"
                : scan.estado === "limpando"
                  ? "Movendo as ruins e repetidas para a Lixeira…"
                  : `Analisando ${scan.feitas} de ${scan.total}`}</strong>
            <button className="btn pequeno" onClick={cancelar}>
              Parar
            </button>
          </div>
          <div className="barra">
            <div style={{ width: pct + "%" }} />
          </div>
        </div>
      )}

      {scan.estado === "pronto" && scan.total === 0 && (
        <div className="cartao aviso">
          {NAVEGADOR ? "Nenhuma foto escolhida." : "Nenhuma foto (JPG, PNG, WEBP) encontrada nessa pasta."}
        </div>
      )}

      {(scan.estado === "pronto" || scan.estado === "cancelado") && fotos.length > 0 && !limpeza && (
        <div className="cartao">
          <h2>{scan.estado === "cancelado" ? "Análise interrompida" : "Resultado"}</h2>
          <div className="resumo">
            {["boa", "duvida", "ruim", "duplicada"].map((c) => (
              <div key={c} className={"resumo-item cat-" + c}>
                <b>{cont[c] || 0}</b>
                <span>{NOMES_CATEGORIA[c]}</span>
              </div>
            ))}
          </div>
          <div className="linha-acoes">
            <button className="btn primario" onClick={() => irPara("revisar")}>
              Abrir Biblioteca {apagar.size ? `(${apagar.size} recusadas)` : ""}
            </button>
            <button className="btn" onClick={() => irPara("melhorar")}>
              Ir para Revelar
            </button>
          </div>
        </div>
      )}

      {scan.ignoradas.length > 0 && (
        <div className="cartao aviso">
          {scan.ignoradas.length} arquivo(s) HEIC/RAW foram pulados (formato do iPhone/câmera profissional que o computador não
          abre direto). No celular, o app analisa esses normalmente.
        </div>
      )}
    </section>
  );
}
