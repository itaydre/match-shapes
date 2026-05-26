// Auto-deploy: watch the lab/app source and push a Vercel production
// deploy a short debounce after the last change. Deploys are serialised
// (one at a time) and coalesced (a change during a deploy queues exactly
// one follow-up). The live LAN URL (Vite HMR) is still the instant
// preview; this keeps the public Vercel gallery URL in sync too.
//
// Usage: node scripts/watch-deploy.mjs
import { spawn } from "node:child_process";
import { watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WATCH_DIRS = ["playground", "lab", "src", "public"].map((d) =>
  path.join(ROOT, d),
);
const DEBOUNCE_MS = 8000;

let timer = null;
let deploying = false;
let queued = false;

const deploy = () => {
  if (deploying) {
    queued = true;
    return;
  }
  deploying = true;
  const t = new Date().toLocaleTimeString();
  console.log(`\n[watch-deploy] ${t} → vercel --prod …`);
  const p = spawn("vercel", ["--prod", "--yes"], {
    cwd: ROOT,
    stdio: "inherit",
  });
  p.on("exit", (code) => {
    deploying = false;
    console.log(`[watch-deploy] deploy finished (exit ${code})`);
    if (queued) {
      queued = false;
      schedule();
    }
  });
};

const schedule = () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(deploy, DEBOUNCE_MS);
};

for (const dir of WATCH_DIRS) {
  try {
    watch(dir, { recursive: true }, (_evt, file) => {
      if (!file || file.includes("node_modules") || file.endsWith("~")) return;
      console.log(`[watch-deploy] change: ${file}`);
      schedule();
    });
    console.log(`[watch-deploy] watching ${path.relative(ROOT, dir)}/`);
  } catch (e) {
    console.error(`[watch-deploy] cannot watch ${dir}: ${e.message}`);
  }
}

// Deploy the current state once on startup so the URL is immediately current.
console.log(
  `[watch-deploy] armed — deploys ${DEBOUNCE_MS / 1000}s after the last change. Initial deploy now.`,
);
deploy();
