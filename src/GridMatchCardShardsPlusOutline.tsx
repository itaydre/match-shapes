import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { line, curveBasis } from "d3-shape";
import { BaseLayout, PANEL_BOUNDS } from "./components/BaseLayout";
import { ScoreNumeral } from "./components/ScoreNumeral";
import { fonts } from "./lib/theme";
import { matchCardSchema } from "./schema";
import type { MatchCardProps, Goal } from "./schema";
import { minuteToFrame } from "./lib/timing";

// Scorer roster keyed by goal-array index for the default 3-2 ENG vs BRA
// scenario this composition uses. Index n in resolved[] → scorer SCORERS[n].
const SCORERS: string[] = [
  "J. BELLINGHAM",
  "H. KANE",
  "VINÍCIUS JR.",
  "RODRYGO",
  "H. KANE",
];

// Op-art shard fan — each goal is a dense radial burst of narrow
// alternating wedges fanning from an off-centre focal point, plus a
// short band of perspective-tilted checker rectangles on the opposite
// side. Reference: Vasarely / Riley shard composition.

const COLS = 30;
const ROWS_PER_SIDE = 30;
const TOTAL_ROWS = ROWS_PER_SIDE * 2;

type ResolvedGoal = {
  goal: Goal;
  triggerFrame: number;
  focalCol: number;
  focalRow: number;
  /** Per-team palette cycled through wedges + checker cells. */
  palette: string[];
};

const buildPath = line<{ x: number; y: number }>()
  .x((d) => d.x)
  .y((d) => d.y)
  .curve(curveBasis);

/**
 * Dense narrow-wedge fan radiating from a focal anchored OFF the
 * bloom centre, plus a short perspective-tilted checker band on the
 * opposite side. Rendered as straight-edged paths so the silhouette
 * is sharp like the source image.
 */
type Neighbour = { x: number; y: number; r: number };

