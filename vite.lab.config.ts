import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Multi-entry Vite build for the lab:
//   /                       → Index nav page (links to all lab entries)
//   /gallery.html           → Game Gallery (5 fixtures side by side)
//   /match-focus.html       → Original focused match (cellGrid shapes)
//   /match-focus-v2.html    → Focused match V2 (ring_compression)
//   /match-focus-v3.html    → Focused match V3 (showcase rotation)
//   /shape-showcase.html    → 13 generative shape families on black
//   /shape-studio.html      → Single-shape authoring tool
//   /animations-grid.html   → Motion preset catalog
//   /england-croatia.html   → Demo card
//
// The original Match Card Lab controls (lab/main.tsx + App.tsx) is no
// longer served — its HTML entry has been replaced with a plain nav
// page. The source files remain in place for reference but are
// orphaned from the dev server and the build.
export default defineConfig({
  root: "lab",
  plugins: [react()],
  publicDir: "../public",
  server: {
    port: 5175,
    host: true, // bind 0.0.0.0 so phones on the same WiFi can load the lab
    open: "/shape-showcase.html",
  },
  build: {
    outDir: "../out/lab",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "lab/index.html"),
        gallery: resolve(__dirname, "lab/gallery.html"),
        galleryV2: resolve(__dirname, "lab/gallery-v2.html"),
        sizeTuner: resolve(__dirname, "lab/size-tuner.html"),
        variations: resolve(__dirname, "lab/variations.html"),
        englandCroatia: resolve(__dirname, "lab/england-croatia.html"),
        shapeStudio: resolve(__dirname, "lab/shape-studio.html"),
        matchFocus: resolve(__dirname, "lab/match-focus.html"),
        shapeShowcase: resolve(__dirname, "lab/shape-showcase.html"),
        animStyles: resolve(__dirname, "lab/anim-styles.html"),
        allShapesAnim: resolve(__dirname, "lab/all-shapes-anim.html"),
        animTuner: resolve(__dirname, "lab/anim-tuner.html"),
        blankCard: resolve(__dirname, "lab/blank-card.html"),
        refShapes: resolve(__dirname, "lab/ref-shapes.html"),
        shapePlayground: resolve(__dirname, "lab/shape-playground.html"),
        sunburstWedges: resolve(__dirname, "lab/sunburst-wedges.html"),
        shapeMash: resolve(__dirname, "lab/shape-mash.html"),
        matchShowcase: resolve(__dirname, "lab/match-showcase.html"),
        animationsGrid: resolve(__dirname, "lab/animations-grid.html"),
        cardLayout: resolve(__dirname, "lab/card-layout.html"),
      },
    },
  },
});
