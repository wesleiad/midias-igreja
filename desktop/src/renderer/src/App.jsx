import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { classificar, sugeridasParaApagar } from "@core/index.js";
import { executar, limparFila, definirLogo, urlFoto } from "./motor.js";
import { useConfig, limitesDoRigor } from "./config.js";
import Inicio from "./telas/Inicio.jsx";
import Revisar from "./telas/Revisar.jsx";
import Melhorar from "./telas/Melhorar.jsx";
import Configuracoes from "./telas/Configuracoes.jsx";
import icone from "../../../build/icon.png";

const ABAS = [
  { id: "inicio", nome: "Importar", icone: "⇣" },
  { id: "revisar", nome: "Biblioteca", icone: "▦" },
  { id: "melhorar", nome: "Revelar", icone: "◐" },
  { id: "config", nome: "Ajustes", icone: "⚙" },
];

const porCaminho = (f) => f.caminho;

export default function App() {
  const [cfg, mudarCfg] = useConfig();
  const [aba, setAba] = useState("inicio");
  const [brutas, setBrutas] = useState([]); // fotos com medidas (sem julgamento)
  const [scan, setScan] = useState({ estado: "parado", feitas: 0, total: 0, pasta: null, ignoradas: [] });
  const [apagar, setApagar] = useState(() => new Set());
  const [logoUrl, setLogoUrl] = useState(null);
  const cancelado = useRef(false);
  const [atualizacao, setAtualizacao] = useState(null);
  const [limpeza, setLimpeza] = useState(null); // resumo da última limpeza automática
  const autoIniciou = useRef(false);
  useEffect(() => window.api.onAtualizacao(setAtualizacao), []);

  const limites = useMemo(() => limitesDoRigor(cfg?.rigor), [cfg?.rigor]);
  const fotos = useMemo(() => classificar(brutas, limites, porCaminho), [brutas, limites]);

  // Carrega o logo salvo e entrega aos workers.
  const recarregarLogo = useCallback(async () => {
    const caminho = await window.api.caminhoLogo();
    if (!caminho) {
      setLogoUrl(null);
      await definirLogo(null);
      return;
    }
    const u = urlFoto(caminho);
    const blob = await (await fetch(u.startsWith("blob:") ? u : u + "?t=" + Date.now())).blob();
    setLogoUrl((u) => (u && URL.revokeObjectURL(u), URL.createObjectURL(blob)));
    await definirLogo(blob);
  }, []);
  useEffect(() => {
    recarregarLogo();
  }, [recarregarLogo]);

  async function escanear(pasta) {
    cancelado.current = false;
    brutas.forEach((f) => f.miniatura && URL.revokeObjectURL(f.miniatura));
    setBrutas([]);
    setApagar(new Set());
    setLimpeza(null);
    mudarCfg({ ultimaPasta: pasta });
    setScan({ estado: "listando", feitas: 0, total: 0, pasta, ignoradas: [] });
    const { fotos: lista, ignoradas } = await window.api.listarFotos(pasta, cfg.incluirSubpastas);
    const base = lista.map((f) => ({ ...f, medidas: null }));
    const atual = [...base];
    setBrutas(base);
    setScan({ estado: "analisando", feitas: 0, total: base.length, pasta, ignoradas });

    let feitas = 0;
    let ultimo = 0;
    const atualizar = (forcar) => {
      const agora = performance.now();
      if (!forcar && agora - ultimo < 400) return;
      ultimo = agora;
      setBrutas([...atual]);
      setScan((s) => ({ ...s, feitas }));
    };
    await Promise.all(
      base.map((f, i) =>
        executar("analisar", { url: urlFoto(f.caminho) })
          .then((r) => {
            atual[i] = { ...f, medidas: r.resultado, largura: r.largura, altura: r.altura, miniatura: URL.createObjectURL(r.miniatura) };
          })
          .catch((e) => {
            if (e.message !== "cancelado") atual[i] = { ...f, erro: e.message };
          })
          .finally(() => {
            feitas++;
            atualizar(false);
          }),
      ),
    );
    atualizar(true);
    // Ruins (que abriram) e repetidas: no modo automático vão direto pra Lixeira;
    // no modo revisar, só ficam marcadas pra pessoa conferir.
    const sugeridas = sugeridasParaApagar(classificar(atual, limites, porCaminho));
    if (!cancelado.current && cfg.modo === "automatico") {
      setScan((s) => ({ ...s, estado: "limpando", feitas }));
      const r = sugeridas.length ? await moverParaLixeira(sugeridas.map((f) => f.caminho)) : { movidas: 0, falhas: [] };
      setLimpeza({
        total: atual.length,
        movidas: r.movidas,
        falhas: r.falhas.length,
        ruins: sugeridas.filter((f) => f.categoria === "ruim").length,
        repetidas: sugeridas.filter((f) => f.categoria === "duplicada").length,
      });
      setScan((s) => ({ ...s, estado: "pronto", feitas }));
      return;
    }
    setApagar(new Set(sugeridas.map((f) => f.caminho)));
    setScan((s) => ({ ...s, estado: cancelado.current ? "cancelado" : "pronto", feitas }));
    if (!cancelado.current) setAba("revisar");
  }

  function cancelar() {
    cancelado.current = true;
    limparFila();
  }

  async function moverParaLixeira(caminhos) {
    const r = await window.api.lixeira(caminhos);
    const falhas = new Set(r.falhas.map((f) => f.caminho));
    const saiu = new Set(caminhos.filter((c) => !falhas.has(c)));
    setBrutas((b) => {
      b.filter((f) => saiu.has(f.caminho)).forEach((f) => f.miniatura && URL.revokeObjectURL(f.miniatura));
      return b.filter((f) => !saiu.has(f.caminho));
    });
    setApagar((s) => new Set([...s].filter((c) => !saiu.has(c))));
    return r;
  }

  // Modo automático: ao abrir o app, já varre a última pasta e limpa.
  useEffect(() => {
    if (!cfg || autoIniciou.current) return;
    autoIniciou.current = true;
    if (cfg.modo === "automatico" && cfg.ultimaPasta) escanear(cfg.ultimaPasta);
  }, [cfg]);

  if (!cfg) return <div className="carregando">Abrindo…</div>;

  const props = { cfg, mudarCfg, fotos, scan, apagar, setApagar, logoUrl, recarregarLogo, irPara: setAba };
  const qtdApagar = apagar.size;

  return (
    <div className="app">
      <header className="topo">
        <div className="marca-app">
          <img className="logo-app" src={icone} alt="" />
          <div>
            <strong>
              Mídias <span>Igreja</span>
            </strong>
            {scan.pasta && <small title={scan.pasta}>{scan.pasta}</small>}
          </div>
        </div>
        {atualizacao?.estado === "baixando" && <span className="atualiza">Baixando atualização… {atualizacao.pct ?? 0}%</span>}
        {atualizacao?.estado === "pronta" && (
          <button className="atualiza pronta" onClick={() => window.api.instalarAtualizacao()}>
            Nova versão {atualizacao.versao} pronta · Reiniciar agora
          </button>
        )}
        <nav className="abas">
          {ABAS.map((a) => (
            <button key={a.id} className={aba === a.id ? "ativa" : ""} onClick={() => setAba(a.id)}>
              <span className="ic">{a.icone}</span>
              <span>{a.nome}</span>
              {a.id === "revisar" && qtdApagar > 0 && <em className="bolinha">{qtdApagar}</em>}
            </button>
          ))}
        </nav>
      </header>
      <main className={"conteudo modulo-" + aba}>
        {aba === "inicio" && <Inicio {...props} escanear={escanear} cancelar={cancelar} limpeza={limpeza} />}
        {aba === "revisar" && <Revisar {...props} moverParaLixeira={moverParaLixeira} />}
        {aba === "melhorar" && <Melhorar {...props} />}
        {aba === "config" && <Configuracoes {...props} />}
      </main>
    </div>
  );
}
