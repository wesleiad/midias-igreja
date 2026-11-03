// Renderiza SVG -> PNG (canvas, tamanho exato): electron main.cjs <entrada.svg> <saida.png> <tamanho>
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const [entrada, saida, tam] = process.argv.slice(-3);
app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false });
  await w.loadURL("data:text/html,<html></html>");
  const svg64 = Buffer.from(fs.readFileSync(entrada, "utf8")).toString("base64");
  const png64 = await w.webContents.executeJavaScript(`new Promise(r=>{const i=new Image();i.onload=()=>{const c=document.createElement('canvas');c.width=c.height=${+tam};c.getContext('2d').drawImage(i,0,0,${+tam},${+tam});r(c.toDataURL('image/png').split(',')[1])};i.src='data:image/svg+xml;base64,${svg64}'})`);
  fs.writeFileSync(saida, Buffer.from(png64, "base64"));
  app.quit();
});
