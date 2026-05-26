import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { StaticPreview, type StaticPreviewTeam, type StaticPreviewGoal } from "../playground/StaticPreview";
import {
  DEFAULT_SETTINGS,
  type CellGridSettings,
  type CellGridType,
} from "./lib/cellGrid";
import type { LabBoundaryShape } from "./lib/boundaryShapes";

// Brazil vs Argentina — Copa América 2026 (Maracanã, 14.6.2026).
// Standalone Remotion composition that wraps StaticPreview with:
//   - crowd ambience looping throughout
//   - goal shout firing at each goal's match-minute
//   - final whistle at full-time
// Audio assets live in public/audio/ — see README.md there.

const BRAZIL: StaticPreviewTeam = {
  name: "Brazil",
  flagPrimary: "#009C3B",
  flagSecondary: "#FEDD00",
  flagAccent: "#002776",
  flagWeights: [0.6, 0.3, 0.1],
};
const ARGENTINA: StaticPreviewTeam = {
  name: "Argentina",
  flagPrimary: "#75AADB",
  flagSecondary: "#FFFFFF",
  flagAccent: "#F6B40E",
  flagWeights: [0.45, 0.45, 0.1],
};
// Per-team goal-sound language file (in public/audio/).
const HOME_GOAL_AUDIO = "audio/goal-br.mp3";
const AWAY_GOAL_AUDIO = "audio/goal-es-ar.mp3";

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
  makeGoal("br-1", "home", 12, "VINICIUS JR.", "radial_burst", "circle", 0),
  makeGoal("br-2", "away", 34, "MESSI", "blocks", "rectangle", 1),
  makeGoal("br-3", "home", 58, "RAPHINHA", "wedges", "arch", 2),
  makeGoal("br-4", "home", 79, "RODRYGO", "kinetic_shockwave", "oval", 3),
];

// Vary y per team so consecutive goals don't pile on the same row.
const Y_SLOTS = [35, 70, 22, 58, 80];
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
    g.recipe.posY = Y_SLOTS[rank % Y_SLOTS.length] ?? 50;
  }
}

// Match-minute → composition frame.
const KICKOFF_END = 15;
const MATCH_END = 180;
const minuteToFrame = (m: number) =>
  KICKOFF_END +
  Math.max(0, Math.min(1, m / 90)) * (MATCH_END - KICKOFF_END);

// Per-shot durations (in frames at 30 fps).
const GOAL_SHOUT_FRAMES = 90; // 3 s — matches the trimmed per-language MP3s
const WHISTLE_FRAMES = 60; // ~2 s
const TOTAL_FRAMES = 270;

export const MatchBrazilArgentina: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#F4F4F4" }}>
      {/* Crowd — pushed louder so the stadium bed is the dominant
          layer; goal shouts and whistle ride on top at reduced gain. */}
      <Audio src={staticFile("audio/crowd.mp3")} loop volume={0.9} />

      {/* Goal shouts — fired at each goal's trigger frame in the
          scoring team's language. */}
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

      {/* Final whistle — at the end of the match window. */}
      <Sequence from={MATCH_END} durationInFrames={WHISTLE_FRAMES}>
        <Audio src={staticFile("audio/whistle.mp3")} volume={0.55} />
      </Sequence>

      {/* Visual — the same StaticPreview component the lab/gallery use,
          driven by Remotion's currentFrame. */}
      <StaticPreview
        goals={GOALS}
        selectedId={null}
        frame={frame}
        home={BRAZIL}
        away={ARGENTINA}
        homePalette={paletteOf(BRAZIL)}
        awayPalette={paletteOf(ARGENTINA)}
        competition="COPA AMÉRICA 2026"
        venueAndDate="Maracanã | 14.6.2026"
        finalHomePossession={0.72}
        kickoffEnd={KICKOFF_END}
        matchEnd={MATCH_END}
      />
    </AbsoluteFill>
  );
};

export const MATCH_BR_AR_DURATION_FRAMES = TOTAL_FRAMES;
