import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { avaliar, agruparDuplicadas } from "@core/index.js";
import { executar, limparFila, definirLogo, urlFoto } from "./motor.js";
import { useConfig, limitesDoRigor } from "./config.js";
import Inicio from "./telas/Inicio.jsx";
import Revisar from "./telas/Revisar.jsx";
import Melhorar from "./telas/Melhorar.jsx";
import Configuracoes from "./telas/Configuracoes.jsx";

const ABAS = [
  { id: "inicio", nome: "Escanear", icone: "⌕" },
  { id: "revisar", nome: "Revisar", icone: "☑" },
  { id: "melhorar", nome: "Melhorar", icone: "✦" },
  { id: "config", nome: "Ajustes", icone: "⚙" },
];

/** Junta medidas + rigor + duplicadas e decide a categoria de cada foto. */
function classificar(fotos, limites) {
  const medidas = fotos.filter((f) => f.medidas);
  const grupos = agruparDuplicadas(
    medidas.map((f) => ({ id: f.caminho, hash: f.medidas.hash, nota: f.medidas.nota })),
    limites.distanciaDuplicada,
  );
  const dup = new Map();
  grupos.forEach((g, gi) => g.forEach((it, k) => dup.set(it.id, { grupo: gi, melhor: k === 0 })));
  return fotos.map((f) => {
    if (f.erro) return { ...f, categoria: "ruim", problemas: ["Arquivo não abriu (pode estar corrompido)"], grupo: null };
    if (!f.medidas) return { ...f, categoria: "pendente", problemas: [], grupo: null };
    const { veredito, problemas } = avaliar(f.medidas, limites);
    const d = dup.get(f.caminho);
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

export default function App() {
  const [cfg, mudarCfg] = useConfig();
  const [aba, setAba] = useState("inicio");
  const [brutas, setBrutas] = useState([]); // fotos com medidas (sem julgamento)
  const [scan, setScan] = useState({ estado: "parado", feitas: 0, total: 0, pasta: null, ignoradas: [] });
  const [apagar, setApagar] = useState(() => new Set());
  const [logoUrl, setLogoUrl] = useState(null);
  const cancelado = useRef(false);

  const limites = useMemo(() => limitesDoRigor(cfg?.rigor), [cfg?.rigor]);
  const fotos = useMemo(() => classificar(brutas, limites), [brutas, limites]);

  // Carrega o logo salvo e entrega aos workers.
  const recarregarLogo = useCallback(async () => {
    const caminho = await window.api.caminhoLogo();
    if (!caminho) {
      setLogoUrl(null);
      await definirLogo(null);
      return;
    }
    const blob = await (await fetch(urlFoto(caminho) + "?t=" + Date.now())).blob();
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
    // Já deixa marcadas pra apagar as ruins (que abriram) e as repetidas.
    const classificadas = classificar(atual, limites);
    setApagar(new Set(classificadas.filter((f) => (f.categoria === "ruim" && !f.erro) || f.categoria === "duplicada").map((f) => f.caminho)));
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

  if (!cfg) return <div className="carregando">Abrindo…</div>;

  const props = { cfg, mudarCfg, fotos, scan, apagar, setApagar, logoUrl, recarregarLogo, irPara: setAba };
  const qtdApagar = apagar.size;

  return (
    <div className="app">
      <header className="topo">
        <div className="marca-app">
          <span className="logo-app">◐</span>
          <div>
            <strong>Fotos Com.Vida</strong>
            {scan.pasta && <small title={scan.pasta}>{scan.pasta}</small>}
          </div>
        </div>
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
      <main className="conteudo">
        {aba === "inicio" && <Inicio {...props} escanear={escanear} cancelar={cancelar} />}
        {aba === "revisar" && <Revisar {...props} moverParaLixeira={moverParaLixeira} />}
        {aba === "melhorar" && <Melhorar {...props} />}
        {aba === "config" && <Configuracoes {...props} />}
      </main>
    </div>
  );
}
