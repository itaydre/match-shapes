import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BaseLayout, PANEL_BOUNDS } from "./components/BaseLayout";
import { ScoreNumeral } from "./components/ScoreNumeral";
import { matchCardSchema } from "./schema";
import type { MatchCardProps, Goal, Team } from "./schema";
import { minuteToFrame, MATCH_END } from "./lib/timing";
import {
  buildCellGrid,
  DEFAULT_SETTINGS,
  type CellGridType,
  type CellGridSettings,
} from "./lib/cellGrid";
import {
  boundaryPathForBox,
  type LabBoundaryShape,
} from "./lib/boundaryShapes";

// El Clásico — Barcelona vs Real Madrid, 10 May 2026 at Camp Nou.
// Final score 2-0 to Barcelona (Rashford 9', F. Torres 18'). Home =
// Barcelona occupies the top half of the panel; away = Real Madrid
// fills the bottom half when they score.
//
// Ported to the cellGrid + boundary-shape system used by
// GridMatchCardBrazilSketch / BrazilSketchLab: each goal owns a recipe
// (procedural pattern type + numeric settings + boundary silhouette)
// rather than a hand-built shape path rasterised onto a visible grid.

const CANVAS_W = 1080;
const CANVAS_H = 2340;
// Slower reveal so each goal pattern reads cleanly on the 9s timeline.
const REVEAL_DUR = 40;
// Minimum video-frame gap between consecutive goal triggers so the
// pattern reveals don't overlap when match minutes are close together
// (Rashford 9' + F. Torres 18' would otherwise stack).
const MIN_GOAL_GAP = 60;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

type GoalRecipe = {
  type: CellGridType;
  boundary: LabBoundaryShape;
  overrides: Partial<CellGridSettings>;
};

// Barcelona — top half. Each goal picks a different pattern + boundary
// so the half reads with two contrasting "moods" stacked.
const HOME_RECIPES: GoalRecipe[] = [
  // Rashford 9' — claret blocks, dense Cartesian grain, arched silhouette
  // pointing toward the badge.
  {
    type: "blocks",
    boundary: "arch",
    overrides: {
      shapeDensity: 20,
      shapeScale: 0.6,
      distortionStrength: 50,
      outwardForce: 22,
      rotation: 8,
      margin: 40,
      colorRandomness: 26,
      dominantColor: 60,
      colorClustering: 28,
      colorContrast: 45,
      seed: 9,
    },
  },
  // F. Torres 18' — blaugrana wedges fanning out in a circle.
  {
    type: "wedges",
    boundary: "circle",
    overrides: {
      shapeDensity: 24,
      shapeScale: 0.85,
      distortionStrength: 45,
      outwardForce: 28,
      curvature: 35,
      rotation: 18,
      margin: 30,
      colorRandomness: 22,
      dominantColor: 40,
      colorClustering: 18,
      colorContrast: 60,
      seed: 18,
    },
  },
];

// Real Madrid — bottom half. Defensive set, in case the fixture state
// changes or future re-runs add late Madrid goals.
const AWAY_RECIPES: GoalRecipe[] = [
  // Crest-blue radial segments inside an oval — Madrid kit silhouette.
  {
    type: "radial_segments",
    boundary: "oval",
    overrides: {
      shapeDensity: 22,
      shapeScale: 0.8,
      distortionStrength: 40,
      outwardForce: 30,
      curvature: 25,
      rotation: 0,
      margin: 30,
      colorRandomness: 22,
      dominantColor: 55,
      colorClustering: 22,
      colorContrast: 50,
      seed: 27,
    },
  },
  // Warped bands clipped to a capsule — slower, sweeping read.
  {
    type: "warped_bands",
    boundary: "capsule",
    overrides: {
      shapeDensity: 14,
      shapeScale: 0.95,
      distortionStrength: 60,
      outwardForce: 24,
      rotation: 0,
      margin: 30,
      colorRandomness: 22,
      dominantColor: 55,
      colorContrast: 55,
      seed: 41,
    },
  },
];

const FALLBACK_RECIPE: GoalRecipe = {
  type: "warped_bands",
  boundary: "rectangle",
  overrides: { seed: 91 },
};

const pickRecipe = (team: "home" | "away", teamIndex: number): GoalRecipe => {
  const list = team === "home" ? HOME_RECIPES : AWAY_RECIPES;
  return list[teamIndex] ?? FALLBACK_RECIPE;
};

