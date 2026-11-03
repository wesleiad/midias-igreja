import { contextBridge, ipcRenderer } from "electron";

const chamar =
  (canal) =>
  (...args) =>
    ipcRenderer.invoke(canal, ...args);

contextBridge.exposeInMainWorld("api", {
  escolherPasta: chamar("escolherPasta"),
  listarFotos: chamar("listarFotos"),
  lixeira: chamar("lixeira"),
  salvarMelhorada: chamar("salvarMelhorada"),
  abrirPasta: chamar("abrirPasta"),
  lerConfig: chamar("lerConfig"),
  salvarConfig: chamar("salvarConfig"),
  escolherLogo: chamar("escolherLogo"),
  salvarLogo: chamar("salvarLogo"),
  removerLogo: chamar("removerLogo"),
  caminhoLogo: chamar("caminhoLogo"),
});
