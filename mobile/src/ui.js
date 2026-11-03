import { Pressable, StyleSheet, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { POSICOES } from "../../core/index.js";

export const C = {
  fundo: "#0f1115",
  cartao: "#181b22",
  cartao2: "#20242d",
  borda: "#2b303b",
  texto: "#e9ecf2",
  suave: "#9aa3b2",
  pri: "#f2b84b",
  priTxt: "#1a1405",
  boa: "#3ccf8e",
  duvida: "#f2b84b",
  ruim: "#ef5b5b",
  duplicada: "#7aa7ff",
};

export const NOMES_CATEGORIA = { boa: "Boas", duvida: "Duvidosas", ruim: "Ruins", duplicada: "Repetidas" };

export function Botao({ titulo, onPress, tipo, desabilitado, grande, style }) {
  const t = tipo === "primario" ? s.btnPri : tipo === "perigo" ? s.btnPerigo : null;
  const tt = tipo === "primario" ? { color: C.priTxt, fontWeight: "700" } : tipo === "perigo" ? { color: "#ffb3b3" } : null;
  return (
    <Pressable
      onPress={onPress}
      disabled={desabilitado}
      style={({ pressed }) => [s.btn, t, grande && s.btnGrande, desabilitado && { opacity: 0.45 }, pressed && { opacity: 0.75 }, style]}
    >
      <Text style={[s.btnTxt, tt, grande && { fontSize: 16 }]}>{titulo}</Text>
    </Pressable>
  );
}

export function Chip({ titulo, ativo, cor, onPress }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, ativo && { backgroundColor: cor || C.pri, borderColor: cor || C.pri }]}>
      <Text style={[s.chipTxt, ativo && { color: "#111", fontWeight: "700" }]}>{titulo}</Text>
    </Pressable>
  );
}

export function Controle({ rotulo, valor, min = -100, max = 100, onChange, sufixo = "" }) {
  return (
    <View style={{ marginBottom: 4 }}>
      <View style={s.linhaEntre}>
        <Text style={s.suave}>{rotulo}</Text>
        <Text style={s.texto}>
          {valor > 0 && min < 0 ? "+" : ""}
          {valor}
          {sufixo}
        </Text>
      </View>
      <Slider
        minimumValue={min}
        maximumValue={max}
        step={1}
        value={valor}
        onSlidingComplete={onChange}
        minimumTrackTintColor={C.pri}
        maximumTrackTintColor={C.borda}
        thumbTintColor={C.pri}
      />
    </View>
  );
}

export function SeletorPosicao({ valor, onChange }) {
  return (
    <View style={s.posGrade}>
      {POSICOES.map((p) => (
        <Pressable
          key={p.id}
          accessibilityLabel={p.nome}
          onPress={() => onChange(p.id)}
          style={[s.posBtn, valor === p.id && { backgroundColor: C.pri, borderColor: C.pri }]}
        />
      ))}
    </View>
  );
}

export const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: C.fundo },
  pad: { padding: 16, gap: 14 },
  cartao: { backgroundColor: C.cartao, borderColor: C.borda, borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  titulo: { color: C.texto, fontSize: 22, fontWeight: "700" },
  h2: { color: C.texto, fontSize: 17, fontWeight: "700" },
  h3: { color: C.suave, fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: 8 },
  texto: { color: C.texto, fontSize: 15 },
  suave: { color: C.suave, fontSize: 14 },
  linha: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  linhaEntre: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  btn: { backgroundColor: C.cartao2, borderColor: C.borda, borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, alignItems: "center" },
  btnPri: { backgroundColor: C.pri, borderColor: C.pri },
  btnPerigo: { backgroundColor: "#3a1719", borderColor: "#6a2a2e" },
  btnGrande: { paddingVertical: 14 },
  btnTxt: { color: C.texto, fontSize: 14 },
  chip: { backgroundColor: C.cartao2, borderColor: C.borda, borderWidth: 1, borderRadius: 99, paddingVertical: 7, paddingHorizontal: 13 },
  chipTxt: { color: C.texto, fontSize: 14 },
  barra: { height: 10, backgroundColor: C.cartao2, borderRadius: 99, overflow: "hidden" },
  barraCheia: { height: "100%", backgroundColor: C.pri },
  aviso: { backgroundColor: "#221d12", borderColor: "#5a4a22", borderWidth: 1, borderRadius: 12, padding: 12 },
  avisoTxt: { color: "#f0d79a", fontSize: 14 },
  posGrade: { flexDirection: "row", flexWrap: "wrap", width: 3 * 38 + 12, gap: 4, padding: 6, backgroundColor: C.cartao2, borderRadius: 10 },
  posBtn: { width: 34, height: 26, borderRadius: 6, borderWidth: 1, borderColor: C.borda, backgroundColor: "#2a2f3a" },
});
