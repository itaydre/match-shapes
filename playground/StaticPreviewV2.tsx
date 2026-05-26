import React, { useMemo } from "react";
import type {
  StaticPreviewGoal,
  StaticPreviewTeam,
  MatchEvent,
} from "./StaticPreview";
import {
  FocusShape,
  familyForIndex,
  type FocusFamily,
  type FocusRecipe,
} from "./focusShapesV2";

// StaticPreviewV2 — mirrors StaticPreview's full match-card chrome
// (team names, tricolor bars, side captions, midfield/centre circle,
// dynamic possession, event markers, score numerals, scorer labels)
// but replaces the cellGrid goal-rendering with the focusShapesV2
// generative shape language. Keeps the original surface untouched for
// side-by-side comparison.

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const FPS = 30;
const TOP_INSET = 170;
const BOTTOM_INSET = 170;
const SIDE_INSET = 96;
const BAR_H = 15;
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
const CARD_BG = "#F4F4F4";
const PANEL_BG = "#FFFFFF";

const FONT_NUMERALS =
  '"Sharp Grotesk VF", "Sharp Grotesk", Inter, ui-sans-serif, sans-serif';
const FONT_TEAM_NAMES = 'Anton, "Anton Regular", ui-sans-serif, sans-serif';
const FONT_VERTICAL =
  '"Google Sans Flex", "Roboto Flex", Inter, ui-sans-serif, sans-serif';

