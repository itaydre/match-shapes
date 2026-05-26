// @refresh reset
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ShapeRenderer,
  SHAPE_BUILDERS,
  type ShapeFamily,
  type RevealOverrides,
} from "./showcaseShapes";

// AnimTunerLab — dial the gallery reveal (ANIM_STYLES[0], the classic
// bouncy burst) live: speed, pace/stagger, explosiveness and the
// slow-mo tail. A few representative shapes play the SAME tuned reveal
// so you see how it reads across shape types. The JSON readout is the
// RevealOverrides to bake into ANIM_STYLES[0].

const SIZE = 520;
const FPS = 30;

// Defaults = the current gallery reveal (ANIM_STYLES[0]).
const DEF = { speed: 0.42, pace: 1.1, boom: 3.4, tail: 1 };

// Representative shape mix so the reveal is judged across types.
const PREVIEW: ShapeFamily[] = [
  "radial_burst",
  "confetti_burst",
  "burst_segments",
  "fragmented_burst",
];
const PALETTE = ["#006847", "#FFFFFF", "#CE1126"]; // Mexico

const stringSeed = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) & 0x7fffffff;
  return h;
};

const Card: React.FC<{
  family: ShapeFamily;
  overrides: RevealOverrides;
  token: number;
}> = ({ family, overrides, token }) => {
  const [frame, setFrame] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(performance.now());

  // Replay whenever the token bumps (slider change or replay button).
  useEffect(() => {
    startRef.current = performance.now();
    setFrame(0);
    let cancelled = false;
    const tick = (now: number) => {
      if (cancelled) return;
      const elapsed = now - startRef.current;
      setFrame((elapsed / 1000) * FPS);
      if (elapsed > 9000) return;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [token]);

  const { cells, focal } = useMemo(() => {
    try {
      return SHAPE_BUILDERS[family](stringSeed(family), SIZE, PALETTE);
    } catch {
      return { cells: [], focal: { x: 0, y: 0 } };
    }
  }, [family]);

  return (
    <div style={styles.card}>
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
          playToken={token}
          autoPlay={false}
          revealOverrides={overrides}
        />
      </svg>
      <div style={styles.cardLabel}>{family.replace(/_/g, " ").toUpperCase()}</div>
    </div>
  );
};

const Slider: React.FC<{
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}> = ({ label, hint, min, max, step, value, onChange }) => (
  <div style={styles.sliderBlock}>
    <div style={styles.sliderHead}>
      <span style={styles.sliderLabel}>{label}</span>
      <span style={styles.sliderValue}>{value.toFixed(2)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={styles.range}
    />
    <div style={styles.sliderHint}>{hint}</div>
  </div>
);

export const AnimTunerLab: React.FC = () => {
  const [speed, setSpeed] = useState(DEF.speed);
  const [pace, setPace] = useState(DEF.pace);
  const [boom, setBoom] = useState(DEF.boom);
  const [tail, setTail] = useState(DEF.tail);
  const [token, setToken] = useState(0);

  const overrides: RevealOverrides = useMemo(
    () => ({
      ease: `back.out(${boom.toFixed(2)})`,
      forceMode: "burst",
      staggerSec: pace,
      cellDurationSec: speed,
      staggerFrom: "center",
      staggerPower: tail,
    }),
    [speed, pace, boom, tail],
  );

  // Auto-replay on any change so tuning is immediate.
  useEffect(() => {
    setToken((t) => t + 1);
  }, [overrides]);

  return (
    <div style={styles.page}>
      <aside style={styles.panel}>
        <h1 style={styles.title}>Animation Tuner</h1>
        <p style={styles.sub}>
          Dial the gallery reveal (classic bouncy burst). Changes replay
          automatically; the JSON below is what to bake into ANIM_STYLES[0].
        </p>
        <Slider label="Speed" hint="per-cell duration — lower = faster" min={0.12} max={1.4} step={0.01} value={speed} onChange={setSpeed} />
        <Slider label="Pace / stagger" hint="window cells fire across — lower = more together" min={0.2} max={3.5} step={0.05} value={pace} onChange={setPace} />
        <Slider label="Explosiveness" hint="back-out overshoot — higher = more violent pop" min={0.5} max={6} step={0.1} value={boom} onChange={setBoom} />
        <Slider label="Slow-mo tail" hint="≥1 fires the core first, drags the rim in slow" min={1} max={5} step={0.1} value={tail} onChange={setTail} />

        <div style={styles.btnRow}>
          <button style={styles.replay} onClick={() => setToken((t) => t + 1)}>replay</button>
          <button style={styles.reset} onClick={() => { setSpeed(DEF.speed); setPace(DEF.pace); setBoom(DEF.boom); setTail(DEF.tail); }}>reset to gallery</button>
        </div>

        <pre style={styles.json}>{JSON.stringify(overrides, null, 2)}</pre>
      </aside>

      <main style={styles.stage}>
        <div style={styles.grid}>
          {PREVIEW.map((f) => (
            <Card key={f} family={f} overrides={overrides} token={token} />
          ))}
        </div>
      </main>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: { display: "flex", minHeight: "100vh", background: "#161616", fontFamily: "ui-sans-serif, system-ui, sans-serif" },
  panel: { width: 340, flexShrink: 0, padding: "26px 22px", background: "#0e0e0e", color: "#eee", borderRight: "1px solid #262626", overflowY: "auto" },
  title: { fontSize: 22, fontWeight: 800, margin: "0 0 6px" },
  sub: { fontSize: 12.5, lineHeight: 1.5, color: "#9a9a9a", margin: "0 0 22px" },
  sliderBlock: { marginBottom: 20 },
  sliderHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 },
  sliderLabel: { fontWeight: 700, fontSize: 14 },
  sliderValue: { fontVariantNumeric: "tabular-nums", fontSize: 13, color: "#cfcfcf" },
  range: { width: "100%" },
  sliderHint: { fontSize: 11, color: "#777", marginTop: 3 },
  btnRow: { display: "flex", gap: 8, marginTop: 6 },
  replay: { flex: 1, background: "#1769FF", color: "#fff", border: "none", borderRadius: 6, padding: "9px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  reset: { flex: 1, background: "#222", color: "#ccc", border: "1px solid #333", borderRadius: 6, padding: "9px 0", fontSize: 12, cursor: "pointer" },
  json: { marginTop: 20, background: "#1b1b1b", border: "1px solid #2a2a2a", borderRadius: 6, padding: 12, fontSize: 11.5, color: "#b8d0ff", whiteSpace: "pre-wrap", fontFamily: "ui-monospace, monospace" },
  stage: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 28, overflow: "auto" },
  grid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(220px, 320px))", gap: 18 },
  card: { position: "relative", aspectRatio: "1 / 1", background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.5)" },
  cardLabel: { position: "absolute", bottom: 8, left: 10, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: "rgba(0,0,0,0.6)" },
};
