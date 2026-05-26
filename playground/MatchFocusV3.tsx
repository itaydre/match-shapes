// @refresh reset
import React, { useEffect, useMemo, useRef, useState } from "react";
import { GAMES, type Game } from "./GameGallery";
import { StaticPreviewV3 } from "./StaticPreviewV3";
import {
  computeGoalImportance,
  type MatchContext,
} from "../src/lib/goalImportance";
import type { ShapeFamily } from "./showcaseShapes";

// Curated 6-family rotation for the focused fixture — one family
// per goal in chronological order. Picked from the 13 showcase
// families so each goal of the 2018 WC Final tours a distinct
// generative language without the off-brand options leaking in.
const FOCUS_FAMILIES: ShapeFamily[] = [
  "vortex_disc",
  "pixel_bloom",
  "radial_checker",
  "fragmented_burst",
  "halftone_arc",
  "warped_checker",
];

// Per-fixture emotional context. The focused match is the 2018 WC
// Final, so the only entry that matters is `wc18-final-fr-cr`; any
// other game id falls back to the default. (Mirrors what GalleryCard
// does inside GameGallery, scoped to the V3 surface.)
const MATCH_CONTEXTS: Record<string, MatchContext> = {
  "wc18-final-fr-cr": {
    stage: "final",
    homeStrength: 88,
    awayStrength: 72,
    rivalry: 35,
  },
};
const DEFAULT_MATCH_CONTEXT: MatchContext = {
  stage: "group",
  homeStrength: 70,
  awayStrength: 70,
  rivalry: 30,
};

// MatchFocusV3 — focused-match surface that uses the
// showcase-shape-system (the 13 generative families from
// shape-showcase.html) to render each goal. Cycles through families
// per goal so the fixture reads as a tour of the language.

const FOCUS_GAME_ID = "wc18-final-fr-cr";

const TOTAL_FRAMES = 270;
const END_FRAME = TOTAL_FRAMES - 1;
const KICKOFF_END = 15;
const MATCH_END = 180;
const minuteToTriggerFrame = (m: number) =>
  KICKOFF_END +
  Math.max(0, Math.min(1, m / 90)) * (MATCH_END - KICKOFF_END);

export const MatchFocusV3: React.FC = () => {
  const game: Game | undefined = GAMES.find((g) => g.id === FOCUS_GAME_ID);
  if (!game) {
    return (
      <div style={styles.missing}>
        <div style={styles.missingTitle}>No match found</div>
        <div style={styles.missingHint}>
          FOCUS_GAME_ID is set to "{FOCUS_GAME_ID}" — no fixture with that id
          exists in GAMES.
        </div>
      </div>
    );
  }
  return (
    <div style={styles.shell}>
      <FocusedCardV3 game={game} />
    </div>
  );
};

