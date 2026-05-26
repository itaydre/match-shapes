import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BaseLayout, PANEL_BOUNDS } from "./components/BaseLayout";
import { ScoreNumeral } from "./components/ScoreNumeral";
import { matchCardSchema } from "./schema";
import type { MatchCardProps, Goal } from "./schema";
import { minuteToFrame } from "./lib/timing";

// Solid team-coloured halves — top half is fully home colour, bottom half
// fully away colour, with a hard midline. Goal art still appears, but rendered
// in a high-contrast tone so it punches through the saturated half it lands on.

const COLS = 30;
const ROWS_PER_SIDE = 30;
const TOTAL_ROWS = ROWS_PER_SIDE * 2;

type ResolvedGoal = {
  goal: Goal;
  triggerFrame: number;
  focalCol: number;
  focalRow: number;
  /** Contrast colour of the team that scored — black for light kits, white for dark. */
  artColor: string;
};

// Choose a tone that punches against the SOLID half background. We compute
// a perceptual luminance on the half-colour (the team that owns the half
// where the goal lands) and pick black or white accordingly.
const luminance = (hex: string): number => {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
};
const contrastTone = (bg: string) => (luminance(bg) > 0.55 ? "#0e0e0e" : "#FFFFFF");

const CombinedBloom: React.FC<{
  rg: ResolvedGoal;
  revealRadius: number;
  cellW: number;
  cellH: number;
  panelLeft: number;
  panelTop: number;
  others: { x: number; y: number; r: number }[];
}> = ({ rg, revealRadius, cellW, cellH, panelLeft, panelTop, others }) => {
  if (revealRadius <= 0.001) return null;

  const fx = panelLeft + rg.focalCol * cellW + cellW / 2;
  const fy = panelTop + rg.focalRow * cellH + cellH / 2;
  const cellSize = Math.min(cellW, cellH);
  const rPx = revealRadius * cellSize;

  const distort = (x: number, y: number): { x: number; y: number } => {
    let dx = 0;
    let dy = 0;
    for (const o of others) {
      const vx = o.x - x;
      const vy = o.y - y;
      const d = Math.hypot(vx, vy);
      if (d < 1) continue;
      const f = (o.r * o.r) / (d * d);
      const cap = Math.min(1, f * 0.012);
      dx += (vx / d) * cap * 24;
      dy += (vy / d) * cap * 24;
    }
    return { x: x + dx, y: y + dy };
  };

  // Sparse sunburst — same shape language on both halves so the two team
  // sides feel cohesive. Borrowed from SplitStyle's SunburstHome but cut
  // way back: fewer wedges, no inner phase bands, single faint outline.
  const WEDGES = 24;
  const wedges: React.ReactNode[] = [];
  for (let w = 0; w < WEDGES; w += 2) {
    const a0 = (w / WEDGES) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((w + 1) / WEDGES) * Math.PI * 2 - Math.PI / 2;
    const p1 = distort(fx + Math.cos(a0) * rPx, fy + Math.sin(a0) * rPx);
    const p2 = distort(fx + Math.cos(a1) * rPx, fy + Math.sin(a1) * rPx);
    wedges.push(
      <path
        key={`w-${w}`}
        d={`M ${fx} ${fy} L ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} A ${rPx} ${rPx} 0 0 1 ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} Z`}
        fill={rg.artColor}
      />,
    );
  }

  // One concentric ring inside, for a soft moiré break in the centre.
  const ringR = rPx * 0.55;
  return (
    <g>
      <g>{wedges}</g>
      <circle
        cx={fx}
        cy={fy}
        r={ringR}
        fill="none"
        stroke={rg.artColor}
        strokeWidth={3}
      />
      <circle
        cx={fx}
        cy={fy}
        r={rPx * 0.085}
        fill={rg.artColor}
      />
    </g>
  );
};

