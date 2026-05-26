import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BaseLayout, PANEL_BOUNDS } from "./components/BaseLayout";
import { ScoreNumeral } from "./components/ScoreNumeral";
import { matchCardSchema } from "./schema";
import type { MatchCardProps, Goal } from "./schema";
import { minuteToFrame } from "./lib/timing";

// Natural-tone heatmap pitch. The field starts as a sparse, coarse
// heatmap painted in pitch greens / earth tones — like real broadcast
// possession overlays. Each goal lands as a disruption: cells inside
// the goal's reach swap to the team's primary and rotate slightly, so
// the disruption reads as a new shape carved out of the natural map.

// Goal-resolution grids — used only for placing focal points in cell
// coords. The actual heatmap rendering uses a much finer noise grid
// below so cell edges are invisible and adjacent values blend into
// smooth topographic blobs.
const COLS = 10;
const ROWS_PER_SIDE = 6;
const TOTAL_ROWS = ROWS_PER_SIDE * 2;

// Fine heatmap noise field — fine enough that 4–5px cells visually fuse
// into a continuous map.
const HEAT_COLS = 60;
const HEAT_ROWS = 120;

// Natural-tone heatmap stops. Each entry is `[t, [r, g, b]]`; the noise
// value (0..1) lerps between adjacent stops to produce a continuous
// colour ramp.
const HEAT_STOPS: Array<[number, [number, number, number]]> = [
  [0.0, [40, 70, 28]],     // deep shadow turf
  [0.18, [70, 110, 50]],   // dark green
  [0.4, [122, 166, 75]],   // mid pitch green
  [0.6, [170, 195, 110]],  // pale grass
  [0.78, [195, 175, 110]], // dust
  [0.92, [155, 115, 70]],  // dry earth
  [1.0, [110, 80, 55]],    // worn brown
];

const heatColor = (t: number): string => {
  const x = Math.max(0, Math.min(1, t));
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    const [t1, c1] = HEAT_STOPS[i];
    if (x <= t1) {
      const [t0, c0] = HEAT_STOPS[i - 1];
      const k = (x - t0) / (t1 - t0);
      const r = Math.round(c0[0] + (c1[0] - c0[0]) * k);
      const g = Math.round(c0[1] + (c1[1] - c0[1]) * k);
      const b = Math.round(c0[2] + (c1[2] - c0[2]) * k);
      return `rgb(${r},${g},${b})`;
    }
  }
  const last = HEAT_STOPS[HEAT_STOPS.length - 1][1];
  return `rgb(${last[0]},${last[1]},${last[2]})`;
};

// Cheap "perlin-ish" noise — sum of three sine waves at different
// frequencies, phase-offset by frame so the field slowly drifts.
const noiseAt = (u: number, v: number, t: number): number => {
  const a =
    Math.sin(u * 0.62 + v * 0.41 + t * 0.013) * 0.5 +
    Math.sin(u * 1.35 - v * 0.71 + t * 0.021) * 0.3 +
    Math.sin(u * 2.6 + v * 1.9 + t * 0.031) * 0.2;
  return (a + 1) / 2; // 0..1
};

type ResolvedGoal = {
  goal: Goal;
  triggerFrame: number;
  focalCol: number;
  focalRow: number;
  primary: string;
};

