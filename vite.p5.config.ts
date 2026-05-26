import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { callAnthropic, readJsonBody } from "./api/_lib/proxy";

// Local dev only — Vite middleware that delegates to the same proxy
// handler used by api/generate.ts on Vercel. In production this file is
// not used at all; Vercel runs api/generate.ts as a serverless function.
const aiProxy = (): Plugin => ({
  name: "p5-lab-ai-proxy",
  configureServer(server) {
    server.middlewares.use("/api/generate", async (req, res, next) => {
      if (req.method !== "POST") return next();
      const body = (await readJsonBody(req)) as { messages?: unknown } | null;
      const messages = Array.isArray(body?.messages) ? body.messages : [];
      const result = await callAnthropic(
        messages as never,
        process.env.ANTHROPIC_API_KEY,
      );
      res.statusCode = result.status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result.body));
    });
  },
});

export default defineConfig({
  root: "p5-lab",
  plugins: [react(), aiProxy()],
  server: {
    port: 5174,
    open: true,
  },
  build: {
    outDir: "../out/p5-lab",
    emptyOutDir: true,
  },
});
