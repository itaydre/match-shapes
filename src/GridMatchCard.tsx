import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BaseLayout, PANEL_BOUNDS } from "./components/BaseLayout";
import { ScoreNumeral } from "./components/ScoreNumeral";
import { palette } from "./lib/theme";
import { matchCardSchema } from "./schema";
import type { MatchCardProps, Goal } from "./schema";
import { minuteToFrame } from "./lib/timing";

// 30 columns wide, 30 rows per team half → 60 rows total.
const COLS = 30;
const ROWS_PER_SIDE = 30;
const TOTAL_ROWS = ROWS_PER_SIDE * 2;

type ResolvedGoal = {
  goal: Goal;
  triggerFrame: number;
  focalCol: number;
  focalRow: number;
  primary: string;
  secondary: string;
};

/**
 * Renders a single goal's bloom as a SMOOTH SVG shape layered over the grid.
 * The shape grows from the focal cell outward via a circular reveal clip,
 * driven by `revealRadius` (in cell units). The grid cells underneath keep
 * their silent-mode life — the bloom is a separate organism that paints on
 * top, never quantised to cell rectangles.
 */
const BloomShape: React.FC<{
  rg: ResolvedGoal;
  revealRadius: number;
  cellW: number;
  cellH: number;
  panelLeft: number;
  panelTop: number;
  distortion: { skewX: number; skewY: number; rotation: number };
}> = ({ rg, revealRadius, cellW, cellH, panelLeft, panelTop, distortion }) => {
  if (revealRadius <= 0.001) return null;

  const fx = panelLeft + rg.focalCol * cellW + cellW / 2;
  const fy = panelTop + rg.focalRow * cellH + cellH / 2;
  const cellSize = Math.min(cellW, cellH);
  const rPx = revealRadius * cellSize;
  const { primary, secondary } = rg;
  const style = rg.goal.style;
  let inner: React.ReactNode;

  // Every style is an abstract WAVY-RIBBON texture (Bridget Riley
  // reference) — the shapes are no longer geometric primitives. Direction,
  // frequency, and amplitude differ per style so when blooms overlap they
  // create cross-hatched op-art moiré rather than discrete disks.
  const STRIPES = 14;
  const SAMPLES = 56; // wave samples along each stripe
  const STEP_ANGLE = (style: 0 | 1 | 2 | 3 | 4) => {
    if (style === 1) return Math.PI / 2; // vertical
    if (style === 2) return Math.PI / 4; // diagonal /
    if (style === 3) return -Math.PI / 4; // diagonal \
    if (style === 4) return 0; // radial-rings done separately
    return 0; // horizontal
  };

  const buildRibbons = (
    angle: number,
    amp: number,
    freq: number,
    span: number,
  ): React.ReactNode[] => {
    // Build STRIPES wavy bands oriented along `angle`. Each band lies at a
    // perpendicular offset from the focal point.
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const perpX = -sin;
    const perpY = cos;
    const out: React.ReactNode[] = [];
    const bandH = (span * 2) / STRIPES;
    for (let s = 0; s < STRIPES; s++) {
      const offset = -span + s * bandH;
      const phase = s * 0.55;
      const points: string[] = [];
      // Top edge of band
      for (let i = 0; i <= SAMPLES; i++) {
        const u = (i / SAMPLES) * span * 2 - span;
        const wave = Math.sin(u * freq + phase) * amp;
        const px = fx + cos * u + perpX * (offset + wave);
        const py = fy + sin * u + perpY * (offset + wave);
        points.push(`${i === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`);
      }
      // Bottom edge — return along band, slightly offset wave
      for (let i = SAMPLES; i >= 0; i--) {
        const u = (i / SAMPLES) * span * 2 - span;
        const wave = Math.sin(u * freq + phase + 0.6) * amp;
        const px = fx + cos * u + perpX * (offset + bandH + wave);
        const py = fy + sin * u + perpY * (offset + bandH + wave);
        points.push(`L ${px.toFixed(1)} ${py.toFixed(1)}`);
      }
      points.push("Z");
      // Only paint every other band in the team's primary colour. The
      // skipped bands stay transparent so the pitch shows through —
      // no new colours, just the one team hue plus the field beneath.
      if (s % 2 !== 0) continue;
      out.push(<path key={s} d={points.join(" ")} fill={primary} />);
    }
    return out;
  };

  if (style === 4) {
    // Concentric wavy rings — circles deformed by a sine perturbation
    // along their angular coordinate.
    const RINGS = 18;
    const rings: React.ReactNode[] = [];
    for (let i = RINGS; i >= 1; i--) {
      const baseR = rPx * (i / RINGS);
      const points: string[] = [];
      const N = 80;
      for (let k = 0; k <= N; k++) {
        const a = (k / N) * Math.PI * 2;
        const wobble = Math.sin(a * 6 + i * 0.7) * (rPx * 0.05);
        const r = baseR + wobble;
        const px = fx + Math.cos(a) * r;
        const py = fy + Math.sin(a) * r;
        points.push(`${k === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`);
      }
      points.push("Z");
      // Same rule for the wavy rings — only render alternating rings in
      // team primary; the gaps stay transparent.
      if (i % 2 !== 0) continue;
      rings.push(<path key={i} d={points.join(" ")} fill={primary} />);
    }
    inner = <>{rings}</>;
  } else {
    const angle = STEP_ANGLE(style as 0 | 1 | 2 | 3 | 4);
    // Amplitude proportional to disc, frequency tuned per style.
    const amp = rPx * 0.16;
    const freq =
      style === 0
        ? 0.014
        : style === 1
          ? 0.012
          : style === 2
            ? 0.013
            : 0.013;
    inner = <>{buildRibbons(angle, amp, freq, rPx * 1.05)}</>;
  }

  const { skewX, skewY, rotation } = distortion;
  const transform = `translate(${fx} ${fy}) rotate(${rotation}) skewX(${skewX}) skewY(${skewY}) translate(${-fx} ${-fy})`;
  return <g transform={transform}>{inner}</g>;
};

