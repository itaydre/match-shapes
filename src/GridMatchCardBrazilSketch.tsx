import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BaseLayout, PANEL_BOUNDS } from "./components/BaseLayout";
import { ScoreNumeral } from "./components/ScoreNumeral";
import { matchCardSchema } from "./schema";
import type { MatchCardProps, Goal, Team } from "./schema";
import { minuteToFrame } from "./lib/timing";
import {
  buildCellGrid,
  buildFieldLayers,
  DEFAULT_SETTINGS,
  type CellGridType,
  type CellGridSettings,
  type FieldLayer,
} from "./lib/cellGrid";
import {
  boundaryPathForBox,
  type LabBoundaryShape,
} from "./lib/boundaryShapes";
import { oscillateSettings } from "./lib/oscillate";

// Per-team sketch language. Each goal paints a different team-coloured
// cell-grid pattern into its half of the pitch — England (home) on the
// top half, Brazil (away) on the bottom half. Every grid spans the
// FULL pitch width with an 18% overshoot on each side so the
// rectangular edges hide behind the panel's side strips. The reveal
// is a circle clip growing fast from the half's centre outward.

const CANVAS_W = 1080;
const CANVAS_H = 2340;
const REVEAL_DUR = 24;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

// Ordered list of cell-grid recipes per team. Index = nth goal scored
// by that team. If a team scores past the end, the fallback entry is
// used.
type GoalRecipe = {
  type: CellGridType;
  overrides: Partial<CellGridSettings>;
};

const HOME_RECIPES: GoalRecipe[] = [
  // England 1st goal — hard-edged red blocks rotated against the grain.
  {
    type: "blocks",
    overrides: {
      shapeDensity: 22,
      shapeScale: 0.55,
      distortionStrength: 45,
      outwardForce: 18,
      rotation: 18,
      margin: 40,
      colorRandomness: 28,
      dominantColor: 55,
      colorClustering: 25,
      colorContrast: 40,
      seed: 11,
    },
  },
  // England 2nd goal — warped horizontal bands, fallback for 3rd+.
  {
    type: "warped_bands",
    overrides: {
      shapeDensity: 14,
      shapeScale: 0.95,
      distortionStrength: 60,
      outwardForce: 25,
      rotation: 0,
      margin: 30,
      colorRandomness: 22,
      dominantColor: 60,
      colorContrast: 55,
      seed: 37,
    },
  },
];

const AWAY_RECIPES: GoalRecipe[] = [
  // Brazil 1st goal — broad warped Cartesian blocks (yellow-dominant).
  {
    type: "blocks",
    overrides: {
      shapeDensity: 18,
      shapeScale: 0.6,
      distortionStrength: 55,
      outwardForce: 22,
      rotation: 151,
      margin: 40,
      colorRandomness: 30,
      dominantColor: 50,
      colorClustering: 30,
      colorContrast: 55,
      seed: 7,
    },
  },
  // Brazil 2nd goal — polar pie wedges, dense.
  {
    type: "wedges",
    overrides: {
      shapeDensity: 26,
      shapeScale: 0.85,
      distortionStrength: 45,
      outwardForce: 30,
      curvature: 40,
      rotation: 35,
      margin: 30,
      colorRandomness: 25,
      dominantColor: 35,
      colorClustering: 15,
      colorContrast: 65,
      seed: 19,
    },
  },
];

const FALLBACK_RECIPE: GoalRecipe = {
  type: "warped_bands",
  overrides: { seed: 91 },
};

const pickRecipe = (team: "home" | "away", teamIndex: number): GoalRecipe => {
  const list = team === "home" ? HOME_RECIPES : AWAY_RECIPES;
  return list[teamIndex] ?? FALLBACK_RECIPE;
};

// Lab override — opt-in surface used by the Brazil Sketch Lab playground.
// Drives every goal off a single settings object and clips the revealed
// pattern by an SVG boundary.
export type { LabBoundaryShape };
export type LabOverride = {
  type: CellGridType;
  settings: CellGridSettings;
  boundary: LabBoundaryShape;
  // Per-goal sub-region inside the team's half of the panel. All values
  // are 0..100 percentages. posX/posY = centre of the goal's sub-box
  // (relative to the team zone); size = sub-box edge length as a
  // fraction of the zone's min dimension. When omitted, the goal fills
  // the full team zone (legacy behaviour).
  posX?: number;
  posY?: number;
  size?: number;
  // Field-layer controls — pass-through to cellGrid.buildFieldLayers.
  moireStrength?: number;
  blendTarget?: CellGridType;
  blendAmount?: number;
  recursionDepth?: number;
};

// Quick Rec. 709 luma check — anything brighter than ~80% would
// dominate the panel background if it led the palette.
const isLightColor = (hex: string): boolean => {
  const h = hex.replace("#", "");
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return r * 0.2126 + g * 0.7152 + b * 0.0722 > 205;
};

