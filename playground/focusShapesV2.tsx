import React from "react";

// focusShapesV2 — abstract, modular, generative shape primitives for the
// MatchFocusV2 surface. Each family follows the same authoring law:
//
//   simple unit + clear focal + spreading rule + ONE gradual parameter
//   change + controlled disruption + active negative space + structural
//   fade at the rim (no opacity, no cutout)
//
// All families return a centered SVG <g>. The caller translates the
// group to its goal position. Sizes are in px; the bounding extent of
// each shape stays inside (-size/2, +size/2).

export type FocusFamily =
  | "radial_spokes"
  | "dotted_arcs"
  | "drift_grid"
  | "perspective_stripes"
  | "sawtooth_spiral"
  | "ring_compression";

export type FocusRecipe = {
  family: FocusFamily;
  seed: number;
  size: number;
  // Focal offset in [-1, 1] across the local box. 0,0 = centered.
  focal?: { x: number; y: number };
  // Two-colour duo: ink does the mass, accent is the disruption colour.
  ink: string;
  accent: string;
};

const TAU = Math.PI * 2;

// Tiny seeded RNG so each goal id renders deterministically.
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

// Each family signature is the same so MatchFocusV2 can swap them
// freely. The wrapper picks based on recipe.family.
export const FocusShape: React.FC<{ recipe: FocusRecipe }> = ({ recipe }) => {
  switch (recipe.family) {
    case "radial_spokes":
      return <RadialSpokes recipe={recipe} />;
    case "dotted_arcs":
      return <DottedArcs recipe={recipe} />;
    case "drift_grid":
      return <DriftGrid recipe={recipe} />;
    case "perspective_stripes":
      return <PerspectiveStripes recipe={recipe} />;
    case "sawtooth_spiral":
      return <SawtoothSpiral recipe={recipe} />;
    case "ring_compression":
      return <RingCompression recipe={recipe} />;
  }
};

// Convenience — pick a family for a goal index so the same fixture
// always cycles through the five families in a stable order.
export const FAMILY_CYCLE: FocusFamily[] = [
  "ring_compression",
  "radial_spokes",
  "dotted_arcs",
  "drift_grid",
  "perspective_stripes",
  "sawtooth_spiral",
];

export const familyForIndex = (i: number): FocusFamily =>
  FAMILY_CYCLE[((i % FAMILY_CYCLE.length) + FAMILY_CYCLE.length) %
    FAMILY_CYCLE.length]!;

