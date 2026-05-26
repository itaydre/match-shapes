import React from "react";
import { Composition } from "remotion";
import { matchCardSchema } from "./MatchCard";
import { GridMatchCardShardsPlus } from "./GridMatchCardShardsPlus";
import { GridMatchCardGeometric } from "./GridMatchCardGeometric";
import { GridMatchCardBlank } from "./GridMatchCardBlank";
import { GridMatchCardBlankDiagonal } from "./GridMatchCardBlankDiagonal";
import { GridMatchCardRadialBurst } from "./GridMatchCardRadialBurst";
import { GridMatchCardSpeedStreaks } from "./GridMatchCardSpeedStreaks";
import { GridMatchCardWedgeBurst } from "./GridMatchCardWedgeBurst";
import { GridMatchCardSquareBurst } from "./GridMatchCardSquareBurst";
import { GridMatchCardWedgeVariations } from "./GridMatchCardWedgeVariations";
import { GridMatchCardTheatre } from "./GridMatchCardTheatre";
import { GridMatchCardOpArtTiles } from "./GridMatchCardOpArtTiles";
import { GridMatchCardBrazilSketch } from "./GridMatchCardBrazilSketch";
import { GridMatchCardElClasico } from "./GridMatchCardElClasico";
import {
  MatchBrazilArgentina,
  MATCH_BR_AR_DURATION_FRAMES,
} from "./MatchBrazilArgentina";
import {
  MatchBarcelonaRealMadrid,
  MATCH_FCB_RM_DURATION_FRAMES,
} from "./MatchBarcelonaRealMadrid";
import {
  MatchPortugalCroatia,
  MATCH_PT_HR_DURATION_FRAMES,
} from "./MatchPortugalCroatia";
import { CANVAS_W, CANVAS_H } from "./lib/theme";
import { DURATION_FRAMES, FPS } from "./lib/timing";
import { buildDefaultTimeline } from "./lib/possession";
import type { MatchCardProps } from "./schema";

const defaultProps: MatchCardProps = {
  home: {
    name: "England",
    flagPrimary: "#D5311E",
    flagSecondary: "#FFFFFF",
    flagAccent: "#D5311E",
  },
  away: {
    name: "Brazil",
    flagPrimary: "#009C3B",
    flagSecondary: "#FFDF00",
    flagAccent: "#002776",
  },
  competition: "FIFA WORLD CUP 2026",
  venue: "LEVI'S STADIUM",
  date: "30.6.2026",

  // Alternating H-A-H-A-H — final score 3-2 England.
  goals: [
    { team: "home", minute: 14, style: 0, cell: 7 }, // 1-0
    { team: "away", minute: 28, style: 1, cell: 14 }, // 1-1
    { team: "home", minute: 47, style: 2, cell: 12 }, // 2-1
    { team: "away", minute: 68, style: 3, cell: 6 }, // 2-2
    { team: "home", minute: 88, style: 4, cell: 9 }, // 3-2
  ],
  possessionTimeline: buildDefaultTimeline(0.5, 0),

  emotion: 0.7,
  clash: 0.5,
  shotDensity: 0,
  glitch: 0.45,
  showGrid: false,
  showShots: false,
};

