import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BaseLayout, PANEL_BOUNDS } from "./components/BaseLayout";
import { ScoreNumeral } from "./components/ScoreNumeral";
import { matchCardSchema } from "./schema";
import type { MatchCardProps, Goal } from "./schema";
import { minuteToFrame } from "./lib/timing";

// Soft mesh-gradient + grain splash per goal — Paper BQ-1 reference.

const COLS = 30;
const ROWS_PER_SIDE = 30;
const TOTAL_ROWS = ROWS_PER_SIDE * 2;

type ResolvedGoal = {
  goal: Goal;
  triggerFrame: number;
  focalCol: number;
  focalRow: number;
  primary: string;
  accent: string;
  /** 0.55..1.55 — scales the splash radius and lobe offset per goal. */
  weight: number;
};

/**
 * One painterly splash — two offset soft radial gradients that bleed into
 * each other (team primary + accent), enclosed by a feathered alpha.
 */
const SplashBlob: React.FC<{
  rg: ResolvedGoal;
  revealRadius: number;
  cellW: number;
  cellH: number;
  panelLeft: number;
  panelTop: number;
  index: number;
}> = ({ rg, revealRadius, cellW, cellH, panelLeft, panelTop, index }) => {
  if (revealRadius <= 0.001) return null;

  const fx = panelLeft + rg.focalCol * cellW + cellW / 2;
  const fy = panelTop + rg.focalRow * cellH + cellH / 2;
  const cellSize = Math.min(cellW, cellH);
  const rPx = revealRadius * cellSize * rg.weight;

  // Two color lobes, offset diagonally for the swirl/crescent feel.
  // Lobe offset rides the per-goal weight too, so heavier splashes have
  // wider crescents.
  const offset = rPx * (0.22 + rg.weight * 0.18);
  const ang = (index * 137) % 360; // golden-ish step so foci read varied
  const ox = Math.cos((ang * Math.PI) / 180) * offset;
  const oy = Math.sin((ang * Math.PI) / 180) * offset;

  const idA = `splash-${rg.triggerFrame}-${index}-a`;
  const idB = `splash-${rg.triggerFrame}-${index}-b`;

  return (
    <g>
      <defs>
        <radialGradient id={idA} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={rg.primary} stopOpacity="1" />
          <stop offset="55%" stopColor={rg.primary} stopOpacity="0.85" />
          <stop offset="100%" stopColor={rg.primary} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={idB} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={rg.accent} stopOpacity="0.95" />
          <stop offset="55%" stopColor={rg.accent} stopOpacity="0.7" />
          <stop offset="100%" stopColor={rg.accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle
        cx={fx - ox}
        cy={fy - oy}
        r={rPx}
        fill={`url(#${idA})`}
      />
      <circle
        cx={fx + ox}
        cy={fy + oy}
        r={rPx * 0.92}
        fill={`url(#${idB})`}
      />
    </g>
  );
};

export const GridMatchCardSplash: React.FC<MatchCardProps> = (props) => {
  const frame = useCurrentFrame();
  const { home, away, competition, venue, date, goals } = props;

  const cellW = PANEL_BOUNDS.width / COLS;
  const cellH = PANEL_BOUNDS.height / TOTAL_ROWS;
  const baseSize = Math.min(cellW, cellH) * 0.34;

  const resolved: ResolvedGoal[] = goals.map((g, i) => {
    const triggerFrame = minuteToFrame(g.minute);
    const halfCol = g.cell % 5;
    const halfRow = Math.floor(g.cell / 5);
    const focalCol = halfCol * (COLS / 5) + COLS / 10;
    const focalRowInHalf = halfRow * (ROWS_PER_SIDE / 4) + ROWS_PER_SIDE / 8;
    const focalRow =
      g.team === "home" ? focalRowInHalf : focalRowInHalf + ROWS_PER_SIDE;
    // Drama-driven weight: late goals weigh more (60'..90' ramp), early
    // shocks add a small bump, plus a deterministic per-goal jitter so two
    // similarly-timed goals still differ.
    const lateRamp = Math.max(0, (g.minute - 55) / 40); // 0..1 across 55'..95'
    const earlyShock = g.minute <= 8 ? 0.18 : 0;
    const jitter = ((Math.sin(triggerFrame * 1.93 + i * 7.31) + 1) / 2) * 0.35;
    const weight = Math.max(0.55, Math.min(1.55, 0.7 + lateRamp * 0.55 + earlyShock + jitter * 0.3));
    return {
      goal: g,
      triggerFrame,
      focalCol,
      focalRow,
      primary: g.team === "home" ? home.flagPrimary : away.flagPrimary,
      // Each splash bleeds the SAME team's secondary colour — kept inside
      // the team's own palette, never mixing with the opponent.
      accent: g.team === "home" ? home.flagSecondary : away.flagSecondary,
      weight,
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
          <clipPath id="panel-clip-splash">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
              rx={100}
              ry={100}
            />
          </clipPath>
          {/*
            Mesh-gradient distortion + film grain. The displacement map gives
            the painterly swirl seen in BQ-1; the turbulence noise overlay
            adds the gritty film grain.
          */}
          <filter id="splash-shader" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012"
              numOctaves="2"
              seed="3"
              result="warpNoise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="warpNoise"
              scale="80"
              xChannelSelector="R"
              yChannelSelector="G"
              result="warped"
            />
            <feGaussianBlur in="warped" stdDeviation="14" result="soft" />
          </filter>
          <filter id="splash-grain" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="1.6"
              numOctaves="2"
              seed="11"
              result="grain"
            />
            <feColorMatrix
              in="grain"
              type="matrix"
              values="0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0.45 0"
              result="grainAlpha"
            />
            <feComposite in="grainAlpha" in2="SourceGraphic" operator="in" />
          </filter>
        </defs>
        {cells}
        <g clipPath="url(#panel-clip-splash)">
          <g filter="url(#splash-shader)">
            {resolved.map((rg, i) => (
              <SplashBlob
                key={`splash-${i}`}
                rg={rg}
                revealRadius={reveals[i]}
                cellW={cellW}
                cellH={cellH}
                panelLeft={PANEL_BOUNDS.left}
                panelTop={PANEL_BOUNDS.top}
                index={i}
              />
            ))}
          </g>
          {/* Grain overlay — only inside the panel so we don't grain the team labels. */}
          <g filter="url(#splash-grain)" opacity="0.55">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
              fill="#0e0e0e"
            />
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
    </AbsoluteFill>
  );
};

export { matchCardSchema };
