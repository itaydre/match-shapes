import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BaseLayout, PANEL_BOUNDS } from "./components/BaseLayout";
import { ScoreNumeral } from "./components/ScoreNumeral";
import { matchCardSchema } from "./schema";
import type { MatchCardProps, Goal } from "./schema";
import { minuteToFrame } from "./lib/timing";

// Square-burst goal animation — the rectangular cousin of
// GridMatchCardWedgeBurst. Each goal emits axis-aligned rectangles
// extending from its focal point along the four cardinal directions
// (and optional 45° diagonals), in the scoring team's flag colours.
// Bars grow outward over GROW_FRAMES then stay on screen permanently.

const CANVAS_W = 1080;
const CANVAS_H = 2340;
const BARS_PER_GOAL = 32;
const GROW_FRAMES = 18;
// Eight square angles: 4 cardinal + 4 diagonal (45° increments).
const ANGLE_STEPS = 8;

type ResolvedGoal = {
  goal: Goal;
  triggerFrame: number;
  focalX: number;
  focalY: number;
  palette: string[];
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export const GridMatchCardSquareBurst: React.FC<MatchCardProps> = (props) => {
  const frame = useCurrentFrame();
  const { home, away, competition, venue, date, goals } = props;

  const midY = (PANEL_BOUNDS.top + PANEL_BOUNDS.bottom) / 2;
  const cx = (PANEL_BOUNDS.left + PANEL_BOUNDS.right) / 2;

  const resolved: ResolvedGoal[] = goals.map((g) => {
    const triggerFrame = minuteToFrame(g.minute);
    const halfCol = g.cell % 5;
    const halfRow = Math.floor(g.cell / 5);
    const focalX =
      PANEL_BOUNDS.left + (halfCol / 5 + 1 / 10) * PANEL_BOUNDS.width;
    const focalRowFraction = halfRow / 4 + 1 / 8;
    const focalY =
      g.team === "home"
        ? PANEL_BOUNDS.top + focalRowFraction * (PANEL_BOUNDS.height / 2)
        : midY + focalRowFraction * (PANEL_BOUNDS.height / 2);
    const team = g.team === "home" ? home : away;
    const palette = Array.from(
      new Set(
        [team.flagPrimary, team.flagSecondary, team.flagAccent].map((c) =>
          c.toLowerCase(),
        ),
      ),
    );
    return { goal: g, triggerFrame, focalX, focalY, palette };
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

  // Build all rectangle bars across all active goals. Each bar grows
  // from focal outward, then persists.
  const bars: React.ReactNode[] = [];
  let whiteOverlay = 0;
  resolved.forEach((rg, gIdx) => {
    const local = frame - rg.triggerFrame;
    if (local < 0) return;
    const progress =
      local <= GROW_FRAMES ? easeOutCubic(local / GROW_FRAMES) : 1;
    whiteOverlay = Math.max(whiteOverlay, progress);

    const maxReach = Math.hypot(PANEL_BOUNDS.width, PANEL_BOUNDS.height) * 0.55;
    for (let w = 0; w < BARS_PER_GOAL; w++) {
      const seed = gIdx * 257 + w * 9;
      const r1 = (Math.sin(seed * 12.9898) + 1) / 2;
      const r2 = (Math.sin(seed * 78.233) + 1) / 2;
      const r3 = (Math.sin(seed * 39.41) + 1) / 2;
      const r4 = (Math.sin(seed * 53.91) + 1) / 2;

      // Snap angle to one of ANGLE_STEPS equally spaced directions.
      const stepIdx = Math.floor(r1 * ANGLE_STEPS) % ANGLE_STEPS;
      const angle = (stepIdx / ANGLE_STEPS) * Math.PI * 2;
      const isLong = r2 < 0.2;
      const len = (isLong ? 0.55 + r3 * 0.2 : 0.12 + r3 * 0.25) * maxReach;
      const reach = len * progress;
      // Square cross-section — width perpendicular to the bar.
      const thickness = 14 + r4 * 38;

      // Build the rectangle as a rotated polygon so it sits along the
      // angle's axis and starts at the focal corner.
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const px = -sin; // perpendicular x
      const py = cos; // perpendicular y
      const half = thickness / 2;
      const x1 = rg.focalX + px * half;
      const y1 = rg.focalY + py * half;
      const x2 = rg.focalX - px * half;
      const y2 = rg.focalY - py * half;
      const x3 = rg.focalX - px * half + cos * reach;
      const y3 = rg.focalY - py * half + sin * reach;
      const x4 = rg.focalX + px * half + cos * reach;
      const y4 = rg.focalY + py * half + sin * reach;
      const color = rg.palette[(w + gIdx) % rg.palette.length];
      bars.push(
        <polygon
          key={`g${gIdx}-b${w}`}
          points={`${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ${x3.toFixed(1)},${y3.toFixed(1)} ${x4.toFixed(1)},${y4.toFixed(1)}`}
          fill={color}
        />,
      );
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
          <clipPath id="squareburst-panel-clip">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
            />
          </clipPath>
        </defs>
        <g clipPath="url(#squareburst-panel-clip)">
          {whiteOverlay > 0 && (
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
              fill="#FFFFFF"
              opacity={whiteOverlay * 0.35}
            />
          )}
          {bars}
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
