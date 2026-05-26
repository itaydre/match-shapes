import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { BaseLayout, PANEL_BOUNDS } from "./components/BaseLayout";
import { ScoreNumeral } from "./components/ScoreNumeral";
import { matchCardSchema } from "./schema";
import type { MatchCardProps } from "./schema";
import { minuteToFrame } from "./lib/timing";
import { project, ensureStudio, T } from "./lib/theatre";
import type { ISheet, ISheetObject } from "@theatre/core";

// Per-goal Theatre.js wiring. Each goal gets its own sheet ("Goal 1",
// "Goal 2", …) so its wedge burst is authored on its own local timeline
// rooted at the goal's trigger frame. Theatre Studio shows one panel per
// goal so you can keyframe each goal's animation independently.

const CANVAS_W = 1080;
const CANVAS_H = 2340;
const WEDGES = 36;
// Number of authorable goal slots. Goals beyond this index render but
// without Theatre control.
const GOAL_SLOTS = 6;

type WedgeSpec = {
  reachMul: number;
  thicknessMul: number;
  focalDX: number;
  focalDY: number;
  whiteAlpha: number;
  rotation: number;
};

const buildGoalSheet = (
  i: number,
): { sheet: ISheet; wedge: ISheetObject<WedgeSpec> } => {
  const sh = project.sheet(`Goal ${i + 1}`);
  const wedge = sh.object(`Wedge`, {
    reachMul: T.number(1, { range: [0, 2] }),
    thicknessMul: T.number(1, { range: [0.2, 4] }),
    focalDX: T.number(0, { range: [-400, 400] }),
    focalDY: T.number(0, { range: [-600, 600] }),
    whiteAlpha: T.number(0, { range: [0, 1] }),
    rotation: T.number(0, { range: [-Math.PI, Math.PI] }),
  }) as ISheetObject<WedgeSpec>;
  return { sheet: sh, wedge };
};

const GOAL_SHEETS = Array.from({ length: GOAL_SLOTS }, (_, i) =>
  buildGoalSheet(i),
);

// Renders one goal's wedge burst, driven by its own Theatre sheet.
const GoalBurst: React.FC<{
  goalIndex: number;
  triggerFrame: number;
  palette: string[];
  panelFocalX: number;
  panelFocalY: number;
}> = ({ goalIndex, triggerFrame, palette, panelFocalX, panelFocalY }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slot = GOAL_SHEETS[goalIndex % GOAL_SLOTS]!;
  const { sheet: gSheet, wedge } = slot;

  // Local timeline for this goal — Theatre's sequence position is the
  // frames elapsed since the goal fired, expressed in seconds.
  gSheet.sequence.position = Math.max(0, (frame - triggerFrame) / fps);

  // Force re-render whenever this goal's values change in the panel.
  const [, setV] = React.useState(0);
  React.useEffect(
    () => wedge.onValuesChange(() => setV((v) => v + 1)),
    [wedge],
  );

  if (frame < triggerFrame) return null;

  const tv = wedge.value;
  const focalX = panelFocalX + tv.focalDX;
  const focalY = panelFocalY + tv.focalDY;
  const maxReach =
    Math.hypot(PANEL_BOUNDS.width, PANEL_BOUNDS.height) * 0.55 * tv.reachMul;

  const wedges: React.ReactNode[] = [];
  for (let w = 0; w < WEDGES; w++) {
    const seed = goalIndex * 257 + w * 9;
    const r1 = (Math.sin(seed * 12.9898) + 1) / 2;
    const r2 = (Math.sin(seed * 78.233) + 1) / 2;
    const r3 = (Math.sin(seed * 39.41) + 1) / 2;
    const angle = r1 * Math.PI * 2 + tv.rotation;
    const len = (0.3 + r2 * 0.5) * maxReach;
    const baseAngle = (0.012 + r3 * 0.028) * tv.thicknessMul;
    const a0 = angle - baseAngle / 2;
    const a1 = angle + baseAngle / 2;
    const color = palette[w % palette.length]!;
    wedges.push(
      <polygon
        key={w}
        points={`${focalX.toFixed(1)},${focalY.toFixed(1)} ${(focalX + Math.cos(a0) * len).toFixed(1)},${(focalY + Math.sin(a0) * len).toFixed(1)} ${(focalX + Math.cos(a1) * len).toFixed(1)},${(focalY + Math.sin(a1) * len).toFixed(1)}`}
        fill={color}
      />,
    );
  }

  return (
    <g>
      {tv.whiteAlpha > 0 && (
        <rect
          x={PANEL_BOUNDS.left}
          y={PANEL_BOUNDS.top}
          width={PANEL_BOUNDS.width}
          height={PANEL_BOUNDS.height}
          fill="#FFFFFF"
          opacity={tv.whiteAlpha}
        />
      )}
      {wedges}
    </g>
  );
};

