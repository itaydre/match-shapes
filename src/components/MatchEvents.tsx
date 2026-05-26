import React, { useMemo } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { Team } from "../schema";

export type EventKind =
  | "shot"
  | "foul"
  | "yellow"
  | "red"
  | "corner"
  | "freekick"
  | "penalty";

type Props = {
  bounds: { left: number; top: number; width: number; height: number };
  home: Team;
  away: Team;
  density: number; // 0..1 — multiplies counts of every event type
  endFrame: number;
  show: boolean;
  // Current midline Y in CSS pixels (NOT a fraction). Cards are
  // positioned relative to this so they move with the midline as
  // possession shifts.
  midY?: number;
};

type Mark = {
  x: number;
  y: number;
  team: "home" | "away";
  kind: EventKind;
  delay: number;
  size: number;
  // Cards travel with the midline — `cardOffset` is the signed
  // fractional distance from the midline (negative = above, into
  // home half; positive = below, into away half). Non-card marks
  // leave this undefined and use `y` directly.
  cardOffset?: number;
};

const TEAM_BAND: Record<"home" | "away", [number, number]> = {
  home: [0.04, 0.46],
  away: [0.54, 0.96],
};

// Cards hug the midline. Offsets are in fraction-of-pitch-height
// units measured FROM the midline (not from the panel top), so the
// cards stay glued to the line as it moves up or down with
// possession. Home cards sit just above the line, away just below.
const CARD_OFFSET_BAND: Record<"home" | "away", [number, number]> = {
  home: [-0.10, -0.02],
  away: [0.02, 0.10],
};

// Base counts per event type at density = 1.0. Density scales them down.
const BASE_COUNTS: Record<EventKind, number> = {
  shot: 14,
  foul: 10,
  yellow: 4,
  red: 1,
  corner: 6,
  freekick: 5,
  penalty: 1,
};

/**
 * Scattered marks representing per-team match events. Each event type uses
 * a distinct glyph so the legend stays readable even though the marks are tiny.
 *  • shot      — filled dot
 *  • foul      — small ring
 *  • yellow    — small filled square (yellow)
 *  • red       — small filled square (warm red)
 *  • corner    — small triangle
 *  • freekick  — short dash
 *  • penalty   — concentric ring/dot (target)
 */
export const MatchEvents: React.FC<Props> = ({
  bounds,
  home,
  away,
  density,
  endFrame,
  show,
  midY,
}) => {
  const frame = useCurrentFrame();

  const marks = useMemo<Mark[]>(() => {
    if (!show) return [];
    const rng = mulberry32(0xc0ffee);
    const out: Mark[] = [];
    (Object.keys(BASE_COUNTS) as EventKind[]).forEach((kind) => {
      const total = Math.max(0, Math.round(BASE_COUNTS[kind] * density * 2));
      for (let i = 0; i < total; i++) {
        const team: "home" | "away" = rng() < 0.5 ? "home" : "away";
        const isCard = kind === "yellow" || kind === "red";
        if (isCard) {
          // Cards: store as signed offset from the midline so they
          // travel with it. y is unused for cards (recomputed at
          // render time).
          const [o0, o1] = CARD_OFFSET_BAND[team];
          out.push({
            x: 0.06 + rng() * 0.88,
            y: 0,
            cardOffset: o0 + rng() * (o1 - o0),
            team,
            kind,
            delay: rng(),
            size: 1 + rng() * 0.6,
          });
        } else {
          const [y0, y1] = TEAM_BAND[team];
          out.push({
            x: 0.06 + rng() * 0.88,
            y: y0 + rng() * (y1 - y0),
            team,
            kind,
            delay: rng(),
            size: 1 + rng() * 0.6,
          });
        }
      }
    });
    return out;
  }, [density, show]);

  if (!show) return null;

  const introStart = 15;
  const introEnd = endFrame;

  return (
    <svg
      style={{
        position: "absolute",
        left: bounds.left,
        top: bounds.top,
        pointerEvents: "none",
      }}
      width={bounds.width}
      height={bounds.height}
    >
      {marks.map((m, i) => {
        const dotFrame = introStart + m.delay * (introEnd - introStart);
        const o = interpolate(frame, [dotFrame, dotFrame + 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const teamColor =
          m.team === "home" ? home.flagPrimary : away.flagPrimary;
        const cx = m.x * bounds.width;
        // Cards: place relative to the current midline (in panel-
        // local coords). Non-card marks keep their fractional y.
        // Fallback: if midY isn't provided, use the panel midline.
        const midYLocal =
          midY !== undefined ? midY - bounds.top : bounds.height * 0.5;
        const cy =
          m.cardOffset !== undefined
            ? midYLocal + m.cardOffset * bounds.height
            : m.y * bounds.height;
        return (
          <g key={i} opacity={o}>
            {renderGlyph(m.kind, cx, cy, m.size, teamColor)}
          </g>
        );
      })}
    </svg>
  );
};

const renderGlyph = (
  kind: EventKind,
  cx: number,
  cy: number,
  s: number,
  teamColor: string,
): React.ReactNode => {
  switch (kind) {
    case "shot":
      return <circle cx={cx} cy={cy} r={6 * s} fill={teamColor} />;
    case "foul":
      return (
        <circle
          cx={cx}
          cy={cy}
          r={6 * s}
          fill="none"
          stroke={teamColor}
          strokeWidth={1.6}
        />
      );
    case "yellow":
      return (
        <rect
          x={cx - 5 * s}
          y={cy - 7 * s}
          width={10 * s}
          height={14 * s}
          fill="#F5C518"
          stroke={teamColor}
          strokeWidth={0.8}
        />
      );
    case "red":
      return (
        <rect
          x={cx - 5 * s}
          y={cy - 7 * s}
          width={10 * s}
          height={14 * s}
          fill="#E13929"
          stroke={teamColor}
          strokeWidth={0.8}
        />
      );
    case "corner":
      return (
        <polygon
          points={`${cx},${cy - 7 * s} ${cx + 6 * s},${cy + 5 * s} ${cx - 6 * s},${cy + 5 * s}`}
          fill={teamColor}
        />
      );
    case "freekick":
      return (
        <line
          x1={cx - 7 * s}
          y1={cy}
          x2={cx + 7 * s}
          y2={cy}
          stroke={teamColor}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
      );
    case "penalty":
      return (
        <g>
          <circle
            cx={cx}
            cy={cy}
            r={8 * s}
            fill="none"
            stroke={teamColor}
            strokeWidth={1.4}
          />
          <circle cx={cx} cy={cy} r={2.6 * s} fill={teamColor} />
        </g>
      );
  }
};

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