const ShardFan: React.FC<{
  cx: number;
  cy: number;
  rPx: number;
  palette: string[];
  index: number;
  /** Other live focal points + radii — used to distort this shape when
   *  another bloom touches its territory. */
  others: Neighbour[];
}> = ({ cx, cy, rPx, palette, index, others }) => {
  // Contact-driven distortion — every neighbour pulls the shape's
  // sample point HARD toward (or away from) the neighbour's focal once
  // the bloom radii overlap. The force scales with how far this point
  // sits from the shape's own anchor, so the wedge anchor barely moves
  // while the tips swing dramatically — the shape actually deforms
  // instead of translating wholesale.
  const distort = (x: number, y: number): { x: number; y: number } => {
    let dx = 0;
    let dy = 0;
    // Distance of THIS point from the bloom's own focal — used to
    // bias deformation toward the silhouette edges.
    const ownDx = x - cx;
    const ownDy = y - cy;
    const ownDist = Math.hypot(ownDx, ownDy);
    const tipBias = Math.min(1, ownDist / Math.max(rPx, 1));

    for (const o of others) {
      const vx = o.x - x;
      const vy = o.y - y;
      const d = Math.hypot(vx, vy);
      if (d < 1) continue;

      // Long-range hint that ramps up to full contact-drama.
      const sumR = o.r + rPx;
      let intensity = 0;
      if (d <= sumR) {
        // Hard contact — overlap-based force.
        const overlap = (sumR - d) / Math.max(sumR, 1);
        intensity = 0.45 + overlap * 1.2; // 0.45..1.65
      } else if (d <= sumR * 1.4) {
        // Pre-contact whisper — gentle attraction.
        const tail = 1 - (d - sumR) / (sumR * 0.4);
        intensity = tail * 0.25;
      }

      if (intensity <= 0) continue;
      const force = intensity * 130 * (0.3 + tipBias * 1.2);

      // Vector toward the neighbour focal. Alternate which side
      // pulls vs pushes by index parity so adjacent blooms can shove
      // each other rather than always attract.
      const polarity = (index + (o.x + o.y > 0 ? 1 : 0)) % 2 === 0 ? 1 : -1;
      dx += (vx / d) * force * polarity;
      dy += (vy / d) * force * polarity;

      // Tangential swirl — point slides perpendicular to the focal-
      // to-focal axis, so shapes also rotate around each other on
      // contact, not just translate.
      const swirl = intensity * 70 * tipBias * polarity;
      dx += (-vy / d) * swirl;
      dy += (vx / d) * swirl;
    }
    return { x: x + dx, y: y + dy };
  };

  // Per-goal SHAPE-TYPE variation. Each index picks an entirely
  // different visual primitive — fan, ripples, ribbons, halftone disc,
  // cross-hatch, vortex, scanlines — so adjacent blooms don't read as
  // colour swaps of the same form.
  const shapeType = index % 7;

  // ─── 0 — wedge fan + perspective checker ──────────────────────────
  const renderFan = (): React.ReactNode => {
    const sign = index % 4 < 2 ? 1 : -1;
    const ax = cx + rPx * 0.55 * sign;
    const ay = cy;
    const reach = rPx * 2.2;
    const WEDGES = 24;
    const open = 3.49;
    const startAng = sign > 0 ? Math.PI - open / 2 : -open / 2;

    const wedges: React.ReactNode[] = [];
    const a0Anchor = distort(ax, ay);
    for (let w = 0; w < WEDGES; w++) {
      const a0 = startAng + (w / WEDGES) * open;
      const a1 = startAng + ((w + 1) / WEDGES) * open;
      const p1 = distort(ax + Math.cos(a0) * reach, ay + Math.sin(a0) * reach);
      const p2 = distort(ax + Math.cos(a1) * reach, ay + Math.sin(a1) * reach);
      if (w % 2 !== 0) continue;
      const stroke = palette[(w / 2) % palette.length];
      wedges.push(
        <path
          key={`w-${w}`}
          d={`M ${a0Anchor.x.toFixed(1)} ${a0Anchor.y.toFixed(1)} L ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} L ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} Z`}
          fill="none"
          stroke={stroke}
          strokeWidth={9}
          strokeLinejoin="round"
        />,
      );
    }
    return <g>{wedges}</g>;
  };

  // ─── 1 — multi-source ripple interference ────────────────────────
  // Three off-centre sub-foci each emit concentric rings; where the
  // rings cross they produce the moiré field the reference image
  // shows. Skip near-white palette entries so two-tone flags (e.g.
  // England red + white) still paint a visible bloom against cream.
  const visiblePalette = palette.filter((c) => {
    const m = c.replace("#", "");
    if (m.length < 6) return true;
    const r = parseInt(m.slice(0, 2), 16);
    const g = parseInt(m.slice(2, 4), 16);
    const b = parseInt(m.slice(4, 6), 16);
    return r + g + b < 720; // drop anything that would vanish into cream
  });
  const inkPalette = visiblePalette.length > 0 ? visiblePalette : palette;

  const renderRipples = (): React.ReactNode => {
    const subFoci = [
      { x: cx - rPx * 0.55, y: cy - rPx * 0.45 },
      { x: cx + rPx * 0.4, y: cy - rPx * 0.55 },
      { x: cx + rPx * 0.1, y: cy + rPx * 0.5 },
    ];
    const rings: React.ReactNode[] = [];
    const N = 64;
    subFoci.forEach((sub, fi) => {
      const RINGS = 14;
      for (let i = 1; i <= RINGS; i++) {
        const t = i / RINGS;
        const ringR = rPx * 1.1 * Math.pow(t, 1.4);
        if (ringR < 2) continue;
        const pts: { x: number; y: number }[] = [];
        for (let k = 0; k <= N; k++) {
          const a = (k / N) * Math.PI * 2;
          pts.push(
            distort(sub.x + Math.cos(a) * ringR, sub.y + Math.sin(a) * ringR),
          );
        }
        pts.push(pts[0]);
        // Stroke widths bumped so the goo filter's alpha threshold
        // doesn't eat thin lines.
        const sw = i % 2 === 0 ? 8 : 14;
        rings.push(
          <path
            key={`r-${fi}-${i}`}
            d={buildPath(pts) ?? ""}
            fill="none"
            stroke={inkPalette[(fi + i) % inkPalette.length]}
            strokeWidth={sw}
          />,
        );
      }
    });
    return <g>{rings}</g>;
  };

  // ─── 2 — wavy horizontal ribbons (Riley `Fall` / `Cataract`) ─────
  const renderRibbons = (): React.ReactNode => {
    const ROWS = 16;
    const span = rPx * 1.9;
    const out: React.ReactNode[] = [];
    for (let s = 0; s < ROWS; s++) {
      const t = s / (ROWS - 1);
      // Saddle amplitude — fat in the middle of the field, hairlines
      // at top + bottom (the silhouette of Riley's wave compositions).
      const ampScale = Math.sin(Math.PI * t);
      const amp = rPx * 0.32 * (0.18 + ampScale * 0.95);
      const yBase = cy - rPx * 1.05 + t * rPx * 2.1;
      const N = 48;
      const pts: { x: number; y: number }[] = [];
      for (let k = 0; k <= N; k++) {
        const u = k / N;
        const x = cx - span + u * span * 2;
        // Compound wave — primary swell + secondary modulation, with
        // per-row phase drift creating the optical illusion.
        const y =
          yBase +
          Math.sin((u - 0.5) * 5.2 + s * 0.46) * amp +
          Math.sin((u - 0.5) * 11 + s * 0.93) * amp * 0.22;
        pts.push(distort(x, y));
      }
      out.push(
        <path
          key={`rb-${s}`}
          d={buildPath(pts) ?? ""}
          fill="none"
          stroke={palette[s % palette.length]}
          strokeWidth={4 + ampScale * 22}
          strokeLinecap="round"
        />,
      );
    }
    return <g>{out}</g>;
  };

  // ─── 3 — halftone-dot disc ────────────────────────────────────────
  const renderHalftone = (): React.ReactNode => {
    const dots: React.ReactNode[] = [];
    const STEP = rPx * 0.16;
    const cols = Math.ceil((rPx * 2) / STEP);
    for (let r = -cols; r <= cols; r++) {
      for (let c = -cols; c <= cols; c++) {
        const x = cx + c * STEP + (r % 2 === 0 ? 0 : STEP / 2);
        const y = cy + r * STEP * 0.85;
        const dist = Math.hypot(x - cx, y - cy);
        if (dist > rPx) continue;
        const radius = (1 - dist / rPx) * STEP * 0.55;
        const p = distort(x, y);
        dots.push(
          <circle
            key={`d-${r}-${c}`}
            cx={p.x}
            cy={p.y}
            r={radius}
            fill="none"
            stroke={palette[(Math.abs(r) + Math.abs(c)) % palette.length]}
            strokeWidth={4.5}
          />,
        );
      }
    }
    return <g>{dots}</g>;
  };

  // ─── Spoon-poster warped checker ──────────────────────────────────
  // A checker pattern that twists around the focal — every cell's
  // position is rotated by an angle proportional to its distance from
  // the centre, so the regular grid spirals near the middle and
  // straightens out at the rim.
  const renderWarpedChecker = (): React.ReactNode => {
    const cells: React.ReactNode[] = [];
    const STEP = rPx * 0.18;
    const half = Math.ceil(rPx / STEP);
    for (let r = -half; r <= half; r++) {
      for (let c = -half; c <= half; c++) {
        const x0 = c * STEP;
        const y0 = r * STEP;
        const dist = Math.hypot(x0, y0);
        if (dist > rPx) continue;
        // Twist factor — stronger near centre, vanishing at rim.
        const twist = (1 - dist / rPx) * 2.4;
        const rot = twist;
        const sinR = Math.sin(rot);
        const cosR = Math.cos(rot);
        // Four corners of the cell rotated by `rot` around the focal.
        const corners = [
          { x: x0, y: y0 },
          { x: x0 + STEP, y: y0 },
          { x: x0 + STEP, y: y0 + STEP },
          { x: x0, y: y0 + STEP },
        ].map((p) =>
          distort(
            cx + p.x * cosR - p.y * sinR,
            cy + p.x * sinR + p.y * cosR,
          ),
        );
        if ((r + c) % 2 !== 0) continue;
        const stroke = palette[(Math.abs(r) + Math.abs(c)) % palette.length];
        cells.push(
          <path
            key={`wc-${r}-${c}`}
            d={`M ${corners[0].x.toFixed(1)} ${corners[0].y.toFixed(1)} L ${corners[1].x.toFixed(1)} ${corners[1].y.toFixed(1)} L ${corners[2].x.toFixed(1)} ${corners[2].y.toFixed(1)} L ${corners[3].x.toFixed(1)} ${corners[3].y.toFixed(1)} Z`}
            fill="none"
            stroke={stroke}
            strokeWidth={6}
            strokeLinejoin="round"
          />,
        );
      }
    }
    return <g>{cells}</g>;
  };

  // ─── 4 — diagonal cross-hatch ─────────────────────────────────────
  const renderCrossHatch = (): React.ReactNode => {
    const hatches: React.ReactNode[] = [];
    const STRIPES = 14;
    const span = rPx * 1.7;
    for (const angle of [Math.PI / 4, -Math.PI / 4]) {
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      for (let s = 0; s < STRIPES; s++) {
        const t = s / (STRIPES - 1);
        const offset = (t - 0.5) * span * 2;
        const aLen = Math.sqrt(rPx * rPx - offset * offset);
        if (!isFinite(aLen) || aLen <= 0) continue;
        const start = distort(
          cx + cosA * -aLen + -sinA * offset,
          cy + sinA * -aLen + cosA * offset,
        );
        const end = distort(
          cx + cosA * aLen + -sinA * offset,
          cy + sinA * aLen + cosA * offset,
        );
        hatches.push(
          <line
            key={`h-${angle}-${s}`}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke={palette[s % palette.length]}
            strokeWidth={5}
            strokeLinecap="round"
          />,
        );
      }
    }
    return <g>{hatches}</g>;
  };

  // ─── 5 — radial vortex: rays + concentric grid converging inward ───
  const renderVortex = (): React.ReactNode => {
    const out: React.ReactNode[] = [];
    // 36 radial rays converging on the focal centre.
    const RAYS = 36;
    for (let k = 0; k < RAYS; k++) {
      const a = (k / RAYS) * Math.PI * 2;
      const stroke = k % 2 === 0 ? palette[0] : palette[palette.length - 1];
      const tip = distort(cx, cy);
      const outer = distort(
        cx + Math.cos(a) * rPx,
        cy + Math.sin(a) * rPx,
      );
      out.push(
        <line
          key={`v-r-${k}`}
          x1={tip.x}
          y1={tip.y}
          x2={outer.x}
          y2={outer.y}
          stroke={stroke}
          strokeWidth={5}
          strokeLinecap="round"
        />,
      );
    }
    // 5 concentric ring outlines for the grid-like fragmented structure.
    for (let r = 1; r <= 5; r++) {
      const t = r / 5;
      const ringR = rPx * Math.pow(t, 1.35);
      if (ringR < 1) continue;
      const pts: { x: number; y: number }[] = [];
      const N = 48;
      for (let k = 0; k <= N; k++) {
        const a = (k / N) * Math.PI * 2;
        pts.push(distort(cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR));
      }
      out.push(
        <path
          key={`v-c-${r}`}
          d={(buildPath(pts) ?? "") + " Z"}
          fill="none"
          stroke="#0e0e0e"
          strokeOpacity={0.55}
          strokeWidth={2}
        />,
      );
    }
    return <g>{out}</g>;
  };

  // ─── 6 — horizontal modular scanline stripes ──────────────────────
  const renderScanlines = (): React.ReactNode => {
    const out: React.ReactNode[] = [];
    // Variable-width bars stacked vertically; widths sampled from a
    // deterministic pseudo-random sequence so each goal gets a stable
    // "barcode" rhythm.
    const BARS = 22;
    const widths: number[] = [];
    let total = 0;
    for (let s = 0; s < BARS; s++) {
      const u = Math.sin(s * 1.61803 + index * 0.7) * 0.5 + 0.5;
      const w = 0.4 + u * 1.4;
      widths.push(w);
      total += w;
    }
    const span = rPx * 2;
    const xL = cx - rPx * 1.7;
    const xR = cx + rPx * 1.7;
    let yCursor = cy - rPx;
    for (let s = 0; s < BARS; s++) {
      const h = (widths[s] / total) * span;
      // Alternate painted / transparent; painted bars cycle the palette.
      const painted = s % 2 === 0;
      if (painted) {
        const stroke = palette[(s / 2) % palette.length];
        const tl = distort(xL, yCursor);
        const tr = distort(xR, yCursor);
        const br = distort(xR, yCursor + h);
        const bl = distort(xL, yCursor + h);
        out.push(
          <path
            key={`s-${s}`}
            d={`M ${tl.x.toFixed(1)} ${tl.y.toFixed(1)} L ${tr.x.toFixed(1)} ${tr.y.toFixed(1)} L ${br.x.toFixed(1)} ${br.y.toFixed(1)} L ${bl.x.toFixed(1)} ${bl.y.toFixed(1)} Z`}
            fill="none"
            stroke={stroke}
            strokeWidth={6}
            strokeLinejoin="round"
          />,
        );
      }
      yCursor += h;
    }
    return <g>{out}</g>;
  };

  // Asymmetric-only renderers — no centred perfect circles, every
  // shape has an off-axis bias matching the op-art references.
  const renderers = [
    renderRipples,         // multi-source interference (3 off-centre foci)
    renderRibbons,         // horizontal saddle waves (Riley)
    renderFan,             // off-centre wedge fan + perspective checker
    renderWarpedChecker,   // Spoon-poster spiral checker
    renderScanlines,       // modular barcode-style stripes
  ];
  return <g>{renderers[shapeType % renderers.length]()}</g>;
};