// Palette ordering matters — palette[0] is the dominant colour. We mix
// in pure black at the tail so distortion produces moments of inky
// negative space. When the home team's primary is white-ish (France's
// tricolor leads with white), we rotate the palette so a usable team
// colour (accent, then secondary) drives the animation — otherwise the
// patterns wash into the panel.
const palettesFor = (
  team: "home" | "away",
  home: Team,
  away: Team,
): string[] => {
  const t = team === "home" ? home : away;
  if (isLightColor(t.flagPrimary)) {
    return [t.flagAccent, t.flagSecondary, t.flagPrimary];
  }
  return [t.flagPrimary, t.flagSecondary, t.flagAccent];
};

export const GridMatchCardBrazilSketch: React.FC<
  MatchCardProps & {
    // Per-goal overrides indexed by goals[i]. Each entry, when present,
    // bypasses the goal's default recipe and forces a specific
    // type / settings / boundary.
    previewOverrides?: (LabOverride | null | undefined)[];
  }
> = (props) => {
  const frame = useCurrentFrame();
  const {
    home,
    away,
    competition,
    venue,
    date,
    goals,
    previewOverrides,
  } = props;

  const midY = (PANEL_BOUNDS.top + PANEL_BOUNDS.bottom) / 2;
  const cx = (PANEL_BOUNDS.left + PANEL_BOUNDS.right) / 2;

  // Each team owns one half of the pitch — the same zone that hosts
  // its score numeral. Both halves run the full panel width.
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
  // panel's beige side strips hide the rectangular ends.
  const overshootRatio = 0.18;

  const triggers: number[] = goals.map((g: Goal) => minuteToFrame(g.minute));

  // For each goal, figure out which team-specific sketch slot it
  // occupies (0 = team's first goal, 1 = second, …).
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

  // Build the cell grid for each goal. Each grid is generated once
  // per (team, teamIndex, dimensions) — the cellGrid module is
  // deterministic, so a static grid is fine; the reveal clip drives
  // the animation.
  const renderedGoals = goalEntries.map((entry) => {
    const teamZone = zoneFor(entry.goal.team);
    const override = previewOverrides?.[entry.i] ?? null;
    // Sub-zone — where this specific goal's pattern actually lives.
    // Without an override (legacy / Studio playback) it equals the full
    // team zone, so existing compositions render unchanged.
    let zone = teamZone;
    if (
      override &&
      override.posX !== undefined &&
      override.posY !== undefined &&
      override.size !== undefined
    ) {
      const sizeFrac = Math.max(0.05, Math.min(1, override.size / 100));
      const minDim = Math.min(teamZone.w, teamZone.h);
      const subSize = minDim * sizeFrac;
      // Centre point inside the team zone, then keep the sub-box fully
      // contained by clamping the centre by half the sub-size.
      const cxFrac = Math.max(0, Math.min(1, override.posX / 100));
      const cyFrac = Math.max(0, Math.min(1, override.posY / 100));
      const centreX = teamZone.x + cxFrac * teamZone.w;
      const centreY = teamZone.y + cyFrac * teamZone.h;
      const halfW = subSize / 2;
      const halfH = subSize / 2;
      const clampedCX = Math.max(
        teamZone.x + halfW,
        Math.min(teamZone.x + teamZone.w - halfW, centreX),
      );
      const clampedCY = Math.max(
        teamZone.y + halfH,
        Math.min(teamZone.y + teamZone.h - halfH, centreY),
      );
      zone = {
        x: clampedCX - halfW,
        y: clampedCY - halfH,
        w: subSize,
        h: subSize,
      };
    }
    // Overshoot only matters in legacy full-zone mode (so the pattern
    // hides behind the panel's side strips). With a sub-zone we want
    // the pattern fully inside its little box, so no overshoot.
    const overshoot = override?.size !== undefined ? 0 : zone.w * overshootRatio;
    const totalW = zone.w + overshoot * 2;
    const recipe = override
      ? { type: override.type, overrides: {} as Partial<CellGridSettings> }
      : pickRecipe(entry.goal.team, entry.teamIndex);
    const settings: CellGridSettings = override
      ? override.settings
      : { ...DEFAULT_SETTINGS, ...recipe.overrides };
    const palette = palettesFor(entry.goal.team, home, away);
    // Animate the warp parameters over time so the geometry feels
    // alive — "field under tension", not a stamped still. Local frame
    // = how long since this goal fired; lab/Studio default fps = 30.
    const localFrame = Math.max(0, frame - entry.t);
    const liveSettings = oscillateSettings(settings, localFrame, 30);
    // Build the full layered field — primary + optional blend + moiré
    // ghost + recursive echoes.
    const layers: FieldLayer[] = buildFieldLayers(
      recipe.type,
      liveSettings,
      totalW,
      zone.h,
      palette,
      {
        moireStrength: override?.moireStrength,
        blendTarget: override?.blendTarget,
        blendAmount: override?.blendAmount,
        recursionDepth: override?.recursionDepth,
      },
    );
    return { entry, zone, overshoot, totalW, layers, override };
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
          <clipPath id="brazil-panel-clip">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
            />
          </clipPath>
          {renderedGoals.map(({ entry, zone, override }) =>
            override ? (
              <clipPath
                key={`boundary-${entry.i}`}
                id={`brazil-boundary-${entry.i}`}
              >
                <path
                  d={boundaryPathForBox(
                    override.boundary,
                    zone.x,
                    zone.y,
                    zone.w,
                    zone.h,
                    entry.i * 11 + 7,
                  )}
                />
              </clipPath>
            ) : null,
          )}
          {renderedGoals.map(({ entry, zone, totalW }) => {
            const local = frame - entry.t;
            const reveal =
              local < 0 ? 0 : easeOutCubic(clamp(local / REVEAL_DUR));
            const focalX = zone.x + zone.w / 2;
            const focalY = zone.y + zone.h / 2;
            const maxR = Math.hypot(totalW / 2, zone.h / 2) * 1.05;
            return (
              <clipPath
                key={`reveal-${entry.i}`}
                id={`brazil-reveal-${entry.i}`}
              >
                <circle cx={focalX} cy={focalY} r={maxR * reveal} />
              </clipPath>
            );
          })}
        </defs>
        {/* Static pitch markings — midfield line + centre circle.
            Drawn inside the panel clip, before any goal layers, so the
            goal patterns paint on top when they reveal. */}
        <g clipPath="url(#brazil-panel-clip)" pointerEvents="none">
          <line
            x1={PANEL_BOUNDS.left}
            y1={midY}
            x2={PANEL_BOUNDS.right}
            y2={midY}
            stroke="rgba(10,10,10,0.18)"
            strokeWidth={2}
          />
          <circle
            cx={cx}
            cy={midY}
            r={PANEL_BOUNDS.width * 0.32}
            fill="none"
            stroke="rgba(10,10,10,0.18)"
            strokeWidth={2}
          />
        </g>
        <g clipPath="url(#brazil-panel-clip)">
          {renderedGoals.map(({ entry, zone, overshoot, layers, override }) => {
            if (frame < entry.t) return null;
            const cellsGroup = (
              <g clipPath={`url(#brazil-reveal-${entry.i})`}>
                <g transform={`translate(${zone.x - overshoot} ${zone.y})`}>
                  {layers.map((layer, li) => (
                    <g
                      key={`layer-${li}`}
                      opacity={layer.opacity}
                      transform={layer.transform}
                    >
                      {layer.cells.map((cell, ci) =>
                        cell.d ? (
                          <path key={ci} d={cell.d} fill={cell.color} />
                        ) : (
                          <rect
                            key={ci}
                            x={cell.x}
                            y={cell.y}
                            width={cell.w}
                            height={cell.h}
                            fill={cell.color}
                            transform={cell.transform || undefined}
                          />
                        ),
                      )}
                    </g>
                  ))}
                </g>
              </g>
            );
            return (
              <g
                key={`${entry.i}-${entry.t}`}
                clipPath={
                  override ? `url(#brazil-boundary-${entry.i})` : undefined
                }
              >
                {cellsGroup}
              </g>
            );
          })}
        </g>
        {/* Per-goal labels — minute centred on the goal's box, scorer
            name on the side that faces the OPPOSING team's half. */}
        {renderedGoals.map(({ entry, zone }) => {
          if (frame < entry.t) return null;
          const local = frame - entry.t;
          const LABEL_HOLD = 60;
          const LABEL_FADE = 20;
          const labelOpacity =
            local <= LABEL_HOLD
              ? 1
              : Math.max(0, 1 - (local - LABEL_HOLD) / LABEL_FADE);
          if (labelOpacity <= 0) return null;
          const isHome = entry.goal.team === "home";
          const scorers = isHome
            ? ["MBAPPÉ", "GRIEZMANN", "DEMBÉLÉ"]
            : ["VINICIUS JR.", "RODRYGO", "NEYMAR"];
          const scorerName =
            entry.goal.scorer ?? scorers[entry.teamIndex % scorers.length]!;
          const cxBox = zone.x + zone.w / 2;
          const cyBox = zone.y + zone.h / 2;
          // Home goals (top half) → scorer faces DOWN toward away.
          // Away goals (bottom half) → scorer faces UP toward home.
          const scorerOffsetY = isHome ? zone.h / 2 + 80 : -zone.h / 2 - 40;
          return (
            <g key={`label-${entry.i}`} opacity={labelOpacity}>
              <text
                x={cxBox}
                y={cyBox + 24}
                textAnchor="middle"
                fontFamily='"Google Sans Flex", "Roboto Flex", Inter, sans-serif'
                fontWeight={700}
                fontSize={64}
                fill="#0E0E0E"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {entry.goal.minute}&apos;
              </text>
              <text
                x={cxBox}
                y={cyBox + scorerOffsetY}
                textAnchor="middle"
                fontFamily='"Google Sans Flex", "Roboto Flex", Inter, sans-serif'
                fontWeight={700}
                fontSize={44}
                letterSpacing="2"
                fill="#0E0E0E"
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
      />
      <ScoreNumeral
        value={awayFired}
        color={away.flagSecondary}
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