const FocusedCardV3: React.FC<{ game: Game }> = ({ game }) => {
  const [frame, setFrame] = useState<number>(END_FRAME);
  const [playing, setPlaying] = useState(false);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const rafRef = useRef<number | null>(null);
  const animatingRef = useRef(false);

  // Per-goal emotional importance — computed once per fixture using
  // the rules engine (stage × expectedness × scoreChange × rivalry
  // × lateness). Passed to StaticPreviewV3 to drive shape sizing
  // and score-numeral bump magnitude.
  const importanceById = useMemo(() => {
    const ctx = MATCH_CONTEXTS[game.id] ?? DEFAULT_MATCH_CONTEXT;
    const map = new Map<string, number>();
    for (const g of game.goals) {
      const b = computeGoalImportance(
        { id: g.id, team: g.team, minute: g.minute },
        game.goals.map((x) => ({ id: x.id, team: x.team, minute: x.minute })),
        ctx,
      );
      map.set(g.id, b.importance);
    }
    return map;
  }, [game.id, game.goals]);

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
    } else {
      c.pause();
    }
  }, [playing]);

  useEffect(() => {
    if (!playing) return;
    for (const g of game.goals) {
      if (goalsFiredRef.current.has(g.id)) continue;
      if (frame >= minuteToTriggerFrame(g.minute)) {
        const scorerTeam = g.team === "home" ? game.home : game.away;
        const lang = scorerTeam.goalLang ?? "en";
        const GOAL_AUDIO_PATHS: Record<string, string> = {
          // New commentator tracks (May 2026 batch)
          "ar-sa": "/audio/goal-ar-sa.wav",
          hr: "/audio/goal-hr.wav",
          nl: "/audio/goal-nl.wav",
          pt: "/audio/goal-pt.wav",
          "nl-be": "/audio/goal-nl-be.wav",
          "de-at": "/audio/goal-de-at.wav",
          uz: "/audio/goal-uz.wav",
          br: "/audio/goal-br.wav",
          ko: "/audio/goal-ko.wav",
          jp: "/audio/goal-jp.wav",
          fa: "/audio/goal-fa.wav",
          "es-ar": "/audio/goal-es-ar.wav",
          // Ecstatic batch
          en: "/audio/goal-en.wav",
          "ar-eg": "/audio/goal-ar-eg.wav",
          "ar-iq": "/audio/goal-ar-iq.wav",
          "ar-jo": "/audio/goal-ar-jo.wav",
          "ar-qa": "/audio/goal-ar-qa.wav",
          "ar-ma": "/audio/goal-ar-ma.wav",
          "en-ca": "/audio/goal-en-ca.wav",
          "en-jm": "/audio/goal-en-jm.wav",
          "en-sct": "/audio/goal-en-sct.wav",
          "ar-dz": "/audio/goal-ar-dz.wav",
        };
        const audioPath = GOAL_AUDIO_PATHS[lang] ?? `/audio/goal-${lang}.mp3`;
        const a = new Audio(audioPath);
        a.volume = 0;
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
  }, [frame, playing, game.goals, game.home, game.away]);

  useEffect(() => {
    if (!playing) {
      animatingRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    animatingRef.current = true;
    let last = performance.now();
    const tick = (now: number) => {
      if (!animatingRef.current) return;
      const dt = now - last;
      last = now;
      const next = frameRef.current + (dt / 1000) * 30;
      if (next >= END_FRAME) {
        setFrame(END_FRAME);
        setPlaying(false);
        return;
      }
      setFrame(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      animatingRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing]);

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
      <StaticPreviewV3
        goals={game.goals}
        frame={frame}
        home={game.home}
        away={game.away}
        competition={game.competition}
        venueAndDate={game.venueAndDate}
        finalHomePossession={game.finalHomePossession}
        events={game.events}
        kickoffEnd={KICKOFF_END}
        matchEnd={MATCH_END}
        showLabelWell={false}
        importanceById={importanceById}
        familyForGoal={(_g, rank) => FOCUS_FAMILIES[rank % FOCUS_FAMILIES.length]!}
      />
      {!playing && frame < END_FRAME && (
        <div style={styles.playOverlay}>
          <div style={styles.playButton}>▶</div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  shell: {
    background: "#0E0E0E",
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    overflow: "auto",
  },
  card: {
    position: "relative",
    width: "min(540px, 95vh * 0.5625)",
    aspectRatio: "1080 / 1920",
    cursor: "pointer",
    background: "#F4F4F4",
    boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
  },
  playOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(14,14,14,0.18)",
    pointerEvents: "none",
  },
  playButton: {
    width: 84,
    height: 84,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.92)",
    color: "#0E0E0E",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 38,
    paddingLeft: 6,
  },
  missing: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#220000",
    color: "#FF8888",
    fontFamily: "ui-monospace, monospace",
    gap: 12,
    padding: 24,
    textAlign: "center",
  },
  missingTitle: { fontSize: 20, fontWeight: 800 },
  missingHint: { fontSize: 13 },
};
