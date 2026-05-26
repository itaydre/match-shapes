// @refresh reset
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  GAMES,
  MATCH_CONTEXTS,
  DEFAULT_MATCH_CONTEXT,
  type Game,
} from "./GameGallery";
import { StaticPreviewV3 } from "./StaticPreviewV3";
import { computeGoalImportance } from "../src/lib/goalImportance";
import { SHAPE_FAMILIES, type ShapeFamily } from "./showcaseShapes";

// Deterministic per-game shuffle of SHAPE_FAMILIES — each game id
// hashes to a stable starting offset and stride so the 8 visible
// fixtures collectively tour ALL 20 showcase families instead of
// every card showing the same first-5 cycle.
const stringSeed = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) & 0x7fffffff;
  }
  return h;
};
// Seeded RNG (LCG) — stable per match id, distinct between matches.
const seededRand = (seed: number) => {
  let h = seed || 1;
  return () => {
    h = (h * 1664525 + 1013904223) & 0x7fffffff;
    return h / 0x7fffffff;
  };
};

// Fully shuffled permutation of every shape family, seeded by the
// match id. Each match gets its own random ordering (stable across
// reloads) so two fixtures never march through the families the same
// way — the source of per-match variety.
const familiesForGame = (gameId: string): ShapeFamily[] => {
  const rand = seededRand(stringSeed(gameId));
  const order = [...SHAPE_FAMILIES];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
};

// Coarse "family group" — used to keep two visually-similar shapes
// (e.g. two vortex-disc variants, or two mandalas) from landing on
// consecutive goals in the same match.
const familyGroup = (f: ShapeFamily): string => {
  // lens_mandala is the cyclone spiral now — visually distinct from
  // the concentric mandalas, so it gets its own group and is fine to
  // show next to a radial shape.
  if (f === "lens_mandala") return "lens";
  // All the radial swirl / wheel / mandala shapes read alike. Group
  // them as one "radial" bucket so two never land on consecutive
  // goals (e.g. no vortex right after a mandala).
  if (
    f.startsWith("vortex_disc") ||
    f === "polar_vortex" ||
    f === "polar_swirl" ||
    f === "interference_mandala" ||
    f === "shatter_mandala" ||
    f === "mandala_curves" ||
    f === "crown_dial" ||
    f === "basket_vortex" ||
    f === "radial_checker" ||
    f === "swirl_checker" ||
    f === "shard_vortex" ||
    f === "collapsed_quadrant" ||
    f === "checker_spiral" ||
    f === "checker_tunnel" ||
    f === "ring_spiral" ||
    f === "pixel_swirl" ||
    f === "solar_flare" ||
    f === "tactical_scan" ||
    f === "spiral_tunnel" ||
    f === "chip_storm"
  ) {
    return "radial";
  }
  if (f.includes("ribbon")) return "ribbon";
  if (f.includes("arcs")) return "arcs";
  if (f.includes("burst")) return "burst";
  if (f.includes("pixel")) return "pixel";
  if (f.startsWith("sphere")) return "sphere";
  return f;
};

// Per-match goal-id → ShapeFamily overrides. When a match id has an
// entry here, those goals render with the exact shapes specified,
// bypassing the shuffle. (Empty by default — every match shuffles.)
const SHAPE_OVERRIDES: Record<string, Record<string, ShapeFamily>> = {};

// Build a goal-id → shape-family map for one match. Walks the match's
// shuffled family permutation, assigning each goal (in chronological
// order) the next family that (a) hasn't been used yet in this match
// and (b) isn't in the same visual group as the previous goal — so
// every goal reads as a genuinely different shape: ribbon → a vortex
// variant → mandala → … in a fresh random order each fixture.
const buildFamilyMap = (
  game: Game,
  importanceById: Map<string, number>,
): Map<string, ShapeFamily> => {
  void importanceById;
  const override = SHAPE_OVERRIDES[game.id];
  if (override) {
    const map = new Map<string, ShapeFamily>();
    for (const g of game.goals) {
      const fam = override[g.id];
      if (fam) map.set(g.id, fam);
    }
    if (map.size === game.goals.length) return map;
  }

  const sorted = [...game.goals].sort((a, b) => a.minute - b.minute);
  if (sorted.length === 0) return new Map();

  const shuffled = familiesForGame(game.id);
  const map = new Map<string, ShapeFamily>();
  const used = new Set<ShapeFamily>();
  let cursor = 0;
  let prevGroup = "";

  for (const g of sorted) {
    let pick: ShapeFamily | null = null;
    // Scan the shuffled list from the cursor for the next unused
    // family in a different group than the previous goal.
    for (let scan = 0; scan < shuffled.length; scan++) {
      const cand = shuffled[(cursor + scan) % shuffled.length]!;
      if (used.has(cand)) continue;
      // Never put two consecutive goals in the same category.
      if (familyGroup(cand) === prevGroup) continue;
      pick = cand;
      cursor = (cursor + scan + 1) % shuffled.length;
      break;
    }
    if (!pick) {
      // Every unused family shares the previous goal's category. Keep the
      // category different anyway by reusing a family from another
      // category; only repeat a category as an absolute last resort.
      pick =
        shuffled.find((f) => familyGroup(f) !== prevGroup) ??
        shuffled.find((f) => !used.has(f)) ??
        shuffled[cursor % shuffled.length]!;
      cursor = (cursor + 1) % shuffled.length;
    }
    used.add(pick);
    prevGroup = familyGroup(pick);
    map.set(g.id, pick);
  }
  return map;
};

