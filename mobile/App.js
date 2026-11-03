import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { classificar, sugeridasParaApagar } from "../core/index.js";
import { useConfig, limitesDoRigor, carregarLogo } from "./src/config.js";
import { listarFotos, analisarFoto, lerCache, chaveCache, gravarCache, apagarFotos } from "./src/galeria.js";
import { C, s } from "./src/ui.js";
import Inicio from "./src/telas/Inicio.js";
import Revisar from "./src/telas/Revisar.js";
import Melhorar from "./src/telas/Melhorar.js";
import Ajustes from "./src/telas/Ajustes.js";

const ABAS = [
  { id: "inicio", nome: "Importar", icone: "⇣" },
  { id: "revisar", nome: "Biblioteca", icone: "▦" },
  { id: "melhorar", nome: "Revelar", icone: "◐" },
  { id: "ajustes", nome: "Ajustes", icone: "⚙" },
];
const porId = (f) => f.id;
const pausa = () => new Promise((r) => setTimeout(r, 0));

export default function App() {
  const [cfg, mudarCfg] = useConfig();
  const [aba, setAba] = useState("inicio");
  const [brutas, setBrutas] = useState([]);
  const [scan, setScan] = useState({ estado: "parado", feitas: 0, total: 0 });
  const [apagar, setApagar] = useState(() => new Set());
  const [logo, setLogo] = useState(null);
  const cancelado = useRef(false);
  const [novaVersao, setNovaVersao] = useState(false);

  // Atualização pelo ar: baixa em segundo plano e oferece reiniciar.
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    Updates.checkForUpdateAsync()
      .then((r) => (r.isAvailable ? Updates.fetchUpdateAsync() : null))
      .then((r) => r?.isNew && setNovaVersao(true))
      .catch(() => {});
  }, []);

  const limites = useMemo(() => limitesDoRigor(cfg?.rigor), [cfg?.rigor]);
  const fotos = useMemo(() => classificar(brutas, limites, porId), [brutas, limites]);

  const recarregarLogo = useCallback(async () => setLogo(await carregarLogo().catch(() => null)), []);
  useEffect(() => {
    recarregarLogo();
  }, [recarregarLogo]);

  async function escanear({ albumId, limite }) {
    cancelado.current = false;
    setApagar(new Set());
    setScan({ estado: "listando", feitas: 0, total: 0 });
    const lista = await listarFotos({ albumId, limite });
    const cache = lerCache();
    const atual = lista.map((a) => ({
      id: a.id,
      uri: a.uri,
      nome: a.filename,
      largura: a.width,
      altura: a.height,
      asset: a,
      medidas: cache[chaveCache(a)] || null,
    }));
    setBrutas([...atual]);
    setScan({ estado: "analisando", feitas: 0, total: atual.length });

    // Duas de cada vez: aproveita o celular sem travar a tela.
    let prox = 0;
    let feitas = atual.filter((f) => f.medidas).length;
    let ultimo = 0;
    const trabalhador = async () => {
      while (!cancelado.current) {
        const i = prox++;
        if (i >= atual.length) return;
        if (atual[i].medidas) continue;
        try {
          const m = await analisarFoto(atual[i].asset);
          cache[chaveCache(atual[i].asset)] = m;
          atual[i] = { ...atual[i], medidas: m };
        } catch (e) {
          atual[i] = { ...atual[i], erro: String(e?.message || e) };
        }
        feitas++;
        if (Date.now() - ultimo > 700) {
          ultimo = Date.now();
          setBrutas([...atual]);
          setScan((sc) => ({ ...sc, feitas }));
          await pausa();
        }
        if (feitas % 50 === 0) gravarCache();
      }
    };
    await Promise.all([trabalhador(), trabalhador()]);
    await gravarCache();
    setBrutas([...atual]);
    setApagar(new Set(sugeridasParaApagar(classificar(atual, limites, porId)).map((f) => f.id)));
    setScan({ estado: cancelado.current ? "cancelado" : "pronto", feitas, total: atual.length });
    if (!cancelado.current) setAba("revisar");
  }

  async function apagarMarcadas(ids) {
    const ok = await apagarFotos(ids);
    if (!ok) return false;
    const saiu = new Set(ids);
    setBrutas((b) => b.filter((f) => !saiu.has(f.id)));
    setApagar((a) => new Set([...a].filter((id) => !saiu.has(id))));
    return true;
  }

  if (!cfg) return <View style={s.tela} />;
  const props = { cfg, mudarCfg, fotos, scan, apagar, setApagar, logo, recarregarLogo, irPara: setAba };

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SafeAreaView style={s.tela} edges={["top", "left", "right"]}>
        {novaVersao && (
          <Pressable onPress={() => Updates.reloadAsync()} style={{ backgroundColor: C.pri, paddingVertical: 8, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Nova versão pronta · toque para reiniciar</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          {aba === "inicio" && <Inicio {...props} escanear={escanear} cancelar={() => (cancelado.current = true)} />}
          {aba === "revisar" && <Revisar {...props} apagarMarcadas={apagarMarcadas} />}
          {aba === "melhorar" && <Melhorar {...props} />}
          {aba === "ajustes" && <Ajustes {...props} />}
        </View>
      </SafeAreaView>
      <SafeAreaView edges={["bottom"]} style={{ backgroundColor: "#12151b", borderTopWidth: 1, borderTopColor: C.borda }}>
        <View style={{ flexDirection: "row" }}>
          {ABAS.map((a) => (
            <Pressable key={a.id} onPress={() => setAba(a.id)} style={{ flex: 1, alignItems: "center", paddingVertical: 8 }}>
              <Text style={{ fontSize: 20, color: aba === a.id ? C.pri : C.suave }}>{a.icone}</Text>
              <Text style={{ fontSize: 12, color: aba === a.id ? C.pri : C.suave }}>
                {a.nome}
                {a.id === "revisar" && apagar.size > 0 ? ` (${apagar.size})` : ""}
              </Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
