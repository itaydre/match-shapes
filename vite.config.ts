import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The playground is its own Vite app rooted in `playground/`. It imports the
// shared goal-shape components from `../src/shapes/goal-shapes.tsx`, so any
// design tweak there feeds straight back into the Remotion composition.
export default defineConfig({
  root: "playground",
  plugins: [react()],
  // Serve the same public/ folder Remotion uses so `staticFile(...)`
  // URLs (font files etc.) resolve in the gallery's @remotion/player
  // previews. Without this the fonts 404 and `delayRender` blocks the
  // player on a blank frame.
  publicDir: "../public",
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: "../out/playground",
    emptyOutDir: true,
  },
});
