// @refresh reset
// ↑ Forces React Fast Refresh to do a full component reset (instead of
// trying to preserve state) on every edit of this file. Animation
// timers + rAF lifecycles are notoriously fragile under partial Fast
// Refresh; a clean reset costs a one-frame replay but eliminates the
// "page goes blank after edit" failure mode.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ShapeRenderer,
  SHAPE_BUILDERS,
  SHAPE_FAMILIES,
  SHAPE_CATEGORIES,
  type ShapeFamily,
} from "./showcaseShapes";

// ShapeShowcase — black-background lab page laying out the six
// reference-driven generative shapes in a 3×2 grid. Each card paints
// one shape with the gallery's per-cell stagger + back-out scale-from-
// focal reveal. Click any card to replay its animation.

// Curated team palettes pulled from the GameGallery flag set. Each is
// a small (3-5 colour) set sufficient for the multi-colour shapes;
// single-colour shapes pick palette[0]. Colours come from the actual
// flag/kit, no stylisation.
const TEAM_PALETTES: Array<{ name: string; colors: string[] }> = [
  // Strictly the colours found on each national flag. No padding,
  // no derived shades, no neutral defaults. Variable length per team;
  // shape builders cycle via `palette[i % palette.length]`.
  { name: "Brazil",       colors: ["#FEDD00", "#009C3B", "#002776", "#FFFFFF"] },
  { name: "France",       colors: ["#0055A4", "#EF4135", "#FFFFFF"] },
  { name: "Argentina",    colors: ["#75AADB", "#F6B40E", "#FFFFFF"] },
  { name: "Croatia",      colors: ["#FF0000", "#171796", "#FFFFFF"] },
  { name: "Spain",        colors: ["#AA151B", "#F1BF00"] },
  { name: "Germany",      colors: ["#000000", "#DD0000", "#FFCE00"] },
  { name: "Netherlands",  colors: ["#AE1C28", "#FFFFFF", "#21468B"] },
  { name: "Portugal",     colors: ["#046A38", "#DA291C", "#FFE600", "#FFFFFF"] },
  { name: "Japan",        colors: ["#BC002D", "#FFFFFF"] },
  { name: "Morocco",      colors: ["#C1272D", "#006233"] },
  { name: "England",      colors: ["#CE1124", "#FFFFFF", "#012169"] },
  { name: "South Korea",  colors: ["#CD2E3A", "#0047A0", "#000000", "#FFFFFF"] },
  { name: "Italy",        colors: ["#008C45", "#FFFFFF", "#CD212A"] },
];

// Deterministic 0..n-1 from a string — used to seed palette picks +
// the shape seed so the same shape/family + load produces the same
// look, but each shape gets a different team.
const stringSeed = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) & 0x7fffffff;
  }
  return h;
};

const REVEAL_FRAMES = 70 + 24; // STAGGER_TOTAL + PER_CELL

