import React, { useEffect, useRef, useState } from "react";
import { GAMES, type Game } from "./GameGallery";
import { StaticPreviewV2 } from "./StaticPreviewV2";

// MatchFocusV2 — alternative focused-match surface that uses
// StaticPreviewV2 (same chrome as the original MatchFocus card:
// midfield timeline, possession, event markers, label well, scorer
// labels) but renders each goal via the focusShapesV2 geometric
// language instead of the cellGrid pipeline.
//
// The original MatchFocus / StaticPreview chain stays untouched so the
// two surfaces can be opened side-by-side at /match-focus.html and
// /match-focus-v2.html.

const FOCUS_GAME_ID = "wc18-final-fr-cr";

const TOTAL_FRAMES = 270;
const END_FRAME = TOTAL_FRAMES - 1;
const KICKOFF_END = 15;
const MATCH_END = 180;
const minuteToTriggerFrame = (m: number) =>
  KICKOFF_END +
  Math.max(0, Math.min(1, m / 90)) * (MATCH_END - KICKOFF_END);

export const MatchFocusV2: React.FC = () => {
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
      <FocusedCardV2 game={game} />
    </div>
  );
};

const FocusedCardV2: React.FC<{ game: Game }> = ({ game }) => {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const frameRef = useRef(frame);
  frameRef.current = frame;

  // ── Audio refs — same crowd-loop + per-goal yell + final whistle as
  //    the GalleryCard wrapper, so the V2 surface plays identically.
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
      <StaticPreviewV2
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
        // No central well — matches the original MatchFocus / GalleryCard
        // which renders full goal discs with no hole punched out.
        showLabelWell={false}
        // Pin every goal to ring_compression — evaluating this one
        // shape across the whole fixture before mixing in the others.
        familyForGoal={() => "ring_compression"}
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
