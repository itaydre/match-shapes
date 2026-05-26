// Color-coverage checkup: builds EVERY shape family with a sample 3-colour
// team palette and verifies the shape's cells actually use all of the
// team's (weighted) flag colours. Regresses often when builders are
// edited, so run it after shape/palette changes:
//
//   npm run check:colors
//
import {
  SHAPE_BUILDERS,
  SHAPE_FAMILIES,
} from "../playground/showcaseShapes";

// Sample team — Brazil (3 distinct, non-white colours so coverage is
// unambiguous): green / yellow / blue.
const FLAG = ["#009C3B", "#FEDD00", "#002776"];
const WEIGHTS = [0.6, 0.3, 0.1];

const isNearWhite = (hex: string) => {
  const h = hex.replace("#", "");
  return (
    parseInt(h.slice(0, 2), 16) > 210 &&
    parseInt(h.slice(2, 4), 16) > 210 &&
    parseInt(h.slice(4, 6), 16) > 210
  );
};

// Mirror weightedFlagPalette + paletteForGoal from StaticPreviewV3.
const weightedPalette = (slots = 24): string[] => {
  const colors = FLAG.map((c) => (isNearWhite(c) ? "#EFEFEF" : c));
  const total = WEIGHTS.reduce((a, b) => a + b, 0) || 1;
  const inc = colors.map((_, i) => WEIGHTS[i]! / total);
  const acc = [0, 0, 0];
  const out: string[] = [];
  for (let s = 0; s < slots; s++) {
    for (let i = 0; i < 3; i++) acc[i] += inc[i]!;
    let p = 0;
    for (let i = 1; i < 3; i++) if (acc[i]! > acc[p]!) p = i;
    acc[p]! -= 1;
    out.push(colors[p]!);
  }
  return out;
};

const palette = [FLAG[0]!, ...weightedPalette()]; // [ink, ...weighted]
const expected = FLAG.map((c) => c.toUpperCase());

const norm = (c: string) => c.toUpperCase();
const fails: string[] = [];
let checked = 0;

for (const fam of SHAPE_FAMILIES) {
  checked++;
  try {
    const built = SHAPE_BUILDERS[fam](1234, 520, palette);
    const used = new Set(built.cells.map((c) => norm(c.color)));
    const missing = expected.filter((e) => !used.has(e));
    if (missing.length) {
      fails.push(
        `${fam} — uses ${used.size} colour(s), MISSING ${missing.join(", ")}`,
      );
    }
  } catch (e) {
    fails.push(`${fam} — THREW: ${(e as Error).message}`);
  }
}

console.log(
  `\n[check:colors] ${checked} families · team palette ${FLAG.join(" ")}`,
);
if (fails.length === 0) {
  console.log("✓ every shape family uses all team colours\n");
  process.exit(0);
} else {
  console.log(`✗ ${fails.length} family(ies) NOT using all team colours:`);
  for (const f of fails) console.log("   " + f);
  console.log("");
  process.exit(1);
}
