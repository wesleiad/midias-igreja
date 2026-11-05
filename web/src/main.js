// Ordem importa: a ponte do navegador (window.api) precisa existir antes das telas.
import "./api.js";
import "../../desktop/src/renderer/src/main.jsx";
import "./web.css"; // depois do estilo do app, pra valer por cima

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