export const GridMatchCard: React.FC<MatchCardProps> = (props) => {
  const frame = useCurrentFrame();
  const { home, away, competition, venue, date, goals } = props;

  const cellW = PANEL_BOUNDS.width / COLS;
  const cellH = PANEL_BOUNDS.height / TOTAL_ROWS;
  // Square cells with breathing room — not full-cell, so the grid reads as
  // a fine ink texture rather than a chunky pixel-bitmap.
  const baseSize = Math.min(cellW, cellH) * 0.34;

  // Map each goal's 5×4 grid cell into the 30×30 half it belongs to.
  const resolved: ResolvedGoal[] = goals.map((g) => {
    const triggerFrame = minuteToFrame(g.minute);
    const halfCol = g.cell % 5; // 0..4
    const halfRow = Math.floor(g.cell / 5); // 0..3
    const focalCol = halfCol * (COLS / 5) + COLS / 10; // 3, 9, 15, 21, 27
    const focalRowInHalf = halfRow * (ROWS_PER_SIDE / 4) + ROWS_PER_SIDE / 8;
    const focalRow =
      g.team === "home" ? focalRowInHalf : focalRowInHalf + ROWS_PER_SIDE;
    return {
      goal: g,
      triggerFrame,
      focalCol,
      focalRow,
      primary: g.team === "home" ? home.flagPrimary : away.flagPrimary,
      secondary:
        g.team === "home" ? home.flagSecondary : away.flagSecondary,
    };
  });

  // Pre-compute each goal's reveal radius (no resize on later goals — the
  // bloom keeps its size). Each later goal instead DISTORTS the older
  // shape via cumulative skew + rotation around its focal point.
  // Blooms overlap to merge into one composition, but stay small enough
  // that earlier goals remain visible underneath later ones.
  const BASE_RADIUS = 16;
  const ENTER_DUR = 36;
  const DISTORT_DUR = 28;

  const reveals = resolved.map((rg) => {
    const local = frame - rg.triggerFrame;
    if (local < 0) return 0;
    const t = Math.min(1, local / ENTER_DUR);
    const eased = 1 - Math.pow(1 - t, 3);
    return eased * BASE_RADIUS;
  });

  // Cumulative static distortion. Each later goal pushes the older bloom
  // to a new skew/rotation pose during DISTORT_DUR frames, then the bloom
  // holds that pose. No frame-based oscillation — fired goals don't keep
  // moving on their own.
  const distortions = resolved.map((_, i) => {
    let skewX = 0;
    let skewY = 0;
    let rotation = 0;
    for (let j = i + 1; j < resolved.length; j++) {
      const laterLocal = frame - resolved[j].triggerFrame;
      if (laterLocal < 0) break;
      const sP = Math.min(1, laterLocal / DISTORT_DUR);
      const sEased = 1 - Math.pow(1 - sP, 3);
      const sign = j % 2 === 0 ? 1 : -1;
      skewX += 11 * sEased * sign;
      skewY += 7 * sEased * -sign;
      rotation += 5 * sEased * sign;
    }
    return { skewX, skewY, rotation };
  });

  const cells: React.ReactNode[] = [];
  for (let row = 0; row < TOTAL_ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cellCenterX = PANEL_BOUNDS.left + col * cellW + cellW / 2;
      const cellCenterY = PANEL_BOUNDS.top + row * cellH + cellH / 2;

      // Drift — spatial sine wave that evolves quickly over time.
      const driftPhase = col * 0.42 + row * 0.31 + frame * 0.22;
      const driftX = Math.sin(driftPhase) * 1.2;
      const driftY = Math.cos(driftPhase * 1.07) * 1.2;

      // Silent-mode life: a fast traveling diagonal wave + secondary
      // shorter-period swell + per-cell phase, so the field is visibly
      // alive — never quiet, never loud.
      const livePhase = (col + row * 0.6) * 0.18 - frame * 0.26;
      const swell = Math.sin(frame * 0.11 + (col - row) * 0.04);
      const live = 0.5 + 0.5 * Math.sin(livePhase);

      // Reactive pitch — each fired goal sends a circular wave through
      // the grid. The cell's displacement and brightness aggregates the
      // wavefront from every goal, so the surface reads as a terrain
      // that's been struck multiple times.
      let waveBoost = 0;
      let pushX = 0;
      let pushY = 0;
      for (let i = 0; i < resolved.length; i++) {
        const rg = resolved[i];
        const localG = frame - rg.triggerFrame;
        if (localG < 0) continue;
        const ddx = col - rg.focalCol;
        const ddy = row - rg.focalRow;
        const dist = Math.hypot(ddx, ddy);
        // Wavefront travels outward at ~1 cell/frame · 0.4. After the wave
        // has passed a cell, the terrain keeps oscillating but with decay.
        const wavePhase = localG * 0.42 - dist * 0.6;
        const reachedAt = dist / 0.7;
        const sinceReached = Math.max(0, localG - reachedAt);
        const reachDecay = Math.exp(-sinceReached * 0.03);
        const distDecay = 1 / (1 + dist * 0.05);
        const w = Math.sin(wavePhase) * reachDecay * distDecay;
        waveBoost += w;
        // Push cell along the radial direction so the terrain visibly
        // ripples outward from each goal's focal point.
        if (dist > 0.001) {
          pushX += (ddx / dist) * w * 4;
          pushY += (ddy / dist) * w * 4;
        }
      }

      const opacity = Math.max(
        0,
        Math.min(1, 0.10 + live * 0.18 + swell * 0.04 + Math.abs(waveBoost) * 0.55),
      );
      const size = baseSize * (0.85 + live * 0.35 + Math.abs(waveBoost) * 0.9);

      // Top half cells take the home colour, bottom half take the away
      // colour. The beating grid IS the two teams — every cell carries
      // its side's identity.
      const cellColor =
        row < ROWS_PER_SIDE ? home.flagPrimary : away.flagPrimary;

      cells.push(
        <rect
          key={`${col}-${row}`}
          x={cellCenterX - size / 2 + driftX + pushX}
          y={cellCenterY - size / 2 + driftY + pushY}
          width={size}
          height={size}
          fill={cellColor}
          opacity={opacity}
        />,
      );
    }
  }

  // Score state — fired-goals count + frame at which the most recent
  // change happened, so ScoreNumeral can wipe 0 → 1 quickly when the bloom
  // lands.
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
          <clipPath id="panel-clip">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
            />
          </clipPath>
          {/*
            Goo / metaball filter — heavy gaussian blur followed by an
            alpha-threshold colour matrix. Where two bloom silhouettes are
            close, their blurred halos merge and the threshold snaps the
            union back to a crisp edge: separate shapes fuse into one
            singular shape, like a Photoshop "merge shapes" pinch.
          */}
          <filter id="bloom-goo" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="22" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 24 -10"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
        {cells}
        <g clipPath="url(#panel-clip)" filter="url(#bloom-goo)">
          {resolved.map((rg, i) => (
            <BloomShape
              key={`bloom-${i}`}
              rg={rg}
              revealRadius={reveals[i]}
              cellW={cellW}
              cellH={cellH}
              panelLeft={PANEL_BOUNDS.left}
              panelTop={PANEL_BOUNDS.top}
              distortion={distortions[i]}
            />
          ))}
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
    </AbsoluteFill>
  );
};

export { matchCardSchema };