// ─────────────────────────────────────────────────────────────────────
// FAMILY F — RING COMPRESSION
//
// Primitive: short rounded dash. Focal: centre, with energy pushed
// outward along a single axis (the "compression spine"). Law: K
// concentric rings × N evenly-spaced dashes. Gradual change: dash
// length + thickness scale up sharply as the dash's angle approaches
// the compression axis, so the whole disc reads as if a vertical
// pressure wave is squeezing through it. Active negative space: tight
// central void + thinner dash density along the perpendicular axis.
// Rim: outermost ring carries oversized "ears" along the spine so the
// boundary dissolves through size growth rather than clipping.
// ─────────────────────────────────────────────────────────────────────
const RingCompression: React.FC<{ recipe: FocusRecipe }> = ({ recipe }) => {
  const { size, seed, ink, accent, focal } = recipe;
  const r = size / 2;
  const fx = (focal?.x ?? 0) * r * 0.06;
  const fy = (focal?.y ?? 0) * r * 0.06;
  const rand = mulberry32(seed);
  // ── Per-seed variation knobs ──────────────────────────────────────
  // Every goal gets its own combination of spine angle, compression
  // sharpness, ring count, and dash density so no two goals on the
  // same card read identically — the recipe is one family but the
  // visual signature is unique per goal id.
  const spineAngle = rand() * Math.PI; // 0..π full rotation
  // Pull a SECOND spine sometimes — half the goals get a single axis,
  // half get a perpendicular cross axis for an X-shaped squeeze.
  const hasCrossSpine = rand() < 0.45;
  const compressionPower = 3 + rand() * 4; // 3..7 — sharper = tighter
  const compressionStrength = 1.3 + rand() * 1.9; // 1.3..3.2
  const RINGS = 9 + Math.floor(rand() * 5); // 9..13
  const DASHES = 24 + Math.floor(rand() * 14); // 24..37
  const innerRFrac = 0.09 + rand() * 0.09; // 0.09..0.18
  const innerR = r * innerRFrac;
  const baseDashLen = r * (0.07 + rand() * 0.035); // 0.07..0.105
  const baseDashW = r * (0.018 + rand() * 0.012); // 0.018..0.030
  const elements: React.ReactElement[] = [];

  for (let k = 0; k < RINGS; k++) {
    const t = k / (RINGS - 1);
    // Inner rings get a bit closer to the centre so the void stays
    // visible but the spiral feels rooted; outer rings extend slightly
    // past r to read as "ears" punching out of the disc.
    const ringR = innerR + (r * 1.04 - innerR) * (0.06 + 0.94 * t);
    // Subtle staircase rotation between rings so the dash columns
    // shimmer rather than line up dead-straight along radii.
    const ringOffset = (k % 2 === 0 ? 0 : (Math.PI / DASHES) * 0.5)
      + k * 0.012;

    for (let i = 0; i < DASHES; i++) {
      const a = (i / DASHES) * TAU + ringOffset;
      const aRel = a - spineAngle;
      const proxA = Math.abs(Math.cos(aRel));
      // Optional perpendicular cross-spine: the larger of the two
      // proximities drives the compression, producing X-shaped
      // squeezes for some goals and single-axis squeezes for others.
      const proxB = hasCrossSpine ? Math.abs(Math.sin(aRel)) : 0;
      const verticalProx = Math.max(proxA, proxB);
      const compression = Math.pow(verticalProx, compressionPower);
      const lenMul = 1 + compression * compressionStrength * 0.6;
      const widMul = 1 + compression * compressionStrength;
      // Outermost ring carries a global size bump so the "ears"
      // stick out beyond the main disc.
      const ringBoost = k === RINGS - 1 ? 1.45 : 1;
      const dashLen = baseDashLen * lenMul * ringBoost;
      const dashW = baseDashW * widMul * ringBoost;
      const cx = Math.cos(a);
      const cy = Math.sin(a);
      const px = fx + cx * ringR;
      const py = fy + cy * ringR;
      const angDeg = (a * 180) / Math.PI + 90;
      // Two innermost rings get the accent colour so the focal has a
      // detectable warmer core; everything else paints ink.
      const fill = k < 2 ? accent : ink;
      elements.push(
        <rect key={`rc${k}-${i}`}
          x={-dashLen / 2}
          y={-dashW / 2}
          width={dashLen}
          height={dashW}
          rx={dashW * 0.5}
          fill={fill}
          transform={`translate(${px.toFixed(2)} ${py.toFixed(2)}) rotate(${angDeg.toFixed(2)})`}
        />,
      );
    }
  }
  return <g>{elements}</g>;
};

