// Acesso à galeria do celular: listar, analisar, apagar e salvar fotos.
import { Platform } from "react-native";
import * as ML from "expo-media-library/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File, Paths } from "expo-file-system";
import { Skia, AlphaType, ColorType } from "@shopify/react-native-skia";
import { analisarImagem, LADO_ANALISE } from "../../core/index.js";

export const NOME_ALBUM = "Fotos Com.Vida";

export async function pedirPermissao() {
  const r = await ML.requestPermissionsAsync(false, ["photo"]);
  return { ok: r.granted, limitado: r.accessPrivileges === "limited", podePerguntar: r.canAskAgain };
}

export async function listarAlbuns() {
  const albuns = await ML.getAlbumsAsync({ includeSmartAlbums: true });
  return albuns.filter((a) => a.assetCount > 0 && a.title !== NOME_ALBUM).sort((a, b) => b.assetCount - a.assetCount);
}

/** Lista as fotos (mais recentes primeiro). limite = null pra todas. */
export async function listarFotos({ albumId, limite }) {
  const fotos = [];
  let depois;
  for (;;) {
    const pagina = await ML.getAssetsAsync({
      first: 300,
      after: depois,
      album: albumId || undefined,
      mediaType: ML.MediaType.photo,
      sortBy: [[ML.SortBy.creationTime, false]],
    });
    fotos.push(...pagina.assets);
    if (!pagina.hasNextPage || (limite && fotos.length >= limite)) break;
    depois = pagina.endCursor;
  }
  return limite ? fotos.slice(0, limite) : fotos;
}

/** Caminho local legível (no iPhone, ph:// vira arquivo de verdade). */
export async function uriLocal(asset) {
  if (Platform.OS !== "ios") return asset.uri;
  const info = await ML.getAssetInfoAsync(asset, { shouldDownloadFromNetwork: true });
  return info.localUri || asset.uri;
}

/** Abre a foto já reduzida (lado maior <= maxLado), com rotação certa, como imagem Skia. */
export async function abrirReduzida(uri, maxLado) {
  const ref = await ImageManipulator.manipulate(uri, { maxWidth: maxLado, maxHeight: maxLado }).renderAsync();
  let w = ref.width;
  let h = ref.height;
  let ctx = null;
  if (Math.max(w, h) > maxLado) {
    const esc = maxLado / Math.max(w, h);
    ctx = ImageManipulator.manipulate(ref).resize({ width: Math.round(w * esc), height: Math.round(h * esc) });
  }
  const final = ctx ? await ctx.renderAsync() : ref;
  const salvo = await final.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 });
  const arquivo = new File(salvo.uri);
  try {
    const dados = await Skia.Data.fromURI(salvo.uri);
    const img = Skia.Image.MakeImageFromEncoded(dados);
    if (!img) throw new Error("Não consegui abrir a foto");
    return img;
  } finally {
    try {
      arquivo.delete();
    } catch {}
  }
}

export async function analisarFoto(asset) {
  const img = await abrirReduzida(await uriLocal(asset), LADO_ANALISE);
  const width = img.width();
  const height = img.height();
  const data = img.readPixels(0, 0, { width, height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
  img.dispose?.();
  if (!data) throw new Error("Não consegui ler os pixels");
  return analisarImagem({ data, width, height }, { largura: asset.width || width, altura: asset.height || height });
}

/** Android 11+ e iPhone mostram a confirmação do próprio sistema. */
export async function apagarFotos(ids) {
  return ML.deleteAssetsAsync(ids);
}

/** Salva bytes JPEG na galeria, dentro do álbum "Fotos Com.Vida". */
export async function salvarNaGaleria(bytes, nome) {
  const arq = new File(Paths.cache, `${nome.replace(/\.[^.]+$/, "")}-comvida-${Date.now()}.jpg`);
  arq.create({ overwrite: true });
  await arq.write(bytes);
  try {
    const asset = await ML.createAssetAsync(arq.uri);
    const album = await ML.getAlbumAsync(NOME_ALBUM);
    if (album) await ML.addAssetsToAlbumAsync([asset], album, false);
    else await ML.createAlbumAsync(NOME_ALBUM, asset, false);
    return asset;
  } finally {
    try {
      arq.delete();
    } catch {}
  }
}

// ---- Cache das análises (refazer a varredura fica instantâneo) ----
const arqCache = () => new File(Paths.document, "analises.json");
let cache = null;
export function lerCache() {
  if (cache) return cache;
  try {
    const f = arqCache();
    cache = f.exists ? JSON.parse(f.textSync()) : {};
  } catch {
    cache = {};
  }
  return cache;
}
export const chaveCache = (a) => `${a.id}:${a.modificationTime || 0}`;
export async function gravarCache() {
  if (!cache) return;
  const f = arqCache();
  if (!f.exists) f.create();
  await f.write(JSON.stringify(cache));
}
