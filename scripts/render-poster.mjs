// Web→print poster pipeline test.
// Renders the FINAL FRAME of a match card as a print-ready 50×70cm
// poster and walks every step that bites you going from screen to press:
//
//   1. VECTOR, not raster. The card is an SVG, so we render it through
//      Chromium's PDF engine at the real physical page size. No
//      upscaling a 1080px screenshot to 59cm (which would be a blurry
//      mess) — vectors stay crisp at any DPI.
//   2. FONTS embedded. The poster page reloads the same web fonts and
//      Chromium subsets+embeds them into the PDF. (Sharp Grotesk VF is
//      a licensed font not on Google Fonts → it falls back to Inter for
//      the score numerals; swap in the licensed file to match the app.)
//   3. ASPECT. Card is 9:16 (0.5625); a 50×70 poster is 5:7 (0.714).
//      We letterbox the card to the page HEIGHT on a #F4F4F4 ground —
//      the same colour as the card's own outer chrome, so the side
//      margins read as intentional matte, not a printing error.
//   4. BLEED. 3mm bleed on every side (page = 506×706mm) with the
//      ground colour flooding the bleed, so trimming never exposes white.
//   5. CMYK. Chromium only emits sRGB. We convert the RGB PDF to a
//      DeviceCMYK /prepress PDF with Ghostscript, and also emit a
//      300-DPI CMYK TIFF for printers that want raster. Bright sRGB
//      blues/reds will gamut-shift on conversion — the CMYK proof is
//      what the press actually sees, so check it, not the RGB.
//
// Usage: node scripts/render-poster.mjs [matchId]   (random game if omitted)
import puppeteer from "puppeteer-core";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, statSync, readFileSync } from "node:fs";
import path from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "http://localhost:5175/render-match.html";
const FPS = 30;
const FINAL_FRAME = 269;

// Print spec ───────────────────────────────────────────────────────
const TRIM_W_MM = 500; // 50 cm
const TRIM_H_MM = 700; // 70 cm
const BLEED_MM = 3;
const PAGE_W_MM = TRIM_W_MM + BLEED_MM * 2; // 506
const PAGE_H_MM = TRIM_H_MM + BLEED_MM * 2; // 706
const DPI = 300;
const GROUND = "#F4F4F4"; // matches the card's outer chrome

// A few known gallery games to pick from when no id is passed.
const SAMPLE_IDS = [
  "br-ge-2014-sf", "pt-es-2018-gs", "nl-ar-2022-qf", "nl-ar-2014-sf",
  "ar-fr-final", "wc18-final-fr-cr", "br-kr", "jp-es",
];
const id =
  process.argv[2] ?? SAMPLE_IDS[Math.floor(Math.random() * SAMPLE_IDS.length)];

const outRoot = path.resolve("out/posters");
mkdirSync(outRoot, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Inline the REAL Sharp Grotesk VF (the score-numeral typeface) as a
// base64 @font-face so the print PDF embeds it instead of falling back
// to Inter. It's the full variable font, so the wdth/wght axes the
// numerals set via font-variation-settings resolve correctly.
const fontTtf = path.resolve("public/fonts/sharpgrotesk.ttf");
const fontDataUrl = existsSync(fontTtf)
  ? `data:font/ttf;base64,${readFileSync(fontTtf).toString("base64")}`
  : null;
const fontFace = fontDataUrl
  ? ["Sharp Grotesk VF", "Sharp Grotesk"]
      .map(
        (fam) =>
          `@font-face{font-family:"${fam}";src:url(${fontDataUrl}) format("truetype");` +
          `font-weight:1 1000;font-stretch:1% 200%;font-style:normal;font-display:block;}`,
      )
      .join("\n")
  : "";
const run = (cmd, args) =>
  new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "ignore", "inherit"] });
    p.on("exit", (c) => (c === 0 ? res() : rej(new Error(`${cmd} exit ${c}`))));
  });

console.log(`\n▶ poster for "${id}" — ${TRIM_W_MM / 10}×${TRIM_H_MM / 10}cm ` +
  `(+${BLEED_MM}mm bleed) @ ${DPI}dpi\n`);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--hide-scrollbars", "--force-device-scale-factor=1"],
  defaultViewport: { width: 1080, height: 1920, deviceScaleFactor: 1 },
});

// 1) Drive the card to its final frame and lift the SVG out. ─────────
const page = await browser.newPage();
await page.goto(`${BASE}?match=${id}`, { waitUntil: "networkidle0" });
await page.waitForFunction("window.__renderReady === true", { timeout: 30000 });
await page.waitForFunction("typeof window.__seekGsap === 'function'");
await page.evaluate(() => document.fonts.ready);
for (let f = 0; f <= FINAL_FRAME; f += 15) {
  const ff = Math.min(f, FINAL_FRAME);
  await page.evaluate((x) => window.__setFrame(x), ff);
  await page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.evaluate((t) => window.__seekGsap(t), ff / FPS);
}
await page.evaluate((x) => window.__setFrame(x), FINAL_FRAME);
await page.evaluate(() => new Promise((r) =>
  requestAnimationFrame(() => requestAnimationFrame(r))));