// El Clásico — Barcelona 2-0 Real Madrid, 10 May 2026 at Camp Nou.
// Real fixture data: Rashford 9', Ferran Torres 18'.
const elClasicoProps: MatchCardProps = {
  home: {
    name: "Barcelona",
    flagPrimary: "#A50044", // Barça claret
    flagSecondary: "#004D98", // Barça blue
    flagAccent: "#FFD700", // gold crest accent
  },
  away: {
    name: "Real Madrid",
    flagPrimary: "#00529F", // Madrid crest blue
    flagSecondary: "#FFFFFF", // home white
    flagAccent: "#FEBE10", // crest gold
  },
  competition: "LA LIGA 25/26",
  venue: "CAMP NOU",
  date: "10.5.2026",
  goals: [
    { team: "home", minute: 9, style: 0, cell: 7 }, // Rashford 1-0
    { team: "home", minute: 18, style: 1, cell: 8 }, // F. Torres 2-0
  ],
  possessionTimeline: buildDefaultTimeline(0.6, 0),
  emotion: 0.7,
  clash: 0.5,
  shotDensity: 0,
  glitch: 0.45,
  showGrid: false,
  showShots: false,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="GridMatchCardShardsPlus"
        component={GridMatchCardShardsPlus}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={CANVAS_W}
        height={CANVAS_H}
        defaultProps={defaultProps}
        schema={matchCardSchema}
      />
      <Composition
        id="GridMatchCardGeometric"
        component={GridMatchCardGeometric}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={CANVAS_W}
        height={CANVAS_H}
        defaultProps={defaultProps}
        schema={matchCardSchema}
      />
      <Composition
        id="GridMatchCardBlank"
        component={GridMatchCardBlank}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={CANVAS_W}
        height={CANVAS_H}
        defaultProps={defaultProps}
        schema={matchCardSchema}
      />
      <Composition
        id="GridMatchCardBlankDiagonal"
        component={GridMatchCardBlankDiagonal}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={CANVAS_W}
        height={CANVAS_H}
        defaultProps={defaultProps}
        schema={matchCardSchema}
      />
      <Composition
        id="GridMatchCardRadialBurst"
        component={GridMatchCardRadialBurst}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={CANVAS_W}
        height={CANVAS_H}
        defaultProps={defaultProps}
        schema={matchCardSchema}
      />
      <Composition
        id="GridMatchCardSpeedStreaks"
        component={GridMatchCardSpeedStreaks}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={CANVAS_W}
        height={CANVAS_H}
        defaultProps={defaultProps}
        schema={matchCardSchema}
      />
      <Composition
        id="GridMatchCardWedgeBurst"
        component={GridMatchCardWedgeBurst}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={CANVAS_W}
        height={CANVAS_H}
        defaultProps={defaultProps}
        schema={matchCardSchema}
      />
      <Composition
        id="GridMatchCardSquareBurst"
        component={GridMatchCardSquareBurst}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={CANVAS_W}
        height={CANVAS_H}
        defaultProps={defaultProps}
        schema={matchCardSchema}
      />
      <Composition
        id="GridMatchCardWedgeVariations"
        component={GridMatchCardWedgeVariations}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={CANVAS_W}
        height={CANVAS_H}
        defaultProps={defaultProps}
        schema={matchCardSchema}
      />
      <Composition
        id="GridMatchCardTheatre"
        component={GridMatchCardTheatre}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={CANVAS_W}
        height={CANVAS_H}
        defaultProps={defaultProps}
        schema={matchCardSchema}
      />
      <Composition
        id="GridMatchCardOpArtTiles"
        component={GridMatchCardOpArtTiles}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={CANVAS_W}
        height={CANVAS_H}
        defaultProps={defaultProps}
        schema={matchCardSchema}
      />
      <Composition
        id="GridMatchCardBrazilSketch"
        component={GridMatchCardBrazilSketch}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={CANVAS_W}
        height={CANVAS_H}
        defaultProps={defaultProps}
        schema={matchCardSchema}
      />
      <Composition
        id="GridMatchCardElClasico"
        component={GridMatchCardElClasico}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={CANVAS_W}
        height={CANVAS_H}
        defaultProps={elClasicoProps}
        schema={matchCardSchema}
      />
      {/* Brazil vs Argentina — standalone composition with audio.
          Renders 9:16 (1080×1920). Requires public/audio/crowd.mp3,
          public/audio/goal.mp3, public/audio/whistle.mp3 — see
          public/audio/README.md. */}
      <Composition
        id="MatchBrazilArgentina"
        component={MatchBrazilArgentina}
        durationInFrames={MATCH_BR_AR_DURATION_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="MatchPortugalCroatia"
        component={MatchPortugalCroatia}
        durationInFrames={MATCH_PT_HR_DURATION_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="MatchBarcelonaRealMadrid"
        component={MatchBarcelonaRealMadrid}
        durationInFrames={MATCH_FCB_RM_DURATION_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
      />
    </>
  );
};
