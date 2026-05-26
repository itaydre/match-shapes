import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BaseLayout, PANEL_BOUNDS } from "./components/BaseLayout";
import { ScoreNumeral } from "./components/ScoreNumeral";
import { matchCardSchema } from "./schema";
import type { MatchCardProps, Goal } from "./schema";
import { minuteToFrame } from "./lib/timing";

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

// Every goal renders the SAME shape — a set of concentric stroked rings
// emanating from its focal cell. As goals stack, the rings from each focus
// overlap and interfere, creating the multi-source ripple field.
const RippleBloom: React.FC<{
  rg: ResolvedGoal;
  revealRadius: number;
  cellW: number;
  cellH: number;
  panelLeft: number;
  panelTop: number;
}> = ({ rg, revealRadius, cellW, cellH, panelLeft, panelTop }) => {
  if (revealRadius <= 0.001) return null;

  const fx = panelLeft + rg.focalCol * cellW + cellW / 2;
  const fy = panelTop + rg.focalRow * cellH + cellH / 2;
  const cellSize = Math.min(cellW, cellH);
  const rPx = revealRadius * cellSize;
  const { primary } = rg;

  // Ring spacing tightens near the centre and eases out toward the rim,
  // so the ripple reads with the same "drop in water" cadence as the
  // reference. Innermost rings appear first as revealRadius grows; outer
  // rings come into view as the bloom expands.
  const RINGS = 26;
  const rings: React.ReactNode[] = [];
  for (let i = 1; i <= RINGS; i++) {
    const t = i / RINGS;
    const ringR = rPx * Math.pow(t, 1.25);
    if (ringR < 1) continue;
    const sw = Math.max(1.4, 5 - i * 0.12);
    rings.push(
      <circle
        key={i}
        cx={fx}
        cy={fy}
        r={ringR}
        fill="none"
        stroke={primary}
        strokeWidth={sw}
      />,
    );
  }
  return <>{rings}</>;
};

export const GridMatchCardRipples: React.FC<MatchCardProps> = (props) => {
  const frame = useCurrentFrame();
  const { home, away, competition, venue, date, goals } = props;

  const cellW = PANEL_BOUNDS.width / COLS;
  const cellH = PANEL_BOUNDS.height / TOTAL_ROWS;
  const baseSize = Math.min(cellW, cellH) * 0.34;

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

  // Rings reach far so the ripples from each focus interfere with one
  // another, the way the trace 01 reference reads.
  const BASE_RADIUS = 38;
  const ENTER_DUR = 36;

  const reveals = resolved.map((rg) => {
    const local = frame - rg.triggerFrame;
    if (local < 0) return 0;
    const t = Math.min(1, local / ENTER_DUR);
    const eased = 1 - Math.pow(1 - t, 3);
    return eased * BASE_RADIUS;
  });

  const cells: React.ReactNode[] = [];
  for (let row = 0; row < TOTAL_ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cellCenterX = PANEL_BOUNDS.left + col * cellW + cellW / 2;
      const cellCenterY = PANEL_BOUNDS.top + row * cellH + cellH / 2;

      const driftPhase = col * 0.42 + row * 0.31 + frame * 0.22;
      const driftX = Math.sin(driftPhase) * 1.2;
      const driftY = Math.cos(driftPhase * 1.07) * 1.2;

      const livePhase = (col + row * 0.6) * 0.18 - frame * 0.26;
      const swell = Math.sin(frame * 0.11 + (col - row) * 0.04);
      const live = 0.5 + 0.5 * Math.sin(livePhase);

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
        const wavePhase = localG * 0.42 - dist * 0.6;
        const reachedAt = dist / 0.7;
        const sinceReached = Math.max(0, localG - reachedAt);
        const reachDecay = Math.exp(-sinceReached * 0.03);
        const distDecay = 1 / (1 + dist * 0.05);
        const w = Math.sin(wavePhase) * reachDecay * distDecay;
        waveBoost += w;
        if (dist > 0.001) {
          pushX += (ddx / dist) * w * 4;
          pushY += (ddy / dist) * w * 4;
        }
      }

      const opacity = Math.max(
        0,
        Math.min(
          1,
          0.10 + live * 0.18 + swell * 0.04 + Math.abs(waveBoost) * 0.55,
        ),
      );
      const size = baseSize * (0.85 + live * 0.35 + Math.abs(waveBoost) * 0.9);
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
          <clipPath id="panel-clip-ripples">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
            />
          </clipPath>
        </defs>
        {cells}
        <g clipPath="url(#panel-clip-ripples)">
          {resolved.map((rg, i) => (
            <RippleBloom
              key={`bloom-${i}`}
              rg={rg}
              revealRadius={reveals[i]}
              cellW={cellW}
              cellH={cellH}
              panelLeft={PANEL_BOUNDS.left}
              panelTop={PANEL_BOUNDS.top}
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
