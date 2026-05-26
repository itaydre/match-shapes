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
} from "../playground/StaticPreview";
import {
  DEFAULT_SETTINGS,
  type CellGridSettings,
  type CellGridType,
} from "./lib/cellGrid";
import type { LabBoundaryShape } from "./lib/boundaryShapes";

// Portugal vs Croatia — Nations League Final (Allianz Arena, 9.6.2027).
// Same template as MatchBrazilArgentina; only team data + goals
// differ. Audio assets live in public/audio/.

const PORTUGAL: StaticPreviewTeam = {
  name: "Portugal",
  flagPrimary: "#046A38",
  flagSecondary: "#DA291C",
  flagAccent: "#FFE600",
  flagWeights: [0.4, 0.55, 0.05],
};

const CROATIA: StaticPreviewTeam = {
  name: "Croatia",
  flagPrimary: "#FF0000",
  flagSecondary: "#FFFFFF",
  flagAccent: "#171796",
  flagWeights: [0.4, 0.45, 0.15],
};

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
  makeGoal("pt-1", "home", 11, "BRUNO F.", "fragmented_ray", "oval", 0),
  makeGoal("pt-2", "away", 38, "KRAMARIĆ", "arcs", "capsule", 1),
  makeGoal("pt-3", "home", 67, "RAFAEL LEÃO", "particle_burst", "organic_blob", 2),
  makeGoal("pt-4", "home", 89, "B. SILVA", "mixed", "circle", 3),
];

const Y_SLOTS = [50, 22, 78, 38, 62]; // Portugal/Croatia game's y-rhythm
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

const KICKOFF_END = 15;
const MATCH_END = 180;
const minuteToFrame = (m: number) =>
  KICKOFF_END + Math.max(0, Math.min(1, m / 90)) * (MATCH_END - KICKOFF_END);

const GOAL_SHOUT_FRAMES = 90; // 3 s — matches the trimmed per-language MP3s
const HOME_GOAL_AUDIO = "audio/goal-pt.mp3";
const AWAY_GOAL_AUDIO = "audio/goal-hr.mp3";
const WHISTLE_FRAMES = 60; // ~2 s
const TOTAL_FRAMES = 270;

export const MatchPortugalCroatia: React.FC = () => {
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
            volume={0}
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
        home={PORTUGAL}
        away={CROATIA}
        homePalette={paletteOf(PORTUGAL)}
        awayPalette={paletteOf(CROATIA)}
        competition="NATIONS LEAGUE FINAL"
        venueAndDate="Allianz Arena | 9.6.2027"
        finalHomePossession={0.54}
        kickoffEnd={KICKOFF_END}
        matchEnd={MATCH_END}
      />
    </AbsoluteFill>
  );
};

export const MATCH_PT_HR_DURATION_FRAMES = TOTAL_FRAMES;
