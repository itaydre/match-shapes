// ─────────────────────────────────────────────────────────────────────
// refShapes — experimental STATIC shapes invented from the reference
// folder (new_15.5), kept separate from the production showcaseShapes.
//
// House aesthetic (matches the approved color_dial / wedges / radial_
// checker / vortex_disc): CHAOTIC + NON-SYMMETRIC. Every shape biases
// its mass toward ONE focal lobe (a random focus angle / point), thins
// out chaotically away from it, has a RAGGED outer extent (no clean
// bounding circle — elements spill past the disc), holes throughout,
// and flag-only palettes. Static (no animation yet).
// ─────────────────────────────────────────────────────────────────────
import { type Cell, type ShapeBuilder } from "./showcaseShapes";

const TAU = Math.PI * 2;

const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const lum = (hex: string) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const darkest = (p: string[]) =>
  p.reduce((a, b) => (lum(b) < lum(a) ? b : a), p[0]!);
const lightest = (p: string[]) =>
  p.reduce((a, b) => (lum(b) > lum(a) ? b : a), p[0]!);

// HSL → hex, for shapes that want a spectral rainbow ramp rather than
// the team palette (e.g. the signal-beam fan).
const hsl = (h: number, s: number, l: number) => {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g] = [c, x];
  else if (h < 120) [r, g] = [x, c];
  else if (h < 180) [g, b] = [c, x];
  else if (h < 240) [g, b] = [x, c];
  else if (h < 300) [r, b] = [x, c];
  else [r, b] = [c, x];
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
};

// Angular focus lobe — returns 1 at the focus angle, falling to ~0 on
// the far side. Drives where mass concentrates.
const makeAngleFocus = (rand: () => number) => {
  const angle = rand() * TAU;
  const w = 0.8 + rand() * 0.9; // lobe width (radians)
  return (a: number) => {
    let d = a - angle;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    return Math.exp(-(d * d) / (2 * w * w));
  };
};

const wrapPi = (d: number) => {
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
};