// GameGalleryV2 — single-card focused viewer for showcase shapes.
// Shows ONE fixture at a time, with arrow nav between games and
// mute toggles for the crowd loop and per-goal commentary yells.

const TOTAL_FRAMES = 270;
const END_FRAME = TOTAL_FRAMES - 1;
const KICKOFF_END = 15;
const MATCH_END = 180;
const minuteToTriggerFrame = (m: number) =>
  KICKOFF_END +
  Math.max(0, Math.min(1, m / 90)) * (MATCH_END - KICKOFF_END);

export const GameGalleryV2: React.FC = () => {
  const visibleGames = useMemo(
    () => GAMES.filter((g) => !g.id.startsWith("example-")),
    [],
  );
  const [idx, setIdx] = useState(0);
  const [muteCrowd, setMuteCrowd] = useState(false);
  const [muteGoals, setMuteGoals] = useState(false);
  // Bubble the active card's frame + playing state up here so the
  // HUD can sit on the dark stage outside the white card artboard.
  const [liveFrame, setLiveFrame] = useState(0);
  const [livePlaying, setLivePlaying] = useState(true);
  const game = visibleGames[idx] ?? visibleGames[0]!;

  const prev = () =>
    setIdx((i) => (i - 1 + visibleGames.length) % visibleGames.length);
  const next = () => setIdx((i) => (i + 1) % visibleGames.length);

  // Keyboard nav — left/right arrows step through fixtures.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleGames.length]);

  return (
    <div style={styles.shell}>
      <div style={styles.header}>
        <div style={styles.counter}>
          {String(idx + 1).padStart(2, "0")}
          <span style={styles.counterTotal}>
            /{String(visibleGames.length).padStart(2, "0")}
          </span>
        </div>
        <div style={styles.muteRow}>
          <MuteToggle
            label="CROWD"
            active={!muteCrowd}
            onToggle={() => setMuteCrowd((v) => !v)}
          />
          <MuteToggle
            label="GOAL YELL"
            active={!muteGoals}
            onToggle={() => setMuteGoals((v) => !v)}
          />
        </div>
      </div>

      <div style={styles.stage}>
        <button
          aria-label="Previous match"
          style={{ ...styles.arrow, left: 24 }}
          onClick={prev}
        >
          ‹
        </button>

        <GalleryCardV2
          key={game.id}
          game={game}
          muteCrowd={muteCrowd}
          muteGoals={muteGoals}
          onFrameChange={setLiveFrame}
          onPlayingChange={setLivePlaying}
        />

        <button
          aria-label="Next match"
          style={{ ...styles.arrow, right: 24 }}
          onClick={next}
        >
          ›
        </button>

        {/* Frame HUD — outside the card, anchored to the stage so
            it doesn't sit on the artboard. */}
        <div style={styles.debugHud}>
          <span>frame {Math.floor(liveFrame)}/{END_FRAME}</span>
          <span style={{ marginLeft: 12, opacity: livePlaying ? 1 : 0.4 }}>
            {livePlaying ? "● playing" : "○ paused"}
          </span>
        </div>
      </div>
    </div>
  );
};

const MuteToggle: React.FC<{
  label: string;
  active: boolean;
  onToggle: () => void;
}> = ({ label, active, onToggle }) => (
  <button
    style={{
      ...styles.muteButton,
      background: active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.08)",
      color: active ? "#0E0E0E" : "rgba(255,255,255,0.55)",
      borderColor: active
        ? "rgba(255,255,255,0.9)"
        : "rgba(255,255,255,0.14)",
    }}
    onClick={onToggle}
    aria-pressed={active}
  >
    <span style={styles.muteDot}>{active ? "●" : "○"}</span>
    {label}
  </button>
);

