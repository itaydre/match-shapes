// @refresh reset
// ↑ This module exports non-component values (shape builders, the
// renderer, the registry array). Mixing those with the inline
// ShapeRenderer component confuses React Fast Refresh and frequently
// leaves the page blank after an edit. Forcing a clean reset is
// cheap (just re-runs the build functions) and eliminates the
// instability.

import React, { useEffect, useLayoutEffect, useRef } from "react";

// Run the reveal setup before the browser paints so GSAP's `from`
// state (scale:0) is applied synchronously on mount. With a plain
// useEffect the cells paint once at their final state before the
// effect resets them — that one-frame flash of the fully-formed
// shape is the "shapes appear fully then animate" bug. useLayoutEffect
// runs after DOM mutation but before paint. Fall back to useEffect in
// any non-DOM (SSR) context to avoid the React warning.
const useRevealLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
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

// ── Nested concentric-arc silhouette (shape #15 / vortex_disc_flat) ──
// Shape #15's defining "whole shape": the radius is split into bands,
// and each band only survives within a top-centred arc whose angular
// sweep cycles full-circle → semicircle → third → … . Stacking those
// bands gives the nested-arc silhouette instead of a full 360° disc.
//
// Radial shapes (bursts, spokes) call this per cell to inherit that
// silhouette while keeping their own line/segment design: pass the
// cell's offset from the shape centre (dx, dy) and the shape's outer
// radius. Returns true when the cell falls outside its band's arc and
// should be dropped.
const NESTED_ARC_SWEEPS = [
  TAU, // full
  Math.PI, // semicircle
  TAU / 3, // third
  Math.PI, // semicircle
  TAU * 0.66, // ~two-thirds
  Math.PI * 0.5, // quarter
];
// `centerA` = the direction the arcs open toward (radians from +x).
// `sweepShift` rotates the band→sweep mapping so each shape pairs a
// different sweep with each radial band. Together they make every
// version's nested-arc silhouette point a different way and break in
// different bands, so the four bursts stop looking alike.
const nestedArcDrop = (
  dx: number,
  dy: number,
  maxR: number,
  centerA = -Math.PI / 2,
  sweepShift = 0,
): boolean => {
  const rNorm = Math.min(0.999, Math.hypot(dx, dy) / maxR);
  const k = Math.floor(rNorm * 14); // mirror #15's 14 rings
  let sweep = NESTED_ARC_SWEEPS[(k + sweepShift) % NESTED_ARC_SWEEPS.length]!;
  if (k >= 11 && sweep >= TAU) sweep = TAU * 0.72; // tighten the rim band
  if (sweep < TAU) {
    let d = Math.atan2(dy, dx) - centerA; // centre the arc on centerA
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    if (Math.abs(d) > sweep / 2) return true;
  }
  return false;
};

