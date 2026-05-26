// @refresh reset
// VariationsLab — demonstrates the two animation rules:
//   1. Each render picks a RANDOM focal point on the shape, so the bloom
//      erupts from a different spot every time (not the centre).
//   2. Each render varies its DENSITY (sparse / medium / full), so two
//      cards of the same family never look identical.
// The reveal loops continuously and every shape rotates. Click a card to
// re-roll its variation (new focal + density + spin).
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ShapeRenderer,
  SHAPE_BUILDERS,
  SHAPE_CATEGORIES,
  SHAPE_FAMILIES,
  applyShapeVariation,
  type ShapeFamily,
} from "./showcaseShapes";

const SIZE = 520;
const LOOP_FRAMES = 170; // reveal (~90f) + hold, then the loop restarts
const FPS = 30;

// Flag-ish palettes cycled across the grid for variety.
const PALETTES: string[][] = [
  ["#C8102E", "#EFEFEF", "#012169"],
  ["#009C3B", "#FEDD00", "#002776"],
  ["#0055A4", "#EFEFEF", "#EF4135"],
  ["#000000", "#DD0000", "#FFCE00"],
];

// Global index per family — matches the Shape Showcase numbering,
// which numbers by SHAPE_FAMILIES order (idx + 1), independent of
// which category section the card renders in.
const FAMILY_INDEX = new Map<ShapeFamily, number>(
  SHAPE_FAMILIES.map((fam, i) => [fam, i + 1]),
);

const Card: React.FC<{
  family: ShapeFamily;
  palette: string[];
  initialSeed: number;
  index: number;
}> = ({ family, palette, initialSeed, index }) => {
  const [seed, setSeed] = useState(initialSeed);
  const [frame, setFrame] = useState(0);
  const startRef = useRef(performance.now());
  const rafRef = useRef<number | null>(null);

  // Build the shape, then apply the variation — density modes + the
  // random inner focal (where the bloom erupts from within the shape).
  // The shape itself stays centred; only its INTERNAL randomisation
  // changes per render. Re-runs whenever the seed is re-rolled.
  const { cells, focal, spinDegPerSec } = useMemo(() => {
    try {
      const built = SHAPE_BUILDERS[family](seed, SIZE, palette);
      const v = applyShapeVariation(built, (seed ^ 0x9e3779b9) >>> 0);
      return {
        cells: v.cells,
        focal: v.focal,
        spinDegPerSec: v.spinDegPerSec,
      };
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`[VariationsLab] ${family} threw:`, e);
      return { cells: [], focal: { x: 0, y: 0 }, spinDegPerSec: 0 };
    }
  }, [family, palette, seed]);

  // Continuous looping reveal driven by wall-clock time.
  useEffect(() => {
    let cancelled = false;
    const tick = (now: number) => {
      if (cancelled) return;
      const elapsed = (now - startRef.current) / 1000;
      setFrame((elapsed * FPS) % LOOP_FRAMES);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const spinDeg = (spinDegPerSec * frame) / FPS;

  return (
    <div
      style={styles.card}
      onClick={() => {
        setSeed((s) => (s * 1664525 + 1013904223) >>> 0);
        startRef.current = performance.now();
      }}
      role="button"
      tabIndex={0}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`-${SIZE / 2 + SIZE * 0.14} -${SIZE / 2 + SIZE * 0.14} ${SIZE * 1.28} ${SIZE * 1.28}`}
        width="100%"
        height="100%"
        style={{ display: "block" }}
      >
        <g transform={`rotate(${spinDeg.toFixed(2)})`}>
          <ShapeRenderer
            cells={cells}
            focal={focal}
            localFrame={frame}
            playToken={0}
            autoPlay={false}
            breathing
          />
        </g>
        {/* Mark the inner focal the bloom erupts from. */}
        <circle cx={focal.x} cy={focal.y} r={6} fill="none" stroke="#7FB0FF" strokeWidth={2} />
      </svg>
      <div style={styles.footer}>
        <span style={styles.family}>
          {index}. {family.replace(/_/g, " ").toUpperCase()}
        </span>
        <span style={styles.meta}>{cells.length} cells</span>
      </div>
    </div>
  );
};

export const VariationsLab: React.FC = () => {
  const [salt, setSalt] = useState(1);
  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <span style={styles.title}>ANIMATION VARIATIONS · RANDOM FOCAL + DENSITY</span>
        <button style={styles.reroll} onClick={() => setSalt((s) => s + 1)}>
          re-roll all
        </button>
      </div>
      {SHAPE_CATEGORIES.map((cat) => (
        <div key={cat.name} style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionTitle}>{cat.name.toUpperCase()}</span>
            <span style={styles.sectionCount}>{cat.families.length}</span>
          </div>
          <div style={styles.grid}>
            {cat.families.map((family) => {
              const index = FAMILY_INDEX.get(family) ?? 0;
              return (
                <Card
                  key={`${family}-${salt}`}
                  family={family}
                  palette={PALETTES[index % PALETTES.length]!}
                  initialSeed={index * 2654435761 * salt}
                  index={index}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    background: "#0E0E0E",
    minHeight: "100vh",
    padding: "40px 32px 80px",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  title: {
    color: "#fff",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: "0.18em",
  },
  reroll: {
    background: "#2563EB",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "8px 14px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
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
    borderBottom: "1px solid rgba(255,255,255,0.16)",
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.18em",
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(255,255,255,0.4)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 20,
  },
  card: {
    background: "#fff",
    borderRadius: 8,
    overflow: "hidden",
    aspectRatio: "1 / 1",
    position: "relative",
    cursor: "pointer",
    boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    padding: "8px 12px",
    background: "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.9) 60%)",
    fontFamily: "ui-monospace, monospace",
  },
  family: { fontSize: 11, fontWeight: 700, color: "#111", letterSpacing: "0.08em" },
  meta: { fontSize: 10, color: "#666" },
};