// Palette ordering matters — palette[0] is the dominant colour. Black
// at the tail surfaces in distortion as inky negative space.
const palettesFor = (
  team: "home" | "away",
  home: Team,
  away: Team,
): string[] => {
  if (team === "home") {
    return [home.flagPrimary, home.flagSecondary, home.flagAccent, "#0E0E0E"];
  }
  return [
    away.flagPrimary,
    away.flagSecondary,
    away.flagAccent,
    "#0E0E0E",
  ];
};

// Real scorers from the El Clásico recap (Rashford & Ferran Torres for
// Barça; rotating roster for any future goals).
const HOME_SCORERS = ["RASHFORD", "F. TORRES", "LEWANDOWSKI"];
const AWAY_SCORERS = ["MBAPPÉ", "VINICIUS JR.", "BELLINGHAM"];

export const GridMatchCardElClasico: React.FC<MatchCardProps> = (props) => {
  const frame = useCurrentFrame();
  const { home, away, competition, venue, date, goals } = props;

  const midY = (PANEL_BOUNDS.top + PANEL_BOUNDS.bottom) / 2;
  const cx = (PANEL_BOUNDS.left + PANEL_BOUNDS.right) / 2;

  const homeZone = {
    x: PANEL_BOUNDS.left,
    y: PANEL_BOUNDS.top,
    w: PANEL_BOUNDS.width,
    h: midY - PANEL_BOUNDS.top,
  };
  const awayZone = {
    x: PANEL_BOUNDS.left,
    y: midY,
    w: PANEL_BOUNDS.width,
    h: PANEL_BOUNDS.bottom - midY,
  };
  const zoneFor = (team: "home" | "away") =>
    team === "home" ? homeZone : awayZone;

  // Horizontal overshoot — extend shapes 18% past each side so the
  // panel's beige side strips hide the rectangular edges.
  const overshootRatio = 0.18;

  // Compute trigger frames from real minutes, then push them apart so
  // consecutive goals don't stack their reveals.
  const rawTriggers = goals.map((g: Goal) => minuteToFrame(g.minute));
  const triggers: number[] = [];
  for (let i = 0; i < rawTriggers.length; i++) {
    let t = rawTriggers[i]!;
    if (i > 0) t = Math.max(t, triggers[i - 1]! + MIN_GOAL_GAP);
    t = Math.min(t, MATCH_END);
    triggers.push(t);
  }

  let homeCount = 0;
  let awayCount = 0;
  const goalEntries = goals.map((goal, i) => {
    const teamIndex = goal.team === "home" ? homeCount++ : awayCount++;
    return { goal, i, t: triggers[i]!, teamIndex };
  });

  const homeFired = goals.filter(
    (g, i) => g.team === "home" && frame >= triggers[i]!,
  ).length;
  const awayFired = goals.filter(
    (g, i) => g.team === "away" && frame >= triggers[i]!,
  ).length;
  const lastHomeBump = goals
    .map((g, i) => ({ g, t: triggers[i]! }))
    .filter(({ g, t }) => g.team === "home" && frame >= t)
    .map(({ t }) => t)
    .pop();
  const lastAwayBump = goals
    .map((g, i) => ({ g, t: triggers[i]! }))
    .filter(({ g, t }) => g.team === "away" && frame >= t)
    .map(({ t }) => t)
    .pop();

  // Build the cell grid for each goal. Grids are deterministic, so a
  // single build per geometry is fine — the reveal clip drives motion.
  const renderedGoals = goalEntries.map((entry) => {
    const zone = zoneFor(entry.goal.team);
    const overshoot = zone.w * overshootRatio;
    const totalW = zone.w + overshoot * 2;
    const recipe = pickRecipe(entry.goal.team, entry.teamIndex);
    const settings: CellGridSettings = {
      ...DEFAULT_SETTINGS,
      ...recipe.overrides,
    };
    const palette = palettesFor(entry.goal.team, home, away);
    const cells = buildCellGrid(recipe.type, settings, totalW, zone.h, palette);
    return { entry, zone, overshoot, totalW, cells, recipe };
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
          <clipPath id="clasico-panel-clip">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
            />
          </clipPath>
          {/* Per-goal reveal circle and boundary silhouette clipPaths. */}
          {renderedGoals.map(({ entry, zone, totalW, recipe }) => {
            const local = frame - entry.t;
            const reveal =
              local < 0 ? 0 : easeOutCubic(clamp(local / REVEAL_DUR));
            const focalX = zone.x + zone.w / 2;
            const focalY = zone.y + zone.h / 2;
            const maxR = Math.hypot(totalW / 2, zone.h / 2) * 1.05;
            return (
              <React.Fragment key={`clips-${entry.i}`}>
                <clipPath id={`clasico-reveal-${entry.i}`}>
                  <circle cx={focalX} cy={focalY} r={maxR * reveal} />
                </clipPath>
                <clipPath id={`clasico-boundary-${entry.i}`}>
                  <path
                    d={boundaryPathForBox(
                      recipe.boundary,
                      zone.x,
                      zone.y,
                      zone.w,
                      zone.h,
                      entry.i * 11 + 7,
                    )}
                  />
                </clipPath>
              </React.Fragment>
            );
          })}
        </defs>
        <g clipPath="url(#clasico-panel-clip)">
          {renderedGoals.map(({ entry, zone, overshoot, cells }) => {
            if (frame < entry.t) return null;
            return (
              <g
                key={`${entry.i}-${entry.t}`}
                clipPath={`url(#clasico-boundary-${entry.i})`}
              >
                <g clipPath={`url(#clasico-reveal-${entry.i})`}>
                  <g transform={`translate(${zone.x - overshoot} ${zone.y})`}>
                    {cells.map((cell, ci) => (
                      <rect
                        key={ci}
                        x={cell.x}
                        y={cell.y}
                        width={cell.w}
                        height={cell.h}
                        fill={cell.color}
                        transform={cell.transform || undefined}
                      />
                    ))}
                  </g>
                </g>
              </g>
            );
          })}
        </g>
        {/* Per-goal minute + scorer labels. Minute sits in the upper
            corner of the score numeral; scorer flanks it on the
            opposite side, vertically centred. */}
        {renderedGoals.map(({ entry }) => {
          if (frame < entry.t) return null;
          const local = frame - entry.t;
          const LABEL_HOLD = 40;
          const LABEL_FADE = 14;
          const labelOpacity =
            local <= LABEL_HOLD
              ? 1
              : Math.max(0, 1 - (local - LABEL_HOLD) / LABEL_FADE);
          if (labelOpacity <= 0) return null;
          const isHome = entry.goal.team === "home";
          const scorers = isHome ? HOME_SCORERS : AWAY_SCORERS;
          const scorerName = scorers[entry.teamIndex % scorers.length]!;
          const scoreCy = isHome
            ? (PANEL_BOUNDS.top + midY) / 2
            : (midY + PANEL_BOUNDS.bottom) / 2;
          const minuteRight = (entry.i * 7 + 3) % 2 === 0;
          const halfDigit = 160;
          const minuteX = minuteRight ? cx + halfDigit + 6 : cx - halfDigit - 6;
          const minuteY = scoreCy - 210;
          const minuteAnchor: "start" | "end" = minuteRight ? "start" : "end";
          const scorerRight = !minuteRight;
          const labelX = scorerRight
            ? cx + halfDigit + 40
            : cx - halfDigit - 40;
          const scorerAnchor: "start" | "end" = scorerRight ? "start" : "end";
          return (
            <g key={`label-${entry.i}`} opacity={labelOpacity}>
              <text
                x={minuteX}
                y={minuteY}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontWeight={900}
                fontSize={64}
                fill="#0E0E0E"
                letterSpacing="2"
                textAnchor={minuteAnchor}
              >
                {entry.goal.minute}&apos;
              </text>
              <text
                x={labelX}
                y={scoreCy + 80}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontWeight={800}
                fontSize={44}
                fill="#0E0E0E"
                letterSpacing="2"
                textAnchor={scorerAnchor}
              >
                {scorerName}
              </text>
            </g>
          );
        })}
      </svg>

      <ScoreNumeral
        value={homeFired}
        color={home.flagPrimary}
        cx={cx}
        cy={(PANEL_BOUNDS.top + midY) / 2}
        bumpFrame={lastHomeBump ?? -1}
        sweepFrames={8}
        sweepDirection="horizontal"
        outlineColor="#FFFFFF"
        outlineWidth={14}
      />
      <ScoreNumeral
        value={awayFired}
        color={away.flagPrimary}
        cx={cx}
        cy={(midY + PANEL_BOUNDS.bottom) / 2}
        bumpFrame={lastAwayBump ?? -1}
        sweepFrames={8}
        sweepDirection="horizontal"
        outlineColor="#FFFFFF"
        outlineWidth={14}
      />
    </AbsoluteFill>
  );
};

export { matchCardSchema };
