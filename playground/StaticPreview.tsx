import React, { useMemo } from "react";
import "./embeddedFonts"; // register Sharp Grotesk VF (embedded, no web-font fetch)
import {
  buildFieldLayers,
  type CellGridSettings,
  type CellGridType,
} from "../src/lib/cellGrid";
import {
  boundaryPathForBox,
  type LabBoundaryShape,
} from "../src/lib/boundaryShapes";
import { oscillateSettings } from "../src/lib/oscillate";
import { buildDefaultTimeline } from "../src/lib/possession";

// StaticPreview — renders the goal-card panel + every goal's animated
// warp field as a plain React SVG, *no* Remotion runtime. Useful for
// experimenting with the animation parameters and scrubbing frames
// without waiting for the Player to seek/render each time.
//
// Layout mirrors the production composition (1080×2340 canvas with a
// top/bottom strip), but the team-name typography, score numerals and
// match metadata are dropped — this is the goal-animation lab, not a
// match-card final preview.

const CANVAS_W = 1080;
const CANVAS_H = 1920; // 9:16
const FPS = 30;
// Panel inset matches src/components/BaseLayout TOP/BOTTOM/SIDE.
// Slightly tighter top/bottom insets for 9:16 so the panel still
// reads as the dominant surface.
const TOP_INSET = 170;
const BOTTOM_INSET = 170;
const SIDE_INSET = 96;
const BAR_H = 15; // 14 → 15 (~5% taller)
// Gap between the team-name text bottom (or top) and its tricolor
// bar. Same value used for both edges to enforce symmetric spacing.
const TEAM_NAME_GAP = 28;
const TEAM_NAME_SIZE = 96;
const PANEL = {
  left: SIDE_INSET,
  top: TOP_INSET + BAR_H,
  right: CANVAS_W - SIDE_INSET,
  bottom: CANVAS_H - BOTTOM_INSET - BAR_H,
};
const PANEL_W = PANEL.right - PANEL.left;
const PANEL_H = PANEL.bottom - PANEL.top;
const PANEL_BG = "#FFFFFF";
const CARD_BG = "#F4F4F4";

// Brand typography stack — primary names match what the user owns
// locally (Type Network / Google proprietary); the rest are free
// Google Fonts fallbacks chosen to match the visual weight.
const FONT_NUMERALS =
  '"Sharp Grotesk VF", "Sharp Grotesk", Inter, ui-sans-serif, sans-serif';
const FONT_TEAM_NAMES = 'Anton, "Anton Regular", ui-sans-serif, sans-serif';
const FONT_VERTICAL =
  '"Google Sans Flex", "Roboto Flex", Inter, ui-sans-serif, sans-serif';

export type MatchEventType =
  | "shot"
  | "foul"
  | "yellow_card"
  | "red_card"
  | "corner"
  | "free_kick"
  | "penalty";

export type MatchEvent = {
  id: string;
  team: "home" | "away";
  minute: number;
  type: MatchEventType;
};

export type StaticPreviewGoal = {
  id: string;
  team: "home" | "away";
  minute: number;
  scorer: string;
  recipe: {
    type: CellGridType;
    boundary: LabBoundaryShape;
    settings: CellGridSettings;
    posX: number;
    posY: number;
    size: number;
    // Field-layer controls — passed to buildFieldLayers.
    moireStrength?: number;
    blendTarget?: CellGridType;
    blendAmount?: number;
    recursionDepth?: number;
    // Opt-in continuous post-reveal drift on the boundary clip +
    // cells. Used to make formal-shape goals (triangle, etc.) keep
    // moving after their fade-in completes.
    drift?: boolean;
  };
};

export type StaticPreviewTeam = {
  name: string;
  flagPrimary: string;
  flagSecondary: string;
  flagAccent: string;
  // Relative usage of each colour in the team's actual flag, in
  // [primary, secondary, accent] order. Sums to 1. Lets the palette
  // builder expand the colour list proportionally so the most-used
  // flag colour shows up most often in the goal pattern.
  flagWeights?: [number, number, number];
  // EVERY distinct colour in the team's real flag (any count), used to
  // draw one equal colour-bar per flag colour. Falls back to
  // [primary, secondary, accent] when omitted.
  flagColors?: string[];
  // Two-letter language tag matching public/audio/goal-{lang}.mp3.
  // Consumers (gallery cards, single-match pages) read this to pick
  // the right commentator yell when a team scores.
  goalLang?: string;
};

