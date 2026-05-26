import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BaseLayout, PANEL_BOUNDS } from "./components/BaseLayout";
import { ScoreNumeral } from "./components/ScoreNumeral";
import { ShardFan, type Neighbour } from "./GridMatchCardShards";
import { matchCardSchema } from "./schema";
import type { MatchCardProps, Goal } from "./schema";
import { minuteToFrame } from "./lib/timing";

// Background-transition pitch — coarse cell grid that rotates between
// green and yellow over time. The cells exist purely as a breathing
// transition; the actual goal art is the same five-variation ShardFan
// renderer that GridMatchCardShards uses.

const COLS = 10;
const ROWS_PER_SIDE = 6;
const TOTAL_ROWS = ROWS_PER_SIDE * 2;

// Pitch palette — only two tones cycling, green and yellow.
const PALETTE = ["#3DA35D", "#F7C72E"];
const TICK_FRAMES = 24;

// Cheap deterministic hash → same frame always yields the same field.
const hash = (a: number, b: number, c: number): number => {
  let h = a * 374761393 + b * 668265263 + c * 1274126177;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 0x100000000;
};

type ResolvedGoal = {
  goal: Goal;
  triggerFrame: number;
  focalCol: number;
  focalRow: number;
  palette: string[];
};

export const GridMatchCardHeatmap: React.FC<MatchCardProps> = (props) => {
  const frame = useCurrentFrame();
  const { home, away, competition, venue, date, goals } = props;

  const cellW = PANEL_BOUNDS.width / COLS;
  const cellH = PANEL_BOUNDS.height / TOTAL_ROWS;
  const cellSize = Math.min(cellW, cellH);
  const midY = (PANEL_BOUNDS.top + PANEL_BOUNDS.bottom) / 2;

  const resolved: ResolvedGoal[] = goals.map((g) => {
    const triggerFrame = minuteToFrame(g.minute);
    const halfCol = g.cell % 5;
    const halfRow = Math.floor(g.cell / 5);
    const focalCol = halfCol * (COLS / 5) + COLS / 10;
    const focalRowInHalf = halfRow * (ROWS_PER_SIDE / 4) + ROWS_PER_SIDE / 8;
    const focalRow =
      g.team === "home" ? focalRowInHalf : focalRowInHalf + ROWS_PER_SIDE;
    const team = g.team === "home" ? home : away;
    const raw = [team.flagPrimary, team.flagSecondary, team.flagAccent];
    const teamPalette = Array.from(new Set(raw.map((c) => c.toLowerCase())));
    return {
      goal: g,
      triggerFrame,
      focalCol,
      focalRow,
      palette: teamPalette,
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

  // Rotating green/yellow background — each cell holds its colour for
  // TICK_FRAMES, then cross-fades to the next tick's pick. Adjacent cells
  // pick independently so the field reads as a subtly-shifting patchwork.
  const cells: React.ReactNode[] = [];
  const tick = Math.floor(frame / TICK_FRAMES);
  const tickPhase = (frame % TICK_FRAMES) / TICK_FRAMES;
  const fadeIn = Math.min(1, tickPhase * 2);

  for (let row = 0; row < TOTAL_ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = PANEL_BOUNDS.left + col * cellW;
      const y = PANEL_BOUNDS.top + row * cellH;
      const prevColor =
        PALETTE[Math.floor(hash(col, row, tick - 1) * PALETTE.length)];
      const currColor =
        PALETTE[Math.floor(hash(col, row, tick) * PALETTE.length)];
      cells.push(
        <g key={`${col}-${row}`}>
          <rect
            x={x}
            y={y}
            width={cellW + 0.5}
            height={cellH + 0.5}
            fill={prevColor}
          />
          <rect
            x={x}
            y={y}
            width={cellW + 0.5}
            height={cellH + 0.5}
            fill={currColor}
            opacity={fadeIn}
          />
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
  const cx = (PANEL_BOUNDS.left + PANEL_BOUNDS.right) / 2;

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
          <clipPath id="panel-clip-heatmap">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
            />
          </clipPath>
        </defs>
        <g clipPath="url(#panel-clip-heatmap)">
          {cells}
          {/* Goal shapes — same per-goal-index ShardFan renderer used by
              GridMatchCardShards: fan / ripples / ribbons / halftone /
              cross-hatch, with mutual contact distortion. */}
          {resolved.map((rg, i) => {
            if (reveals[i] <= 0.001) return null;
            const fxPanel = PANEL_BOUNDS.left + rg.focalCol * cellW + cellW / 2;
            const fyPanel = PANEL_BOUNDS.top + rg.focalRow * cellH + cellH / 2;
            const rPx = reveals[i] * cellSize;
            const others: Neighbour[] = resolved
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
