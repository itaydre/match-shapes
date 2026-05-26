// Headless final-frame JPEG exporter for the gallery match cards.
// Loads lab/render-match.html per match, drives the React `frame` and
// GSAP timeline to the final frame (so all reveals have settled), then
// screenshots #render-card at 1080×1920 as a JPEG.
//
// Usage: node scripts/render-still.mjs ar-fr-final br-kr jp-es wc18-final-fr-cr
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import path from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "http://localhost:5175/render-match.html";
const FPS = 30;
const FINAL_FRAME = 269; // matches render-match.mjs TOTAL (270) → last index

const matches = process.argv.slice(2);
if (matches.length === 0) {
  console.error("usage: node scripts/render-still.mjs <matchId...>");
  process.exit(1);
}

const outRoot = path.resolve("out/stills");
mkdirSync(outRoot, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--hide-scrollbars", "--force-device-scale-factor=1"],
  defaultViewport: { width: 1080, height: 1920, deviceScaleFactor: 1 },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const id of matches) {
  process.stdout.write(`▶ ${id} … `);
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await page.goto(`${BASE}?match=${id}`, { waitUntil: "networkidle0" });
  await page.waitForFunction("window.__renderReady === true", { timeout: 30000 });
  await page.waitForFunction("typeof window.__seekGsap === 'function'");
  await page.evaluate(() => document.fonts.ready);
  await sleep(300);

  // Walk a few frames up to the final one so every goal's reveal tween
  // gets created + advanced before we settle on the last frame (the
  // reveals are created lazily as their trigger frame is reached).
  const el = await page.$("#render-card");
  for (let f = 0; f <= FINAL_FRAME; f += 15) {
    const ff = Math.min(f, FINAL_FRAME);
    await page.evaluate((x) => window.__setFrame(x), ff);
    await page.evaluate(
      () =>
        new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    await page.evaluate((t) => window.__seekGsap(t), ff / FPS);
  }
  // Land exactly on the final frame.
  await page.evaluate((x) => window.__setFrame(x), FINAL_FRAME);
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await page.evaluate((t) => window.__seekGsap(t), FINAL_FRAME / FPS);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));

  const out = path.join(outRoot, `${id}.jpg`);
  await el.screenshot({ path: out, type: "jpeg", quality: 95 });
  await page.close();
  console.log(`✓ ${out}`);
}

await browser.close();
console.log("Done.");
