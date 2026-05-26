import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BaseLayout, PANEL_BOUNDS } from "./components/BaseLayout";
import { ScoreNumeral } from "./components/ScoreNumeral";
import { fonts } from "./lib/theme";
import { matchCardSchema } from "./schema";
import type { MatchCardProps, Goal } from "./schema";
import { minuteToFrame } from "./lib/timing";

// Grid-bend pitch — the starting state is a clean 10×10 outline grid
// per half. Each goal adds an arc-shaped clip region that contains the
// SAME grid offset/rotated, so the eye perceives a bend or break at
// the arc boundary. More goals → more arcs → more angles.

const GRID_COLS = 10;
const GRID_ROWS_PER_HALF = 10;
const ARC_OFFSET_MULTIPLIER = 1.6; // how far each arc shifts its grid

const SCORERS: string[] = [
  "J. BELLINGHAM",
  "H. KANE",
  "VINÍCIUS JR.",
  "RODRYGO",
  "H. KANE",
];

type ResolvedGoal = {
  goal: Goal;
  triggerFrame: number;
  focalX: number;
  focalY: number;
  primary: string;
};

export const GridMatchCardStripeBends: React.FC<MatchCardProps> = (props) => {
  const frame = useCurrentFrame();
  const { home, away, competition, venue, date, goals } = props;

  const midY = (PANEL_BOUNDS.top + PANEL_BOUNDS.bottom) / 2;
  const cx = (PANEL_BOUNDS.left + PANEL_BOUNDS.right) / 2;
  const cellW = PANEL_BOUNDS.width / GRID_COLS;
  const halfH = PANEL_BOUNDS.height / 2;
  const cellH = halfH / GRID_ROWS_PER_HALF;

  const resolved: ResolvedGoal[] = goals.map((g) => {
    const triggerFrame = minuteToFrame(g.minute);
    // Map the 5×4 cell index into panel pixel coordinates.
    const halfCol = g.cell % 5;
    const halfRow = Math.floor(g.cell / 5);
    const focalX =
      PANEL_BOUNDS.left + (halfCol / 5 + 1 / 10) * PANEL_BOUNDS.width;
    const focalRowFraction = halfRow / 4 + 1 / 8;
    const baseY =
      g.team === "home"
        ? PANEL_BOUNDS.top + focalRowFraction * (PANEL_BOUNDS.height / 2)
        : midY + focalRowFraction * (PANEL_BOUNDS.height / 2);
    return {
      goal: g,
      triggerFrame,
      focalX,
      focalY: baseY,
      primary: g.team === "home" ? home.flagPrimary : away.flagPrimary,
    };
  });

  // Per-goal reveal progress 0..1 — drives the arc radius and the
  // stripe-shift magnitude so the bend eases in instead of snapping.
  const reveals = resolved.map((rg) => {
    const local = frame - rg.triggerFrame;
    if (local < 0) return 0;
    const t = Math.min(1, local / 30);
    return 1 - Math.pow(1 - t, 3);
  });

  // Render an outline grid of `GRID_COLS × GRID_ROWS_PER_HALF*2` cells
  // covering the whole panel. `xShift` + `yShift` translate the lattice
  // so an arc-clipped duplicate disagrees with the base, creating the
  // bend effect at the arc boundary.
  const renderGrid = (xShift: number, yShift: number, color: string) => {
    const lines: React.ReactNode[] = [];
    const totalRows = GRID_ROWS_PER_HALF * 2;
    const startX = PANEL_BOUNDS.left + xShift;
    const startY = PANEL_BOUNDS.top + yShift;
    // Vertical lines — render an extra column on each side so a shift
    // never reveals an empty edge inside an arc.
    for (let c = -1; c <= GRID_COLS + 1; c++) {
      const x = startX + c * cellW;
      lines.push(
        <line
          key={`v-${c}`}
          x1={x}
          y1={PANEL_BOUNDS.top - 8}
          x2={x}
          y2={PANEL_BOUNDS.bottom + 8}
          stroke={color}
          strokeWidth={3}
        />,
      );
    }
    // Horizontal lines.
    for (let r = -1; r <= totalRows + 1; r++) {
      const y = startY + r * cellH;
      lines.push(
        <line
          key={`h-${r}`}
          x1={PANEL_BOUNDS.left - 8}
          y1={y}
          x2={PANEL_BOUNDS.right + 8}
          y2={y}
          stroke={color}
          strokeWidth={3}
        />,
      );
    }
    return lines;
  };

  const baseShade = "#FFFFFF";

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
          <clipPath id="panel-clip-stripes">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
            />
          </clipPath>
          <clipPath id="stripes-home-half">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={midY - PANEL_BOUNDS.top}
            />
          </clipPath>
          <clipPath id="stripes-away-half">
            <rect
              x={PANEL_BOUNDS.left}
              y={midY}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.bottom - midY}
            />
          </clipPath>
          {/* One arc clipPath per goal — a circle whose radius grows
              with the goal's reveal progress. Anything inside the arc
              uses a shifted stripe pattern. */}
          {resolved.map((rg, i) => {
            const r = reveals[i] * PANEL_BOUNDS.width * 0.55 + 20;
            return (
              <clipPath key={`clip-${i}`} id={`stripe-arc-${i}`}>
                <circle cx={rg.focalX} cy={rg.focalY} r={r} />
              </clipPath>
            );
          })}
        </defs>
        <g clipPath="url(#panel-clip-stripes)">
          {/* Base field — white background, then per-half stripes so
              each team owns its own half from frame zero. */}
          <rect
            x={PANEL_BOUNDS.left}
            y={PANEL_BOUNDS.top}
            width={PANEL_BOUNDS.width}
            height={PANEL_BOUNDS.height}
            fill={baseShade}
          />
          <g clipPath="url(#stripes-home-half)">
            {renderGrid(0, 0, home.flagPrimary)}
          </g>
          <g clipPath="url(#stripes-away-half)">
            {renderGrid(0, 0, away.flagPrimary)}
          </g>
          {/* Per-goal arc — same grid, shifted in x AND y so the
              lattice inside the arc disagrees with the outer grid at
              every line. More arcs → more angles + intersection points. */}
          {resolved.map((rg, i) => {
            if (reveals[i] <= 0.001) return null;
            const shiftAmount = (i + 1) * ARC_OFFSET_MULTIPLIER;
            const xShift = Math.cos(i * 1.3) * cellW * shiftAmount;
            const yShift = Math.sin(i * 0.9) * cellH * shiftAmount;
            const lineColor = rg.primary;
            return (
              <g key={`bend-${i}`} clipPath={`url(#stripe-arc-${i})`}>
                <rect
                  x={PANEL_BOUNDS.left}
                  y={PANEL_BOUNDS.top}
                  width={PANEL_BOUNDS.width}
                  height={PANEL_BOUNDS.height}
                  fill={baseShade}
                />
                {renderGrid(xShift, yShift, lineColor)}
              </g>
            );
          })}
        </g>
      </svg>
      {/* Score chips — white fill with a thick team-coloured border. */}
      {(["home", "away"] as const).map((side) => {
        const score = side === "home" ? homeScoreNow : awayScoreNow;
        const color = side === "home" ? home.flagPrimary : away.flagPrimary;
        const bump = side === "home" ? lastHomeBump : lastAwayBump;
        const sideCy =
          side === "home"
            ? (PANEL_BOUNDS.top + midY) / 2
            : (midY + PANEL_BOUNDS.bottom) / 2;
        return (
          <div
            key={`score-box-${side}`}
            style={{
              position: "absolute",
              left: cx - 260,
              top: sideCy - 320,
              width: 520,
              height: 640,
              background: "#FFFFFF",
              border: `14px solid ${color}`,
              boxSizing: "border-box",
            }}
          />
        );
      })}
      <ScoreNumeral
        value={homeScoreNow}
        color={home.flagPrimary}
        cx={cx}
        cy={(PANEL_BOUNDS.top + midY) / 2}
        bumpFrame={lastHomeBump}
        sweepFrames={8}
        sweepDirection="horizontal"
      />
      <ScoreNumeral
        value={awayScoreNow}
        color={away.flagPrimary}
        cx={cx}
        cy={(midY + PANEL_BOUNDS.bottom) / 2}
        bumpFrame={lastAwayBump}
        sweepFrames={8}
        sweepDirection="horizontal"
      />
      {/* Scorer "OLÉ-OLÉ" wrap — when a goal fires, the scorer's name
          repeats horizontally across the centre band, each instance in
          a different palette color and a small vertical offset, like a
          terrace chant. */}
      {resolved.map((rg, i) => {
        const local = frame - rg.triggerFrame;
        if (local < 0 || local > 60) return null;
        let opacity = 1;
        if (local < 8) opacity = local / 8;
        else if (local > 48) opacity = Math.max(0, 1 - (local - 48) / 12);
        const scorer = SCORERS[i] ?? `GOAL ${i + 1}`;
        const teamPalette =
          rg.goal.team === "home"
            ? [home.flagPrimary, home.flagSecondary, home.flagAccent]
            : [away.flagPrimary, away.flagSecondary, away.flagAccent];
        const repeats = 5;
        const fontSize = 220;
        // Slide horizontally over the goal's lifetime so the chant drifts.
        const xDrift = Math.min(1, local / 60) * -fontSize * 0.4;
        return (
          <div
            key={`wrap-${i}`}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: midY - fontSize * 0.5,
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: fontSize * 0.18,
              transform: `translateX(${xDrift}px)`,
              opacity,
              pointerEvents: "none",
              overflow: "visible",
              paddingLeft: -fontSize * 1.2,
            }}
          >
            {Array.from({ length: repeats }).map((_, k) => (
              <span
                key={k}
                style={{
                  fontFamily: fonts.body,
                  fontWeight: 900,
                  fontSize,
                  lineHeight: "0.95",
                  letterSpacing: "-0.02em",
                  color: teamPalette[k % teamPalette.length],
                  transform: `translateY(${(k % 2 === 0 ? -1 : 1) * 18}px)`,
                  whiteSpace: "nowrap",
                }}
              >
                {scorer}
              </span>
            ))}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export { matchCardSchema };
