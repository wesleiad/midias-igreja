import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { Canvas, LinearGradient, RoundedRect, vec } from "@shopify/react-native-skia";
import { POSICOES } from "../../core/index.js";

// Visual de editor de fotos: cinzas neutros e azul de destaque.
export const C = {
  fundo: "#111111",
  palco: "#0a0a0a",
  cartao: "#1e1e1e",
  cartao2: "#272727",
  borda: "#303030",
  texto: "#d6d6d6",
  claro: "#f2f2f2",
  suave: "#8a8a8a",
  pri: "#3b8eea",
  priTxt: "#ffffff",
  boa: "#4cc38a",
  duvida: "#e3b341",
  ruim: "#e5534b",
  duplicada: "#7a9df5",
};

export const NOMES_CATEGORIA = { boa: "Boas", duvida: "Duvidosas", ruim: "Ruins", duplicada: "Repetidas" };

const TRILHOS = {
  temp: ["#3d78d8", "#cfcfcf", "#e3b23c"],
  sat: ["#8a8a8a", "#e24b4b", "#e6c13b", "#49c46d", "#3d86e0"],
  luz: ["#000000", "#ffffff"],
  "luz-inv": ["#dddddd", "#000000"],
};

export function Botao({ titulo, onPress, tipo, desabilitado, grande, style }) {
  const t = tipo === "primario" ? s.btnPri : tipo === "perigo" ? s.btnPerigo : tipo === "fantasma" ? s.btnFantasma : null;
  const tt = tipo === "primario" ? { color: C.priTxt, fontWeight: "700" } : tipo === "perigo" ? { color: "#ffb4ae" } : null;
  return (
    <Pressable
      onPress={onPress}
      disabled={desabilitado}
      style={({ pressed }) => [s.btn, t, grande && s.btnGrande, desabilitado && { opacity: 0.4 }, pressed && { opacity: 0.7 }, style]}
    >
      <Text style={[s.btnTxt, tt, grande && { fontSize: 16 }]}>{titulo}</Text>
    </Pressable>
  );
}

export function Chip({ titulo, ativo, cor, onPress }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, ativo && { backgroundColor: cor || "#34465e", borderColor: cor || "#4a6487" }]}>
      <Text style={[s.chipTxt, ativo && { color: cor ? "#111" : "#fff", fontWeight: "600" }]}>{titulo}</Text>
    </Pressable>
  );
}

/** Slider fino: rótulo, valor e trilho (com gradiente opcional, como em editores de foto). */
export function Controle({ rotulo, valor, min = -100, max = 100, onChange, sufixo = "", trilho }) {
  const [larg, setLarg] = useState(0);
  const cores = TRILHOS[trilho];
  return (
    <View style={{ marginBottom: 2 }}>
      <View style={s.linhaEntre}>
        <Text style={s.rotulo}>{rotulo}</Text>
        <Text style={s.valor}>
          {valor > 0 && min < 0 ? "+" : ""}
          {valor}
          {sufixo}
        </Text>
      </View>
      <View onLayout={(e) => setLarg(e.nativeEvent.layout.width)} style={{ justifyContent: "center" }}>
        {cores && larg > 0 && (
          <Canvas style={{ position: "absolute", left: 14, right: 14, height: 3 }} pointerEvents="none">
            <RoundedRect x={0} y={0} width={larg - 28} height={3} r={1.5}>
              <LinearGradient start={vec(0, 0)} end={vec(larg - 28, 0)} colors={cores} />
            </RoundedRect>
          </Canvas>
        )}
        <Slider
          minimumValue={min}
          maximumValue={max}
          step={1}
          value={valor}
          onSlidingComplete={onChange}
          minimumTrackTintColor={cores ? "transparent" : "#9a9a9a"}
          maximumTrackTintColor={cores ? "transparent" : "#4a4a4a"}
          thumbTintColor="#e6e6e6"
        />
      </View>
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
          style={[s.posBtn, valor === p.id && { backgroundColor: C.pri, borderColor: "#5aa2f0" }]}
        />
      ))}
    </View>
  );
}

export const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: C.fundo },
  pad: { padding: 16, gap: 14 },
  cartao: { backgroundColor: C.cartao, borderColor: C.borda, borderWidth: 1, borderRadius: 10, padding: 16, gap: 10 },
  titulo: { color: C.claro, fontSize: 24, fontWeight: "300" },
  h2: { color: C.claro, fontSize: 16, fontWeight: "600" },
  h3: { color: "#777", fontSize: 11, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase", marginTop: 6 },
  texto: { color: C.texto, fontSize: 15 },
  suave: { color: C.suave, fontSize: 13 },
  rotulo: { color: "#b8b8b8", fontSize: 13 },
  valor: { color: C.claro, fontSize: 13, fontVariant: ["tabular-nums"] },
  linha: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  linhaEntre: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  btn: { backgroundColor: "#2f2f2f", borderColor: "#3c3c3c", borderWidth: 1, borderRadius: 6, paddingVertical: 10, paddingHorizontal: 14, alignItems: "center" },
  btnPri: { backgroundColor: C.pri, borderColor: C.pri },
  btnPerigo: { backgroundColor: "#3a1a1a", borderColor: "#5e2a2a" },
  btnFantasma: { backgroundColor: "transparent", borderColor: "transparent" },
  btnGrande: { paddingVertical: 14 },
  btnTxt: { color: "#e0e0e0", fontSize: 14 },
  chip: { backgroundColor: "#262626", borderColor: "#353535", borderWidth: 1, borderRadius: 99, paddingVertical: 6, paddingHorizontal: 12 },
  chipTxt: { color: "#c8c8c8", fontSize: 13 },
  barra: { height: 4, backgroundColor: "#2c2c2c", borderRadius: 99, overflow: "hidden" },
  barraCheia: { height: "100%", backgroundColor: C.pri },
  aviso: { backgroundColor: "#201c12", borderColor: "#4a3f22", borderWidth: 1, borderRadius: 8, padding: 12 },
  avisoTxt: { color: "#e7cf8f", fontSize: 13 },
  posGrade: { flexDirection: "row", flexWrap: "wrap", width: 3 * 34 + 2 * 4 + 12, gap: 4, padding: 6, backgroundColor: "#161616", borderWidth: 1, borderColor: "#2c2c2c", borderRadius: 6 },
  posBtn: { width: 34, height: 24, borderRadius: 3, borderWidth: 1, borderColor: "#3a3a3a", backgroundColor: "#262626" },
});
