import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { Canvas, Image as SkiaImage } from "@shopify/react-native-skia";
import { Image } from "expo-image";
import { PRESETS, completarAjuste } from "../../../core/index.js";
import { abrirReduzida, uriLocal, salvarNaGaleria, NOME_ALBUM } from "../galeria.js";
import { renderizar, paraJpeg } from "../render.js";
import { Botao, Chip, Controle, SeletorPosicao, C, s } from "../ui.js";

const CONTROLES = [
  ["autoAjuste", "Ajuste automático", 0, 100],
  ["brilho", "Brilho"],
  ["contraste", "Contraste"],
  ["saturacao", "Cor (saturação)"],
  ["temperatura", "Temperatura (frio ↔ quente)"],
  ["nitidez", "Nitidez", 0, 100],
  ["vinheta", "Vinheta", 0, 100],
];
const pausa = () => new Promise((r) => setTimeout(r, 0));

export default function Melhorar({ cfg, mudarCfg, fotos, apagar, logo, irPara }) {
  const { width, height } = useWindowDimensions();
  const largo = width >= 760; // tablet / celular deitado: prévia e painel lado a lado
  const [presetId, setPresetId] = useState(cfg.filtroPadrao.presetId);
  const [ajuste, setAjuste] = useState(() => completarAjuste(cfg.filtroPadrao.ajuste));
  const [escopo, setEscopo] = useState("boas");
  const [atual, setAtual] = useState(0);
  const [base, setBase] = useState(null); // SkImage reduzida da foto atual
  const [original, setOriginal] = useState(false);
  const [proc, setProc] = useState(null);
  const parar = useRef(false);
  const marca = cfg.marca;

  const ficam = useMemo(
    () => fotos.filter((f) => f.medidas && !apagar.has(f.id) && (escopo === "todas" || f.categoria === "boa" || f.categoria === "duvida")),
    [fotos, apagar, escopo],
  );
  const foto = ficam[Math.min(atual, ficam.length - 1)];

  useEffect(() => {
    if (!foto) return;
    let vivo = true;
    setBase(null);
    uriLocal(foto.asset)
      .then((u) => abrirReduzida(u, 1200))
      .then((img) => vivo && setBase(img))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [foto?.id]);

  const previa = useMemo(() => {
    if (!base) return null;
    try {
      return original ? base : renderizar(base, { maxLado: 1200, ajuste, niveis: foto?.medidas?.niveis, marca, logo });
    } catch {
      return base;
    }
  }, [base, ajuste, marca, logo, original]);

  const mudar = (k, v) => {
    setPresetId("personalizado");
    setAjuste((a) => ({ ...a, [k]: v }));
  };
  const ehPadrao = presetId === cfg.filtroPadrao.presetId && JSON.stringify(completarAjuste(cfg.filtroPadrao.ajuste)) === JSON.stringify(ajuste);

  async function aplicarTodas() {
    parar.current = false;
    const p = { feitas: 0, total: ficam.length, erros: 0, fim: false };
    setProc({ ...p });
    for (const f of ficam) {
      if (parar.current) break;
      try {
        const img = await abrirReduzida(await uriLocal(f.asset), 4096);
        const pronta = renderizar(img, { maxLado: 4096, ajuste, niveis: f.medidas.niveis, marca, logo });
        await salvarNaGaleria(paraJpeg(pronta, cfg.qualidadeJpeg), f.nome || "foto");
      } catch {
        p.erros++;
      }
      p.feitas++;
      setProc({ ...p });
      await pausa();
    }
    setProc({ ...p, fim: true, parado: parar.current });
  }

  if (!fotos.length)
    return (
      <View style={[s.pad, { flex: 1, justifyContent: "center", alignItems: "center" }]}>
        <Text style={s.suave}>Escaneie as fotos primeiro.</Text>
        <Botao titulo="Escanear" tipo="primario" onPress={() => irPara("inicio")} />
      </View>
    );

  const alturaPrevia = largo ? height - 220 : Math.min(height * 0.42, width * 1.1);
  const larguraPrevia = largo ? width * 0.58 - 24 : width - 32;

  const blocoPrevia = (
    <View style={{ gap: 8 }}>
      <Pressable onPressIn={() => setOriginal(true)} onPressOut={() => setOriginal(false)}>
        <View style={{ height: alturaPrevia, width: larguraPrevia, backgroundColor: "#000", borderRadius: 14, overflow: "hidden" }}>
          {previa ? (
            <Canvas style={{ flex: 1 }}>
              <SkiaImage image={previa} x={0} y={0} width={larguraPrevia} height={alturaPrevia} fit="contain" />
            </Canvas>
          ) : (
            <Text style={[s.suave, { margin: 20 }]}>Carregando…</Text>
          )}
          <Text style={{ position: "absolute", top: 8, left: 8, color: "#fff", backgroundColor: "#000a", paddingHorizontal: 6, borderRadius: 6, fontSize: 12 }}>
            {original ? "Original" : "Depois · segure pra ver o original"}
          </Text>
        </View>
      </Pressable>
      <FlatList
        horizontal
        data={ficam.slice(0, 80)}
        keyExtractor={(x) => x.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6 }}
        renderItem={({ item, index }) => (
          <Pressable onPress={() => setAtual(index)} style={{ borderWidth: 2, borderColor: index === atual ? C.pri : "transparent", borderRadius: 8, overflow: "hidden" }}>
            <Image source={{ uri: item.uri }} style={{ width: 70, height: 52 }} contentFit="cover" recyclingKey={item.id} />
          </Pressable>
        )}
      />
    </View>
  );

  const painel = (
    <View style={[s.cartao, { gap: 6 }]}>
      <Text style={s.h3}>Filtro</Text>
      <View style={s.linha}>
        {PRESETS.map((p) => (
          <Chip
            key={p.id}
            titulo={p.nome}
            ativo={presetId === p.id}
            onPress={() => {
              setPresetId(p.id);
              setAjuste(completarAjuste(p.ajuste));
            }}
          />
        ))}
        {presetId === "personalizado" && <Chip titulo="Personalizado" ativo />}
      </View>
      {CONTROLES.map(([k, nome, min, max]) => (
        <Controle key={k} rotulo={nome} valor={ajuste[k]} min={min} max={max} onChange={(v) => mudar(k, v)} />
      ))}
      <Botao
        titulo={ehPadrao ? "✓ Este é o filtro padrão" : "Salvar como filtro padrão"}
        desabilitado={ehPadrao}
        onPress={() => mudarCfg({ filtroPadrao: { presetId, ajuste: { ...ajuste } } })}
      />

      <Text style={s.h3}>Marca d'água</Text>
      {logo ? (
        <>
          <Chip titulo={marca.ativa ? "✓ Colocar o logo da igreja" : "Colocar o logo da igreja"} ativo={marca.ativa} onPress={() => mudarCfg({ marca: { ...marca, ativa: !marca.ativa } })} />
          {marca.ativa && (
            <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
              <SeletorPosicao valor={marca.posicao} onChange={(posicao) => mudarCfg({ marca: { ...marca, posicao } })} />
              <View style={{ flex: 1 }}>
                <Controle rotulo="Tamanho" valor={marca.tamanho} min={5} max={40} sufixo="%" onChange={(tamanho) => mudarCfg({ marca: { ...marca, tamanho } })} />
              </View>
            </View>
          )}
        </>
      ) : (
        <Botao titulo="Cadastrar logo em Ajustes" onPress={() => irPara("ajustes")} />
      )}

      <Text style={s.h3}>Aplicar em</Text>
      <View style={s.linha}>
        <Chip titulo="Boas e duvidosas" ativo={escopo === "boas"} onPress={() => setEscopo("boas")} />
        <Chip titulo="Todas que ficam" ativo={escopo === "todas"} onPress={() => setEscopo("todas")} />
      </View>
      <Botao titulo={`Melhorar ${ficam.length} fotos`} tipo="primario" grande desabilitado={!ficam.length} onPress={aplicarTodas} />
      <Text style={s.suave}>As originais não mudam. As melhoradas vão para o álbum "{NOME_ALBUM}".</Text>
    </View>
  );

  return (
    <>
      {largo ? (
        <View style={{ flex: 1, flexDirection: "row", padding: 16, gap: 16 }}>
          {blocoPrevia}
          <ScrollView style={{ flex: 1 }}>{painel}</ScrollView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.pad}>
          {blocoPrevia}
          {painel}
        </ScrollView>
      )}

      <Modal visible={!!proc} transparent animationType="fade" supportedOrientations={["portrait", "landscape"]}>
        <View style={{ flex: 1, backgroundColor: "#000c", justifyContent: "center", padding: 24 }}>
          {proc && (
            <View style={s.cartao}>
              <Text style={s.h2}>{proc.fim ? (proc.parado ? "Parado" : "Pronto!") : "Melhorando fotos…"}</Text>
              <Text style={s.suave}>
                {proc.feitas} de {proc.total}
                {proc.erros ? ` · ${proc.erros} com erro` : ""}
              </Text>
              <View style={s.barra}>
                <View style={[s.barraCheia, { width: `${proc.total ? (proc.feitas / proc.total) * 100 : 0}%` }]} />
              </View>
              {proc.fim ? (
                <Botao titulo="Fechar" tipo="primario" onPress={() => setProc(null)} />
              ) : (
                <Botao titulo="Parar" onPress={() => (parar.current = true)} />
              )}
              {proc.fim && !proc.parado && <Text style={s.suave}>Estão no álbum "{NOME_ALBUM}" da galeria.</Text>}
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}