export const GridMatchCardShardsPlusOutline: React.FC<MatchCardProps> = (props) => {
  const frame = useCurrentFrame();
  const { home, away, competition, venue, date, goals } = props;

  const cellW = PANEL_BOUNDS.width / COLS;
  const cellH = PANEL_BOUNDS.height / TOTAL_ROWS;
  const cellSize = Math.min(cellW, cellH);
  const baseSize = cellSize * 0.34;

  const resolved: ResolvedGoal[] = goals.map((g) => {
    const triggerFrame = minuteToFrame(g.minute);
    const halfCol = g.cell % 5;
    const halfRow = Math.floor(g.cell / 5);
    const focalCol = halfCol * (COLS / 5) + COLS / 10;
    const focalRowInHalf = halfRow * (ROWS_PER_SIDE / 4) + ROWS_PER_SIDE / 8;
    const focalRow =
      g.team === "home" ? focalRowInHalf : focalRowInHalf + ROWS_PER_SIDE;
    const team = g.team === "home" ? home : away;
    // Dedupe so a two-colour flag (e.g. England red + white) produces a
    // length-2 palette and the wedge cycle alternates evenly instead of
    // doubling up on one colour.
    const rawPalette = [team.flagPrimary, team.flagSecondary, team.flagAccent];
    const palette = Array.from(new Set(rawPalette.map((c) => c.toLowerCase())));
    return {
      goal: g,
      triggerFrame,
      focalCol,
      focalRow,
      palette,
    };
  });

  const BASE_RADIUS = 22;
  const ENTER_DUR = 36;
  const reveals = resolved.map((rg) => {
    const local = frame - rg.triggerFrame;
    if (local < 0) return 0;
    const t = Math.min(1, local / ENTER_DUR);
    const eased = 1 - Math.pow(1 - t, 3);
    return eased * BASE_RADIUS;
  });

  // Sub-pulse texture cells (low alpha breathing).
  const cells: React.ReactNode[] = [];
  for (let row = 0; row < TOTAL_ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cellCenterX = PANEL_BOUNDS.left + col * cellW + cellW / 2;
      const cellCenterY = PANEL_BOUNDS.top + row * cellH + cellH / 2;
      const driftPhase = col * 0.42 + row * 0.31 + frame * 0.22;
      const driftX = Math.sin(driftPhase) * 1.0;
      const driftY = Math.cos(driftPhase * 1.07) * 1.0;
      const livePhase = (col + row * 0.6) * 0.18 - frame * 0.26;
      const live = 0.5 + 0.5 * Math.sin(livePhase);
      let waveBoost = 0;
      for (let i = 0; i < resolved.length; i++) {
        const rg = resolved[i];
        const localG = frame - rg.triggerFrame;
        if (localG < 0) continue;
        const ddx = col - rg.focalCol;
        const ddy = row - rg.focalRow;
        const dist = Math.hypot(ddx, ddy);
        const wavePhase = localG * 0.42 - dist * 0.6;
        const reachedAt = dist / 0.7;
        const sinceReached = Math.max(0, localG - reachedAt);
        const reachDecay = Math.exp(-sinceReached * 0.03);
        const distDecay = 1 / (1 + dist * 0.05);
        const w = Math.sin(wavePhase) * reachDecay * distDecay;
        waveBoost += w;
      }
      const opacity = Math.max(
        0,
        Math.min(0.4, 0.04 + live * 0.10 + Math.abs(waveBoost) * 0.4),
      );
      const size = baseSize * (0.85 + live * 0.35 + Math.abs(waveBoost) * 0.7);
      cells.push(
        <rect
          key={`${col}-${row}`}
          x={cellCenterX - size / 2 + driftX}
          y={cellCenterY - size / 2 + driftY}
          width={size}
          height={size}
          fill="#0e0e0e"
          opacity={opacity}
        />,
      );
    }
  }

  const homeFiredFrames = resolved
    .filter((rg) => rg.goal.team === "home" && frame >= rg.triggerFrame)
    .map((rg) => rg.triggerFrame);
  const awayFiredFrames = resolved
    .filter((rg) => rg.goal.team === "away" && frame >= rg.triggerFrame)
    .map((rg) => rg.triggerFrame);
  const homeScoreNow = homeFiredFrames.length;
  const awayScoreNow = awayFiredFrames.length;
  const lastHomeBump =
    homeFiredFrames.length > 0
      ? homeFiredFrames[homeFiredFrames.length - 1]
      : -1;
  const lastAwayBump =
    awayFiredFrames.length > 0
      ? awayFiredFrames[awayFiredFrames.length - 1]
      : -1;
  const cx = (PANEL_BOUNDS.left + PANEL_BOUNDS.right) / 2;
  const midY = (PANEL_BOUNDS.top + PANEL_BOUNDS.bottom) / 2;

  return (
    <AbsoluteFill>
      <BaseLayout
        home={home}
        away={away}
        competition={competition}
        venue={venue}
        date={date}
      />
      <svg
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
        width={1080}
        height={2340}
        viewBox="0 0 1080 2340"
      >
        <defs>
          <clipPath id="panel-clip-shards">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
            />
          </clipPath>
          {/*
            Goo / metaball filter — gaussian blur + alpha threshold so
            that when a new shape comes in and overlaps an existing one,
            the two silhouettes fuse into a single continuous form
            (Photoshop "merge shapes" feel) instead of layering side by
            side.
          */}
          <filter
            id="shards-goo"
            x="-8%"
            y="-8%"
            width="116%"
            height="116%"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="14" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 22 -10"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
        <g clipPath="url(#panel-clip-shards)">
          {cells}
          {/* Outline blooms — NO goo filter. Stroke-only shapes are too
              thin to survive the goo's gaussian blur + alpha threshold;
              dropping the filter lets the line art read cleanly. They
              still overlap each other naturally via SVG layering. */}
          <g>
            {resolved.map((rg, i) => {
              if (reveals[i] <= 0.001) return null;
              const fxPanel = PANEL_BOUNDS.left + rg.focalCol * cellW + cellW / 2;
              const fyPanel = PANEL_BOUNDS.top + rg.focalRow * cellH + cellH / 2;
              const rPx = reveals[i] * cellSize;
              const others = resolved
                .map((other, j) => {
                  if (j === i || reveals[j] <= 0.001) return null;
                  return {
                    x: PANEL_BOUNDS.left + other.focalCol * cellW + cellW / 2,
                    y: PANEL_BOUNDS.top + other.focalRow * cellH + cellH / 2,
                    r: reveals[j] * cellSize,
                  };
                })
                .filter((p): p is Neighbour => p !== null);
              return (
                <ShardFan
                  key={i}
                  cx={fxPanel}
                  cy={fyPanel}
                  rPx={rPx}
                  palette={rg.palette}
                  index={i}
                  others={others}
                />
              );
            })}
          </g>
        </g>
      </svg>
      <ScoreNumeral
        value={homeScoreNow}
        color={home.flagPrimary}
        cx={cx}
        cy={(PANEL_BOUNDS.top + midY) / 2}
        bumpFrame={lastHomeBump}
        sweepFrames={8}
        sweepDirection="horizontal"
        outlineColor="#FFFFFF"
        outlineWidth={10}
      />
      <ScoreNumeral
        value={awayScoreNow}
        color={away.flagPrimary}
        cx={cx}
        cy={(midY + PANEL_BOUNDS.bottom) / 2}
        bumpFrame={lastAwayBump}
        sweepFrames={8}
        sweepDirection="horizontal"
        outlineColor="#FFFFFF"
        outlineWidth={10}
      />
      {/*
        Scorer name flashes — appear briefly at the centre line on
        every goal trigger. Quick slide-in (6 frames), hold (24), slide-
        out (10). Stack so simultaneous goals don't overwrite each
        other's text.
      */}
      {resolved.map((rg, i) => {
        const local = frame - rg.triggerFrame;
        if (local < 0 || local > 40) return null;
        let opacity = 1;
        let translateY = 0;
        if (local < 6) {
          opacity = local / 6;
          translateY = (1 - local / 6) * 30;
        } else if (local > 30) {
          const t = (local - 30) / 10;
          opacity = 1 - t;
          translateY = -t * 20;
        }
        const scorer = SCORERS[i] ?? `GOAL ${i + 1}`;
        const teamColor =
          rg.goal.team === "home" ? home.flagPrimary : away.flagPrimary;
        // Dynamic font sizing — longer names scale down so they always
        // fit within the available canvas width (≈864px after panel
        // padding + chip padding). 1330 ÷ length gives roughly the right
        // glyph budget at our 900-weight bold display style.
        const nameFontSize = Math.min(
          140,
          Math.max(56, Math.floor(1330 / Math.max(1, scorer.length))),
        );
        return (
          <div
            key={`scorer-${i}`}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: midY - 180,
              padding: "0 60px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              transform: `translateY(${translateY}px)`,
              opacity,
              pointerEvents: "none",
              gap: 14,
            }}
          >
            <div
              style={{
                fontFamily: fonts.body,
                fontWeight: 900,
                fontSize: nameFontSize,
                lineHeight: "0.95",
                letterSpacing: "-0.01em",
                color: "#FFFFFF",
                background: teamColor,
                padding: "16px 48px",
                textAlign: "center",
                whiteSpace: "nowrap",
                maxWidth: "100%",
              }}
            >
              {scorer}
            </div>
            <div
              style={{
                fontFamily: fonts.body,
                fontWeight: 800,
                fontSize: 72,
                letterSpacing: "0.18em",
                color: "#FFFFFF",
                background: teamColor,
                padding: "8px 28px",
              }}
            >
              {rg.goal.minute}'
            </div>
          </div>
        );
      })}
      {/*
        Away-team flag stripe — three horizontal bars in Brazil's real
        flag colours sit just above the BRAZIL title, anchoring the
        bottom team to its national palette regardless of which colour
        the bloom shapes happen to be using.
      */}
      <div
        style={{
          position: "absolute",
          left: PANEL_BOUNDS.left,
          right: PANEL_BOUNDS.left,
          width: PANEL_BOUNDS.width,
          bottom: 122,
          display: "flex",
          flexDirection: "row",
          height: 36,
          border: "2px solid #0e0e0e",
        }}
      >
        <div style={{ flex: 1, background: away.flagPrimary }} />
        <div style={{ flex: 1, background: away.flagSecondary }} />
        <div style={{ flex: 1, background: away.flagAccent }} />
      </div>
    </AbsoluteFill>
  );
};

export { matchCardSchema };