export const GridMatchCardColorHalves: React.FC<MatchCardProps> = (props) => {
  const frame = useCurrentFrame();
  const { home, away, competition, venue, date, goals } = props;

  const cellW = PANEL_BOUNDS.width / COLS;
  const cellH = PANEL_BOUNDS.height / TOTAL_ROWS;
  const baseSize = Math.min(cellW, cellH) * 0.34;
  const midY = (PANEL_BOUNDS.top + PANEL_BOUNDS.bottom) / 2;

  const homeTone = contrastTone(home.flagPrimary);
  const awayTone = contrastTone(away.flagPrimary);

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
      // Goal art uses the contrast tone of the half it's painting on.
      artColor: g.team === "home" ? homeTone : awayTone,
    };
  });

  const BASE_RADIUS = 16;
  const ENTER_DUR = 36;

  const reveals = resolved.map((rg) => {
    const local = frame - rg.triggerFrame;
    if (local < 0) return 0;
    const t = Math.min(1, local / ENTER_DUR);
    const eased = 1 - Math.pow(1 - t, 3);
    return eased * BASE_RADIUS;
  });

  // Subtle texture cells — stay alive but ride on top of the saturated halves
  // at low opacity so the half colour dominates.
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

      // Cells use the contrast tone of the half they're in, at very low alpha,
      // so the saturated half colour reads first and the "alive" texture is felt rather than seen.
      const inHomeHalf = row < ROWS_PER_SIDE;
      const tone = inHomeHalf ? homeTone : awayTone;
      const opacity = Math.max(
        0,
        Math.min(0.55, 0.04 + live * 0.10 + Math.abs(waveBoost) * 0.45),
      );
      const size = baseSize * (0.85 + live * 0.35 + Math.abs(waveBoost) * 0.9);

      cells.push(
        <rect
          key={`${col}-${row}`}
          x={cellCenterX - size / 2 + driftX + pushX}
          y={cellCenterY - size / 2 + driftY + pushY}
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
          <clipPath id="panel-clip-halves">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
            />
          </clipPath>
          <clipPath id="halves-home-clip">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={midY - PANEL_BOUNDS.top}
            />
          </clipPath>
          <clipPath id="halves-away-clip">
            <rect
              x={PANEL_BOUNDS.left}
              y={midY}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.bottom - midY}
            />
          </clipPath>
        </defs>
        <g clipPath="url(#panel-clip-halves)">
          {/* Solid team-coloured halves */}
          <rect
            x={PANEL_BOUNDS.left}
            y={PANEL_BOUNDS.top}
            width={PANEL_BOUNDS.width}
            height={midY - PANEL_BOUNDS.top}
            fill={home.flagPrimary}
          />
          <rect
            x={PANEL_BOUNDS.left}
            y={midY}
            width={PANEL_BOUNDS.width}
            height={PANEL_BOUNDS.bottom - midY}
            fill={away.flagPrimary}
          />
          {/* Sub-colour cells — low alpha breathing texture */}
          {cells}
          {/* Hard midline + centre circle */}
          <line
            x1={PANEL_BOUNDS.left}
            y1={midY}
            x2={PANEL_BOUNDS.right}
            y2={midY}
            stroke="#0e0e0e"
            strokeWidth={3}
            opacity={0.5}
          />
          <circle
            cx={cx}
            cy={midY}
            r={140}
            fill="none"
            stroke="#0e0e0e"
            strokeWidth={3}
            opacity={0.45}
          />
          {/* Bloom shapes — each bound to its own team's half so they never
              cross the midline. Mutual distortion is computed against
              same-half neighbours only. */}
          {(["home", "away"] as const).map((side) => {
            const clipId = side === "home" ? "halves-home-clip" : "halves-away-clip";
            return (
              <g key={`side-${side}`} clipPath={`url(#${clipId})`}>
                {resolved.map((rg, i) => {
                  if (rg.goal.team !== side || reveals[i] <= 0.001) return null;
                  const others = resolved
                    .map((other, j) => {
                      if (
                        j === i ||
                        reveals[j] <= 0.001 ||
                        other.goal.team !== side
                      )
                        return null;
                      return {
                        x: PANEL_BOUNDS.left + other.focalCol * cellW + cellW / 2,
                        y: PANEL_BOUNDS.top + other.focalRow * cellH + cellH / 2,
                        r: reveals[j] * Math.min(cellW, cellH),
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
            );
          })}
        </g>
      </svg>
      <ScoreNumeral
        value={homeScoreNow}
        color={homeTone}
        cx={cx}
        cy={(PANEL_BOUNDS.top + midY) / 2}
        bumpFrame={lastHomeBump}
        sweepFrames={8}
        sweepDirection="horizontal"
      />
      <ScoreNumeral
        value={awayScoreNow}
        color={awayTone}
        cx={cx}
        cy={(midY + PANEL_BOUNDS.bottom) / 2}
        bumpFrame={lastAwayBump}
        sweepFrames={8}
        sweepDirection="horizontal"
      />
    </AbsoluteFill>
  );
};

export { matchCardSchema };
