import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ShapeRenderer,
  SHAPE_BUILDERS,
  SHAPE_FAMILIES,
  type ShapeFamily,
} from "./showcaseShapes";

// Seek-bridge verification. Renders ONE shape two ways:
//   LEFT  — live: ShapeRenderer plays its GSAP master timeline in real
//           time (the existing behaviour).
//   RIGHT — deterministic: the SAME ShapeRenderer driven ONLY by a
//           `seekTime` (seconds) from the slider — no rAF, no play().
// If the right matches the left's motion when you scrub / hit play, the
// GSAP-seek bridge reproduces the reveal frame-for-frame, which is the
// whole prerequisite for rendering the animation server-side in Node.

const FPS = 30; // timing constants in showcaseShapes are authored at 30fps
const SIZE = 460;
const HALF = SIZE / 2;
const MAX_SEC = 5; // covers the full reveal (~3.1s) + ripple/vortex tail
const PALETTE = ["#1B53C0", "#E8442B", "#EFEFEF"];

const Stage: React.FC<{ children: React.ReactNode; label: string }> = ({
  children,
  label,
}) => (
  <div style={styles.stage}>
    <div style={styles.stageLabel}>{label}</div>
    <svg
      viewBox={`${-HALF} ${-HALF} ${SIZE} ${SIZE}`}
      width={SIZE}
      height={SIZE}
      style={styles.svg}
    >
      {children}
    </svg>
  </div>
);

export const SeekTestLab: React.FC = () => {
  const [family, setFamily] = useState<ShapeFamily>("vortex_disc");
  const [seed, setSeed] = useState(7);
  const [seekSec, setSeekSec] = useState(0);
  const [scrubPlaying, setScrubPlaying] = useState(false);
  const [livePlayToken, setLivePlayToken] = useState(1);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);

  const built = useMemo(() => {
    const builder = SHAPE_BUILDERS[family];
    return builder(seed, SIZE, PALETTE);
  }, [family, seed]);

  // Drive the deterministic stage by repeatedly SEEKING (advancing
  // seekSec via rAF). This proves seek alone can animate — the server
  // renderer does the same, just stepping a fixed dt per frame instead
  // of wall-clock.
  useEffect(() => {
    if (!scrubPlaying) return;
    startRef.current = performance.now() - seekSec * 1000;
    const tick = () => {
      const t = (performance.now() - startRef.current) / 1000;
      if (t >= MAX_SEC) {
        setSeekSec(MAX_SEC);
        setScrubPlaying(false);
        return;
      }
      setSeekSec(t);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrubPlaying]);

  const replayBoth = () => {
    setLivePlayToken((t) => t + 1);
    setSeekSec(0);
    setScrubPlaying(true);
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>GSAP Seek-Bridge Test</h1>
        <p style={styles.sub}>
          Live (real-time play) vs Deterministic (seek-only). Scrub or
          replay — the right stage is driven purely by <code>seekTime</code>,
          the mechanism the Node renderer will use.
        </p>
        <div style={styles.controls}>
          <label style={styles.ctrl}>
            shape&nbsp;
            <select
              value={family}
              onChange={(e) => setFamily(e.target.value as ShapeFamily)}
            >
              {SHAPE_FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.ctrl}>
            seed&nbsp;
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(parseInt(e.target.value || "0", 10))}
              style={{ width: 60 }}
            />
          </label>
          <button style={styles.btn} onClick={replayBoth}>
            ▶ Replay both
          </button>
        </div>
        <div style={styles.scrubRow}>
          <span style={styles.scrubLabel}>seek</span>
          <input
            type="range"
            min={0}
            max={MAX_SEC}
            step={1 / FPS}
            value={seekSec}
            onChange={(e) => {
              setScrubPlaying(false);
              setSeekSec(parseFloat(e.target.value));
            }}
            style={{ flex: 1 }}
          />
          <span style={styles.scrubValue}>
            {seekSec.toFixed(2)}s · f{Math.round(seekSec * FPS)}
          </span>
        </div>
      </header>

      <div style={styles.stages}>
        <Stage label="LIVE — real-time play()">
          <ShapeRenderer
            key={`live-${family}-${seed}`}
            cells={built.cells}
            focal={built.focal}
            localFrame={9999}
            wrapAnimation={built.wrapAnimation}
            playToken={livePlayToken}
            autoPlay
          />
        </Stage>
        <Stage label="DETERMINISTIC — seek() only">
          <ShapeRenderer
            key={`seek-${family}-${seed}`}
            cells={built.cells}
            focal={built.focal}
            localFrame={Math.round(seekSec * FPS)}
            wrapAnimation={built.wrapAnimation}
            seekTime={seekSec}
          />
        </Stage>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0f0f0f",
    color: "#eee",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
    padding: 28,
  },
  header: { maxWidth: 1000, margin: "0 auto 24px" },
  title: { fontSize: 22, fontWeight: 800, margin: "0 0 6px" },
  sub: { fontSize: 13, color: "#9a9a9a", lineHeight: 1.5, margin: "0 0 16px" },
  controls: { display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" },
  ctrl: { fontSize: 13, color: "#ccc" },
  btn: {
    padding: "7px 14px",
    background: "#1B53C0",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
  },
  scrubRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
  },
  scrubLabel: { width: 36, fontSize: 13, color: "#999" },
  scrubValue: {
    width: 110,
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    fontSize: 13,
    color: "#cfcfcf",
  },
  stages: {
    display: "flex",
    gap: 24,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  stage: { textAlign: "center" },
  stageLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#777",
    marginBottom: 8,
  },
  svg: { background: "#fff", borderRadius: 8 },
};
