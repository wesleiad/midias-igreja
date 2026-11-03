import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { Canvas, Image as SkiaImage } from "@shopify/react-native-skia";
import { Image } from "expo-image";
import { PRESETS, completarAjuste } from "../../../core/index.js";
import { abrirReduzida, uriLocal, salvarNaGaleria, NOME_ALBUM } from "../galeria.js";
import { renderizar, paraJpeg } from "../render.js";
import { Botao, Chip, Controle, SeletorPosicao, C, s } from "../ui.js";

const FERRAMENTAS = [
  { id: "presets", nome: "Predefinições", icone: "▤" },
  { id: "luz", nome: "Luz", icone: "☀" },
  { id: "cor", nome: "Cor", icone: "◑" },
  { id: "detalhe", nome: "Detalhe", icone: "◇" },
  { id: "efeitos", nome: "Efeitos", icone: "◎" },
  { id: "marca", nome: "Marca", icone: "©" },
];
const pausa = () => new Promise((r) => setTimeout(r, 0));

/** Miniatura de cada predefinição aplicada na foto atual. */
function MiniPreset({ base, preset, niveis, ativo, onPress }) {
  const img = useMemo(() => {
    try {
      return renderizar(base, { maxLado: 140, ajuste: preset.ajuste, niveis });
    } catch {
      return null;
    }
  }, [base, preset.id]);
  return (
    <Pressable onPress={onPress} style={{ width: 76, alignItems: "center", gap: 5 }}>
      <View style={{ width: 70, height: 70, borderRadius: 4, overflow: "hidden", borderWidth: 2, borderColor: ativo ? C.pri : "transparent", backgroundColor: "#222" }}>
        {img && (
          <Canvas style={{ flex: 1 }}>
            <SkiaImage image={img} x={0} y={0} width={66} height={66} fit="cover" />
          </Canvas>
        )}
      </View>
      <Text numberOfLines={1} style={{ color: ativo ? C.claro : C.suave, fontSize: 11 }}>
        {preset.nome}
      </Text>
    </Pressable>
  );
}

