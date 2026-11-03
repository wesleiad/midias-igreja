import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

const core = resolve("../core");

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()] },
  preload: { plugins: [externalizeDepsPlugin()] },
  renderer: {
    resolve: { alias: { "@core": core } },
    server: { fs: { allow: [resolve("."), core] } },
    worker: { format: "es" },
    plugins: [react()],
  },
});
