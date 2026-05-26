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

/**
 * Combined goal bloom — outline-only curved stripes that distort each
 * other. Each stripe is a multi-segment STROKED path (no fill); every
 * sample point along the curve is bent by an attraction force toward
 * neighbouring goal focals, so blooms in proximity warp each other's
 * geometry. The dense concentric-rings layer is gone — outlines do all
 * the work.
 */
type Pt = { x: number; y: number; r: number; w: number };
const CombinedBloom: React.FC<{
  rg: ResolvedGoal;
  revealRadius: number;
  cellW: number;
  cellH: number;
  panelLeft: number;
  panelTop: number;
  others: Pt[]; // every other live focal point — used to distort this bloom
}> = ({
  rg,
  revealRadius,
  cellW,
  cellH,
  panelLeft,
  panelTop,
  others,
}) => {
  if (revealRadius <= 0.001) return null;

  const fx = panelLeft + rg.focalCol * cellW + cellW / 2;
  const fy = panelTop + rg.focalRow * cellH + cellH / 2;
  const cellSize = Math.min(cellW, cellH);
  const rPx = revealRadius * cellSize;
  const { primary } = rg;

  // Mutual-distortion helper — bend a point toward every other live focal,
  // weighted by inverse distance. The amplitude is bounded so the curve
  // never collapses on a neighbour but visibly leans toward them.
  const distort = (x: number, y: number): { x: number; y: number } => {
    let dxSum = 0;
    let dySum = 0;
    for (const o of others) {
      const dx = o.x - x;
      const dy = o.y - y;
      const d = Math.hypot(dx, dy);
      if (d < 1) continue;
      // Inverse-square falloff, scaled by neighbour reveal weight.
      const f = (o.w * o.r * o.r) / (d * d);
      const cap = Math.min(1, f * 0.012);
      dxSum += (dx / d) * cap * 28;
      dySum += (dy / d) * cap * 28;
    }
    return { x: x + dxSum, y: y + dySum };
  };

  // Build an outline-only curved stripe by sampling the Q-curve at N
  // points, distorting each, and connecting them.
  const buildCurve = (yOffset: number, ctrlMag: number, ctrlSign: number): string => {
    const N = 36;
    const xL = fx - rPx * 1.7;
    const xR = fx + rPx * 1.7;
    const yC = fy + yOffset;
    const ctrlX = fx;
    const ctrlY = yC + ctrlMag * ctrlSign;
    let d = "";
    for (let k = 0; k <= N; k++) {
      const u = k / N;
      // Quadratic Bezier sample
      const bx = (1 - u) * (1 - u) * xL + 2 * (1 - u) * u * ctrlX + u * u * xR;
      const by = (1 - u) * (1 - u) * yC + 2 * (1 - u) * u * ctrlY + u * u * yC;
      const p = distort(bx, by);
      d += `${k === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
    }
    return d;
  };

  // Outline curved stripes — 13 of them, no fill, each distorted by the
  // other focals on the field.
  const STRIPES = 13;
  const stripes: React.ReactNode[] = [];
  const verticalRange = rPx * 1.15;
  for (let s = 0; s < STRIPES; s++) {
    const t = s / (STRIPES - 1);
    const yOffset = (t - 0.5) * verticalRange * 2;
    const ctrlMag = (Math.abs(t - 0.5) + 0.16) * rPx * 0.95;
    const ctrlSign = (s % 2 === 0 ? -1 : 1) * (t < 0.5 ? -1 : 1);
    const sw = 6 + Math.abs(t - 0.5) * 4; // thicker at extremes
    stripes.push(
      <path
        key={`s-${s}`}
        d={buildCurve(yOffset, ctrlMag, ctrlSign)}
        fill="none"
        stroke={primary}
        strokeWidth={sw}
        strokeLinecap="round"
      />,
    );
  }

  // A single outline ring (the bloom boundary), also distorted, so the
  // curved stripes feel anchored to a containing form rather than floating.
  const ringPts: string[] = [];
  const RING_N = 80;
  for (let k = 0; k <= RING_N; k++) {
    const a = (k / RING_N) * Math.PI * 2;
    const p = distort(fx + Math.cos(a) * rPx * 0.92, fy + Math.sin(a) * rPx * 0.92);
    ringPts.push(`${k === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
  }
  ringPts.push("Z");

  return (
    <g>
      <path
        d={ringPts.join(" ")}
        fill="none"
        stroke={primary}
        strokeWidth={6}
      />
      {stripes}
    </g>
  );
};

export const GridMatchCardCombined: React.FC<MatchCardProps> = (props) => {
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

  const BASE_RADIUS = 36;
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
          <clipPath id="panel-clip-combined">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
            />
          </clipPath>
        </defs>
        {cells}
        <g clipPath="url(#panel-clip-combined)">
          {resolved.map((rg, i) => {
            const others = resolved
              .map((other, j) => {
                if (j === i || reveals[j] <= 0.001) return null;
                return {
                  x:
                    PANEL_BOUNDS.left + other.focalCol * cellW + cellW / 2,
                  y:
                    PANEL_BOUNDS.top + other.focalRow * cellH + cellH / 2,
                  r:
                    reveals[j] *
                    Math.min(cellW, cellH),
                  w: 1,
                };
              })
              .filter((p): p is NonNullable<typeof p> => p !== null);
            return (
              <CombinedBloom
                key={`bloom-${i}`}
                rg={rg}
                revealRadius={reveals[i]}
                cellW={cellW}
                cellH={cellH}
                panelLeft={PANEL_BOUNDS.left}
                panelTop={PANEL_BOUNDS.top}
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
