// @refresh reset
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ShapeRenderer,
  type Cell,
  type RevealOverrides,
} from "../playground/showcaseShapes";

const TAU = Math.PI * 2;
const SIZE = 720;

type Mode = "burst" | "fade" | "grow";
type StaggerFrom = "start" | "center" | "edges" | "random";

const DEFAULTS = {
  wedges: 28,
  innerRFrac: 0,
  outerRFactor: 0.55,
  background: "#0A0A0A",
  noSpin: true,
  mode: "burst" as Mode,
  staggerFrom: "start" as StaggerFrom,
  staggerSec: 0.3,
  cellDurationSec: 0.9,
  palette: ["#FEDD00", "#009C3B", "#002776", "#FFFFFF", "#000000"],
};

const buildWedges = (opts: {
  wedges: number;
  innerRFrac: number;
  outerRFactor: number;
  palette: string[];
  noSpin: boolean;
}): { cells: Cell[]; focal: { x: number; y: number } } => {
  const cells: Cell[] = [];
  const outerR = Math.hypot(SIZE, SIZE) * opts.outerRFactor;
  const innerR = SIZE * opts.innerRFrac;
  for (let i = 0; i < opts.wedges; i++) {
    const a0 = (i / opts.wedges) * TAU;
    const a1 = ((i + 1) / opts.wedges) * TAU;
    const aMid = (a0 + a1) / 2;
    const rMid = (innerR + outerR) / 2;
    const color = opts.palette[i % opts.palette.length] ?? "#FFFFFF";
    cells.push({
      kind: "wedge",
      cx: Math.cos(aMid) * rMid,
      cy: Math.sin(aMid) * rMid,
      innerR,
      outerR,
      startA: a0,
      endA: a1,
      color,
      // Sweep ordering — but RevealOverrides.staggerFrom can swap to
      // center/edges/random without touching the cells themselves.
      revealOrder: i / opts.wedges,
      birthOrigin: { x: 0, y: 0 },
      noSpin: opts.noSpin,
    });
  }
  return { cells, focal: { x: 0, y: 0 } };
};

const REVEAL_FRAMES = 94; // generous warmup so first paint = end state

