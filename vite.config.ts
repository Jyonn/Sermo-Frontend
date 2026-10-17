import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
const release = JSON.parse(readFileSync(new URL("./release-notes.json", import.meta.url), "utf8"));

export default defineConfig({
  plugins: [react(), { name: "release-marker", transformIndexHtml: () => [{ tag: "meta", attrs: { name: "frienden-release", content: release.id }, injectTo: "head" }] }],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return "framework";
          if (/node_modules\/(i18next|react-i18next|@babel\/runtime)\//.test(id)) return "localization";
          return undefined;
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: [".sermo.jyonn.space", "sermo.jyonn.space", "sermo.6-79.cn"],
    proxy: {
      "/api": {
        target: "https://api.sermo.jyonn.space",
        // target: "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
