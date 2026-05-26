import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BaseLayout, PANEL_BOUNDS } from "./components/BaseLayout";
import { ScoreNumeral } from "./components/ScoreNumeral";
import { matchCardSchema } from "./schema";
import type { MatchCardProps, Goal } from "./schema";
import { minuteToFrame } from "./lib/timing";

// Same wedge-burst language as GridMatchCardWedgeBurst, but every goal
// renders with a DIFFERENT angle/orientation/shape variation, and the
// burst is painted only in the scoring team's flag colours (not a
// mixed palette). Five distinct variations cycle by goal index.

const CANVAS_W = 1080;
const CANVAS_H = 2340;
const WEDGES_PER_GOAL = 70;
const GOAL_DUR = 100;
const GROW_FRAMES = 18;
const HOLD_FRAMES = 50;

type Variation = {
  centerAngle: number;   // radians; 0 = right, -π/2 = up
  spread: number;        // total radians of opening
  longProb: number;      // fraction of wedges that are "long" spikes
  baseWidthMul: number;  // base-angle multiplier for fatness
};

const VARIATIONS: Variation[] = [
  // 0 — full 360° burst, lots of long spikes
  { centerAngle: 0, spread: Math.PI * 2, longProb: 0.35, baseWidthMul: 1 },
  // 1 — upward fan
  { centerAngle: -Math.PI / 2, spread: Math.PI, longProb: 0.45, baseWidthMul: 1 },
  // 2 — rightward fan
  { centerAngle: 0, spread: Math.PI, longProb: 0.4, baseWidthMul: 1.2 },
  // 3 — diagonal cone (up-right), narrower
  { centerAngle: -Math.PI / 4, spread: Math.PI / 2, longProb: 0.55, baseWidthMul: 0.7 },
  // 4 — horizontal slit, very wide spikes
  { centerAngle: 0, spread: Math.PI / 3, longProb: 0.7, baseWidthMul: 2.4 },
];

type ResolvedGoal = {
  goal: Goal;
  triggerFrame: number;
  focalX: number;
  focalY: number;
  palette: string[];
  variation: Variation;
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export const GridMatchCardWedgeVariations: React.FC<MatchCardProps> = (
  props,
) => {
  const frame = useCurrentFrame();
  const { home, away, competition, venue, date, goals } = props;

  const midY = (PANEL_BOUNDS.top + PANEL_BOUNDS.bottom) / 2;
  const cx = (PANEL_BOUNDS.left + PANEL_BOUNDS.right) / 2;

  const resolved: ResolvedGoal[] = goals.map((g, i) => {
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
    return {
      goal: g,
      triggerFrame,
      focalX,
      focalY,
      palette,
      variation: VARIATIONS[i % VARIATIONS.length],
    };
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

  const wedges: React.ReactNode[] = [];
  let whiteOverlay = 0;
  resolved.forEach((rg, gIdx) => {
    const local = frame - rg.triggerFrame;
    if (local < 0 || local > GOAL_DUR) return;
    let progress: number;
    if (local <= GROW_FRAMES) {
      progress = easeOutCubic(local / GROW_FRAMES);
    } else if (local <= GROW_FRAMES + HOLD_FRAMES) {
      progress = 1;
    } else {
      const t =
        (local - GROW_FRAMES - HOLD_FRAMES) /
        (GOAL_DUR - GROW_FRAMES - HOLD_FRAMES);
      progress = 1 - t;
    }
    whiteOverlay = Math.max(whiteOverlay, progress);

    const v = rg.variation;
    const startAng = v.centerAngle - v.spread / 2;
    const maxReach = Math.hypot(PANEL_BOUNDS.width, PANEL_BOUNDS.height);

    for (let w = 0; w < WEDGES_PER_GOAL; w++) {
      const seed = gIdx * 257 + w * 9;
      const r1 = (Math.sin(seed * 12.9898) + 1) / 2;
      const r2 = (Math.sin(seed * 78.233) + 1) / 2;
      const r3 = (Math.sin(seed * 39.41) + 1) / 2;
      const r4 = (Math.sin(seed * 53.91) + 1) / 2;

      const angle = startAng + r1 * v.spread;
      const isLong = r2 < v.longProb;
      const len =
        (isLong ? 0.9 + r3 * 0.25 : 0.18 + r3 * 0.5) * maxReach;
      const reach = len * progress;
      const baseAngle = (0.005 + r4 * 0.018) * v.baseWidthMul;
      const a0 = angle - baseAngle / 2;
      const a1 = angle + baseAngle / 2;
      const p1x = rg.focalX + Math.cos(a0) * reach;
      const p1y = rg.focalY + Math.sin(a0) * reach;
      const p2x = rg.focalX + Math.cos(a1) * reach;
      const p2y = rg.focalY + Math.sin(a1) * reach;
      const color = rg.palette[w % rg.palette.length];
      wedges.push(
        <polygon
          key={`g${gIdx}-w${w}`}
          points={`${rg.focalX.toFixed(1)},${rg.focalY.toFixed(1)} ${p1x.toFixed(1)},${p1y.toFixed(1)} ${p2x.toFixed(1)},${p2y.toFixed(1)}`}
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
          <clipPath id="wedgevar-panel-clip">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
            />
          </clipPath>
        </defs>
        <g clipPath="url(#wedgevar-panel-clip)">
          {whiteOverlay > 0 && (
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
              fill="#FFFFFF"
              opacity={whiteOverlay}
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