export type StaticPreviewV2Props = {
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
  // When true, the centre of each goal disc is reserved for the
  // scorer label (the shape draws around the well).
  showLabelWell?: boolean;
  // Optional per-goal family override. If the caller doesn't supply
  // one, the rank index cycles through FAMILY_CYCLE.
  familyForGoal?: (goal: StaticPreviewGoal, rank: number) => FocusFamily;
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

// Per-family focal hint — different families want their focal in
// slightly different places relative to the shape's bounding box.
const focalForFamily = (
  family: FocusFamily,
  side: "home" | "away",
  seedHash: number,
): { x: number; y: number } => {
  const r = ((seedHash % 1000) / 1000 - 0.5) * 0.6;
  const dirY = side === "home" ? 1 : -1;
  switch (family) {
    case "radial_spokes":
      return { x: r * 0.4, y: r * 0.4 };
    case "dotted_arcs":
      return { x: r * 0.3, y: dirY * 0.25 };
    case "drift_grid":
      return { x: r > 0 ? -0.7 : 0.7, y: dirY * 0.7 };
    case "perspective_stripes":
      return { x: r > 0 ? -0.95 : 0.95, y: dirY * 0.2 };
    case "sawtooth_spiral":
      return { x: r * 0.2, y: r * 0.2 };
    case "ring_compression":
      // The compression spine itself supplies the focal — keep the
      // disc on-centre with only a tiny seed-driven offset.
      return { x: r * 0.08, y: r * 0.08 };
  }
};

export const StaticPreviewV2: React.FC<StaticPreviewV2Props> = ({
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
  showLabelWell = true,
  familyForGoal,
}) => {
  void FPS;
  const midY = (PANEL.top + PANEL.bottom) / 2;
  const cxPanel = (PANEL.left + PANEL.right) / 2;
  const thirdW = (CANVAS_W - SIDE_INSET * 2) / 3;

  const homePossession = useMemo(() => {
    const t = Math.max(
      0,
      Math.min(1, (frame - kickoffEnd) / (matchEnd - kickoffEnd)),
    );
    const base = 0.5 + t * (finalHomePossession - 0.5);
    // Drift gated by t so the readout starts at 50/50 at kickoff.
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
  // Wobble gated by kickoffT so the midfield is centred at kickoff.
  const wobble =
    (Math.sin(frame * 0.045) * 38 +
      Math.sin(frame * 0.082 + 1.3) * 18 +
      Math.sin(frame * 0.027 + 2.1) * 22) *
    kickoffT;
  const dynamicMidY = midY + possDrift + wobble;

  // Tally goals + remember the latest trigger so the score numeral can
  // pulse when each goal fires — mirrors StaticPreview's behaviour.
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
  const homeBumpScale = 1 + bumpAmount(lastHomeBumpFrame) * 0.18;
  const awayBumpScale = 1 + bumpAmount(lastAwayBumpFrame) * 0.18;

  // Pre-compute each goal's sub-zone + focusShape recipe + the local
  // frame (for reveal staging).
  const sortedGoals = useMemo(
    () => [...goals].sort((a, b) => a.minute - b.minute),
    [goals],
  );

  const renderedGoals = useMemo(() => {
    return sortedGoals.map((g, idx) => {
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
      const fired = frame >= triggerFrame;
      const family = familyForGoal
        ? familyForGoal(g, idx)
        : familyForIndex(idx);
      const seed = stringSeed(`${g.id}:${idx}`);
      const focal = focalForFamily(family, g.team, seed);
      const ink = g.team === "home" ? home.flagPrimary : away.flagPrimary;
      const accent = g.team === "home" ? home.flagAccent : away.flagAccent;
      const recipe: FocusRecipe = {
        family,
        seed,
        size: subSize,
        focal,
        ink,
        accent,
      };
      return { goal: g, zone, fired, localFrame, recipe };
    });
  }, [sortedGoals, frame, home, away, kickoffEnd, matchEnd, familyForGoal, midY]);

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

      {/* Team names — top + bottom */}
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

      {/* Tricolor bars */}
      <rect x={SIDE_INSET} y={TOP_INSET} width={thirdW} height={BAR_H} fill={home.flagPrimary} />
      <rect x={SIDE_INSET + thirdW} y={TOP_INSET} width={thirdW} height={BAR_H} fill={home.flagSecondary} />
      <rect x={SIDE_INSET + thirdW * 2} y={TOP_INSET} width={thirdW} height={BAR_H} fill={home.flagAccent} />
      <rect x={SIDE_INSET} y={CANVAS_H - BOTTOM_INSET - BAR_H} width={thirdW} height={BAR_H} fill={away.flagPrimary} />
      <rect x={SIDE_INSET + thirdW} y={CANVAS_H - BOTTOM_INSET - BAR_H} width={thirdW} height={BAR_H} fill={away.flagSecondary} />
      <rect x={SIDE_INSET + thirdW * 2} y={CANVAS_H - BOTTOM_INSET - BAR_H} width={thirdW} height={BAR_H} fill={away.flagAccent} />

      <defs>
        <clipPath id="v2-panel-clip">
          <rect
            x={PANEL.left}
            y={PANEL.top}
            width={PANEL_W}
            height={PANEL_H}
          />
        </clipPath>
        {/* Per-goal label-well clip — even-odd with a central disc cut */}
        {renderedGoals.map(({ goal, zone }) => {
          const holeR = Math.min(zone.w, zone.h) * 0.22;
          const hcx = zone.x + zone.w / 2;
          const hcy = zone.y + zone.h / 2;
          const holePath = `M ${zone.x},${zone.y} h ${zone.w} v ${zone.h} h ${-zone.w} Z M ${hcx - holeR},${hcy} a ${holeR},${holeR} 0 1,0 ${holeR * 2},0 a ${holeR},${holeR} 0 1,0 ${-holeR * 2},0 Z`;
          return (
            <clipPath
              key={`well-${goal.id}`}
              id={`v2-hole-${goal.id}`}
              clipPathUnits="userSpaceOnUse"
            >
              <path d={holePath} fillRule="evenodd" />
            </clipPath>
          );
        })}
      </defs>

      {/* Panel background + thin outline */}
      <rect x={PANEL.left} y={PANEL.top} width={PANEL_W} height={PANEL_H} fill={PANEL_BG} />
      <rect x={PANEL.left} y={PANEL.top} width={PANEL_W} height={PANEL_H}
        fill="none" stroke="rgba(10,10,10,0.08)" strokeWidth={1} />

      {/* Pitch markings + goal-minute timeline ticks */}
      <g clipPath="url(#v2-panel-clip)" pointerEvents="none">
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

      {/* Goal shapes — each rendered via FocusShape, scaled in from the
          shape's focal centre using the same back-out easing as the
          cellGrid version's per-cell reveal. The label-well clipPath is
          defined in absolute panel coords, so it MUST sit on a
          transform-free wrapper; the scale + translate go on an inner
          group so the clip stays anchored to the panel. */}
      <g>
        {renderedGoals.map(({ goal, zone, fired, localFrame, recipe }) => {
          if (!fired) return null;
          const STAGGER_TOTAL = 70;
          const t = Math.max(
            0,
            Math.min(1, localFrame / STAGGER_TOTAL),
          );
          const s = 2.6;
          const t2 = t - 1;
          const scale = t2 * t2 * ((s + 1) * t2 + s) + 1;
          const cx = zone.x + zone.w / 2;
          const cy = zone.y + zone.h / 2;
          return (
            <g
              key={`goal-${goal.id}`}
              clipPath={showLabelWell ? `url(#v2-hole-${goal.id})` : undefined}
            >
              <g transform={`translate(${cx} ${cy}) scale(${scale.toFixed(3)})`}>
                <FocusShape recipe={recipe} />
              </g>
            </g>
          );
        })}
      </g>

      {/* Score numerals — wrapped in scale groups so each digit bumps
          on its own goal trigger (identical motion to StaticPreview). */}
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

      {/* Match-event markers */}
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
              // Cards hug the midline — bookings cluster against the
              // half-way line instead of scattering across the full
              // team half.
              const cardT = isHomeEv ? 0.7 + h * 0.3 : h * 0.3;
              const cardY = minOff + cardT * (maxOff - minOff);
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

      {/* Running possession % + playhead */}
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

      {/* Per-goal scorer labels — same layout pattern as StaticPreview
          (minute centred near hole, scorer name rotated 90° on the
          opposing side). */}
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
