import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Vite build for the production gallery:
//   /              → index nav page
//   /gallery.html  → the match-card gallery (all fixtures)
//   /render-match.html → headless single-card entry (poster/still export)
export default defineConfig({
  root: "lab",
  plugins: [react()],
  publicDir: "../public",
  server: {
    port: 5175,
    host: true, // bind 0.0.0.0 so phones on the same WiFi can load the gallery
    open: "/gallery.html",
  },
  build: {
    outDir: "../out/lab",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "lab/index.html"),
        gallery: resolve(__dirname, "lab/gallery.html"),
        renderMatch: resolve(__dirname, "lab/render-match.html"),
      },
    },
  },
});