export const GridMatchCardNaturalHeat: React.FC<MatchCardProps> = (props) => {
  const frame = useCurrentFrame();
  const { home, away, competition, venue, date, goals } = props;

  const cellW = PANEL_BOUNDS.width / COLS;
  const cellH = PANEL_BOUNDS.height / TOTAL_ROWS;
  const midY = (PANEL_BOUNDS.top + PANEL_BOUNDS.bottom) / 2;
  const cx = (PANEL_BOUNDS.left + PANEL_BOUNDS.right) / 2;

  const resolved: ResolvedGoal[] = goals.map((g) => {
    const triggerFrame = minuteToFrame(g.minute);
    const halfCol = g.cell % 5;
    const halfRow = Math.floor(g.cell / 5);
    const focalCol = halfCol * (COLS / 5) + COLS / 10;
    const focalRowInHalf = halfRow * (ROWS_PER_SIDE / 4) + ROWS_PER_SIDE / 8;
    const focalRow =
      g.team === "home" ? focalRowInHalf : focalRowInHalf + ROWS_PER_SIDE;
    return {
      goal: g,
      triggerFrame,
      focalCol,
      focalRow,
      primary: g.team === "home" ? home.flagPrimary : away.flagPrimary,
    };
  });

  // Per-goal reach radius (in cell units) — small so disruptions stay
  // localised, not blanket recoloring the whole pitch.
  const reveals = resolved.map((rg) => {
    const local = frame - rg.triggerFrame;
    if (local < 0) return 0;
    const t = Math.min(1, local / 30);
    const eased = 1 - Math.pow(1 - t, 3);
    return eased * 3.6;
  });

  // Fine-resolution noise field. Each tiny rect's colour comes from a
  // smooth sine-sum noise lookup, so adjacent rects of similar value
  // blend visually into continuous topographic blobs — no visible
  // grid squares. Goals push a colour bias toward the scoring team's
  // primary inside a localised circular reach (in cell units).
  const heatCellW = PANEL_BOUNDS.width / HEAT_COLS;
  const heatCellH = PANEL_BOUNDS.height / HEAT_ROWS;
  const cells: React.ReactNode[] = [];

  // Pre-compute goal focal positions in heatmap-cell units so distance
  // checks are cheap inside the inner loop.
  const goalFoci = resolved.map((rg, i) => ({
    rg,
    col: (rg.focalCol / COLS) * HEAT_COLS,
    row: (rg.focalRow / TOTAL_ROWS) * HEAT_ROWS,
    reach: reveals[i] * (HEAT_COLS / COLS) * 1.2,
    fired: reveals[i] > 0,
  }));

  for (let row = 0; row < HEAT_ROWS; row++) {
    for (let col = 0; col < HEAT_COLS; col++) {
      const x = PANEL_BOUNDS.left + col * heatCellW;
      const y = PANEL_BOUNDS.top + row * heatCellH;
      const n = noiseAt(col * 0.18, row * 0.18, frame);
      const natural = heatColor(n);

      // Goal disruption — blend toward the nearest fired goal's
      // primary if this cell sits inside its reach.
      let disruptColor: string | null = null;
      let disruptStrength = 0;
      for (const g of goalFoci) {
        if (!g.fired) continue;
        const dx = col - g.col;
        const dy = row - g.row;
        const dist = Math.hypot(dx, dy);
        if (dist <= g.reach) {
          const s = 1 - dist / Math.max(g.reach, 0.001);
          if (s > disruptStrength) {
            disruptStrength = s;
            disruptColor = g.rg.primary;
          }
        }
      }

      cells.push(
        <g key={`${col}-${row}`}>
          <rect
            x={x}
            y={y}
            width={heatCellW + 0.6}
            height={heatCellH + 0.6}
            fill={natural}
          />
          {disruptColor && (
            <rect
              x={x}
              y={y}
              width={heatCellW + 0.6}
              height={heatCellH + 0.6}
              fill={disruptColor}
              opacity={disruptStrength * 0.85}
            />
          )}
        </g>,
      );
    }
  }

  // Score state.
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
          <clipPath id="panel-clip-natural">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
            />
          </clipPath>
        </defs>
        <g clipPath="url(#panel-clip-natural)">
          {/* White ground beneath the natural palette so rotation gaps
              read as a clean break in the heatmap. */}
          <rect
            x={PANEL_BOUNDS.left}
            y={PANEL_BOUNDS.top}
            width={PANEL_BOUNDS.width}
            height={PANEL_BOUNDS.height}
            fill="#F8F4EA"
          />
          {cells}
          {/* Hard midline so the pitch reads as a real field overlay. */}
          <line
            x1={PANEL_BOUNDS.left}
            y1={midY}
            x2={PANEL_BOUNDS.right}
            y2={midY}
            stroke="#FFFFFF"
            strokeWidth={4}
            opacity={0.7}
          />
          <circle
            cx={cx}
            cy={midY}
            r={140}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={4}
            opacity={0.7}
          />
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
