import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Canvas, Image as SkiaImage, Fill } from "@shopify/react-native-skia";
import { PRESETS } from "../../../core/index.js";
import { salvarLogo, removerLogo, RIGOR } from "../config.js";
import { abrirReduzida, uriLocal } from "../galeria.js";
import { renderizar } from "../render.js";
import { Botao, Chip, Controle, SeletorPosicao, C, s } from "../ui.js";
import { EscolhaModo } from "./Inicio.js";

export default function Ajustes({ cfg, mudarCfg, fotos, logo, recarregarLogo, irPara }) {
  const { width } = useWindowDimensions();
  const marca = cfg.marca;
  const setMarca = (p) => mudarCfg({ marca: { ...marca, ...p } });
  const [fundo, setFundo] = useState(null);
  const [erro, setErro] = useState(null);
  const exemplo = fotos.find((f) => f.categoria === "boa" && f.largura > f.altura);

  useEffect(() => {
    if (!exemplo) return;
    uriLocal(exemplo.asset)
      .then((u) => abrirReduzida(u, 900))
      .then(setFundo)
      .catch(() => {});
  }, [exemplo?.id]);

  const larg = Math.min(width - 64, 560);
  const alt = Math.round((larg * 2) / 3);
  const previa = useMemo(() => {
    if (!fundo || !logo) return null;
    try {
      return renderizar(fundo, { maxLado: 900, ajuste: null, marca: { ...marca, ativa: true }, logo });
    } catch {
      return null;
    }
  }, [fundo, logo, marca]);

  async function escolherLogo() {
    setErro(null);
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    if (r.canceled || !r.assets?.[0]) return;
    try {
      await salvarLogo(r.assets[0].uri);
      await recarregarLogo();
      setMarca({ ativa: true });
    } catch {
      setErro("Não consegui usar essa imagem. Tente um PNG ou JPG.");
    }
  }

  const preset = PRESETS.find((p) => p.id === cfg.filtroPadrao.presetId);

  return (
    <ScrollView contentContainerStyle={s.pad}>
      <View style={s.cartao}>
        <Text style={s.h2}>Marca d'água da igreja</Text>
        {logo && (
          <View style={{ width: larg, height: alt, borderRadius: 12, overflow: "hidden", backgroundColor: C.cartao2 }}>
            <Canvas style={{ flex: 1 }}>
              <Fill color="#2a2f3a" />
              {previa && <SkiaImage image={previa} x={0} y={0} width={larg} height={alt} fit="contain" />}
              {!previa && <SkiaImage image={logo} x={larg * 0.3} y={alt * 0.3} width={larg * 0.4} height={alt * 0.4} fit="contain" />}
            </Canvas>
          </View>
        )}
        <View style={s.linha}>
          <Botao titulo={logo ? "Trocar logo" : "Escolher logo"} tipo="primario" onPress={escolherLogo} />
          {logo && (
            <Botao
              titulo="Remover"
              onPress={async () => {
                removerLogo();
                await recarregarLogo();
                setMarca({ ativa: false });
              }}
            />
          )}
        </View>
        {erro && <Text style={{ color: C.ruim }}>{erro}</Text>}
        <Text style={s.suave}>Dica: PNG com fundo transparente (logo branco fica ótimo em fotos de culto).</Text>
        {logo && (
          <>
            <Chip titulo={marca.ativa ? "✓ Colocar em todas as fotos melhoradas" : "Colocar em todas as fotos melhoradas"} ativo={marca.ativa} onPress={() => setMarca({ ativa: !marca.ativa })} />
            <Text style={s.h3}>Onde</Text>
            <SeletorPosicao valor={marca.posicao} onChange={(posicao) => setMarca({ posicao })} />
            <Controle rotulo="Tamanho" valor={marca.tamanho} min={5} max={40} sufixo="%" onChange={(tamanho) => setMarca({ tamanho })} />
            <Controle rotulo="Opacidade" valor={marca.opacidade} min={20} max={100} sufixo="%" onChange={(opacidade) => setMarca({ opacidade })} />
            <Controle rotulo="Distância da borda" valor={marca.margem} min={0} max={10} sufixo="%" onChange={(margem) => setMarca({ margem })} />
          </>
        )}
      </View>

      <View style={s.cartao}>
        <Text style={s.h2}>Filtro padrão</Text>
        <Text style={s.suave}>
          Usado sempre que você abre Melhorar: <Text style={s.texto}>{preset ? preset.nome : "Personalizado"}</Text>
        </Text>
        <Botao titulo="Ajustar na tela Melhorar" onPress={() => irPara("melhorar")} />
      </View>

      <View style={s.cartao}>
        <Text style={s.h2}>Fotos tremidas, feias ou repetidas</Text>
        <EscolhaModo cfg={cfg} mudarCfg={mudarCfg} />
        <Text style={s.h3}>Rigor com fotos desfocadas</Text>
        <View style={s.linha}>
          {Object.entries(RIGOR).map(([id, r]) => (
            <Chip key={id} titulo={r.nome} ativo={cfg.rigor === id} onPress={() => mudarCfg({ rigor: id })} />
          ))}
        </View>
        <Text style={s.suave}>Mudar o rigor reclassifica na hora, sem escanear de novo.</Text>
        <Controle rotulo="Qualidade do JPG salvo" valor={cfg.qualidadeJpeg} min={70} max={100} sufixo="%" onChange={(qualidadeJpeg) => mudarCfg({ qualidadeJpeg })} />
      </View>
    </ScrollView>
  );
}