export type StaticPreviewProps = {
  goals: StaticPreviewGoal[];
  selectedId: string | null;
  // Current frame to render at — 0..durationInFrames. Drives the warp
  // oscillation. The composition's match goes from frame 15..240 over
  // the 9s timeline; outside that the animation just keeps oscillating.
  frame: number;
  home: StaticPreviewTeam;
  away: StaticPreviewTeam;
  homePalette: string[];
  awayPalette: string[];
  // Importance score per goal (0..1) from the rules engine. Drives the
  // "%" labels on the midfield timeline.
  importanceById?: Map<string, number>;
  // Side caption text — runs vertically in the beige strips OUTSIDE
  // the pitch panel. Left = competition; right = venue + date.
  competition?: string;
  venueAndDate?: string;
  // Final home-possession share at full time. The readout climbs
  // linearly from 50/50 at kickoff to this value, and the midfield
  // line / circle / % readouts ride along with it. Default 0.66
  // (home dominates lightly).
  finalHomePossession?: number;
  // Match events to plot along the midfield timeline (shots, fouls,
  // cards, corners, free kicks, penalties). Each appears at its
  // minute's x position once the playhead has passed.
  events?: MatchEvent[];
  // Match-minute → frame, mirroring lib/timing.minuteToFrame. Inlined
  // here so this file has no Remotion-pulling imports.
  kickoffEnd?: number;
  matchEnd?: number;
  // When true (default), each goal's cells are clipped by a central
  // "label well" hole so score numerals can sit in the middle. Set
  // false to render full discs with no central cutout.
  showLabelWell?: boolean;
};

const minuteToFrame = (
  minute: number,
  kickoffEnd: number,
  matchEnd: number,
) => {
  const t = Math.max(0, Math.min(1, minute / 90));
  return kickoffEnd + t * (matchEnd - kickoffEnd);
};

// Post-reveal drift — returns the SVG `transform` string to apply
// to both the boundary clipPath path AND the cells group, so the
// goal's silhouette and its filling move as one. Drift is gated on
// `goal.recipe.drift` (set by the personality / per-goal override).
// Motion ramps in over ~30 frames after the reveal completes so the
// transition feels smooth rather than snapping.
const computeDriftTransform = (
  goal: StaticPreviewGoal,
  frame: number,
  kickoffEnd: number,
  matchEnd: number,
  cx: number,
  cy: number,
): string | undefined => {
  if (!goal.recipe.drift) return undefined;
  const trigger = minuteToFrame(goal.minute, kickoffEnd, matchEnd);
  const localFrame = frame - trigger;
  // Reveal window — keep stationary while cells are still erupting.
  const STAGGER_TOTAL = 70;
  const RAMP = 30;
  if (localFrame < STAGGER_TOTAL) return undefined;
  const tRamp = Math.min(1, (localFrame - STAGGER_TOTAL) / RAMP);
  const phase = localFrame;
  // Slow drift — ±18 px translate, ±9° rotation, all eased by tRamp
  // so motion fades in smoothly when the cells finish settling.
  const dx = Math.sin(phase * 0.045) * 18 * tRamp;
  const dy = Math.cos(phase * 0.058) * 14 * tRamp;
  const rot = Math.sin(phase * 0.032) * 9 * tRamp;
  return `rotate(${rot.toFixed(2)} ${cx.toFixed(1)} ${cy.toFixed(1)}) translate(${dx.toFixed(2)} ${dy.toFixed(2)})`;
};

