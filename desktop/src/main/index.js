import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } from "electron";
import { join, extname, basename, dirname } from "path";
import { pathToFileURL } from "url";
import fs from "fs/promises";

// Dev e instalado nunca dividem a mesma pasta de dados (evita apagar a config real ao testar).
if (!app.isPackaged) app.setPath("userData", join(app.getPath("appData"), "Fotos ComVida (dev)"));

const EXTENSOES = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp"]);
const IGNORADAS = new Set([".heic", ".heif", ".raw", ".cr2", ".nef", ".dng"]);
const arquivoConfig = () => join(app.getPath("userData"), "config.json");
const arquivoLogo = () => join(app.getPath("userData"), "logo.png");

// foto://local/<caminho codificado> → arquivo do disco (usado por <img>, fetch e workers).
protocol.registerSchemesAsPrivileged([
  { scheme: "foto", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true } },
]);

async function listar(pasta, subpastas, saida, pular) {
  let itens;
  try {
    itens = await fs.readdir(pasta, { withFileTypes: true });
  } catch {
    return;
  }
  for (const it of itens) {
    const caminho = join(pasta, it.name);
    if (it.isDirectory()) {
      if (subpastas && it.name !== "Fotos Melhoradas" && !it.name.startsWith(".")) await listar(caminho, true, saida, pular);
      continue;
    }
    const ext = extname(it.name).toLowerCase();
    if (EXTENSOES.has(ext)) {
      const st = await fs.stat(caminho);
      saida.push({ caminho, nome: it.name, bytes: st.size, data: st.mtimeMs });
    } else if (IGNORADAS.has(ext)) pular.push(it.name);
  }
}

function registrarIpc() {
  ipcMain.handle("escolherPasta", async () => {
    // Só em desenvolvimento: teste automático sem abrir a janela de pasta.
    if (!app.isPackaged && process.env.FOTOS_TESTE_PASTA) return process.env.FOTOS_TESTE_PASTA;
    const r = await dialog.showOpenDialog({ properties: ["openDirectory"], title: "Escolha a pasta das fotos" });
    return r.canceled ? null : r.filePaths[0];
  });

  ipcMain.handle("listarFotos", async (_e, pasta, subpastas) => {
    const fotos = [];
    const ignoradas = [];
    await listar(pasta, subpastas, fotos, ignoradas);
    fotos.sort((a, b) => a.data - b.data);
    return { fotos, ignoradas };
  });

  ipcMain.handle("lixeira", async (_e, caminhos) => {
    const falhas = [];
    for (const c of caminhos) {
      try {
        await shell.trashItem(c);
      } catch (err) {
        falhas.push({ caminho: c, erro: String(err.message || err) });
      }
    }
    return { movidas: caminhos.length - falhas.length, falhas };
  });

  // Salva a foto melhorada em <pasta da foto>/Fotos Melhoradas, mantendo a data original do arquivo.
  ipcMain.handle("salvarMelhorada", async (_e, original, bytes, pastaSaida) => {
    const dir = pastaSaida || join(dirname(original), "Fotos Melhoradas");
    await fs.mkdir(dir, { recursive: true });
    const destino = join(dir, basename(original, extname(original)) + ".jpg");
    await fs.writeFile(destino, Buffer.from(bytes));
    try {
      const st = await fs.stat(original);
      await fs.utimes(destino, st.atime, st.mtime);
    } catch {}
    return destino;
  });

  ipcMain.handle("abrirPasta", (_e, caminho) => shell.openPath(caminho));

  ipcMain.handle("lerConfig", async () => {
    try {
      return JSON.parse(await fs.readFile(arquivoConfig(), "utf8"));
    } catch {
      return null;
    }
  });
  ipcMain.handle("salvarConfig", async (_e, cfg) => {
    await fs.mkdir(app.getPath("userData"), { recursive: true });
    const tmp = arquivoConfig() + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(cfg, null, 2));
    await fs.rename(tmp, arquivoConfig());
    return true;
  });

  // O logo é recebido já convertido em PNG pelo renderer e guardado na pasta do app.
  ipcMain.handle("escolherLogo", async () => {
    if (!app.isPackaged && process.env.FOTOS_TESTE_LOGO) return process.env.FOTOS_TESTE_LOGO;
    const r = await dialog.showOpenDialog({
      title: "Escolha o logo da igreja (PNG com fundo transparente fica melhor)",
      properties: ["openFile"],
      filters: [{ name: "Imagens", extensions: ["png", "jpg", "jpeg", "webp", "svg"] }],
    });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle("salvarLogo", async (_e, bytes) => {
    await fs.mkdir(app.getPath("userData"), { recursive: true });
    await fs.writeFile(arquivoLogo(), Buffer.from(bytes));
    return arquivoLogo();
  });
  ipcMain.handle("removerLogo", async () => {
    await fs.rm(arquivoLogo(), { force: true });
    return true;
  });
  ipcMain.handle("caminhoLogo", async () => {
    try {
      await fs.access(arquivoLogo());
      return arquivoLogo();
    } catch {
      return null;
    }
  });
}

function criarJanela() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 380,
    minHeight: 560,
    backgroundColor: "#0f1115",
    title: "Fotos Com.Vida",
    icon: join(__dirname, "../../build/icon.png"),
    autoHideMenuBar: true,
    webPreferences: { preload: join(__dirname, "../preload/index.mjs"), sandbox: false },
  });
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else win.loadFile(join(__dirname, "../renderer/index.html"));
}

app.whenReady().then(() => {
  protocol.handle("foto", (req) => {
    const caminho = decodeURIComponent(new URL(req.url).pathname.slice(1));
    return net.fetch(pathToFileURL(caminho).toString());
  });
  registrarIpc();
  criarJanela();
});
app.on("window-all-closed", () => app.quit());