// ─────────────────────────────────────────────────────────────────────
// 1 — SPOKE CHIPS (ref 1a829): wheel of thin spokes + colour chips, all
// crowding the focal lobe; ragged spoke lengths spill past the disc.
// ─────────────────────────────────────────────────────────────────────
export const buildSpokeChips: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const focus = makeAngleFocus(rand);
  const innerR = half * 0.18;
  const outerR = half * 1.04;
  const SPOKES = 72;
  const spoke = darkest(palette);
  for (let i = 0; i < SPOKES; i++) {
    const a = (i / SPOKES) * TAU + (rand() - 0.5) * 0.05;
    const f = focus(a);
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const reach = outerR * (0.22 + 0.78 * f) * (0.55 + rand() * 0.6);
    if (reach < innerR + 4) continue;
    if (rand() < 0.35 + 0.55 * f) {
      cells.push({
        kind: "line",
        cx: 0,
        cy: 0,
        x1: cos * innerR,
        y1: sin * innerR,
        x2: cos * reach * 0.92,
        y2: sin * reach * 0.92,
        strokeW: Math.max(0.7, size * 0.0022),
        color: spoke,
      });
    }
    const RINGS = 10;
    for (let k = 0; k < RINGS; k++) {
      const t = k / (RINGS - 1);
      const r = innerR + (reach - innerR) * t;
      if (rand() > 0.12 + 0.62 * f) continue;
      cells.push({
        kind: "rect",
        cx: cos * r,
        cy: sin * r,
        w: ((reach - innerR) / RINGS) * (0.6 + rand() * 0.5),
        h: size * (0.014 + rand() * 0.012),
        rx: 0,
        rotation: (a * 180) / Math.PI,
        color: palette[(i + k) % palette.length] ?? lightest(palette),
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 2 — PRIMARY SUNBURST (ref db1ab5): multicolour inner core + bold
// wedges that cluster long & wide in the focal lobe, sparse & stubby
// away from it. Ragged rim, missing wedges.
// ─────────────────────────────────────────────────────────────────────
export const buildPrimarySunburst: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const focus = makeAngleFocus(rand);
  const coreR = half * 0.3;
  const outerR = half * 1.06;
  const CORE_RINGS = 5;
  const CORE_SEG = 40;
  for (let k = 0; k < CORE_RINGS; k++) {
    const r = coreR * (0.3 + 0.7 * (k / CORE_RINGS));
    const band = coreR * 0.12;
    for (let i = 0; i < CORE_SEG; i++) {
      const seg = TAU / CORE_SEG;
      const a0 = (i / CORE_SEG) * TAU;
      if (rand() > 0.4 + 0.5 * focus(a0)) continue;
      cells.push({
        kind: "wedge",
        cx: Math.cos(a0 + seg / 2) * r,
        cy: Math.sin(a0 + seg / 2) * r,
        innerR: Math.max(0, r - band),
        outerR: r,
        startA: a0,
        endA: a0 + seg * 0.82,
        color: palette[(i + k) % palette.length] ?? darkest(palette),
      });
    }
  }
  let ang = rand() * TAU;
  for (let i = 0; i < 22; i++) {
    const w = (TAU / 22) * (0.3 + rand() * 1.5);
    const a0 = ang;
    const a1 = ang + w;
    ang = a1 + (TAU / 22) * 0.18 * rand();
    const f = focus((a0 + a1) / 2);
    if (rand() > 0.28 + 0.6 * f) continue;
    const reach = outerR * (0.3 + 0.7 * f) * (0.6 + rand() * 0.5);
    const rMid = (coreR + reach) / 2;
    const aMid = (a0 + a1) / 2;
    cells.push({
      kind: "wedge",
      cx: Math.cos(aMid) * rMid,
      cy: Math.sin(aMid) * rMid,
      innerR: coreR,
      outerR: reach,
      startA: a0,
      endA: a1,
      color: palette[i % palette.length] ?? lightest(palette),
    });
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 3 — TUNNEL DASHES (ref 7678e22 / 032933): concentric dash rings whose
// dots crowd the focal arc and scatter to nothing away from it — broken,
// non-circular, comet-like.
// ─────────────────────────────────────────────────────────────────────
export const buildTunnelDashes: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const focus = makeAngleFocus(rand);
  const innerR = half * 0.08;
  const outerR = half * 1.02;
  const RINGS = 18;
  for (let k = 1; k <= RINGS; k++) {
    const r = innerR + (outerR - innerR) * (k / RINGS);
    const dashLen = size * 0.028;
    const gap = size * 0.02;
    const count = Math.max(6, Math.floor((TAU * r) / (dashLen + gap)));
    const rot = (k % 2 ? 1 : -1) * (TAU / count) * 0.4 + rand() * 0.15;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + rot;
      const f = focus(a);
      if (rand() > 0.06 + 0.66 * f) continue;
      cells.push({
        kind: "rect",
        cx: Math.cos(a) * r,
        cy: Math.sin(a) * r,
        w: dashLen * (0.7 + f * 0.8),
        h: Math.max(2, size * 0.011),
        rx: size * 0.006,
        rotation: (a * 180) / Math.PI + 90,
        color: palette[(k + i) % palette.length] ?? darkest(palette),
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 4 — STEP SPIRAL (ref 736c1b): two spiral arms of stepped chunks; the
// chunks survive mostly where the arm sweeps the focal lobe, and the
// radius wobbles so the spiral never closes into a clean ring.
// ─────────────────────────────────────────────────────────────────────
export const buildStepSpiral: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const focus = makeAngleFocus(rand);
  const outerR = half * 1.02;
  const TURNS = 2.6;
  const STEPS = 150;
  const ARMS = 2;
  const colA = palette[0] ?? darkest(palette);
  const colB = palette[palette.length - 1] ?? lightest(palette);
  for (let arm = 0; arm < ARMS; arm++) {
    const base = (arm / ARMS) * TAU;
    for (let s = 1; s <= STEPS; s++) {
      const t = s / STEPS;
      const a = base + TURNS * t * TAU;
      const f = focus(a);
      if (rand() > 0.35 + 0.6 * f) continue;
      const r = outerR * Math.pow(t, 0.92) * (0.86 + rand() * 0.24);
      cells.push({
        kind: "rect",
        cx: Math.cos(a) * r,
        cy: Math.sin(a) * r,
        w: size * (0.01 + t * 0.05),
        h: size * 0.03,
        rx: 0,
        rotation: (a * 180) / Math.PI,
        color: s % 2 === 0 ? colA : colB,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 5 — RAKE GRID (ref 0198): diagonal lozenges scattered around a focal
// POINT (off-centre), fat & dense there, sparse hairlines away. Jittered
// positions → no clean grid rectangle.
// ─────────────────────────────────────────────────────────────────────
export const buildRakeGrid: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const fx = (rand() - 0.5) * size * 0.5;
  const fy = (rand() - 0.5) * size * 0.5;
  const N = 15;
  const pitch = size / N;
  for (let gx = 0; gx < N; gx++) {
    for (let gy = 0; gy < N; gy++) {
      const cx = -half + (gx + 0.5) * pitch + (rand() - 0.5) * pitch * 0.7;
      const cy = -half + (gy + 0.5) * pitch + (rand() - 0.5) * pitch * 0.7;
      const d = Math.hypot(cx - fx, cy - fy) / (size * 0.5);
      const f = Math.exp(-d * d * 1.6);
      if (rand() > 0.12 + 0.82 * f) continue;
      const len = pitch * (0.45 + f * 0.7);
      const thick = pitch * (0.06 + f * 0.55);
      cells.push({
        kind: "rect",
        cx,
        cy,
        w: len,
        h: thick,
        rx: thick / 2,
        rotation: -45 + (rand() - 0.5) * 26,
        color: palette[(gx + gy) % palette.length] ?? darkest(palette),
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 6 — SHARD BURST (ref 13e9e4): thin radial shards exploding from the
// centre, broken into chunks, crowding the focal lobe and scattering
// raggedly away. Mostly ink with palette flecks.
// ─────────────────────────────────────────────────────────────────────
export const buildShardBurst: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const focus = makeAngleFocus(rand);
  const ink = darkest(palette);
  const N = 200;
  for (let i = 0; i < N; i++) {
    const a = rand() * TAU;
    const f = focus(a);
    if (rand() > 0.18 + 0.7 * f) continue;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const start = half * (0.02 + rand() * 0.12);
    const reach = half * (0.18 + 1.0 * f) * (0.5 + rand() * 0.8);
    const chunks = 1 + Math.floor(rand() * 4);
    for (let c = 0; c < chunks; c++) {
      const t0 = c / chunks + rand() * 0.06;
      const t1 = (c + 0.6) / chunks;
      const r0 = start + (reach - start) * t0;
      const r1 = start + (reach - start) * t1;
      const rMid = (r0 + r1) / 2;
      cells.push({
        kind: "rect",
        cx: cos * rMid,
        cy: sin * rMid,
        w: r1 - r0,
        h: Math.max(1.2, size * (0.004 + rand() * 0.006)),
        rx: 0,
        rotation: (a * 180) / Math.PI,
        color: rand() < 0.2 ? palette[i % palette.length] ?? ink : ink,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 7 — COMET STREAKS (ref DDP poster 054a30): a fan of pixel beams
// streaking out from a focal point on one side; each beam a chain of
// squares that dissolve (shrink + thin) along its tail.
// ─────────────────────────────────────────────────────────────────────
export const buildCometStreaks: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const focusAngle = rand() * TAU;
  // Focal anchor sits opposite the fan direction so beams sweep across.
  const ax = -Math.cos(focusAngle) * half * 0.5;
  const ay = -Math.sin(focusAngle) * half * 0.5;
  const BEAMS = 4 + Math.floor(rand() * 3);
  const fanHalf = 0.5 + rand() * 0.4;
  for (let b = 0; b < BEAMS; b++) {
    const a = focusAngle + (b / (BEAMS - 1) - 0.5) * 2 * fanHalf + (rand() - 0.5) * 0.1;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const reach = half * (1.0 + rand() * 0.5);
    const color = palette[b % palette.length] ?? darkest(palette);
    const STEPS = 26;
    for (let s = 0; s < STEPS; s++) {
      const t = s / (STEPS - 1);
      // Halftone dissolve: dense/big near the head, sparse/small in tail.
      if (rand() < t * 0.85) continue;
      const r = reach * t;
      const sq = size * (0.05 * (1 - t) + 0.008);
      cells.push({
        kind: "rect",
        cx: ax + cos * r + (rand() - 0.5) * size * 0.02,
        cy: ay + sin * r + (rand() - 0.5) * size * 0.02,
        w: sq,
        h: sq,
        rx: 0,
        color,
      });
    }
  }
  return { cells, focal: { x: ax, y: ay } };
};

// ─────────────────────────────────────────────────────────────────────
// 8 — FINGERPRINT ARCS (ref 032933): nested partial arcs of dots whose
// centre drifts ring-to-ring (fingerprint ridges), all opening toward —
// and densest on — the focal side. Multicolour, jittered dots.
// ─────────────────────────────────────────────────────────────────────
export const buildFingerprintArcs: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const openAngle = rand() * TAU; // direction the C opens toward
  const RINGS = 22;
  for (let k = 1; k <= RINGS; k++) {
    const baseR = (k / RINGS) * half * 1.0;
    // Drift the ring centre so ridges aren't concentric → fingerprint.
    const drift = half * 0.16 * (k / RINGS);
    const cxk = Math.cos(openAngle + Math.PI) * drift;
    const cyk = Math.sin(openAngle + Math.PI) * drift;
    const arcHalf = 1.6 + (k / RINGS) * 0.9; // wider arcs outward
    const dotR = size * (0.006 + (k / RINGS) * 0.012);
    const count = Math.max(8, Math.floor((arcHalf * 2 * baseR) / (dotR * 2.6)));
    for (let i = 0; i < count; i++) {
      const a = openAngle + Math.PI + (i / (count - 1) - 0.5) * 2 * arcHalf;
      if (rand() < 0.22) continue; // holes
      const r = baseR + (rand() - 0.5) * dotR * 1.5;
      cells.push({
        kind: "circle",
        cx: cxk + Math.cos(a) * r,
        cy: cyk + Math.sin(a) * r,
        r: dotR * (0.7 + rand() * 0.7),
        color: palette[(k + i) % palette.length] ?? darkest(palette),
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 9 — CHECKER WARP (ref 2c05960): a polar checker disc with a swirl
// twist, chaotic dropouts, and per-wedge ragged reach so the silhouette
// breaks up; the surviving cells crowd the focal lobe.
// ─────────────────────────────────────────────────────────────────────
export const buildCheckerWarp: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const focus = makeAngleFocus(rand);
  const outerR = half * 1.04;
  const RINGS = 14;
  const WEDGES = 26;
  const colA = darkest(palette);
  const colB = lightest(palette);
  const wedgeReach: number[] = [];
  for (let i = 0; i < WEDGES; i++) wedgeReach.push(0.55 + rand() * 0.5);
  for (let i = 0; i < WEDGES; i++) {
    const f = focus(((i + 0.5) / WEDGES) * TAU);
    const reach = outerR * (wedgeReach[i] ?? 1) * (0.6 + 0.4 * f);
    const twist = 0.9 * (rand() - 0.2);
    for (let k = 0; k < RINGS; k++) {
      const ringT = k / RINGS;
      const r0 = ringT * reach;
      const r1 = ((k + 1) / RINGS) * reach;
      if (rand() > 0.45 + 0.5 * f) continue; // chaotic dropouts
      const a0 = (i / WEDGES) * TAU + twist * Math.pow(ringT, 1.5);
      const a1 = ((i + 1) / WEDGES) * TAU + twist * Math.pow(ringT, 1.5);
      const aMid = (a0 + a1) / 2;
      const rMid = (r0 + r1) / 2;
      const checker = (i + k) % 2;
      cells.push({
        kind: "wedge",
        cx: Math.cos(aMid) * rMid,
        cy: Math.sin(aMid) * rMid,
        innerR: r0,
        outerR: r1,
        startA: a0,
        endA: a1,
        color:
          checker === 0
            ? colA
            : palette[(i + k) % palette.length] ?? colB,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 10 — RAY FIELD (ref 21381): hundreds of fine radial lines at random
// angles, lengths swelling in the focal lobe and shrinking to stubs
// away — a dense, ragged, off-balance corona.
// ─────────────────────────────────────────────────────────────────────
export const buildRayField: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const focus = makeAngleFocus(rand);
  const ink = darkest(palette);
  const N = 420;
  for (let i = 0; i < N; i++) {
    const a = rand() * TAU;
    const f = focus(a);
    if (rand() > 0.15 + 0.8 * f) continue;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const start = half * (0.04 + rand() * 0.14);
    const len = half * (0.12 + 0.9 * f) * (0.4 + rand() * 0.8);
    cells.push({
      kind: "line",
      cx: 0,
      cy: 0,
      x1: cos * start,
      y1: sin * start,
      x2: cos * (start + len),
      y2: sin * (start + len),
      strokeW: Math.max(0.6, size * (0.0014 + rand() * 0.0014)),
      color: rand() < 0.12 ? palette[i % palette.length] ?? ink : ink,
    });
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 11 — SWIRL CHECKER (ref 2c05960): a polar diamond checker projected
// onto a sphere (radial compression) and wound by a swirl, so it reads
// as a warped op-art vortex. Two-tone, chaotic dropouts, ragged rim.
// ─────────────────────────────────────────────────────────────────────
export const buildSwirlChecker: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const R = half * 1.02;
  const RINGS = 30;
  const WEDGES = 48;
  const ink = darkest(palette);
  const swirl = (0.9 + rand() * 0.7) * (rand() < 0.5 ? 1 : -1);
  const wedgeMax: number[] = [];
  for (let i = 0; i < WEDGES; i++) wedgeMax.push(0.78 + rand() * 0.22);
  for (let k = 0; k < RINGS; k++) {
    const ringT = k / RINGS;
    const r0 = R * Math.sin((k / RINGS) * (Math.PI / 2));
    const r1 = R * Math.sin(((k + 1) / RINGS) * (Math.PI / 2));
    const rMid = (r0 + r1) / 2;
    const twist = swirl * Math.pow(1 - ringT, 1.4) * TAU;
    for (let i = 0; i < WEDGES; i++) {
      if ((k + i) % 2 !== 0) continue; // checker → dark diamonds only
      if (ringT > (wedgeMax[i] ?? 1)) continue; // ragged rim
      if (rand() < 0.08) continue; // holes
      const a0 = (i / WEDGES) * TAU + twist;
      const a1 = ((i + 1) / WEDGES) * TAU + twist;
      const aMid = (a0 + a1) / 2;
      cells.push({
        kind: "wedge",
        cx: Math.cos(aMid) * rMid,
        cy: Math.sin(aMid) * rMid,
        innerR: r0,
        outerR: r1,
        startA: a0,
        endA: a1,
        color: ink,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 12 — SIGNAL FAN: long rectangular colour beams radiating from a single
// COMPRESSED focal point on the far left, expanding rightward in
// perspective into a triangular projection cone — a "data broadcast".
// Beams are sliced into checker-modulated rectangular segments with
// progressive spacing, missing blocks and occasional ink interruption
// bars. Spectral (rainbow) palette, flat + crisp; central beams densest.
// (Deliberately uses a spectral ramp, not the team palette, per spec.)
// ─────────────────────────────────────────────────────────────────────
export const buildWaveStripes: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  void palette;
  const half = size / 2;
  const cells: Cell[] = [];
  // Vanishing point: far left, vertically centred.
  const vpx = -half * 0.98;
  const vpy = (rand() - 0.5) * size * 0.06;
  const BEAMS = 26;
  const fanHalf = 0.6; // half-angle of the cone (radians)
  const maxR = size * 1.7;
  const hueBase = rand() * 360;
  for (let b = 0; b < BEAMS; b++) {
    const bt = b / (BEAMS - 1);
    const a = (bt - 0.5) * 2 * fanHalf;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    // Central beams (a≈0) reach further and pack denser.
    const central = 1 - Math.min(1, Math.abs(a) / fanHalf);
    const beamHue = hueBase + bt * 300;
    const checkerOffset = b % 2;
    let d = size * 0.04; // start tight at the compressed focal → burst
    for (let s = 0; s < 40; s++) {
      const dn = d / maxR;
      // Perspective scaling: segments lengthen + thicken with distance.
      const segLen = size * (0.018 + dn * 0.11);
      const gap = size * (0.005 + dn * 0.055); // progressive spacing
      const thick = size * (0.005 + dn * 0.055) * (0.45 + central * 0.85);
      const cx = vpx + cos * (d + segLen / 2);
      const cy = vpy + sin * (d + segLen / 2);
      // Checker-like modulation + missing blocks + density toward centre.
      const checkerOn = (s + checkerOffset) % 2 === 0;
      const keep = 0.9 - (1 - central) * 0.3;
      if (
        checkerOn &&
        rand() < keep &&
        Math.abs(cx) < half * 1.12 &&
        Math.abs(cy) < half * 1.12
      ) {
        const roll = rand();
        const color =
          roll < 0.07
            ? "#0A0A0A" // occasional black interruption bar
            : hsl(beamHue + dn * 36, 0.86, 0.52);
        cells.push({
          kind: "rect",
          cx,
          cy,
          w: segLen,
          h: thick,
          rx: 0,
          rotation: (a * 180) / Math.PI,
          color,
        });
      }
      d += segLen + gap;
      if (d > maxR) break;
    }
  }
  return { cells, focal: { x: vpx, y: vpy } };
};

// ─────────────────────────────────────────────────────────────────────
// 13 — ZIGZAG SHARDS (ref d7cd8a): sharp triangular shards BURSTING from
// a focal point — each shard a thin triangle pointing radially outward,
// clustered tight near the point and flung out raggedly. Densest in a
// focal lobe (asymmetric), jittered jagged tips, mostly ink + accents.
// ─────────────────────────────────────────────────────────────────────
export const buildZigzagShards: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const ink = darkest(palette);
  const focus = makeAngleFocus(rand);
  const fx = (rand() - 0.5) * size * 0.18;
  const fy = (rand() - 0.5) * size * 0.18;
  const maxR = half * 1.08;
  const N = 200;
  for (let i = 0; i < N; i++) {
    const a = rand() * TAU;
    const f = focus(a);
    if (rand() > 0.18 + 0.72 * f) continue; // asymmetric focal lobe
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const nx = -sin;
    const ny = cos;
    // Burst: shards cluster near the focal point (radius skewed small).
    const rr = Math.pow(rand(), 1.7);
    const innerR = maxR * rr;
    const len = maxR * (0.05 + (1 - rr) * 0.22) * (0.5 + rand() * 0.8);
    const baseW = (size * 0.008 + len * 0.14) * (0.5 + rand() * 0.9);
    const bx = fx + cos * innerR;
    const by = fy + sin * innerR;
    // Jagged, jittered tip pointing outward from the focus.
    const tx = fx + cos * (innerR + len) + (rand() - 0.5) * len * 0.25;
    const ty = fy + sin * (innerR + len) + (rand() - 0.5) * len * 0.25;
    const p1x = bx + nx * baseW;
    const p1y = by + ny * baseW;
    const p2x = bx - nx * baseW;
    const p2y = by - ny * baseW;
    const d = `M ${p1x.toFixed(1)} ${p1y.toFixed(1)} L ${p2x.toFixed(1)} ${p2y.toFixed(1)} L ${tx.toFixed(1)} ${ty.toFixed(1)} Z`;
    cells.push({
      kind: "path",
      d,
      cx: bx,
      cy: by,
      color: rand() < 0.82 ? ink : palette[i % palette.length] ?? ink,
    });
  }
  return { cells, focal: { x: fx, y: fy } };
};

// ─────────────────────────────────────────────────────────────────────
// 14 — STEPPED ARCS (ref Screenshot 13.43): concentric arcs sweeping
// from an off-frame focus, drawn as TERRACED dashes (radius quantised in
// steps → staircase edge), alternating two-tone, with holes.
// ─────────────────────────────────────────────────────────────────────
export const buildSteppedArcs: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const colA = darkest(palette);
  const colB = lightest(palette);
  // Focus off a corner so arcs sweep diagonally across the frame.
  const fx = -half * (0.7 + rand() * 0.4);
  const fy = half * (0.6 + rand() * 0.4);
  const RINGS = 26;
  const baseR = size * 0.18;
  const ringStep = size * 0.052;
  const aStart = -Math.PI * 0.55;
  const aEnd = Math.PI * 0.15;
  for (let k = 0; k < RINGS; k++) {
    const r = baseR + k * ringStep;
    const color = k % 2 === 0 ? colA : colB;
    const SEG = 46;
    for (let s = 0; s < SEG; s++) {
      if (rand() < 0.14) continue; // holes
      const a = aStart + (aEnd - aStart) * (s / SEG);
      // staircase: quantise the radius in chunks of 5 segments.
      const rq = r + (Math.floor(s / 5) % 2) * (size * 0.014);
      const x = fx + Math.cos(a) * rq;
      const y = fy + Math.sin(a) * rq;
      if (Math.abs(x) > half * 1.05 || Math.abs(y) > half * 1.05) continue;
      cells.push({
        kind: "rect",
        cx: x,
        cy: y,
        w: size * 0.055,
        h: size * 0.03,
        rx: 0,
        rotation: (a * 180) / Math.PI + 90,
        color,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 15 — QUANTIZED ORBIT: concentric arcs of rectangular chips, each ring
// drifted (spiral) and biased to one focal arc — a comet-orbit of chips.
// ─────────────────────────────────────────────────────────────────────
export const buildQuantizedOrbit: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const focus = makeAngleFocus(rand);
  const innerR = half * 0.14;
  const outerR = half * 1.0;
  const RINGS = 18;
  for (let k = 0; k < RINGS; k++) {
    const r = innerR + (outerR - innerR) * (k / RINGS);
    const drift = k * 0.12 + rand() * 0.1;
    const chipLen = size * 0.05 * (0.6 + k / RINGS);
    const gap = size * 0.02;
    const count = Math.max(6, Math.floor((TAU * r) / (chipLen + gap)));
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + drift;
      if (rand() > 0.1 + 0.72 * focus(a)) continue;
      cells.push({
        kind: "rect",
        cx: Math.cos(a) * r,
        cy: Math.sin(a) * r,
        w: chipLen,
        h: Math.max(2, size * 0.016),
        rx: 0,
        rotation: (a * 180) / Math.PI + 90,
        color: palette[(k + i) % palette.length] ?? darkest(palette),
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 16 — KINETIC CHECKER: a bold two-tone polar checker wound into a rotor
// by a radius-dependent swirl, with a C-cut quadrant removed and a
// ragged outer rim. (Wave-rotor / emerald-vortex family.)
// ─────────────────────────────────────────────────────────────────────
export const buildKineticChecker: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const R = half * 1.0;
  const RINGS = 13;
  const WEDGES = 24;
  const colA = palette[0] ?? lightest(palette);
  const ink = darkest(palette);
  const swirl = (1.0 + rand() * 0.9) * (rand() < 0.5 ? 1 : -1);
  const cutCenter = rand() * TAU;
  const cutHalf = 0.55 + rand() * 0.5;
  const wedgeMax: number[] = [];
  for (let i = 0; i < WEDGES; i++) wedgeMax.push(0.82 + rand() * 0.18);
  for (let k = 1; k <= RINGS; k++) {
    const ringT = k / RINGS;
    const r0 = R * ((k - 1) / RINGS);
    const r1 = R * (k / RINGS);
    const rMid = (r0 + r1) / 2;
    const twist = swirl * Math.pow(ringT, 1.3) * TAU * 0.18;
    for (let i = 0; i < WEDGES; i++) {
      if (ringT > (wedgeMax[i] ?? 1)) continue; // ragged rim
      const a0 = (i / WEDGES) * TAU + twist;
      const a1 = ((i + 1) / WEDGES) * TAU + twist;
      const aMid = (a0 + a1) / 2;
      let d = aMid - cutCenter;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      if (Math.abs(d) < cutHalf) continue; // C-cut
      if (rand() < 0.05) continue; // holes
      cells.push({
        kind: "wedge",
        cx: Math.cos(aMid) * rMid,
        cy: Math.sin(aMid) * rMid,
        innerR: r0,
        outerR: r1,
        startA: a0,
        endA: a1,
        color: (i + k) % 2 === 0 ? colA : ink,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 17 — SCANLINE FIELD: a disc of horizontal scanline dashes (longest at
// the equator), with one recoloured accent band cutting across; ragged
// dash ends + holes.
// ─────────────────────────────────────────────────────────────────────
export const buildScanlineField: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const ink = darkest(palette);
  const accent = palette.find((c) => c !== ink) ?? ink;
  const R = half * 0.96;
  const LINES = 34;
  const bandCenter = (rand() - 0.5) * R * 0.5;
  const bandH = R * 0.18;
  // Solid accent blob behind the band (the central mass in the ref).
  cells.push({
    kind: "rect",
    cx: (rand() - 0.5) * R * 0.2,
    cy: bandCenter,
    w: R * 0.85,
    h: bandH * 0.7,
    rx: bandH * 0.35,
    color: accent,
  });
  for (let i = 0; i < LINES; i++) {
    const y = -R + (i / (LINES - 1)) * 2 * R;
    const hw = Math.sqrt(Math.max(0, R * R - y * y));
    if (hw < 4) continue;
    const dashLen = size * 0.04;
    const gap = size * 0.02;
    const count = Math.floor((2 * hw) / (dashLen + gap));
    const isBand = Math.abs(y - bandCenter) < bandH / 2;
    for (let s = 0; s < count; s++) {
      if (!isBand && rand() < 0.18) continue;
      const x = -hw + s * (dashLen + gap) + dashLen / 2 + (rand() - 0.5) * gap;
      cells.push({
        kind: "rect",
        cx: x,
        cy: y + (rand() - 0.5) * size * 0.004,
        w: isBand ? dashLen * 1.3 : dashLen * (0.7 + rand() * 0.6),
        h: Math.max(2, size * 0.012),
        rx: 0,
        color: isBand ? accent : ink,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 18 — TACTICAL SCAN: concentric thick arc rings broken into segments
// with gaps (radar sweep), a solid hub, occasional accent ring.
// ─────────────────────────────────────────────────────────────────────
export const buildTacticalScan: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const ink = darkest(palette);
  const accent = palette.find((c) => c !== ink) ?? ink;
  const R = half * 1.0;
  const RINGS = 7;
  const ringGap = R / RINGS;
  for (let k = 0; k < RINGS; k++) {
    const r0 = k * ringGap + ringGap * 0.18;
    const r1 = (k + 1) * ringGap - ringGap * 0.18;
    const rMid = (r0 + r1) / 2;
    const ringColor = rand() < 0.2 ? accent : ink;
    const segs = 2 + Math.floor(rand() * 3);
    let a = rand() * TAU;
    for (let s = 0; s < segs; s++) {
      const span = (TAU / segs) * (0.4 + rand() * 0.5);
      const a0 = a;
      const a1 = a + span;
      a = a1 + (TAU / segs) * (0.3 + rand() * 0.4);
      if (rand() < 0.15) continue;
      const aMid = (a0 + a1) / 2;
      cells.push({
        kind: "wedge",
        cx: Math.cos(aMid) * rMid,
        cy: Math.sin(aMid) * rMid,
        innerR: r0,
        outerR: r1,
        startA: a0,
        endA: a1,
        color: ringColor,
      });
    }
  }
  cells.push({ kind: "circle", cx: 0, cy: 0, r: R * 0.1, color: ink });
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 19 — PIXEL SPIRAL: small square pixels scattered (jittered) along a
// logarithmic spiral, sparse with holes, two-tone with accent flecks.
// ─────────────────────────────────────────────────────────────────────
export const buildPixelSpiral: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const ink = darkest(palette);
  const accent = palette.find((c) => c !== ink) ?? ink;
  const outerR = half * 0.98;
  const TURNS = 3.2;
  const STEPS = 220;
  for (let s = 1; s <= STEPS; s++) {
    const t = s / STEPS;
    if (rand() < 0.45) continue; // sparse → holes
    const r = outerR * Math.pow(t, 0.9);
    const a = TURNS * t * TAU;
    const jr = (rand() - 0.5) * size * 0.06;
    const ja = (rand() - 0.5) * 0.15;
    const sq = size * (0.012 + rand() * 0.018);
    cells.push({
      kind: "rect",
      cx: Math.cos(a + ja) * (r + jr),
      cy: Math.sin(a + ja) * (r + jr),
      w: sq,
      h: sq,
      rx: sq * 0.15,
      rotation: rand() * 90,
      color: rand() < 0.2 ? accent : ink,
    });
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 20 — SPIRAL ECHO: concentric rings of dashes, each ring strongly
// rotated so the dashes echo into a moiré spiral; mild focal bias + holes.
// ─────────────────────────────────────────────────────────────────────
export const buildSpiralEcho: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const focus = makeAngleFocus(rand);
  const colA = palette[0] ?? lightest(palette);
  const ink = darkest(palette);
  const innerR = half * 0.06;
  const outerR = half * 1.0;
  const RINGS = 24;
  for (let k = 0; k < RINGS; k++) {
    const r = innerR + (outerR - innerR) * (k / RINGS);
    const rot = k * 0.18;
    const dashLen = size * 0.035;
    const gap = size * 0.022;
    const count = Math.max(6, Math.floor((TAU * r) / (dashLen + gap)));
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + rot;
      if (rand() > 0.5 + 0.4 * focus(a)) continue;
      cells.push({
        kind: "rect",
        cx: Math.cos(a) * r,
        cy: Math.sin(a) * r,
        w: dashLen,
        h: Math.max(2, size * 0.013),
        rx: 0,
        rotation: (a * 180) / Math.PI + 90,
        color: k % 3 === 0 ? ink : colA,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 21 — HARMONIC PULSE: nested thick concentric arcs on one side + an
// offset cluster of descending bars — a two-element broadcast pulse.
// ─────────────────────────────────────────────────────────────────────
export const buildHarmonicPulse: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const accent = palette[0] ?? darkest(palette);
  const ARCS = 5;
  const a0 = Math.PI * 0.55;
  const a1 = Math.PI * 1.05;
  for (let k = 0; k < ARCS; k++) {
    const r0 = half * (0.18 + k * 0.14);
    const r1 = r0 + half * 0.08;
    const rMid = (r0 + r1) / 2;
    const aMid = (a0 + a1) / 2;
    cells.push({
      kind: "wedge",
      cx: Math.cos(aMid) * rMid,
      cy: Math.sin(aMid) * rMid,
      innerR: r0,
      outerR: r1,
      startA: a0,
      endA: a1,
      color: accent,
    });
  }
  const bars = 7;
  for (let i = 0; i < bars; i++) {
    if (rand() < 0.1) continue;
    const x = half * 0.12 + i * (size * 0.05);
    const h = size * (0.1 + rand() * 0.3);
    cells.push({
      kind: "rect",
      cx: x,
      cy: half * 0.12 + h / 2,
      w: size * 0.03,
      h,
      rx: 0,
      color: accent,
    });
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 22 — SHARD VORTEX (ref blue/black spiral): radial arms of chip
// segments spun into a logarithmic pinwheel — tiny dense chips at the
// hub swelling outward, ragged arm lengths (longer in the focal lobe),
// two-tone with checker gaps.
// ─────────────────────────────────────────────────────────────────────
export const buildShardVortex: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const focus = makeAngleFocus(rand);
  const ink = darkest(palette);
  const accent = palette.find((c) => c !== ink) ?? ink;
  const innerR = half * 0.02;
  const outerR = half * 1.06;
  const ARMS = 40;
  const swirl = (0.8 + rand() * 0.6) * (rand() < 0.5 ? 1 : -1);
  for (let arm = 0; arm < ARMS; arm++) {
    const a0 = (arm / ARMS) * TAU + (rand() - 0.5) * 0.06;
    const armMax = 0.5 + 0.5 * focus(a0) + rand() * 0.2; // ragged reach
    const STEPS = 20;
    for (let s = 1; s <= STEPS; s++) {
      const t = s / STEPS;
      if (t > armMax) break;
      if (rand() < 0.18 || (s % 2 === 0 && rand() < 0.4)) continue; // checker holes
      const r = innerR + (outerR - innerR) * Math.pow(t, 1.08);
      const a = a0 + swirl * Math.pow(t, 1.1) * 1.4;
      cells.push({
        kind: "rect",
        cx: Math.cos(a) * r,
        cy: Math.sin(a) * r,
        w: size * (0.012 + t * 0.05) * (0.7 + rand() * 0.6),
        h: size * (0.01 + t * 0.03) * (0.7 + rand() * 0.6),
        rx: 0,
        rotation: (a * 180) / Math.PI,
        color: s % 2 ? ink : accent,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 23 — COLLAPSED QUADRANT (ref red/black): a swirled segmented checker
// disc (red/black/white) collapsing inward, with a few BOLD accent
// wedges flung out past the rim. C-cut + ragged + holes.
// ─────────────────────────────────────────────────────────────────────
export const buildCollapsedQuadrant: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const ink = darkest(palette);
  const accent = palette.find((c) => c !== ink) ?? ink;
  const R = half * 0.9;
  const RINGS = 16;
  const WEDGES = 30;
  const swirl = (0.9 + rand() * 0.7) * (rand() < 0.5 ? 1 : -1);
  const cutCenter = rand() * TAU;
  const cutHalf = 0.45;
  const wedgeMax: number[] = [];
  for (let i = 0; i < WEDGES; i++) wedgeMax.push(0.8 + rand() * 0.2);
  for (let k = 1; k <= RINGS; k++) {
    const ringT = k / RINGS;
    const r0 = R * ((k - 1) / RINGS);
    const r1 = R * (k / RINGS);
    const rMid = (r0 + r1) / 2;
    const twist = swirl * Math.pow(ringT, 1.3) * TAU * 0.2;
    for (let i = 0; i < WEDGES; i++) {
      if (ringT > (wedgeMax[i] ?? 1)) continue;
      const a0 = (i / WEDGES) * TAU + twist;
      const a1 = ((i + 1) / WEDGES) * TAU + twist;
      const aMid = (a0 + a1) / 2;
      let d = aMid - cutCenter;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      if (Math.abs(d) < cutHalf) continue; // C-cut
      if (rand() < 0.26) continue; // white gaps + holes
      cells.push({
        kind: "wedge",
        cx: Math.cos(aMid) * rMid,
        cy: Math.sin(aMid) * rMid,
        innerR: r0,
        outerR: r1,
        startA: a0,
        endA: a1,
        color: (i + k) % 2 === 0 ? ink : accent,
      });
    }
  }
  // Bold accent wedges flung out past the rim.
  for (let b = 0; b < 3; b++) {
    const a = rand() * TAU;
    const w = 0.12 + rand() * 0.1;
    const reach = R * (1.05 + rand() * 0.4);
    const rMid = (R * 0.5 + reach) / 2;
    cells.push({
      kind: "wedge",
      cx: Math.cos(a + w / 2) * rMid,
      cy: Math.sin(a + w / 2) * rMid,
      innerR: R * 0.5,
      outerR: reach,
      startA: a,
      endA: a + w,
      color: accent,
    });
  }
  return { cells, focal: { x: 0, y: 0 } };
};

export type RefShape = { key: string; label: string; build: ShapeBuilder };

export const REF_SHAPES: RefShape[] = [
  { key: "spoke_chips", label: "Spoke Chips", build: buildSpokeChips },
  { key: "primary_sunburst", label: "Primary Sunburst", build: buildPrimarySunburst },
  { key: "tunnel_dashes", label: "Tunnel Dashes", build: buildTunnelDashes },
  { key: "step_spiral", label: "Step Spiral", build: buildStepSpiral },
  { key: "rake_grid", label: "Rake Grid", build: buildRakeGrid },
  { key: "shard_burst", label: "Shard Burst", build: buildShardBurst },
  { key: "comet_streaks", label: "Comet Streaks", build: buildCometStreaks },
  { key: "fingerprint_arcs", label: "Fingerprint Arcs", build: buildFingerprintArcs },
  { key: "checker_warp", label: "Checker Warp", build: buildCheckerWarp },
  { key: "ray_field", label: "Ray Field", build: buildRayField },
  { key: "swirl_checker", label: "Swirl Checker", build: buildSwirlChecker },
  { key: "signal_fan", label: "Signal Fan", build: buildWaveStripes },
  { key: "zigzag_shards", label: "Zigzag Shards", build: buildZigzagShards },
  { key: "stepped_arcs", label: "Stepped Arcs", build: buildSteppedArcs },
  { key: "quantized_orbit", label: "Quantized Orbit", build: buildQuantizedOrbit },
  { key: "kinetic_checker", label: "Kinetic Checker", build: buildKineticChecker },
  { key: "scanline_field", label: "Scanline Field", build: buildScanlineField },
  { key: "tactical_scan", label: "Tactical Scan", build: buildTacticalScan },
  { key: "pixel_spiral", label: "Pixel Spiral", build: buildPixelSpiral },
  { key: "spiral_echo", label: "Spiral Echo", build: buildSpiralEcho },
  { key: "harmonic_pulse", label: "Harmonic Pulse", build: buildHarmonicPulse },
  { key: "shard_vortex", label: "Shard Vortex", build: buildShardVortex },
  { key: "collapsed_quadrant", label: "Collapsed Quadrant", build: buildCollapsedQuadrant },
];