await page.evaluate((t) => window.__seekGsap(t), FINAL_FRAME / FPS);
await sleep(150);

const { svg, vbW, vbH } = await page.evaluate(() => {
  const el = document.querySelector("[data-match-card-svg]");
  const vb = (el.getAttribute("viewBox") || "0 0 1080 1920").split(/\s+/).map(Number);
  return { svg: el.outerHTML, vbW: vb[2], vbH: vb[3] };
});
await page.close();

// 2) Build the print page: card letterboxed to height on the ground. ─
const cardAspect = vbW / vbH;                 // 0.5625
const cardHmm = TRIM_H_MM;                     // fit to trim height
const cardWmm = cardHmm * cardAspect;          // ≈ 393.75mm
const posterHTML = `<!doctype html><html><head><meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@500;700;900&family=Roboto+Flex:opsz,wght@8..144,100..900&display=swap" rel="stylesheet"/>
<style>
  ${fontFace}
  @page { size: ${PAGE_W_MM}mm ${PAGE_H_MM}mm; margin: 0; }
  html,body{margin:0;padding:0;}
  .page{width:${PAGE_W_MM}mm;height:${PAGE_H_MM}mm;background:${GROUND};
    display:flex;align-items:center;justify-content:center;}
  .card{width:${cardWmm}mm;height:${cardHmm}mm;}
  .card svg{width:100%;height:100%;display:block;}
</style></head>
<body><div class="page"><div class="card">${svg}</div></div></body></html>`;

const printPage = await browser.newPage();
await printPage.setContent(posterHTML, { waitUntil: "networkidle0" });
await printPage.evaluate(() => document.fonts.ready);
await sleep(200);

const rgbPdf = path.join(outRoot, `${id}-poster-rgb.pdf`);
await printPage.pdf({
  path: rgbPdf,
  width: `${PAGE_W_MM}mm`,
  height: `${PAGE_H_MM}mm`,
  printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  preferCSSPageSize: true,
});
await printPage.close();
await browser.close();
console.log(`  ✓ RGB vector PDF   ${rgbPdf}`);

// 3) RGB → CMYK /prepress PDF (Ghostscript). ─────────────────────────
const cmykPdf = path.join(outRoot, `${id}-poster-cmyk.pdf`);
await run("gs", [
  "-dSAFER", "-dBATCH", "-dNOPAUSE", "-q",
  "-sDEVICE=pdfwrite",
  "-dProcessColorModel=/DeviceCMYK",
  "-sColorConversionStrategy=CMYK",
  "-dPDFSETTINGS=/prepress",
  "-dCompatibilityLevel=1.4",
  `-sOutputFile=${cmykPdf}`,
  rgbPdf,
]);
console.log(`  ✓ CMYK print PDF   ${cmykPdf}`);

// 4) CMYK 300-DPI TIFF for raster RIPs. ──────────────────────────────
const cmykTiff = path.join(outRoot, `${id}-poster-cmyk-${DPI}.tif`);
await run("gs", [
  "-dSAFER", "-dBATCH", "-dNOPAUSE", "-q",
  "-sDEVICE=tiff32nc", // 4-channel CMYK TIFF
  `-r${DPI}`,
  "-dProcessColorModel=/DeviceCMYK",
  "-sColorConversionStrategy=CMYK",
  `-sOutputFile=${cmykTiff}`,
  cmykPdf,
]);
console.log(`  ✓ CMYK 300dpi TIFF ${cmykTiff}`);

// Report ─────────────────────────────────────────────────────────────
const pxW = Math.round((PAGE_W_MM / 25.4) * DPI);
const pxH = Math.round((PAGE_H_MM / 25.4) * DPI);
const mb = (p) => existsSync(p) ? (statSync(p).size / 1048576).toFixed(1) + "MB" : "—";
console.log(`\n  page    ${PAGE_W_MM}×${PAGE_H_MM}mm (trim ${TRIM_W_MM}×${TRIM_H_MM}, ${BLEED_MM}mm bleed)`);
console.log(`  raster  ${pxW}×${pxH}px @ ${DPI}dpi`);
console.log(`  sizes   rgb ${mb(rgbPdf)} · cmyk ${mb(cmykPdf)} · tiff ${mb(cmykTiff)}`);
console.log(
  fontDataUrl
    ? `  ✓ Sharp Grotesk VF embedded (no Inter fallback).`
    : `  ⚠ public/fonts/sharpgrotesk.ttf missing → numerals fall back to Inter.`,
);
console.log(`  ⚠ verify the CMYK proof: bright sRGB blue/red shift on conversion.\n`);
