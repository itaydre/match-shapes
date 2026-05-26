import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import {
  StaticPreview,
  type StaticPreviewTeam,
  type StaticPreviewGoal,
  type MatchEvent,
} from "../playground/StaticPreview";
import {
  DEFAULT_SETTINGS,
  type CellGridSettings,
  type CellGridType,
} from "./lib/cellGrid";
import type { LabBoundaryShape } from "./lib/boundaryShapes";

// El Clásico — Barcelona 2-0 Real Madrid, La Liga title decider,
// Spotify Camp Nou, 10 May 2026. Real match data sourced from ESPN +
// Sofascore: goal scorers/minutes, yellow-card minutes, shot and
// corner totals.

const BARCELONA: StaticPreviewTeam = {
  name: "Barcelona",
  flagPrimary: "#004D98", // Blaugrana blue
  flagSecondary: "#A50044", // Blaugrana garnet
  flagAccent: "#FFED02", // crest yellow
  flagWeights: [0.48, 0.44, 0.08],
  goalLang: "es",
};

const REAL_MADRID: StaticPreviewTeam = {
  name: "Real Madrid",
  flagPrimary: "#FFFFFF",
  flagSecondary: "#00529F",
  flagAccent: "#FEBE10",
  flagWeights: [0.7, 0.22, 0.08],
  goalLang: "es",
};

const HOME_GOAL_AUDIO = "audio/goal-es.mp3";
const AWAY_GOAL_AUDIO = "audio/goal-es.mp3";

const isLightHex = (hex: string): boolean => {
  const h = hex.replace("#", "");
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return r * 0.2126 + g * 0.7152 + b * 0.0722 > 205;
};

const PALETTE_SLOTS = 12;
const paletteOf = (t: StaticPreviewTeam): string[] => {
  const lightPrimary = isLightHex(t.flagPrimary);
  const baseColors: [string, string, string] = lightPrimary
    ? [t.flagAccent, t.flagSecondary, t.flagPrimary]
    : [t.flagPrimary, t.flagSecondary, t.flagAccent];
  const wInput = t.flagWeights ?? [0.34, 0.33, 0.33];
  const baseWeights: [number, number, number] = lightPrimary
    ? [wInput[2], wInput[1], wInput[0]]
    : [wInput[0], wInput[1], wInput[2]];
  const palette: string[] = [];
  for (let i = 0; i < baseColors.length; i++) {
    const slots = Math.max(1, Math.round(baseWeights[i]! * PALETTE_SLOTS));
    for (let j = 0; j < slots; j++) palette.push(baseColors[i]!);
  }
  return palette;
};

const makeGoal = (
  id: string,
  team: "home" | "away",
  minute: number,
  scorer: string,
  type: CellGridType,
  boundary: LabBoundaryShape,
  rank: number,
  overrides: Partial<CellGridSettings> = {},
): StaticPreviewGoal => {
  const k = rank;
  return {
    id,
    team,
    minute,
    scorer,
    recipe: {
      type,
      boundary,
      posX: 8 + Math.max(0, Math.min(1, minute / 90)) * 84,
      posY: 50,
      size: 50 + (k % 3) * 10,
      moireStrength: Math.min(80, 28 + k * 15),
      blendAmount: k > 1 ? 20 + (k % 3) * 12 : 0,
      blendTarget: ["blocks", "wedges", "arcs", "warped_bands"][
        (k * 5) % 4
      ] as CellGridType,
      recursionDepth: Math.min(3, Math.floor(k / 1.4)),
      settings: {
        ...DEFAULT_SETTINGS,
        distortionStrength: Math.min(100, 62 + k * 14),
        outwardForce: 20 + ((k * 41) % 80),
        curvature: (k * 71) % 181,
        pinchIntensity: (k % 2 === 0 ? 0 : 1) * 55,
        asymmetry: 10 + ((k * 29) % 55),
        shapeDensity: 30 + ((k * 7) % 20),
        shapeScale: 0.55 + (k % 4) * 0.14,
        rotation: (k * 113) % 360,
        margin: 24 + ((k * 13) % 36),
        seed: 11 + k * 47,
        ...overrides,
      },
    },
  };
};

const GOALS: StaticPreviewGoal[] = [
  makeGoal("cl-1", "home", 9, "RASHFORD", "radial_burst", "circle", 0),
  makeGoal("cl-2", "home", 18, "F. TORRES", "kinetic_shockwave", "oval", 1),
];

