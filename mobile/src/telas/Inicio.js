import { useEffect, useState } from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { pedirPermissao, listarAlbuns } from "../galeria.js";
import { Botao, Chip, C, s, NOMES_CATEGORIA } from "../ui.js";

const LIMITES = [
  { v: 200, nome: "Últimas 200" },
  { v: 1000, nome: "Últimas 1.000" },
  { v: null, nome: "Todas" },
];

export default function Inicio({ fotos, scan, apagar, escanear, cancelar, irPara }) {
  const [perm, setPerm] = useState(null);
  const [albuns, setAlbuns] = useState([]);
  const [albumId, setAlbumId] = useState(null);
  const [limite, setLimite] = useState(200);
  const ocupado = scan.estado === "listando" || scan.estado === "analisando";

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
        </View>
      )}

      {ocupado && (
        <View style={s.cartao}>
          <View style={s.linhaEntre}>
            <Text style={s.texto}>
              {scan.estado === "listando" ? "Procurando fotos…" : `Analisando ${scan.feitas} de ${scan.total}`}
            </Text>
            <Botao titulo="Parar" onPress={cancelar} />
          </View>
          <View style={s.barra}>
            <View style={[s.barraCheia, { width: `${Math.round(pct * 100)}%` }]} />
          </View>
          <Text style={s.suave}>Deixe o app aberto enquanto analisa.</Text>
        </View>
      )}

      {(scan.estado === "pronto" || scan.estado === "cancelado") && fotos.length > 0 && (
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