export const StaticPreview: React.FC<StaticPreviewProps> = ({
  goals,
  selectedId,
  frame,
  home,
  away,
  homePalette,
  awayPalette,
  importanceById,
  competition = "WORLD CUP 2026",
  venueAndDate = "Estadio Azteca | 11.6.2026",
  finalHomePossession = 0.66,
  events = [],
  kickoffEnd = 15,
  matchEnd = 180,
  showLabelWell = true,
}) => {
  const midY = (PANEL.top + PANEL.bottom) / 2;
  const cxPanel = (PANEL.left + PANEL.right) / 2;
  const thirdW = (CANVAS_W - SIDE_INSET * 2) / 3;
  // Possession share — linear trend from 50/50 → finalHomePossession,
  // plus a continuous low-amplitude wobble so the readout never
  // freezes. The wobble is sub-percent so the macro trend is still
  // clearly readable, but the numbers update every frame.
  const homePossession = useMemo(() => {
    const t = Math.max(
      0,
      Math.min(1, (frame - kickoffEnd) / (matchEnd - kickoffEnd)),
    );
    const base = 0.5 + t * (finalHomePossession - 0.5);
    // Drift is multiplied by t so the readout starts at exactly
    // 50/50 at kickoff and only begins to wobble as play develops.
    const drift =
      (Math.sin(frame * 0.07) * 0.012 + Math.sin(frame * 0.19 + 0.6) * 0.008) *
      t;
    return Math.max(0.02, Math.min(0.98, base + drift));
  }, [frame, kickoffEnd, matchEnd, finalHomePossession]);
  const awayPossession = 1 - homePossession;
  // Dynamic midfield Y — smooth continuous motion only (no per-goal
  // bumps). The line drifts toward the dominant team's half and
  // floats with a slow long-wave wobble so it is always travelling.
  // POSS_AMPLITUDE drives long-term travel weight; WAVE_AMP drives
  // the always-on idle motion. Both are gated by `kickoffT` so the
  // midfield is dead-centre at kickoff and only starts drifting
  // once play begins.
  const POSS_AMPLITUDE = 580;
  const kickoffT = Math.max(
    0,
    Math.min(1, (frame - kickoffEnd) / (matchEnd - kickoffEnd)),
  );
  const possDrift = -(homePossession - 0.5) * 2 * POSS_AMPLITUDE;
  const wobble =
    (Math.sin(frame * 0.045) * 38 +
      Math.sin(frame * 0.082 + 1.3) * 18 +
      Math.sin(frame * 0.027 + 2.1) * 22) *
    kickoffT;
  const dynamicMidY = midY + possDrift + wobble;
  // Tally goals per team that have fired by the current frame +
  // remember the LATEST trigger frame so we can punch the numeral at
  // the exact instant the cell burst kicks off.
  let homeFired = 0;
  let awayFired = 0;
  let lastHomeBumpFrame = -Infinity;
  let lastAwayBumpFrame = -Infinity;
  for (const g of goals) {
    const trigger = minuteToFrame(g.minute, kickoffEnd, matchEnd);
    if (frame < trigger) continue;
    if (g.team === "home") {
      homeFired++;
      lastHomeBumpFrame = Math.max(lastHomeBumpFrame, trigger);
    } else {
      awayFired++;
      lastAwayBumpFrame = Math.max(lastAwayBumpFrame, trigger);
    }
  }
  // Compute a 0..1 "bump" amount per team — peaks ~6 frames after the
  // last goal trigger, settles by frame 16. Drives a scale punch on
  // the score numeral so it visibly reacts the moment the cells
  // start erupting.
  const BUMP_DUR = 16;
  const bumpAmount = (lastTrigger: number): number => {
    if (lastTrigger === -Infinity) return 0;
    const dt = frame - lastTrigger;
    if (dt < 0 || dt > BUMP_DUR) return 0;
    return Math.sin((dt / BUMP_DUR) * Math.PI);
  };
  const homeBump = bumpAmount(lastHomeBumpFrame);
  const awayBump = bumpAmount(lastAwayBumpFrame);
  const homeBumpScale = 1 + homeBump * 0.18;
  const awayBumpScale = 1 + awayBump * 0.18;
  // Score numeral colour — prefer the team's first non-pale colour so
  // the digit stays legible against the panel.
  const isLightHex = (hex: string) => {
    const h = hex.replace("#", "");
    if (h.length !== 6) return false;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return r * 0.2126 + g * 0.7152 + b * 0.0722 > 205;
  };
  const numeralColor = (t: StaticPreviewTeam) =>
    isLightHex(t.flagPrimary) ? t.flagAccent : t.flagPrimary;

  // Pre-compute each goal's sub-zone, animated settings, and cells.
  const renderedGoals = useMemo(() => {
    const items = goals.map((g) => {
      const teamZone = {
        x: PANEL.left,
        y: g.team === "home" ? PANEL.top : midY,
        w: PANEL_W,
        h: g.team === "home" ? midY - PANEL.top : PANEL.bottom - midY,
      };
      const sizeFrac = Math.max(0.05, Math.min(1, g.recipe.size / 100));
      const minDim = Math.min(teamZone.w, teamZone.h);
      const subSize = minDim * sizeFrac;
      const cxFrac = g.recipe.posX / 100;
      const cyFrac = g.recipe.posY / 100;
      const centreX = teamZone.x + cxFrac * teamZone.w;
      const centreY = teamZone.y + cyFrac * teamZone.h;
      const half = subSize / 2;
      // X is NOT clamped — chronological order on the timeline is
      // sacred. If a 89' goal's natural x sits near the panel rim,
      // its box just extends past the edge and the panel clipPath
      // crops the overflow. Y is still clamped so the box stays
      // inside its own team half.
      const clampedCY = Math.max(
        teamZone.y + half,
        Math.min(teamZone.y + teamZone.h - half, centreY),
      );
      const zone = {
        x: centreX - half,
        y: clampedCY - half,
        w: subSize,
        h: subSize,
      };
      const triggerFrame = minuteToFrame(g.minute, kickoffEnd, matchEnd);
      const localFrame = Math.max(0, frame - triggerFrame);
      const liveSettings = oscillateSettings(g.recipe.settings, localFrame, FPS);
      const palette = g.team === "home" ? homePalette : awayPalette;
      const layers = buildFieldLayers(
        g.recipe.type,
        liveSettings,
        zone.w,
        zone.h,
        palette,
        {
          moireStrength: g.recipe.moireStrength,
          blendTarget: g.recipe.blendTarget,
          blendAmount: g.recipe.blendAmount,
          recursionDepth: g.recipe.recursionDepth,
        },
      );
      // Distance-ordered per-cell stagger anchor. Cells closer to the
      // sub-zone's centre appear first; outer cells fly out later. The
      // renderer combines this with a scale-from-focal transform so
      // each cell visibly "drops into" its final position.
      const focalX = zone.w / 2;
      const focalY = zone.h / 2;
      let maxDist = 1;
      for (const layer of layers) {
        for (const cell of layer.cells) {
          const cx = cell.cx ?? focalX;
          const cy = cell.cy ?? focalY;
          const d = Math.hypot(cx - focalX, cy - focalY);
          if (d > maxDist) maxDist = d;
        }
      }
      return {
        goal: g,
        zone,
        layers,
        fired: frame >= triggerFrame,
        localFrame,
        focalX,
        focalY,
        maxDist,
      };
    });
    return items;
  }, [goals, frame, homePalette, awayPalette, kickoffEnd, matchEnd]);

  return (
    <svg
      data-match-card-svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      width="100%"
      height="100%"
      style={{ display: "block", background: CARD_BG }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Card backdrop — the beige outside the pitch panel. */}
      <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill={CARD_BG} />
      {/* Team name labels — explicit alphabetic-baseline placement so
          glyphs never bleed past the canvas. Cap-height for Anton at
          110 px ≈ 79 px; both names sit TEAM_NAME_GAP px from their
          tricolor bar (symmetric). */}
      {(() => {
        const cap = Math.round(TEAM_NAME_SIZE * 0.72);
        const topBaselineY = TOP_INSET - TEAM_NAME_GAP;
        const bottomBaselineY =
          CANVAS_H - BOTTOM_INSET + TEAM_NAME_GAP + cap;
        return (
          <>
            <text
              x={CANVAS_W / 2}
              y={topBaselineY}
              textAnchor="middle"
              fontFamily={FONT_TEAM_NAMES}
              fontWeight={400}
              fontSize={TEAM_NAME_SIZE}
              letterSpacing={2}
              fill={numeralColor(home)}
            >
              {home.name.toUpperCase()}
            </text>
            <text
              x={CANVAS_W / 2}
              y={bottomBaselineY}
              textAnchor="middle"
              fontFamily={FONT_TEAM_NAMES}
              fontWeight={400}
              fontSize={TEAM_NAME_SIZE}
              letterSpacing={2}
              fill={numeralColor(away)}
            >
              {away.name.toUpperCase()}
            </text>
          </>
        );
      })()}
      {/* Side captions — vertical text in the beige strips outside
          the pitch panel. Left reads bottom-to-top (rotate -90),
          right reads TOP-to-bottom (rotate +90) per the layout brief. */}
      <g
        transform={`translate(${SIDE_INSET / 2} ${CANVAS_H / 2}) rotate(-90)`}
      >
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily={FONT_VERTICAL}
          fontWeight={600}
          fontSize={28}
          letterSpacing={6}
          fill="#0E0E0E"
        >
          {competition.toUpperCase()}
        </text>
      </g>
      <g
        transform={`translate(${CANVAS_W - SIDE_INSET / 2} ${CANVAS_H / 2}) rotate(90)`}
      >
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily={FONT_VERTICAL}
          fontWeight={600}
          fontSize={28}
          letterSpacing={6}
          fill="#0E0E0E"
        >
          {venueAndDate.toUpperCase()}
        </text>
      </g>
      {/* Home tricolor bar (top) — primary | secondary | accent. */}
      <rect x={SIDE_INSET} y={TOP_INSET} width={thirdW} height={BAR_H} fill={home.flagPrimary} />
      <rect x={SIDE_INSET + thirdW} y={TOP_INSET} width={thirdW} height={BAR_H} fill={home.flagSecondary} />
      <rect x={SIDE_INSET + thirdW * 2} y={TOP_INSET} width={thirdW} height={BAR_H} fill={home.flagAccent} />
      {/* Away tricolor bar (bottom) — primary | secondary | accent. */}
      <rect x={SIDE_INSET} y={CANVAS_H - BOTTOM_INSET - BAR_H} width={thirdW} height={BAR_H} fill={away.flagPrimary} />
      <rect x={SIDE_INSET + thirdW} y={CANVAS_H - BOTTOM_INSET - BAR_H} width={thirdW} height={BAR_H} fill={away.flagSecondary} />
      <rect x={SIDE_INSET + thirdW * 2} y={CANVAS_H - BOTTOM_INSET - BAR_H} width={thirdW} height={BAR_H} fill={away.flagAccent} />
      <defs>
        <clipPath id="static-panel-clip">
          <rect
            x={PANEL.left}
            y={PANEL.top}
            width={PANEL_W}
            height={PANEL_H}
          />
        </clipPath>
        {renderedGoals.map(({ goal, zone }) => {
          // Central "hole" clipPath = boundary rect with an inscribed
          // circular cut-out (even-odd). Cells rendered inside it are
          // visible everywhere EXCEPT a disc in the middle where the
          // goal labels live.
          const holeR = Math.min(zone.w, zone.h) * 0.22;
          const hcx = zone.x + zone.w / 2;
          const hcy = zone.y + zone.h / 2;
          const holePath = `M ${zone.x},${zone.y} h ${zone.w} v ${zone.h} h ${-zone.w} Z M ${hcx - holeR},${hcy} a ${holeR},${holeR} 0 1,0 ${holeR * 2},0 a ${holeR},${holeR} 0 1,0 ${-holeR * 2},0 Z`;
          // Post-reveal drift — continuous translate + rotate around
          // the box centroid for goals whose recipe opted into it.
          // Same transform string is reused on the cells group below
          // so the clip and the cells stay locked together.
          const cxBox = zone.x + zone.w / 2;
          const cyBox = zone.y + zone.h / 2;
          const driftTransform = computeDriftTransform(
            goal,
            frame,
            kickoffEnd,
            matchEnd,
            cxBox,
            cyBox,
          );
          return (
            <React.Fragment key={`clips-${goal.id}`}>
              <clipPath id={`static-boundary-${goal.id}`}>
                <path
                  d={boundaryPathForBox(
                    goal.recipe.boundary,
                    zone.x,
                    zone.y,
                    zone.w,
                    zone.h,
                  )}
                  transform={driftTransform}
                />
              </clipPath>
              <clipPath
                id={`static-hole-${goal.id}`}
                clipPathUnits="userSpaceOnUse"
              >
                <path d={holePath} fillRule="evenodd" transform={driftTransform} />
              </clipPath>
            </React.Fragment>
          );
        })}
      </defs>
      {/* Panel background + a thin outline so the pitch area is
          clearly demarcated from the beige card chrome. */}
      <rect
        x={PANEL.left}
        y={PANEL.top}
        width={PANEL_W}
        height={PANEL_H}
        fill={PANEL_BG}
      />
      <rect
        x={PANEL.left}
        y={PANEL.top}
        width={PANEL_W}
        height={PANEL_H}
        fill="none"
        stroke="rgba(10,10,10,0.08)"
        strokeWidth={1}
      />
      {/* Faint dashed outline of every fired goal's sub-zone so the
          editable patches are visible at a glance. Drawn beneath the
          goal patterns. */}
      {renderedGoals
        .filter((rg) => rg.fired)
        .map(({ goal, zone }) => (
          <rect
            key={`zone-${goal.id}`}
            x={zone.x}
            y={zone.y}
            width={zone.w}
            height={zone.h}
            fill="none"
            stroke="rgba(10,10,10,0.10)"
            strokeWidth={1}
            strokeDasharray="6 6"
          />
        ))}
      {/* Pitch markings — line + centre circle anchored to the
          dynamic midfield so they drift with possession share, plus
          a thin goal "net" for each team along the panel's top and
          bottom edges (same stroke style as the midfield). */}
      <g clipPath="url(#static-panel-clip)" pointerEvents="none">
        <line
          x1={PANEL.left}
          y1={dynamicMidY}
          x2={PANEL.right}
          y2={dynamicMidY}
          stroke="rgba(10,10,10,0.18)"
          strokeWidth={2}
        />
        <circle
          cx={(PANEL.left + PANEL.right) / 2}
          cy={dynamicMidY}
          r={PANEL_W * 0.2312}
          fill="none"
          stroke="rgba(10,10,10,0.18)"
          strokeWidth={2}
        />
        {/* Goal-minute markers along the running x timeline. Each tick
            appears the frame its goal fires, holds through full-time,
            then fades over 24 frames once the match clock ends. */}
        {goals.map((g) => {
          const trigger = minuteToFrame(g.minute, kickoffEnd, matchEnd);
          if (frame < trigger) return null;
          // Fade window: full opacity through matchEnd, linear fade to
          // 0 over the next 24 frames.
          const fadeDur = 24;
          const fadeT = Math.max(
            0,
            Math.min(1, (frame - matchEnd) / fadeDur),
          );
          const opacity = 1 - fadeT;
          if (opacity <= 0) return null;
          const x = PANEL.left + (g.minute / 90) * PANEL_W;
          const teamCol = numeralColor(g.team === "home" ? home : away);
          return (
            <g key={`tl-${g.id}`} opacity={opacity}>
              <line
                x1={x}
                y1={dynamicMidY - 14}
                x2={x}
                y2={dynamicMidY + 14}
                stroke={teamCol}
                strokeWidth={3}
              />
              <text
                x={x}
                y={dynamicMidY - 22}
                textAnchor="middle"
                fontFamily={FONT_VERTICAL}
                fontWeight={800}
                fontSize={22}
                fill={teamCol}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {g.minute}'
              </text>
            </g>
          );
        })}
      </g>
      {/* No pitch-panel clip here — goal animations are allowed to
          extend past the panel rim when their boundary box sits near
          an edge. Each goal still respects its own boundary clip. */}
      <g>
        {renderedGoals.map(
          ({
            goal,
            zone,
            layers,
            fired,
            localFrame,
            focalX,
            focalY,
            maxDist,
          }) => {
            if (!fired) return null;
            // Per-cell stagger constants. STAGGER_TOTAL frames is how
            // long the whole reveal takes; PER_CELL frames is how long
            // each individual cell takes to fade & scale into place.
            // Slow + ravey: ~2.3 s whole-reveal, ~0.8 s per cell.
            const STAGGER_TOTAL = 70;
            const PER_CELL = 24;
            const SPAN = Math.max(1, STAGGER_TOTAL - PER_CELL);
            const cxBox = zone.x + zone.w / 2;
            const cyBox = zone.y + zone.h / 2;
            const driftTransform = computeDriftTransform(
              goal,
              frame,
              kickoffEnd,
              matchEnd,
              cxBox,
              cyBox,
            );
            return (
              <g
                key={`goal-${goal.id}`}
                clipPath={`url(#static-boundary-${goal.id})`}
              >
                {/* hole clipPath uses absolute panel coords — apply
                    BEFORE the translate so its math matches the
                    children's drawn position. Optional via showLabelWell. */}
                <g clipPath={showLabelWell ? `url(#static-hole-${goal.id})` : undefined}>
                <g transform={driftTransform}>
                <g transform={`translate(${zone.x} ${zone.y})`}>
                  {layers.map((layer, li) => (
                    <g
                      key={`layer-${li}`}
                      transform={layer.transform}
                    >
                      {layer.cells.map((cell, ci) => {
                        // Each cell uses ITS OWN centroid as the
                        // scale anchor, but ALSO erupts outward FROM
                        // the field's focal centre. Combined effect:
                        // cells fly outward from the goal's heart
                        // while individually punching past their final
                        // size before settling.
                        const cx = cell.cx ?? focalX;
                        const cy = cell.cy ?? focalY;
                        // Default: distance-from-focal ratio drives
                        // delay. If a builder supplied revealOrder
                        // (0..1), use that instead so the field can
                        // sweep left-to-right, top-to-bottom, etc.
                        const ratio = cell.revealOrder !== undefined
                          ? Math.max(0, Math.min(1, cell.revealOrder))
                          : Math.hypot(cx - focalX, cy - focalY) / maxDist;
                        const delay = ratio * SPAN;
                        const t = Math.max(
                          0,
                          Math.min(1, (localFrame - delay) / PER_CELL),
                        );
                        if (t <= 0) return null;
                        // Back-out easing with HEAVY overshoot —
                        // cells punch past 1.3× before settling.
                        const s = 3.4;
                        const t2 = t - 1;
                        const scale = t2 * t2 * ((s + 1) * t2 + s) + 1;
                        // Eruption: each cell starts at the focal
                        // centre and travels to its true position as
                        // t goes 0 → 1. Same back-out easing so the
                        // travel overshoots slightly past its target.
                        const travel = t2 * t2 * ((s + 1) * t2 + s) + 1;
                        const dx = cx - focalX;
                        const dy = cy - focalY;
                        const offsetX = (1 - travel) * dx;
                        const offsetY = (1 - travel) * dy;
                        // Spin: small per-cell rotation that resolves
                        // to 0 — gives the eruption a tumbling feel
                        // without obscuring the final pose.
                        const spin = (1 - t) * 35 *
                          ((ci % 2 === 0 ? 1 : -1));
                        const transform = `translate(${(-offsetX).toFixed(2)} ${(-offsetY).toFixed(2)}) translate(${cx} ${cy}) rotate(${spin.toFixed(2)}) scale(${scale.toFixed(3)}) translate(${(-cx).toFixed(3)} ${(-cy).toFixed(3)})`;
                        return cell.d ? (
                          <path
                            key={ci}
                            d={cell.d}
                            fill={cell.color}
                            transform={transform}
                          />
                        ) : (
                          <rect
                            key={ci}
                            x={cell.x}
                            y={cell.y}
                            width={cell.w}
                            height={cell.h}
                            fill={cell.color}
                            transform={`${transform} ${cell.transform ?? ""}`}
                          />
                        );
                      })}
                    </g>
                  ))}
                </g>
                </g>
                </g>
              </g>
            );
          },
        )}
      </g>
      {/* Score numerals — drawn last so they sit above the goal layers.
          Each is wrapped in a <g> with a scale transform anchored on
          its visual centre so the bump animation (triggered the
          instant a goal fires) doesn't move the digit horizontally.
          Sharp Grotesk VF variable-font axes: width 8.4, weight 666;
          fontWeight=900 is the fallback for Inter. */}
      {(() => {
        // Home numeral nudged DOWN, away numeral nudged UP so the two
        // digits sit a little closer to the midfield.
        const homeBaseY = (PANEL.top + midY) / 2 + 300;
        const awayBaseY = (midY + PANEL.bottom) / 2 + 180;
        // Pivot near the visual centre of each digit (~260 px above
        // baseline for a 720 px Sharp Grotesk cap).
        const homePivotY = homeBaseY - 260;
        const awayPivotY = awayBaseY - 260;
        return (
          <>
            <g
              transform={`translate(${cxPanel} ${homePivotY}) scale(${homeBumpScale.toFixed(3)}) translate(${(-cxPanel).toFixed(3)} ${(-homePivotY).toFixed(3)})`}
            >
              <text
                x={cxPanel}
                y={homeBaseY}
                textAnchor="middle"
                fontFamily={FONT_NUMERALS}
                fontWeight={900}
                fontSize={720}
                fill={numeralColor(home)}
                style={{
                  fontVariantNumeric: "tabular-nums",
                  fontVariationSettings: '"wdth" 8.4, "wght" 666',
                }}
              >
                {homeFired}
              </text>
            </g>
            <g
              transform={`translate(${cxPanel} ${awayPivotY}) scale(${awayBumpScale.toFixed(3)}) translate(${(-cxPanel).toFixed(3)} ${(-awayPivotY).toFixed(3)})`}
            >
              <text
                x={cxPanel}
                y={awayBaseY}
                textAnchor="middle"
                fontFamily={FONT_NUMERALS}
                fontWeight={900}
                fontSize={720}
                fill={numeralColor(away)}
                style={{
                  fontVariantNumeric: "tabular-nums",
                  fontVariationSettings: '"wdth" 8.4, "wght" 666',
                }}
              >
                {awayFired}
              </text>
            </g>
          </>
        );
      })()}

      {/* Match-event markers — small circles for everything except
          yellow / red cards, which are yellow / red squares. Events
          spread across the WHOLE team-half (not glued to the
          midline) using a deterministic hash off the event id, so
          shots, fouls, corners, etc. scatter across the pitch
          vertically while x stays anchored to match-minute. */}
      <g>
        {(() => {
          // Deterministic 0..1 from a string — used to spread events
          // along the y axis without any randomness between frames.
          const hash01 = (s: string) => {
            let h = 2166136261;
            for (let i = 0; i < s.length; i++) {
              h ^= s.charCodeAt(i);
              h = Math.imul(h, 16777619);
            }
            return ((h >>> 0) % 10000) / 10000;
          };
          return events
            .filter((e) => {
              const trigger =
                kickoffEnd +
                Math.max(0, Math.min(1, e.minute / 90)) *
                  (matchEnd - kickoffEnd);
              return frame >= trigger;
            })
            .map((e) => {
              const x = PANEL.left + (e.minute / 90) * PANEL_W;
              const isHomeEv = e.team === "home";
              const teamCol = numeralColor(isHomeEv ? home : away);
              // y-spread: events scatter across their team-half but
              // anchor to the STATIC midline (midY / PANEL edges) so
              // once placed they don't drift as the dynamic midfield
              // moves. Hash off id so the same event always lands in
              // the same spot.
              const h = hash01(e.id);
              const minOff = (isHomeEv ? PANEL.top : midY) + 36;
              const maxOff = (isHomeEv ? midY : PANEL.bottom) - 36;
              const y = minOff + h * (maxOff - minOff);
              // Cards hug the midline — bookings cluster against the
              // half-way line instead of scattering across the full
              // team half.
              const cardT = isHomeEv ? 0.7 + h * 0.3 : h * 0.3;
              const cardY = minOff + cardT * (maxOff - minOff);
              if (e.type === "yellow_card") {
                return (
                  <rect
                    key={e.id}
                    x={x - 10}
                    y={cardY - 10}
                    width={20}
                    height={20}
                    fill="#FFD400"
                    rx={2}
                  />
                );
              }
              if (e.type === "red_card") {
                return (
                  <rect
                    key={e.id}
                    x={x - 10}
                    y={cardY - 10}
                    width={20}
                    height={20}
                    fill="#E32636"
                    rx={2}
                  />
                );
              }
              // Everything else (shot, foul, corner, free_kick,
              // penalty) → team-colored circle sized to match the
              // 20×20 card squares. Penalty gets a touch bigger so
              // it still reads as the heavier event.
              const r = e.type === "penalty" ? 13 : 10;
              return <circle key={e.id} cx={x} cy={y} r={r} fill={teamCol} />;
            });
        })()}
      </g>

      {/* Midfield timeline overlay — only the playhead dot + the
          running possession %s. Per-goal dots have been removed to
          keep the line uncluttered; goal minutes still appear inside
          each goal's box. */}
      <g>
        {/* Running possession % + playhead — anchored to the
            playhead's current x position so the numbers TRAVEL along
            the timeline rather than sitting at a fixed right-edge
            spot. textAnchor flips to "end" once the playhead crosses
            past 70% of the panel so the numbers don't overflow. */}
        {(() => {
          // Playhead — slides on the x axis with match-time progress
          // but rides on the dynamic midfield (so it bobs up/down as
          // possession shifts).
          const currentMinute = Math.max(
            0,
            Math.min(90, ((frame - kickoffEnd) / (matchEnd - kickoffEnd)) * 90),
          );
          const px = PANEL.left + (currentMinute / 90) * PANEL_W;
          // Running %s — FIXED x position on the right side of the
          // panel. They bob up/down with the dynamic midfield so the
          // motion is on the y axis only (home % above, away below).
          const POSS_FONT = 34;
          const POSS_OFFSET = POSS_FONT / 2 + 6;
          const POSS_X = PANEL.right - 18;
          return (
            <>
              <text
                x={POSS_X}
                y={dynamicMidY - POSS_OFFSET}
                textAnchor="end"
                dominantBaseline="middle"
                fontFamily={FONT_VERTICAL}
                fontWeight={700}
                fontSize={POSS_FONT}
                fill={numeralColor(home)}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {Math.round(homePossession * 100)}%
              </text>
              <text
                x={POSS_X}
                y={dynamicMidY + POSS_OFFSET}
                textAnchor="end"
                dominantBaseline="middle"
                fontFamily={FONT_VERTICAL}
                fontWeight={700}
                fontSize={POSS_FONT}
                fill={numeralColor(away)}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {Math.round(awayPossession * 100)}%
              </text>
              <circle
                cx={px}
                cy={dynamicMidY}
                r={9}
                fill="none"
                stroke="#0E0E0E"
                strokeWidth={2}
                opacity={0.75}
              />
            </>
          );
        })()}
      </g>

      {/* Per-goal labels — minute and scorer name both centred on the
          goal box's vertical axis (cxBox). The scorer name is rotated
          90° so it reads as a vertical column; centring is done via
          textAnchor="middle" with the rotation pivot offset by half
          the estimated text width so the whole label looks balanced
          around its centre. Both labels paint black. */}
      {renderedGoals.map(({ goal, zone, fired, localFrame }) => {
        if (!fired) return null;
        const LABEL_START = 12;
        const LABEL_FADE = 10;
        const labelT = Math.max(
          0,
          Math.min(1, (localFrame - LABEL_START) / LABEL_FADE),
        );
        if (labelT <= 0) return null;
        const labelEased = 1 - Math.pow(1 - labelT, 3);
        const isHome = goal.team === "home";
        // Pick the most-readable team colour for the labels (avoid
        // the score-numeral colour and pale colours).
        const ownTeam = isHome ? home : away;
        const num = numeralColor(ownTeam);
        const labelColor = (() => {
          const candidates = [
            ownTeam.flagSecondary,
            ownTeam.flagAccent,
            ownTeam.flagPrimary,
          ];
          for (const c of candidates) {
            if (c.toLowerCase() === num.toLowerCase()) continue;
            if (isLightHex(c)) continue;
            return c;
          }
          return "#000000";
        })();
        // Hole-centre coords.
        const cxBox = zone.x + zone.w / 2;
        const cyBox = zone.y + zone.h / 2;
        const minuteText = `'${goal.minute}`;
        const scorerText = goal.scorer.toUpperCase();
        // Tight stack inside the hole — minute sits a few px off
        // centre on the scorer's own-team side, scorer name rotates
        // 90° on the opposing side. The scorer's NEAR edge is
        // GAP px past the minute's far edge, so labels never touch.
        const MINUTE_FONT_HALF = 17; // cap-half for 34 px minute
        const SCORER_FONT = 22;
        const SCORER_CHAR_W = SCORER_FONT * 0.62;
        const scorerHalfLen =
          (goal.scorer.length * SCORER_CHAR_W) / 2;
        const LABEL_GAP = 10;
        // Minute hugs the hole centre — just MINUTE_FONT_HALF away
        // so the digit's far edge is exactly at 0.
        const minuteOffset = isHome ? -MINUTE_FONT_HALF : MINUTE_FONT_HALF;
        // Scorer's near edge starts LABEL_GAP past the minute's far
        // edge (which is at 0). Its centre is therefore halfLen +
        // GAP from the centre line, signed by team.
        const scorerOffset = isHome
          ? LABEL_GAP + scorerHalfLen
          : -(LABEL_GAP + scorerHalfLen);
        const scorerRotation = isHome ? 90 : -90;
        return (
          <g key={`label-${goal.id}`} opacity={labelEased}>
            <text
              x={cxBox}
              y={cyBox + minuteOffset}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily={FONT_VERTICAL}
              fontWeight={700}
              fontSize={34}
              letterSpacing={1}
              fill={labelColor}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {minuteText}
            </text>
            <g
              transform={`translate(${cxBox} ${cyBox + scorerOffset}) rotate(${scorerRotation})`}
            >
              <text
                x={0}
                y={0}
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily={FONT_VERTICAL}
                fontWeight={700}
                fontSize={22}
                letterSpacing={2}
                fill={labelColor}
              >
                {scorerText}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
};