const SunburstWedgesEditor: React.FC = () => {
  const [wedges, setWedges] = useState(DEFAULTS.wedges);
  const [innerRFrac, setInnerRFrac] = useState(DEFAULTS.innerRFrac);
  const [outerRFactor, setOuterRFactor] = useState(DEFAULTS.outerRFactor);
  const [background, setBackground] = useState(DEFAULTS.background);
  const [noSpin, setNoSpin] = useState(DEFAULTS.noSpin);
  const [mode, setMode] = useState<Mode>(DEFAULTS.mode);
  const [staggerFrom, setStaggerFrom] = useState<StaggerFrom>(
    DEFAULTS.staggerFrom,
  );
  const [staggerSec, setStaggerSec] = useState(DEFAULTS.staggerSec);
  const [cellDurationSec, setCellDurationSec] = useState(
    DEFAULTS.cellDurationSec,
  );
  const [palette, setPalette] = useState<string[]>(DEFAULTS.palette);

  // rAF playhead — keeps wrap animations ticking even though
  // SUNBURST_WEDGES doesn't use one. Click canvas / replay bumps
  // playToken to re-fire the reveal timeline.
  const [frame, setFrame] = useState(REVEAL_FRAMES);
  const [playToken, setPlayToken] = useState(0);
  const startRef = useRef<number>(performance.now() - (REVEAL_FRAMES / 30) * 1000);
  useEffect(() => {
    let cancelled = false;
    const tick = (now: number) => {
      if (cancelled) return;
      setFrame(((now - startRef.current) / 1000) * 30);
      requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, []);

  // Any prop change replays the reveal so the canvas reflects the
  // new value immediately — feels live without needing a button.
  useEffect(() => {
    startRef.current = performance.now();
    setFrame(0);
    setPlayToken((t) => t + 1);
  }, [
    wedges,
    innerRFrac,
    outerRFactor,
    noSpin,
    mode,
    staggerFrom,
    staggerSec,
    cellDurationSec,
    palette,
  ]);

  const { cells, focal } = useMemo(
    () => buildWedges({ wedges, innerRFrac, outerRFactor, palette, noSpin }),
    [wedges, innerRFrac, outerRFactor, palette, noSpin],
  );

  // Memoised — ShapeRenderer's effect lists revealOverrides in its
  // deps, so a new object every render would kill + restart the
  // GSAP tweens on every rAF tick (animation never completes).
  const overrides = useMemo<RevealOverrides>(
    () => ({ forceMode: mode, staggerFrom, staggerSec, cellDurationSec }),
    [mode, staggerFrom, staggerSec, cellDurationSec],
  );

  const replay = () => {
    startRef.current = performance.now();
    setFrame(0);
    setPlayToken((t) => t + 1);
  };

  const copySettings = () => {
    const cfg = {
      wedges,
      innerRFrac,
      outerRFactor,
      noSpin,
      mode,
      staggerFrom,
      staggerSec,
      cellDurationSec,
      palette,
    };
    navigator.clipboard?.writeText(JSON.stringify(cfg, null, 2));
  };

  return (
    <div style={s.page}>
      <header style={s.header}>
        <span style={s.title}>SUNBURST WEDGES · EDITOR</span>
        <span style={s.subtitle}>Edit props live — click canvas to replay</span>
      </header>

      <div style={s.body}>
        <div
          style={{ ...s.stage, background }}
          onClick={replay}
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
              playToken={playToken}
              revealOverrides={overrides}
            />
          </svg>
        </div>

        <aside style={s.controls}>
          <Slider
            label="Wedges"
            value={wedges}
            min={3}
            max={80}
            step={1}
            onChange={setWedges}
          />
          <Slider
            label="Inner radius (% of size)"
            value={innerRFrac}
            min={0}
            max={0.45}
            step={0.005}
            onChange={setInnerRFrac}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <Slider
            label="Outer reach"
            value={outerRFactor}
            min={0.3}
            max={1.0}
            step={0.01}
            onChange={setOuterRFactor}
            format={(v) => v.toFixed(2)}
          />

          <Group label="Reveal mode">
            <Radio
              name="mode"
              value="burst"
              current={mode}
              onChange={setMode}
              hint="Back-out scale from focal"
            />
            <Radio
              name="mode"
              value="fade"
              current={mode}
              onChange={setMode}
              hint="Pop in place"
            />
            <Radio
              name="mode"
              value="grow"
              current={mode}
              onChange={setMode}
              hint="Smooth ease-out"
            />
          </Group>

          <Group label="Stagger from">
            <Radio
              name="staggerFrom"
              value="start"
              current={staggerFrom}
              onChange={setStaggerFrom}
              hint="Sweep clockwise"
            />
            <Radio
              name="staggerFrom"
              value="center"
              current={staggerFrom}
              onChange={setStaggerFrom}
              hint="Centre wedges first"
            />
            <Radio
              name="staggerFrom"
              value="edges"
              current={staggerFrom}
              onChange={setStaggerFrom}
              hint="Outer wedges first"
            />
            <Radio
              name="staggerFrom"
              value="random"
              current={staggerFrom}
              onChange={setStaggerFrom}
              hint="Scattered"
            />
          </Group>

          <Slider
            label="Stagger window (s)"
            value={staggerSec}
            min={0}
            max={3}
            step={0.05}
            onChange={setStaggerSec}
            format={(v) => v.toFixed(2)}
          />
          <Slider
            label="Per-cell duration (s)"
            value={cellDurationSec}
            min={0.1}
            max={2}
            step={0.05}
            onChange={setCellDurationSec}
            format={(v) => v.toFixed(2)}
          />

          <Group label="Options">
            <label style={s.row}>
              <input
                type="checkbox"
                checked={noSpin}
                onChange={(e) => setNoSpin(e.target.checked)}
              />
              <span style={s.rowLabel}>No spin</span>
            </label>
          </Group>

          <Group label="Palette">
            {palette.map((c, i) => (
              <label key={i} style={s.swatchRow}>
                <input
                  type="color"
                  value={c}
                  onChange={(e) => {
                    const next = [...palette];
                    next[i] = e.target.value;
                    setPalette(next);
                  }}
                  style={s.colorInput}
                />
                <span style={s.swatchHex}>{c.toUpperCase()}</span>
              </label>
            ))}
            <div style={s.paletteActions}>
              <button
                type="button"
                style={s.smallBtn}
                onClick={() => setPalette([...palette, "#888888"])}
                disabled={palette.length >= 10}
              >
                +
              </button>
              <button
                type="button"
                style={s.smallBtn}
                onClick={() => setPalette(palette.slice(0, -1))}
                disabled={palette.length <= 1}
              >
                −
              </button>
            </div>
          </Group>

          <Group label="Background">
            <label style={s.swatchRow}>
              <input
                type="color"
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                style={s.colorInput}
              />
              <span style={s.swatchHex}>{background.toUpperCase()}</span>
            </label>
          </Group>

          <div style={s.btnRow}>
            <button type="button" style={s.btn} onClick={replay}>
              Replay
            </button>
            <button type="button" style={s.btn} onClick={copySettings}>
              Copy JSON
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};

const Slider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}> = ({ label, value, min, max, step, onChange, format }) => (
  <div style={s.field}>
    <div style={s.fieldHead}>
      <span style={s.fieldLabel}>{label}</span>
      <span style={s.fieldValue}>{format ? format(value) : value}</span>
    </div>
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(parseFloat(e.target.value))}
    />
  </div>
);

const Group: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div style={s.field}>
    <div style={s.fieldHead}>
      <span style={s.fieldLabel}>{label}</span>
    </div>
    <div style={s.groupBody}>{children}</div>
  </div>
);

