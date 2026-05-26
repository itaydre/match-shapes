import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BaseLayout, PANEL_BOUNDS } from "./components/BaseLayout";
import { ScoreNumeral } from "./components/ScoreNumeral";
import { matchCardSchema } from "./schema";
import type { MatchCardProps, Goal } from "./schema";
import { minuteToFrame } from "./lib/timing";

// Curving speed-streak goal animation. Each goal fires a burst of long
// cubic-bezier streaks sweeping across the screen on black, in the
// scoring team's flag colours. Streaks "draw in" via stroke-dashoffset,
// hold briefly, then "draw out" — a single goal lifecycle is ~70 frames.

const CANVAS_W = 1080;
const CANVAS_H = 2340;
const STREAKS_PER_GOAL = 36;
const GOAL_DUR = 72;
const DRAW_IN = 16;
const HOLD = 28;

type ResolvedGoal = {
  goal: Goal;
  triggerFrame: number;
  palette: string[];
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t: number) => t * t * t;

export const GridMatchCardSpeedStreaks: React.FC<MatchCardProps> = (props) => {
  const frame = useCurrentFrame();
  const { home, away, competition, venue, date, goals } = props;

  const midY = (PANEL_BOUNDS.top + PANEL_BOUNDS.bottom) / 2;
  const cx = (PANEL_BOUNDS.left + PANEL_BOUNDS.right) / 2;

  const resolved: ResolvedGoal[] = goals.map((g) => {
    const triggerFrame = minuteToFrame(g.minute);
    const team = g.team === "home" ? home : away;
    const palette = Array.from(
      new Set(
        [team.flagPrimary, team.flagSecondary, team.flagAccent].map((c) =>
          c.toLowerCase(),
        ),
      ),
    );
    return { goal: g, triggerFrame, palette };
  });

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

  // Aggregate the active goal's streak group.
  const activeStreaks: React.ReactNode[] = [];
  let darkOverlay = 0; // 0..1 black takeover opacity
  resolved.forEach((rg, gIdx) => {
    const local = frame - rg.triggerFrame;
    if (local < 0 || local > GOAL_DUR) return;

    // Visibility envelope — draw in, hold, draw out — drives both the
    // dashoffset reveal and the black takeover behind.
    let drawProgress: number;
    if (local <= DRAW_IN) {
      drawProgress = easeOutCubic(local / DRAW_IN);
    } else if (local <= DRAW_IN + HOLD) {
      drawProgress = 1;
    } else {
      const t = (local - DRAW_IN - HOLD) / (GOAL_DUR - DRAW_IN - HOLD);
      drawProgress = 1 - easeInCubic(t);
    }
    darkOverlay = Math.max(darkOverlay, drawProgress);

    for (let s = 0; s < STREAKS_PER_GOAL; s++) {
      // Deterministic seed per (goal, streak) so the same frame always
      // renders the same streak set.
      const seed = gIdx * 131 + s * 17;
      const r1 = (Math.sin(seed * 12.9898) + 1) / 2;
      const r2 = (Math.sin(seed * 78.233) + 1) / 2;
      const r3 = (Math.sin(seed * 39.41) + 1) / 2;
      const r4 = (Math.sin(seed * 53.91) + 1) / 2;

      // Each streak starts off the top edge and arcs to the bottom
      // edge, with a strong horizontal curve in the middle so the
      // composition reads as motion lines.
      const startX = -200 + r1 * (CANVAS_W + 400);
      const startY = -120 - r2 * 200;
      const endX = -200 + r3 * (CANVAS_W + 400);
      const endY = CANVAS_H + 120 + r4 * 200;
      // Two control points pushed to opposite sides, creating an S/C
      // curve depending on the relative positions.
      const ctrl1X = startX + (r1 - 0.5) * CANVAS_W * 1.4;
      const ctrl1Y = startY + (0.18 + r2 * 0.18) * CANVAS_H;
      const ctrl2X = endX + (r3 - 0.5) * CANVAS_W * 1.4;
      const ctrl2Y = endY - (0.18 + r4 * 0.18) * CANVAS_H;
      const d = `M ${startX} ${startY} C ${ctrl1X} ${ctrl1Y}, ${ctrl2X} ${ctrl2Y}, ${endX} ${endY}`;

      // Stroke width — most streaks thin, a few thick.
      const swBase = r2 < 0.78 ? 3 + r2 * 6 : 14 + r2 * 12;
      const color = rg.palette[(s + gIdx) % rg.palette.length];

      // Stroke draw-in: pathLength normalized to 100; offset 100→0 fills the
      // line over `drawProgress`. We use a generous dash so the streak
      // shows as a single continuous line.
      const dashLen = 120;
      const offset = (1 - drawProgress) * dashLen;

      activeStreaks.push(
        <path
          key={`g${gIdx}-s${s}`}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={swBase}
          strokeLinecap="round"
          pathLength={dashLen}
          strokeDasharray={`${dashLen}`}
          strokeDashoffset={offset}
          opacity={0.85 + r3 * 0.15}
        />,
      );

      // Sparse rect highlights — 1-in-6 streaks get a bright accent
      // rectangle along the curve, like the yellow flares in the
      // reference. Position rect at the visible tip of the stroke.
      if (s % 6 === 1) {
        const t = drawProgress; // tip is at parameter t along the curve
        const omt = 1 - t;
        const tipX =
          omt * omt * omt * startX +
          3 * omt * omt * t * ctrl1X +
          3 * omt * t * t * ctrl2X +
          t * t * t * endX;
        const tipY =
          omt * omt * omt * startY +
          3 * omt * omt * t * ctrl1Y +
          3 * omt * t * t * ctrl2Y +
          t * t * t * endY;
        // Pick a contrast accent from the team palette.
        const accentColor =
          rg.palette[(s + 1) % rg.palette.length] ?? rg.palette[0];
        activeStreaks.push(
          <rect
            key={`g${gIdx}-tip${s}`}
            x={tipX - 14}
            y={tipY - 6}
            width={28}
            height={12}
            fill={accentColor}
            opacity={drawProgress}
          />,
        );
      }
    }
  });

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
        width={CANVAS_W}
        height={CANVAS_H}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      >
        <defs>
          <clipPath id="streaks-panel-clip">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
            />
          </clipPath>
        </defs>
        <g clipPath="url(#streaks-panel-clip)">
          {/* Black takeover removed — streaks sit directly over the
              pitch / chrome so the underlying surface stays visible. */}
          {activeStreaks}
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
    </AbsoluteFill>
  );
};

export { matchCardSchema };
