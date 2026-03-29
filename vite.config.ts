import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: [".sermo.jyonn.space", "sermo.jyonn.space"],
    proxy: {
      "/api": {
        target: "https://api.sermo.jyonn.space",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
