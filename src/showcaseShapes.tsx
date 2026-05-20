// @refresh reset
// ↑ This module exports non-component values (shape builders, the
// renderer, the registry array). Mixing those with the inline
// ShapeRenderer component confuses React Fast Refresh and frequently
// leaves the page blank after an edit. Forcing a clean reset is
// cheap (just re-runs the build functions) and eliminates the
// instability.

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";

// showcaseShapes — six generative shape families authored from the
// reference set:
//   warp_grid       — dot/square grid warped by a sine field
//   pixel_plus      — chunky pixel-art X / cross
//   color_dial      — multi-coloured radial dial with long outer wedges
//   thin_spokes     — dense thin radial spokes with density variation
//   halftone_arc    — concentric dotted arcs forming a crescent
//   sawtooth_spiral — pink-style concentric stepped zigzag rings
//
// Each shape is expressed as an array of `Cell` primitives so the
// shared `<ShapeRenderer>` can apply the gallery's per-cell stagger +
// back-out scale-from-focal eruption animation (matching the cellGrid
// pipeline's reveal feel).

const TAU = Math.PI * 2;

const mulberry32 = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

// Perceptual luminance from a hex string. Used to pick the darkest /
// lightest colours in a team palette so shapes can choose contrast
// colours without ever hardcoding pure black or white.
const colorLuminance = (hex: string): number => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

// Pick the darkest colour available in the team palette. Replaces
// the old `inkDark = "#0E0E0E"` constants so every shape's "ink"
// stays within the flag palette — black only appears if it's
// actually one of the team's flag colours.
const darkestColor = (palette: string[]): string => {
  let best = palette[0] ?? "#222222";
  let bestLum = 999;
  for (const hex of palette) {
    const lum = colorLuminance(hex);
    if (lum < bestLum) {
      bestLum = lum;
      best = hex;
    }
  }
  return best;
};

// Pick the lightest palette slot — used as a safe fallback colour
// when an accent lookup misses (e.g. for default cell colours).
const lightestColor = (palette: string[]): string => {
  let best = palette[0] ?? "#FFFFFF";
  let bestLum = -1;
  for (const hex of palette) {
    const lum = colorLuminance(hex);
    if (lum > bestLum) {
      bestLum = lum;
      best = hex;
    }
  }
  return best;
};

export type ShapeFamily =
  | "pixel_plus"
  | "color_dial"
  | "thin_spokes"
  | "halftone_arc"
  | "fragmented_burst"
  | "warped_checker"
  | "diagonal_taper"
  | "crown_dial"
  | "perspective_fan"
  | "interference_mandala"
  | "mandala_curves"
  | "pixel_rhombus"
  | "chevron_dots"
  | "polar_vortex"
  | "shatter_mandala"
  | "pixel_bloom"
  | "apex_fan"
  | "burst_segments"
  | "vortex_disc"
  | "vortex_disc_diagonal"
  | "vortex_disc_flat"
  | "vortex_disc_spinner"
  | "lens_mandala"
  | "corner_arcs"
  | "scanline_ribbon"
  | "ripple_arcs"
  | "polar_swirl"
  ;

// Every cell variant can opt out of the renderer's per-cell spin via
// `noSpin`. Used by bars that should grow along a fixed direction
// (perspective_fan) instead of swinging around the scale pivot.
//
// `revealMode` selects how the cell animates once its delay elapses:
//   "burst" (default) — back-out scale-from-focal + spin + travel
//   "fade"  — fast linear scale 0→1, no travel, no spin, no overshoot
//   "grow"  — smooth ease-out scale-from-anchor, travel from cx, no
//             spin, no overshoot. Use when a cell should extend
//             cleanly to its target without rubber-banding past it
//             (perspective_fan bars need this so each line stops at
//             its own target length).
type CellBase = {
  cx: number; cy: number;
  color: string;
  revealOrder?: number;
  noSpin?: boolean;
  revealMode?: "burst" | "fade" | "grow";
  // Per-cell eruption origin (overrides the shape-level focal). At
  // t=0 the cell paints at birthOrigin; at t=1 it lands at (cx, cy).
  // Lets adjacent cells fly in from different sides without changing
  // the shape's focal.
  birthOrigin?: { x: number; y: number };
  // Speed multiplier on this cell's reveal — 1 = default
  // PER_CELL/FADE_PER_CELL duration, 0.5 = twice as slow, 2 = twice
  // as fast. Used to dial individual shape tempos (perspective_fan
  // wants a slower draw to feel cinematic).
  revealSpeed?: number;
  // Per-cell continuous rotation AROUND (0, 0) — degrees per frame.
  // After the cell finishes its reveal, the renderer adds an extra
  // `rotate(vortexSpeed × localFrame)` around the shape origin. Cells
  // declaring different speeds (e.g. inner rings faster than outer)
  // shear past each other to create a vortex / whirlpool motion.
  vortexSpeed?: number;
  // Per-cell continuous "pulse" — scale up + back down on a yoyo
  // loop that repeats forever. `ripplePeriodSec` = full cycle
  // duration; `ripplePhase` ∈ [0, 1] shifts the pulse start so
  // staggering cells by ringT produces an outward-travelling
  // ripple wave (centre cells peak first, rim cells peak last).
  // `rippleAmp` defaults to 0.35 (scale 1 → 1.35 → 1).
  ripplePeriodSec?: number;
  ripplePhase?: number;
  rippleAmp?: number;
};

export type Cell =
  | (CellBase & {
      kind: "rect";
      w: number; h: number;
      rotation?: number;
      rx?: number;
    })
  | (CellBase & {
      kind: "circle";
      r: number;
    })
  | (CellBase & {
      kind: "line";
      x1: number; y1: number; x2: number; y2: number;
      strokeW: number;
    })
  | (CellBase & {
      kind: "wedge";
      innerR: number; outerR: number;
      startA: number; endA: number;
    })
  | (CellBase & {
      kind: "path";
      d: string;
    });

// Optional per-shape wrapper animation — returns an SVG transform
// applied to the entire shape group as a function of the current
// local-frame. Used for shape-level motion that can't be expressed
// as per-cell stagger (e.g. continuous spinning, 3D-ball rotation,
// wave-phase travel). Returning the empty string means no transform.
export type WrapAnimation = (localFrame: number) => string;

export type ShapeBuilder = (
  seed: number,
  size: number,
  palette: string[],
) => {
  cells: Cell[];
  focal: { x: number; y: number };
  wrapAnimation?: WrapAnimation;
};

