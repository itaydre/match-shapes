// @refresh reset
import React, { useMemo } from "react";
import type {
  StaticPreviewGoal,
  StaticPreviewTeam,
  MatchEvent,
} from "./matchTypes";
import {
  ShapeRenderer,
  SHAPE_FAMILIES,
  SHAPE_BUILDERS,
  applyShapeVariation,
  type ShapeFamily,
  type RevealOverrides,
} from "./showcaseShapes";

// Per-goal animation styles — a curated pool of GSAP configs so
// each goal in a fixture gets a visibly distinct reveal feel
// (different ease / mode / pacing) on top of its already-distinct
// shape family. Goal id hashes into this list, so the same goal
// always animates the same way across reloads but the 4–6 goals
// inside a single fixture each pull a different entry.
const ANIM_STYLES: RevealOverrides[] = [
  // 0 — classic bouncy burst
  { ease: "back.out(3.4)", forceMode: "burst", staggerSec: 2.3, cellDurationSec: 0.8, staggerFrom: "center" },
  // 1 — fast clean grow
  { ease: "power3.out", forceMode: "grow", staggerSec: 1.4, cellDurationSec: 0.5, staggerFrom: "center" },
  // 2 — slow elastic
  { ease: "elastic.out(1, 0.5)", forceMode: "burst", staggerSec: 2.8, cellDurationSec: 1.0, staggerFrom: "center" },
  // 3 — snappy fade
  { ease: "expo.out", forceMode: "fade", staggerSec: 1.2, cellDurationSec: 0.4, staggerFrom: "center" },
  // 4 — comedic bounce
  { ease: "bounce.out", forceMode: "burst", staggerSec: 2.5, cellDurationSec: 0.9, staggerFrom: "center" },
  // 5 — anticipate then snap
  { ease: "back.in(2)", forceMode: "grow", staggerSec: 1.8, cellDurationSec: 0.7, staggerFrom: "center" },
  // 6 — soft fade explosion (every goal blows OUT from centre, even
  // the fade variant — no edges-in or random scatter slots left in
  // the pool so the whole gallery feels like centred eruptions).
  { ease: "power2.out", forceMode: "fade", staggerSec: 2.0, cellDurationSec: 0.6, staggerFrom: "center" },
  // 7 — confident outward back-out
  { ease: "back.out(1.7)", forceMode: "burst", staggerSec: 2.2, cellDurationSec: 0.7, staggerFrom: "center" },
];

// StaticPreviewV3 — focused-match chrome (same as StaticPreviewV2)
// but each goal renders as one of the 13 showcase shape families,
// staggered cell-by-cell from its focal (same animation as
// shape-showcase.html). The chrome is duplicated rather than shared
// with V2 to keep the surfaces independently editable.

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const TOP_INSET = 170;
const BOTTOM_INSET = 170;
const SIDE_INSET = 96;
const BAR_H = 15;
// Team-name labels (top/bottom). GAP is the vertical distance from
// the title's baseline to the adjacent flag-bar edge — 46 px puts a
// matching breathing-room band between the title and the team-colour
// bars on both ends of the card.
const TEAM_NAME_GAP = 46;
const TEAM_NAME_SIZE = 92;
const PANEL = {
  left: SIDE_INSET,
  top: TOP_INSET + BAR_H,
  right: CANVAS_W - SIDE_INSET,
  bottom: CANVAS_H - BOTTOM_INSET - BAR_H,
};
const PANEL_W = PANEL.right - PANEL.left;
const PANEL_H = PANEL.bottom - PANEL.top;
const CARD_BG = "#F4F4F4";
const PANEL_BG = "#FFFFFF";

const FONT_NUMERALS =
  '"Sharp Grotesk VF", "Sharp Grotesk", Inter, ui-sans-serif, sans-serif';
const FONT_TEAM_NAMES = 'Anton, "Anton Regular", ui-sans-serif, sans-serif';
const FONT_VERTICAL =
  '"Google Sans Flex", "Roboto Flex", Inter, ui-sans-serif, sans-serif';

export type StaticPreviewV3Props = {
  goals: StaticPreviewGoal[];
  frame: number;
  home: StaticPreviewTeam;
  away: StaticPreviewTeam;
  competition?: string;
  venueAndDate?: string;
  finalHomePossession?: number;
  events?: MatchEvent[];
  kickoffEnd?: number;
  matchEnd?: number;
  showLabelWell?: boolean;
  // Optional per-goal family override; default cycles through
  // SHAPE_FAMILIES so each fixture shows a tour of the language.
  familyForGoal?: (goal: StaticPreviewGoal, rank: number) => ShapeFamily;
  // Per-goal emotional-importance score (0..1) from the rules engine.
  // Drives visual amplification: bigger shapes, harder score bumps.
  // Goals not in the map (or no map supplied) default to 0.5.
  importanceById?: Map<string, number>;
};