export type ShapeFamily =
  | "color_dial"
  | "thin_spokes"
  | "halftone_arc"
  | "fragmented_burst"
  | "warped_checker"
  | "wedges"
  | "radial_checker"
  | "sphere_grid"
  | "interference_mandala"
  | "chevron_dots"
  | "shatter_mandala"
  | "pixel_bloom"
  | "burst_segments"
  | "vortex_disc"
  | "vortex_disc_diagonal"
  | "vortex_disc_flat"
  | "vortex_disc_spinner"
  | "polar_swirl"
  | "swirl_checker"
  | "signal_fan"
  | "shard_vortex"
  | "collapsed_quadrant"
  | "primary_sunburst"
  | "checker_spiral"
  | "ring_spiral"
  | "checker_tunnel"
  | "radial_burst"
  | "pixel_swirl"
  | "solar_flare"
  | "tactical_scan"
  | "spiral_tunnel"
  | "chip_storm"
  | "perspective_fan"
  | "ripple_dots"
  | "fine_rays"
  | "beam_projection"
  | "concentric_rings"
  | "arc_cluster"
  | "arc_ripple"
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
    // Heavy non-symmetrical dropout — lots of missing outer wedges.
    if (rand() < 0.5) continue;
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
      // Punch lots of irregular holes through the inner rings too —
      // ~45% dropped, seeded so the gaps scatter asymmetrically.
      if (rand() < 0.45) continue;
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
  const N = 140;
  const cells: Cell[] = [];
  const step = TAU / N;
  for (let i = 0; i < N; i++) {
    // WILD angular chaos — jitter up to ±2.3 steps so spokes clump into
    // dense knots and tear open big gaps; the fan reads frantic.
    const a = (i / N) * TAU + (rand() - 0.5) * step * 4.6;
    // Drop some spokes for gaps/holes (less whole).
    if (rand() < 0.08) continue;
    // Extreme length spread — tiny stubs next to full-rim spikes, no
    // two neighbours matching.
    const lenFactor =
      rand() < 0.2
        ? 0.88 + rand() * 0.12
        : 0.1 + Math.pow(rand(), 1.6) * 0.92;
    const len = (r - innerR) * lenFactor;
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    const x1 = cx * innerR;
    const y1 = cy * innerR;
    const x2 = cx * (innerR + len);
    const y2 = cy * (innerR + len);
    // Adopt shape #15's nested-arc silhouette: a spoke survives only
    // if its outer tip lands inside the top-centred arc for the band
    // its length reaches — short spokes fill wide arcs, long spokes
    // are confined to the narrow rim arcs. The wheel becomes a fan.
    // Arcs open UP (top), bands unshifted.
    if (nestedArcDrop(x2, y2, r, -Math.PI / 2, 0)) continue;
    const color = palette[i % palette.length] ?? lightestColor(palette);
    const endDist = Math.hypot(x2, y2);
    // Reveal cascade mirrors VORTEX_DISC_DIAGONAL: smooth grow-in
    // Radial-distance reveal (same as PIN_BURST) — spokes ripple out
    // from the hub, near ones first, rim ones last.
    const revealOrder = Math.min(1, endDist / r);
    cells.push({
      kind: "line",
      // Anchor the cell at the origin (hub) so the GSAP scale pivots
      // there and the line grows along its length from centre to rim.
      cx: 0,
      cy: 0,
      x1, y1, x2, y2,
      // Wider stroke spread (thin hairlines next to bold rays) so the
      // weight is uneven across the fan, not one uniform gauge. Short
      // (inner-only) spokes get a bold-weight boost so the centre packs
      // real mass instead of reading as a thin pinwheel.
      strokeW:
        size *
        (0.0035 + Math.pow(rand(), 1.6) * 0.012) *
        (1 + (1 - lenFactor) * 1.6),
      color,
      revealOrder,
      // Smooth grow from the hub (power3.out, NO overshoot) — spokes
      // start as tiny stubs at (0,0) and extend straight to their
      // final length without overshooting and snapping back.
      revealMode: "grow",
      revealSpeed: 1.3,
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
  const RINGS = 14; // denser
  const innerR = r * 0.04; // pull rings into the centre — fill the middle
  // Crescent opening — drop dashes whose angle falls inside this wedge.
  const dropStart = -Math.PI * 0.45;
  const dropEnd = Math.PI * 0.25;
  for (let k = 0; k < RINGS; k++) {
    const t = k / (RINGS - 1);
    const ringR = innerR + (r - innerR) * (0.05 + 0.94 * Math.pow(t, 1.7));
    // ~half the prior dot count per ring, so adjacent dots have a
    // full diameter of black space between them at every radius.
    const dots = Math.max(24, Math.round(34 + t * 30));
    const dotR = Math.max(2.4, r * 0.024 * (1 - t * 0.5));
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
  const SPOKES = 124;
  const angularStep = TAU / SPOKES;
  const INNER_SEGMENTS = 6;  // inner solid bar split into N segments for reveal
  const OUTER_SEGMENTS = 7;  // outer fragmented chain
  const baseSpokeW = Math.max(1.2, r * 0.012);
  for (let i = 0; i < SPOKES; i++) {
    // Uneven angular spacing — push each spoke off its slot by up to
    // ±1.4 steps so rays bunch and gap instead of forming a perfect
    // even sunburst. Breaks the wheel symmetry the layout had.
    const a = (i / SPOKES) * TAU + (rand() - 0.5) * angularStep * 3.8;
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    const color = palette[i % palette.length] ?? "#FFFFFF";
    // WILD per-spoke width + reach — hairline rays beside heavy slabs,
    // each with its own outer cut-off, so the disc and rim churn.
    const spokeW = baseSpokeW * (0.3 + Math.pow(rand(), 1.6) * 2.4);
    // Inner solid bar reaches further out and is drawn with a heavier
    // width than the outer fragments, so the core carries real mass
    // and the spoke reads bold near the centre.
    const SOLID_REACH = r * (0.4 + rand() * 0.3);
    const FRAG_REACH = r * (0.8 + rand() * 0.3);
    const innerSpokeW = spokeW * 2.5;
    // Inner solid bar — broken into INNER_SEGMENTS contiguous pieces
    // (zero-gap) so each carries its own reveal time. Visually the
    // bar reads continuous; behaviourally it draws segment-by-
    // segment from the very centre outward.
    const innerStride = SOLID_REACH / INNER_SEGMENTS;
    for (let s = 0; s < INNER_SEGMENTS; s++) {
      const r0 = s * innerStride;
      const r1 = r0 + innerStride;
      const mid = (r0 + r1) / 2;
      // Nested-arc silhouette (#15): drop the segment if its radial
      // band's top-centred arc doesn't reach this angle.
      if (nestedArcDrop(cx * mid, cy * mid, r, Math.PI * 0.62, 2)) continue;
      cells.push({
        kind: "rect",
        cx: cx * mid,
        cy: cy * mid,
        w: innerSpokeW,
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
      if (nestedArcDrop(cx * mid, cy * mid, r, Math.PI * 0.62, 2)) continue;
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
      // CHEVRON DOTS-style reveal — wedges grow out from the origin
      // (0,0), ordered by ring index so the field radiates from the
      // centre outward with no spin and no overshoot.
      revealOrder: Math.min(1, (k / Math.max(1, RINGS - 1)) * 0.6),
      revealMode: "grow",
      birthOrigin: { x: 0, y: 0 },
      noSpin: true,
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
// 9 — DIAGONAL TAPER (diagonal flare)
//
// A flare bursting along the diagonal — streaks fan out in a cone
// from an apex in the upper-left toward the lower-right. Each ray is
// a chain of short slashes oriented along its own direction; slashes
// grow longer and the field thins (more holes) toward the wide end,
// so it reads as a flame / lens-flare cone rather than a solid wedge.
// ─────────────────────────────────────────────────────────────────────
export const buildDiagonalTaper: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];

  // Apex in the upper-left; the flare opens toward the lower-right.
  const apex = { x: -half * 0.78, y: -half * 0.78 };
  const RAYS = 30;
  // Cone centred on the down-right diagonal (45° = π/4 in SVG coords),
  // opening ±CONE_HALF.
  const coneCenter = Math.PI / 4;
  const CONE_HALF = 0.62; // ~36° each side
  const STEPS = 12;
  const apexGap = size * 0.04;
  const maxReach = Math.hypot(size, size) * 0.98;

  for (let ray = 0; ray < RAYS; ray++) {
    const rt = RAYS === 1 ? 0.5 : ray / (RAYS - 1); // 0..1 across fan
    // Slight per-ray angular jitter so the flare isn't a clean fan.
    const a =
      coneCenter + (rt - 0.5) * 2 * CONE_HALF + (rand() - 0.5) * 0.04;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    // Per-ray reach flicker — some streaks shoot far, some stop short.
    const reach = maxReach * (0.5 + rand() * 0.5);
    const rotDeg = (a * 180) / Math.PI;
    // Each ray cycles a single palette colour for a coherent streak.
    const rayColor = palette[ray % palette.length] ?? lightestColor(palette);
    for (let s = 0; s < STEPS; s++) {
      const st = s / (STEPS - 1); // 0 at apex → 1 at tip
      const dist = apexGap + (reach - apexGap) * st;
      const px = apex.x + cos * dist;
      const py = apex.y + sin * dist;
      if (
        px < -half * 1.05 || px > half * 1.05 ||
        py < -half * 1.05 || py > half * 1.05
      ) continue;
      // Holes increase toward the wide end so the flare dissolves
      // outward instead of staying a solid cone.
      if (rand() < 0.12 + st * 0.45) continue;
      // Slashes lengthen toward the tip — the flare "stretches" out.
      const slashLen = size * (0.018 + st * 0.05);
      const slashThick = size * 0.013;
      cells.push({
        kind: "rect",
        cx: px,
        cy: py,
        w: slashLen,
        h: slashThick,
        rx: 0,
        rotation: rotDeg, // aligned with the ray direction
        color: rayColor,
        // Reveal streams outward from the apex.
        revealOrder: Math.min(1, 0.05 + st * 0.85),
        revealMode: "grow",
        birthOrigin: { x: apex.x, y: apex.y },
        noSpin: true,
      });
    }
  }
  return { cells, focal: { x: apex.x, y: apex.y } };
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
    cells.push({
      kind: "line",
      // Anchor at the hub (0,0) — same as THIN_SPOKES — so the
      // svgOrigin scale pivot is the centre and every blade grows
      // outward from the hub.
      cx: 0,
      cy: 0,
      x1, y1, x2, y2,
      strokeW: Math.max(0.9, r * 0.0045),
      color: palette[i % palette.length] ?? lightestColor(palette),
      // THIN SPOKES animation — centre-out grow cascade (near blades
      // first, rim last), smooth grow from the hub with no whirl/spin.
      revealOrder: Math.min(1, ringT),
      revealMode: "grow",
      revealSpeed: 1.3,
      birthOrigin: { x: 0, y: 0 },
      noSpin: true,
    });
  }
  return { cells, focal: { x: 0, y: 0 } };
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
        // Centre-out fade reveal, same cascade as VORTEX DISC.
        revealOrder: t,
        revealMode: "fade",
      });
    }
  }
  // Animate like VORTEX DISC — a tilted-camera disc that spins as one
  // body inside its frame, rather than per-ring counter-rotating cells.
  const wrapAnimation: WrapAnimation = (localFrame) =>
    `scale(1.05 0.55) rotate(-12) rotate(${((localFrame / 30) * 18).toFixed(2)})`;
  return { cells, focal: { x: 0, y: 0 }, wrapAnimation };
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
  // No empty centre — rays start right at the origin (0,0) so the
  // sunburst converges to a point with no inner circle.
  const RAYS = 48;
  const STEPS = 9;
  const maxR = half * 1.02;
  const angularStep = TAU / RAYS;
  const rayStart = 0;
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
        // Pips stream out FROM the centre (0,0) — grow cascade ordered
        // by radial step so each ray draws from the hub outward.
        revealOrder: Math.min(1, stepT * 0.6),
        revealMode: "grow",
        birthOrigin: { x: 0, y: 0 },
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
      // Stronger winding — higher pitch leans the vectors further off
      // the tangent so the field reads as a tight spiral / vortex.
      const spiralPitch = 1.45 - rNorm * 0.55;
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
        // Radial ripple from (0,0) — bridges closer to the centre
        // erupt first, the wave explodes outward to the rim.
        revealOrder: Math.min(1, midDist / outerR),
        revealMode: "grow",
        birthOrigin: { x: 0, y: 0 },
        noSpin: true,
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
        revealOrder: Math.min(1, beadDist / outerR),
        revealMode: "grow",
        birthOrigin: { x: 0, y: 0 },
        noSpin: true,
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
      void aMid;
      // Pure radial reveal — order by ring distance only so the
      // mandala ripples straight out from the centre (0,0) to the
      // edges. Cells grow/erupt from the origin.
      const order = Math.min(1, ringT);
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
        revealMode: "grow",
        birthOrigin: { x: 0, y: 0 },
        noSpin: true,
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
    for (let s = 1; s <= STEPS; s++) {
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
  const SPOKES = 82;
  // Per-spoke inner / outer reach.
  const INNER = size * 0.025;
  // Inset reach so the burst keeps clear padding inside the card
  // (was size*0.99, which overflowed the card edges).
  const OUTER = size * 0.5;
  const angularStep = TAU / SPOKES;
  const SEG_COUNT = 9;
  for (let i = 0; i < SPOKES; i++) {
    // Looser angular jitter — spokes wander up to ±0.55 of a step so
    // adjacent rays bunch and split apart, dropping the pinwheel
    // regularity for an abstract, hand-flung spread.
    const a = (i / SPOKES) * TAU + (rand() - 0.5) * angularStep * 1.9;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    // WILD per-spoke reach (40%–100% of OUTER, weighted short) so the
    // rim heaves — some rays barely clear the core, others punch out.
    const reach = INNER + (OUTER - INNER) * (0.4 + Math.pow(rand(), 1.5) * 0.6);
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
      // WILD per-segment mass — heavy bold base with big random spread,
      // plus growth toward the rim, so chunky slabs sit beside thin bars.
      const wantThk =
        size * (0.012 + Math.pow(rand(), 1.4) * 0.03) + size * 0.014 * tNorm;
      const thickness = Math.min(wantThk, arclen * 0.7);
      const segDraw = segLen * 0.86;
      // Nested-arc silhouette (#15) — measured from this burst's own
      // focal so the arc bands stay centred on the (jittered) middle.
      if (nestedArcDrop(cos * mid, sin * mid, OUTER, 0, 4)) continue;
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
  // Holes + non-symmetric edge (per the shape rules): a seeded RNG
  // punches random gaps through the disc and gives each wedge column
  // its own ragged outer cutoff so the rim is never a clean circle.
  const rand = mulberry32(_seed || 1);
  const wedgeMaxRing: number[] = [];
  for (let i = 0; i < p.wedges; i++) wedgeMaxRing.push(0.68 + rand() * 0.32);
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
      // Ragged outer edge — this wedge column stops at its own cutoff.
      if (ringT > (wedgeMaxRing[i] ?? 1)) continue;
      // Random holes through the body.
      if (rand() < 0.15) continue;
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
    dropMask: (cx, cy, k, i) => {
      const sweeps = [
        TAU, // full
        Math.PI, // semicircle (180°)
        TAU / 3, // third (120°)
        Math.PI, // semicircle
        TAU * 0.66, // ~two-thirds
        Math.PI * 0.5, // quarter (90°)
      ];
      let sweep = sweeps[k % sweeps.length]!;
      if (k >= 11 && sweep >= TAU) sweep = TAU * 0.72;
      if (sweep < TAU) {
        let d = Math.atan2(cy, cx) - -Math.PI / 2; // centre arc at top
        while (d > Math.PI) d -= TAU;
        while (d < -Math.PI) d += TAU;
        if (Math.abs(d) > sweep / 2) return true; // outside the arc
      }
      // Extra asymmetric holes — deterministic per-cell noise punches
      // irregular gaps INSIDE the arcs so the rings aren't perfectly
      // symmetrical bands.
      const n = Math.abs(Math.sin(cx * 12.9898 + cy * 78.233 + k * 4.7) * 43758.5453);
      const noise = n - Math.floor(n);
      void i;
      return noise < 0.22;
    },
  });

// Wide-edge view spinning slowly — the disc looks like a turning coin.
export const buildVortexDiscSpinner: ShapeBuilder = (seed, size, palette) =>
  buildVortexDiscWithParams(seed, size, palette, {
    swirlTurns: 0.6,
    wrap: "scale(0.9 0.45)",
    spinDegPerSec: 18,
    // Punch lots of scattered holes through the disc so it reads as a
    // broken, fragmented spinner rather than a solid plate. Drops climb
    // toward the rim. Deterministic noise from cell position.
    dropMask: (cx, cy) => {
      const rNorm = Math.min(1, Math.hypot(cx, cy) / (size / 2));
      // Drop the very outer ring entirely — no rim lines.
      if (rNorm > 0.82) return true;
      const n = Math.abs(Math.sin(cx * 12.9898 + cy * 78.233) * 43758.5453);
      const noise = n - Math.floor(n);
      return noise < 0.4 + rNorm * 0.35; // 40%→75% holes outward
    },
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
      // Radial-distance reveal (same as PIN_BURST) — tiles ripple out
      // from the eye, inner first, rim last.
      const revealOrder = Math.min(1, radial);

      cells.push({
        kind: "rect",
        cx,
        cy,
        w: tileLen,
        h: tileThick,
        rx: 0,
        rotation: rot,
        color,
        revealOrder,
        // Draw itself from the eye outward — each tile pops in place
        // (birthOrigin = its own spot) in center-out order, so each arm
        // grows tip-by-tip instead of every tile flying from the centre.
        revealMode: "grow",
        birthOrigin: { x: cx, y: cy },
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
// 42 — PIN BURST
//
// Radial pins — each spoke is a thin shaft from a small centre eye
// that ends in a fat rectangular "head". Head reach + length vary per
// spoke, so the heads scatter at different radii forming an organic
// ragged outer ring (matchstick / drumstick burst). Pins grow out
// from the hub.
// ─────────────────────────────────────────────────────────────────────
export const buildPinBurst: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const r = size / 2;
  const cells: Cell[] = [];
  const SPOKES = 56;
  const innerR = r * 0.04;
  const ink = palette[0] ?? lightestColor(palette);

  for (let i = 0; i < SPOKES; i++) {
    const a = (i / SPOKES) * TAU;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    // Head ends at a per-spoke reach; its radial length also varies,
    // so the heads sit at scattered distances.
    const headReach = r * (0.42 + rand() * 0.56);
    const headLen = r * (0.1 + rand() * 0.18);
    const headStart = Math.max(innerR + r * 0.02, headReach - headLen);
    const headMidR = (headStart + headReach) / 2;
    const color = palette[i % palette.length] ?? ink;

    // Radial-distance reveal (same as SHATTER_MANDALA) — pins erupt
    // from the centre and ripple outward, near pins first.
    const pinOrder = Math.min(1, headMidR / r);
    // Thin shaft from the centre eye to where the head begins.
    cells.push({
      kind: "line",
      cx: 0,
      cy: 0,
      x1: cos * innerR,
      y1: sin * innerR,
      x2: cos * headStart,
      y2: sin * headStart,
      strokeW: Math.max(0.8, r * 0.0028),
      color,
      revealOrder: pinOrder,
      revealMode: "grow",
      birthOrigin: { x: 0, y: 0 },
      noSpin: true,
    });

    // Fat rectangular head — long axis radial (w = radial length),
    // tangentially wide (h), rotated to the spoke angle.
    cells.push({
      kind: "rect",
      cx: cos * headMidR,
      cy: sin * headMidR,
      w: headReach - headStart,
      h: r * 0.05,
      rx: 0,
      rotation: (a * 180) / Math.PI,
      color,
      revealOrder: pinOrder,
      revealMode: "grow",
      birthOrigin: { x: 0, y: 0 },
      noSpin: true,
    });
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// SPHERE projection — orthographic projection of a unit sphere, tilted
// about the X axis so we view it slightly from above (the pole sits
// toward the top, like the reference globes). Returns screen coords
// plus the `facing` factor (the viewer-facing Z component): 1 dead
// centre, 0 at the silhouette, negative on the far side.
// ─────────────────────────────────────────────────────────────────────
const SPHERE_TILT = 0.42;
const projectSphere = (
  lat: number,
  lon: number,
  R: number,
): { x: number; y: number; facing: number } => {
  const X = Math.cos(lat) * Math.sin(lon);
  const Y = Math.sin(lat);
  const Z = Math.cos(lat) * Math.cos(lon);
  const Yt = Y * Math.cos(SPHERE_TILT) - Z * Math.sin(SPHERE_TILT);
  const Zt = Y * Math.sin(SPHERE_TILT) + Z * Math.cos(SPHERE_TILT);
  return { x: R * X, y: -R * Yt, facing: Zt };
};

// Light continuous spin that kicks in only AFTER the reveal stagger
// finishes — used by the globe shapes so they settle, then drift.
const sphereSettleSpin: WrapAnimation = (localFrame) => {
  const f = Math.max(0, localFrame - (STAGGER_TOTAL + 6));
  return `rotate(${(f * 0.16).toFixed(2)})`;
};

// ─────────────────────────────────────────────────────────────────────
// SPHERE LINES — a tilted 3D globe drawn as latitude rings of short
// RECTANGLE dashes (image #21). Dashes are spread unevenly around each
// ring (jittered gaps), sized by the facing factor so they fatten dead
// centre and thin toward the rim (focus), with random dropouts punching
// holes through the field. Reveal sweeps top→bottom, then a light spin.
// ─────────────────────────────────────────────────────────────────────
export const buildSphereLines: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const R = size * 0.46;
  const half = size / 2;
  const cells: Cell[] = [];
  const LAT = 22;
  for (let li = 1; li < LAT; li++) {
    const lat = -Math.PI / 2 + (li / LAT) * Math.PI;
    let lon = -Math.PI;
    let dashIdx = 0;
    while (lon < Math.PI) {
      const dash = 0.07 + rand() * 0.07; // uneven dash length
      const gap = 0.05 + rand() * 0.12; // uneven gap → spread unevenly
      const a = projectSphere(lat, lon, R);
      const b = projectSphere(lat, lon + dash, R);
      lon += dash + gap;
      dashIdx++;
      if (a.facing < 0.08 || b.facing < 0.08) continue;
      // More holes overall — randomly skip a third of the dashes.
      if (rand() < 0.32) continue;
      // Cycle every team colour across the rings + dashes so the whole
      // palette shows on the globe, not a single ink.
      const color =
        palette[(li + dashIdx) % palette.length] ?? lightestColor(palette);
      const facing = (a.facing + b.facing) / 2;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      const yNorm = (my + half) / size;
      cells.push({
        kind: "rect",
        cx: mx,
        cy: my,
        w: len,
        // Thickness scales with facing → focus toward the centre.
        h: Math.max(1.4, size * 0.012 * Math.pow(facing, 0.8)),
        rx: 0,
        rotation: (Math.atan2(dy, dx) * 180) / Math.PI,
        color,
        revealOrder: Math.min(1, Math.max(0, yNorm)),
        revealMode: "grow",
        birthOrigin: { x: mx, y: my },
        noSpin: true,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 }, wrapAnimation: sphereSettleSpin };
};

// ─────────────────────────────────────────────────────────────────────
// SPHERE GRID — a halftone globe built from SQUARES on a lat/long grid
// (image #22). Square size scales with the facing factor so cells are
// fat dead-centre and shrink to nothing at the silhouette, reading as
// a shaded sphere. Reveal sweeps top→bottom.
// ─────────────────────────────────────────────────────────────────────
export const buildSphereGrid: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const R = size * 0.46;
  const half = size / 2;
  const cells: Cell[] = [];
  // Sparser grid → more holes; stronger facing exponent → more focus
  // (fat dead-centre squares falling off hard toward the rim).
  const LAT = 22;
  const LON = 34;
  // Pulled back into the family (review #8): smaller cells + heavier
  // dropout so the globe reads as an airy halftone disc consistent
  // with the flat radial siblings, not a dense solid 3D ball.
  const maxSq = size * 0.055;
  for (let li = 0; li <= LAT; li++) {
    const lat = -Math.PI / 2 + (li / LAT) * Math.PI;
    for (let lj = 0; lj < LON; lj++) {
      const lon = -Math.PI + (lj / LON) * TAU;
      const p = projectSphere(lat, lon, R);
      if (p.facing < 0.06) continue;
      // Heavier dropout (~45%) → airier, less dominant.
      if (rand() < 0.45) continue;
      const sq = maxSq * Math.pow(p.facing, 1.5);
      if (sq < size * 0.006) continue;
      const yNorm = (p.y + half) / size;
      const color =
        palette[(li + lj) % palette.length] ?? darkestColor(palette);
      cells.push({
        kind: "rect",
        cx: p.x,
        cy: p.y,
        w: sq,
        h: sq,
        rx: 0,
        color,
        revealOrder: Math.min(1, Math.max(0, yNorm)),
        revealMode: "grow",
        birthOrigin: { x: p.x, y: p.y },
        noSpin: true,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 }, wrapAnimation: sphereSettleSpin };
};

// ─────────────────────────────────────────────────────────────────────
// SPHERE TRIANGLES — same halftone globe as SPHERE GRID, but each cell
// is a SQUARE split on its diagonal into two triangles: the lower-left
// triangle takes a team colour, the upper-right takes the light neutral
// (image #27). Squares sized by facing for the focus falloff.
// ─────────────────────────────────────────────────────────────────────
export const buildSphereTriangles: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const R = size * 0.46;
  const half = size / 2;
  const cells: Cell[] = [];
  const LAT = 20;
  const LON = 32;
  const maxSq = size * 0.07;
  const light = lightestColor(palette);
  for (let li = 0; li <= LAT; li++) {
    const lat = -Math.PI / 2 + (li / LAT) * Math.PI;
    for (let lj = 0; lj < LON; lj++) {
      const lon = -Math.PI + (lj / LON) * TAU;
      const p = projectSphere(lat, lon, R);
      if (p.facing < 0.06) continue;
      if (rand() < 0.18) continue;
      const sq = maxSq * Math.pow(p.facing, 1.4);
      if (sq < size * 0.007) continue;
      const yNorm = (p.y + half) / size;
      const order = Math.min(1, Math.max(0, yNorm));
      const h = sq / 2;
      const team =
        palette[(li + lj) % palette.length] ?? darkestColor(palette);
      // Two triangles forming the square, split on the TL→BR diagonal.
      const tl = `${(p.x - h).toFixed(2)} ${(p.y - h).toFixed(2)}`;
      const tr = `${(p.x + h).toFixed(2)} ${(p.y - h).toFixed(2)}`;
      const br = `${(p.x + h).toFixed(2)} ${(p.y + h).toFixed(2)}`;
      const bl = `${(p.x - h).toFixed(2)} ${(p.y + h).toFixed(2)}`;
      const common = {
        cx: p.x,
        cy: p.y,
        revealOrder: order,
        revealMode: "grow" as const,
        birthOrigin: { x: p.x, y: p.y },
        noSpin: true,
      };
      cells.push({
        kind: "path",
        d: `M ${tl} L ${bl} L ${br} Z`,
        color: team,
        ...common,
      });
      cells.push({
        kind: "path",
        d: `M ${tl} L ${tr} L ${br} Z`,
        color: light,
        ...common,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 }, wrapAnimation: sphereSettleSpin };
};

// ─────────────────────────────────────────────────────────────────────
// CORONA BLADES — a perspective elliptical corona radiating OUT from an
// empty centre (image #25), rendered as a HALFTONE like SPHERE
// TRIANGLES: each blade is a chain of triangle-split squares (half team
// colour, half light neutral) that grow in size toward the rim. Blades
// are spread UNEVENLY (jittered angles) for an abstract, ragged feel.
// ─────────────────────────────────────────────────────────────────────
export const buildCoronaBlades: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const N = 38;
  const innerR = half * 0.16;
  const outerR = half * 0.96;
  const SQUASH = 0.72; // vertical squash → perspective ellipse
  const TILT = -0.32; // rotate the whole ellipse
  const cosT = Math.cos(TILT);
  const sinT = Math.sin(TILT);
  const light = lightestColor(palette);
  const ellipsePt = (angle: number, radius: number) => {
    const ex = Math.cos(angle) * radius;
    const ey = Math.sin(angle) * radius * SQUASH;
    return { x: ex * cosT - ey * sinT, y: ex * sinT + ey * cosT };
  };
  // Walk the ring with jittered angular steps so blades sit unevenly.
  let a = rand() * TAU;
  for (let i = 0; i < N; i++) {
    a += (TAU / N) * (0.45 + rand() * 1.7); // very uneven angular spacing
    if (rand() < 0.28) continue; // frequent missing blades → abstract
    const reach = outerR * (0.5 + rand() * 0.48);
    // Blades start at scattered radii so the inner edge is ragged too.
    const startR = innerR * (0.85 + rand() * 0.8);
    const DOTS = 3 + Math.floor(rand() * 5);
    const team =
      palette[i % palette.length] ?? darkestColor(palette);
    for (let s = 0; s < DOTS; s++) {
      const t = DOTS === 1 ? 0.5 : s / (DOTS - 1);
      // Punch holes along each blade — drop a third of the dots, so
      // blades break up into scattered fragments instead of solid rays.
      if (rand() < 0.34) continue;
      // Uneven radial spacing + angular wobble per dot → abstract drift.
      const radius = startR + (reach - startR) * t + (rand() - 0.5) * size * 0.03;
      const dotA = a + (rand() - 0.5) * 0.12;
      const p = ellipsePt(dotA, radius);
      // Halftone focused toward the CENTRE — squares are fat near the
      // hub and shrink toward the rim, with size jitter.
      const sq = size * (0.062 - t * 0.044) * (0.7 + rand() * 0.7);
      const h = sq / 2;
      const order = Math.min(1, (radius / outerR) * 0.85);
      const tl = `${(p.x - h).toFixed(2)} ${(p.y - h).toFixed(2)}`;
      const tr = `${(p.x + h).toFixed(2)} ${(p.y - h).toFixed(2)}`;
      const br = `${(p.x + h).toFixed(2)} ${(p.y + h).toFixed(2)}`;
      const bl = `${(p.x - h).toFixed(2)} ${(p.y + h).toFixed(2)}`;
      const common = {
        cx: p.x,
        cy: p.y,
        revealOrder: order,
        revealMode: "grow" as const,
        birthOrigin: { x: p.x, y: p.y },
        noSpin: true,
      };
      cells.push({ kind: "path", d: `M ${tl} L ${bl} L ${br} Z`, color: team, ...common });
      cells.push({ kind: "path", d: `M ${tl} L ${tr} L ${br} Z`, color: light, ...common });
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// SPIRAL GALAXY — several logarithmic-spiral arms built from SQUARES
// (image #26). Squares grow with radius (tiny at the hub, fat at the
// rim) and spacing widens outward, so each arm reads as a halftone
// galaxy band winding out from the centre. Whole field spins slowly.
// ─────────────────────────────────────────────────────────────────────
export const buildSpiralGalaxy: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const ARMS = 5;
  const TURN = 2.4; // total winding (radians of base angle sweep)
  const K = 1.7; // log-spiral tightness
  const maxR = half * 0.96;
  for (let arm = 0; arm < ARMS; arm++) {
    const base = (arm / ARMS) * TAU + rand() * 0.1;
    const STEPS = 26;
    for (let s = 1; s <= STEPS; s++) {
      const t = s / STEPS;
      // Punch holes along the arm — heavier toward the hub so the core
      // reads sparse, plus a steady scatter of gaps the whole length so
      // each arm breaks into clumps instead of a solid band.
      if (t < 0.34 && rand() < 0.55) continue;
      if (rand() < 0.22) continue;
      const r = maxR * Math.pow(t, 0.92);
      const ang = base + K * Math.log(1 + t * TURN * 3);
      const px = Math.cos(ang) * r;
      const py = Math.sin(ang) * r;
      const sq = size * (0.006 + t * 0.05);
      // Mix the team colours ALONG each arm (step-indexed, not one
      // colour per arm) so every arm carries the full palette spread.
      const color =
        palette[(arm + s) % palette.length] ?? darkestColor(palette);
      cells.push({
        kind: "rect",
        cx: px,
        cy: py,
        w: sq,
        h: sq,
        rx: 0,
        rotation: (ang * 180) / Math.PI,
        color,
        // Draw itself from the hub outward — each square pops in place
        // (birthOrigin = its own spot) in center-out order, so the arm
        // grows tip-by-tip instead of flying in from the centre.
        revealOrder: Math.min(1, t * 0.85),
        revealMode: "grow",
        birthOrigin: { x: px, y: py },
        noSpin: true,
      });
    }
  }
  const wrapAnimation: WrapAnimation = (localFrame) => {
    const f = Math.max(0, localFrame - (STAGGER_TOTAL + 6));
    return `rotate(${(f * 0.25).toFixed(2)})`;
  };
  return { cells, focal: { x: 0, y: 0 }, wrapAnimation };
};

// ─────────────────────────────────────────────────────────────────────
// DIAMOND HALFTONE — a halftone gradient on a rotated (diamond) square
// grid, built from SQUARES not dots (image #28). Square size ramps from
// tiny at one corner to fat at the opposite corner, so the diamond
// reads as a directional halftone gradient. Reveal follows the ramp.
// ─────────────────────────────────────────────────────────────────────
export const buildDiamondHalftone: ShapeBuilder = (seed, size, palette) => {
  void seed;
  const half = size / 2;
  const cells: Cell[] = [];
  const N = 13; // cells per side of the square grid
  const span = size * 0.92;
  const pitch = span / N;
  const maxSq = pitch * 0.92;
  // Rotate the grid 45° → diamond.
  const rot = Math.PI / 4;
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  for (let gx = 0; gx < N; gx++) {
    for (let gy = 0; gy < N; gy++) {
      // Local grid coords centred on 0.
      const lx = (gx - (N - 1) / 2) * pitch;
      const ly = (gy - (N - 1) / 2) * pitch;
      const px = lx * cosR - ly * sinR;
      const py = lx * sinR + ly * cosR;
      // Ramp 0→1 from top-left corner to bottom-right corner.
      const ramp = (gx + gy) / (2 * (N - 1));
      const sq = maxSq * (0.12 + ramp * 0.88);
      const color =
        palette[(gx + gy) % palette.length] ?? darkestColor(palette);
      cells.push({
        kind: "rect",
        cx: px,
        cy: py,
        w: sq,
        h: sq,
        rx: 0,
        rotation: (rot * 180) / Math.PI,
        color,
        revealOrder: Math.min(1, ramp),
        revealMode: "grow",
        birthOrigin: { x: px, y: py },
        noSpin: true,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// BASKET VORTEX — a wireframe dome (image #32) built from SQUARES:
// concentric perspective rings crossed by spiralling meridian spokes
// dotted out as little squares. The whole frame is rotated onto an
// angle and spins slowly; per the shape rules it carries holes and a
// ragged edge.
// ─────────────────────────────────────────────────────────────────────
export const buildBasketVortex: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const R = half * 0.92;
  const SQUASH = 0.9; // slight vertical squash → dome
  const SWIRL = 1.5; // radians of curl over the full radius
  const ANGLE = -0.42; // tilt the entire shape onto an angle
  const cosA = Math.cos(ANGLE);
  const sinA = Math.sin(ANGLE);
  const sq = size * 0.022;
  // Project to dome coords, then rotate the whole shape by ANGLE.
  const pt = (a: number, rr: number) => {
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr * SQUASH;
    return { x: x * cosA - y * sinA, y: x * sinA + y * cosA };
  };
  const pushDot = (
    x: number,
    y: number,
    color: string,
    order: number,
  ) => {
    cells.push({
      kind: "rect",
      cx: x,
      cy: y,
      w: sq,
      h: sq,
      rx: 0,
      color,
      revealOrder: Math.min(1, order),
      revealMode: "grow",
      birthOrigin: { x, y },
      noSpin: true,
    });
  };
  // Concentric rings, each wound by the swirl so they sit as spirals.
  // Heavy dropouts + per-dot angle/radius jitter so the frame reads as
  // an abstract, broken wireframe rather than a clean basket.
  const RINGS = 8;
  const SEG = 56;
  for (let k = 1; k <= RINGS; k++) {
    const rr = R * (k / RINGS);
    const twist = SWIRL * (1 - rr / R);
    const color = palette[k % palette.length] ?? lightestColor(palette);
    for (let j = 0; j < SEG; j++) {
      if (rand() < 0.45) continue; // lots of holes
      const a = (j / SEG) * TAU + twist + (rand() - 0.5) * 0.06;
      const p = pt(a, rr * (0.94 + rand() * 0.12));
      pushDot(p.x, p.y, color, (rr / R) * 0.85);
    }
  }
  // Meridian spokes — spiral from the eye out to a ragged rim.
  const SPOKES = 26;
  const STEPS = 18;
  for (let i = 0; i < SPOKES; i++) {
    if (rand() < 0.18) continue; // drop whole spokes → ragged gaps
    const base = (i / SPOKES) * TAU;
    const reach = 0.55 + rand() * 0.45; // ragged, non-symmetric edge
    const color = palette[i % palette.length] ?? lightestColor(palette);
    for (let s = 1; s <= STEPS; s++) {
      const t = (s / STEPS) * reach;
      if (rand() < 0.4) continue; // lots of holes
      const rr = R * t;
      const a = base + SWIRL * (1 - t) + (rand() - 0.5) * 0.05;
      const p = pt(a, rr);
      pushDot(p.x, p.y, color, t * 0.85);
    }
  }
  const wrapAnimation: WrapAnimation = (localFrame) => {
    const f = Math.max(0, localFrame - (STAGGER_TOTAL + 6));
    return `rotate(${(f * 0.5).toFixed(2)})`;
  };
  return { cells, focal: { x: 0, y: 0 }, wrapAnimation };
};

// ─────────────────────────────────────────────────────────────────────
// SWOOSH ARC — a single tapered, curved swoosh band (just the top arc
// of the globe-swoosh reference, image #33) built from SQUARES. The
// band follows a circular arc, is thick in the middle and tapers to
// points at both ends, drawn diagonally. Per the shape rules it is
// peppered with holes and has a ragged, non-symmetric edge.
// ─────────────────────────────────────────────────────────────────────
export const buildSwooshArc: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const cells: Cell[] = [];
  // Arc geometry — centre well below the canvas so only the top of a
  // big circle sweeps through the frame as a shallow swoosh.
  const arcCx = -size * 0.15;
  const arcCy = size * 1.05;
  const Rarc = size * 1.25;
  const phiStart = -Math.PI * 0.92;
  const phiEnd = -Math.PI * 0.18;
  const TILT = -0.18; // diagonal lean
  const cosT = Math.cos(TILT);
  const sinT = Math.sin(TILT);
  const STEPS = 64;
  const pitch = size * 0.032;
  const sq = pitch * 0.84;
  const maxThick = size * 0.16;
  for (let s = 0; s <= STEPS; s++) {
    const t = s / STEPS;
    const phi = phiStart + (phiEnd - phiStart) * t;
    // Taper to points at both ends, with per-step noise → ragged edge.
    const thick =
      maxThick * Math.pow(Math.sin(Math.PI * t), 0.7) * (0.78 + rand() * 0.22);
    const baseX = arcCx + Math.cos(phi) * Rarc;
    const baseY = arcCy + Math.sin(phi) * Rarc;
    const nx = Math.cos(phi);
    const ny = Math.sin(phi);
    const across = Math.max(1, Math.round(thick / pitch));
    const color = palette[s % palette.length] ?? darkestColor(palette);
    for (let u = 0; u < across; u++) {
      // Holes through the band.
      if (rand() < 0.22) continue;
      const off = (u / Math.max(1, across - 1) - 0.5) * thick;
      const px = baseX + nx * off;
      const py = baseY + ny * off;
      // Tilt the whole swoosh.
      cells.push({
        kind: "rect",
        cx: px * cosT - py * sinT,
        cy: px * sinT + py * cosT,
        w: sq,
        h: sq,
        rx: 0,
        color,
        revealOrder: Math.min(1, t),
        revealMode: "grow",
        birthOrigin: { x: 0, y: 0 },
        noSpin: true,
      });
    }
  }
  // Recentre the whole swoosh on the canvas origin so it sits in the
  // middle of the card rather than hugging an edge.
  if (cells.length) {
    let sx = 0;
    let sy = 0;
    for (const c of cells) {
      sx += c.cx;
      sy += c.cy;
    }
    const mx = sx / cells.length;
    const my = sy / cells.length;
    for (const c of cells) {
      c.cx -= mx;
      c.cy -= my;
      if (c.birthOrigin) c.birthOrigin = { x: c.cx, y: c.cy };
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// WEDGES — pie sectors on a polar grid (rings × sectors) with
// alternating palette fill (ported from the cellGrid `wedges` shape).
// Per the shape rules it carries random holes and a ragged, per-sector
// outer edge so the disc never reads as a clean circle.
// ─────────────────────────────────────────────────────────────────────
export const buildWedges: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const outerR = half * 0.96;
  const SECTORS = 18;
  const RINGS = 9;
  const colA = palette[0] ?? lightestColor(palette);
  const sectorMax: number[] = [];
  for (let si = 0; si < SECTORS; si++) sectorMax.push(0.7 + rand() * 0.3);
  for (let si = 0; si < SECTORS; si++) {
    const a0 = (si / SECTORS) * TAU - Math.PI / 2;
    const a1 = ((si + 1) / SECTORS) * TAU - Math.PI / 2;
    const aMid = (a0 + a1) / 2;
    for (let ri = 0; ri < RINGS; ri++) {
      const ringT = ri / RINGS;
      if (ringT > (sectorMax[si] ?? 1)) continue; // ragged edge
      if (rand() < 0.16) continue; // holes
      const r0 = (ri / RINGS) * outerR;
      const r1 = ((ri + 1) / RINGS) * outerR;
      const rMid = (r0 + r1) / 2;
      const color =
        (si + ri) % 2 === 0
          ? colA
          : palette[(si + ri) % palette.length] ?? colA;
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
        revealMode: "grow",
        birthOrigin: { x: 0, y: 0 },
        noSpin: true,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// RADIAL CHECKER — polar checker grid (wedges × rings, alternating
// two-tone) with one wedge "exploded" into narrow sub-wedges for a fan
// detail (ported from the cellGrid `radial_checker`). Holes punched
// through; the disc spins slowly like a pinwheel.
// ─────────────────────────────────────────────────────────────────────
export const buildRadialChecker: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const outerR = half * 0.96;
  const WEDGES = 14;
  const RINGS = 5;
  const SUB = 7;
  // Several wedges subdivide into thin slices → more thin/hole-like
  // areas scattered around the disc (not just one exploded sector).
  const explodeSet = new Set<number>();
  const explodeCount = 3 + Math.floor(rand() * 3); // 3-5 → more thin areas
  while (explodeSet.size < explodeCount)
    explodeSet.add(Math.floor(rand() * WEDGES));
  const colA = palette[0] ?? lightestColor(palette);
  let colB = colA;
  for (let i = 1; i < palette.length; i++) {
    if (palette[i] !== colA) {
      colB = palette[i]!;
      break;
    }
  }
  for (let wi = 0; wi < WEDGES; wi++) {
    const wA1 = (wi / WEDGES) * TAU - Math.PI / 2;
    const wA2 = ((wi + 1) / WEDGES) * TAU - Math.PI / 2;
    const isExplode = explodeSet.has(wi);
    const subCount = isExplode ? SUB : 1;
    for (let sw = 0; sw < subCount; sw++) {
      const a1 = wA1 + ((wA2 - wA1) * sw) / subCount;
      const a2 = wA1 + ((wA2 - wA1) * (sw + 1)) / subCount;
      const angleIdx = isExplode ? wi * SUB + sw : wi;
      for (let ri = 0; ri < RINGS; ri++) {
        if (rand() < 0.3) continue; // more holes / thin negative space
        const r1 = (ri / RINGS) * outerR;
        const r2 = ((ri + 1) / RINGS) * outerR;
        const aMid = (a1 + a2) / 2;
        const rMid = (r1 + r2) / 2;
        // Weighted palette per cell so all team colours appear (in flag
        // proportion), not just a 2-tone checker.
        const color = palette[(angleIdx + ri) % palette.length] ?? colA;
        cells.push({
          kind: "wedge",
          cx: Math.cos(aMid) * rMid,
          cy: Math.sin(aMid) * rMid,
          innerR: r1,
          outerR: r2,
          startA: a1,
          endA: a2,
          color,
          revealOrder: Math.min(1, ri / RINGS),
          revealMode: "grow",
          birthOrigin: { x: 0, y: 0 },
          noSpin: true,
        });
      }
    }
  }
  const wrapAnimation: WrapAnimation = (localFrame) => {
    const f = Math.max(0, localFrame - (STAGGER_TOTAL + 6));
    return `rotate(${(f * 0.3).toFixed(2)})`;
  };
  return { cells, focal: { x: 0, y: 0 }, wrapAnimation };
};

// ─────────────────────────────────────────────────────────────────────
// PIXEL TOPOGRAPHY — a contour-banded height field rendered as SQUARES
// with a spherical vignette: cells fade + shrink toward the rim so the
// grid reads as a ball (ported from the cellGrid `pixel_topography`).
// The rim falloff + extra random drops give it holes and a soft,
// non-rectangular edge.
// ─────────────────────────────────────────────────────────────────────
export const buildPixelTopography: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const DENSITY = 26;
  const step = size / DENSITY;
  const freqX = 3.6;
  const freqY = 3.0;
  const seedShift = (seed % 1000) * 0.013;
  const bandCount = Math.max(2, Math.min(palette.length, 5));
  const maxR = half;
  const SOLID_T = 0.55;
  for (let iy = 0; iy < DENSITY; iy++) {
    for (let ix = 0; ix < DENSITY; ix++) {
      const cellCX = -half + ix * step + step / 2;
      const cellCY = -half + iy * step + step / 2;
      const u = (cellCX + half) / size;
      const v = (cellCY + half) / size;
      const height =
        Math.sin(u * Math.PI * freqX + seedShift) +
        Math.sin(v * Math.PI * freqY + seedShift * 1.7) * 0.85 +
        Math.sin((u + v) * Math.PI * 2.2 + seedShift * 0.5) * 0.55 +
        Math.sin((u - v) * Math.PI * 3.1 + seedShift * 2.1) * 0.35;
      const t = Math.max(0, Math.min(1, (height + 2.75) / 5.5));
      const band = Math.min(bandCount - 1, Math.floor(t * bandCount));
      const colIdx = Math.floor(
        (band / Math.max(1, bandCount - 1)) * (palette.length - 1),
      );
      const color =
        palette[Math.max(0, Math.min(palette.length - 1, colIdx))] ??
        darkestColor(palette);
      const distNorm = Math.hypot(cellCX, cellCY) / maxR;
      const falloff = Math.max(0, (1 - distNorm) / (1 - SOLID_T));
      const fade = Math.min(1, falloff);
      const alpha = fade * fade * (3 - 2 * fade);
      if (alpha < 0.12) continue; // rim falloff → sphere edge
      if (rand() < 0.4) continue; // lots of holes through the field
      const sizeShrink = 0.55 + 0.45 * alpha;
      const sq = step * 0.86 * sizeShrink;
      cells.push({
        kind: "rect",
        cx: cellCX,
        cy: cellCY,
        w: sq,
        h: sq,
        rx: 0,
        color,
        revealOrder: Math.min(1, distNorm * 0.85),
        revealMode: "grow",
        birthOrigin: { x: cellCX, y: cellCY },
        noSpin: true,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ─────────────────────────────────────────────────────────────────────
// Promoted ref-folder shapes — chaotic radial op-art forms, team-colour
// palettes, grow-from-centre reveals + a slow settle spin.
// ─────────────────────────────────────────────────────────────────────
const refAngleFocus = (rand: () => number) => {
  const angle = rand() * TAU;
  const w = 0.85 + rand() * 0.9;
  return (a: number) => {
    let d = a - angle;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    return Math.exp(-(d * d) / (2 * w * w));
  };
};
const refSpin: WrapAnimation = (localFrame) => {
  const f = Math.max(0, localFrame - (STAGGER_TOTAL + 6));
  return `rotate(${(f * 0.3).toFixed(2)})`;
};

// SWIRL CHECKER — polar diamond checker on a sphere, wound by a swirl.
export const buildSwirlChecker: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const R = half * 1.02;
  const RINGS = 30;
  const WEDGES = 48;
  const swirl = (0.9 + rand() * 0.7) * (rand() < 0.5 ? 1 : -1);
  const wedgeMax: number[] = [];
  for (let i = 0; i < WEDGES; i++) wedgeMax.push(0.78 + rand() * 0.22);
  // Angular holes: close ~30% of wedge columns so the disc reads as
  // broken sectors rather than a whole circle (structure unchanged).
  const wedgeOpen: boolean[] = [];
  for (let i = 0; i < WEDGES; i++) wedgeOpen.push(rand() > 0.3);
  for (let k = 0; k < RINGS; k++) {
    const ringT = k / RINGS;
    const r0 = R * Math.sin((k / RINGS) * (Math.PI / 2));
    const r1 = R * Math.sin(((k + 1) / RINGS) * (Math.PI / 2));
    const rMid = (r0 + r1) / 2;
    const twist = swirl * Math.pow(1 - ringT, 1.4) * TAU;
    for (let i = 0; i < WEDGES; i++) {
      if ((k + i) % 2 !== 0) continue;
      if (!wedgeOpen[i]) continue; // angular holes → not a whole disc
      if (ringT > (wedgeMax[i] ?? 1)) continue;
      if (rand() < 0.16) continue;
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
        color: palette[(k + i) % palette.length] ?? darkestColor(palette),
        revealOrder: Math.min(1, ringT),
        revealMode: "grow",
        birthOrigin: { x: 0, y: 0 },
        noSpin: true,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 }, wrapAnimation: refSpin };
};

// Rotate a fan/beam by a random angle per seed so the focal point /
// opening lands at a different angle each time. Mutates cells in place
// and returns the rotated focal.
const randomOrient = (
  cells: Cell[],
  rand: () => number,
  focal: { x: number; y: number },
): { x: number; y: number } => {
  const ang = rand() * TAU;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const rot = (p: { x: number; y: number }) => ({
    x: p.x * c - p.y * s,
    y: p.x * s + p.y * c,
  });
  const degs = (ang * 180) / Math.PI;
  for (const cell of cells) {
    const p = rot({ x: cell.cx, y: cell.cy });
    cell.cx = p.x;
    cell.cy = p.y;
    if (cell.kind === "rect" && cell.rotation !== undefined) cell.rotation += degs;
    if (cell.kind === "line") {
      const p1 = rot({ x: cell.x1, y: cell.y1 });
      const p2 = rot({ x: cell.x2, y: cell.y2 });
      cell.x1 = p1.x;
      cell.y1 = p1.y;
      cell.x2 = p2.x;
      cell.y2 = p2.y;
    }
    if (cell.birthOrigin) cell.birthOrigin = rot(cell.birthOrigin);
  }
  return rot(focal);
};

// SIGNAL FAN — rectangular colour beams bursting from a far-left focal
// point, expanding rightward in a perspective cone with checker gaps.
export const buildSignalFan: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const vpx = -half * 0.92;
  const vpy = (rand() - 0.5) * size * 0.05;
  // Bolder goal-mouth: wider, denser cone than the original timid fan.
  const BEAMS = 32;
  const fanHalf = 0.74;
  const maxR = size * 1.7;
  const ink = darkestColor(palette);
  for (let b = 0; b < BEAMS; b++) {
    const bt = b / (BEAMS - 1);
    const a = (bt - 0.5) * 2 * fanHalf;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const central = 1 - Math.min(1, Math.abs(a) / fanHalf);
    const beamColor = palette[b % palette.length] ?? ink;
    const checkerOffset = b % 2;
    // Net-mass ~50-70% from the mouth: each beam stops at its own
    // ragged reach so the lit cone never fully fills the frame and
    // the opening stays dramatic (ragged outer edge, not a clean arc).
    const laneReach = maxR * (0.5 + rand() * 0.42);
    let d = size * 0.05; // clean, deliberate opening at the goal-mouth
    for (let s = 0; s < 44; s++) {
      const dn = d / maxR;
      const segLen = size * (0.02 + dn * 0.12);
      const gap = size * (0.005 + dn * 0.05);
      // Thicker minimum so beams read aggressively even near the apex.
      const thick = size * (0.01 + dn * 0.07) * (0.6 + central * 0.95);
      const cx = vpx + cos * (d + segLen / 2);
      const cy = vpy + sin * (d + segLen / 2);
      const checkerOn = (s + checkerOffset) % 2 === 0;
      const keep = 0.9 - (1 - central) * 0.3;
      if (
        d < laneReach &&
        checkerOn &&
        rand() < keep &&
        Math.abs(cx) < half * 1.12 &&
        Math.abs(cy) < half * 1.12
      ) {
        cells.push({
          kind: "rect",
          cx,
          cy,
          w: segLen,
          h: thick,
          rx: 0,
          rotation: (a * 180) / Math.PI,
          color: rand() < 0.18 ? ink : beamColor,
          revealOrder: Math.min(1, dn * 2.2),
          revealMode: "grow",
          birthOrigin: { x: vpx, y: vpy },
          noSpin: true,
        });
      }
      d += segLen + gap;
      if (d > maxR) break;
    }
  }
  return { cells, focal: randomOrient(cells, rand, { x: vpx, y: vpy }) };
};

// PERSPECTIVE FAN — warp-speed lanes streaking from a far-left
// vanishing point toward the right. Unlike SIGNAL_FAN's checker-gap
// cone, each beam is a COHERENT colour lane (one of accent / ink /
// light) so the field reads as continuous red/black/white bands that
// grow longer + thicker with distance. House rules baked in: per-lane
// ragged reach (every lane stops at its own length → non-symmetric
// right edge) and random segment dropouts (holes punched through the
// lanes). Bars use revealMode "grow" + noSpin so each segment draws
// cleanly along its ray and stops at its target length.
export const buildPerspectiveFan: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const ink = darkestColor(palette);
  const light = lightestColor(palette);
  // Vanishing point pinned to the far-left edge, near-centred vertically.
  const vpx = -half * 0.96;
  const vpy = (rand() - 0.5) * size * 0.05;
  const BEAMS = 34;
  const fanHalf = 0.92; // half-angle of the cone (rad) — wide spread
  const maxR = size * 1.85;
  for (let b = 0; b < BEAMS; b++) {
    const bt = b / (BEAMS - 1);
    const a = (bt - 0.5) * 2 * fanHalf;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    // Central beams are brightest/thickest; edge beams thin out.
    const central = 1 - Math.min(1, Math.abs(a) / fanHalf);
    // Coherent per-lane colour — alternate accent/ink for the stripe
    // rhythm, with the occasional light lane for a bright highlight.
    const accent = palette[b % palette.length] ?? ink;
    const laneColor =
      rand() < 0.16 ? light : b % 2 === 0 ? accent : ink;
    // Per-lane ragged reach — each lane stops somewhere different so
    // the right edge is uneven rather than a clean arc.
    const laneReach = maxR * (0.45 + rand() * 0.6);
    const checkerOffset = b % 2;
    let d = size * 0.03;
    for (let s = 0; s < 46; s++) {
      const dn = d / maxR;
      const segLen = size * (0.02 + dn * 0.13);
      const gap = size * (0.006 + dn * 0.05);
      const thick = size * (0.006 + dn * 0.085) * (0.45 + central * 0.8);
      const cx = vpx + cos * (d + segLen / 2);
      const cy = vpy + sin * (d + segLen / 2);
      const checkerOn = (s + checkerOffset) % 2 === 0;
      // Holes: even on "lit" segments, punch out a fraction so the
      // lanes break up irregularly (denser near the bright VP).
      const keep = 0.86 - (1 - central) * 0.22;
      if (
        d < laneReach &&
        checkerOn &&
        rand() < keep &&
        Math.abs(cx) < half * 1.15 &&
        Math.abs(cy) < half * 1.15
      ) {
        // Occasional bright pop within a dark/accent lane.
        const segColor = rand() < 0.12 ? light : laneColor;
        cells.push({
          kind: "rect",
          cx,
          cy,
          w: segLen,
          h: thick,
          rx: 0,
          rotation: (a * 180) / Math.PI,
          color: segColor,
          // Draw outward from the VP — near segments reveal first.
          revealOrder: Math.min(1, dn * 2.0),
          revealMode: "grow",
          revealSpeed: 0.7, // slower draw → cinematic warp
          birthOrigin: { x: vpx, y: vpy },
          noSpin: true,
        });
      }
      d += segLen + gap;
      if (d > maxR) break;
    }
  }
  // Circle-mesh at the mouth (left): a jittered dotted grid fanning
  // right from the VP so the convergence reads as a mesh, not purely
  // linear beams. Holes keep it airy; dots grow with distance.
  const meshCols = 7;
  const meshRows = 11;
  const meshSpanX = size * 0.42;
  for (let gx = 0; gx < meshCols; gx++) {
    const tx = gx / (meshCols - 1); // 0..1 rightward from the VP
    const px = vpx + size * 0.02 + tx * meshSpanX;
    const coneH = (px - vpx) * Math.tan(fanHalf * 0.7);
    for (let gy = 0; gy < meshRows; gy++) {
      const ty = gy / (meshRows - 1);
      const py = vpy + (ty - 0.5) * 2 * coneH;
      if (Math.abs(py) > half * 1.1) continue;
      if (rand() < 0.4) continue; // holes
      const dotR = size * (0.005 + tx * 0.012);
      cells.push({
        kind: "rect",
        cx: px + (rand() - 0.5) * size * 0.018,
        cy: py + (rand() - 0.5) * size * 0.018,
        w: dotR * 2,
        h: dotR * 2,
        rx: 0,
        color: rand() < 0.35 ? ink : palette[(gx + gy) % palette.length] ?? ink,
        revealOrder: Math.min(1, tx * 0.6),
        revealMode: "fade",
        birthOrigin: { x: vpx, y: vpy },
        noSpin: true,
      });
    }
  }
  return { cells, focal: randomOrient(cells, rand, { x: vpx, y: vpy }) };
};

// RIPPLE DOTS — concentric rings of dots forming an OPEN C-arc (ref:
// dotted halftone ripple). The opening drifts per ring (spiral mouth),
// rings wobble slightly + dots carry radial jitter for a rippling read,
// and ~1/3 of dots drop out so the arcs stay broken/airy ("less whole").
export const buildRippleDots: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const ink = darkestColor(palette);
  const innerR = half * 0.16;
  const outerR = half * 1.02;
  const RINGS = 12; // a bit denser
  for (let k = 0; k < RINGS; k++) {
    const ringT = k / (RINGS - 1);
    // Ripple: per-ring radial wobble so rings aren't evenly spaced.
    const r =
      innerR + (outerR - innerR) * ringT + (rand() - 0.5) * size * 0.012;
    const dotR = size * (0.006 + ringT * 0.012) * (0.7 + rand() * 0.6);
    const spacing = dotR * 2 + size * 0.012;
    // tactical_scan structure (#29): 2-4 arc segments per ring with
    // big radar-sweep gaps between them.
    const segs = 2 + Math.floor(rand() * 3);
    let a = rand() * TAU;
    for (let s = 0; s < segs; s++) {
      const span = (TAU / segs) * (0.4 + rand() * 0.5);
      const a0 = a;
      const a1 = a + span;
      a = a1 + (TAU / segs) * (0.3 + rand() * 0.4); // gap after segment
      if (rand() < 0.15) continue; // sometimes drop a whole segment
      const count = Math.max(2, Math.floor(((a1 - a0) * r) / spacing));
      for (let i = 0; i <= count; i++) {
        if (rand() < 0.1) continue; // stipple holes within the segment
        const aa = a0 + (i / count) * (a1 - a0);
        const rr = r + (rand() - 0.5) * size * 0.012;
        cells.push({
          kind: "rect",
          cx: Math.cos(aa) * rr,
          cy: Math.sin(aa) * rr,
          w: dotR * 2,
          h: dotR * 2,
          rx: 0,
          rotation: (aa * 180) / Math.PI,
          color: palette[(k + i) % palette.length] ?? ink,
          revealOrder: Math.min(1, ringT),
          revealMode: "fade",
          birthOrigin: { x: 0, y: 0 },
          noSpin: true,
        });
      }
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// FINE RAYS — very thin radial lines around a central opening, with a
// LOBED ragged silhouette (per-angle reach from summed sines → petals,
// asymmetric edge) and dropped sectors so it never reads as a whole
// disc. A denser dark halo of short ticks rings the opening (ref).
export const buildFineRays: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const maxR = half * 1.02;
  const ink = darkestColor(palette);
  const accent = palette.find((c) => c !== ink) ?? lightestColor(palette);
  // Ripple of long concentric ARC strokes — the whole shape is built
  // from arcs at stepped radii, each a long sweep at a random start
  // angle with a swirl offset (so arcs spiral, not nest), varied
  // thickness, and gaps so the rings stay broken. Not radial arms.
  const swirl = (rand() < 0.5 ? 1 : -1) * (0.4 + rand() * 0.7);
  const ARCS = 34;
  // Each arc is built from DENSE small dash pieces (not a solid stroke)
  // so the concentric ripple reads as fine stippled arcs.
  const emitArc = (
    rIn: number,
    th: number,
    s0: number,
    s1: number,
    col: string,
    ord: number,
  ) => {
    const dashAng = 0.012 + rand() * 0.014;
    const gapAng = 0.005 + rand() * 0.008;
    let aa = s0;
    while (aa < s1) {
      const ae = Math.min(s1, aa + dashAng);
      if (rand() > 0.1) {
        const am = (aa + ae) / 2;
        cells.push({
          kind: "wedge",
          cx: Math.cos(am) * (rIn + th / 2),
          cy: Math.sin(am) * (rIn + th / 2),
          innerR: rIn,
          outerR: rIn + th,
          startA: aa,
          endA: ae,
          color: col,
          revealOrder: ord,
          revealMode: "grow",
          birthOrigin: { x: 0, y: 0 },
          noSpin: true,
        });
      }
      aa = ae + gapAng;
    }
  };
  let r = half * 0.13;
  for (let k = 0; k < ARCS && r < maxR; k++) {
    const t = k / (ARCS - 1);
    const thick = size * (0.01 + rand() * 0.022); // varied stroke weight
    const gap = size * (0.008 + rand() * 0.016);
    if (rand() < 0.05) {
      r += thick + gap;
      continue; // occasional missing ring → broken ripple
    }
    // Cycle the FULL palette across rings so every team colour shows.
    const col = palette[k % palette.length] ?? ink;
    // Long primary arc sweep, random start, spiralling with radius.
    const a0 = rand() * TAU + swirl * t * TAU;
    const a1 = a0 + Math.PI * (0.5 + rand() * 1.15); // ~90°–300°
    emitArc(r, thick, a0, a1, col, Math.min(1, t));
    // Sometimes a shorter second fragment on the same ring → broken arc.
    if (rand() < 0.5) {
      const b0 = a1 + (0.15 + rand() * 0.7);
      const b1 = b0 + Math.PI * (0.18 + rand() * 0.55);
      emitArc(r, thick, b0, b1, palette[(k + 2) % palette.length] ?? ink, Math.min(1, t));
    }
    r += thick + gap;
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ARC RIPPLE — like fine_rays (concentric ripple arcs), but each
// particle is a longer, more arch-y stroke instead of a fine dash.
export const buildArcRipple: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const ink = darkestColor(palette);
  const maxR = half * 1.02;
  const emitArc = (
    rIn: number,
    th: number,
    s0: number,
    s1: number,
    col: string,
    ord: number,
  ) => {
    const dashAng = 0.06 + rand() * 0.13; // longer span → arch-y particles
    const gapAng = 0.02 + rand() * 0.035;
    let aa = s0;
    while (aa < s1) {
      const ae = Math.min(s1, aa + dashAng);
      if (rand() > 0.12) {
        const am = (aa + ae) / 2;
        cells.push({
          kind: "wedge",
          cx: Math.cos(am) * (rIn + th / 2),
          cy: Math.sin(am) * (rIn + th / 2),
          innerR: rIn,
          outerR: rIn + th,
          startA: aa,
          endA: ae,
          color: col,
          revealOrder: ord,
          revealMode: "grow",
          birthOrigin: { x: 0, y: 0 },
          noSpin: true,
        });
      }
      aa = ae + gapAng;
    }
  };
  const swirl = (rand() < 0.5 ? 1 : -1) * (0.4 + rand() * 0.7);
  const ARCS = 34; // a bit denser
  let r = half * 0.13;
  for (let k = 0; k < ARCS && r < maxR; k++) {
    const t = k / (ARCS - 1);
    const thick = size * (0.012 + rand() * 0.028);
    const gap = size * (0.01 + rand() * 0.02);
    if (rand() < 0.06) {
      r += thick + gap;
      continue;
    }
    const col = palette[k % palette.length] ?? ink;
    const a0 = rand() * TAU + swirl * t * TAU;
    const a1 = a0 + Math.PI * (0.5 + rand() * 1.15);
    emitArc(r, thick, a0, a1, col, Math.min(1, t));
    if (rand() < 0.5) {
      const b0 = a1 + (0.15 + rand() * 0.7);
      const b1 = b0 + Math.PI * (0.18 + rand() * 0.55);
      emitArc(r, thick, b0, b1, palette[(k + 2) % palette.length] ?? ink, Math.min(1, t));
    }
    r += thick + gap;
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// BEAM PROJECTION — a directional "data beam": long rectangular bars
// radiating from a single far-left vanishing point and expanding right
// in a perspective cone. Each beam WIDENS with distance (speed/expansion)
// and is sliced into modular checker blocks with offset interruptions +
// clean negative space — Swiss-modernist / op-art, flat and engineered.
export const buildBeamProjection: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const ink = darkestColor(palette);
  const light = lightestColor(palette);
  const vpx = -half * 0.98;
  const vpy = (rand() - 0.5) * size * 0.04;
  const BEAMS = 20;
  const fanHalf = 0.58;
  const maxR = size * 1.75;
  for (let b = 0; b < BEAMS; b++) {
    const bt = b / (BEAMS - 1);
    const a = (bt - 0.5) * 2 * fanHalf;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const central = 1 - Math.min(1, Math.abs(a) / fanHalf);
    // Bold lane colour, every 3rd beam ink for high contrast.
    const beamColor = b % 3 === 0 ? ink : palette[b % palette.length] ?? ink;
    const phase = Math.floor(rand() * 2); // offset the checker per beam
    // Ragged reach so the outer edge isn't a clean arc (house rule).
    const reach = maxR * (0.6 + rand() * 0.4);
    let d = size * 0.05;
    let s = 0;
    while (d < reach) {
      const dn = d / maxR;
      const segLen = size * (0.03 + dn * 0.14); // rhythmic subdivision
      const gap = size * (0.008 + dn * 0.03);
      // Perpendicular width GROWS with distance → expansion / speed.
      const wPerp = size * (0.006 + dn * 0.085) * (0.5 + central * 0.8);
      const cx = vpx + cos * (d + segLen / 2);
      const cy = vpy + sin * (d + segLen / 2);
      const on = (s + phase) % 2 === 0; // checker slicing
      const interrupt = rand() < 0.12; // modular gap / offset interruption
      if (
        on &&
        !interrupt &&
        Math.abs(cx) < half * 1.14 &&
        Math.abs(cy) < half * 1.14
      ) {
        // Occasional black/white interruption block within a colour beam.
        const col =
          rand() < 0.16 ? (beamColor === ink ? light : ink) : beamColor;
        cells.push({
          kind: "rect",
          cx,
          cy,
          w: segLen,
          h: wPerp,
          rx: 0,
          rotation: (a * 180) / Math.PI,
          color: col,
          revealOrder: Math.min(1, dn * 1.8),
          revealMode: "grow",
          revealSpeed: 0.8,
          birthOrigin: { x: vpx, y: vpy },
          noSpin: true,
        });
      }
      d += segLen + gap;
      s++;
    }
  }
  return { cells, focal: randomOrient(cells, rand, { x: vpx, y: vpy }) };
};

// CONCENTRIC RINGS — tree-ring / radar ripple: many concentric rings of
// short tangential dashes that BREAK UP outward (inner rings near-whole,
// outer rings ragged/sparse), with a SOLID filled centre (a square, no
// hole — per the no-circles rule). Ref: "01" dashed-ring poster.
export const buildConcentricRings: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const ink = darkestColor(palette);
  const outerR = half * 1.0;
  const RINGS = 20;
  for (let k = 1; k <= RINGS; k++) {
    const ringT = k / RINGS;
    const r = outerR * Math.pow(ringT, 1.02);
    // Occasional longer arc dash for variety.
    const dashLen =
      size * (0.012 + ringT * 0.03) * (rand() < 0.15 ? 2.4 : 0.7 + rand() * 0.7);
    const gap = size * (0.01 + ringT * 0.02);
    const thick = Math.max(2, size * (0.006 + ringT * 0.008));
    const count = Math.max(6, Math.floor((TAU * r) / (dashLen + gap)));
    const ringRot = rand() * TAU;
    // Breakage grows outward: inner rings near-whole, outer ones ragged.
    const dropout = 0.07 + ringT * 0.4; // a bit denser
    for (let i = 0; i < count; i++) {
      if (rand() < dropout) continue;
      const a = (i / count) * TAU + ringRot;
      cells.push({
        kind: "rect",
        cx: Math.cos(a) * r,
        cy: Math.sin(a) * r,
        w: dashLen,
        h: thick,
        rx: 0,
        rotation: (a * 180) / Math.PI + 90, // tangential dash
        color: palette[k % palette.length] ?? ink,
        revealOrder: Math.min(1, ringT),
        revealMode: "grow",
        birthOrigin: { x: 0, y: 0 },
        noSpin: true,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// ARC CLUSTER — a tactical_scan variant where each concentric ring is
// COMBINED from many small arc fragments of different angular size,
// radial thickness, and start angle (layered/stacked), instead of a few
// clean ring segments. Reads as a denser, broken-up radar scan.
export const buildArcCluster: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const ink = darkestColor(palette);
  const accent = palette.find((c) => c !== ink) ?? lightestColor(palette);
  const R = half * 1.0;
  const RINGS = 7;
  const ringGap = R / RINGS;
  for (let k = 0; k < RINGS; k++) {
    const ringInner = k * ringGap;
    const ringOuter = (k + 1) * ringGap;
    const bandColor = rand() < 0.25 ? accent : ink;
    // Each ring is combined from many small arcs varying in angular
    // size, radial size, and angle — layered within the ring band.
    const frags = 5 + Math.floor(rand() * 7); // 5-11 per ring
    for (let f = 0; f < frags; f++) {
      if (rand() < 0.12) continue; // holes
      const a0 = rand() * TAU;
      const a1 = a0 + (0.12 + rand() * 0.9); // varied angular size
      const r0 = ringInner + rand() * ringGap * 0.5; // varied offset
      const r1 = Math.min(ringOuter, r0 + ringGap * (0.18 + rand() * 0.6)); // varied thickness
      const aMid = (a0 + a1) / 2;
      const rMid = (r0 + r1) / 2;
      cells.push({
        kind: "wedge",
        cx: Math.cos(aMid) * rMid,
        cy: Math.sin(aMid) * rMid,
        innerR: r0,
        outerR: r1,
        startA: a0,
        endA: a1,
        color: palette[Math.floor(rand() * palette.length)] ?? bandColor,
        revealOrder: Math.min(1, (k + 1) / RINGS),
        revealMode: "grow",
        birthOrigin: { x: 0, y: 0 },
        noSpin: true,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 }, wrapAnimation: refSpin };
};

// SHARD VORTEX — radial arms of chip segments spun into a pinwheel.
export const buildShardVortex: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const focus = refAngleFocus(rand);
  const ink = darkestColor(palette);
  const innerR = half * 0.02;
  const outerR = half * 1.06;
  const ARMS = 40;
  const swirl = (0.8 + rand() * 0.6) * (rand() < 0.5 ? 1 : -1);
  for (let arm = 0; arm < ARMS; arm++) {
    const a0 = (arm / ARMS) * TAU + (rand() - 0.5) * 0.06;
    const armMax = 0.5 + 0.5 * focus(a0) + rand() * 0.2;
    for (let s = 1; s <= 20; s++) {
      const t = s / 20;
      if (t > armMax) break;
      if (rand() < 0.18 || (s % 2 === 0 && rand() < 0.4)) continue;
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
        color: s % 2 ? ink : palette[arm % palette.length] ?? ink,
        revealOrder: Math.min(1, t),
        revealMode: "grow",
        birthOrigin: { x: 0, y: 0 },
        noSpin: true,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 }, wrapAnimation: refSpin };
};

// COLLAPSED QUADRANT — swirled segmented checker + bold flung wedges.
export const buildCollapsedQuadrant: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const ink = darkestColor(palette);
  const accent = palette.find((c) => c !== ink) ?? lightestColor(palette);
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
      if (Math.abs(d) < cutHalf) continue;
      if (rand() < 0.26) continue;
      cells.push({
        kind: "wedge",
        cx: Math.cos(aMid) * rMid,
        cy: Math.sin(aMid) * rMid,
        innerR: r0,
        outerR: r1,
        startA: a0,
        endA: a1,
        color: (i + k) % 2 === 0 ? ink : palette[(i + k) % palette.length] ?? accent,
        revealOrder: Math.min(1, ringT),
        revealMode: "grow",
        birthOrigin: { x: 0, y: 0 },
        noSpin: true,
      });
    }
  }
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
      revealOrder: 1,
      revealMode: "grow",
      birthOrigin: { x: 0, y: 0 },
      noSpin: true,
    });
  }
  return { cells, focal: { x: 0, y: 0 }, wrapAnimation: refSpin };
};

// PRIMARY SUNBURST — multicolour core + bold uneven wedges, focal lobe.
export const buildPrimarySunburst: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const focus = refAngleFocus(rand);
  const coreR = half * 0.3;
  const outerR = half * 1.06;
  for (let k = 0; k < 5; k++) {
    const r = coreR * (0.32 + 0.68 * (k / 5));
    const band = coreR * 0.12;
    for (let i = 0; i < 40; i++) {
      const seg = TAU / 40;
      const a0 = (i / 40) * TAU;
      // Density -1 notch (gentle): slightly lower keep → airier core.
      if (rand() > 0.36 + 0.46 * focus(a0)) continue;
      cells.push({
        kind: "wedge",
        cx: Math.cos(a0 + seg / 2) * r,
        cy: Math.sin(a0 + seg / 2) * r,
        innerR: Math.max(0, r - band),
        outerR: r,
        startA: a0,
        endA: a0 + seg * 0.82,
        color: palette[(i + k) % palette.length] ?? darkestColor(palette),
        revealOrder: Math.min(1, r / outerR),
        revealMode: "grow",
        birthOrigin: { x: 0, y: 0 },
        noSpin: true,
      });
    }
  }
  let ang = rand() * TAU;
  for (let i = 0; i < 20; i++) {
    const w = (TAU / 20) * (0.3 + rand() * 1.5);
    const a0 = ang;
    const a1 = ang + w;
    ang = a1 + (TAU / 20) * 0.18 * rand();
    const f = focus((a0 + a1) / 2);
    // Density -1 notch (gentle): slightly fewer outer rays.
    if (rand() > 0.26 + 0.55 * f) continue;
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
      color: palette[i % palette.length] ?? lightestColor(palette),
      revealOrder: Math.min(1, reach / outerR),
      revealMode: "grow",
      birthOrigin: { x: 0, y: 0 },
      noSpin: true,
    });
  }
  return { cells, focal: { x: 0, y: 0 } };
};

// CHECKER SPIRAL — segmented checker rings wound by a strong cumulative
// twist into spiral arms (the emerald-vortex look).
export const buildCheckerSpiral: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const R = half * 1.0;
  const RINGS = 22;
  const WEDGES = 40;
  const swirl = (1.4 + rand() * 0.8) * (rand() < 0.5 ? 1 : -1);
  const wedgeMax: number[] = [];
  // Ragged per-arm reach (0.45-1.0) → strongly asymmetric outer edge.
  for (let i = 0; i < WEDGES; i++) wedgeMax.push(0.45 + rand() * 0.55);
  for (let k = 1; k <= RINGS; k++) {
    const ringT = k / RINGS;
    const r0 = R * ((k - 1) / RINGS);
    const r1 = R * (k / RINGS);
    const rMid = (r0 + r1) / 2;
    const twist = swirl * ringT * TAU * 0.12;
    for (let i = 0; i < WEDGES; i++) {
      if ((k + i) % 2 !== 0) continue; // checker on-cells
      if (ringT > (wedgeMax[i] ?? 1)) continue;
      if (rand() < 0.24) continue; // more holes
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
        color: palette[(k + i) % palette.length] ?? darkestColor(palette),
        revealOrder: Math.min(1, ringT),
        revealMode: "grow",
        birthOrigin: { x: 0, y: 0 },
        noSpin: true,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 }, wrapAnimation: refSpin };
};

// RING SPIRAL — concentric rings of tangential dashes wound by a
// cumulative twist, with a spiralling C-opening + holes.
export const buildRingSpiral: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const innerR = half * 0.12;
  const outerR = half * 1.0;
  const RINGS = 16; // density -1 notch: fewer rings
  const swirlGap = (0.5 + rand() * 0.4) * (rand() < 0.5 ? 1 : -1);
  for (let k = 0; k < RINGS; k++) {
    const ringT = k / (RINGS - 1);
    const r = innerR + (outerR - innerR) * ringT;
    const gapCenter = swirlGap * k * 0.35 + rand() * 0.1;
    // Per-ring opening width → asymmetric C that breathes ring to ring.
    const openHalf = 0.4 + rand() * 0.7;
    const dashLen = size * (0.02 + ringT * 0.04);
    const gap = size * 0.018;
    const count = Math.max(8, Math.floor((TAU * r) / (dashLen + gap)));
    const ringRot = k * 0.15;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + ringRot;
      let d = a - gapCenter;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      if (Math.abs(d) < openHalf) continue; // spiralling C-opening (varies/ring)
      if (rand() < 0.42) continue; // more holes
      cells.push({
        kind: "rect",
        cx: Math.cos(a) * r,
        cy: Math.sin(a) * r,
        w: dashLen,
        h: Math.max(2, size * 0.014),
        rx: 0,
        rotation: (a * 180) / Math.PI + 90,
        color: palette[k % palette.length] ?? darkestColor(palette),
        revealOrder: Math.min(1, ringT),
        revealMode: "grow",
        birthOrigin: { x: 0, y: 0 },
        noSpin: true,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 }, wrapAnimation: refSpin };
};

// CHECKER TUNNEL — a two-tone checker spiralling INTO a tight vanishing
// centre (rings compressed inward) with a C-cut + ragged rim.
// REVIEW FLAG (#25): borderline — kept only because siblings match.
// Needs a second pass on legibility/density before final acceptance.
export const buildCheckerTunnel: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const R = half * 1.0;
  const RINGS = 20;
  const WEDGES = 36;
  const ink = darkestColor(palette);
  const swirl = (1.6 + rand() * 0.9) * (rand() < 0.5 ? 1 : -1);
  const cutCenter = rand() * TAU;
  const cutHalf = 0.5;
  const wedgeMax: number[] = [];
  for (let i = 0; i < WEDGES; i++) wedgeMax.push(0.82 + rand() * 0.18);
  for (let k = 1; k <= RINGS; k++) {
    const ringT = k / RINGS;
    const r0 = R * Math.pow((k - 1) / RINGS, 1.5);
    const r1 = R * Math.pow(k / RINGS, 1.5);
    const rMid = (r0 + r1) / 2;
    const twist = swirl * ringT * TAU * 0.1;
    for (let i = 0; i < WEDGES; i++) {
      if (ringT > (wedgeMax[i] ?? 1)) continue;
      const a0 = (i / WEDGES) * TAU + twist;
      const a1 = ((i + 1) / WEDGES) * TAU + twist;
      const aMid = (a0 + a1) / 2;
      let d = aMid - cutCenter;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      if (Math.abs(d) < cutHalf) continue; // C-cut
      if (rand() < 0.2) continue; // a bit more holes
      cells.push({
        kind: "wedge",
        cx: Math.cos(aMid) * rMid,
        cy: Math.sin(aMid) * rMid,
        innerR: r0,
        outerR: r1,
        startA: a0,
        endA: a1,
        color: (i + k) % 2 === 0 ? ink : palette[(i + k) % palette.length] ?? ink,
        revealOrder: Math.min(1, ringT),
        revealMode: "grow",
        birthOrigin: { x: 0, y: 0 },
        noSpin: true,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 }, wrapAnimation: refSpin };
};

// RADIAL BURST — dense thin radial bars from an empty centre, ragged
// lengths, with one contiguous accent sector.
export const buildRadialBurst: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const ink = darkestColor(palette);
  const accent = palette.find((c) => c !== ink) ?? lightestColor(palette);
  const innerR = half * 0.18;
  const N = 175;
  const step = TAU / N;
  const accentStart = rand() * TAU;
  const accentSpan = 1.0 + rand() * 0.6;
  for (let i = 0; i < N; i++) {
    // Was a near-rigid ±0.015 rad nudge; widen to ±1.4 steps so the
    // rays scatter unevenly — clumps and clearings instead of an even
    // comb of bars around the empty centre.
    const a = (i / N) * TAU + (rand() - 0.5) * step * 4.2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    // WILD length spread — stubs to full-length spikes, weighted short
    // so the rim is jagged and deep.
    const len = half * (0.16 + Math.pow(rand(), 1.7) * 0.98);
    const end = innerR + len;
    let d = a - accentStart;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    const isAccent = d >= 0 && d < accentSpan;
    const color = isAccent ? accent : palette[i % palette.length] ?? ink;
    const baseThick = size * (0.004 + Math.pow(rand(), 1.5) * 0.015);
    const rot = (a * 180) / Math.PI;
    // Each ray is built from CUTS — separated segments with gaps —
    // rather than one continuous bar.
    let rr = innerR + rand() * size * 0.02;
    while (rr < end) {
      const segLen = size * (0.03 + rand() * 0.09);
      const gap = size * (0.008 + rand() * 0.022);
      const segEnd = Math.min(end, rr + segLen);
      if (rand() > 0.12 && segEnd - rr > size * 0.012) {
        const m = (rr + segEnd) / 2;
        // Inner segments get a bold-weight boost (up to 2.4× near the
        // centre, fading to 1× at the rim) so the core carries mass.
        const rNorm = Math.min(1, m / half);
        const thick = baseThick * (1 + (1 - rNorm) * 2.0);
        // Nested-arc silhouette (#15): keep the segment only inside its
        // radial band's top-centred arc.
        if (!nestedArcDrop(cos * m, sin * m, half, -Math.PI * 0.85, 3))
        cells.push({
          kind: "rect",
          cx: cos * m,
          cy: sin * m,
          w: segEnd - rr,
          h: thick,
          rx: 0,
          rotation: rot,
          color,
          revealOrder: Math.min(1, (segEnd / half) * 0.7),
          revealMode: "grow",
          birthOrigin: { x: 0, y: 0 },
          noSpin: true,
        });
      }
      rr = segEnd + gap;
    }
  }
  return { cells, focal: { x: 0, y: 0 }, wrapAnimation: refSpin };
};

// PIXEL SWIRL — fine pixel chips spiralling into a tight centre with a
// C-opening; perspective-compressed rings + holes.
export const buildPixelSwirl: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const R = half * 1.0;
  const RINGS = 26;
  const swirl = (1.7 + rand() * 0.8) * (rand() < 0.5 ? 1 : -1);
  const cutCenter = rand() * TAU;
  for (let k = 1; k <= RINGS; k++) {
    const ringT = k / RINGS;
    const r = R * Math.pow(ringT, 1.4);
    const twist = swirl * ringT * TAU * 0.1;
    const chip = size * (0.012 + ringT * 0.03);
    const gap = size * 0.012;
    const count = Math.max(8, Math.floor((TAU * r) / (chip + gap)));
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + twist;
      let d = a - cutCenter;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      const cutHalf = 0.45;
      if (Math.abs(d) < cutHalf) continue; // C-opening
      // Feather the opening edge so it dissolves naturally instead of
      // cutting on a hard straight line.
      if (Math.abs(d) < cutHalf + 0.45 && rand() < 1 - (Math.abs(d) - cutHalf) / 0.45)
        continue;
      if ((k + i) % 2 !== 0) continue; // checker
      if (rand() < 0.12) continue;
      const rr = r + (rand() - 0.5) * chip * 0.9; // organic radial jitter
      cells.push({
        kind: "rect",
        cx: Math.cos(a) * rr,
        cy: Math.sin(a) * rr,
        w: chip,
        h: chip,
        rx: 0,
        rotation: (a * 180) / Math.PI + 45,
        color: palette[(k + i) % palette.length] ?? darkestColor(palette),
        revealOrder: Math.min(1, ringT),
        revealMode: "grow",
        birthOrigin: { x: 0, y: 0 },
        noSpin: true,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 }, wrapAnimation: refSpin };
};

// SOLAR FLARE — dense segmented radial spikes from an empty centre
// (checker-coloured chips along each spike, ragged lengths) + a few
// BOLD wedges flung far past the rim.
export const buildSolarFlare: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const ink = darkestColor(palette);
  const accent = palette.find((c) => c !== ink) ?? lightestColor(palette);
  const innerR = half * 0.16;
  const N = 150;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU + (rand() - 0.5) * 0.04;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const reach = innerR + (half * 0.95 - innerR) * (0.4 + rand() * 0.6);
    const STEPS = 8;
    for (let s = 0; s < STEPS; s++) {
      const t = s / STEPS;
      if (rand() < 0.25) continue; // gaps along the spike
      const r = innerR + (reach - innerR) * t;
      cells.push({
        kind: "rect",
        cx: cos * r,
        cy: sin * r,
        w: ((reach - innerR) / STEPS) * 0.82,
        h: size * (0.005 + t * 0.008),
        rx: 0,
        rotation: (a * 180) / Math.PI,
        color: s % 2 ? ink : palette[i % palette.length] ?? accent,
        revealOrder: Math.min(1, t),
        revealMode: "grow",
        birthOrigin: { x: 0, y: 0 },
        noSpin: true,
      });
    }
  }
  const BIG = 5 + Math.floor(rand() * 3);
  for (let b = 0; b < BIG; b++) {
    const a = rand() * TAU;
    const w = 0.05 + rand() * 0.07;
    const reach = half * (1.0 + rand() * 0.45);
    const rMid = (innerR + reach) / 2;
    cells.push({
      kind: "wedge",
      cx: Math.cos(a + w / 2) * rMid,
      cy: Math.sin(a + w / 2) * rMid,
      innerR,
      outerR: reach,
      startA: a,
      endA: a + w,
      color: b % 2 ? accent : ink,
      revealOrder: 1,
      revealMode: "grow",
      birthOrigin: { x: 0, y: 0 },
      noSpin: true,
    });
  }
  return { cells, focal: { x: 0, y: 0 }, wrapAnimation: refSpin };
};

// TACTICAL SCAN — concentric thick arc rings broken into segments with
// gaps (radar sweep) + a solid hub; ragged, occasional accent ring.
export const buildTacticalScan: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const ink = darkestColor(palette);
  const R = half * 1.0;
  const RINGS = 10;
  // Empty central hub — keep arcs out of the middle so the shape reads
  // as concentric RINGS rather than a filled disc. Rings are spaced
  // across [holeR, R] instead of [0, R].
  const holeR = half * 0.36;
  const ringGap = (R - holeR) / RINGS;
  // Per-segment palette index so every team colour appears (even a low-
  // weight one like a 10% accent), in flag proportion.
  let ci = 0;
  for (let k = 0; k < RINGS; k++) {
    const ringCenter = holeR + (k + 0.5) * ringGap;
    const kt = k / (RINGS - 1);
    // Denser than before: more arcs per ring, climbing outward.
    const segs = 2 + Math.floor(rand() * 3) + Math.round(kt * 4);
    let a = rand() * TAU;
    for (let s = 0; s < segs; s++) {
      const span = (TAU / segs) * (0.25 + rand() * 0.7);
      const a0 = a;
      const a1 = a + span;
      a = a1 + (TAU / segs) * (0.2 + rand() * 0.45); // tighter gaps → denser
      // Much lower dropout so the rings actually fill in.
      if (rand() < 0.06 + (1 - kt) * 0.22) continue;
      // Play with sizes: each arc gets its own radial THICKNESS (thin
      // hairline arcs beside chunky bands) and a jittered mid-radius.
      const thick = ringGap * (0.28 + Math.pow(rand(), 0.8) * 0.9);
      const rMid = ringCenter + (rand() - 0.5) * ringGap * 0.3;
      const r0 = Math.max(holeR, rMid - thick / 2);
      const r1 = rMid + thick / 2;
      const aMid = (a0 + a1) / 2;
      cells.push({
        kind: "wedge",
        cx: Math.cos(aMid) * rMid,
        cy: Math.sin(aMid) * rMid,
        innerR: r0,
        outerR: r1,
        startA: a0,
        endA: a1,
        color: palette[ci++ % palette.length] ?? ink,
        revealOrder: Math.min(1, (k + 1) / RINGS),
        revealMode: "grow",
        birthOrigin: { x: 0, y: 0 },
        noSpin: true,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 }, wrapAnimation: refSpin };
};

// SPIRAL TUNNEL — concentric rings of arc dashes spiralling out from a
// tiny dense centre, with the ring centres DRIFTING off-axis so it reads
// as an eccentric perspective tunnel. Two-tone, holes, ragged.
export const buildSpiralTunnel: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const ink = darkestColor(palette);
  const accent = palette.find((c) => c !== ink) ?? lightestColor(palette);
  const R = half * 0.95;
  const RINGS = 22;
  const driftX = (rand() - 0.5) * half * 0.35;
  const driftY = half * 0.4 * (rand() < 0.5 ? 1 : -1);
  for (let k = 1; k <= RINGS; k++) {
    const ringT = k / RINGS;
    const r = R * Math.pow(ringT, 1.05);
    const ox = driftX * ringT;
    const oy = driftY * ringT;
    const ringRot = k * 0.2;
    const dashLen = size * (0.02 + ringT * 0.06);
    const gap = size * (0.015 + ringT * 0.02);
    const count = Math.max(6, Math.floor((TAU * r) / (dashLen + gap)));
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + ringRot;
      if (rand() < 0.22) continue; // holes / broken rings
      const cx = ox + Math.cos(a) * r;
      const cy = oy + Math.sin(a) * r;
      cells.push({
        kind: "rect",
        cx,
        cy,
        w: dashLen,
        h: Math.max(2, size * (0.01 + ringT * 0.02)),
        rx: 0,
        rotation: (a * 180) / Math.PI + 90,
        color: palette[(i + k) % palette.length] ?? ink,
        revealOrder: Math.min(1, ringT),
        revealMode: "grow",
        birthOrigin: { x: cx, y: cy },
        noSpin: true,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 }, wrapAnimation: refSpin };
};

// CHIP STORM — a dense full-circle swirl of small rotated chips spun out
// from a dark packed centre, jittered in position + angle, two-tone,
// thinning + ragged toward the rim.
export const buildChipStorm: ShapeBuilder = (seed, size, palette) => {
  const rand = mulberry32(seed);
  const half = size / 2;
  const cells: Cell[] = [];
  const ink = darkestColor(palette);
  const accent = palette.find((c) => c !== ink) ?? lightestColor(palette);
  const R = half * 1.0;
  const RINGS = 26;
  const swirl = (1.3 + rand() * 0.8) * (rand() < 0.5 ? 1 : -1);
  for (let k = 1; k <= RINGS; k++) {
    const ringT = k / RINGS;
    const r = R * Math.pow(ringT, 1.1);
    const twist = swirl * ringT * TAU * 0.12;
    const chip = size * (0.012 + ringT * 0.025);
    // Tighter spacing so the centre packs densely (focal point).
    const count = Math.max(8, Math.floor((TAU * r) / (chip * 1.6)));
    for (let i = 0; i < count; i++) {
      // Centre is the focus: near-zero dropout in the core, climbing
      // steeply so chips thin out fast toward the rim.
      if (rand() < 0.04 + ringT * 0.78) continue;
      const a = (i / count) * TAU + twist + (rand() - 0.5) * 0.12;
      const rr = r + (rand() - 0.5) * chip * 1.6;
      cells.push({
        kind: "rect",
        cx: Math.cos(a) * rr,
        cy: Math.sin(a) * rr,
        w: chip,
        h: chip * (0.6 + rand() * 0.8),
        rx: 0,
        rotation: (a * 180) / Math.PI + 45 + (rand() - 0.5) * 40,
        color: rand() < 0.5 ? accent : ink,
        revealOrder: Math.min(1, ringT),
        revealMode: "grow",
        birthOrigin: { x: 0, y: 0 },
        noSpin: true,
      });
    }
  }
  return { cells, focal: { x: 0, y: 0 }, wrapAnimation: refSpin };
};

// ─────────────────────────────────────────────────────────────────────
// Registry — used by the showcase to iterate families.
// ─────────────────────────────────────────────────────────────────────
export const SHAPE_BUILDERS: Record<ShapeFamily, ShapeBuilder> = {
  color_dial: buildColorDial,
  thin_spokes: buildThinSpokes,
  halftone_arc: buildHalftoneArc,
  fragmented_burst: buildFragmentedBurst,
  warped_checker: buildWarpedChecker,
  wedges: buildWedges,
  radial_checker: buildRadialChecker,
  sphere_grid: buildSphereGrid,
  interference_mandala: buildInterferenceMandala,
  chevron_dots: buildChevronDots,
  shatter_mandala: buildShatterMandala,
  pixel_bloom: buildPixelBloom,
  burst_segments: buildBurstSegments,
  vortex_disc: buildVortexDisc,
  vortex_disc_diagonal: buildVortexDiscDiagonal,
  vortex_disc_flat: buildVortexDiscFlat,
  vortex_disc_spinner: buildVortexDiscSpinner,
  polar_swirl: buildPolarSwirl,
  swirl_checker: buildSwirlChecker,
  signal_fan: buildSignalFan,
  shard_vortex: buildShardVortex,
  collapsed_quadrant: buildCollapsedQuadrant,
  primary_sunburst: buildPrimarySunburst,
  checker_spiral: buildCheckerSpiral,
  ring_spiral: buildRingSpiral,
  checker_tunnel: buildCheckerTunnel,
  radial_burst: buildRadialBurst,
  pixel_swirl: buildPixelSwirl,
  solar_flare: buildSolarFlare,
  tactical_scan: buildTacticalScan,
  spiral_tunnel: buildSpiralTunnel,
  chip_storm: buildChipStorm,
  perspective_fan: buildPerspectiveFan,
  ripple_dots: buildRippleDots,
  fine_rays: buildFineRays,
  beam_projection: buildBeamProjection,
  concentric_rings: buildConcentricRings,
  arc_cluster: buildArcCluster,
  arc_ripple: buildArcRipple,
};

export const SHAPE_FAMILIES: ShapeFamily[] = [
  "color_dial",
  "thin_spokes",
  "halftone_arc",
  "fragmented_burst",
  "warped_checker",
  "wedges",
  "radial_checker",
  "interference_mandala",
  "chevron_dots",
  "shatter_mandala",
  "pixel_bloom",
  "burst_segments",
  "vortex_disc",
  "vortex_disc_diagonal",
  "vortex_disc_flat",
  "vortex_disc_spinner",
  "polar_swirl",
  "swirl_checker",
  "signal_fan",
  "shard_vortex",
  "primary_sunburst",
  "checker_spiral",
  "ring_spiral",
  "checker_tunnel",
  "radial_burst",
  "pixel_swirl",
  "solar_flare",
  "tactical_scan",
  "spiral_tunnel",
  "perspective_fan",
  "ripple_dots",
  "fine_rays",
  "beam_projection",
  "concentric_rings",
  "arc_cluster",
  "arc_ripple",
];

// Structural taxonomy — groups the families by archetype. Used by the
// showcase to render labelled sections instead of one flat grid. Each
// family keeps its global SHAPE_FAMILIES number regardless of group.
export const SHAPE_CATEGORIES: { name: string; families: ShapeFamily[] }[] = [
  // Each group is defined by ONE distinct structural principle so there is
  // no conceptual overlap between categories.
  {
    // Straight lines / wedges emanating from the center — spokes, rays,
    // sunbursts and wedge mosaics all share this radial-emanation principle.
    name: "Rays & bursts",
    families: [
      "thin_spokes",
      "radial_burst",
      "fine_rays",
      "shatter_mandala",
      "fragmented_burst",
      "burst_segments",
      "primary_sunburst",
      "solar_flare",
      "color_dial",
    ],
  },
  {
    // Concentric circular structure — rings and arcs stacked around a center.
    name: "Rings & arcs",
    families: [
      "halftone_arc",
      "interference_mandala",
      "tactical_scan",
      "arc_cluster",
      "ripple_dots",
      "concentric_rings",
      "arc_ripple",
    ],
  },
  {
    // Rotational swirl — anything whose dominant motion is a spiral/vortex.
    // Includes the warped/radial checkers and the two tunnels, which read
    // as spiralling/receding rotation rather than flat grids.
    name: "Spirals & vortices",
    families: [
      "vortex_disc",
      "vortex_disc_diagonal",
      "vortex_disc_flat",
      "vortex_disc_spinner",
      "polar_swirl",
      "swirl_checker",
      "shard_vortex",
      "checker_spiral",
      "ring_spiral",
      "warped_checker",
      "radial_checker",
      "wedges",
      "checker_tunnel",
      "spiral_tunnel",
    ],
  },
  {
    // Pixel / dot tilings — small repeated cells, no checker grid or swirl.
    name: "Pixel & dot fields",
    families: ["pixel_bloom", "chevron_dots", "pixel_swirl"],
  },
  {
    // Depth / 3D — beams and perspective fans read as receding space.
    name: "Perspective fans & beams",
    families: ["signal_fan", "perspective_fan", "beam_projection"],
  },
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
  // Eruption origin for this render. Randomised per goal so the bloom
  // doesn't always start dead-centre.
  focal: { x: number; y: number };
};

export const applyShapeVariation = (
  built: { cells: Cell[]; focal: { x: number; y: number } },
  variationSeed: number,
): ShapeVariation => {
  const rand = mulberry32(variationSeed >>> 0);
  // Density — pick one of three density "modes" (sparse / medium / full)
  // and a random amount within it, so two renders of the same family read
  // clearly differently rather than identically every time.
  const densityRoll = rand();
  const cutAmount =
    densityRoll < 0.34
      ? 0.45 + rand() * 0.25 // sparse — drop 45–70%
      : densityRoll < 0.67
        ? 0.18 + rand() * 0.24 // medium — drop 18–42%
        : rand() * 0.12; // full — drop 0–12%
  const cells = built.cells.filter(() => rand() > cutAmount);

  // Eruption focal — move the origin to a RANDOM cell of the shape (not
  // the centre) ~85% of the time, so the bloom flows from a different
  // point each render and the minute/scorer label rides that point.
  let focal = built.focal;
  if (cells.length > 0 && rand() < 0.85) {
    const pick = cells[Math.floor(rand() * cells.length)]!;
    focal = { x: pick.cx, y: pick.cy };
  }

  // Rotation amount — random continuous spin. ~30% of renders stay
  // still (rate near 0); the rest spin slowly in either direction.
  const spinRoll = rand();
  const spinDegPerSec =
    spinRoll < 0.3 ? 0 : (rand() - 0.5) * 24; // ±12°/s

  return { cells, spinDegPerSec, focal };
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
// `whiteCells` (optional) repaints just the near-white (flag-white,
// e.g. #EFEFEF) cells to a pure white fill + hairline border so they
// read as crisp white panels on the pitch. Every coloured cell keeps
// its team colour untouched. When unset, cells render exactly as built
// (flag-white stays its grey #EFEFEF with no border).
export type WhiteCellStyle = { fill: string; stroke: string; strokeWidth: number };
const renderCellPrimitive = (
  cell: Cell,
  whiteCells?: WhiteCellStyle,
): React.ReactElement => {
  const isWhite = whiteCells ? colorLuminance(cell.color) > 225 : false;
  const fill = isWhite ? whiteCells!.fill : cell.color;
  const strokeProps = isWhite
    ? { stroke: whiteCells!.stroke, strokeWidth: whiteCells!.strokeWidth }
    : {};
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
          fill={fill}
          transform={inner}
          {...strokeProps}
        />
      );
    }
    case "circle":
      return (
        <circle cx={cell.cx} cy={cell.cy} r={cell.r} fill={fill} {...strokeProps} />
      );
    case "line":
      return (
        <line
          x1={cell.x1}
          y1={cell.y1}
          x2={cell.x2}
          y2={cell.y2}
          // A near-white line is invisible on the pitch — draw it in the
          // border colour instead; coloured lines keep their colour.
          stroke={isWhite ? whiteCells!.stroke : cell.color}
          strokeWidth={cell.strokeW}
          strokeLinecap="butt"
        />
      );
    case "wedge":
      return (
        <path
          d={wedgePath(cell.innerR, cell.outerR, cell.startA, cell.endA)}
          fill={fill}
          {...strokeProps}
        />
      );
    case "path":
      return <path d={cell.d} fill={fill} {...strokeProps} />;
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
  // Warps the stagger PACING along the window. The per-cell delay is
  // `ratio ** staggerPower`, so:
  //   1   → linear (default, constant appearance rate — original feel)
  //   >1  → "explosion → slow motion": inner cells bunch up and fire
  //         almost together at the start, then each successive ring is
  //         spread further apart in time, so the tail crawls in like
  //         slow-mo. Higher = more violent start + longer slow tail.
  //   <1  → the inverse (slow start, rushed finish).
  staggerPower?: number;
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
  // When set, near-white cells repaint to a pure white fill + hairline
  // border; coloured cells keep their team colour. Off = render as built.
  whiteCells?: WhiteCellStyle;
}> = ({ cells, focal, localFrame, wrapAnimation, playToken = 0, revealOverrides, breathing = false, autoPlay = true, whiteCells }) => {
  const wrapT = wrapAnimation ? wrapAnimation(localFrame) : "";
  // One ref per cell — outer = vortex wrapper (rotates around shape
  // origin), inner = reveal wrapper (scales / translates around the
  // cell's own centre). Both can run independent GSAP tweens.
  const vortexRefs = useRef<Array<SVGGElement | null>>([]);
  const revealRefs = useRef<Array<SVGGElement | null>>([]);

  useRevealLayoutEffect(() => {
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
      // Warp the pacing: ratio ** staggerPower. Power 1 (default) keeps
      // the original constant-rate stagger; power >1 makes the centre
      // erupt fast and the outer rings drift in like slow motion.
      const staggerPower = revealOverrides?.staggerPower ?? 1;
      const pacedRatio =
        staggerPower === 1 ? ratio : Math.pow(ratio, staggerPower);
      const delaySec = pacedRatio * Math.max(0.05, totalStagger - perCellSec);
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
      // svgOrigin uses ABSOLUTE SVG user-space coords (not the
      // element's bounding-box) so the scale pivot is exactly the
      // cell's (cx, cy). This matters for cells whose drawn geometry
      // isn't centred on (cx, cy) — e.g. THIN_SPOKES lines anchored
      // at the hub (cx=cy=0): they now grow from the origin outward
      // instead of from their bounding-box corner.
      gsap.set(revealEl, {
        svgOrigin: `${cell.cx} ${cell.cy}`,
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
              {renderCellPrimitive(cell, whiteCells)}
            </g>
          </g>
        ))}
      </g>
    </g>
  );
};