const GalleryCardV2: React.FC<{
  game: Game;
  muteCrowd: boolean;
  muteGoals: boolean;
  onFrameChange?: (f: number) => void;
  onPlayingChange?: (p: boolean) => void;
}> = ({ game, muteCrowd, muteGoals, onFrameChange, onPlayingChange }) => {
  // Auto-play from kick-off whenever a card mounts so each goal's
  // GSAP timeline fires WHEN that goal happens (as its triggerFrame
  // is crossed), not all-at-once on initial paint. Navigating
  // between matches re-mounts the card → fresh frame-0 playback.
  const [frame, setFrame] = useState<number>(0);
  const [playing, setPlaying] = useState(true);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  // Bubble frame / playing state up to the parent on every change
  // so the HUD outside the card stays in sync.
  useEffect(() => {
    onFrameChange?.(frame);
  }, [frame, onFrameChange]);
  useEffect(() => {
    onPlayingChange?.(playing);
  }, [playing, onPlayingChange]);
  const rafRef = useRef<number | null>(null);
  const animatingRef = useRef(false);

  const crowdRef = useRef<HTMLAudioElement | null>(null);
  const goalsFiredRef = useRef<Set<string>>(new Set());
  const whistleFiredRef = useRef(false);

  // Importance per goal — same rules engine as the original gallery.
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

  // Hero-aware family mapping. Top-importance goal in this match
  // gets a curated dramatic shape; every other goal pulls from the
  // per-game pool with that hero family excluded — guarantees the
  // hero goal reads as visually distinct without disturbing the
  // emotional-importance scoring.
  const familyByGoal = useMemo(
    () => buildFamilyMap(game, importanceById),
    [game, importanceById],
  );

  // Crowd track — created once per mount, volume gated by muteCrowd.
  useEffect(() => {
    const crowd = new Audio("/audio/crowd.mp3");
    crowd.loop = true;
    crowd.volume = muteCrowd ? 0 : 0.9;
    crowdRef.current = crowd;
    return () => {
      crowd.pause();
      crowd.src = "";
    };
    // muteCrowd intentionally not in deps — the volume update lives
    // in its own effect below so toggling doesn't recreate the Audio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live-update crowd volume when the mute toggle flips.
  useEffect(() => {
    const c = crowdRef.current;
    if (!c) return;
    c.volume = muteCrowd ? 0 : 0.9;
  }, [muteCrowd]);

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
        if (!muteGoals) {
          const scorerTeam = g.team === "home" ? game.home : game.away;
          const lang = scorerTeam.goalLang ?? "en";
          const GOAL_AUDIO_PATHS: Record<string, string> = {
            br: "/audio/goal-br.wav",
            ko: "/audio/goal-ko.wav",
            jp: "/audio/goal-jp.wav",
            fa: "/audio/goal-fa.wav",
            "es-ar": "/audio/goal-es-ar.wav",
            // New commentator tracks (May 2026 batch)
            "ar-sa": "/audio/goal-ar-sa.wav",
            hr: "/audio/goal-hr.wav",
            nl: "/audio/goal-nl.wav",
            pt: "/audio/goal-pt.wav",
            "nl-be": "/audio/goal-nl-be.wav",
            "de-at": "/audio/goal-de-at.wav",
            uz: "/audio/goal-uz.wav",
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
          a.volume = 0.7;
          a.play().catch(() => {});
        }
        goalsFiredRef.current.add(g.id);
      }
    }
    if (!whistleFiredRef.current && frame >= MATCH_END) {
      if (!muteCrowd) {
        const a = new Audio("/audio/whistle.mp3");
        a.volume = 0.45;
        a.play().catch(() => {});
      }
      whistleFiredRef.current = true;
    }
  }, [frame, playing, game.goals, game.home, game.away, muteGoals, muteCrowd]);

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
        familyForGoal={(g, rank) => {
          // Hero goal → curated dramatic family; everyone else →
          // the per-game pool (hero excluded). Falls back to the
          // raw rank rotation if the map is missing the id.
          const mapped = familyByGoal.get(g.id);
          if (mapped) return mapped;
          const families = familiesForGame(game.id);
          return families[rank % families.length]!;
        }}
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
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 24px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    flexShrink: 0,
  },
  counter: {
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    fontWeight: 800,
    fontSize: 14,
    letterSpacing: 3,
    color: "#FFFFFF",
    fontVariantNumeric: "tabular-nums",
  },
  counterTotal: {
    color: "rgba(255,255,255,0.4)",
    fontWeight: 500,
    marginLeft: 4,
  },
  muteRow: {
    display: "flex",
    gap: 10,
  },
  muteButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    height: 32,
    padding: "0 14px",
    border: "1px solid",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: 2,
    cursor: "pointer",
    background: "transparent",
    transition: "background 120ms ease, color 120ms ease",
  },
  muteDot: {
    fontSize: 10,
  },
  stage: {
    position: "relative",
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    minHeight: 0,
  },
  card: {
    position: "relative",
    aspectRatio: "9 / 16",
    height: "calc(100vh - 96px)",
    maxHeight: "calc(100vh - 96px)",
    flexShrink: 0,
    background: "#F4F4F4",
    border: "2px solid #000",
    overflow: "hidden",
    display: "flex",
    cursor: "pointer",
  },
  arrow: {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: 300,
    lineHeight: 1,
    paddingBottom: 4,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 120ms ease",
    zIndex: 5,
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
  debugHud: {
    position: "absolute",
    bottom: 16,
    left: 24,
    padding: "6px 12px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "#FFFFFF",
    fontFamily: "ui-monospace, monospace",
    fontSize: 11,
    letterSpacing: 1,
    pointerEvents: "none",
    zIndex: 6,
  },
};
