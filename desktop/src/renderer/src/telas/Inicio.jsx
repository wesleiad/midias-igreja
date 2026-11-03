import { contarCategorias, NOMES_CATEGORIA } from "../util.js";

export default function Inicio({ cfg, mudarCfg, fotos, scan, apagar, escanear, cancelar, irPara }) {
  const ocupado = scan.estado === "listando" || scan.estado === "analisando";
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
        <p className="sub">
          Escolha a pasta das fotos. O app verifica nitidez, luz e repetidas, sugere o que apagar (vai para a Lixeira, dá pra
          recuperar) e depois melhora as que ficaram, com a marca d'água da igreja se quiser.
        </p>
        <div className="linha-acoes">
          <button className="btn primario grande" onClick={escolher} disabled={ocupado}>
            {scan.pasta ? "Escanear outra pasta" : "Escolher pasta das fotos"}
          </button>
          {scan.pasta && !ocupado && (
            <button className="btn" onClick={() => escanear(scan.pasta)}>
              Escanear de novo
            </button>
          )}
          <label className="check">
            <input
              type="checkbox"
              checked={cfg.incluirSubpastas}
              onChange={(e) => mudarCfg({ incluirSubpastas: e.target.checked })}
              disabled={ocupado}
            />
            Incluir subpastas
          </label>
        </div>
      </div>

      {ocupado && (
        <div className="cartao">
          <div className="progresso-topo">
            <strong>{scan.estado === "listando" ? "Procurando fotos…" : `Analisando ${scan.feitas} de ${scan.total}`}</strong>
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
        <div className="cartao aviso">Nenhuma foto (JPG, PNG, WEBP) encontrada nessa pasta.</div>
      )}

      {(scan.estado === "pronto" || scan.estado === "cancelado") && fotos.length > 0 && (
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
              Revisar {apagar.size ? `(${apagar.size} marcadas pra apagar)` : ""}
            </button>
            <button className="btn" onClick={() => irPara("melhorar")}>
              Ir direto para Melhorar
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