const Radio = <T extends string>({
  name,
  value,
  current,
  onChange,
  hint,
}: {
  name: string;
  value: T;
  current: T;
  onChange: (v: T) => void;
  hint?: string;
}) => (
  <label style={s.row}>
    <input
      type="radio"
      name={name}
      checked={current === value}
      onChange={() => onChange(value)}
    />
    <span style={s.rowLabel}>{value}</span>
    {hint && <span style={s.rowHint}>{hint}</span>}
  </label>
);

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "24px 32px 64px",
    background: "#000",
    color: "#FFF",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 24,
  },
  title: { fontSize: 14, fontWeight: 800, letterSpacing: 4 },
  subtitle: {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.55)",
  },
  body: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 320px",
    gap: 24,
    alignItems: "start",
  },
  stage: {
    aspectRatio: "1 / 1",
    border: "1px solid rgba(255,255,255,0.08)",
    cursor: "pointer",
    overflow: "hidden",
  },
  controls: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    padding: 18,
    background: "#0A0A0A",
    border: "1px solid rgba(255,255,255,0.08)",
    position: "sticky",
    top: 24,
    maxHeight: "calc(100vh - 48px)",
    overflowY: "auto",
  },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.85)",
  },
  fieldValue: {
    fontSize: 11,
    fontFamily: "ui-monospace, monospace",
    color: "rgba(255,255,255,0.6)",
  },
  groupBody: { display: "flex", flexDirection: "column", gap: 4 },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    cursor: "pointer",
  },
  rowLabel: { color: "rgba(255,255,255,0.85)" },
  rowHint: {
    marginLeft: "auto",
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
  },
  swatchRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 11,
    fontFamily: "ui-monospace, monospace",
    color: "rgba(255,255,255,0.7)",
  },
  swatchHex: {},
  colorInput: {
    width: 28,
    height: 22,
    padding: 0,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "transparent",
    cursor: "pointer",
  },
  paletteActions: { display: "flex", gap: 6, marginTop: 4 },
  smallBtn: {
    width: 28,
    height: 24,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "transparent",
    color: "#FFF",
    cursor: "pointer",
    fontSize: 14,
    lineHeight: 1,
  },
  btnRow: { display: "flex", gap: 8, marginTop: 6 },
  btn: {
    flex: 1,
    padding: "10px 12px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "transparent",
    color: "#FFF",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
};

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(err: Error) {
    return { error: err };
  }
  render() {
    if (this.state.error) {
      return (
        <pre
          style={{
            padding: 24,
            background: "#220000",
            color: "#FF8888",
            fontFamily: "ui-monospace, monospace",
            fontSize: 13,
            whiteSpace: "pre-wrap",
            minHeight: "100vh",
            margin: 0,
          }}
        >
          {`Sunburst Wedges Editor error:\n\n${this.state.error.message}\n\n${this.state.error.stack ?? ""}`}
        </pre>
      );
    }
    return this.props.children as React.ReactElement;
  }
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <ErrorBoundary>
    <SunburstWedgesEditor />
  </ErrorBoundary>,
);
