import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BaseLayout, PANEL_BOUNDS } from "./components/BaseLayout";
import { ScoreNumeral } from "./components/ScoreNumeral";
import { matchCardSchema } from "./schema";
import type { MatchCardProps, Goal } from "./schema";
import { minuteToFrame } from "./lib/timing";

// Wedge-burst goal animation. Each goal fires a dense cloud of narrow
// triangular wedges radiating ~360° from its focal point on a white
// ground, painted in the SCORING team's flag colours only. Wedges grow
// outward over the reveal and then stay on screen permanently — each
// new goal stacks its own burst over the previous ones.

const CANVAS_W = 1080;
const CANVAS_H = 2340;
const WEDGES_PER_GOAL = 55;
const GROW_FRAMES = 18;

type ResolvedGoal = {
  goal: Goal;
  triggerFrame: number;
  focalX: number;
  focalY: number;
  palette: string[];
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export const GridMatchCardWedgeBurst: React.FC<MatchCardProps> = (props) => {
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
    // Per-goal palette — only the scoring team's flag colours, deduped.
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

  // Build all wedge shapes across all active goals. Once a goal has
  // fired, its wedges stay rendered for the rest of the video — newer
  // goals stack their own bursts on top.
  const wedges: React.ReactNode[] = [];
  let whiteOverlay = 0;
  resolved.forEach((rg, gIdx) => {
    const local = frame - rg.triggerFrame;
    if (local < 0) return;
    const progress =
      local <= GROW_FRAMES ? easeOutCubic(local / GROW_FRAMES) : 1;
    whiteOverlay = Math.max(whiteOverlay, progress);

    // Reach scaled to the panel (not full canvas) so wedges stay
    // contained — keeps the burst quieter and inside the pitch box.
    const maxReach = Math.hypot(PANEL_BOUNDS.width, PANEL_BOUNDS.height) * 0.55;
    for (let w = 0; w < WEDGES_PER_GOAL; w++) {
      const seed = gIdx * 257 + w * 9;
      const r1 = (Math.sin(seed * 12.9898) + 1) / 2;
      const r2 = (Math.sin(seed * 78.233) + 1) / 2;
      const r3 = (Math.sin(seed * 39.41) + 1) / 2;
      const r4 = (Math.sin(seed * 53.91) + 1) / 2;

      // Random angle, length, width — varied lengths give the cloud
      // its uneven silhouette.
      const angle = r1 * Math.PI * 2;
      // ~20% are slightly longer spikes; rest are short.
      const isLong = r2 < 0.2;
      const len = (isLong ? 0.55 + r3 * 0.2 : 0.12 + r3 * 0.25) * maxReach;
      const reach = len * progress;
      // Slimmer wedges — less visual weight per goal.
      const baseAngle = 0.012 + r4 * 0.028; // radians spread at the focal
      // Three points: focal + two outer corners.
      const a0 = angle - baseAngle / 2;
      const a1 = angle + baseAngle / 2;
      const p0x = rg.focalX;
      const p0y = rg.focalY;
      const p1x = rg.focalX + Math.cos(a0) * reach;
      const p1y = rg.focalY + Math.sin(a0) * reach;
      const p2x = rg.focalX + Math.cos(a1) * reach;
      const p2y = rg.focalY + Math.sin(a1) * reach;
      // Pick a colour weighted toward whichever team scored this goal.
      const color = rg.palette[(w + gIdx) % rg.palette.length];
      wedges.push(
        <polygon
          key={`g${gIdx}-w${w}`}
          points={`${p0x.toFixed(1)},${p0y.toFixed(1)} ${p1x.toFixed(1)},${p1y.toFixed(1)} ${p2x.toFixed(1)},${p2y.toFixed(1)}`}
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
          <clipPath id="wedgeburst-panel-clip">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
            />
          </clipPath>
        </defs>
        <g clipPath="url(#wedgeburst-panel-clip)">
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
          {wedges}
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