export default function Melhorar({ cfg, mudarCfg, fotos, apagar, logo, irPara }) {
  const { width, height } = useWindowDimensions();
  const largo = width >= 760;
  const [presetId, setPresetId] = useState(cfg.filtroPadrao.presetId);
  const [ajuste, setAjuste] = useState(() => completarAjuste(cfg.filtroPadrao.ajuste));
  const [escopo, setEscopo] = useState("boas");
  const [atual, setAtual] = useState(0);
  const [base, setBase] = useState(null);
  const [original, setOriginal] = useState(false);
  const [ferramenta, setFerramenta] = useState("presets");
  const [exportar, setExportar] = useState(false);
  const [proc, setProc] = useState(null);
  const [palco, setPalco] = useState({ w: 0, h: 0 });
  const parar = useRef(false);
  const marca = cfg.marca;
  const setMarca = (p) => mudarCfg({ marca: { ...marca, ...p } });

  const ficam = useMemo(
    () => fotos.filter((f) => f.medidas && !apagar.has(f.id) && (escopo === "todas" || f.categoria === "boa" || f.categoria === "duvida")),
    [fotos, apagar, escopo],
  );
  const idx = Math.min(atual, Math.max(0, ficam.length - 1));
  const foto = ficam[idx];

  useEffect(() => {
    if (!foto) return;
    let vivo = true;
    setBase(null);
    uriLocal(foto.asset)
      .then((u) => abrirReduzida(u, 1400))
      .then((img) => vivo && setBase(img))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [foto?.id]);

  const previa = useMemo(() => {
    if (!base) return null;
    try {
      return original ? base : renderizar(base, { maxLado: 1400, ajuste, niveis: foto?.medidas?.niveis, marca, logo });
    } catch {
      return base;
    }
  }, [base, ajuste, marca, logo, original]);
  const miniBase = useMemo(() => (base ? renderizar(base, { maxLado: 140, ajuste: null }) : null), [base]);

  const mudar = (k, v) => {
    setPresetId("personalizado");
    setAjuste((a) => ({ ...a, [k]: v }));
  };
  const ehPadrao = presetId === cfg.filtroPadrao.presetId && JSON.stringify(completarAjuste(cfg.filtroPadrao.ajuste)) === JSON.stringify(ajuste);

  async function aplicarTodas() {
    setExportar(false);
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
        <Text style={s.suave}>Importe as fotos primeiro.</Text>
        <Botao titulo="Importar" tipo="primario" onPress={() => irPara("inicio")} />
      </View>
    );

  const conteudoFerramenta = {
    presets: miniBase ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingVertical: 4 }}>
        {PRESETS.map((p) => (
          <MiniPreset
            key={p.id}
            base={miniBase}
            preset={p}
            niveis={foto?.medidas?.niveis}
            ativo={presetId === p.id}
            onPress={() => {
              setPresetId(p.id);
              setAjuste(completarAjuste(p.ajuste));
            }}
          />
        ))}
      </ScrollView>
    ) : (
      <Text style={s.suave}>Carregando…</Text>
    ),
    luz: (
      <>
        <Controle rotulo="Auto" valor={ajuste.autoAjuste} min={0} max={100} onChange={(v) => mudar("autoAjuste", v)} />
        <Controle rotulo="Brilho" valor={ajuste.brilho} onChange={(v) => mudar("brilho", v)} trilho="luz" />
        <Controle rotulo="Contraste" valor={ajuste.contraste} onChange={(v) => mudar("contraste", v)} />
      </>
    ),
    cor: (
      <>
        <Controle rotulo="Temperatura" valor={ajuste.temperatura} onChange={(v) => mudar("temperatura", v)} trilho="temp" />
        <Controle rotulo="Saturação" valor={ajuste.saturacao} onChange={(v) => mudar("saturacao", v)} trilho="sat" />
      </>
    ),
    detalhe: <Controle rotulo="Nitidez" valor={ajuste.nitidez} min={0} max={100} onChange={(v) => mudar("nitidez", v)} />,
    efeitos: <Controle rotulo="Vinheta" valor={ajuste.vinheta} min={0} max={100} onChange={(v) => mudar("vinheta", v)} trilho="luz-inv" />,
    marca: logo ? (
      <>
        <Chip titulo={marca.ativa ? "✓ Logo da igreja ligado" : "Logo da igreja desligado"} ativo={marca.ativa} onPress={() => setMarca({ ativa: !marca.ativa })} />
        <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-start", opacity: marca.ativa ? 1 : 0.4, marginTop: 6 }}>
          <SeletorPosicao valor={marca.posicao} onChange={(posicao) => setMarca({ posicao })} />
          <View style={{ flex: 1 }}>
            <Controle rotulo="Tamanho" valor={marca.tamanho} min={5} max={40} sufixo="%" onChange={(tamanho) => setMarca({ tamanho })} />
            <Controle rotulo="Opacidade" valor={marca.opacidade} min={20} max={100} sufixo="%" onChange={(opacidade) => setMarca({ opacidade })} />
          </View>
        </View>
      </>
    ) : (
      <Botao titulo="Cadastrar logo em Ajustes" onPress={() => irPara("ajustes")} />
    ),
  }[ferramenta];

  const topo = (
    <View style={[s.linhaEntre, { paddingHorizontal: 12, height: 48 }]}>
      <Text style={{ color: C.suave, fontSize: 13, flex: 1 }} numberOfLines={1}>
        {foto ? `${foto.nome}  ·  ${idx + 1} de ${ficam.length}` : ""}
      </Text>
      <Botao titulo="Redefinir" tipo="fantasma" onPress={() => { setPresetId("original"); setAjuste(completarAjuste({})); }} />
      <Botao titulo={`Exportar ${ficam.length}`} tipo="primario" desabilitado={!ficam.length} onPress={() => setExportar(true)} style={{ paddingVertical: 7 }} />
    </View>
  );

  const imagem = (
    <Pressable
      style={{ flex: 1, backgroundColor: C.palco }}
      onPressIn={() => setOriginal(true)}
      onPressOut={() => setOriginal(false)}
      onLayout={(e) => setPalco({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {previa && palco.w > 0 ? (
        <Canvas style={{ flex: 1 }}>
          <SkiaImage image={previa} x={8} y={8} width={palco.w - 16} height={palco.h - 16} fit="contain" />
        </Canvas>
      ) : (
        <Text style={[s.suave, { margin: 20 }]}>{foto ? "Carregando…" : "Nenhuma foto sobrou nesse filtro."}</Text>
      )}
      {original && (
        <Text style={{ position: "absolute", top: 10, left: 10, color: "#ddd", backgroundColor: "#000b", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, fontSize: 12 }}>
          Original
        </Text>
      )}
    </Pressable>
  );

  const tira = (
    <FlatList
      horizontal
      data={ficam}
      keyExtractor={(x) => x.id}
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, backgroundColor: "#161616" }}
      contentContainerStyle={{ gap: 3, padding: 5 }}
      initialNumToRender={12}
      renderItem={({ item, index }) => (
        <Pressable onPress={() => setAtual(index)} style={{ padding: 2, borderRadius: 3, backgroundColor: index === idx ? "#555" : "#262626" }}>
          <Image source={{ uri: item.uri }} style={{ width: 56, height: 42, borderRadius: 2 }} contentFit="cover" recyclingKey={item.id} />
        </Pressable>
      )}
    />
  );

  const painel = (
    <View style={{ backgroundColor: C.cartao, borderTopWidth: 1, borderTopColor: "#262626" }}>
      <View style={{ minHeight: 120, maxHeight: largo ? undefined : height * 0.28, paddingHorizontal: 16, paddingTop: 10 }}>
        <ScrollView>
          {ferramenta !== "presets" && ferramenta !== "marca" && (
            <View style={[s.linhaEntre, { marginBottom: 4 }]}>
              <Text style={s.h3}>{FERRAMENTAS.find((f) => f.id === ferramenta).nome}</Text>
              <Pressable onPress={() => mudarCfg({ filtroPadrao: { presetId, ajuste: { ...ajuste } } })} disabled={ehPadrao}>
                <Text style={{ color: ehPadrao ? C.suave : "#5aa2f0", fontSize: 12 }}>{ehPadrao ? "✓ filtro padrão" : "Salvar como padrão"}</Text>
              </Pressable>
            </View>
          )}
          {conteudoFerramenta}
        </ScrollView>
      </View>
      <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: "#262626", backgroundColor: "#181818" }}>
        {FERRAMENTAS.map((f) => (
          <Pressable key={f.id} onPress={() => setFerramenta(f.id)} style={{ flex: 1, alignItems: "center", paddingVertical: 8 }}>
            <Text style={{ fontSize: 18, color: ferramenta === f.id ? C.claro : "#6f6f6f" }}>{f.icone}</Text>
            <Text numberOfLines={1} style={{ fontSize: 10, color: ferramenta === f.id ? C.claro : "#6f6f6f" }}>
              {f.nome}
            </Text>
            {ferramenta === f.id && <View style={{ position: "absolute", top: 0, width: 22, height: 2, backgroundColor: C.pri }} />}
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.palco }}>
      {topo}
      {largo ? (
        <View style={{ flex: 1, flexDirection: "row" }}>
          <View style={{ flex: 1 }}>
            {imagem}
            {tira}
          </View>
          <View style={{ width: 360, justifyContent: "flex-end", backgroundColor: C.cartao }}>{painel}</View>
        </View>
      ) : (
        <>
          {imagem}
          {tira}
          {painel}
        </>
      )}

      <Modal visible={exportar} transparent animationType="fade" onRequestClose={() => setExportar(false)} supportedOrientations={["portrait", "landscape"]}>
        <View style={{ flex: 1, backgroundColor: "#000c", justifyContent: "flex-end" }}>
          <View style={[s.cartao, { borderRadius: 0, borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingBottom: 30 }]}>
            <Text style={s.h2}>Exportar fotos</Text>
            <Text style={s.h3}>Quais fotos</Text>
            <View style={s.linha}>
              <Chip titulo="Boas e duvidosas" ativo={escopo === "boas"} onPress={() => setEscopo("boas")} />
              <Chip titulo="Todas não recusadas" ativo={escopo === "todas"} onPress={() => setEscopo("todas")} />
            </View>
            <Text style={s.suave}>
              {ficam.length} fotos com o filtro atual{marca.ativa && logo ? " e a marca d'água" : ""}. As originais não mudam; as novas vão para o álbum "{NOME_ALBUM}".
            </Text>
            <Botao titulo={`Exportar ${ficam.length} fotos`} tipo="primario" grande desabilitado={!ficam.length} onPress={aplicarTodas} />
            <Botao titulo="Cancelar" tipo="fantasma" onPress={() => setExportar(false)} />
          </View>
        </View>
      </Modal>

      <Modal visible={!!proc} transparent animationType="fade" supportedOrientations={["portrait", "landscape"]}>
        <View style={{ flex: 1, backgroundColor: "#000c", justifyContent: "center", padding: 24 }}>
          {proc && (
            <View style={s.cartao}>
              <Text style={s.h2}>{proc.fim ? (proc.parado ? "Exportação parada" : "Exportação concluída") : "Exportando…"}</Text>
              <Text style={s.suave}>
                {proc.feitas} de {proc.total}
                {proc.erros ? ` · ${proc.erros} com erro` : ""}
              </Text>
              <View style={s.barra}>
                <View style={[s.barraCheia, { width: `${proc.total ? (proc.feitas / proc.total) * 100 : 0}%` }]} />
              </View>
              {proc.fim ? <Botao titulo="Fechar" tipo="primario" onPress={() => setProc(null)} /> : <Botao titulo="Parar" onPress={() => (parar.current = true)} />}
              {proc.fim && !proc.parado && <Text style={s.suave}>Estão no álbum "{NOME_ALBUM}" da galeria.</Text>}
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}
