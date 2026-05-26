// @refresh reset
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ShapeRenderer,
  SHAPE_BUILDERS,
  SHAPE_FAMILIES,
  type ShapeFamily,
} from "./showcaseShapes";
import { ANIM_STYLES } from "./StaticPreviewV3";

// AnimStylesLab — renders ONE shape family eight times, each card using
// a different per-goal reveal style from ANIM_STYLES (the same pool the
// gallery hashes goals into). Lets you eyeball every reveal feel side
// by side on an identical shape. Pick a family up top; click any card
// (or "Replay all") to fire the reveals.

const PALETTE = ["#AA151B", "#F1BF00", "#0055A4", "#FFFFFF"]; // Spain+blue mix
const REVEAL_FRAMES = 70 + 24;
const SIZE = 460;

const STYLE_LABELS = [
  "classic bouncy burst",
  "fast clean grow",
  "snappy fade",
  "soft fade explosion",
  "confident back-out",
  "shockwave (slow-mo)",
  "detonation (slow-mo)",
  "center bang (slow-mo)",
];

export const AnimStylesLab: React.FC = () => {
  const [family, setFamily] = useState<ShapeFamily>("confetti_burst");
  // Bumping this token replays every card at once.
  const [allToken, setAllToken] = useState(0);

  const built = useMemo(() => {
    try {
      return SHAPE_BUILDERS[family](12345, SIZE, PALETTE);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`[AnimStylesLab] ${family} threw:`, e);
      return { cells: [], focal: { x: 0, y: 0 } };
    }
  }, [family]);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <span style={styles.title}>ANIM STYLES · ONE SHAPE, EIGHT REVEALS</span>
        <div style={styles.controls}>
          <select
            value={family}
            onChange={(e) => setFamily(e.target.value as ShapeFamily)}
            style={styles.select}
          >
            {SHAPE_FAMILIES.map((f) => (
              <option key={f} value={f}>
                {f.replace(/_/g, " ").toUpperCase()}
              </option>
            ))}
          </select>
          <button style={styles.btn} onClick={() => setAllToken((t) => t + 1)}>
            ▶ Replay all
          </button>
        </div>
      </div>
      <div className="anim-grid" style={styles.grid}>
        {ANIM_STYLES.map((style, i) => (
          <StyleCard
            key={i}
            index={i}
            cells={built.cells}
            focal={built.focal}
            overrides={style}
            allToken={allToken}
          />
        ))}
      </div>
    </div>
  );
};

const StyleCard: React.FC<{
  index: number;
  cells: ReturnType<(typeof SHAPE_BUILDERS)[ShapeFamily]>["cells"];
  focal: { x: number; y: number };
  overrides: (typeof ANIM_STYLES)[number];
  allToken: number;
}> = ({ index, cells, focal, overrides, allToken }) => {
  const [frame, setFrame] = useState<number>(REVEAL_FRAMES);
  const [playToken, setPlayToken] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  const play = () => {
    startRef.current = performance.now();
    setFrame(0);
    setPlayToken((t) => t + 1);
    setPlaying(true);
  };

  // Replay-all hook — fire whenever the parent token changes (skip 0).
  useEffect(() => {
    if (allToken === 0) return;
    play();
  }, [allToken]);

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

  return (
    <div style={styles.card} onClick={play} role="button" tabIndex={0}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`-${SIZE / 2 + SIZE * 0.12} -${SIZE / 2 + SIZE * 0.12} ${SIZE * 1.24} ${SIZE * 1.24}`}
        width="100%"
        height="100%"
        style={{ display: "block" }}
      >
        <ShapeRenderer
          cells={cells}
          focal={focal}
          localFrame={frame}
          playToken={playToken}
          autoPlay={false}
          revealOverrides={overrides}
        />
      </svg>
      <div style={styles.cardFooter}>
        <span style={styles.styleLabel}>
          {index} · {STYLE_LABELS[index]}
        </span>
        <span style={styles.styleMeta}>
          {overrides.forceMode} · {overrides.ease}
        </span>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    width: "100%",
    background: "#FFFFFF",
    color: "#0A0A0A",
    fontFamily:
      '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    padding: "32px 32px 64px",
    boxSizing: "border-box",
    overflowY: "auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
    gap: 16,
    flexWrap: "wrap",
  },
  title: { fontSize: 14, fontWeight: 800, letterSpacing: 4 },
  controls: { display: "flex", gap: 12, alignItems: "center" },
  select: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1,
    padding: "8px 12px",
    border: "1px solid rgba(0,0,0,0.2)",
    background: "#FFF",
    cursor: "pointer",
  },
  btn: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1,
    padding: "9px 16px",
    border: "none",
    background: "#0A0A0A",
    color: "#FFF",
    cursor: "pointer",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 20,
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
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    fontSize: 10,
    letterSpacing: 1,
    color: "rgba(0,0,0,0.75)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.88) 100%)",
    pointerEvents: "none",
  },
  styleLabel: { fontWeight: 800 },
  styleMeta: { fontWeight: 500, color: "rgba(0,0,0,0.5)" },
};
