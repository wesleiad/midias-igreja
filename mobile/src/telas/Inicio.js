import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { pedirPermissao, listarAlbuns } from "../galeria.js";
import { Botao, Chip, C, s, NOMES_CATEGORIA } from "../ui.js";

const LIMITES = [
  { v: 200, nome: "Últimas 200" },
  { v: 1000, nome: "Últimas 1.000" },
  { v: null, nome: "Todas" },
];

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/** Escolha: revisar antes de apagar ou apagar automaticamente. */
export function EscolhaModo({ cfg, mudarCfg, desabilitado }) {
  const opcoes = [
    { id: "revisar", titulo: "Me mostrar antes", texto: "Separa tudo e você confere o que vai apagar." },
    { id: "automatico", titulo: "Apagar automaticamente", texto: "Ao abrir, varre a galeria e já apaga as tremidas, feias e repetidas." },
  ];
  return (
    <View style={{ gap: 8 }}>
      {opcoes.map((o) => {
        const ativo = cfg.modo === o.id;
        return (
          <Pressable
            key={o.id}
            disabled={desabilitado}
            onPress={() => mudarCfg({ modo: o.id })}
            accessibilityRole="radio"
            accessibilityState={{ checked: ativo }}
            style={{ flexDirection: "row", gap: 12, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: ativo ? C.pri : "#3a3a3a", backgroundColor: ativo ? "#1d2a3a" : "#1b1b1b", opacity: desabilitado ? 0.5 : 1 }}
          >
            <View style={{ width: 18, height: 18, marginTop: 2, borderRadius: 9, borderWidth: 2, borderColor: ativo ? C.pri : "#666", alignItems: "center", justifyContent: "center" }}>
              {ativo && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.pri }} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.claro, fontWeight: "600" }}>{o.titulo}</Text>
              <Text style={[s.suave, { fontSize: 12 }]}>{o.texto}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Inicio({ cfg, mudarCfg, fotos, scan, apagar, escanear, cancelar, irPara, limpeza }) {
  const [perm, setPerm] = useState(null);
  const [albuns, setAlbuns] = useState([]);
  const [albumId, setAlbumId] = useState(cfg.ultimaBusca?.albumId ?? null);
  const [limite, setLimite] = useState(cfg.ultimaBusca ? cfg.ultimaBusca.limite : 200);
  const ocupado = scan.estado === "listando" || scan.estado === "analisando" || scan.estado === "limpando";

  async function permitir() {
    const p = await pedirPermissao();
    setPerm(p);
    if (p.ok) setAlbuns(await listarAlbuns().catch(() => []));
  }
  useEffect(() => {
    permitir();
  }, []);

  const cont = {};
  fotos.forEach((f) => (cont[f.categoria] = (cont[f.categoria] || 0) + 1));
  const pct = scan.total ? scan.feitas / scan.total : 0;

  return (
    <ScrollView contentContainerStyle={s.pad}>
      <View style={s.cartao}>
        <Text style={s.titulo}>Mídias - Igreja</Text>
        <Text style={s.suave}>
          Verifica nitidez, luz e fotos repetidas, sugere o que apagar e depois melhora as que ficaram, com a marca d'água da
          igreja se quiser.
        </Text>
      </View>

      {perm && !perm.ok && (
        <View style={s.aviso}>
          <Text style={s.avisoTxt}>O app precisa de acesso às fotos pra funcionar.</Text>
          <View style={[s.linha, { marginTop: 10 }]}>
            {perm.podePerguntar ? (
              <Botao titulo="Permitir acesso" tipo="primario" onPress={permitir} />
            ) : (
              <Botao titulo="Abrir configurações" tipo="primario" onPress={() => Linking.openSettings()} />
            )}
          </View>
        </View>
      )}
      {perm?.limitado && (
        <View style={s.aviso}>
          <Text style={s.avisoTxt}>
            Você liberou só algumas fotos. Para escanear a galeria toda, permita "Todas as fotos" nas configurações.
          </Text>
          <View style={[s.linha, { marginTop: 10 }]}>
            <Botao titulo="Abrir configurações" onPress={() => Linking.openSettings()} />
          </View>
        </View>
      )}

      {perm?.ok && (
        <View style={s.cartao}>
          <Text style={s.h3}>Onde procurar</Text>
          <View style={s.linha}>
            <Chip titulo="Galeria inteira" ativo={!albumId} onPress={() => setAlbumId(null)} />
            {albuns.slice(0, 12).map((a) => (
              <Chip key={a.id} titulo={`${a.title} (${a.assetCount})`} ativo={albumId === a.id} onPress={() => setAlbumId(a.id)} />
            ))}
          </View>
          <Text style={s.h3}>Quantas</Text>
          <View style={s.linha}>
            {LIMITES.map((l) => (
              <Chip key={l.nome} titulo={l.nome} ativo={limite === l.v} onPress={() => setLimite(l.v)} />
            ))}
          </View>
          <Botao
            titulo={ocupado ? "Escaneando…" : "Escanear fotos"}
            tipo="primario"
            grande
            desabilitado={ocupado}
            onPress={() => escanear({ albumId, limite })}
            style={{ marginTop: 6 }}
          />
          <Text style={s.suave}>Fotos já analisadas antes são puladas, então da segunda vez é bem mais rápido.</Text>
          <Text style={s.h3}>Quando encontrar fotos tremidas, feias ou repetidas</Text>
          <EscolhaModo cfg={cfg} mudarCfg={mudarCfg} desabilitado={ocupado} />
          {cfg.modo === "automatico" && (
            <Text style={[s.suave, { fontSize: 12 }]}>
              As duvidosas nunca são apagadas sozinhas.{" "}
              {Platform.OS === "ios"
                ? "As apagadas ficam em Apagados Recentemente por 30 dias."
                : "O Android sempre pede um \"Permitir\" antes de apagar — isso é do sistema."}
            </Text>
          )}
        </View>
      )}

      {limpeza && (
        <View style={[s.cartao, { borderColor: "#1f4a37", backgroundColor: "#13261d" }]}>
          <Text style={s.h2}>{limpeza.recusou ? "Limpeza não autorizada" : "Limpeza automática concluída"}</Text>
          <Text style={{ color: "#bfe8d3" }}>
            {limpeza.recusou
              ? "O celular não deu permissão pra apagar. As fotos ficaram marcadas na Biblioteca."
              : limpeza.apagadas > 0
                ? `${limpeza.apagadas} de ${limpeza.total} fotos apagadas: ${[limpeza.ruins && plural(limpeza.ruins, "tremida/feia", "tremidas/feias"), limpeza.repetidas && plural(limpeza.repetidas, "repetida", "repetidas")].filter(Boolean).join(" e ")}.`
                : `Nenhuma foto ruim ou repetida entre as ${limpeza.total} analisadas.`}
          </Text>
          <View style={s.linha}>
            <Botao titulo="Melhorar as que ficaram" tipo="primario" onPress={() => irPara("melhorar")} />
            <Botao titulo="Ver na Biblioteca" onPress={() => irPara("revisar")} />
          </View>
        </View>
      )}

      {ocupado && (
        <View style={s.cartao}>
          <View style={s.linhaEntre}>
            <Text style={s.texto}>
              {scan.estado === "listando" ? "Procurando fotos…" : scan.estado === "limpando" ? "Apagando as ruins e repetidas…" : `Analisando ${scan.feitas} de ${scan.total}`}
            </Text>
            <Botao titulo="Parar" onPress={cancelar} />
          </View>
          <View style={s.barra}>
            <View style={[s.barraCheia, { width: `${Math.round(pct * 100)}%` }]} />
          </View>
          <Text style={s.suave}>Deixe o app aberto enquanto analisa.</Text>
        </View>
      )}

      {(scan.estado === "pronto" || scan.estado === "cancelado") && fotos.length > 0 && !limpeza && (
        <View style={s.cartao}>
          <Text style={s.h2}>{scan.estado === "cancelado" ? "Análise interrompida" : "Resultado"}</Text>
          <View style={s.linha}>
            {["boa", "duvida", "ruim", "duplicada"].map((c) => (
              <View key={c} style={{ backgroundColor: C.cartao2, borderLeftWidth: 4, borderLeftColor: C[c], borderRadius: 10, padding: 10, minWidth: "46%", flexGrow: 1 }}>
                <Text style={{ color: C.texto, fontSize: 24, fontWeight: "700" }}>{cont[c] || 0}</Text>
                <Text style={s.suave}>{NOMES_CATEGORIA[c]}</Text>
              </View>
            ))}
          </View>
          <Botao titulo={`Revisar${apagar.size ? ` (${apagar.size} pra apagar)` : ""}`} tipo="primario" onPress={() => irPara("revisar")} />
        </View>
      )}
    </ScrollView>
  );
}