// ─────────────────────────────────────────────────────────────────────
// 2 — PIXEL PLUS  →  ORBITAL RINGS
//
// Concentric rings of equal-sized squares orbiting a central pip.
// Each ring is sampled by a constant arc-spacing so the squares
// are evenly distributed around the ring with a clear uniform gap
// between neighbours. Inner rings spin faster than outer rings
// (per-cell vortexSpeed), so the field reads as a layered orbital
// system rotating around its centre.
// ─────────────────────────────────────────────────────────────────────
export const buildPixelPlus: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const r = size / 2;
  const cells: Cell[] = [];
  void rand;
  // Square size and ring spacing — both held constant so every
  // square is identical and rings keep visibly equal distance.
  const sqSide = size * 0.032;
  const ringStep = sqSide * 3.0; // ring-to-ring radial distance
  const RINGS = 4;
  // Per-ring constant arc gap — controls how far apart neighbours
  // sit. Wide gap keeps the orbital field sparse and legible.
  const ARC_GAP = sqSide * 2.8;
  // Tiny central pip — the orbital nucleus.
  cells.push({
    kind: "rect",
    cx: 0,
    cy: 0,
    w: sqSide * 1.1,
    h: sqSide * 1.1,
    rx: 0,
    color: palette[0] ?? "#FFFFFF",
    revealOrder: 0,
    revealMode: "grow",
    birthOrigin: { x: 0, y: 0 },
  });
  for (let k = 1; k <= RINGS; k++) {
    const ringR = ringStep * k;
    if (ringR > r * 0.98) break;
    // Count of squares on this ring — circumference / gap, rounded.
    const circumference = TAU * ringR;
    const count = Math.max(4, Math.floor(circumference / ARC_GAP));
    // Phase offset per ring so adjacent rings don't align radially —
    // produces a richer orbital read.
    const phase = (k * 0.27) * TAU;
    // Outer rings rotate slower than inner ones; alternate sign so
    // adjacent rings move in opposite directions for visible shear.
    const dir = k % 2 === 0 ? 1 : -1;
    const vortexSpeed = dir * (0.85 - k * 0.10);
    for (let i = 0; i < count; i++) {
      const a = phase + (i / count) * TAU;
      const cx = Math.cos(a) * ringR;
      const cy = Math.sin(a) * ringR;
      const color = palette[(k + i) % palette.length] ?? "#FFFFFF";
      cells.push({
        kind: "rect",
        cx,
        cy,
        w: sqSide,
        h: sqSide,
        rx: 0,
        color,
        // Inner rings reveal first, outer last.
        revealOrder: Math.min(1, k / RINGS),
        revealMode: "grow",
        birthOrigin: { x: 0, y: 0 },
        vortexSpeed,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 3 — COLOR DIAL
// ─────────────────────────────────────────────────────────────────────
export const buildColorDial: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const r = size / 2;
  const cells: Cell[] = [];
  // Outer big wedges — long radial bands.
  const OUTER_COUNT = 18;
  const outerStart = r * 0.55;
  const outerEnd = r * 1.04;
  for (let i = 0; i < OUTER_COUNT; i++) {
    const a0 = (i / OUTER_COUNT) * TAU;
    const a1 = ((i + 1) / OUTER_COUNT) * TAU;
    if (rand() < 0.32) continue;
    const reach = outerStart + (outerEnd - outerStart) * (0.5 + rand() * 0.5);
    const aMid = (a0 + a1) / 2;
    const cellMidR = (outerStart + reach) * 0.5;
    cells.push({
      kind: "wedge",
      cx: Math.cos(aMid) * cellMidR,
      cy: Math.sin(aMid) * cellMidR,
      innerR: outerStart,
      outerR: reach,
      startA: a0 + 0.005,
      endA: a1 - 0.005,
      color: palette[i % palette.length] ?? "#FFFFFF",
      // Outer wedges fire last in the centre-out cascade and erupt
      // straight outward from origin without per-cell spin so the
      // motion reads as a clean explosion.
      revealOrder: Math.min(1, cellMidR / r),
      revealMode: "burst",
      birthOrigin: { x: 0, y: 0 },
      noSpin: true,
    });
  }
  // Inner dense rings — thin radial slices that tessellate the centre.
  const INNER_RINGS = 5;
  const INNER_PER_RING_BASE = 36;
  for (let k = 0; k < INNER_RINGS; k++) {
    const ringT = k / (INNER_RINGS - 1);
    const r0 = r * (0.06 + 0.45 * ringT);
    const r1 = r * (0.06 + 0.45 * (ringT + 1 / (INNER_RINGS - 1) - 0.01));
    const slices = INNER_PER_RING_BASE + k * 18;
    for (let i = 0; i < slices; i++) {
      const a0 = (i / slices) * TAU;
      const a1 = ((i + 1) / slices) * TAU;
      const aMid = (a0 + a1) / 2;
      const innerMid = (r0 + r1) * 0.5;
      cells.push({
        kind: "wedge",
        cx: Math.cos(aMid) * innerMid,
        cy: Math.sin(aMid) * innerMid,
        innerR: r0,
        outerR: r1,
        startA: a0,
        endA: a1,
        color: palette[(i + k * 3) % palette.length] ?? "#FFFFFF",
        // Inner ring cells fire first — concentric centre-out
        // cascade. Burst + birthOrigin at (0,0) + noSpin keeps the
        // motion strictly radial so the dial reads as exploding from
        // the centre instead of sliding in from one side.
        revealOrder: Math.min(1, innerMid / r),
        revealMode: "burst",
        birthOrigin: { x: 0, y: 0 },
        noSpin: true,
      });
    }
  }
  // Continuous spin — the whole dial rotates clockwise like a
  // ticking clock face. Period ≈ 6 s at 30 fps (slow enough to read
  // the colour mosaic, fast enough to feel kinetic).
  const wrapAnimation: WrapAnimation = (localFrame) => {
    const REVEAL_END = STAGGER_TOTAL + 6;
    const f = Math.max(0, localFrame - REVEAL_END);
    const deg = (f / 30) * 60; // 60° per second
    return `rotate(${deg.toFixed(2)})`;
  };
  return { cells, focal: { x: 0, y: 0 }, wrapAnimation };
};

// ─────────────────────────────────────────────────────────────────────
// 4 — THIN SPOKES
// ─────────────────────────────────────────────────────────────────────
export const buildThinSpokes: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const r = size / 2;
  const innerR = 0;
  // Wheel-style fan — few enough spokes that every individual one
  // reads as a discrete radial line (bicycle-wheel feel) rather
  // than a continuous halo.
  const N = 64;
  const cells: Cell[] = [];
  for (let i = 0; i < N; i++) {
    // Even angular spacing — no per-spoke jitter, the wheel reads
    // as engineered rather than organic.
    const a = (i / N) * TAU;
    // Most spokes reach the rim; a small minority sit slightly
    // shorter for visual variety so the wheel doesn't feel sterile.
    const lenFactor = rand() < 0.18 ? 0.7 + rand() * 0.18 : 0.94 + rand() * 0.06;
    const len = (r - innerR) * lenFactor;
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    const x1 = cx * innerR;
    const y1 = cy * innerR;
    const x2 = cx * (innerR + len);
    const y2 = cy * (innerR + len);
    const color = palette[i % palette.length] ?? lightestColor(palette);
    const endDist = Math.hypot(x2, y2);
    // Reveal cascade mirrors VORTEX_DISC_DIAGONAL: smooth grow-in
    // staggered across ~60% of the window. Inner spokes finish first;
    // outer ones extend last.
    // All spokes grow simultaneously from the hub to their rim
    // endpoint — no radial cascade. revealOrder 0 for every spoke so
    // they extend outward together.
    const revealOrder = 0;
    cells.push({
      kind: "line",
      // Anchor the cell at the origin (hub) so the GSAP scale pivots
      // there and the line grows along its length from centre to rim.
      cx: 0,
      cy: 0,
      x1, y1, x2, y2,
      strokeW: Math.max(1.4, r * 0.008),
      color,
      revealOrder,
      // Same grow-mode ease as VORTEX_DISC_DIAGONAL: power3.out, no
      // overshoot, no travel (cx,cy + birthOrigin both at origin).
      revealMode: "grow",
      birthOrigin: { x: 0, y: 0 },
      noSpin: true,
    });
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 5 — HALFTONE ARC
// ─────────────────────────────────────────────────────────────────────
export const buildHalftoneArc: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const r = size / 2;
  const cells: Cell[] = [];
  // Slightly off-centre focal so the C-shape reads as oriented.
  const fx = r * 0.06;
  const fy = r * 0.02;
  // Reduced ring + dot density so each circle has visible breathing
  // room around it — the crescent reads as a halftone pattern of
  // distinct dots, not a continuous mass.
  const RINGS = 10;
  const innerR = r * 0.18;
  // Crescent opening — drop dashes whose angle falls inside this wedge.
  const dropStart = -Math.PI * 0.45;
  const dropEnd = Math.PI * 0.25;
  for (let k = 0; k < RINGS; k++) {
    const t = k / (RINGS - 1);
    const ringR = innerR + (r - innerR) * (0.05 + 0.94 * t);
    // ~half the prior dot count per ring, so adjacent dots have a
    // full diameter of black space between them at every radius.
    const dots = Math.max(16, Math.round(20 + t * 18));
    const dotR = Math.max(2.6, r * 0.02 * (1 - t * 0.4));
    for (let i = 0; i < dots; i++) {
      // Angle: -π..+π, with 0 pointing right.
      const a = -Math.PI + (i / dots) * TAU;
      if (a > dropStart && a < dropEnd) continue;
      const jitterR = (rand() - 0.5) * dotR * 0.6;
      const jitterA = (rand() - 0.5) * 0.012;
      const rr = ringR + jitterR;
      const cx = fx + Math.cos(a + jitterA) * rr;
      const cy = fy + Math.sin(a + jitterA) * rr;
      // Reveal order — centre-outward: ring index k drives delay so
      // inner rings appear first and outer rings last, sweeping the
      // crescent open from focal to rim. Slight intra-ring jitter
      // (i * tiny offset) so dots within the same ring stagger
      // gently rather than popping in lockstep.
      const ringT = k / Math.max(1, RINGS - 1);
      const innerJitter = (i / Math.max(1, dots - 1)) * 0.04;
      // Reveal radiates from the CANVAS CENTRE outward — closest
      // dots to (0, 0) fire first, rim dots last. Each dot still
      // erupts via birthOrigin + burst overshoot from (0, 0) so
      // the whole crescent feels like a single explosion.
      const order = Math.min(1, Math.hypot(cx, cy) / r);
      // Squares instead of dots — each pip is a small filled rect
      // sized to the same diameter the circle had (2 × dotR).
      const dotSide = dotR * (0.7 + rand() * 0.5) * 2;
      cells.push({
        kind: "rect",
        cx, cy,
        w: dotSide,
        h: dotSide,
        color: palette[(i + k * 2) % palette.length] ?? "#FFFFFF",
        revealOrder: order,
        revealMode: "burst",
        birthOrigin: { x: 0, y: 0 },
      });
    }
  }
  return { cells, focal: { x: fx, y: fy } };
};

// ─────────────────────────────────────────────────────────────────────
// 6 — SAWTOOTH SPIRAL
// ─────────────────────────────────────────────────────────────────────
export const buildSawtoothSpiral: ShapeBuilder = (seed, size, palette) => {
  const r = size / 2;
  const cells: Cell[] = [];
  const ink = palette[0] ?? "#FFFFFF";
  const RINGS = 14;
  const innerR = r * 0.04;
  const teethPerRing = 64;
  const rand = mulberry32(seed);
  const radii: number[] = [];
  for (let k = 0; k <= RINGS; k++) {
    radii.push(innerR + (r - innerR) * (k / RINGS));
  }
  for (let k = 0; k < RINGS; k++) {
    const r0 = radii[k]!;
    const r1 = radii[k + 1]!;
    // WILDER amp — taller teeth + per-ring seeded variation so each
    // ring's amplitude differs (some rings calm, others spiky).
    const baseAmp = (r1 - r0) * 0.55;
    const ampMul = 0.85 + rand() * 1.3; // 0.85..2.15× the base
    const amp = baseAmp * ampMul;
    const baseR = (r0 + r1) / 2;
    // Per-ring rotational chaos: stronger random twist on top of the
    // gentle spiral 0.09·k. Adds a second sinusoid so neighbouring
    // teeth slip relative to each other instead of forming clean rays.
    const twistBase = k * 0.09 + (rand() - 0.5) * 0.5;
    const wobblePhase = rand() * TAU;
    const wobbleAmp = 0.04 + rand() * 0.05; // angular jitter on each tooth
    const pts: string[] = [];
    // Outer toothed edge — counter-clockwise.
    for (let i = 0; i <= teethPerRing; i++) {
      const aJit = Math.sin(i * 0.7 + wobblePhase) * wobbleAmp;
      const a = (i / teethPerRing) * TAU + twistBase + aJit;
      const tooth = i % 2 === 0 ? amp : -amp;
      // Add a slow modulation so some teeth are taller than others
      // along the ring — keeps the structure but makes it ragged.
      const teethMod = 1 + Math.sin(i * 0.35 + wobblePhase * 1.3) * 0.35;
      const radius = baseR + tooth * teethMod;
      pts.push(`${(Math.cos(a) * radius).toFixed(2)},${(Math.sin(a) * radius).toFixed(2)}`);
    }
    // Inner edge — clockwise (reverse direction).
    for (let i = teethPerRing; i >= 0; i--) {
      const aJit = Math.sin(i * 0.7 + wobblePhase) * wobbleAmp;
      const a = (i / teethPerRing) * TAU + twistBase + aJit;
      const radius = baseR - amp * 1.05;
      pts.push(`${(Math.cos(a) * radius).toFixed(2)},${(Math.sin(a) * radius).toFixed(2)}`);
    }
    cells.push({
      kind: "path",
      cx: 0,
      cy: 0,
      d: `M ${pts.join(" L ")} Z`,
      // Reveal order: outer rings appear later so the spiral unfurls
      // from the centre outward — matches the gallery's focal-outward
      // sweep.
      revealOrder: k / RINGS,
      color: k % 2 === 0 ? ink : (palette[1] ?? ink),
    });
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 7 — FRAGMENTED BURST
//
// Image 11: dense radial spokes whose outer halves shatter into
// alternating-presence segments. Inner half is a solid bar; outer
// half is a column of short fragments that drop randomly so the rim
// dilutes through fragmentation rather than a hard clip.
// ─────────────────────────────────────────────────────────────────────
export const buildFragmentedBurst: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const r = size / 2;
  const cells: Cell[] = [];
  // Radial spokes built as chains of small segments. The inner
  // half packs segments tightly (no gaps, no dropout) so it reads
  // as a solid bar; the outer half spaces segments apart and
  // applies per-segment dropout so the rim dilutes through
  // fragmentation. Every segment carries its own revealOrder by
  // radial distance, so the whole burst visibly draws from the
  // centre outward to the rim.
  const SPOKES = 96;
  const SOLID_REACH = r * 0.45;
  const FRAG_REACH = r * 1.00;
  const INNER_SEGMENTS = 6;  // inner solid bar split into N segments for reveal
  const OUTER_SEGMENTS = 7;  // outer fragmented chain
  const spokeW = Math.max(1.2, r * 0.012);
  for (let i = 0; i < SPOKES; i++) {
    const a = (i / SPOKES) * TAU;
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    const color = palette[i % palette.length] ?? "#FFFFFF";
    // Inner solid bar — broken into INNER_SEGMENTS contiguous pieces
    // (zero-gap) so each carries its own reveal time. Visually the
    // bar reads continuous; behaviourally it draws segment-by-
    // segment from the very centre outward.
    const innerStride = SOLID_REACH / INNER_SEGMENTS;
    for (let s = 0; s < INNER_SEGMENTS; s++) {
      const r0 = s * innerStride;
      const r1 = r0 + innerStride;
      const mid = (r0 + r1) / 2;
      cells.push({
        kind: "rect",
        cx: cx * mid,
        cy: cy * mid,
        w: spokeW,
        h: innerStride,
        rx: 0,
        rotation: (a * 180) / Math.PI + 90,
        color,
        revealOrder: Math.min(1, mid / r),
        revealMode: "burst",
        birthOrigin: { x: 0, y: 0 },
        noSpin: true,
      });
    }
    // Outer fragments — short segments along the same spoke from
    // SOLID_REACH out to FRAG_REACH, with random per-segment drop.
    const outerStart = SOLID_REACH;
    const SEG_GAP = 0.18;
    const outerStride = (FRAG_REACH - outerStart) / OUTER_SEGMENTS;
    const outerLen = outerStride * (1 - SEG_GAP);
    for (let s = 0; s < OUTER_SEGMENTS; s++) {
      const dropProb = 0.18 + (s / OUTER_SEGMENTS) * 0.45;
      if (rand() < dropProb) continue;
      const r0 = outerStart + s * outerStride;
      const r1 = r0 + outerLen;
      const mid = (r0 + r1) / 2;
      cells.push({
        kind: "rect",
        cx: cx * mid,
        cy: cy * mid,
        w: spokeW,
        h: outerLen,
        rx: 0,
        rotation: (a * 180) / Math.PI + 90,
        color,
        revealOrder: Math.min(1, mid / r),
        // Outer fragments share the centre-burst — back-out from
        // origin so the whole burst explodes outward in unison.
        revealMode: "burst",
        birthOrigin: { x: 0, y: 0 },
        noSpin: true,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 8 — WARPED CHECKER
//
// Image 13: op-art polar checker projected onto a sphere — rings
// tighten toward the silhouette so cells visibly compress at the
// edge. Slight spiral twist per ring gives the field its swirl.
//
// Build order is a boustrophedon (back-and-forth) zigzag across
// rings: ring 0 walks one way around the disc, ring 1 walks back,
// ring 2 forward again, and so on. The eye follows the snake-path
// instead of a uniform centre-outward bloom.
// ─────────────────────────────────────────────────────────────────────
export const buildWarpedChecker: ShapeBuilder = (seed, size, palette) => {
  void seed;
  const r = size / 2;
  const cells: Cell[] = [];
  const RINGS = 16;
  const WEDGES = 28;
  // Pass 1 — collect (k, i) of every checker-on cell.
  const indices: Array<{ k: number; i: number }> = [];
  for (let k = 0; k < RINGS; k++) {
    for (let i = 0; i < WEDGES; i++) {
      if ((k + i) % 2 !== 0) continue;
      indices.push({ k, i });
    }
  }
  // Pass 2 — sort by ring, then by angular index with the per-ring
  // direction flipped so successive rings sweep opposite ways.
  indices.sort((aIx, bIx) => {
    if (aIx.k !== bIx.k) return aIx.k - bIx.k;
    const aOrder = aIx.k % 2 === 0 ? aIx.i : WEDGES - 1 - aIx.i;
    const bOrder = bIx.k % 2 === 0 ? bIx.i : WEDGES - 1 - bIx.i;
    return aOrder - bOrder;
  });
  // Per-cell radius modulation — multi-frequency angular wobble +
  // seeded per-wedge noise so the outer silhouette is heavily
  // disrupted. Inner rings barely shift; the rim takes the full
  // amplitude so the centre stays legible while the perimeter
  // breaks up into jagged peninsulas.
  const rand = mulberry32(13);
  const wedgeNoise: number[] = [];
  for (let i = 0; i < WEDGES; i++) {
    wedgeNoise.push((rand() - 0.5) * 0.45); // ±22% per-wedge offset
  }
  const rimWobble = (a: number, wedgeIdx: number, k: number): number => {
    // Heavy quartic ring weight + capped final amplitude so the
    // wobble only meaningfully affects the outer 2-3 rings AND
    // can never exceed ±18% of a ring's radius. Without this clamp
    // a wedge could swallow its neighbour ring entirely and read
    // as cells stacking on each other.
    const t = k / RINGS;
    const ringWeight = t * t * t; // 0 at centre, 1 only at rim
    const w =
      Math.sin(a * 3 + 0.7) * 0.18 +
      Math.sin(a * 5 + 1.9) * 0.08 +
      Math.sin(a * 7 - 0.4) * 0.04 +
      (wedgeNoise[wedgeIdx] ?? 0) * 0.4;
    return Math.max(-0.18, Math.min(0.18, w * ringWeight));
  };
  // Pass 3 — emit cells with reveal order = position in the sorted
  // sequence, normalised to [0, 1].
  const total = indices.length;
  indices.forEach(({ k, i }, idx) => {
    const twist = k * 0.07;
    const a0 = (i / WEDGES) * TAU + twist;
    const a1 = ((i + 1) / WEDGES) * TAU + twist;
    const aMid = (a0 + a1) / 2;
    const baseR0 = r * Math.sin((k / RINGS) * (Math.PI / 2));
    const baseR1 = r * Math.sin(((k + 1) / RINGS) * (Math.PI / 2));
    // Apply the angular wobble — scales each ring's radius based on
    // this wedge's angle + per-wedge noise. Inner rings barely
    // shift; outer rings take ±45% modulation so the perimeter
    // breaks into clear peninsulas instead of a clean circle.
    const wob = 1 + rimWobble(aMid, i, k);
    const r0 = baseR0 * (1 + rimWobble(aMid, i, Math.max(0, k - 1)) * 0.5);
    const r1 = baseR1 * wob;
    const rMid = (r0 + r1) / 2;
    // Cycle palette per wedge so the checker is multicolour, not a
    // single ink — every flag colour shows somewhere on the disc.
    const color = palette[(k + i * 2) % palette.length] ?? "#FFFFFF";
    cells.push({
      kind: "wedge",
      cx: Math.cos(aMid) * rMid,
      cy: Math.sin(aMid) * rMid,
      innerR: r0,
      outerR: r1,
      startA: a0,
      endA: a1,
      color,
      // Reveal from the inside outward — ring index k drives the
      // stagger, so inner wedges paint first and outer wedges
      // last. Previously the boustrophedon idx made the wave
      // snake around the disc; now it radiates from the centre.
      revealOrder: k / Math.max(1, RINGS - 1),
      revealMode: "fade",
    });
  });
  void total;
  // Continuous 3D-ball rotation around the vertical axis. SVG can't
  // do real 3D so we fake the Y-axis rotation with scaleX(cos(θ))
  // — the disc compresses to a line and back out, reading as a
  // sphere spinning. Period of one full turn = ~3 s at 30 fps.
  const wrapAnimation: WrapAnimation = (localFrame) => {
    const REVEAL_END = STAGGER_TOTAL + 4;
    // Hold still while the initial stagger fades cells in.
    const f = Math.max(0, localFrame - REVEAL_END);
    const phase = f * 0.04; // ~3 s per rotation
    const sx = Math.cos(phase);
    // Floor to keep the disc visible even when cos is near 0 — pure
    // 0 would collapse the cells to invisible.
    const sxClamped = sx >= 0 ? Math.max(0.06, sx) : Math.min(-0.06, sx);
    return `scale(${sxClamped.toFixed(3)} 1)`;
  };
  return { cells, focal: { x: 0, y: 0 }, wrapAnimation };
};

// ─────────────────────────────────────────────────────────────────────
// 9 — DIAGONAL TAPER
//
// Image 12: square grid of −45° chunks. A single corner is the
// focal; chunks shrink along the perpendicular diagonal until they
// dissolve to thin lines at the far corner. Structural taper — no
// hard clip.
// ─────────────────────────────────────────────────────────────────────
export const buildDiagonalTaper: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  // FUNNEL — same -45° diagonal direction, same focal corner
  // (bottom-left). Sharp-cornered chunks (no border-radius) laid
  // out as a tapered cone: wide mouth at the top-right opening,
  // narrowing to a point at the bottom-left spout. A small uniform
  // gap separates every neighbour both along and across the funnel
  // so the field reads as discrete pixel chunks rather than a
  // continuous fill.
  const fx = -half;
  const fy = half;
  // Diagonal axis: from focal (fx, fy) toward the opposite corner.
  const aX = 1 / Math.SQRT2;   // +x
  const aY = -1 / Math.SQRT2;  // -y
  // Perpendicular to the axis (used to position chunks across the
  // funnel width).
  const pX = -aY;
  const pY = aX;
  // Sharp chunk dimensions — long thin rectangles oriented at -45°.
  const chunkW = size * 0.075;
  const chunkH = size * 0.018;
  // A -45° chunk's axis-aligned footprint along either projection is
  // (w + h) / √2. Pitch sits just above that so every neighbour has
  // a small visible gap.
  const footprint = (chunkW + chunkH) / Math.SQRT2;
  const pitch = footprint + size * 0.022; // ~2.2% canvas gap between cells
  // Funnel axial extent + axial step count derived from pitch so
  // chunks tile with consistent spacing all the way from spout to
  // mouth.
  const totalLen = Math.hypot(size, size) * 0.95;
  const STEPS = Math.floor(totalLen / pitch);
  // Funnel half-width at the mouth.
  const MOUTH_HALF_W = size * 0.42;
  for (let s = 0; s < STEPS; s++) {
    // t goes from 0 at the spout to 1 at the mouth.
    const t = STEPS === 1 ? 0 : s / (STEPS - 1);
    // Position along the diagonal axis (from focal).
    const axialDist = pitch * s;
    // Funnel half-width grows linearly with t.
    const halfW = MOUTH_HALF_W * t;
    // Perpendicular chunks per row — chosen from pitch so neighbours
    // share the same small gap as the axial spacing. Min 1 at the
    // spout (single chunk at the tip).
    const count = halfW < pitch * 0.5 ? 1 : (2 * Math.floor(halfW / pitch) + 1);
    for (let i = 0; i < count; i++) {
      // u indexes from -(count-1)/2 to +(count-1)/2 so the row is
      // perfectly centred on the diagonal axis.
      const offsetIdx = i - (count - 1) / 2;
      const perpDist = offsetIdx * pitch;
      // Position in canvas coords.
      const px = fx + aX * axialDist + pX * perpDist;
      const py = fy + aY * axialDist + pY * perpDist;
      // Skip cells that wander outside the canvas.
      if (
        px < -half * 1.05 || px > half * 1.05 ||
        py < -half * 1.05 || py > half * 1.05
      ) continue;
      // Small random dropout for breathing room, lighter near
      // mouth so the wide opening still reads as filled.
      if (rand() < 0.12 * (1 - t)) continue;
      const color = palette[(s + i) % palette.length] ?? "#FFFFFF";
      cells.push({
        kind: "rect",
        cx: px,
        cy: py,
        w: chunkW,
        h: chunkH,
        rx: 0, // sharp corners — no rounded shape
        rotation: -45,
        color,
        // Push the chunks' reveal off slightly so the focal anchor
        // (added below) lands first and reads as the funnel's origin.
        revealOrder: Math.min(1, 0.08 + t * 0.92),
        revealMode: "burst",
        birthOrigin: { x: fx, y: fy },
      });
    }
  }
  // Focus-point anchor — a single bold accent at the focal corner
  // (spout end) so the eye knows where the taper converges. Uses
  // the brightest palette slot and fires at revealOrder 0 so it
  // lands before any chunk paints.
  const focusSize = size * 0.052;
  cells.push({
    kind: "rect",
    cx: fx,
    cy: fy,
    w: focusSize,
    h: focusSize,
    rx: 0,
    rotation: -45,
    color: palette[0] ?? lightestColor(palette),
    revealOrder: 0,
    revealMode: "burst",
    birthOrigin: { x: fx, y: fy },
    noSpin: true,
  });
  return { cells, focal: { x: fx, y: fy } };
};

// ─────────────────────────────────────────────────────────────────────
// 11 — CROWN DIAL
//
// Image 20: long thin radial spokes form a background sun-rays
// halo; 2–3 concentric rings of small coloured blocks form a discrete
// dial inside. Big central void.
// ─────────────────────────────────────────────────────────────────────
export const buildCrownDial: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const r = size / 2;
  const cells: Cell[] = [];
  // Whirlpool dial — each spoke is bent into a SHORT ARC tangent to
  // a spiral, then assigned a per-ring vortexSpeed so concentric
  // rings shear past each other after reveal, producing a strong
  // whirling motion. Outer wrapAnimation adds a steady global spin
  // on top so the whole dial reads as a turbine wheeling around.
  const SPOKES = 96;
  const spokeOuter = r * 0.99;
  // Curl strength — how far each spoke leans off-radial. Higher
  // values look more like a pinwheel.
  const CURL = 0.55; // radians of tangential lean at the rim
  for (let i = 0; i < SPOKES; i++) {
    const a = (i / SPOKES) * TAU;
    // Per-spoke inner offset (0.18..0.42) and outer reach
    // (0.55..1.0). Combined random envelope so neighbouring spokes
    // differ noticeably in length.
    const inner = r * (0.18 + rand() * 0.24);
    const outerT = 0.55 + rand() * 0.45;
    const outer = inner + (spokeOuter - inner) * outerT;
    // Bend the spoke into a tangent — inner end stays at its
    // radial angle, outer end leans CURL radians ahead (counter-
    // clockwise) so each spoke arches like a turbine blade.
    const aInner = a;
    const aOuter = a + CURL * (outer / r);
    const x1 = Math.cos(aInner) * inner;
    const y1 = Math.sin(aInner) * inner;
    const x2 = Math.cos(aOuter) * outer;
    const y2 = Math.sin(aOuter) * outer;
    const midR = (inner + outer) / 2;
    // Per-spoke vortex speed — outer spokes spin slightly slower
    // than inner ones, so the dial twists with itself rather than
    // rotating rigidly. (Negative sign aligns with the CURL lean.)
    const ringT = midR / r;
    const vortexSpeed = -0.9 + ringT * 0.55; // ~-0.9°/f at centre, ~-0.35°/f at rim
    cells.push({
      kind: "line",
      cx: (x1 + x2) / 2,
      cy: (y1 + y2) / 2,
      x1, y1, x2, y2,
      strokeW: Math.max(0.9, r * 0.0045),
      color: palette[i % palette.length] ?? lightestColor(palette),
      // All blades grow outward from the hub simultaneously.
      revealOrder: 0,
      revealMode: "grow",
      birthOrigin: { x: 0, y: 0 },
      vortexSpeed,
    });
  }
  // Global wrap spin — steady whirl that continues forever after
  // the reveal finishes. Combined with the per-cell vortexSpeed the
  // outer rim drags noticeably behind the inner hub.
  const wrapAnimation: WrapAnimation = (localFrame) => {
    const f = Math.max(0, localFrame);
    const deg = f * 0.45;
    return `rotate(${deg.toFixed(2)})`;
  };
  return { cells, focal: { x: 0, y: 0 }, wrapAnimation };
};

// ─────────────────────────────────────────────────────────────────────
// 12 — WAVE STRIPES
//
// Parallel sine-wave bands. Each stripe is separated from its
// neighbours by an equal gap — the stripes never touch. Build reveal
// fans out from the centre row symmetrically (top and bottom halves
// fade in simultaneously, working outward), and the wrap animation
// adds a continuous radial ripple on top of the centre-out build.
// ─────────────────────────────────────────────────────────────────────
export const buildWaveStripes: ShapeBuilder = (seed, size, palette) => {
  void seed;
  const half = size / 2;
  const cells: Cell[] = [];
  const inkA = palette[0] ?? "#FFFFFF";
  const inkB = palette[1] ?? "#000000";
  // 9 stripes (odd → clean centre row). Each row slot = size / STRIPES;
  // the actual painted band fills GAP_FILL of that slot, leaving the
  // remainder as empty space so stripes never touch.
  const STRIPES = 9;
  const GAP_FILL = 0.55; // 55% painted, 45% gap
  const stripeH = size / STRIPES;
  // Simple parallel sine bands — every stripe shares the same phase
  // structure, no weave. Drama lives in the wrap animation + the
  // centre-out reveal, not the static geometry.
  const slotH = size / STRIPES;
  const bandH = slotH * GAP_FILL;
  const midRow = (STRIPES - 1) / 2;
  for (let r = 0; r < STRIPES; r++) {
    // Centre of each band sits on the slot midline; the gap is the
    // unpainted remainder of the slot above + below the band.
    const y = -half + (r + 0.5) * slotH;
    const color = r % 2 === 0 ? inkB : inkA;
    const steps = 96;
    const xStart = -half * 3;
    const xEnd = half * 3;
    const ampMax = slotH * 0.55;
    const wavePts: string[] = [];
    const wavelength = size;
    // Top edge L → R
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = xStart + t * (xEnd - xStart);
      const wobble =
        Math.sin((x / wavelength) * Math.PI * 2.0 + r * 0.5) * ampMax * 0.55;
      wavePts.push(
        `${x.toFixed(2)},${(y - bandH / 2 + wobble).toFixed(2)}`,
      );
    }
    // Bottom edge R → L
    for (let i = steps; i >= 0; i--) {
      const t = i / steps;
      const x = xStart + t * (xEnd - xStart);
      const wobble =
        Math.sin((x / wavelength) * Math.PI * 2.0 + r * 0.5) * ampMax * 0.55;
      wavePts.push(
        `${x.toFixed(2)},${(y + bandH / 2 + wobble).toFixed(2)}`,
      );
    }
    // Reveal order — symmetric distance from the centre row, so the
    // top half and the bottom half ripple outward in lockstep. The
    // centre row (r = midRow) reveals first at t=0; the topmost and
    // bottommost rows reveal last at t=1.
    const distFromMid = Math.abs(r - midRow);
    const maxDist = Math.max(1, midRow);
    cells.push({
      kind: "path",
      cx: 0,
      cy: y,
      d: `M ${wavePts.join(" L ")} Z`,
      color,
      revealOrder: distFromMid / maxDist,
      revealMode: "fade",
    });
  }
  // Ripple effect — the whole stripe stack pulses radially with a
  // gentle scale wave, like a stone dropped in water continuously
  // sending out concentric rings. A subtle perpendicular scale
  // counter-phase gives the surface a swimming, fluid motion that
  // reads as ripples on the wave geometry rather than translation.
  const wrapAnimation: WrapAnimation = (localFrame) => {
    const REVEAL_END = STAGGER_TOTAL + 4;
    const f = Math.max(0, localFrame - REVEAL_END);
    // Spinning ball — continuous Z-axis rotation paired with a
    // sphere-like Y-axis projection (scaleX = cos(phase)) so the
    // stripes appear to wrap around a globe spinning in place.
    // Rotation = full revolution every ~4 s; Y-projection runs
    // half-rate so the disc squashes/expands as it spins.
    const spinDeg = (f * 90) / 30; // 90°/s
    const yPhase = f * 0.08;
    const sx = Math.cos(yPhase);
    const sxClamped = sx >= 0 ? Math.max(0.18, sx) : Math.min(-0.18, sx);
    return `rotate(${spinDeg.toFixed(2)}) scale(${sxClamped.toFixed(3)} 1)`;
  };
  return { cells, focal: { x: 0, y: 0 }, wrapAnimation };
};

// ─────────────────────────────────────────────────────────────────────
// 13 — PERSPECTIVE FAN
//
// Image 22: many parallel bars fanning from a vanishing point on
// the left edge. Each bar is authored as a path whose four vertices
// form a thin rectangle starting AT the vanishing point and
// extending rightward by `length`. The cell anchor (cx, cy) is set
// to the vanishing point itself — so the renderer's scale-from-
// anchor transform makes each bar *grow* out of the vanishing point
// (length goes from 0 → full as scale 0 → 1), reading as a barrage
// of lines being shot from the focal toward the right edge. `noSpin`
// disables the renderer's per-cell rotation jitter, which would
// otherwise swing the bars around the focal during reveal.
// ─────────────────────────────────────────────────────────────────────
export const buildPerspectiveFan: ShapeBuilder = (seed, size, palette) => {
  const cells: Cell[] = [];
  const r = size / 2;
  // Vanishing point at the left edge, slightly inset so the focal
  // dots aren't clipped. Fan parameters tuned so the longest bar
  // (lengthMul ≈ 1.15) still fits inside the SIZE × SIZE viewport
  // vertically: sin(spread/2) × length × maxMul ≤ ~0.46 × SIZE.
  const vpx = -r * 0.88;
  const vpy = 0;
  const N = 64;
  // Wider fan + cleaner angular spacing so the lines spread more
  // dramatically across the canvas.
  const spread = Math.PI * 0.95; // ~170° fan — bars almost reach top/bottom
  const baseLength = size * 0.55;
  const barH = size * 0.011;
  const rand = mulberry32(seed);
  for (let i = 0; i < N; i++) {
    if (rand() < 0.18) continue;
    const t = (i + 0.5) / N;
    // Gentler jitter so bars stay close to their slot angle and the
    // fan reads as evenly distributed rather than a random cloud.
    const angleJitter = (rand() - 0.5) * (spread / N) * 1.4;
    const a = (t - 0.5) * spread + angleJitter;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    // Per-bar length variation — every bar stops at a different
    // distance so the fan's outer edge is ragged.
    const seedJitter = rand();
    const envelope = 0.5 + 0.5 * Math.sin(t * Math.PI * 1.7 + i * 0.31);
    const lengthMul = 0.45 + envelope * 0.4 + seedJitter * 0.3;
    const length = baseLength * lengthMul;
    // Perpendicular unit vector — used to give the bar its thickness.
    const px = -dy;
    const py = dx;
    const halfH = barH / 2;
    // Four corners of the bar, in order. The two LEFT corners sit
    // exactly at the vanishing point (offset by ±halfH along the
    // perpendicular), so when the renderer scales the path around
    // (vpx, vpy) the left edge stays pinned and the right edge
    // travels outward as scale goes 0 → 1.
    const x1 = vpx + px * halfH;
    const y1 = vpy + py * halfH;
    const x2 = vpx + dx * length + px * halfH;
    const y2 = vpy + dy * length + py * halfH;
    const x3 = vpx + dx * length - px * halfH;
    const y3 = vpy + dy * length - py * halfH;
    const x4 = vpx - px * halfH;
    const y4 = vpy - py * halfH;
    cells.push({
      kind: "path",
      cx: vpx,
      cy: vpy,
      d:
        `M ${x1.toFixed(2)} ${y1.toFixed(2)}` +
        ` L ${x2.toFixed(2)} ${y2.toFixed(2)}` +
        ` L ${x3.toFixed(2)} ${y3.toFixed(2)}` +
        ` L ${x4.toFixed(2)} ${y4.toFixed(2)} Z`,
      color: palette[i % palette.length] ?? lightestColor(palette),
      // All bars grow OUTWARD from the vanishing point at the same
      // time (each line extends left→right simultaneously) rather
      // than the whole fan sweeping in as a wave.
      revealOrder: 0,
      noSpin: true,
      revealMode: "grow",
      revealSpeed: 0.4,
    });
  }
  return { cells, focal: { x: vpx, y: vpy } };
};

// ─────────────────────────────────────────────────────────────────────
// 28 — CHECKER FLAG
//
// Reference: two-tone horizontal stripes that swell from a rigid
// checker on the left into big wavy undulations on the right —
// like a checkered flag fluttering in the wind. Stripes are paths
// whose top + bottom edges ride a sine wave whose amplitude grows
// linearly with x (left-pinned). The wrap animation advances the
// phase continuously, so the bumps physically travel rightward.
// ─────────────────────────────────────────────────────────────────────
export const buildCheckerFlag: ShapeBuilder = (seed, size, palette) => {
  void seed;
  const half = size / 2;
  const cells: Cell[] = [];
  const inkA = palette[0] ?? "#FFFFFF";
  const inkB = palette[1] ?? "#000000";
  const STRIPES = 9;
  const stripeH = size / STRIPES;
  const STEPS = 96;
  // Stripes built wider than the visible viewport so the wrap
  // translate-loop reads as seamless flutter.
  const xStart = -half * 1.6;
  const xEnd = half * 1.6;
  const span = xEnd - xStart;
  // Wavelength = canvas size, so the wave pattern repeats every
  // box-width and the translate-mod wrap is seamless.
  const wavelength = size;
  for (let r = 0; r < STRIPES; r++) {
    const y = -half + (r + 0.5) * stripeH;
    const color = r % 2 === 0 ? inkB : inkA;
    const wavePts: string[] = [];
    // Top edge L → R. Amplitude grows with x so the LEFT side has
    // rigid checker-like edges and the RIGHT side ripples big.
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      const x = xStart + t * span;
      const ampFrac = Math.max(0, Math.min(1, (x + half) / size));
      const amp = stripeH * 0.7 * ampFrac;
      const wobble =
        Math.sin((x / wavelength) * Math.PI * 2 + r * 0.6) * amp;
      wavePts.push(`${x.toFixed(2)},${(y - stripeH / 2 + wobble).toFixed(2)}`);
    }
    // Bottom edge R → L
    for (let i = STEPS; i >= 0; i--) {
      const t = i / STEPS;
      const x = xStart + t * span;
      const ampFrac = Math.max(0, Math.min(1, (x + half) / size));
      const amp = stripeH * 0.7 * ampFrac;
      const wobble =
        Math.sin((x / wavelength) * Math.PI * 2 + r * 0.6) * amp;
      wavePts.push(`${x.toFixed(2)},${(y + stripeH / 2 + wobble).toFixed(2)}`);
    }
    cells.push({
      kind: "path",
      cx: 0,
      cy: y,
      d: `M ${wavePts.join(" L ")} Z`,
      color,
      // Reveal sweeps top-to-bottom so the flag drops into place
      // row-by-row before the flutter takes over.
      revealOrder: r / Math.max(1, STRIPES - 1),
      revealMode: "fade",
    });
  }
  // Continuous flutter — translate the over-wide stripe stack
  // rightward, wrapping every wavelength so the wave appears to
  // ripple forever down the flag's tail.
  const wrapAnimation: WrapAnimation = (localFrame) => {
    const REVEAL_END = STAGGER_TOTAL + 4;
    const f = Math.max(0, localFrame - REVEAL_END);
    // Wavelength / second — moderate flutter speed.
    const dx = (f * (size / 60)) % size;
    return `translate(${dx.toFixed(2)} 0)`;
  };
  return { cells, focal: { x: 0, y: 0 }, wrapAnimation };
};

// ─────────────────────────────────────────────────────────────────────
// 27 — SHATTER MANDALA
//
// Reference: many many radial spokes from a slightly off-centre
// origin, each spoke broken into 3–6 segments along its length
// (alternating presence creates the concentric checker bands).
// Per-spoke length varies wildly so the outer silhouette is jagged;
// random ~14% spoke dropout opens visible wedge-shaped gaps. Every
// segment erupts from the canvas centre via "grow" mode so the
// whole mandala visibly explodes outward.
// ─────────────────────────────────────────────────────────────────────
export const buildShatterMandala: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const r = size / 2;
  const cells: Cell[] = [];
  const N = 240; // dense angular sampling
  const segW = Math.max(1.4, r * 0.009);
  for (let i = 0; i < N; i++) {
    // Open wedge-gaps — drop ~14% of spokes entirely. Some get
    // dropped in runs so the silhouette has irregular missing
    // chunks rather than evenly-spaced absences.
    if (rand() < 0.14) continue;
    const a = (i / N) * TAU + rand() * 0.004;
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    // Per-spoke reach — wildly varied so some spokes punch out
    // past the canvas edge while others barely extend.
    const reachWave =
      0.45 +
      0.45 * Math.cos(a * 2.3 + rand() * 0.6) +
      0.15 * Math.sin(a * 5.1);
    const reach = r * Math.max(0.35, Math.min(1.15, reachWave + rand() * 0.25));
    // 3–6 checker-band segments along the spoke.
    const BANDS = 3 + Math.floor(rand() * 4);
    const bandStride = reach / BANDS;
    // Parity offset per spoke — neighbouring spokes have opposite
    // band parity so the alternation forms visible concentric
    // checker rings across the disc.
    const parityOffset = i % 2;
    for (let b = 0; b < BANDS; b++) {
      // Even bands paint, odd bands are gaps (offset by spoke
      // parity) — that's what produces the concentric checker.
      if ((b + parityOffset) % 2 === 1) continue;
      // Extra random dropout per band for the irregular shatter.
      if (rand() < 0.18) continue;
      const r0 = b * bandStride;
      const segLen = bandStride * (0.7 + rand() * 0.3);
      const r1 = r0 + segLen;
      const midR = (r0 + r1) / 2;
      cells.push({
        kind: "rect",
        cx: cx * midR,
        cy: cy * midR,
        w: segW,
        h: segLen,
        rx: 0,
        rotation: (a * 180) / Math.PI + 90,
        color: palette[(i + b) % palette.length] ?? "#FFFFFF",
        // Linear centre→edge explosion: reveal order is the cell's
        // distance from the canvas centre, normalised so the very
        // innermost segments fire at t≈0 and the rim segments fire
        // at t≈1. "grow" mode is a straight-line travel from the
        // birthOrigin (the centre) to the final position with no
        // back-out overshoot — every shard moves linearly outward.
        revealOrder: Math.min(1, midR / r),
        revealMode: "grow",
        noSpin: true,
        birthOrigin: { x: 0, y: 0 },
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 25 — CHUNKY X (cohesive)
//
// Reference: single big X — four step-notched chunky arms each
// claiming one quadrant, plus a tiny pip cluster anchoring the
// centre. Arms reveal in sequence (top-left → top-right → bottom-
// left → bottom-right) via "grow" mode so the X assembles arm by
// arm; the central pips fade in last.
// ─────────────────────────────────────────────────────────────────────
export const buildChunkyX: ShapeBuilder = (seed, size, palette) => {
  void seed;
  const half = size / 2;
  const cells: Cell[] = [];
  const ink = palette[0] ?? "#FFFFFF";
  const accent = palette[1] ?? ink;
  // Arm geometry — block = ~32% canvas, notch = 42% of block.
  const block = size * 0.32;
  const notch = block * 0.42;
  const cornerR = block * 0.18;
  const ac = half * 0.55;

  const armPath = (qx: number, qy: number): string => {
    const x0 = ac - block;
    const y0 = ac - block;
    const x1 = ac;
    const y1 = ac;
    const stepInX = x1 - notch;
    const stepMidY = y1 - notch;
    const pts: Array<[number, number]> = [
      [x0 + cornerR, y0],
      [x1, y0],
      [x1, stepMidY],
      [stepInX, stepMidY],
      [stepInX, y1 - notch * 0.5],
      [stepInX - notch * 0.5, y1],
      [x0, y1],
      [x0, y0 + cornerR],
    ];
    return (
      "M " +
      pts
        .map(([px, py]) => [px * qx, py * qy])
        .map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`)
        .join(" L ") +
      " Z"
    );
  };

  const quads: Array<[number, number]> = [
    [-1, -1], [1, -1], [-1, 1], [1, 1],
  ];
  quads.forEach(([qx, qy], i) => {
    cells.push({
      kind: "path",
      cx: qx * (ac - block / 2),
      cy: qy * (ac - block / 2),
      d: armPath(qx, qy),
      color: palette[i % palette.length] ?? ink,
      revealOrder: i / 4 * 0.7,
      revealMode: "grow",
    });
  });

  // Central pip cluster — small accent-coloured pixel cluster
  // anchoring the X, fired last so the centre "lights up" after
  // the arms are in place.
  const pipS = size * 0.018;
  const pipGap = pipS * 1.9;
  for (let r = -1; r <= 1; r++) {
    for (let c = -1; c <= 1; c++) {
      cells.push({
        kind: "rect",
        cx: c * pipGap,
        cy: r * pipGap,
        w: pipS,
        h: pipS,
        rx: pipS * 0.2,
        color: accent,
        revealOrder: 0.85 + (Math.abs(r) + Math.abs(c)) * 0.04,
        revealMode: "fade",
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 24 — POLAR VORTEX
//
// Polar grid of small tangent-aligned rectangles. RINGS × CELLS_PER
// _RING cells sit at radii r_k and angles θ_i; each cell's `rotation`
// puts it tangent to its ring (looks like a curving row). Per-ring
// `vortexSpeed` differs so inner rings rotate faster than outer
// rings, producing the swirl / whirlpool seen in the video reference.
// Continuous motion lives in the per-cell vortex; no wrap animation.
// ─────────────────────────────────────────────────────────────────────
export const buildPolarVortex: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const r = size / 2;
  const cells: Cell[] = [];
  // Confetti vortex — irregular small pieces (rects with varied
  // aspect ratios + colours) scattered across a polar grid, each
  // rotating around the centre at a ring-specific speed. Looks
  // like party confetti caught in a slow whirlpool.
  // Smaller cells + fewer per ring so each confetti piece has
  // clear black space around it. Sizes capped so even the widest
  // pieces don't span an angular slot.
  const RINGS = 11;
  const CELLS_PER_RING = 22;
  const innerR = r * 0.08;
  const outerR = r * 1.0;
  const ringStep = (outerR - innerR) / RINGS;
  // Angular slot width — the arc length one cell could theoretically
  // span. We cap cell width well under this so neighbours never touch.
  for (let k = 0; k < RINGS; k++) {
    const t = k / Math.max(1, RINGS - 1);
    const ringR = innerR + (outerR - innerR) * t;
    // Alternating direction per ring + inner rings spin faster than
    // outer rings. Adjacent rings move in OPPOSITE directions so the
    // gap between them visibly shears past, reading as counter-
    // rotating gears stacked on a common axis.
    const dir = k % 2 === 0 ? 1 : -1;
    const vortexSpeed = dir * 2.2 * (1 - t * 0.75);
    const ringPhase = k * 0.21 + rand() * 0.4;
    // Max width = 60% of this ring's arc-slot, so any rotation
    // angle leaves a visible gap between adjacent cells.
    const arcSlot = (TAU * ringR) / CELLS_PER_RING;
    const maxCellLen = arcSlot * 0.6;
    const maxCellThk = ringStep * 0.55;
    for (let i = 0; i < CELLS_PER_RING; i++) {
      if (rand() < 0.48) continue;
      const a = (i / CELLS_PER_RING) * TAU + ringPhase;
      // Smaller radial jitter so cells stay near their ring centre.
      const radialJit = (rand() - 0.5) * ringStep * 0.25;
      const cx = Math.cos(a) * (ringR + radialJit);
      const cy = Math.sin(a) * (ringR + radialJit);
      // Tighter aspect range + smaller baseSize. Width / height are
      // each capped against the arc-slot / ring-step ceilings.
      const aspect = 0.6 + rand() * 0.9; // 0.6..1.5
      const sizeT = 0.5 + rand() * 0.5; // 0.5..1.0 of cap
      const w = Math.min(maxCellLen, maxCellLen * sizeT * Math.max(aspect, 1));
      const h = Math.min(maxCellThk, maxCellThk * sizeT / Math.max(aspect, 1));
      const tangentDeg = (a * 180) / Math.PI + 90;
      const rotation = tangentDeg + (rand() - 0.5) * 65;
      const colIdx = (k + i * 3 + Math.floor(rand() * 4)) % palette.length;
      cells.push({
        kind: "rect",
        cx, cy,
        w,
        h,
        rx: 0,
        rotation,
        color: palette[colIdx] ?? "#FFFFFF",
        revealOrder: t,
        revealMode: "fade",
        vortexSpeed,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 23 — CHEVRON DOTS
//
// Three stacked arrow chevrons, each made of two diagonal lines of
// circles meeting at a tip on the right. Dots taper toward the tip
// so each arrow reads as a directional vector. Reveal fires arrow
// by arrow top-to-bottom.
// ─────────────────────────────────────────────────────────────────────
export const buildChevronDots: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  // SUNRAY BURST — thin radial rays flaring OUTWARD from an
  // EMPTY centre (no disc, no corona). Rays alternate between long
  // and short to read as classic sunray geometry; each ray is a
  // tapered chain of pixel squares that grow toward the rim like
  // little flares.
  const SUN_RADIUS = size * 0.085;
  // Sunrays — many thin radial rays, alternating long/short for the
  // classic sun-icon silhouette. Rays start just outside the empty
  // centre and reach outward to the rim of the canvas.
  const RAYS = 48;
  const STEPS = 9;
  const maxR = half * 1.02;
  const angularStep = TAU / RAYS;
  const rayStart = SUN_RADIUS * 1.25;
  for (let i = 0; i < RAYS; i++) {
    const a = (i / RAYS) * TAU;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    // Alternate long / medium / short rays so the rim is a
    // classic sunray silhouette rather than a flat halo. Tiny
    // per-ray jitter so neighbours aren't identical.
    const lengthRing = i % 2 === 0 ? 1.0 : 0.62;
    const jitter = 0.92 + rand() * 0.16;
    const rayReach = lengthRing * jitter;
    const rayEnd = rayStart + (maxR - rayStart) * rayReach;
    // Colour cycles palette but every fourth ray is dark ink for
    // contrast bursts.
    const useDark = i % 5 === 0;
    const color = useDark
      ? darkestColor(palette)
      : palette[Math.floor(i / 2) % palette.length] ?? lightestColor(palette);
    for (let s = 0; s < STEPS; s++) {
      const stepT = s / (STEPS - 1);
      const dist = rayStart + (rayEnd - rayStart) * stepT;
      const px = cos * dist;
      const py = sin * dist;
      // Particles get LARGER as they head toward the rim — the
      // ray "flares" outward like a sun flare.
      const arclen = dist * angularStep;
      const wantSide = size * 0.013 * (0.55 + stepT * 2.6);
      const side = Math.min(wantSide, arclen * 0.65);
      cells.push({
        kind: "rect",
        cx: px,
        cy: py,
        w: side,
        h: side,
        rx: 0,
        color,
        // Smooth grow-in cascade — matches VORTEX_DISC_DIAGONAL: each
        // pip scales 0→1 in place over a 60% revealSpread window,
        // power3.out ease (no overshoot), staticReveal (no travel).
        revealOrder: Math.min(1, stepT * 0.6),
        revealMode: "grow",
        birthOrigin: { x: px, y: py },
        noSpin: true,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 19 — DATAMOSH
//
// VHS-glitch / data-mosh look from the reference: horizontal bands
// of zigzag-edged shards, each band horizontally displaced by a
// random offset so adjacent bands no longer line up. Each shard is
// a triangle-edged rectangle (path) — sharp sawtooth top & bottom.
// Reveal sweeps top-to-bottom one band at a time so the page reads
// as if it's been corrupted in stages.
// ─────────────────────────────────────────────────────────────────────
export const buildDatamosh: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  // Fewer bands, each more abstract: random rotation per band so
  // the bands don't all run perfectly horizontal — some tilt
  // diagonally, breaking up the stripe rhythm. Each band is split
  // into many small zigzag SEGMENTS; segments fire one after the
  // other along the band so the zigzag visibly DRAWS itself from
  // one end to the other.
  const BANDS = 6;
  const sliceH = size / BANDS;
  const cells: Cell[] = [];
  for (let s = 0; s < BANDS; s++) {
    const yMid = -half + (s + 0.5) * sliceH;
    const shift = (rand() - 0.5) * size * 0.5;
    const rotateDeg = (rand() - 0.5) * 22; // ±11° per-band tilt
    const TEETH = 14 + Math.floor(rand() * 14);
    const toothW = size / TEETH;
    const toothAmp = sliceH * (0.4 + rand() * 0.55);
    const color = palette[s % palette.length] ?? "#FFFFFF";
    const xStart = -half - size * 0.2;
    const xEnd = half + size * 0.2;
    // Build the zigzag as a chain of tiny segments (per tooth pair).
    // Each segment is a small quad bound by two adjacent zigzag
    // points on the top edge and two on the bottom edge. Segments
    // animate one by one along the band so the zigzag scans into
    // existence like a pen tracing it.
    for (let t = 0; t < TEETH * 2; t++) {
      const x0 = xStart + ((xEnd - xStart) * t) / (TEETH * 2);
      const x1 = xStart + ((xEnd - xStart) * (t + 1)) / (TEETH * 2);
      const isPeak = t % 2 === 0;
      const yT0 =
        yMid - sliceH / 2 + (isPeak ? -toothAmp * 0.5 : toothAmp * 0.5);
      const yT1 =
        yMid - sliceH / 2 + (isPeak ? toothAmp * 0.5 : -toothAmp * 0.5);
      const yB0 =
        yMid + sliceH / 2 + (isPeak ? toothAmp * 0.5 : -toothAmp * 0.5);
      const yB1 =
        yMid + sliceH / 2 + (isPeak ? -toothAmp * 0.5 : toothAmp * 0.5);
      // Apply per-band rotation + horizontal shift to each segment
      // vertex so the rotation is baked into the geometry.
      const cosR = Math.cos((rotateDeg * Math.PI) / 180);
      const sinR = Math.sin((rotateDeg * Math.PI) / 180);
      const rot = (x: number, y: number) => {
        // Rotate around band centre (0, yMid).
        const dx = x;
        const dy = y - yMid;
        return {
          x: dx * cosR - dy * sinR + shift,
          y: dx * sinR + dy * cosR + yMid,
        };
      };
      const p1 = rot(x0, yT0);
      const p2 = rot(x1, yT1);
      const p3 = rot(x1, yB1);
      const p4 = rot(x0, yB0);
      const d =
        `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} ` +
        `L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} ` +
        `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)} ` +
        `L ${p4.x.toFixed(2)} ${p4.y.toFixed(2)} Z`;
      const segColor =
        palette[(s * 3 + t) % palette.length] ?? color;
      // Sequential reveal — per-band local order + global band
      // offset so bands draw mostly in parallel but with a slight
      // top-to-bottom stagger.
      const local = t / (TEETH * 2);
      const order = s / BANDS * 0.25 + local * 0.75;
      cells.push({
        kind: "path",
        cx: (p1.x + p3.x) / 2,
        cy: (p1.y + p3.y) / 2,
        d,
        color: segColor,
        revealOrder: order,
        revealMode: "fade",
      });
    }
    void toothW;
  }
  // Continuous "glitch jitter" — small random-feeling jumps in
  // skewX so the bands appear to keep tearing apart and reforming.
  const wrapAnimation: WrapAnimation = (localFrame) => {
    const REVEAL_END = STAGGER_TOTAL + 6;
    const f = Math.max(0, localFrame - REVEAL_END);
    // Multi-frequency skew + tiny scale tremor — reads as VHS
    // tracking glitches.
    const skew = Math.sin(f * 4.5) * 3 + Math.sin(f * 12.1 + 0.7) * 1.5;
    const sx = 1 + Math.sin(f * 9.0) * 0.02;
    return `skewX(${skew.toFixed(2)}) scale(${sx.toFixed(3)} 1)`;
  };
  return { cells, focal: { x: 0, y: 0 }, wrapAnimation };
};

// ─────────────────────────────────────────────────────────────────────
// 20 — PIXEL RHOMBUS
//
// Abstract rhombus (diamond) silhouette built from a dense grid of
// small squares. A cell is painted only if it falls inside the
// rhombus mask |u| + |v| ≤ 1 (with u, v normalised to the box).
// Density / colour cycle inside; cells near the edge of the rhombus
// shrink for a structural fade. Continuous slow spin so the diamond
// rotates around its centre.
// ─────────────────────────────────────────────────────────────────────
export const buildPixelRhombus: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  // Coarser grid — bigger slots make it easier to keep every vector
  // INSIDE its own slot with clear gaps to neighbours.
  const COLS = 18;
  const ROWS = 18;
  const slotW = size / COLS;
  const slotH = size / ROWS;
  const slotMin = Math.min(slotW, slotH);
  const cells: Cell[] = [];
  // Vector-field rendering — each cell becomes a short directional
  // "vector" (a slim pill) whose rotation tracks a swirl field
  // tangent to the canvas centre. Length is HARD-CAPPED below the
  // slot size so vectors never bleed into adjacent slots, and an
  // extra dropout + soft jittered mask makes the rhombus
  // silhouette less geometric.
  const phase = rand() * TAU;
  // 70% of the slot diagonal is the longest a rotated pill can be
  // without intersecting a neighbouring slot — leaves clear gaps.
  const MAX_LEN = slotMin * 0.78;
  const MIN_LEN = slotMin * 0.40;
  // Thicker bars so each vector reads as a chunky rectangle, not a
  // hairline pill — bumped from 0.13 → 0.36 of the slot.
  const THICKNESS = slotMin * 0.36;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cellCX = -half + (col + 0.5) * slotW;
      const cellCY = -half + (row + 0.5) * slotH;
      const u = cellCX / half;
      const v = cellCY / half;
      // Soft jittered rhombus mask — add per-cell noise to the
      // boundary so the silhouette is irregular instead of a clean
      // diamond. Also push the threshold further out and randomise
      // it per cell so the rhombus reads as an emergent cluster
      // rather than an obvious geometric shape.
      const inside = Math.abs(u) + Math.abs(v);
      const maskJitter = (rand() - 0.5) * 0.35;
      if (inside + maskJitter > 1.05) continue;
      const edgeT = Math.max(0, 1 - inside / 1.05);
      // Heavier overall dropout to break up the field — even centre
      // cells get a non-trivial dropout chance so the cluster has
      // visible holes.
      const dropProb = 0.18 + (1 - edgeT) * 0.45;
      if (rand() < dropProb) continue;
      // Whirl / logarithmic spiral — vectors are mostly tangent at
      // the rim and progressively wind INWARD toward the centre,
      // tracing a swirling vortex rather than a calm tangent field.
      // Spiral pitch grows with radius so the innermost ring spins
      // tight and the outer ring opens out.
      const radialA = Math.atan2(cellCY, cellCX);
      const rNorm = Math.min(1, Math.hypot(cellCX, cellCY) / half);
      const spiralPitch = 0.85 - rNorm * 0.6;
      const angleJitter = (rand() - 0.5) * 0.35;
      const vecA =
        radialA + Math.PI / 2 - spiralPitch + phase * 0.05 + angleJitter;
      const vecDeg = (vecA * 180) / Math.PI;
      // Length stays bounded below slot — centre cells get the
      // longest vectors, but never long enough to overlap a
      // neighbour.
      const lenT = Math.pow(edgeT, 0.7);
      const length = MIN_LEN + (MAX_LEN - MIN_LEN) * lenT;
      const colIdx = (col + row * 2) % palette.length;
      const distFromCenter =
        Math.hypot(cellCX, cellCY) / Math.hypot(half, half);
      // Spiral reveal — mix radial distance with angular position so
      // the reveal wave rotates as it expands from the centre,
      // tracing a spiral outward rather than a flat radial ring.
      const angNorm = (radialA + Math.PI) / TAU; // 0..1
      const revealOrder = Math.min(1, distFromCenter * 0.6 + angNorm * 0.4);
      cells.push({
        kind: "rect",
        cx: cellCX,
        cy: cellCY,
        w: length,
        h: THICKNESS,
        rx: 0, // sharp rectangular bars — no pill ends
        rotation: vecDeg,
        color: palette[colIdx] ?? lightestColor(palette),
        revealOrder,
        // Grow from the centre so the bars stream out along the spiral.
        revealMode: "grow",
        birthOrigin: { x: 0, y: 0 },
        noSpin: true,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// 16 — MANDALA CURVES
//
// Pen-tool mandala — instead of polar wedges, each "petal" is a
// flowing cubic-Bezier teardrop drawn from the centre to the outer
// rim and back. Two overlapping rotated layers reproduce the moiré
// beat from the original interference_mandala, but the silhouette
// is all curves so the disc reads as a hand-drawn pen-tool flourish
// rather than a geometric checker. Each petal cycles through the
// team palette.
// ─────────────────────────────────────────────────────────────────────
// Bead-chain ray — each radial "petal" is a string of small filled
// circles ("beads") connected by thick rounded line bridges
// ("tubes"). Multiple rays around the centre form the mandala.
// Each ray has 3–4 beads at staggered radii so the chains carry
// visible nodes-and-bridges rhythm rather than a single solid mass.
const buildBeadChainLayer = (
  cells: Cell[],
  size: number,
  palette: string[],
  seed: number,
  rotationDeg: number,
  rays: number,
  beadsPerRay: number,
  palOffset: number,
  innerFrac: number,
  outerFrac: number,
) => {
  const r = size / 2;
  const rand = mulberry32(seed);
  const innerR = r * innerFrac;
  const outerR = r * outerFrac;
  const twistBase = (rotationDeg * Math.PI) / 180;
  // Bead radius capped against BOTH the radial spacing (so beads
  // on the same ray don't touch each other) AND the angular slot
  // at the innermost bead position (so beads on adjacent rays
  // don't touch each other at the inner end of the chain).
  const radialBeadRoom = (outerR - innerR) / (beadsPerRay * 3.8);
  const innerArcSlot = (TAU * innerR) / rays * 0.42;
  const beadR = Math.max(2, Math.min(radialBeadRoom, innerArcSlot));
  const tubeW = beadR * 0.85;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * TAU + twistBase;
    // Moderate dropout (~35%) — denser bead chain than before but
    // still with visible gaps between the surviving rays. Combined
    // with the higher ray-count (set by the caller) this produces
    // a dense pearl mandala that breathes rather than tessellates.
    if (rand() < 0.35) continue;
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    // Per-ray angular swirl — tiny offset between neighbouring
    // beads in the same ray so each chain bends slightly off its
    // radial axis (gives the "scalloped" feel from the reference).
    const swirl = (rand() - 0.5) * 0.08;
    const beadPositions: Array<{ x: number; y: number }> = [];
    for (let b = 0; b < beadsPerRay; b++) {
      const t = beadsPerRay === 1 ? 0.5 : b / (beadsPerRay - 1);
      const bR = innerR + (outerR - innerR) * t;
      const bAngle = a + swirl * (b - (beadsPerRay - 1) / 2);
      beadPositions.push({
        x: Math.cos(bAngle) * bR,
        y: Math.sin(bAngle) * bR,
      });
    }
    // Bridges between adjacent beads — rectangles aligned with the
    // bridge axis (replacing the previous line primitives so the
    // mandala reads as a chain of right-angled bars + squares).
    for (let b = 0; b < beadPositions.length - 1; b++) {
      const p0 = beadPositions[b]!;
      const p1 = beadPositions[b + 1]!;
      const color = palette[(i + b + palOffset) % palette.length] ?? "#FFFFFF";
      const mx = (p0.x + p1.x) / 2;
      const my = (p0.y + p1.y) / 2;
      const midDist = Math.hypot(mx, my);
      const bridgeLen = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const bridgeAngle =
        (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI;
      cells.push({
        kind: "rect",
        cx: mx,
        cy: my,
        w: bridgeLen,
        h: tubeW,
        rx: 0,
        rotation: bridgeAngle,
        color,
        // Radial reveal — bridges closer to the centre fire first.
        revealOrder: 0,
        revealMode: "grow",
        birthOrigin: { x: 0, y: 0 },
      });
    }
    // Beads as filled squares — drawn on top so they cap the bridge
    // ends cleanly. Square side = 2× the original bead radius.
    for (let b = 0; b < beadPositions.length; b++) {
      const p = beadPositions[b]!;
      const color = palette[(i + b + palOffset + 1) % palette.length] ?? "#FFFFFF";
      const beadDist = Math.hypot(p.x, p.y);
      const beadSide = beadR * 2;
      cells.push({
        kind: "rect",
        cx: p.x,
        cy: p.y,
        w: beadSide,
        h: beadSide,
        rx: 0,
        color,
        revealOrder: 0,
        revealMode: "grow",
        birthOrigin: { x: 0, y: 0 },
      });
    }
    void cx; void cy;
  }
};

export const buildMandalaCurves: ShapeBuilder = (seed, size, palette) => {
  const cells: Cell[] = [];
  // Three stacked rings of bead-chains at different densities +
  // tilts — denser ray counts than before (30/44/56) for a richer
  // pearl-mandala texture, while the per-ray dropout keeps natural
  // gaps. Bead-radius cap inside buildBeadChainLayer guarantees
  // no two beads ever touch even at these higher densities.
  buildBeadChainLayer(cells, size, palette, seed,        0, 30, 3, 0, 0.18, 0.96);
  buildBeadChainLayer(cells, size, palette, seed + 31, 10, 44, 4, 2, 0.06, 0.70);
  buildBeadChainLayer(cells, size, palette, seed + 67,  6, 56, 3, 5, 0.10, 0.50);
  // Slow continuous spin — the bead mandala turns hypnotically.
  const wrapAnimation: WrapAnimation = (localFrame) => {
    const REVEAL_END = STAGGER_TOTAL + 8;
    const f = Math.max(0, localFrame - REVEAL_END);
    const deg = (f / 30) * 14;
    return `rotate(${deg.toFixed(2)})`;
  };
  return { cells, focal: { x: 0, y: 0 }, wrapAnimation };
};

// ─────────────────────────────────────────────────────────────────────
// 14 — INTERFERENCE MANDALA
//
// Two overlapping radial checker fields rotated ~11° and offset in
// density — the resulting moiré beat reads as a kinetic mandala
// (port of the cellGrid `interference_mandala` personality / the
// curated `interference-mandala-01` preset). Per-cell fade reveal
// staggered ring-by-ring from centre outward.
// ─────────────────────────────────────────────────────────────────────
const buildOneRadialChecker = (
  cells: Cell[],
  size: number,
  palette: string[],
  seed: number,
  rotationDeg: number,
  wedges: number,
  rings: number,
  ringOffsetK: number,
) => {
  const r = size / 2;
  const rand = mulberry32(seed);
  // Push inner radius outward so the central rings don't crowd each
  // other — gives the inner mandala room to breathe.
  const innerR = r * 0.18;
  const twistBase = (rotationDeg * Math.PI) / 180;
  for (let k = 0; k < rings; k++) {
    const ringT = k / Math.max(1, rings - 1);
    const r0 = innerR + (r - innerR) * (k / rings);
    const r1 = innerR + (r - innerR) * ((k + 1) / rings);
    const twist = twistBase + k * 0.06;
    for (let i = 0; i < wedges; i++) {
      // Checker drop + extra ~30% random hole rate so the disc reads
      // as a perforated mandala instead of a tidy circle.
      if ((k + i) % 2 !== 0) continue;
      if (rand() < 0.32) continue;
      const a0 = (i / wedges) * TAU + twist;
      const a1 = ((i + 1) / wedges) * TAU + twist;
      // No radial jitter — wedges stay strictly within their
      // assigned (r0, r1) ring bounds so adjacent rings can't
      // overlap. Earlier ±9% jitter pushed wedges into their
      // neighbours' rings and produced visible stacking.
      const radialJit = 1;
      const aMid = (a0 + a1) / 2;
      const rMid = (r0 + r1) / 2 * radialJit;
      const colIdx = (i + k * 2 + ringOffsetK * 7 + Math.floor(rand() * 3)) %
        palette.length;
      // Spiral / clock-sweep reveal — primary order is the wedge's
      // angular position, secondary is its ring radius. So a clock
      // hand sweeps around, with inner rings filling slightly
      // before outer ones at the same angle. Builds fluidly from
      // the inside outward in a continuous spiral.
      const angularT = (aMid + Math.PI) / TAU; // 0..1 around circle
      const order = Math.min(
        1,
        ringT * 0.4 + angularT * 0.6,
      );
      cells.push({
        kind: "wedge",
        cx: Math.cos(aMid) * rMid,
        cy: Math.sin(aMid) * rMid,
        innerR: r0 * radialJit,
        outerR: r1 * radialJit,
        startA: a0,
        endA: a1,
        color: palette[colIdx] ?? "#FFFFFF",
        revealOrder: order,
        revealMode: "fade",
      });
    }
  }
};

export const buildInterferenceMandala: ShapeBuilder = (seed, size, palette) => {
  const cells: Cell[] = [];
  // Layer A — base radial checker.
  buildOneRadialChecker(cells, size, palette, seed, 0, 22, 9, 0);
  // Layer B — rotated 11°, denser (12 rings) and shifted seed so the
  // overlap creates the moiré beat that is the family's signature.
  buildOneRadialChecker(
    cells,
    size,
    palette,
    seed + 19,
    11,
    24,
    11,
    1,
  );
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────
// 31 — PIXEL BLOOM
//
// Corner-focal sunburst rendered as a field of discrete pixels.
// Rays radiate from a corner (per-seed pick); each ray is a chain
// of small squares whose size grows with radial distance from the
// focal. Colours cycle per ray through the team palette — the
// composition reads as a pixelated radial flag fan.
// ─────────────────────────────────────────────────────────────────────
export const buildPixelBloom: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  // Pick a corner focal — top-right by default biases toward the
  // reference design, but the seed can drift it to other corners.
  const cornerIdx = Math.floor(rand() * 4);
  const focalX =
    cornerIdx === 0 || cornerIdx === 2 ? half * 0.98 : -half * 0.98;
  const focalY =
    cornerIdx === 0 || cornerIdx === 1 ? -half * 0.98 : half * 0.98;
  // Angular fan that points INTO the canvas from the focal corner.
  // The mid-angle aims at the opposite corner; the fan width is a
  // bit more than 90° so rays sweep across the visible area.
  const aimX = -focalX;
  const aimY = -focalY;
  const midA = Math.atan2(aimY, aimX);
  const fanHalf = Math.PI * 0.55;
  // Dense fan — many rays packed across the angular sweep. The
  // GAP_FRAC cap on particle size scales each square to the local
  // inter-ray arclength, so even at high ray counts adjacent rays
  // never collide; they just get visually finer toward the focal.
  const RAYS = 40;
  const maxR = Math.hypot(size, size);
  const angularStepBetweenRays = (2 * fanHalf) / Math.max(1, RAYS - 1);
  // GAP_FRAC = fraction of the inter-ray arclength a particle is
  // allowed to occupy at any given radius. <1 → guaranteed gap
  // between adjacent rays.
  const GAP_FRAC = 0.6;
  for (let i = 0; i < RAYS; i++) {
    const t = i / (RAYS - 1);
    const a = midA - fanHalf + 2 * fanHalf * t;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const useDark = i % 4 === 0;
    const color = useDark
      ? darkestColor(palette)
      : palette[i % palette.length] ?? lightestColor(palette);
    const STEPS = 14;
    // No per-ray phase — every ray's innermost particle sits at
    // the same radial step (s = 2). That puts all the small inner
    // squares on a shared starting arc, so the rays visibly fan
    // out from a common anchor near the focal corner.
    for (let s = 2; s <= STEPS; s++) {
      const rNorm = s / STEPS;
      const dist = rNorm * maxR * 0.78;
      const px = focalX + cos * dist;
      const py = focalY + sin * dist;
      if (Math.abs(px) > half * 1.05 || Math.abs(py) > half * 1.05)
        continue;
      // Cap particle side to GAP_FRAC × the arclength between
      // adjacent rays at this radius — guarantees a gap between
      // every neighbouring particle no matter how close we are
      // to the focal corner.
      const arclen = dist * angularStepBetweenRays;
      const wantSide = size * 0.018 * (0.4 + rNorm * 2.0);
      const side = Math.min(wantSide, arclen * GAP_FRAC);
      cells.push({
        kind: "rect",
        cx: px,
        cy: py,
        w: side,
        h: side,
        rx: 0,
        color,
        revealOrder: Math.min(1, rNorm),
        revealMode: "grow",
        birthOrigin: { x: focalX, y: focalY },
      });
    }
  }
  return { cells, focal: { x: focalX, y: focalY } };
};

// ─────────────────────────────────────────────────────────────────────
// 34 — APEX FAN
//
// Vivid colour bands fanning DOWN from a single apex point at the
// top of the canvas, bowing outward to fill a tall triangular
// silhouette by the time they reach the bottom edge. Each band is
// a chain of small horizontal rectangles whose width grows along
// the band, so the band reads as a tapered ribbon flaring from a
// hairline at the apex to a chunky slab at the base. A handful of
// accent bars cross the fan horizontally for the colour-block hits
// seen in the reference.
// ─────────────────────────────────────────────────────────────────────
export const buildApexFan: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  // Apex sits near the top of the canvas; bands flare down + out.
  const apexX = 0;
  const apexY = -half * 0.95;
  const baseY = half * 1.0;
  const totalH = baseY - apexY;
  // Number of bands fanning across the spread. Bands are evenly
  // distributed so the fan reads as an ordered ribbon stack.
  const BANDS = 18;
  // Half-angle of the fan in normalised x at the base — bands at the
  // edges land near ±BASE_HALF * half on the bottom edge.
  const BASE_HALF = 0.82;
  // Steps per band — small horizontal rects stacked down the band.
  const STEPS = 22;
  for (let i = 0; i < BANDS; i++) {
    // u ∈ [-1, +1] across the bands; ±1 lands at the rim of the fan.
    const u = BANDS === 1 ? 0 : (i / (BANDS - 1)) * 2 - 1;
    // Final x at the base for this band.
    const baseX = u * BASE_HALF * half;
    const color = palette[i % palette.length] ?? "#FFFFFF";
    for (let s = 1; s <= STEPS; s++) {
      // t ∈ [0..1] along the band — 0 at apex, 1 at base.
      const t = s / STEPS;
      // Outward bow: bands spread slowly near the apex, faster as
      // they descend, giving the silhouette its taper.
      const xT = Math.pow(t, 1.4);
      const px = apexX + (baseX - apexX) * xT;
      const py = apexY + totalH * t;
      // Slab width grows with t so the band fans from a hairline
      // at the apex into a chunky bar at the base.
      const w = (size * 0.012 + size * 0.060 * t);
      const h = (totalH / STEPS) * 0.85;
      cells.push({
        kind: "rect",
        cx: px,
        cy: py,
        w,
        h,
        rx: 0,
        color,
        // Reveal radiates from the apex outward along each band.
        revealOrder: Math.min(1, t),
        revealMode: "grow",
        birthOrigin: { x: apexX, y: apexY },
      });
    }
  }
  // Accent horizontal bars crossing the fan at a few heights — the
  // bright colour-block hits in the reference. Every accent is
  // snapped to a CHOSEN BAND so it always sits on the fan silhouette;
  // its width spans at most two neighbouring bands so it never floats
  // out into the empty corners.
  const ACCENTS = 7;
  for (let a = 0; a < ACCENTS; a++) {
    // Place accents in the upper-to-mid section of the fan.
    const t = 0.22 + (a / Math.max(1, ACCENTS - 1)) * 0.50;
    const cy = apexY + totalH * t;
    // Pick a band index for this accent, biased toward inner bands.
    const bandIdx = Math.floor(rand() * BANDS);
    const u = BANDS === 1 ? 0 : (bandIdx / (BANDS - 1)) * 2 - 1;
    const baseX = u * BASE_HALF * half;
    const xT = Math.pow(t, 1.4);
    const accentCX = apexX + (baseX - apexX) * xT;
    // Accent half-width = the angular distance between adjacent
    // bands at this t, times a small multiplier (≤ 2 bands wide).
    const bandSpacing =
      (BASE_HALF * half * 2) / Math.max(1, BANDS - 1) * xT;
    const accentW = bandSpacing * (1.0 + rand() * 1.1);
    const accentH = size * (0.018 + rand() * 0.012);
    const color = palette[(a * 2 + 1) % palette.length] ?? "#FFFFFF";
    cells.push({
      kind: "rect",
      cx: accentCX,
      cy,
      w: accentW,
      h: accentH,
      rx: 0,
      color,
      revealOrder: Math.min(1, t + 0.03),
      revealMode: "fade",
      birthOrigin: { x: apexX, y: apexY },
    });
  }
  return { cells, focal: { x: apexX, y: apexY } };
};

// ─────────────────────────────────────────────────────────────────────
// 36 — BURST SEGMENTS
//
// Full 360° sunburst where each spoke is a chain of segment chunks
// of varied lengths and palette colours. The composition reads as
// a chromatic explosion radiating from a central focal — every
// spoke fans the same length but its segments paint at different
// radii so the rings of "ink" never align across spokes, giving
// the field its glitchy stained-glass texture.
// ─────────────────────────────────────────────────────────────────────
export const buildBurstSegments: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const r = size / 2;
  const cells: Cell[] = [];
  // Per-seed focal jitter — slight offset from canvas centre so
  // the burst feels organic rather than ruler-perfect.
  const focalX = (rand() - 0.5) * size * 0.06;
  const focalY = (rand() - 0.5) * size * 0.06;
  // No pre-shake — the explosion fires as soon as the reveal opens,
  // then ripples outward as a radial wave.
  const EXPLODE_WINDOW = 0.9;
  // Cohesion-tuned sampling. Fewer spokes + tighter angular jitter
  // pull the cloud into a clearer radial silhouette; one palette
  // colour per spoke (not per segment) ties each ray together.
  const SPOKES = 56;
  // Per-spoke inner / outer reach.
  const INNER = size * 0.025;
  const OUTER = size * 0.99;
  const angularStep = TAU / SPOKES;
  const SEG_COUNT = 9;
  for (let i = 0; i < SPOKES; i++) {
    // Reduced angular jitter — keeps spokes recognisably radial
    // without locking them into a pinwheel grid.
    const a = (i / SPOKES) * TAU + (rand() - 0.5) * angularStep * 0.18;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    // Smaller per-spoke length variance — every spoke now reaches
    // at least 85% of OUTER, so the silhouette closes into a disc
    // instead of feeling moth-eaten.
    const reach = INNER + (OUTER - INNER) * (0.85 + rand() * 0.15);
    // Segment-length weights — keep some variance so the ring
    // breaks across spokes never align.
    const weights: number[] = [];
    let weightSum = 0;
    for (let s = 0; s < SEG_COUNT; s++) {
      const wgt = 0.6 + rand() * 1.2;
      weights.push(wgt);
      weightSum += wgt;
    }
    // One colour per spoke — every segment along the ray paints in
    // the same palette slot, so each spoke reads as one continuous
    // chromatic stroke instead of a confetti chain.
    const spokeColor = palette[i % palette.length] ?? "#FFFFFF";

    let rPrev = INNER;
    for (let s = 0; s < SEG_COUNT; s++) {
      const segLen = (weights[s] / weightSum) * (reach - INNER);
      const r0 = rPrev;
      const r1 = r0 + segLen;
      rPrev = r1;
      // Slightly lower gap probability — fewer breaks per spoke
      // makes each ray feel like a coherent stroke.
      if (rand() < 0.18) continue;
      const mid = (r0 + r1) / 2;
      const arclen = mid * angularStep;
      const tNorm = mid / OUTER;
      const wantThk = size * 0.006 + size * 0.022 * tNorm;
      const thickness = Math.min(wantThk, arclen * 0.7);
      const segDraw = segLen * 0.86;
      // Radial wave reveal — inner segments fire first, then the
      // explosion propagates outward. Tiny per-spoke phase keeps
      // adjacent spokes from peaking in lockstep.
      const spokePhase = (i / SPOKES) * 0.06;
      const revealOrder =
        (tNorm * EXPLODE_WINDOW) + spokePhase + rand() * 0.03;
      cells.push({
        kind: "rect",
        cx: focalX + cos * mid,
        cy: focalY + sin * mid,
        w: thickness,
        h: segDraw,
        rx: 0,
        rotation: (a * 180) / Math.PI + 90,
        color: spokeColor,
        // Staggered explosion — each segment fires at its own delay
        // along the SHAKE_NORM → 1.0 window, producing a real wave.
        revealOrder: Math.min(1, revealOrder),
        revealMode: "grow",
        noSpin: true,
        birthOrigin: { x: focalX, y: focalY },
      });
    }
  }
  return { cells, focal: { x: focalX, y: focalY } };
};

// ─────────────────────────────────────────────────────────────────────
// 37 — VORTEX DISC
//
// Op-art spherical checker — polar grid of diamond cells projected
// onto a disc silhouette, with an asymmetric swirl that twists the
// lower hemisphere into a vortex. Rings compress toward the rim
// (sin curve = sphere projection) so cells naturally pinch into
// diamond shapes at the silhouette. Each cell paints in dark ink or
// the palette accent on classic (ring + wedge) parity so the field
// reads as a chunky black/white Vasarely checker.
// ─────────────────────────────────────────────────────────────────────
// ── Parameterised core ─────────────────────────────────────────────
// Knobs every vortex-disc variant can tune. Adding a new variant =
// one entry in the variants block below.
export type VortexDiscParams = {
  rings?: number;
  wedges?: number;
  swirlTurns?: number;
  // Direction the swirl twists toward (radians from +x axis).
  swirlCenter?: number;
  // How aggressively the rings compress at the rim (sin-curve power).
  ringCompress?: number;
  innerRFrac?: number;
  outerRFrac?: number;
  // SVG transform string applied as wrapAnimation. The "camera angle"
  // each variant uses to look at the disc.
  wrap?: string;
  // Continuous rotation in deg/sec (positive = CW). 0 = no spin.
  spinDegPerSec?: number;
  // Per-cell reveal mode. "fade" = pop in place. "burst" = back-out
  // scale + travel from focal. "grow" = smooth scale from anchor.
  revealMode?: "fade" | "burst" | "grow";
  // Stretch revealOrder across [0, revealSpread] instead of [0, 1].
  // Useful when you want the cascade to finish before the stagger
  // window ends. 1 = full window.
  revealSpread?: number;
  // When true and revealMode is burst/grow, each cell's birthOrigin
  // is pinned to its own position so the animation only scales (no
  // x/y travel). Cells stay put; only the staggered scale-in plays.
  staticReveal?: boolean;
  // Optional per-cell drop predicate. Return true to skip the cell.
  // Used by abstract variants to chop chunks off the disc.
  dropMask?: (cellCX: number, cellCY: number, ringIdx: number, wedgeIdx: number) => boolean;
};

const VORTEX_DISC_DEFAULTS: Required<VortexDiscParams> = {
  rings: 18,
  wedges: 40,
  swirlTurns: 1.35,
  swirlCenter: Math.PI * 0.55,
  ringCompress: 1.0,
  innerRFrac: 0.03,
  outerRFrac: 0.99,
  wrap: "scale(1.05 0.55) rotate(-12)",
  spinDegPerSec: 0,
  revealMode: "fade",
  revealSpread: 1,
  staticReveal: false,
  dropMask: () => false,
};

const buildVortexDiscWithParams = (
  _seed: number,
  size: number,
  palette: string[],
  params: VortexDiscParams = {},
) => {
  const p = { ...VORTEX_DISC_DEFAULTS, ...params };
  const r = size / 2;
  const cells: Cell[] = [];
  const inkDark = darkestColor(palette);
  const innerR = r * p.innerRFrac;
  const outerR = r * p.outerRFrac;
  for (let k = 0; k < p.rings; k++) {
    const tIn = Math.sin((k / p.rings) * (Math.PI / 2)) ** p.ringCompress;
    const tOut = Math.sin(((k + 1) / p.rings) * (Math.PI / 2)) ** p.ringCompress;
    const r0 = innerR + (outerR - innerR) * tIn;
    const r1 = innerR + (outerR - innerR) * tOut;
    const rMid = (r0 + r1) / 2;
    const ringT = k / Math.max(1, p.rings - 1);
    for (let i = 0; i < p.wedges; i++) {
      const aBase = (i / p.wedges) * TAU;
      const facingDot = Math.cos(aBase - p.swirlCenter);
      const mask = Math.max(0, facingDot);
      const twist = p.swirlTurns * TAU * Math.pow(ringT, 1.8) * mask * 0.55;
      const a0 = aBase + twist;
      const a1 = ((i + 1) / p.wedges) * TAU + twist;
      const aMid = (a0 + a1) / 2;
      const isInk = (k + i) % 2 === 0;
      const accentIdx = (k * 3 + i * 5) % palette.length;
      const color = isInk ? inkDark : palette[accentIdx] ?? lightestColor(palette);
      const cellCX = Math.cos(aMid) * rMid;
      const cellCY = Math.sin(aMid) * rMid;
      // Optional drop — abstract variants chop chunks out of the disc.
      if (p.dropMask(cellCX, cellCY, k, i)) continue;
      cells.push({
        kind: "wedge",
        cx: cellCX,
        cy: cellCY,
        innerR: r0,
        outerR: r1,
        startA: a0,
        endA: a1,
        color,
        // Centre-out cascade — inner ring fires first, outer last.
        // revealSpread squeezes the cascade into a tighter window
        // when the variant wants a snappier reveal.
        revealOrder: Math.min(1, ringT * p.revealSpread),
        revealMode: p.revealMode,
        // Reveal origin behaviour:
        // - fade: pop in place, no birthOrigin needed.
        // - burst/grow + staticReveal: birth at the cell's own
        //   position so dx/dy = 0 → scale only, no translation.
        // - burst/grow + !staticReveal: birth at focal (0,0) so the
        //   cell flies from the centre to its final spot.
        ...(p.revealMode === "fade"
          ? {}
          : {
              birthOrigin: p.staticReveal
                ? { x: cellCX, y: cellCY }
                : { x: 0, y: 0 },
              noSpin: true,
            }),
      });
    }
  }
  // Compose wrap: static camera transform + optional continuous spin.
  // Spin happens BEFORE the camera so the disc rotates inside the
  // tilted frame instead of orbiting around the screen centre.
  const wrap = (localFrame: number) => {
    const spin =
      p.spinDegPerSec === 0
        ? ""
        : ` rotate(${((localFrame / 30) * p.spinDegPerSec).toFixed(2)})`;
    return `${p.wrap}${spin}`;
  };
  return {
    cells,
    focal: { x: 0, y: 0 },
    wrapAnimation: wrap,
  };
};

// ── Variants ───────────────────────────────────────────────────────
// Each one is a thin wrapper. Add a new entry here + register in
// SHAPE_BUILDERS / SHAPE_FAMILIES and the variant is live.
export const buildVortexDisc: ShapeBuilder = (seed, size, palette) =>
  buildVortexDiscWithParams(seed, size, palette);

export const buildVortexDiscDiagonal: ShapeBuilder = (seed, size, palette) =>
  buildVortexDiscWithParams(seed, size, palette, {
    wrap: "rotate(45) scale(1.05 0.32)",
    // Smooth grow-in cascade — wedges scale 0→1 in place over the
    // stagger window with power3.out ease (no overshoot, no travel).
    // revealSpread spreads the cascade across most of the window so
    // the disc fills in gradually instead of bumping in all at once.
    revealMode: "grow",
    revealSpread: 0.6,
    staticReveal: true,
    // Abstract top — drop most cells whose original cy < 0 (the
    // upper hemisphere of the original disc, which becomes the
    // upper portion of the rotated ellipse). Uses deterministic
    // noise from cell position so the dropout pattern is stable.
    dropMask: (cx, cy) => {
      if (cy >= 0) return false;
      const h = Math.abs(Math.sin(cx * 12.9898 + cy * 78.233) * 43758.5453);
      const noise = h - Math.floor(h);
      const upDepth = Math.min(1, -cy / (size / 2));
      return noise < 0.25 + upDepth * 0.55;
    },
  });

// Dense, no swirl — even checker disc viewed straight-on.
export const buildVortexDiscFlat: ShapeBuilder = (seed, size, palette) =>
  buildVortexDiscWithParams(seed, size, palette, {
    rings: 14,
    wedges: 32,
    swirlTurns: 0,
    wrap: "rotate(0)",
    // Keep the checker structure but clip each ring to a different
    // arc sweep — full circle, semicircle, half, third — so the disc
    // reads as nested concentric arcs instead of a solid wheel. Each
    // arc is centred at the top (-90°).
    dropMask: (cx, cy, k) => {
      const sweeps = [
        TAU, // full
        Math.PI, // semicircle (180°)
        TAU / 3, // third (120°)
        Math.PI, // semicircle
        TAU * 0.66, // ~two-thirds
        Math.PI * 0.5, // quarter (90°)
      ];
      let sweep = sweeps[k % sweeps.length]!;
      // Never let the outer rings (k ≥ 11, with rings=14) close into
      // a full circle — the outermost band that "wraps it all" must
      // stay an open arc.
      if (k >= 11 && sweep >= TAU) sweep = TAU * 0.72;
      if (sweep >= TAU) return false; // inner full ring — keep all
      let d = Math.atan2(cy, cx) - -Math.PI / 2; // centre arc at top
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      return Math.abs(d) > sweep / 2; // drop cells outside the arc
    },
  });

// Wide-edge view spinning slowly — the disc looks like a turning coin.
export const buildVortexDiscSpinner: ShapeBuilder = (seed, size, palette) =>
  buildVortexDiscWithParams(seed, size, palette, {
    swirlTurns: 0.6,
    wrap: "scale(0.9 0.45)",
    spinDegPerSec: 18,
  });

// ─────────────────────────────────────────────────────────────────────
// 32 — LENS MANDALA
//
// A recursive mandala built entirely from overlapping circles. Each
// level is a single solid disc with 8 dark "lens" circles overlapping
// its perimeter (which read as crescent bites on the gold disc), and
// 8 small gold pips sitting inside those dark lenses. The same motif
// recurses inward at SCALE per step, producing the nested kaleidoscope
// from the reference. No boolean operations or masks needed — the
// stacking order alone carves the negative shapes.
//
// Reveal cascades from the innermost level outward so the mandala
// blooms from its centre eye instead of collapsing inward.
// ─────────────────────────────────────────────────────────────────────
export const buildLensMandala: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const cells: Cell[] = [];
  const r = size / 2;
  // Cyclone-eye mandala — five spiral arms of tangent-aligned tiles
  // winding outward from the centre, continuously rotating to read
  // as a hurricane / typhoon swirl from above. Two-tone braid per
  // arm; each arm pulls a different secondary palette slot so every
  // team colour gets used across the rotation.

  const ARMS = 5;
  const CELLS_PER_ARM = 36;
  const eyeR = r * 0.04;
  const maxR = r * 0.96;
  const TWIST = 1.6 * Math.PI;
  const armJitter = 0.08;

  const colorA = palette[0] ?? "#FFFFFF";
  const colorB = palette[palette.length - 1] ?? "#000000";

  for (let arm = 0; arm < ARMS; arm++) {
    const armBase = (arm / ARMS) * TAU + (rand() - 0.5) * armJitter;
    // Each arm's secondary colour cycles through the palette so
    // adjacent arms can't share the same accent.
    const armSecondary = palette[(arm + 1) % palette.length] ?? colorB;
    for (let i = 0; i < CELLS_PER_ARM; i++) {
      const t = i / (CELLS_PER_ARM - 1);
      const radial = Math.pow(t, 0.85);
      const radius = eyeR + (maxR - eyeR) * radial;
      const angle = armBase + radial * TWIST;
      const cx = Math.cos(angle) * radius;
      const cy = Math.sin(angle) * radius;
      const tileLen = r * (0.022 + radial * 0.05);
      const tileThick = r * (0.012 + radial * 0.018);
      const rot = ((angle + Math.PI / 2) * 180) / Math.PI;
      const color = i % 2 === 0 ? colorA : armSecondary;
      const vSpeed = 0.45 + (1 - radial) * 0.4;

      cells.push({
        kind: "rect",
        cx,
        cy,
        w: tileLen,
        h: tileThick,
        rx: 0,
        rotation: rot,
        color,
        revealOrder: Math.min(1, radial),
        revealMode: "burst",
        birthOrigin: { x: 0, y: 0 },
        noSpin: true,
        vortexSpeed: vSpeed,
      });
    }
  }

  return {
    cells,
    focal: { x: 0, y: 0 },
    wrapAnimation: (localFrame) => `rotate(${(localFrame / 30) * -6})`,
  };
};

// ─────────────────────────────────────────────────────────────────────
// 35 — CORNER ARCS
//
// Stepped concentric arcs radiating from an off-canvas corner focal,
// modelled on the Paper "Vibrant purple pattern" references (291-0,
// 28Y-0). Distance from the focal is bucketed into ring indices; each
// grid cell takes alternating palette slots per ring so the bands
// read as chunky two-tone arcs sweeping across the field with
// natural stair-step quantisation at the grid resolution.
// Reveal cascades outward from the corner so the arcs "rake" across
// the canvas instead of fading in uniformly.
// ─────────────────────────────────────────────────────────────────────
export const buildCornerArcs: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const cells: Cell[] = [];
  // Radar-sweep spiral — corner focal feeds a logarithmic spiral
  // pattern instead of concentric rings, so cells sit on swirling
  // arms emanating from the corner. Whole shape rotates around the
  // focal point for a radar-sweep feel.
  const cornerIdx = Math.floor(rand() * 4);
  const corners = [
    { x: -1, y: -1 },
    { x:  1, y: -1 },
    { x: -1, y:  1 },
    { x:  1, y:  1 },
  ] as const;
  const corner = corners[cornerIdx]!;
  const half = size / 2;
  const focal = { x: corner.x * half * 1.02, y: corner.y * half * 1.02 };

  const COLS = 36;
  const ROWS = 36;
  const slotW = size / COLS;
  const slotH = size / ROWS;
  // Logarithmic spiral tightness — higher = more tightly wound arms.
  const LOG_K = 1.25;
  // Number of palette buckets sampled by the spiral. Higher = thinner
  // arms; we cycle the full team palette so every team colour shows.
  const ARM_DIVS = palette.length * 2;
  const maxR = Math.hypot(size * 1.05, size * 1.05);

  // Clip the radar sweep into a bounded sector emanating from the
  // focal corner so the arc's edges are visible. Inner and outer
  // radii bound the band along the radial direction; a wide angular
  // spread bounds it across the canvas.
  const SECTOR_MID = Math.atan2(-focal.y, -focal.x);
  const SECTOR_HALF_SPREAD = (Math.PI / 180) * 55;
  const ARC_INNER = size * 0.22;
  const ARC_OUTER = size * 1.48;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cellCX = -half + (col + 0.5) * slotW;
      const cellCY = -half + (row + 0.5) * slotH;
      const dx = cellCX - focal.x;
      const dy = cellCY - focal.y;
      const r = Math.hypot(dx, dy);
      if (r < ARC_INNER || r > ARC_OUTER) continue;
      // Angular clip — cells outside the sector are dropped so the
      // sweep has clean straight edges where the wedge bounds end.
      let dAngle = Math.atan2(dy, dx) - SECTOR_MID;
      while (dAngle >  Math.PI) dAngle -= 2 * Math.PI;
      while (dAngle < -Math.PI) dAngle += 2 * Math.PI;
      if (Math.abs(dAngle) > SECTOR_HALF_SPREAD) continue;
      const theta = Math.atan2(dy, dx);
      // Spiral parameter — cells on the same arm share this value.
      const spiral = (theta + LOG_K * Math.log(r + 1)) / Math.PI;
      const bucket =
        ((Math.floor(spiral * ARM_DIVS) % palette.length) + palette.length) %
        palette.length;
      const color = palette[bucket] ?? "#FFFFFF";

      cells.push({
        kind: "rect",
        cx: cellCX,
        cy: cellCY,
        w: slotW,
        h: slotH,
        rx: 0,
        color,
        revealOrder: Math.min(1, r / maxR),
        revealMode: "fade",
      });
    }
  }
  return {
    cells,
    focal,
    // Radar-sweep rotation around the focal corner — slow continuous
    // spin so the arms appear to sweep across the canvas.
    wrapAnimation: (localFrame) =>
      `rotate(${(localFrame / 30) * 5} ${focal.x} ${focal.y})`,
  };
};

// ─────────────────────────────────────────────────────────────────────
// 36 — SCANLINE RIBBON
//
// Procedural ribbon built from many parallel "strip" lanes following
// a smooth S-shaped spline. Each strip is broken into short
// rectangular dashes that simulate stroke-dasharray on a curved path;
// the dashes shorten and the lanes compress as a per-position
// "twist" phase rotates the ribbon edge-on, then stretch back out
// when it tilts face-on — producing the pseudo-3D ribbon flip seen
// in op-art broadcast graphics. A subtle continuous wrap animation
// oscillates the whole field so the ribbon reads as kinetic.
// ─────────────────────────────────────────────────────────────────────
export const buildScanlineRibbon: ShapeBuilder = (seed, size, palette) => {
  void seed;
  const cells: Cell[] = [];
  const half = size / 2;

  // Clean, non-overlapping lemniscate ribbon. The previous version
  // packed dashes too tight (adjacent dashes overlapped at tight
  // curves) and rotated the whole shape via wrapAnimation. This
  // version uses fewer samples, shorter dashes pegged to the local
  // sample spacing, and zero whole-shape rotation.
  const SAMPLES = 96;
  const STRIPS = 4;
  const baseWidth = size * 0.16;

  // Infinity-shaped ribbon — the centreline traces a Bernoulli
  // lemniscate. u walks 0 → 2π once for a single ∞ traversal.
  const lemR = half * 1.18;
  const TWIST_CYCLES = 3.0;

  const pathAt = (u: number) => {
    const s = Math.sin(u);
    const c = Math.cos(u);
    const denom = 1 + s * s;
    return { x: (lemR * c) / denom, y: (lemR * s * c) / denom };
  };

  for (let i = 0; i < SAMPLES; i++) {
    const t = i / (SAMPLES - 1);
    const u = t * Math.PI * 2;
    const p = pathAt(u);
    const cx = p.x;
    const cy = p.y;

    const eps = 0.001;
    const p2 = pathAt(u + eps);
    const dx = (p2.x - p.x) / eps;
    const dy = (p2.y - p.y) / eps;
    const tlen = Math.hypot(dx, dy) || 1;
    const tnx = dx / tlen;
    const tny = dy / tlen;
    // Local arc-length step between samples (units of SVG px). Use
    // it to clamp the dash so each dash never reaches into its
    // neighbour's slot — guarantees no overlap.
    const stride = tlen * (Math.PI * 2) / SAMPLES;

    const pnx = -tny;
    const pny = tnx;

    const twist = u * (TWIST_CYCLES / 2);
    const flat = Math.abs(Math.cos(twist));
    const visWidth = baseWidth * (0.20 + flat * 0.80);
    // Dash length is a strict fraction of the inter-sample stride,
    // so each dash sits inside its own slot with a small gap.
    const dashLen = stride * (0.42 + flat * 0.36);
    // Strip thickness also clamps to a fraction of the lane spacing
    // so neighbouring strips never collide perpendicular to the path.
    const laneSpacing = visWidth / Math.max(1, STRIPS - 1);
    const stripThick = Math.min(baseWidth * 0.08, laneSpacing * 0.55);
    const angleDeg = (Math.atan2(tny, tnx) * 180) / Math.PI;

    // Cycle every dash through the full palette so all team colours
    // get used across the ribbon length.
    const colorIdx = i % palette.length;
    const dashColor = palette[colorIdx] ?? "#FFFFFF";

    for (let k = 0; k < STRIPS; k++) {
      const lane = STRIPS > 1 ? (k - (STRIPS - 1) / 2) / (STRIPS - 1) : 0;
      const offset = lane * visWidth;
      // Brick stagger — alternate dashes between adjacent strips.
      const stagger = k % 2;
      if ((i + stagger) % 2 !== 0) continue;

      const dashCX = cx + pnx * offset;
      const dashCY = cy + pny * offset;
      // Reveal from the centre outward — cells nearest the origin
      // fire first; both lobes draw away from the centre in sync
      // (right side goes rightward, left side goes leftward).
      const distFromCenter = Math.hypot(dashCX, dashCY);
      // Centre fires first, then BOTH lobes draw outward (right and
      // left simultaneously). Tight 0.35 window so it's quick.
      const revealOrder = Math.min(1, (distFromCenter / lemR) * 0.35);
      cells.push({
        kind: "rect",
        cx: dashCX,
        cy: dashCY,
        w: dashLen,
        h: stripThick,
        rx: 0,
        rotation: angleDeg,
        color: dashColor,
        revealOrder,
        revealMode: "fade",
      });
    }
  }

  return {
    cells,
    focal: { x: 0, y: 0 },
    // No whole-shape rotation — total shape angle stays at 0°. The
    // dashes themselves still align with their local tangent.
  };
};

// ─────────────────────────────────────────────────────────────────────
// 37 — RIPPLE ARCS
//
// Sibling to CORNER_ARCS but with the band ratio inverted — thin
// cutout stripes spaced apart over a wide main field, modelled on
// the Paper "Vibrant purple pattern" (lower-left focal, sparse black
// arcs over purple). Cell colour is decided by where each cell sits
// inside its ring's normalised cycle: only the first ~22% of every
// ring paints the cutout colour, the rest stays main, so the arcs
// read as ripples instead of equal-width bands.
// ─────────────────────────────────────────────────────────────────────
export const buildRippleArcs: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const cells: Cell[] = [];
  // Same four-corner roll as CORNER_ARCS so cards vary which corner
  // the arcs ripple out of.
  const cornerIdx = Math.floor(rand() * 4);
  const corners = [
    { x: -1, y: -1 },
    { x:  1, y: -1 },
    { x: -1, y:  1 },
    { x:  1, y:  1 },
  ] as const;
  const corner = corners[cornerIdx]!;
  const half = size / 2;
  const focal = { x: corner.x * half * 1.02, y: corner.y * half * 1.02 };

  const COLS = 40;
  const ROWS = 40;
  const slotW = size / COLS;
  const slotH = size / ROWS;
  // Wider rings so each visible band has clear breathing room
  // between it and the next stripe.
  const RING_WIDTH = size * 0.095;
  // Stripe occupies enough of each ring (~42%) that, after grid
  // quantisation, every band is at least one full cell thick — the
  // arcs read as continuous curves instead of broken pixels.
  const STRIPE_FRAC = 0.42;
  const maxR = Math.hypot(size * 1.05, size * 1.05);

  // Per-band palette pair so all team colours show across the three
  // arcs — each band picks a main + stripe slot two steps apart in
  // the palette, wrapping if necessary.
  const bandColors = (bandIdx: number) => ({
    main: palette[(bandIdx * 2) % palette.length] ?? "#FFFFFF",
    stripe: palette[(bandIdx * 2 + 1) % palette.length] ?? "#000000",
  });

  // Clip the arcs to THREE concentric annular bands centred on the
  // focal corner. Each band is a curved arc slice; the gaps between
  // bands are negative space, so the silhouette reads as three
  // discrete arcs nested around the focal instead of one big sector.
  const ARC_MID = Math.atan2(-focal.y, -focal.x);
  const ARC_HALF_SPREAD = (Math.PI / 180) * 55;
  const ARC_BANDS: Array<{ inner: number; outer: number }> = [
    { inner: size * 0.30, outer: size * 0.55 },
    { inner: size * 0.74, outer: size * 0.98 },
    { inner: size * 1.16, outer: size * 1.42 },
  ];

  const inArc = (px: number, py: number): boolean => {
    const dxA = px - focal.x;
    const dyA = py - focal.y;
    const rA = Math.hypot(dxA, dyA);
    let dAngle = Math.atan2(dyA, dxA) - ARC_MID;
    while (dAngle >  Math.PI) dAngle -= 2 * Math.PI;
    while (dAngle < -Math.PI) dAngle += 2 * Math.PI;
    if (Math.abs(dAngle) > ARC_HALF_SPREAD) return false;
    // Cell renders only if it falls inside one of the three bands.
    return ARC_BANDS.some((b) => rA >= b.inner && rA <= b.outer);
  };

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cellCX = -half + (col + 0.5) * slotW;
      const cellCY = -half + (row + 0.5) * slotH;
      // Only cells inside the arc band emit — outside, the dark
      // canvas reads as the surrounding shape.
      if (!inArc(cellCX, cellCY)) continue;
      const dx = cellCX - focal.x;
      const dy = cellCY - focal.y;
      const r = Math.hypot(dx, dy);
      // Identify which of the 3 bands this cell sits in so each
      // band can pick its own palette pair.
      const bandIdx = ARC_BANDS.findIndex((b) => r >= b.inner && r <= b.outer);
      const { main, stripe } = bandColors(bandIdx);
      // Normalised position within the current ring (0 = ring start,
      // 1 = ring end). Cells whose phase is below STRIPE_FRAC paint
      // the cutout colour — that's the thin arc band.
      const ringPhase = (r / RING_WIDTH) % 1;
      const isStripe = ringPhase < STRIPE_FRAC;
      const color = isStripe ? stripe : main;

      cells.push({
        kind: "rect",
        cx: cellCX,
        cy: cellCY,
        w: slotW,
        h: slotH,
        rx: 0,
        color,
        revealOrder: Math.min(1, r / maxR),
        revealMode: "fade",
      });
    }
  }
  return { cells, focal };
};

// ─────────────────────────────────────────────────────────────────────
// 41 — POLAR SWIRL
//
// Polar checker grid with a progressive inward swirl — modelled on
// the Paper "Black and white checkered pattern" reference. RINGS ×
// WEDGES wedges paint in alternating ink / palette-cycled accent;
// inner rings carry more angular twist than outer rings so the whole
// disc spirals tightly into its centre. Continuous slow rotation
// adds the kinetic register the reference implies. Every palette
// slot gets used because the accent index cycles per cell.
// ─────────────────────────────────────────────────────────────────────
export const buildPolarSwirl: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const r = size / 2;
  const cells: Cell[] = [];
  const RINGS = 14;
  const WEDGES = 32;
  const innerR = r * 0.035;
  const outerR = r * 0.99;
  const inkDark = darkestColor(palette);
  const SWIRL = TAU * 0.9;
  // Base hole probability — a big chunk of wedges are dropped so the
  // disc reads as scattered fragments rather than a solid checker.
  // Drops climb toward the rim so the silhouette dissolves outward.
  const BASE_DROP = 0.42;

  for (let k = 0; k < RINGS; k++) {
    const tIn = k / RINGS;
    const tOut = (k + 1) / RINGS;
    const r0 = innerR + (outerR - innerR) * tIn;
    const r1 = innerR + (outerR - innerR) * tOut;
    const rMid = (r0 + r1) / 2;
    const ringT = k / Math.max(1, RINGS - 1);
    const twist = SWIRL * Math.pow(1 - ringT, 1.6);
    // Drop probability rises with radius — centre stays denser, the
    // outer rings get punched full of holes so the disc loses its
    // clean circular edge.
    const dropProb = BASE_DROP + ringT * 0.4;
    for (let i = 0; i < WEDGES; i++) {
      // Random hole — skip this wedge entirely.
      if (rand() < dropProb) continue;
      const a0 = (i / WEDGES) * TAU + twist;
      const a1 = ((i + 1) / WEDGES) * TAU + twist;
      const aMid = (a0 + a1) / 2;
      const isInk = (k + i) % 2 === 0;
      const accentIdx = (k * 3 + i * 5) % palette.length;
      const color = isInk ? inkDark : palette[accentIdx] ?? lightestColor(palette);
      cells.push({
        kind: "wedge",
        cx: Math.cos(aMid) * rMid,
        cy: Math.sin(aMid) * rMid,
        innerR: r0,
        outerR: r1,
        startA: a0,
        endA: a1,
        color,
        revealOrder: Math.min(1, ringT),
        revealMode: "fade",
      });
    }
  }
  return {
    cells,
    focal: { x: 0, y: 0 },
    wrapAnimation: (localFrame) => `rotate(${(localFrame / 30) * 4})`,
  };
};

// ─────────────────────────────────────────────────────────────────────
// Registry — used by the showcase to iterate families.
// ─────────────────────────────────────────────────────────────────────
export const SHAPE_BUILDERS: Record<ShapeFamily, ShapeBuilder> = {
  pixel_plus: buildPixelPlus,
  color_dial: buildColorDial,
  thin_spokes: buildThinSpokes,
  halftone_arc: buildHalftoneArc,
  fragmented_burst: buildFragmentedBurst,
  warped_checker: buildWarpedChecker,
  diagonal_taper: buildDiagonalTaper,
  crown_dial: buildCrownDial,
  perspective_fan: buildPerspectiveFan,
  interference_mandala: buildInterferenceMandala,
  mandala_curves: buildMandalaCurves,
  pixel_rhombus: buildPixelRhombus,
  chevron_dots: buildChevronDots,
  polar_vortex: buildPolarVortex,
  shatter_mandala: buildShatterMandala,
  pixel_bloom: buildPixelBloom,
  apex_fan: buildApexFan,
  burst_segments: buildBurstSegments,
  vortex_disc: buildVortexDisc,
  vortex_disc_diagonal: buildVortexDiscDiagonal,
  vortex_disc_flat: buildVortexDiscFlat,
  vortex_disc_spinner: buildVortexDiscSpinner,
  lens_mandala: buildLensMandala,
  corner_arcs: buildCornerArcs,
  scanline_ribbon: buildScanlineRibbon,
  ripple_arcs: buildRippleArcs,
  polar_swirl: buildPolarSwirl,
};

export const SHAPE_FAMILIES: ShapeFamily[] = [
  "pixel_plus",
  "color_dial",
  "thin_spokes",
  "halftone_arc",
  "fragmented_burst",
  "warped_checker",
  "diagonal_taper",
  "crown_dial",
  "perspective_fan",
  "interference_mandala",
  "mandala_curves",
  "pixel_rhombus",
  "chevron_dots",
  "polar_vortex",
  "shatter_mandala",
  "pixel_bloom",
  "apex_fan",
  "burst_segments",
  "vortex_disc",
  "vortex_disc_diagonal",
  "vortex_disc_flat",
  "vortex_disc_spinner",
  "lens_mandala",
  "corner_arcs",
  "scanline_ribbon",
  "ripple_arcs",
  "polar_swirl",
];

// ─────────────────────────────────────────────────────────────────────
// Per-render variation — applied on top of any built shape so the
// SAME family renders differently from match to match (and goal to
// goal). Two deterministic-from-seed axes:
//   1. Particle amount — drop a fraction of cells so each render has
//      a different density (fewer / more inner shapes).
//   2. Rotation amount — a continuous spin rate (deg/sec, CW or CCW,
//      sometimes zero) the caller applies to the shape group as a
//      function of the current frame.
// Camera tilt/squash intentionally removed — shapes keep their own
// composition; only their density + spin vary.
// ─────────────────────────────────────────────────────────────────────
export type ShapeVariation = {
  cells: Cell[];
  // Continuous rotation rate in degrees/second. The caller multiplies
  // this by (localFrame / 30) to get the current rotation angle.
  spinDegPerSec: number;
};

export const applyShapeVariation = (
  built: { cells: Cell[]; focal: { x: number; y: number } },
  variationSeed: number,
): ShapeVariation => {
  const rand = mulberry32(variationSeed >>> 0);
  // Particle amount — drop 0–40% of cells uniformly so the shape's
  // density differs between renders.
  const cutAmount = rand() * 0.4;
  const cells = built.cells.filter(() => rand() > cutAmount);

  // Rotation amount — random continuous spin. ~30% of renders stay
  // still (rate near 0); the rest spin slowly in either direction.
  const spinRoll = rand();
  const spinDegPerSec =
    spinRoll < 0.3 ? 0 : (rand() - 0.5) * 24; // ±12°/s

  return { cells, spinDegPerSec };
};

// ─────────────────────────────────────────────────────────────────────
// ShapeRenderer — mirrors the StaticPreview eruption animation: every
// cell scales in from the shape's focal point with back-out easing,
// staggered by its distance from the focal (or by an explicit
// revealOrder when the builder supplies one).
//
// Timing constants intentionally match the StaticPreview / cellGrid
// pipeline so the showcase feels like the gallery.
// ─────────────────────────────────────────────────────────────────────
const STAGGER_TOTAL = 70;
const PER_CELL = 24;
const REVEAL_S = 3.4; // back-out overshoot factor

// Build the d-attribute for a donut-sector (wedge) path.
const wedgePath = (
  innerR: number,
  outerR: number,
  startA: number,
  endA: number,
): string => {
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

// Render the per-cell primitive (rect/circle/line/wedge/path) at
// its final position with NO reveal transform — GSAP is going to
// animate the parent <g>'s transform live, so we paint each cell
// once and let the timeline handle motion. Any intrinsic per-cell
// rotation (e.g. pixel_rhombus's 45° spin) is baked into the
// primitive itself here.
const renderCellPrimitive = (cell: Cell): React.ReactElement => {
  switch (cell.kind) {
    case "rect": {
      const inner = cell.rotation !== undefined
        ? `rotate(${cell.rotation} ${cell.cx} ${cell.cy})`
        : undefined;
      // Default to softly-rounded corners on every rect (≈18% of the
      // short side) when the builder didn't request its own rx.
      // Builders that explicitly set rx (including rx: 0) keep
      // their choice.
      const minDim = Math.min(cell.w, cell.h);
      const defaultRx = minDim * 0.18;
      const rx = cell.rx !== undefined ? cell.rx : defaultRx;
      return (
        <rect
          x={cell.cx - cell.w / 2}
          y={cell.cy - cell.h / 2}
          width={cell.w}
          height={cell.h}
          rx={rx}
          fill={cell.color}
          transform={inner}
        />
      );
    }
    case "circle":
      return (
        <circle cx={cell.cx} cy={cell.cy} r={cell.r} fill={cell.color} />
      );
    case "line":
      return (
        <line
          x1={cell.x1}
          y1={cell.y1}
          x2={cell.x2}
          y2={cell.y2}
          stroke={cell.color}
          strokeWidth={cell.strokeW}
          strokeLinecap="butt"
        />
      );
    case "wedge":
      return (
        <path
          d={wedgePath(cell.innerR, cell.outerR, cell.startA, cell.endA)}
          fill={cell.color}
        />
      );
    case "path":
      return <path d={cell.d} fill={cell.color} />;
  }
};

const STAGGER_SEC = STAGGER_TOTAL / 30;
const PER_CELL_SEC = PER_CELL / 30;
const FADE_PER_CELL_SEC = 8 / 30;

export type RevealOverrides = {
  // Total stagger window across all cells (seconds). Default = 70/30.
  staggerSec?: number;
  // Per-cell tween duration (seconds). Default depends on mode.
  cellDurationSec?: number;
  // Force a single ease for all cells (overrides per-mode default).
  ease?: string;
  // Force a single revealMode for all cells.
  forceMode?: "burst" | "fade" | "grow";
  // Where the stagger starts from — "start" (revealOrder), "random",
  // "center" (smallest revealOrder = first), "edges" (highest first).
  staggerFrom?: "start" | "random" | "center" | "edges";
};

export const ShapeRenderer: React.FC<{
  cells: Cell[];
  focal: { x: number; y: number };
  localFrame: number;
  wrapAnimation?: WrapAnimation;
  // Incrementing this prop re-triggers the per-cell stagger
  // timeline. ShapeCard bumps it on every replay click.
  playToken?: number;
  // When false, the per-cell reveal does NOT auto-fire on mount —
  // cells render at their final state and only animate once playToken
  // is bumped (e.g. a click). Lets a grid of cards stay static until
  // the user interacts, saving the cost of every card animating on
  // page load. Defaults to true (original behaviour).
  autoPlay?: boolean;
  // Optional overrides for the playground / live-editor surface.
  revealOverrides?: RevealOverrides;
  // Subtle post-reveal breathing scale. OFF by default — the
  // showcase/playground surfaces stay static after the eruption.
  // Game-card surfaces (StaticPreviewV3, gallery-v2, match-focus-v3)
  // opt in so each goal feels alive once it's landed.
  breathing?: boolean;
}> = ({ cells, focal, localFrame, wrapAnimation, playToken = 0, revealOverrides, breathing = false, autoPlay = true }) => {
  const wrapT = wrapAnimation ? wrapAnimation(localFrame) : "";
  // One ref per cell — outer = vortex wrapper (rotates around shape
  // origin), inner = reveal wrapper (scales / translates around the
  // cell's own centre). Both can run independent GSAP tweens.
  const vortexRefs = useRef<Array<SVGGElement | null>>([]);
  const revealRefs = useRef<Array<SVGGElement | null>>([]);

  useEffect(() => {
    // Skip the auto-reveal on mount when autoPlay is off — cells stay
    // at their natural final state until playToken is bumped.
    if (!autoPlay && playToken === 0) return;
    const tweens: gsap.core.Tween[] = [];
    const overrideStagger = revealOverrides?.staggerSec;
    const overrideDuration = revealOverrides?.cellDurationSec;
    const overrideEase = revealOverrides?.ease;
    const overrideMode = revealOverrides?.forceMode;
    const staggerFrom = revealOverrides?.staggerFrom ?? "start";
    // Pre-compute the max distance from shape origin so the
    // "center" / "edges" stagger ratios are correctly normalised
    // even on shapes whose cells extend past the bounding box.
    let sharedMaxRadius = 1;
    for (const c of cells) {
      const d = Math.hypot(c.cx, c.cy);
      if (d > sharedMaxRadius) sharedMaxRadius = d;
    }
    cells.forEach((cell, i) => {
      const revealEl = revealRefs.current[i];
      const vortexEl = vortexRefs.current[i];
      if (!revealEl) return;
      const mode = overrideMode ?? cell.revealMode ?? "burst";
      const speed = cell.revealSpeed ?? 1;
      const baseDuration =
        overrideDuration ??
        ((mode === "fade" ? FADE_PER_CELL_SEC : PER_CELL_SEC) / speed);
      const perCellSec = baseDuration;
      // Compute the cell's slot ratio along the stagger window.
      const rawRatio =
        cell.revealOrder !== undefined
          ? Math.max(0, Math.min(1, cell.revealOrder))
          : 0;
      // staggerFrom selects WHERE the reveal radiates from:
      //   "start"  — use the cell's per-shape revealOrder (default)
      //   "center" — radial distance from shape origin (0, 0)
      //   "edges"  — inverse of center (corners first)
      //   "random" — deterministic per-index pseudo-random
      // For "center" / "edges" we explicitly compute the cell's
      // distance from the shape origin (where the renderer is
      // positioned), so the override is consistent across every
      // shape regardless of its internal revealOrder logic.
      let ratio: number;
      if (staggerFrom === "center" || staggerFrom === "edges") {
        // Use cached maxRadius computed once per render.
        const dist = Math.hypot(cell.cx, cell.cy);
        const norm = Math.min(1, dist / Math.max(1, sharedMaxRadius));
        ratio = staggerFrom === "edges" ? 1 - norm : norm;
      } else if (staggerFrom === "random") {
        ratio = Math.abs(Math.sin(i * 9.301));
      } else {
        ratio = rawRatio;
      }
      const totalStagger = overrideStagger ?? STAGGER_SEC;
      const delaySec = ratio * Math.max(0.05, totalStagger - perCellSec);
      const originX = cell.birthOrigin?.x ?? focal.x;
      const originY = cell.birthOrigin?.y ?? focal.y;
      const dx = cell.cx - originX;
      const dy = cell.cy - originY;
      const spinSign = i % 2 === 0 ? 1 : -1;
      const initialSpin =
        mode === "burst" && !cell.noSpin ? 28 * spinSign : 0;
      const ease =
        overrideEase ??
        (mode === "burst"
          ? "back.out(3.4)"
          : mode === "grow"
          ? "power3.out"
          : "power2.out");
      // For "fade" cells we skip the eruption travel — they pop in
      // place. Burst + grow erupt from focal toward (cx, cy).
      const travelFromX = mode === "fade" ? 0 : -dx;
      const travelFromY = mode === "fade" ? 0 : -dy;
      gsap.set(revealEl, {
        transformOrigin: `${cell.cx}px ${cell.cy}px`,
      });
      const tween = gsap.fromTo(
        revealEl,
        {
          x: travelFromX,
          y: travelFromY,
          scale: 0,
          rotation: initialSpin,
        },
        {
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
          duration: perCellSec,
          delay: delaySec,
          ease,
        },
      );
      tweens.push(tween);
      // Ripple — continuous scale yoyo around the cell's own
      // centre. Cell's ripplePhase shifts when in the cycle it
      // peaks, so phase-staggered cells produce a traveling wave
      // (e.g. inner rings phase 0, outer rings phase 1 → wave
      // moves outward through the rings forever).
      if (cell.ripplePeriodSec && cell.ripplePeriodSec > 0) {
        const period = cell.ripplePeriodSec;
        const phase = (cell.ripplePhase ?? 0) * period;
        const amp = cell.rippleAmp ?? 0.35;
        const up = period * 0.22;
        const down = period * 0.22;
        const rest = Math.max(0, period - up - down);
        const ripple = gsap.timeline({
          repeat: -1,
          delay: delaySec + perCellSec + phase,
        });
        ripple.to(revealEl, {
          scale: 1 + amp,
          duration: up,
          ease: "sine.out",
        });
        ripple.to(revealEl, {
          scale: 1,
          duration: down,
          ease: "sine.in",
        });
        if (rest > 0) ripple.to({}, { duration: rest });
        // gsap.timeline doesn't return a Tween, but we still want
        // to kill it on cleanup — push the timeline cast as Tween-
        // compatible (kill() exists on both).
        tweens.push(ripple as unknown as gsap.core.Tween);
      }
      // Vortex — continuous spin around shape origin (0, 0). Kicks
      // in after the cell's reveal completes.
      if (cell.vortexSpeed && vortexEl) {
        const vortexDegPerSec = cell.vortexSpeed * 30;
        const vortexDuration = 360 / Math.max(1, Math.abs(vortexDegPerSec));
        gsap.set(vortexEl, { svgOrigin: "0 0", rotation: 0 });
        const vortex = gsap.to(vortexEl, {
          rotation: cell.vortexSpeed > 0 ? "+=360" : "-=360",
          duration: vortexDuration,
          ease: "none",
          repeat: -1,
          delay: delaySec + perCellSec,
        });
        tweens.push(vortex);
      }
    });
    return () => {
      tweens.forEach((t) => t.kill());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playToken, revealOverrides]);
  // ↑ Intentionally NOT depending on cells / focal. Some callers
  // (gallery-v2, match-focus-v3) recompute the renderedGoals memo on
  // every frame tick because they pass a fresh `familyForGoal`
  // closure each render — that produces a NEW cells reference even
  // though the content is identical. If we keyed the effect on the
  // reference, GSAP would kill + recreate the timeline 60×/sec and
  // no animation would ever finish (the symptom: shapes only visible
  // after the rAF stops at END_FRAME). playToken is stable per goal
  // and bumps on explicit replay, which is exactly what we want.

  // Breathing — once the staggered reveal completes (~ STAGGER_TOTAL
  // + PER_CELL frames), the whole shape gently scales between
  // ~0.985 and ~1.015 on a slow sine. Reads as the composition
  // "breathing" rather than freezing dead after the eruption. Only
  // applied when the caller opts in via the `breathing` prop — the
  // shape-showcase / playground surfaces stay still.
  const REVEAL_END_F = STAGGER_TOTAL + PER_CELL;
  const breathT = Math.max(0, localFrame - REVEAL_END_F);
  const ramp = Math.min(1, breathT / 24); // ease in over ~0.8s
  const breathScale = breathing
    ? 1 + Math.sin(breathT * 0.08) * 0.015 * ramp
    : 1;
  const breathTransform = breathing
    ? `scale(${breathScale.toFixed(4)})`
    : undefined;
  // Compose breath outside the wrapAnimation transform so per-shape
  // wrap motion (spin, rotation, tilt) is untouched.
  return (
    <g transform={breathTransform}>
      <g transform={wrapT || undefined}>
        {cells.map((cell, i) => (
          <g
            key={i}
            ref={(el) => {
              vortexRefs.current[i] = el;
            }}
          >
            <g
              ref={(el) => {
                revealRefs.current[i] = el;
              }}
            >
              {renderCellPrimitive(cell)}
            </g>
          </g>
        ))}
      </g>
    </g>
  );
};
