// @refresh reset
import React, { useEffect, useMemo, useRef, useState } from "react";
import { GAMES, type Game } from "./GameGallery";
import {
  ShapeRenderer,
  SHAPE_BUILDERS,
  SHAPE_FAMILIES,
  type ShapeFamily,
} from "./showcaseShapes";
import type { StaticPreviewTeam } from "./StaticPreview";

// MatchShowcase — a single fixture rendered as a grid of
// showcase-style cards. Each card paints ONE goal as a generative
// shape on black, cycling through the 13 showcase families and
// colouring with the scoring team's flag palette. No team-name
// chrome, no score numerals, no tricolor bars — just shapes, like
// /shape-showcase.html, but driven by a real match.

const FOCUS_GAME_ID = "wc18-final-fr-cr";

const REVEAL_FRAMES = 70 + 24; // matches the showcase reveal window

const isLightHex = (hex: string) => {
  const h = hex.replace("#", "");
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return r * 0.2126 + g * 0.7152 + b * 0.0722 > 205;
};

const paletteForTeam = (t: StaticPreviewTeam): string[] => {
  // On a black background, prefer the *non-pale* flag colour as the
  // dominant ink so the shape reads as the team without disappearing.
  const lightPrimary = isLightHex(t.flagPrimary);
  const dominant = lightPrimary ? t.flagAccent : t.flagPrimary;
  const cols: string[] = [dominant];
  for (const c of [t.flagSecondary, t.flagAccent, t.flagPrimary]) {
    if (cols.indexOf(c) === -1) cols.push(c);
  }
  if (cols.indexOf("#FFFFFF") === -1) cols.push("#FFFFFF");
  return cols;
};

const stringSeed = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) & 0x7fffffff;
  }
  return h;
};

export const MatchShowcase: React.FC = () => {
  const game: Game | undefined = GAMES.find((g) => g.id === FOCUS_GAME_ID);
  if (!game) {
    return (
      <div style={styles.missing}>
        <div style={styles.missingTitle}>No match found</div>
        <div style={styles.missingHint}>
          FOCUS_GAME_ID is "{FOCUS_GAME_ID}".
        </div>
      </div>
    );
  }
  const homeScore = game.goals.filter((g) => g.team === "home").length;
  const awayScore = game.goals.filter((g) => g.team === "away").length;
  const sortedGoals = [...game.goals].sort((a, b) => a.minute - b.minute);
  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <span style={styles.titleStrong}>
          {game.home.name.toUpperCase()}
        </span>
        <span style={styles.score}>
          {homeScore} – {awayScore}
        </span>
        <span style={styles.titleStrong}>
          {game.away.name.toUpperCase()}
        </span>
      </div>
      <div style={styles.subheader}>
        <span>{game.competition.toUpperCase()}</span>
        <span>{game.venueAndDate.toUpperCase()}</span>
      </div>
      <div style={styles.grid}>
        {sortedGoals.map((g, idx) => {
          const family = SHAPE_FAMILIES[idx % SHAPE_FAMILIES.length]!;
          const team = g.team === "home" ? game.home : game.away;
          const palette = paletteForTeam(team);
          const seed = stringSeed(`${game.id}:${g.id}:${family}`);
          return (
            <GoalCard
              key={g.id}
              family={family}
              seed={seed}
              palette={palette}
              scorer={g.scorer}
              minute={g.minute}
              teamLabel={team.name}
              isHome={g.team === "home"}
            />
          );
        })}
      </div>
    </div>
  );
};

const GoalCard: React.FC<{
  family: ShapeFamily;
  seed: number;
  palette: string[];
  scorer: string;
  minute: number;
  teamLabel: string;
  isHome: boolean;
}> = ({ family, seed, palette, scorer, minute, teamLabel, isHome }) => {
  const [frame, setFrame] = useState<number>(REVEAL_FRAMES);
  const [playToken, setPlayToken] = useState(0);
  const rafRef = useRef<number | null>(null);
  const animatingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      animatingRef.current = false;
    };
  }, []);

  const handleReplay = () => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    const start = performance.now();
    setFrame(0);
    setPlayToken((t) => t + 1);
    const tick = (now: number) => {
      const f = ((now - start) / 1000) * 30;
      if (f >= REVEAL_FRAMES * 2) {
        // Hold open past reveal so the wrap animations (3D rotation,
        // wave ripple) get to keep ticking for a few seconds before
        // settling. After 2× the reveal window we stop scheduling
        // rAFs but leave the final state painted.
        setFrame(REVEAL_FRAMES * 2);
        animatingRef.current = false;
        rafRef.current = null;
        return;
      }
      setFrame(f);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const SIZE = 520;
  const { cells, focal, wrapAnimation } = useMemo(() => {
    try {
      return SHAPE_BUILDERS[family](seed, SIZE, palette);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`[MatchShowcase] builder ${family} threw:`, e);
      return { cells: [], focal: { x: 0, y: 0 }, wrapAnimation: undefined };
    }
  }, [family, seed, palette]);

  return (
    <div
      style={styles.card}
      onClick={handleReplay}
      role="button"
      tabIndex={0}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`-${SIZE / 2} -${SIZE / 2} ${SIZE} ${SIZE}`}
        width="100%"
        height="100%"
        style={{ display: "block" }}
      >
        <ShapeRenderer
          cells={cells}
          focal={focal}
          localFrame={frame}
          wrapAnimation={wrapAnimation}
          playToken={playToken}
        />
      </svg>
      <div style={styles.cardFooter}>
        <div style={styles.minuteRow}>
          <span style={styles.minute}>'{minute}</span>
          <span style={styles.scorerName}>{scorer}</span>
        </div>
        <div style={styles.metaRow}>
          <span style={styles.familyLabel}>
            {family.replace(/_/g, " ").toUpperCase()}
          </span>
          <span style={styles.teamTag}>
            {isHome ? "H" : "A"} · {teamLabel.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    width: "100%",
    background: "#000000",
    color: "#FFFFFF",
    fontFamily:
      'Inter, "Roboto Flex", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    padding: "40px 32px 64px",
    boxSizing: "border-box",
    overflowY: "auto",
  },
  header: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 28,
    marginBottom: 8,
    letterSpacing: 3,
  },
  titleStrong: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: 4,
  },
  score: {
    fontSize: 30,
    fontWeight: 900,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.92)",
  },
  subheader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: 3,
    marginBottom: 32,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 20,
  },
  card: {
    position: "relative",
    aspectRatio: "1 / 1",
    background: "#0A0A0A",
    border: "1px solid rgba(255,255,255,0.06)",
    cursor: "pointer",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  cardFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: "14px 16px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    background:
      "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.78) 60%)",
    pointerEvents: "none",
  },
  minuteRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 12,
  },
  minute: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: 1,
    fontVariantNumeric: "tabular-nums",
    color: "rgba(255,255,255,0.92)",
  },
  scorerName: {
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: 2,
  },
  metaRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 10,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.5)",
  },
  familyLabel: {
    fontWeight: 700,
  },
  teamTag: {
    fontWeight: 600,
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
