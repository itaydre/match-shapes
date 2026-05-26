// @refresh reset
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ShapeRenderer,
  SHAPE_BUILDERS,
  SHAPE_FAMILIES,
  type ShapeFamily,
} from "./showcaseShapes";
import { ANIM_STYLES } from "./StaticPreviewV3";

// AllShapesAnimLab — every shape family rendered once, all sharing ONE
// selected reveal animation (from the ANIM_STYLES pool). Cards sit
// static at their final frame; click any card to replay it with the
// selected animation. Default = "classic bouncy burst" (style 0).

const SIZE = 520;
const REVEAL_FRAMES = 70 + 24; // STAGGER_TOTAL + PER_CELL
const FPS = 30;

// Human labels for the ANIM_STYLES pool (index-aligned).
const STYLE_LABELS = [
  "classic bouncy burst",
  "fast clean grow",
  "snappy fade",
  "soft fade explosion",
  "confident back-out",
  "shockwave",
  "detonation",
  "center bang",
];

const PALETTES: string[][] = [
  ["#006847", "#FFFFFF", "#CE1126"], // Mexico
  ["#C8102E", "#EFEFEF", "#012169"], // England
  ["#009C3B", "#FEDD00", "#002776"], // Brazil
  ["#000000", "#DD0000", "#FFCE00"], // Germany
];

const stringSeed = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) & 0x7fffffff;
  return h;
};

const Card: React.FC<{
  family: ShapeFamily;
  index: number;
  palette: string[];
  styleIdx: number;
}> = ({ family, index, palette, styleIdx }) => {
  const [frame, setFrame] = useState<number>(REVEAL_FRAMES);
  const [playToken, setPlayToken] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);

  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    const tick = (now: number) => {
      if (cancelled) return;
      const elapsed = now - startRef.current;
      setFrame((elapsed / 1000) * FPS);
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
    };
  }, [playing]);

  const replay = () => {
    startRef.current = performance.now();
    setFrame(0);
    setPlayToken((t) => t + 1);
    setPlaying(true);
  };

  const { cells, focal } = useMemo(() => {
    try {
      return SHAPE_BUILDERS[family](stringSeed(family), SIZE, palette);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`[AllShapesAnim] ${family} threw:`, e);
      return { cells: [], focal: { x: 0, y: 0 } };
    }
  }, [family, palette]);

  return (
    <div style={styles.card} onClick={replay} role="button" tabIndex={0}>
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
          revealOverrides={ANIM_STYLES[styleIdx]}
        />
      </svg>
      <div style={styles.badge}>{index}</div>
      <div style={styles.footer}>
        <span style={styles.family}>{family.replace(/_/g, " ").toUpperCase()}</span>
      </div>
    </div>
  );
};

export const AllShapesAnimLab: React.FC = () => {
  const [styleIdx, setStyleIdx] = useState(0); // classic bouncy burst
  const [salt, setSalt] = useState(0); // bump to replay all

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <span style={styles.title}>ALL SHAPES · ONE REVEAL — click any card to play</span>
        <div style={styles.controls}>
          <select
            value={styleIdx}
            onChange={(e) => setStyleIdx(Number(e.target.value))}
            style={styles.select}
          >
            {ANIM_STYLES.map((_, i) => (
              <option key={i} value={i}>
                {i} · {STYLE_LABELS[i] ?? `style ${i}`}
              </option>
            ))}
          </select>
          <button style={styles.replayAll} onClick={() => setSalt((s) => s + 1)}>
            replay all
          </button>
        </div>
      </div>
      <div className="shape-grid" style={styles.grid}>
        {SHAPE_FAMILIES.map((family, i) => (
          <Card
            key={`${family}-${salt}`}
            family={family}
            index={i + 1}
            palette={PALETTES[i % PALETTES.length]!}
            styleIdx={styleIdx}
          />
        ))}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#FFFFFF", color: "#0A0A0A", padding: "28px 28px 64px" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    gap: 16,
    flexWrap: "wrap",
  },
  title: { fontSize: 13, fontWeight: 800, letterSpacing: 3 },
  controls: { display: "flex", gap: 10, alignItems: "center" },
  select: {
    fontSize: 13,
    fontWeight: 600,
    padding: "7px 10px",
    border: "1px solid rgba(0,0,0,0.2)",
    borderRadius: 6,
    background: "#fff",
  },
  replayAll: {
    background: "#1769FF",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "8px 14px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  grid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 },
  card: {
    position: "relative",
    aspectRatio: "1 / 1",
    background: "#F5F5F5",
    border: "1px solid rgba(0,0,0,0.08)",
    cursor: "pointer",
    overflow: "hidden",
  },
  badge: {
    position: "absolute",
    top: 10,
    left: 12,
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(0,0,0,0.8)",
    background: "rgba(255,255,255,0.8)",
    borderRadius: 4,
    padding: "2px 7px",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: "8px 12px",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.5,
    color: "rgba(0,0,0,0.7)",
    background: "linear-gradient(180deg, rgba(245,245,245,0), rgba(245,245,245,0.9))",
    pointerEvents: "none",
  },
  family: {},
};