const Y_SLOTS = [35, 62, 22, 78, 50];
{
  const home = GOALS.filter((g) => g.team === "home").sort(
    (a, b) => a.minute - b.minute,
  );
  const away = GOALS.filter((g) => g.team === "away").sort(
    (a, b) => a.minute - b.minute,
  );
  for (const g of GOALS) {
    const list = g.team === "home" ? home : away;
    const rank = list.indexOf(g);
    const slotIdx = g.team === "home" ? rank : rank + 2;
    g.recipe.posY = Y_SLOTS[slotIdx % Y_SLOTS.length] ?? 50;
  }
}

const EVENTS: MatchEvent[] = [
  { id: "cl-s1", team: "home", minute: 4, type: "shot" },
  { id: "cl-s2", team: "away", minute: 12, type: "shot" },
  { id: "cl-c1", team: "home", minute: 15, type: "corner" },
  { id: "cl-c2", team: "away", minute: 22, type: "corner" },
  { id: "cl-s3", team: "home", minute: 27, type: "shot" },
  { id: "cl-c3", team: "away", minute: 30, type: "corner" },
  { id: "cl-s4", team: "away", minute: 31, type: "shot" },
  { id: "cl-s5", team: "home", minute: 38, type: "shot" },
  { id: "cl-yc1", team: "away", minute: 40, type: "yellow_card" }, // Camavinga
  { id: "cl-c4", team: "away", minute: 43, type: "corner" },
  { id: "cl-s6", team: "away", minute: 49, type: "shot" },
  { id: "cl-yc2", team: "away", minute: 52, type: "yellow_card" }, // Asencio
  { id: "cl-yc3", team: "home", minute: 52, type: "yellow_card" }, // Olmo
  { id: "cl-yc4", team: "away", minute: 55, type: "yellow_card" }, // Bellingham
  { id: "cl-s7", team: "home", minute: 56, type: "shot" },
  { id: "cl-c5", team: "home", minute: 61, type: "corner" },
  { id: "cl-s8", team: "away", minute: 67, type: "shot" },
  { id: "cl-c6", team: "away", minute: 68, type: "corner" },
  { id: "cl-s9", team: "home", minute: 73, type: "shot" },
  { id: "cl-s10", team: "away", minute: 76, type: "shot" },
  { id: "cl-c7", team: "home", minute: 78, type: "corner" },
  { id: "cl-yc5", team: "home", minute: 81, type: "yellow_card" }, // Raphinha
  { id: "cl-yc6", team: "away", minute: 81, type: "yellow_card" }, // Alexander-Arnold
  { id: "cl-c8", team: "away", minute: 84, type: "corner" },
  { id: "cl-s11", team: "away", minute: 85, type: "shot" },
  { id: "cl-s12", team: "home", minute: 87, type: "shot" },
];

const KICKOFF_END = 15;
const MATCH_END = 180;
const minuteToFrame = (m: number) =>
  KICKOFF_END + Math.max(0, Math.min(1, m / 90)) * (MATCH_END - KICKOFF_END);

const GOAL_SHOUT_FRAMES = 90; // 3 s
const WHISTLE_FRAMES = 60; // ~2 s
const TOTAL_FRAMES = 270;

export const MatchBarcelonaRealMadrid: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#F4F4F4" }}>
      <Audio src={staticFile("audio/crowd.mp3")} loop volume={0.9} />
      {GOALS.map((g) => (
        <Sequence
          key={`shout-${g.id}`}
          from={Math.round(minuteToFrame(g.minute))}
          durationInFrames={GOAL_SHOUT_FRAMES}
        >
          <Audio
            src={staticFile(
              g.team === "home" ? HOME_GOAL_AUDIO : AWAY_GOAL_AUDIO,
            )}
            volume={0.45}
          />
        </Sequence>
      ))}
      <Sequence from={MATCH_END} durationInFrames={WHISTLE_FRAMES}>
        <Audio src={staticFile("audio/whistle.mp3")} volume={0.55} />
      </Sequence>
      <StaticPreview
        goals={GOALS}
        selectedId={null}
        frame={frame}
        home={BARCELONA}
        away={REAL_MADRID}
        homePalette={paletteOf(BARCELONA)}
        awayPalette={paletteOf(REAL_MADRID)}
        competition="LA LIGA 2025/26"
        venueAndDate="Spotify Camp Nou | 10.5.2026"
        finalHomePossession={0.567}
        events={EVENTS}
        kickoffEnd={KICKOFF_END}
        matchEnd={MATCH_END}
      />
    </AbsoluteFill>
  );
};

export const MATCH_FCB_RM_DURATION_FRAMES = TOTAL_FRAMES;
