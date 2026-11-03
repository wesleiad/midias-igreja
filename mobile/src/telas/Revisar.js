import { useMemo, useState } from "react";
import { FlatList, Modal, Platform, Pressable, Text, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { Botao, Chip, C, s, NOMES_CATEGORIA } from "../ui.js";

const ORDEM = ["ruim", "duplicada", "duvida", "boa"];
const DICAS = {
  ruim: "Desfocadas, tremidas, escuras ou estouradas. Já vêm recusadas.",
  duplicada: "Fotos quase iguais. A melhor de cada grupo fica; as outras vêm recusadas.",
  duvida: "Passáveis, com algum defeito. Você decide.",
  boa: "Boas. Nada recusado.",
};

export default function Revisar({ fotos, apagar, setApagar, apagarMarcadas, scan, irPara }) {
  const { width } = useWindowDimensions();
  const colunas = Math.max(3, Math.floor(width / 130));
  const lado = (width - 16 * 2 - 6 * (colunas - 1)) / colunas;
  const cont = {};
  fotos.forEach((f) => (cont[f.categoria] = (cont[f.categoria] || 0) + 1));
  const [cat, setCat] = useState(() => ORDEM.find((c) => cont[c]) || "boa");
  const [aberta, setAberta] = useState(null);
  const [msg, setMsg] = useState(null);
  const [apagando, setApagando] = useState(false);

  const lista = useMemo(() => {
    if (cat !== "duplicada") return fotos.filter((f) => f.categoria === cat);
    const grupos = new Set(fotos.filter((f) => f.categoria === "duplicada").map((f) => f.grupo));
    return fotos.filter((f) => grupos.has(f.grupo)).sort((a, b) => a.grupo - b.grupo || b.melhorDoGrupo - a.melhorDoGrupo);
  }, [fotos, cat]);

  const alternar = (id) =>
    setApagar((a) => {
      const n = new Set(a);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const marcarTodas = (v) =>
    setApagar((a) => {
      const n = new Set(a);
      lista.forEach((f) => !(cat === "duplicada" && f.melhorDoGrupo) && (v ? n.add(f.id) : n.delete(f.id)));
      return n;
    });

  async function apagarAgora() {
    const ids = [...apagar];
    setApagando(true);
    try {
      const ok = await apagarMarcadas(ids);
      setMsg(ok ? `${ids.length} fotos apagadas.` : "Nada foi apagado.");
    } catch (e) {
      setMsg("Nada foi apagado (" + (e?.message || "cancelado") + ").");
    }
    setApagando(false);
  }

  if (!fotos.length)
    return (
      <View style={[s.pad, { flex: 1, justifyContent: "center", alignItems: "center" }]}>
        <Text style={s.suave}>Nenhuma foto escaneada ainda.</Text>
        <Botao titulo="Importar" tipo="primario" onPress={() => irPara("inicio")} />
      </View>
    );

  const f = aberta != null ? lista[aberta] : null;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}>
        <View style={s.linha}>
          {ORDEM.map((c) => (
            <Chip key={c} titulo={`${NOMES_CATEGORIA[c]} ${cont[c] || 0}`} ativo={cat === c} cor={C[c]} onPress={() => setCat(c)} />
          ))}
        </View>
        <Text style={s.suave}>{DICAS[cat]}</Text>
        <View style={s.linha}>
          <Botao titulo="Recusar todas" onPress={() => marcarTodas(true)} />
          <Botao titulo="Manter todas" onPress={() => marcarTodas(false)} />
        </View>
        {scan.estado === "analisando" && <Text style={s.avisoTxt}>Ainda analisando… a lista se completa sozinha.</Text>}
        {msg && (
          <Text style={{ color: "#a8ecc9" }} onPress={() => setMsg(null)}>
            {msg}
          </Text>
        )}
      </View>

      <FlatList
        key={colunas}
        data={lista}
        numColumns={colunas}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: 16, gap: 6 }}
        columnWrapperStyle={{ gap: 6 }}
        ListEmptyComponent={<Text style={[s.suave, { textAlign: "center", padding: 30 }]}>Nada aqui. 🎉</Text>}
        renderItem={({ item, index }) => {
          const marcada = apagar.has(item.id);
          return (
            <Pressable
              onPress={() => alternar(item.id)}
              onLongPress={() => setAberta(index)}
              style={{ width: lado, height: lado + 22, borderRadius: 3, backgroundColor: marcada ? "#2a1d1d" : "#262626" }}
            >
              <Text style={{ position: "absolute", top: 0, left: 5, fontSize: 18, fontWeight: "700", color: "#ffffff14" }}>{index + 1}</Text>
              <Image source={{ uri: item.uri }} style={{ flex: 1, margin: 8, marginBottom: 2, opacity: marcada ? 0.35 : 1 }} contentFit="contain" recyclingKey={item.id} />
              <View style={{ height: 20, flexDirection: "row", alignItems: "center", paddingHorizontal: 6, gap: 4 }}>
                <Text style={{ color: marcada ? "#ff7a72" : "#666", fontSize: marcada ? 10 : 12, fontWeight: marcada ? "700" : "400" }}>
                  {marcada ? "⚑ Recusada" : "⚐"}
                </Text>
                {item.melhorDoGrupo && <Text style={{ color: C.boa, fontSize: 10 }}>★ melhor</Text>}
                <Text style={{ marginLeft: "auto", color: "#888", fontSize: 10 }}>{item.medidas?.nota ?? ""}</Text>
              </View>
            </Pressable>
          );
        }}
      />

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: C.borda, backgroundColor: "#12151b" }}>
        <Text style={s.texto}>
          <Text style={{ fontWeight: "700" }}>{apagar.size}</Text> recusadas
        </Text>
        <Botao titulo={apagando ? "Apagando…" : "Apagar recusadas"} tipo="perigo" desabilitado={!apagar.size || apagando} onPress={apagarAgora} />
      </View>
      <Text style={[s.suave, { fontSize: 12, textAlign: "center", paddingBottom: 6, backgroundColor: "#12151b" }]}>
        Toque recusa/mantém · segure pra ampliar ·{" "}
        {Platform.OS === "ios" ? "vão para Apagados Recentemente" : "o celular pede confirmação antes de apagar"}
      </Text>

      <Modal visible={!!f} animationType="fade" onRequestClose={() => setAberta(null)} supportedOrientations={["portrait", "landscape"]}>
        {f && (
          <View style={{ flex: 1, backgroundColor: "#000" }}>
            <Image source={{ uri: f.uri }} style={{ flex: 1 }} contentFit="contain" />
            <View style={[s.pad, { backgroundColor: C.cartao }]}>
              <Text style={s.texto} numberOfLines={1}>
                {f.nome} · nota {f.medidas?.nota ?? "-"}/100
              </Text>
              {f.problemas?.length > 0 && <Text style={{ color: "#ffb3b3" }}>{f.problemas.join(" · ")}</Text>}
              <View style={s.linha}>
                <Botao titulo="←" desabilitado={aberta === 0} onPress={() => setAberta(aberta - 1)} />
                <Botao
                  titulo={apagar.has(f.id) ? "⚑ Recusada" : "⚐ Recusar"}
                  tipo={apagar.has(f.id) ? "perigo" : undefined}
                  onPress={() => alternar(f.id)}
                  style={{ flex: 1 }}
                />
                <Botao titulo="→" desabilitado={aberta === lista.length - 1} onPress={() => setAberta(aberta + 1)} />
              </View>
              <Botao titulo="Fechar" onPress={() => setAberta(null)} />
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}