// ─────────────────────────────────────────────────────────────────────
// FAMILY A — RADIAL SPOKES
//
// Primitive: thin bar. Focal: centre (slightly offset by `focal`). Law:
// N angular spokes; each spoke's length is modulated by a smooth angular
// wave so the silhouette breathes. Disruption: short gaps along ~20% of
// spokes. Rim: spokes shorten + thin AND drop out, never get clipped.
// ─────────────────────────────────────────────────────────────────────
const RadialSpokes: React.FC<{ recipe: FocusRecipe }> = ({ recipe }) => {
  const { size, seed, ink, accent, focal } = recipe;
  const r = size / 2;
  const fx = (focal?.x ?? 0) * r * 0.35;
  const fy = (focal?.y ?? 0) * r * 0.35;
  const rand = mulberry32(seed);
  const N = 56; // ≤10 rule applies to "shape patterns"; spokes are a
  // single primitive that gets read as a unit. Keep on the sparser side.
  const innerR = r * 0.22; // active negative-space disc
  const elements: React.ReactElement[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    // Angular wave gives the silhouette a flowing, breathing edge.
    const wave =
      0.55 +
      0.45 * Math.cos(a * 2 + seed * 0.013) +
      0.18 * Math.cos(a * 5 + seed * 0.07);
    const norm = Math.max(0.18, Math.min(1, wave));
    const len = (r - innerR) * norm;
    const strokeW = Math.max(1.2, r * 0.014 * (0.7 + 0.6 * norm));
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    const x1 = fx + cx * innerR;
    const y1 = fy + cy * innerR;
    const x2 = fx + cx * (innerR + len);
    const y2 = fy + cy * (innerR + len);
    // Controlled disruption — every Nth spoke gets a mid-segment gap so
    // the rhythm reads as a pulse, not a uniform fan.
    const broken = rand() < 0.22;
    if (broken) {
      const gapA = 0.42 + rand() * 0.15;
      const gapB = gapA + 0.1 + rand() * 0.08;
      const ax = fx + cx * (innerR + len * gapA);
      const ay = fy + cy * (innerR + len * gapA);
      const bx = fx + cx * (innerR + len * gapB);
      const by = fy + cy * (innerR + len * gapB);
      elements.push(
        <line key={`s${i}a`} x1={x1} y1={y1} x2={ax} y2={ay}
          stroke={ink} strokeWidth={strokeW} strokeLinecap="butt" />,
        <line key={`s${i}b`} x1={bx} y1={by} x2={x2} y2={y2}
          stroke={ink} strokeWidth={strokeW * 0.7} strokeLinecap="butt" />,
      );
    } else {
      elements.push(
        <line key={`s${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={ink} strokeWidth={strokeW} strokeLinecap="butt" />,
      );
    }
  }
  void rand; // silence unused-warning when no breakage branches fire
  // Accent ticks — sparse short bars that ride the outer ring, marking
  // every 7th spoke so the focal has a satellite rhythm.
  for (let i = 0; i < N; i += 7) {
    const a = (i / N) * TAU + 0.04;
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    const rOut = r * 0.92;
    const tickLen = r * 0.06;
    elements.push(
      <line key={`tick${i}`}
        x1={fx + cx * rOut} y1={fy + cy * rOut}
        x2={fx + cx * (rOut + tickLen)} y2={fy + cy * (rOut + tickLen)}
        stroke={accent} strokeWidth={r * 0.022} strokeLinecap="butt" />,
    );
  }
  return <g>{elements}</g>;
};

// ─────────────────────────────────────────────────────────────────────
// FAMILY B — DOTTED ARCS
//
// Primitive: short rectangular dash. Focal: centre with a slight side
// offset. Law: K concentric rings × per-ring dashes. Disruption: each
// ring drops a 60-90° arc to read as a comma / aperture. Rim: outermost
// rings have fewer, smaller dashes.
// ─────────────────────────────────────────────────────────────────────
const DottedArcs: React.FC<{ recipe: FocusRecipe }> = ({ recipe }) => {
  const { size, seed, ink, accent, focal } = recipe;
  const r = size / 2;
  const fx = (focal?.x ?? 0) * r * 0.25;
  const fy = (focal?.y ?? 0) * r * 0.25;
  const rand = mulberry32(seed);
  const K = 9; // rings, low side so each ring stays legible
  const innerR = r * 0.20; // active central void
  const elements: React.ReactElement[] = [];
  // Each ring drops a wedge — the wedge rotates per ring so the missing
  // arc traces a slow spiral around the focal.
  const wedgeStart = rand() * TAU;
  for (let k = 0; k < K; k++) {
    const t = k / (K - 1);
    const ringR = innerR + (r - innerR) * (0.08 + 0.92 * t);
    const dashes = Math.max(18, Math.round(28 + t * 36)); // dilutes by N
    const dashLen = r * 0.06 * (1 - t * 0.55);
    const dashW = r * (0.014 + 0.018 * (1 - t));
    const dropStart = wedgeStart + k * 0.42;
    const dropArc = 0.9 + 0.4 * Math.sin(k * 0.7);
    for (let i = 0; i < dashes; i++) {
      const a = (i / dashes) * TAU;
      // Drop the dashes that fall inside the rotating wedge.
      const phase = ((a - dropStart) % TAU + TAU) % TAU;
      if (phase < dropArc) continue;
      const cx = Math.cos(a);
      const cy = Math.sin(a);
      const px = fx + cx * ringR;
      const py = fy + cy * ringR;
      const angDeg = (a * 180) / Math.PI + 90;
      elements.push(
        <rect key={`a${k}-${i}`}
          x={-dashLen / 2} y={-dashW / 2}
          width={dashLen} height={dashW}
          fill={k === K - 1 ? accent : ink}
          transform={`translate(${px} ${py}) rotate(${angDeg})`} />,
      );
    }
  }
  return <g>{elements}</g>;
};

// ─────────────────────────────────────────────────────────────────────
// FAMILY C — DRIFT GRID
//
// Primitive: small square. Focal: a corner of the box. Law: square grid
// of cells; cell scale grows toward the focal corner and shrinks toward
// the opposite corner, so the shape dissolves structurally at the rim.
// Disruption: a stripe of cells rotates 45° along a diagonal band.
// Active negative-space: the far corner is left as sparse dots only.
// ─────────────────────────────────────────────────────────────────────
const DriftGrid: React.FC<{ recipe: FocusRecipe }> = ({ recipe }) => {
  const { size, seed, ink, accent, focal } = recipe;
  const half = size / 2;
  const rand = mulberry32(seed);
  // Pick a focal corner from the focal hint (default top-left).
  const fcx = (focal?.x ?? -0.7);
  const fcy = (focal?.y ?? -0.7);
  const fx = fcx * half;
  const fy = fcy * half;
  const cols = 11; // sparser than cellGrid's typical 16-20
  const rows = 11;
  const step = size / cols;
  const maxDist = Math.hypot(size, size);
  const elements: React.ReactElement[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = -half + (c + 0.5) * step;
      const y = -half + (r + 0.5) * step;
      const d = Math.hypot(x - fx, y - fy) / maxDist;
      const closeness = 1 - d * 1.6; // negative far from focal
      if (closeness < 0.04) continue; // structural fade: nothing past the rim
      const u = Math.max(0, Math.min(1, closeness));
      // Cell base size scales from focal outward — biggest at the
      // focal corner, dwindling to dots at the far rim.
      const cell = step * (0.16 + 0.78 * u);
      // Diagonal disruption band — cells whose (x+y) lies inside a
      // narrow strip rotate 45° and switch to the accent colour.
      const diagBand =
        Math.abs((x + y) - (fx + fy) * 0.6 + (rand() - 0.5) * step) < step * 1.3;
      const rotated = diagBand && u > 0.18;
      if (u < 0.12) {
        // Outer rim — collapse to a dot so the silhouette dilutes
        // structurally instead of being clipped.
        elements.push(
          <rect key={`g${r}-${c}`}
            x={x - cell * 0.18} y={y - cell * 0.18}
            width={cell * 0.36} height={cell * 0.36}
            fill={ink} />,
        );
      } else if (rotated) {
        elements.push(
          <rect key={`g${r}-${c}`}
            x={-cell / 2} y={-cell / 2} width={cell} height={cell}
            fill={accent}
            transform={`translate(${x} ${y}) rotate(45)`} />,
        );
      } else {
        elements.push(
          <rect key={`g${r}-${c}`}
            x={x - cell / 2} y={y - cell / 2}
            width={cell} height={cell} fill={ink} />,
        );
      }
    }
  }
  return <g>{elements}</g>;
};

// ─────────────────────────────────────────────────────────────────────
// FAMILY D — PERSPECTIVE STRIPES
//
// Primitive: parallel band. Focal: a vanishing point along the left or
// right edge. Law: N bands fan out from the vanishing point; each band
// widens linearly with distance. Disruption: bands kink through a soft
// sin wave so the fan reads as energy, not a static ruled rule.
// ─────────────────────────────────────────────────────────────────────
const PerspectiveStripes: React.FC<{ recipe: FocusRecipe }> = ({ recipe }) => {
  const { size, seed, ink, accent, focal } = recipe;
  const half = size / 2;
  const rand = mulberry32(seed);
  // Vanishing point on the left side by default.
  const vpx = (focal?.x ?? -0.95) * half;
  const vpy = (focal?.y ?? 0) * half;
  const N = 16;
  const elements: React.ReactElement[] = [];
  const spread = Math.PI * 0.72; // total angular fan width
  const baseA = Math.atan2(0, half - vpx); // forward direction
  const farR = Math.hypot(size * 1.2, size * 1.2);
  const wavePhase = rand() * TAU;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const a = baseA + (t - 0.5) * spread;
    // Band thickness — narrow near the vanishing point, thick at rim.
    const inner = half * 0.05;
    const outer = farR;
    // Kink — apply a perpendicular sin-wobble so the band isn't a
    // dead ruled line. Wobble grows with distance from the focal.
    const STEPS = 22;
    const pts: Array<[number, number]> = [];
    for (let s = 0; s <= STEPS; s++) {
      const ts = s / STEPS;
      const radius = inner + (outer - inner) * ts;
      const perp = Math.sin(ts * Math.PI * 1.6 + wavePhase + t * 1.7) *
        (size * 0.04) * ts;
      const ax = Math.cos(a) * radius + Math.sin(a) * perp;
      const ay = Math.sin(a) * radius - Math.cos(a) * perp;
      pts.push([vpx + ax, vpy + ay]);
    }
    // Build a quad strip — top edge offset along +perp, bottom along
    // -perp, both growing with distance for the widening effect.
    const topPts: string[] = [];
    const botPts: string[] = [];
    for (let s = 0; s <= STEPS; s++) {
      const ts = s / STEPS;
      const w = (size * 0.012) + (size * 0.024) * ts;
      const [bx, by] = pts[s]!;
      const tangentA = a + Math.PI / 2;
      topPts.push(`${bx + Math.cos(tangentA) * w} ${by + Math.sin(tangentA) * w}`);
      botPts.push(`${bx - Math.cos(tangentA) * w} ${by - Math.sin(tangentA) * w}`);
    }
    const d = `M ${topPts.join(" L ")} L ${botPts.reverse().join(" L ")} Z`;
    const isAccent = i === Math.floor(N / 2) || i === Math.floor(N / 2) + 3;
    elements.push(
      <path key={`p${i}`} d={d} fill={isAccent ? accent : ink} />,
    );
  }
  // Tiny dot cluster at the vanishing point — anchors the focal.
  for (let i = 0; i < 6; i++) {
    const a = baseA + (i / 5 - 0.5) * spread;
    const dx = Math.cos(a) * (half * 0.04 + i * size * 0.005);
    const dy = Math.sin(a) * (half * 0.04 + i * size * 0.005);
    elements.push(
      <circle key={`vp${i}`} cx={vpx + dx} cy={vpy + dy}
        r={Math.max(1.2, size * 0.006)} fill={ink} />,
    );
  }
  return <g>{elements}</g>;
};

// ─────────────────────────────────────────────────────────────────────
// FAMILY E — SAWTOOTH SPIRAL
//
// Primitive: zigzag step. Focal: tight centre. Law: concentric polylines
// where each loop's sawtooth amplitude grows outward. Disruption: a
// quadrant gets a phase kick so the spiral reads as torqued, not static.
// Rim: outer loops break into stepped fragments — sparse modular dilute.
// ─────────────────────────────────────────────────────────────────────
const SawtoothSpiral: React.FC<{ recipe: FocusRecipe }> = ({ recipe }) => {
  const { size, seed, ink, accent, focal } = recipe;
  const r = size / 2;
  const fx = (focal?.x ?? 0) * r * 0.18;
  const fy = (focal?.y ?? 0) * r * 0.18;
  const rand = mulberry32(seed);
  const RINGS = 7; // low ring count → spiral stays readable
  const TEETH = 48;
  const innerR = r * 0.16;
  const elements: React.ReactElement[] = [];
  const torquePhase = rand() * TAU;
  for (let k = 0; k < RINGS; k++) {
    const t = k / (RINGS - 1);
    const baseR = innerR + (r - innerR) * (0.05 + 0.95 * t);
    const amp = r * 0.024 * (0.4 + 1.6 * t); // tooth height grows outward
    const teethThisRing = TEETH;
    const pts: string[] = [];
    let lastQuadIn = false;
    let lastBreakIdx = -2;
    for (let i = 0; i <= teethThisRing; i++) {
      const ang = (i / teethThisRing) * TAU + k * 0.18; // spiral twist
      // Quadrant disruption — bump one slice outward by half an amp.
      const quadrant =
        ((ang - torquePhase) % TAU + TAU) % TAU < Math.PI * 0.55;
      const bump = quadrant ? amp * 0.9 : 0;
      // Sawtooth oscillates +amp / -amp every step.
      const tooth = i % 2 === 0 ? amp : -amp;
      const radius = baseR + tooth + bump;
      const x = fx + Math.cos(ang) * radius;
      const y = fy + Math.sin(ang) * radius;
      // Outer rings break into stepped fragments — drop every Nth point.
      const breakable = t > 0.55;
      const breakNow = breakable && rand() < 0.18 && i - lastBreakIdx > 2;
      if (breakNow) {
        // Close the current sub-path and start a new one after a gap.
        if (pts.length >= 2) {
          elements.push(
            <polyline key={`r${k}-${i}f${lastBreakIdx}`}
              points={pts.join(" ")} fill="none"
              stroke={k === RINGS - 1 ? accent : ink}
              strokeWidth={Math.max(1.2, r * 0.011)}
              strokeLinejoin="miter" strokeLinecap="butt" />,
          );
        }
        pts.length = 0;
        lastBreakIdx = i;
        continue;
      }
      pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
      void quadrant; void lastQuadIn;
    }
    if (pts.length >= 2) {
      elements.push(
        <polyline key={`r${k}-tail`} points={pts.join(" ")} fill="none"
          stroke={k === RINGS - 1 ? accent : ink}
          strokeWidth={Math.max(1.2, r * 0.011)}
          strokeLinejoin="miter" strokeLinecap="butt" />,
      );
    }
  }
  return <g>{elements}</g>;
};
