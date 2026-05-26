// Export specific showcase shapes to standalone static SVG files in a
// chosen team palette. Uses the REAL builders from showcaseShapes so
// the geometry matches the gallery exactly; serialises each cell to an
// SVG string at its final (revealed) state — no animation.
//
// Build + run via esbuild (see package.json "export:shapes").
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { SHAPE_BUILDERS, SHAPE_FAMILIES, type Cell, type ShapeFamily } from "../playground/showcaseShapes";

const SIZE = 520;
const SEED = 20260; // fixed seed → deterministic output

// Wedge path — copied verbatim from showcaseShapes (it's module-private
// there) so wedge/disc cells serialise identically to the renderer.
const wedgePath = (innerR: number, outerR: number, startA: number, endA: number): string => {
  const x1 = Math.cos(startA) * outerR;
  const y1 = Math.sin(startA) * outerR;
  const x2 = Math.cos(endA) * outerR;
  const y2 = Math.sin(endA) * outerR;
  const x3 = Math.cos(endA) * innerR;
  const y3 = Math.sin(endA) * innerR;
  const x4 = Math.cos(startA) * innerR;
  const y4 = Math.sin(startA) * innerR;
  const sweep = endA - startA;
  const large = sweep > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${large} 0 ${x4} ${y4} Z`;
};

const n = (v: number) => Number(v.toFixed(2));

const cellToSvg = (cell: Cell): string => {
  switch (cell.kind) {
    case "rect": {
      const minDim = Math.min(cell.w, cell.h);
      const rx = cell.rx !== undefined ? cell.rx : minDim * 0.18;
      const rot =
        cell.rotation !== undefined
          ? ` transform="rotate(${n(cell.rotation)} ${n(cell.cx)} ${n(cell.cy)})"`
          : "";
      return `<rect x="${n(cell.cx - cell.w / 2)}" y="${n(cell.cy - cell.h / 2)}" width="${n(cell.w)}" height="${n(cell.h)}" rx="${n(rx)}" fill="${cell.color}"${rot}/>`;
    }
    case "circle":
      return `<circle cx="${n(cell.cx)}" cy="${n(cell.cy)}" r="${n(cell.r)}" fill="${cell.color}"/>`;
    case "line":
      return `<line x1="${n(cell.x1)}" y1="${n(cell.y1)}" x2="${n(cell.x2)}" y2="${n(cell.y2)}" stroke="${cell.color}" stroke-width="${n(cell.strokeW)}" stroke-linecap="butt"/>`;
    case "wedge":
      return `<path d="${wedgePath(cell.innerR, cell.outerR, cell.startA, cell.endA)}" fill="${cell.color}"/>`;
    case "path":
      return `<path d="${cell.d}" fill="${cell.color}"/>`;
  }
};

const buildSvg = (family: ShapeFamily, palette: string[]): string => {
  const built = SHAPE_BUILDERS[family](SEED, SIZE, palette);
  // Apply the shape-level wrap transform at frame 0 (camera angle, no
  // spin yet) so the asset matches the shape's resting look.
  const wrap = built.wrapAnimation ? built.wrapAnimation(0) : "";
  const body = built.cells.map(cellToSvg).join("\n    ");
  const pad = SIZE * 0.12;
  const vb = `${n(-SIZE / 2 - pad)} ${n(-SIZE / 2 - pad)} ${n(SIZE + pad * 2)} ${n(SIZE + pad * 2)}`;
  const group = wrap ? `  <g transform="${wrap}">\n    ${body}\n  </g>` : `    ${body}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${SIZE}" height="${SIZE}">\n${group}\n</svg>\n`;
};

const MEXICO = ["#006847", "#FFFFFF", "#CE1126"];

const outDir = path.resolve("out/svg");
mkdirSync(outDir, { recursive: true });

// Export ALL 36 showcase families in the Mexico palette, numbered to
// match the showcase (SHAPE_FAMILIES index + 1).
let ok = 0;
SHAPE_FAMILIES.forEach((family, i) => {
  const num = i + 1;
  try {
    const svg = buildSvg(family, MEXICO);
    const file = path.join(outDir, `${String(num).padStart(2, "0")}-${family}-mexico.svg`);
    writeFileSync(file, svg, "utf8");
    ok++;
    console.log(`✓ ${String(num).padStart(2, "0")} ${family}`);
  } catch (e) {
    console.error(`✗ ${num} ${family}:`, (e as Error).message);
  }
});
console.log(`Done — ${ok}/${SHAPE_FAMILIES.length} SVGs written to ${outDir}`);
