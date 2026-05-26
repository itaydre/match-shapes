import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { line, curveBasis } from "d3-shape";
import { BaseLayout, PANEL_BOUNDS } from "./components/BaseLayout";
import { ScoreNumeral } from "./components/ScoreNumeral";
import { matchCardSchema } from "./schema";
import type { MatchCardProps, Goal } from "./schema";
import { minuteToFrame } from "./lib/timing";

// Riley-style wavy parallel stripes per goal.
// • d3-shape's `line().curve(curveBasis)` smooths sin-wave sample arrays
//   into the bending parallel ribbons the reference image is famous for.
// • Per-row amplitude follows a saddle profile (small at top/bottom, fat
//   through the middle) so the stripes appear to billow from a focal axis.
// • Per-row phase drift creates the moiré that makes Riley's work move.

const COLS = 30;
const ROWS_PER_SIDE = 30;
const TOTAL_ROWS = ROWS_PER_SIDE * 2;

type ResolvedGoal = {
  goal: Goal;
  triggerFrame: number;
  focalCol: number;
  focalRow: number;
  primary: string;
};

const buildPath = line<{ x: number; y: number }>()
  .x((d) => d.x)
  .y((d) => d.y)
  .curve(curveBasis);

const RileyStripeField: React.FC<{
  cx: number;
  cy: number;
  rPx: number;
  rows: number;
  color: string;
  baseAmp: number;
  baseFreq: number;
  drift: number;
  /** Rotation of the stripe field in radians. 0 = horizontal stripes. */
  angle: number;
}> = ({ cx, cy, rPx, rows, color, baseAmp, baseFreq, drift, angle }) => {
  const stripes: React.ReactNode[] = [];
  const span = rPx * 1.6;
  const samples = 40;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  for (let s = 0; s < rows; s++) {
    const t = s / (rows - 1); // 0..1 across rows
    const ampScale = Math.sin(Math.PI * t);
    const amp = baseAmp * (0.25 + ampScale * 0.85);
    const phase = s * drift;
    // perpendicular offset in the unrotated frame
    const perpOffset = -rPx * 1.05 + t * rPx * 2.1;

    const points: { x: number; y: number }[] = [];
    for (let k = 0; k <= samples; k++) {
      const u = k / samples;
      // Local-frame coordinates: u-axis along the stripe, perpOffset
      // perpendicular, plus the wave displacement.
      const localU = (u - 0.5) * span * 2;
      const wave =
        Math.sin((u - 0.5) * baseFreq + phase) * amp +
        Math.sin((u - 0.5) * baseFreq * 2.2 + phase * 1.3) * amp * 0.18;
      const localV = perpOffset + wave;
      // Rotate from local frame into canvas space.
      const x = cx + localU * cos - localV * sin;
      const y = cy + localU * sin + localV * cos;
      points.push({ x, y });
    }
    const d = buildPath(points) ?? "";
    const sw = 4 + ampScale * 14;
    stripes.push(
      <path
        key={s}
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />,
    );
  }
  return <g>{stripes}</g>;
};

export const GridMatchCardRiley: React.FC<MatchCardProps> = (props) => {
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
    return {
      goal: g,
      triggerFrame,
      focalCol,
      focalRow,
      primary: g.team === "home" ? home.flagPrimary : away.flagPrimary,
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
      const inHomeHalf = row < ROWS_PER_SIDE;
      const tone = inHomeHalf ? "#0e0e0e" : "#0e0e0e";
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
          fill={tone}
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
          <clipPath id="panel-clip-riley">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
            />
          </clipPath>
        </defs>
        <g clipPath="url(#panel-clip-riley)">
          {cells}
          {resolved.map((rg, i) => {
            if (reveals[i] <= 0.001) return null;
            const fxPanel = PANEL_BOUNDS.left + rg.focalCol * cellW + cellW / 2;
            const fyPanel = PANEL_BOUNDS.top + rg.focalRow * cellH + cellH / 2;
            const rPx = reveals[i] * cellSize;
            // Frequency / drift / ANGLE shift per goal so each bloom has
            // its own rhythm AND its own pattern orientation. Goals
            // alternate between horizontal, slight-tilt, and steep-tilt
            // stripe fields.
            const baseFreq = 6 + ((i * 1.7) % 3);
            const drift = 0.18 + ((i * 0.13) % 0.4);
            // Cycle through 5 angles spaced across half a turn so the
            // five-goal scenario covers a wide spectrum: 0°, 36°, 72°,
            // 108°, 144°.
            const angle = ((i * Math.PI) / 5) + Math.sin(i * 1.93) * 0.12;
            return (
              <RileyStripeField
                key={i}
                cx={fxPanel}
                cy={fyPanel}
                rPx={rPx}
                rows={14}
                color={rg.primary}
                baseAmp={rPx * 0.22}
                baseFreq={baseFreq}
                drift={drift}
                angle={angle}
              />
            );
          })}
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
