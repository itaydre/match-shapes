import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  StaticPreview,
  type StaticPreviewGoal,
  type StaticPreviewTeam,
} from "./StaticPreview";
import {
  DEFAULT_SETTINGS,
  type CellGridSettings,
  type CellGridType,
} from "../src/lib/cellGrid";
import type { LabBoundaryShape } from "../src/lib/boundaryShapes";

// England vs Croatia — standalone fixture page. Same recipe model
// as the gallery; one card, with its own play / replay button.

const ENGLAND: StaticPreviewTeam = {
  name: "England",
  flagPrimary: "#CE1124",
  flagSecondary: "#FFFFFF",
  flagAccent: "#012169",
  flagWeights: [0.3, 0.65, 0.05],
  goalLang: "en",
};

const CROATIA: StaticPreviewTeam = {
  name: "Croatia",
  flagPrimary: "#FF0000",
  flagSecondary: "#FFFFFF",
  flagAccent: "#171796",
  flagWeights: [0.4, 0.45, 0.15],
  goalLang: "hr",
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

const GAME = {
  competition: "EURO 2028 · QUARTERFINAL",
  venueAndDate: "Wembley | 28.6.2028",
  home: ENGLAND,
  away: CROATIA,
  finalHomePossession: 0.61,
  goals: [
    makeGoal("ec-1", "home", 14, "KANE", "radial_burst", "circle", 0),
    makeGoal("ec-2", "away", 31, "MODRIĆ", "warped_bands", "rectangle", 1),
    makeGoal("ec-3", "home", 58, "BELLINGHAM", "ink_spiral", "irregular_polygon", 2),
    makeGoal("ec-4", "home", 82, "SAKA", "kinetic_shockwave", "oval", 3),
  ],
};

// Zig-zag y per team so consecutive goals don't all sit on the
// same row.
const Y_SLOTS = [35, 70, 22, 58, 80];
{
  const homeGoals = [...GAME.goals]
    .filter((g) => g.team === "home")
    .sort((a, b) => a.minute - b.minute);
  const awayGoals = [...GAME.goals]
    .filter((g) => g.team === "away")
    .sort((a, b) => a.minute - b.minute);
  for (const g of GAME.goals) {
    g.recipe.posX = 8 + Math.max(0, Math.min(1, g.minute / 90)) * 84;
    const list = g.team === "home" ? homeGoals : awayGoals;
    const rank = list.indexOf(g);
    g.recipe.posY = Y_SLOTS[rank % Y_SLOTS.length] ?? 50;
  }
}

const TOTAL_FRAMES = 270;
const END_FRAME = TOTAL_FRAMES - 1;

const KICKOFF_END = 15;
const MATCH_END = 180;
const minuteToTriggerFrame = (m: number) =>
  KICKOFF_END + Math.max(0, Math.min(1, m / 90)) * (MATCH_END - KICKOFF_END);

const Card: React.FC = () => {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const crowdRef = useRef<HTMLAudioElement | null>(null);
  const goalsFiredRef = useRef<Set<string>>(new Set());
  const whistleFiredRef = useRef(false);
  useEffect(() => {
    const crowd = new Audio("/audio/crowd.mp3");
    crowd.loop = true;
    crowd.volume = 0.9;
    crowdRef.current = crowd;
    return () => {
      crowd.pause();
      crowd.src = "";
    };
  }, []);
  useEffect(() => {
    const c = crowdRef.current;
    if (!c) return;
    if (playing) {
      c.currentTime = 0;
      c.play().catch(() => {});
    } else c.pause();
  }, [playing]);
  useEffect(() => {
    if (!playing) return;
    for (const g of GAME.goals) {
      if (goalsFiredRef.current.has(g.id)) continue;
      if (frame >= minuteToTriggerFrame(g.minute)) {
        const scorerTeam = g.team === "home" ? GAME.home : GAME.away;
        const lang = scorerTeam.goalLang ?? "en";
        const a = new Audio(`/audio/goal-${lang}.mp3`);
        a.volume = 0; // muted for now
        a.play().catch(() => {});
        goalsFiredRef.current.add(g.id);
      }
    }
    if (!whistleFiredRef.current && frame >= MATCH_END) {
      const a = new Audio("/audio/whistle.mp3");
      a.volume = 0.45;
      a.play().catch(() => {});
      whistleFiredRef.current = true;
    }
  }, [frame, playing]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const next = frameRef.current + (dt / 1000) * 30;
      if (next >= END_FRAME) {
        setFrame(END_FRAME);
        setPlaying(false);
        return;
      }
      setFrame(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  const home = useMemo(() => paletteOf(GAME.home), []);
  const away = useMemo(() => paletteOf(GAME.away), []);
  const handleToggle = () => {
    if (playing) {
      setPlaying(false);
    } else {
      if (frameRef.current >= END_FRAME) {
        setFrame(0);
        goalsFiredRef.current.clear();
        whistleFiredRef.current = false;
      }
      setPlaying(true);
    }
  };
  return (
    <div
      style={styles.card}
      onClick={handleToggle}
      role="button"
      tabIndex={0}
    >
      <StaticPreview
        goals={GAME.goals}
        selectedId={null}
        frame={frame}
        home={GAME.home}
        away={GAME.away}
        homePalette={home}
        awayPalette={away}
        competition={GAME.competition}
        venueAndDate={GAME.venueAndDate}
        finalHomePossession={GAME.finalHomePossession}
      />
      {!playing && frame < END_FRAME && (
        <div style={styles.playOverlay}>
          <div style={styles.playButton}>▶</div>
        </div>
      )}
    </div>
  );
};

export const EnglandCroatia: React.FC = () => (
  <div style={styles.shell}>
    <div style={styles.row}>
      <Card />
    </div>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  shell: {
    background: "#0E0E0E",
    minHeight: "100vh",
    width: "100%",
    overflow: "auto",
  },
  row: {
    display: "flex",
    gap: 16,
    padding: 16,
    minWidth: "min-content",
    height: "100vh",
    justifyContent: "center",
  },
  card: {
    position: "relative",
    aspectRatio: "9 / 16",
    height: "calc(100vh - 32px)",
    flexShrink: 0,
    background: "#F4F4F4",
    border: "2px solid #000",
    overflow: "hidden",
    display: "flex",
    cursor: "pointer",
  },
  playOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0, 0, 0, 0.18)",
    backdropFilter: "blur(2px)",
    pointerEvents: "none",
  },
  playButton: {
    width: 76,
    height: 76,
    borderRadius: 999,
    background: "rgba(0, 0, 0, 0.78)",
    color: "#FFFFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 28,
    paddingLeft: 6,
    boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
  },
};
