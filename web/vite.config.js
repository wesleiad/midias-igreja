import { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// O site reaproveita as telas do app do PC (desktop/src/renderer) e o core/.
const core = resolve(__dirname, "../core");
const telas = resolve(__dirname, "../desktop");

export default defineConfig({
  base: "./",
  resolve: { alias: { "@core": core } },
  server: { fs: { allow: [__dirname, core, telas] } },
  worker: { format: "es" },
  define: { __VERSAO__: JSON.stringify(process.env.VERSAO_SITE || "dev") },
  plugins: [react()],
});