export const GridMatchCardTheatre: React.FC<MatchCardProps> = (props) => {
  const frame = useCurrentFrame();
  const { home, away, competition, venue, date, goals } = props;

  React.useEffect(() => {
    ensureStudio();
  }, []);

  const midY = (PANEL_BOUNDS.top + PANEL_BOUNDS.bottom) / 2;
  const cx = (PANEL_BOUNDS.left + PANEL_BOUNDS.right) / 2;

  const resolvedGoals = goals.map((g, i) => {
    const triggerFrame = minuteToFrame(g.minute);
    const team = g.team === "home" ? home : away;
    const palette = Array.from(
      new Set(
        [team.flagPrimary, team.flagSecondary, team.flagAccent].map((c) =>
          c.toLowerCase(),
        ),
      ),
    );
    // Default focal — centre of the team's half of the pitch. The
    // per-goal focalDX/focalDY in Theatre offset from here.
    const focalY =
      g.team === "home"
        ? (PANEL_BOUNDS.top + midY) / 2
        : (midY + PANEL_BOUNDS.bottom) / 2;
    return { goal: g, index: i, triggerFrame, palette, focalX: cx, focalY };
  });

  const homeFired = resolvedGoals.filter(
    (rg) => rg.goal.team === "home" && frame >= rg.triggerFrame,
  ).length;
  const awayFired = resolvedGoals.filter(
    (rg) => rg.goal.team === "away" && frame >= rg.triggerFrame,
  ).length;
  const lastHomeBump = resolvedGoals
    .filter((rg) => rg.goal.team === "home" && frame >= rg.triggerFrame)
    .map((rg) => rg.triggerFrame)
    .pop();
  const lastAwayBump = resolvedGoals
    .filter((rg) => rg.goal.team === "away" && frame >= rg.triggerFrame)
    .map((rg) => rg.triggerFrame)
    .pop();

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
          <clipPath id="theatre-panel-clip">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
            />
          </clipPath>
        </defs>
        <g clipPath="url(#theatre-panel-clip)">
          {resolvedGoals.map((rg) => (
            <GoalBurst
              key={rg.index}
              goalIndex={rg.index}
              triggerFrame={rg.triggerFrame}
              palette={rg.palette}
              panelFocalX={rg.focalX}
              panelFocalY={rg.focalY}
            />
          ))}
        </g>
      </svg>
      <ScoreNumeral
        value={homeFired}
        color={home.flagPrimary}
        cx={cx}
        cy={(PANEL_BOUNDS.top + midY) / 2}
        bumpFrame={lastHomeBump ?? -1}
        sweepFrames={8}
        sweepDirection="horizontal"
      />
      <ScoreNumeral
        value={awayFired}
        color={away.flagPrimary}
        cx={cx}
        cy={(midY + PANEL_BOUNDS.bottom) / 2}
        bumpFrame={lastAwayBump ?? -1}
        sweepFrames={8}
        sweepDirection="horizontal"
      />
    </AbsoluteFill>
  );
};

export { matchCardSchema };