export const ShapeShowcase: React.FC = () => {
  // One random session salt per mount → palette picks rotate each
  // page load while staying stable within a session. Click-to-replay
  // doesn't re-roll palettes (use a hard refresh for that).
  const sessionSalt = useMemo(
    () => Math.floor(Math.random() * 1e9).toString(36),
    [],
  );

  const cards = useMemo(() => {
    // Shuffle palettes deterministically per session so the six
    // families end up with different teams each load.
    const order = [...TEAM_PALETTES];
    const rnd = stringSeed(sessionSalt) || 1;
    let h = rnd;
    for (let i = order.length - 1; i > 0; i--) {
      h = (h * 1664525 + 1013904223) & 0x7fffffff;
      const j = h % (i + 1);
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    // Keyed by family so each shape keeps its global SHAPE_FAMILIES
    // number + palette regardless of which category section it renders in.
    const byFamily = new Map<
      ShapeFamily,
      { palette: (typeof TEAM_PALETTES)[number]; seed: number; index: number }
    >();
    SHAPE_FAMILIES.forEach((family, idx) => {
      byFamily.set(family, {
        palette: order[idx % order.length]!,
        seed: stringSeed(`${sessionSalt}:${family}`),
        index: idx + 1,
      });
    });
    return byFamily;
  }, [sessionSalt]);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <span style={styles.title}>SHAPE LAB · GALLERY REVEAL</span>
        <span style={styles.subtitle}>Click any card to replay</span>
      </div>
      {SHAPE_CATEGORIES.map((cat) => (
        <div key={cat.name} style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionTitle}>{cat.name.toUpperCase()}</span>
            <span style={styles.sectionCount}>{cat.families.length}</span>
          </div>
          <div className="shape-grid" style={styles.grid}>
            {cat.families.map((family) => {
              const card = cards.get(family);
              if (!card) return null;
              return (
                <ShapeCard
                  key={family}
                  index={card.index}
                  family={family}
                  seed={card.seed}
                  palette={card.palette.colors}
                  teamName={card.palette.name}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

// Per-card error boundary so a single broken builder doesn't take the
// whole grid down. The card paints a red placeholder with the error
// message instead.
class CardErrorBoundary extends React.Component<
  { children: React.ReactNode; family: string },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(err: Error) {
    return { error: err };
  }
  componentDidCatch(err: Error) {
    // eslint-disable-next-line no-console
    console.error(`[ShapeShowcase] ${this.props.family} crashed:`, err);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={styles.cardError}>
          <div style={styles.cardErrorTitle}>
            {this.props.family.replace(/_/g, " ").toUpperCase()}
          </div>
          <div style={styles.cardErrorMsg}>{this.state.error.message}</div>
        </div>
      );
    }
    return this.props.children as React.ReactElement;
  }
}

const ShapeCard: React.FC<{
  index: number;
  family: ShapeFamily;
  seed: number;
  palette: string[];
  teamName: string;
}> = ({ index, family, seed, palette, teamName }) => {
  // Cards render STATIC on page load (final revealed frame, no rAF,
  // no GSAP reveal) so a full grid doesn't animate at once. The rAF
  // only runs while `playing` is true — started by a click — and
  // auto-stops after a few seconds to release the loop.
  const [frame, setFrame] = useState<number>(REVEAL_FRAMES);
  const [playToken, setPlayToken] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  // rAF only runs while playing. Auto-stops after 12s so continuous
  // wrap animations don't burn CPU forever after a single click.
  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    const tick = (now: number) => {
      if (cancelled) return;
      const elapsed = now - startRef.current;
      setFrame((elapsed / 1000) * 30);
      if (elapsed > 12000) {
        setPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing]);

  const handleReplay = () => {
    // Start (or restart) playback: rewind the playhead and bump
    // playToken so the GSAP reveal re-fires.
    startRef.current = performance.now();
    setFrame(0);
    setPlayToken((t) => t + 1);
    setPlaying(true);
  };

  const SIZE = 520;
  const { cells, focal } = useMemo(() => {
    try {
      return SHAPE_BUILDERS[family](seed, SIZE, palette);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`[ShapeShowcase] builder ${family} threw:`, e);
      return { cells: [], focal: { x: 0, y: 0 } };
    }
  }, [family, seed, palette]);

  return (
    <CardErrorBoundary family={family}>
      <div
        style={styles.card}
        onClick={handleReplay}
        role="button"
        tabIndex={0}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          // Pad the viewBox out beyond the shape's own size so every
          // shape sits inset from the card edges with breathing room.
          viewBox={`-${SIZE / 2 + SIZE * 0.12} -${SIZE / 2 + SIZE * 0.12} ${SIZE * 1.24} ${SIZE * 1.24}`}
          width="100%"
          height="100%"
          style={{ display: "block" }}
        >
          <ShapeRenderer cells={cells} focal={focal} localFrame={frame} playToken={playToken} autoPlay={false} />
        </svg>
        <div style={styles.numberBadge}>{index}</div>
        <div style={styles.cardFooter}>
          <span style={styles.familyLabel}>
            {index}. {family.replace(/_/g, " ").toUpperCase()}
          </span>
          <span style={styles.teamLabel}>{teamName.toUpperCase()}</span>
        </div>
      </div>
    </CardErrorBoundary>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    width: "100%",
    background: "#FFFFFF",
    color: "#0A0A0A",
    fontFamily:
      '"Inter", "Roboto Flex", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    padding: "32px 32px 64px",
    boxSizing: "border-box",
    overflowY: "auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 32,
    letterSpacing: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: 3,
    color: "rgba(0,0,0,0.5)",
  },
  grid: {
    display: "grid",
  },
  section: {
    marginBottom: 44,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "baseline",
    gap: 10,
    marginBottom: 16,
    paddingBottom: 8,
    borderBottom: "1px solid rgba(0,0,0,0.14)",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 3,
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(0,0,0,0.4)",
  },
  card: {
    position: "relative",
    aspectRatio: "1 / 1",
    background: "#F5F5F5",
    border: "1px solid rgba(0,0,0,0.08)",
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
    padding: "10px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 11,
    letterSpacing: 2,
    color: "rgba(0,0,0,0.75)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.8) 100%)",
    pointerEvents: "none",
  },
  numberBadge: {
    position: "absolute",
    top: 10,
    left: 12,
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 1,
    color: "rgba(0,0,0,0.85)",
    background: "rgba(255,255,255,0.78)",
    borderRadius: 4,
    padding: "2px 7px",
    pointerEvents: "none",
  },
  familyLabel: {
    fontWeight: 800,
  },
  teamLabel: {
    fontWeight: 500,
    color: "rgba(0,0,0,0.5)",
  },
  cardError: {
    aspectRatio: "1 / 1",
    background: "#1A0707",
    border: "1px solid #5A1A1A",
    padding: 16,
    color: "#FF8888",
    fontFamily: "ui-monospace, monospace",
    fontSize: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    overflow: "auto",
  },
  cardErrorTitle: {
    fontWeight: 800,
    letterSpacing: 2,
    color: "#FFB0B0",
  },
  cardErrorMsg: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
};