const minuteToFrame = (
  minute: number,
  kickoffEnd: number,
  matchEnd: number,
) => {
  const t = Math.max(0, Math.min(1, minute / 90));
  return kickoffEnd + t * (matchEnd - kickoffEnd);
};

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

const stringSeed = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) & 0x7fffffff;
  }
  return h;
};

// Build a 4-colour palette per goal: the scoring team's primary +
// secondary + accent + white. Order picks a dominant ink first so
// single-colour shapes (warp_grid, thin_spokes, etc.) get a strong
// team-readable mass.
const paletteForGoal = (
  team: StaticPreviewTeam,
): string[] => {
  const ink = numeralColor(team);
  const cols: string[] = [ink];
  for (const c of [team.flagPrimary, team.flagSecondary, team.flagAccent]) {
    if (cols.indexOf(c) === -1) cols.push(c);
  }
  if (cols.indexOf("#FFFFFF") === -1) cols.push("#FFFFFF");
  if (cols.indexOf("#000000") === -1) cols.push("#000000");
  return cols;
};

export const StaticPreviewV3: React.FC<StaticPreviewV3Props> = ({
  goals,
  frame,
  home,
  away,
  competition = "WORLD CUP 2026",
  venueAndDate = "Estadio Azteca | 11.6.2026",
  finalHomePossession = 0.66,
  events = [],
  kickoffEnd = 15,
  matchEnd = 180,
  showLabelWell = false,
  familyForGoal,
  importanceById,
}) => {
  // Emotional importance per goal — used to scale shape size and
  // score bumps. Default 0.5 if the caller doesn't supply scores.
  const importanceOf = (goalId: string): number =>
    importanceById?.get(goalId) ?? 0.5;
  const midY = (PANEL.top + PANEL.bottom) / 2;
  const cxPanel = (PANEL.left + PANEL.right) / 2;
  const thirdW = (CANVAS_W - SIDE_INSET * 2) / 3;

  const homePossession = useMemo(() => {
    const t = Math.max(
      0,
      Math.min(1, (frame - kickoffEnd) / (matchEnd - kickoffEnd)),
    );
    const base = 0.5 + t * (finalHomePossession - 0.5);
    // Drift multiplied by t so the readout starts at exactly 50/50
    // at kickoff and only begins to wobble as play develops.
    const drift =
      (Math.sin(frame * 0.07) * 0.012 + Math.sin(frame * 0.19 + 0.6) * 0.008) *
      t;
    return Math.max(0.02, Math.min(0.98, base + drift));
  }, [frame, kickoffEnd, matchEnd, finalHomePossession]);
  const awayPossession = 1 - homePossession;

  const POSS_AMPLITUDE = 580;
  const kickoffT = Math.max(
    0,
    Math.min(1, (frame - kickoffEnd) / (matchEnd - kickoffEnd)),
  );
  const possDrift = -(homePossession - 0.5) * 2 * POSS_AMPLITUDE;
  // Wobble gated by kickoffT so the midfield is dead-centre at
  // kickoff and only starts drifting once play begins.
  const wobble =
    (Math.sin(frame * 0.045) * 38 +
      Math.sin(frame * 0.082 + 1.3) * 18 +
      Math.sin(frame * 0.027 + 2.1) * 22) *
    kickoffT;
  const dynamicMidY = midY + possDrift + wobble;

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
  const BUMP_DUR = 16;
  const bumpAmount = (lastTrigger: number): number => {
    if (lastTrigger === -Infinity) return 0;
    const dt = frame - lastTrigger;
    if (dt < 0 || dt > BUMP_DUR) return 0;
    return Math.sin((dt / BUMP_DUR) * Math.PI);
  };
  // Bump magnitude is also driven by the most-recent goal's
  // importance — a routine extension barely nudges the digit; a
  // final-minute knockout equaliser punches it hard.
  const lastHomeImportance = (() => {
    let best = 0.5;
    let bestF = -Infinity;
    for (const g of goals) {
      if (g.team !== "home") continue;
      const trig = minuteToFrame(g.minute, kickoffEnd, matchEnd);
      if (trig <= frame && trig >= bestF) {
        bestF = trig;
        best = importanceOf(g.id);
      }
    }
    return best;
  })();
  const lastAwayImportance = (() => {
    let best = 0.5;
    let bestF = -Infinity;
    for (const g of goals) {
      if (g.team !== "away") continue;
      const trig = minuteToFrame(g.minute, kickoffEnd, matchEnd);
      if (trig <= frame && trig >= bestF) {
        bestF = trig;
        best = importanceOf(g.id);
      }
    }
    return best;
  })();
  const homeBumpScale =
    1 + bumpAmount(lastHomeBumpFrame) * (0.10 + lastHomeImportance * 0.22);
  const awayBumpScale =
    1 + bumpAmount(lastAwayBumpFrame) * (0.10 + lastAwayImportance * 0.22);

  const sortedGoals = useMemo(
    () => [...goals].sort((a, b) => a.minute - b.minute),
    [goals],
  );

  // Per-goal pre-compute: zone, family, cells (memoised so the
  // builder doesn't re-run every frame), localFrame.
  const renderedGoals = useMemo(() => {
    return sortedGoals.map((g, idx) => {
      const teamZone = {
        x: PANEL.left,
        y: g.team === "home" ? PANEL.top : midY,
        w: PANEL_W,
        h: g.team === "home" ? midY - PANEL.top : PANEL.bottom - midY,
      };
      // Size = base × importance multiplier. Substantially bumped so
      // shapes carry real visual weight against the giant 720-px
      // score numerals on gallery cards. Min clamp 0.42 = even the
      // most boring extension goal claims ~42% of its team-half.
      const SOLID_SHAPE_SCALE = 0.95;
      const baseFrac =
        Math.max(0.05, Math.min(1, g.recipe.size / 100)) * SOLID_SHAPE_SCALE;
      const k = importanceOf(g.id);
      const importanceMul = 0.75 + k * 0.55;
      const sizeFrac = Math.max(0.42, Math.min(1.05, baseFrac * importanceMul));
      const minDim = Math.min(teamZone.w, teamZone.h);
      const subSize = minDim * sizeFrac;
      const cxFrac = g.recipe.posX / 100;
      const cyFrac = g.recipe.posY / 100;
      const centreX = teamZone.x + cxFrac * teamZone.w;
      const centreY = teamZone.y + cyFrac * teamZone.h;
      const half = subSize / 2;
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
      const family: ShapeFamily = familyForGoal
        ? familyForGoal(g, idx)
        : SHAPE_FAMILIES[idx % SHAPE_FAMILIES.length]!;
      const palette = paletteForGoal(g.team === "home" ? home : away);
      const seed = stringSeed(`${g.id}:${idx}:${family}`);
      let cells: ReturnType<typeof SHAPE_BUILDERS[ShapeFamily]>["cells"] = [];
      let focal = { x: 0, y: 0 };
      let spinDegPerSec = 0;
      try {
        const built = SHAPE_BUILDERS[family](seed, subSize, palette);
        // Per-goal variation — varies particle density + spin so the
        // same family looks different every match / goal. Seeded off
        // the goal id so it's stable across reloads.
        const variation = applyShapeVariation(
          built,
          stringSeed(`${g.id}:var`),
        );
        cells = variation.cells;
        focal = built.focal;
        spinDegPerSec = variation.spinDegPerSec;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`[StaticPreviewV3] ${family} threw:`, e);
      }
      return { goal: g, zone, family, cells, focal, spinDegPerSec };
    });
  }, [sortedGoals, home, away, midY, familyForGoal]);

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
      <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill={CARD_BG} />

      {/* Team names */}
      {(() => {
        const cap = Math.round(TEAM_NAME_SIZE * 0.72);
        const topBaselineY = TOP_INSET - TEAM_NAME_GAP;
        const bottomBaselineY = CANVAS_H - BOTTOM_INSET + TEAM_NAME_GAP + cap;
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

      {/* Side captions */}
      <g transform={`translate(${SIDE_INSET / 2} ${CANVAS_H / 2}) rotate(-90)`}>
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
      <g transform={`translate(${CANVAS_W - SIDE_INSET / 2} ${CANVAS_H / 2}) rotate(90)`}>
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

      {/* Tricolor bars */}
      <rect x={SIDE_INSET} y={TOP_INSET} width={thirdW} height={BAR_H} fill={home.flagPrimary} />
      <rect x={SIDE_INSET + thirdW} y={TOP_INSET} width={thirdW} height={BAR_H} fill={home.flagSecondary} />
      <rect x={SIDE_INSET + thirdW * 2} y={TOP_INSET} width={thirdW} height={BAR_H} fill={home.flagAccent} />
      <rect x={SIDE_INSET} y={CANVAS_H - BOTTOM_INSET - BAR_H} width={thirdW} height={BAR_H} fill={away.flagPrimary} />
      <rect x={SIDE_INSET + thirdW} y={CANVAS_H - BOTTOM_INSET - BAR_H} width={thirdW} height={BAR_H} fill={away.flagSecondary} />
      <rect x={SIDE_INSET + thirdW * 2} y={CANVAS_H - BOTTOM_INSET - BAR_H} width={thirdW} height={BAR_H} fill={away.flagAccent} />

      <defs>
        <clipPath id="v3-panel-clip">
          <rect x={PANEL.left} y={PANEL.top} width={PANEL_W} height={PANEL_H} />
        </clipPath>
      </defs>

      <rect x={PANEL.left} y={PANEL.top} width={PANEL_W} height={PANEL_H} fill={PANEL_BG} />
      <rect x={PANEL.left} y={PANEL.top} width={PANEL_W} height={PANEL_H}
        fill="none" stroke="rgba(10,10,10,0.08)" strokeWidth={1} />

      {/* Pitch markings + minute ticks */}
      <g clipPath="url(#v3-panel-clip)" pointerEvents="none">
        <line x1={PANEL.left} y1={dynamicMidY} x2={PANEL.right} y2={dynamicMidY}
          stroke="rgba(10,10,10,0.18)" strokeWidth={2} />
        <circle cx={(PANEL.left + PANEL.right) / 2} cy={dynamicMidY}
          r={PANEL_W * 0.2312} fill="none"
          stroke="rgba(10,10,10,0.18)" strokeWidth={2} />
        {goals.map((g) => {
          const trigger = minuteToFrame(g.minute, kickoffEnd, matchEnd);
          if (frame < trigger) return null;
          const fadeDur = 24;
          const fadeT = Math.max(
            0,
            Math.min(1, (frame - matchEnd) / fadeDur),
          );
          const op = 1 - fadeT;
          if (op <= 0) return null;
          const x = PANEL.left + (g.minute / 90) * PANEL_W;
          const teamCol = numeralColor(g.team === "home" ? home : away);
          return (
            <g key={`tl-${g.id}`} opacity={op}>
              <line x1={x} y1={dynamicMidY - 14} x2={x} y2={dynamicMidY + 14}
                stroke={teamCol} strokeWidth={3} />
              <text x={x} y={dynamicMidY - 22} textAnchor="middle"
                fontFamily={FONT_VERTICAL} fontWeight={800} fontSize={22}
                fill={teamCol}
                style={{ fontVariantNumeric: "tabular-nums" }}>
                {g.minute}'
              </text>
            </g>
          );
        })}
      </g>

      {/* Goal shapes — each rendered via ShapeRenderer at the goal's
          (cx, cy) zone centre. Cells are built around the shape's
          own local (0, 0) and translated into place. NO clipPath
          here so high-importance shapes (sizeFrac up to 1.05 → ~814
          px square) can spill outside the narrower 870-px pitch
          when their emotional weight pushes them beyond the team
          half. The outer SVG viewBox is the only bound. */}
      <g>
        {renderedGoals.map(({ goal, zone, cells, focal, spinDegPerSec }) => {
          const triggerFrame = minuteToFrame(
            goal.minute,
            kickoffEnd,
            matchEnd,
          );
          const localFrame = Math.max(0, frame - triggerFrame);
          if (frame < triggerFrame) return null;
          const cx = zone.x + zone.w / 2;
          const cy = zone.y + zone.h / 2;
          // Per-goal continuous spin (deg/sec → current angle).
          const spinDeg = (spinDegPerSec * localFrame) / 30;
          return (
            <g
              key={`goal-${goal.id}`}
              // Translate into the goal's zone, then apply the per-goal
              // rotation so this render's spin differs from the same
              // shape elsewhere.
              transform={`translate(${cx} ${cy}) rotate(${spinDeg.toFixed(2)})`}
            >
              <ShapeRenderer
                cells={cells}
                focal={focal}
                localFrame={localFrame}
                breathing
                // playToken keyed on goal-id + trigger frame so each
                // goal's GSAP timeline fires exactly once on mount.
                playToken={Math.floor(triggerFrame)}
                // Per-goal animation style — hash the goal id into
                // the ANIM_STYLES pool so each goal in a fixture has
                // its own distinct ease/mode/stagger combo.
                revealOverrides={
                  ANIM_STYLES[stringSeed(goal.id) % ANIM_STYLES.length]
                }
              />
            </g>
          );
        })}
      </g>

      {/* Score numerals — match the gallery's typography exactly so V3
          reads as the same poster system: fontSize 720, Sharp Grotesk
          wdth 8.4 / wght 666, same vertical anchors + pivot. */}
      {(() => {
        const homeBaseY = (PANEL.top + midY) / 2 + 300;
        const awayBaseY = (midY + PANEL.bottom) / 2 + 180;
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

      {/* Event markers */}
      <g>
        {(() => {
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
              const h = hash01(e.id);
              const minOff = (isHomeEv ? PANEL.top : midY) + 36;
              const maxOff = (isHomeEv ? midY : PANEL.bottom) - 36;
              const y = minOff + h * (maxOff - minOff);
              // Cards (yellow/red) sit at a FIXED gap from the LIVE
              // midline (dynamicMidY) so they travel with it as it
              // drifts with possession — home just above the line,
              // away just below — keeping the same gap throughout.
              const cardGap = 46 + h * 110; // 46–156px from the line
              const cardY = isHomeEv
                ? dynamicMidY - cardGap
                : dynamicMidY + cardGap;
              if (e.type === "yellow_card") {
                return (
                  <rect key={e.id} x={x - 10} y={cardY - 10}
                    width={20} height={20} fill="#FFD400" rx={2} />
                );
              }
              if (e.type === "red_card") {
                return (
                  <rect key={e.id} x={x - 10} y={cardY - 10}
                    width={20} height={20} fill="#E32636" rx={2} />
                );
              }
              const r = e.type === "penalty" ? 13 : 10;
              return <circle key={e.id} cx={x} cy={y} r={r} fill={teamCol} />;
            });
        })()}
      </g>

      {/* Possession % + playhead */}
      <g>
        {(() => {
          const currentMinute = Math.max(
            0,
            Math.min(90, ((frame - kickoffEnd) / (matchEnd - kickoffEnd)) * 90),
          );
          const px = PANEL.left + (currentMinute / 90) * PANEL_W;
          const POSS_FONT = 34;
          const POSS_OFFSET = POSS_FONT / 2 + 6;
          const POSS_X = PANEL.right - 18;
          return (
            <>
              <text x={POSS_X} y={dynamicMidY - POSS_OFFSET}
                textAnchor="end" dominantBaseline="middle"
                fontFamily={FONT_VERTICAL} fontWeight={700} fontSize={POSS_FONT}
                fill={numeralColor(home)}
                style={{ fontVariantNumeric: "tabular-nums" }}>
                {Math.round(homePossession * 100)}%
              </text>
              <text x={POSS_X} y={dynamicMidY + POSS_OFFSET}
                textAnchor="end" dominantBaseline="middle"
                fontFamily={FONT_VERTICAL} fontWeight={700} fontSize={POSS_FONT}
                fill={numeralColor(away)}
                style={{ fontVariantNumeric: "tabular-nums" }}>
                {Math.round(awayPossession * 100)}%
              </text>
              <circle cx={px} cy={dynamicMidY} r={9} fill="none"
                stroke="#0E0E0E" strokeWidth={2} opacity={0.75} />
            </>
          );
        })()}
      </g>

      {/* Scorer labels — same layout as V2 (minute hugs centre,
          scorer name rotates 90° on the opposing side). */}
      {renderedGoals.map(({ goal, zone }) => {
        const triggerFrame = minuteToFrame(
          goal.minute,
          kickoffEnd,
          matchEnd,
        );
        const localFrame = Math.max(0, frame - triggerFrame);
        if (frame < triggerFrame) return null;
        const LABEL_START = 12;
        const LABEL_FADE = 10;
        const labelT = Math.max(
          0,
          Math.min(1, (localFrame - LABEL_START) / LABEL_FADE),
        );
        if (labelT <= 0) return null;
        const labelEased = 1 - Math.pow(1 - labelT, 3);
        const isHome = goal.team === "home";
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
        const cxBox = zone.x + zone.w / 2;
        const cyBox = zone.y + zone.h / 2;
        const minuteText = `'${goal.minute}`;
        const scorerText = goal.scorer.toUpperCase();
        const MINUTE_FONT_HALF = 17;
        const SCORER_FONT = 22;
        const SCORER_CHAR_W = SCORER_FONT * 0.62;
        const scorerHalfLen = (goal.scorer.length * SCORER_CHAR_W) / 2;
        const LABEL_GAP = 10;
        const minuteOffset = isHome ? -MINUTE_FONT_HALF : MINUTE_FONT_HALF;
        const scorerOffset = isHome
          ? LABEL_GAP + scorerHalfLen
          : -(LABEL_GAP + scorerHalfLen);
        const scorerRotation = isHome ? 90 : -90;
        void showLabelWell;
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
