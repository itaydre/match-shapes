// Headless, frame-exact renderer for the gallery match cards.
// Loads lab/render-match.html per match, steps frame 0..269 driving
// both the React `frame` and GSAP's global timeline in lockstep,
// screenshots each frame at 1080×1920, then encodes an MP4 with ffmpeg.
//
// Usage: node scripts/render-match.mjs jp-de br-kr ir-wal
import puppeteer from "puppeteer-core";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import path from "node:path";

const CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "http://localhost:5175/render-match.html";
const FPS = 30;
const TOTAL = 270;

const matches = process.argv.slice(2);
if (matches.length === 0) {
  console.error("usage: node scripts/render-match.mjs <matchId...>");
  process.exit(1);
}

const outRoot = path.resolve("out/render");
mkdirSync(outRoot, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--hide-scrollbars", "--force-device-scale-factor=1"],
  defaultViewport: { width: 1080, height: 1920, deviceScaleFactor: 1 },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const id of matches) {
  console.log(`\n▶ rendering ${id} …`);
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await page.goto(`${BASE}?match=${id}`, { waitUntil: "networkidle0" });
  await page.waitForFunction("window.__renderReady === true", { timeout: 30000 });
  await page.waitForFunction("typeof window.__seekGsap === 'function'");
  await page.evaluate(() => document.fonts.ready);
  await sleep(300);

  const frameDir = path.join(outRoot, id);
  rmSync(frameDir, { recursive: true, force: true });
  mkdirSync(frameDir, { recursive: true });

  const el = await page.$("#render-card");
  for (let f = 0; f < TOTAL; f++) {
    await page.evaluate((ff) => window.__setFrame(ff), f);
    // Let React commit the new frame (mounting any newly-triggered goal
    // → its reveal tween is created), then advance the GSAP clock.
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
    await page.evaluate((t) => window.__seekGsap(t), f / FPS);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    await el.screenshot({
      path: path.join(frameDir, `f_${String(f).padStart(4, "0")}.png`),
    });
    if (f % 30 === 0) process.stdout.write(`  frame ${f}/${TOTAL}\r`);
  }
  await page.close();

  const mp4 = path.join(outRoot, `${id}.mp4`);
  await new Promise((res, rej) => {
    const ff = spawn(
      "ffmpeg",
      [
        "-y",
        "-framerate", String(FPS),
        "-i", path.join(frameDir, "f_%04d.png"),
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-crf", "16",
        "-movflags", "+faststart",
        mp4,
      ],
      { stdio: ["ignore", "ignore", "inherit"] },
    );
    ff.on("exit", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exit ${c}`))));
  });
  if (existsSync(mp4)) console.log(`✓ ${mp4}`);
}

await browser.close();
console.log("\nAll done.");
