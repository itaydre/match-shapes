import React, { useMemo, useState } from "react";
import { Gallery } from "./Gallery";
import { TheatreStage } from "./TheatreStage";
import { BrazilSketchLab } from "./BrazilSketchLab";

// Visible runtime-error catcher — without this any throw inside a
// composition Player produces a totally blank page with no clue why.
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(err: Error) {
    return { error: err };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Playground error:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            background: "#FFF1F0",
            color: "#1a1a1a",
            fontFamily: "monospace",
            fontSize: 13,
            whiteSpace: "pre-wrap",
            height: "100%",
            overflow: "auto",
          }}
        >
          <strong style={{ color: "#B00020" }}>
            Error caught:
          </strong>
          {"\n\n"}
          {String(this.state.error?.message ?? this.state.error)}
          {"\n\n"}
          <span style={{ opacity: 0.7 }}>
            {this.state.error?.stack ?? ""}
          </span>
        </div>
      );
    }
    return this.props.children as React.ReactElement;
  }
}

type Mode = "designer" | "gallery" | "theatre" | "brazil";

const MODE_LABEL: Record<Mode, string> = {
  designer: "Shape Designer",
  gallery: "Compositions Gallery",
  theatre: "Theatre Stage",
  brazil: "Brazil Sketch Lab",
};

const ModeBar: React.FC<{
  mode: Mode;
  setMode: (m: Mode) => void;
}> = ({ mode, setMode }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "8px 12px",
      borderBottom: "1px solid #e2dfd7",
      background: "#FAF8F2",
      flexShrink: 0,
    }}
  >
    {(["designer", "gallery", "theatre", "brazil"] as const).map((m) => (
      <button
        key={m}
        onClick={() => setMode(m)}
        style={{
          padding: "5px 12px",
          fontSize: 12,
          border: "1px solid #0e0e0e",
          background: mode === m ? "#0e0e0e" : "#FFFFFF",
          color: mode === m ? "#FFFFFF" : "#0e0e0e",
          cursor: "pointer",
          borderRadius: 4,
        }}
      >
        {MODE_LABEL[m]}
      </button>
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Bloom Shape Designer
// ─────────────────────────────────────────────────────────────────────────────
// Library workflow: each shape is created and edited in isolation. Use the
// left panel to add / select shapes, the canvas to preview the selected
// shape on its own, and the right inspector to manipulate its parameters.
// "Export Library" copies all shape definitions as JSON ready to drop into
// the Remotion composition.

type ShapeStyle = "ripples" | "curves" | "combined" | "blob";

type Shape = {
  id: string;
  name: string;
  style: ShapeStyle;
  color: string;
  // 0..1 (fraction of canvas)
  radius: number;
  // Style-specific params — kept on every shape so switching style is loss-free
  rings: number;
  ringPow: number;
  stripes: number;
  ctrlScale: number;
  curveSamples: number;
  strokeBase: number;
  blobSeed: number;
};

const SIZE = 720;
const NEW_ID = () => Math.random().toString(36).slice(2, 9);

const PRESET_COLORS = [
  "#D5311E",
  "#1F35A6",
  "#0e0e0e",
  "#5418F4",
  "#009C3B",
  "#FFD100",
  "#FF6900",
  "#75AADB",
];

const STYLE_LABEL: Record<ShapeStyle, string> = {
  ripples: "Ripples",
  curves: "Curves (no ring)",
  combined: "Combined (curves + ring)",
  blob: "Organic blob",
};

const makeShape = (overrides: Partial<Shape> = {}): Shape => ({
  id: NEW_ID(),
  name: "Untitled",
  style: "combined",
  color: "#D5311E",
  radius: 0.42,
  rings: 22,
  ringPow: 1.25,
  stripes: 13,
  ctrlScale: 0.95,
  curveSamples: 36,
  strokeBase: 2.6,
  blobSeed: Math.floor(Math.random() * 1e6),
  ...overrides,
});

const DEFAULT_LIBRARY: Shape[] = [
  makeShape({ name: "Croatia ripple", style: "ripples", color: "#1F35A6", radius: 0.42 }),
  makeShape({
    name: "England curves",
    style: "combined",
    color: "#D5311E",
    radius: 0.42,
    stripes: 11,
    ctrlScale: 1.1,
  }),
];

// ─── Single-shape SVG renderer (no mutual distortion) ───────────────────────

const renderShape = (shape: Shape): React.ReactNode => {
  const fx = SIZE / 2;
  const fy = SIZE / 2;
  const rPx = shape.radius * SIZE;

  if (shape.style === "ripples") {
    const rings: React.ReactNode[] = [];
    for (let i = 1; i <= shape.rings; i++) {
      const t = i / shape.rings;
      const ringR = rPx * Math.pow(t, shape.ringPow);
      if (ringR < 1) continue;
      const sw = Math.max(1.2, shape.strokeBase + 1.6 - i * 0.1);
      rings.push(
        <circle
          key={i}
          cx={fx}
          cy={fy}
          r={ringR}
          fill="none"
          stroke={shape.color}
          strokeWidth={sw}
        />,
      );
    }
    return <g>{rings}</g>;
  }

  if (shape.style === "blob") {
    const N = 96;
    const pts: string[] = [];
    for (let k = 0; k <= N; k++) {
      const a = (k / N) * Math.PI * 2;
      const wob =
        Math.sin(a * 4 + shape.blobSeed * 0.013) * (rPx * 0.16) +
        Math.sin(a * 9 + shape.blobSeed * 0.019) * (rPx * 0.06) +
        Math.sin(a * 13 + shape.blobSeed * 0.023) * (rPx * 0.03);
      const r = rPx + wob;
      const px = fx + Math.cos(a) * r;
      const py = fy + Math.sin(a) * r;
      pts.push(`${k === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`);
    }
    pts.push("Z");
    return (
      <path
        d={pts.join(" ")}
        fill="none"
        stroke={shape.color}
        strokeWidth={shape.strokeBase + 0.4}
      />
    );
  }

  // curves / combined
  const buildCurve = (yOffset: number, ctrlMag: number, ctrlSign: number) => {
    const xL = fx - rPx * 1.7;
    const xR = fx + rPx * 1.7;
    const yC = fy + yOffset;
    const ctrlX = fx;
    const ctrlY = yC + ctrlMag * ctrlSign;
    let d = "";
    const N = shape.curveSamples;
    for (let k = 0; k <= N; k++) {
      const u = k / N;
      const bx = (1 - u) * (1 - u) * xL + 2 * (1 - u) * u * ctrlX + u * u * xR;
      const by = (1 - u) * (1 - u) * yC + 2 * (1 - u) * u * ctrlY + u * u * yC;
      d += `${k === 0 ? "M" : "L"} ${bx.toFixed(1)} ${by.toFixed(1)} `;
    }
    return d;
  };

  const stripes: React.ReactNode[] = [];
  const verticalRange = rPx * 1.15;
  for (let s = 0; s < shape.stripes; s++) {
    const t = s / Math.max(1, shape.stripes - 1);
    const yOffset = (t - 0.5) * verticalRange * 2;
    const ctrlMag = (Math.abs(t - 0.5) + 0.16) * rPx * shape.ctrlScale;
    const ctrlSign = (s % 2 === 0 ? -1 : 1) * (t < 0.5 ? -1 : 1);
    const sw = shape.strokeBase + Math.abs(t - 0.5) * 1.6;
    stripes.push(
      <path
        key={`s-${s}`}
        d={buildCurve(yOffset, ctrlMag, ctrlSign)}
        fill="none"
        stroke={shape.color}
        strokeWidth={sw}
        strokeLinecap="round"
      />,
    );
  }

  let ring: React.ReactNode = null;
  if (shape.style === "combined") {
    ring = (
      <circle
        cx={fx}
        cy={fy}
        r={rPx * 0.92}
        fill="none"
        stroke={shape.color}
        strokeWidth={shape.strokeBase}
      />
    );
  }

  return (
    <g>
      {ring}
      {stripes}
    </g>
  );
};

// ─── App ────────────────────────────────────────────────────────────────────

export const App: React.FC = () => {
  const [mode, setMode] = useState<Mode>("brazil");
  const [library, setLibrary] = useState<Shape[]>(DEFAULT_LIBRARY);
  const [selectedId, setSelectedId] = useState<string | null>(library[0]?.id ?? null);
  const [bg, setBg] = useState("#F1EEE7");

  if (mode === "gallery") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <ModeBar mode={mode} setMode={setMode} />
        <div style={{ flex: 1, minHeight: 0 }}>
          <ErrorBoundary>
            <Gallery />
          </ErrorBoundary>
        </div>
      </div>
    );
  }

  if (mode === "theatre") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <ModeBar mode={mode} setMode={setMode} />
        <div style={{ flex: 1, minHeight: 0 }}>
          <ErrorBoundary>
            <TheatreStage />
          </ErrorBoundary>
        </div>
      </div>
    );
  }

  if (mode === "brazil") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <ModeBar mode={mode} setMode={setMode} />
        <div style={{ flex: 1, minHeight: 0 }}>
          <ErrorBoundary>
            <BrazilSketchLab />
          </ErrorBoundary>
        </div>
      </div>
    );
  }

  const sel = library.find((s) => s.id === selectedId) ?? null;

  const updateSel = (patch: Partial<Shape>) => {
    if (!sel) return;
    setLibrary((prev) => prev.map((s) => (s.id === sel.id ? { ...s, ...patch } : s)));
  };

  const addShape = () => {
    const next = makeShape({ name: `Shape ${library.length + 1}` });
    setLibrary((prev) => [...prev, next]);
    setSelectedId(next.id);
  };

  const duplicateShape = () => {
    if (!sel) return;
    const dup = { ...sel, id: NEW_ID(), name: `${sel.name} copy` };
    setLibrary((prev) => [...prev, dup]);
    setSelectedId(dup.id);
  };

  const removeShape = (id: string) => {
    setLibrary((prev) => prev.filter((s) => s.id !== id));
    if (selectedId === id) {
      const remaining = library.filter((s) => s.id !== id);
      setSelectedId(remaining[0]?.id ?? null);
    }
  };

  const exportLibrary = () => {
    const out = library.map(({ id: _, ...rest }) => rest);
    const txt = JSON.stringify(out, null, 2);
    navigator.clipboard?.writeText(txt);
    alert("Copied library JSON to clipboard:\n\n" + txt);
  };

  const renderedShape = useMemo(() => (sel ? renderShape(sel) : null), [sel]);

  return (
    <div style={layout.root}>
      <ModeBar mode={mode} setMode={setMode} />
      <header style={layout.header}>
        <strong style={{ fontSize: 18 }}>Bloom Shape Designer</strong>
        <span style={{ opacity: 0.6, fontSize: 13 }}>
          One shape at a time · isolate, tune, save to library
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={exportLibrary} style={layout.buttonPrimary}>
            Export library
          </button>
        </div>
      </header>

      <div style={layout.body}>
        {/* ── Library list ─────────────────────────────────────────── */}
        <aside style={layout.library}>
          <div style={layout.libraryHead}>
            <span style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.6 }}>
              Library ({library.length})
            </span>
            <button onClick={addShape} style={layout.buttonSm}>+ New</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, overflow: "auto" }}>
            {library.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                style={{
                  ...layout.libraryItem,
                  outline: selectedId === s.id ? "2px solid #0e0e0e" : "1px solid #ddd",
                }}
              >
                <ShapeThumb shape={s} />
                <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {s.name}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>{STYLE_LABEL[s.style]}</div>
                </div>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    removeShape(s.id);
                  }}
                  style={layout.deleteX}
                  title="Delete"
                >
                  ×
                </span>
              </button>
            ))}
            {library.length === 0 && (
              <div style={{ fontSize: 13, opacity: 0.6, textAlign: "center", padding: 20 }}>
                No shapes yet — click + New to start.
              </div>
            )}
          </div>
        </aside>

        {/* ── Canvas (selected shape, isolated) ─────────────────────── */}
        <div style={layout.canvasWrap}>
          {sel ? (
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              style={{
                background: bg,
                borderRadius: 4,
                maxHeight: "calc(100vh - 100px)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              {renderedShape}
            </svg>
          ) : (
            <div style={{ fontSize: 14, opacity: 0.6 }}>
              Select a shape from the library or click + New.
            </div>
          )}
        </div>

        {/* ── Inspector (selected shape) ───────────────────────────── */}
        <aside style={layout.inspector}>
          {sel ? (
            <>
              <Section title="Identity">
                <Row>
                  <label style={layout.lbl}>Name</label>
                  <input
                    value={sel.name}
                    onChange={(e) => updateSel({ name: e.target.value })}
                    style={layout.input}
                  />
                </Row>
                <Row>
                  <label style={layout.lbl}>Style</label>
                  <select
                    value={sel.style}
                    onChange={(e) => updateSel({ style: e.target.value as ShapeStyle })}
                    style={layout.input}
                  >
                    <option value="combined">Combined (curves + ring)</option>
                    <option value="curves">Curves (no ring)</option>
                    <option value="ripples">Ripples</option>
                    <option value="blob">Organic blob</option>
                  </select>
                </Row>
                <Row>
                  <label style={layout.lbl}>Color</label>
                  <input
                    type="color"
                    value={sel.color}
                    onChange={(e) => updateSel({ color: e.target.value })}
                  />
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => updateSel({ color: c })}
                        style={{
                          width: 18,
                          height: 18,
                          background: c,
                          border: "1px solid #ccc",
                          borderRadius: 3,
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </div>
                </Row>
                <button onClick={duplicateShape} style={{ ...layout.buttonSm, width: "100%" }}>
                  Duplicate shape
                </button>
              </Section>

              <Section title="Geometry">
                <Slider label="Radius" min={0.05} max={0.6} step={0.005} value={sel.radius} onChange={(v) => updateSel({ radius: v })} />
                <Slider label="Stroke base" min={0.6} max={8} step={0.1} value={sel.strokeBase} onChange={(v) => updateSel({ strokeBase: v })} />
              </Section>

              {sel.style === "ripples" && (
                <Section title="Ripples params">
                  <Slider label="Rings" min={4} max={48} step={1} value={sel.rings} onChange={(v) => updateSel({ rings: v })} />
                  <Slider label="Spacing pow" min={0.6} max={2.4} step={0.05} value={sel.ringPow} onChange={(v) => updateSel({ ringPow: v })} />
                </Section>
              )}

              {(sel.style === "curves" || sel.style === "combined") && (
                <Section title="Curves params">
                  <Slider label="Stripes" min={3} max={32} step={1} value={sel.stripes} onChange={(v) => updateSel({ stripes: v })} />
                  <Slider label="Control mag" min={0.2} max={2.0} step={0.05} value={sel.ctrlScale} onChange={(v) => updateSel({ ctrlScale: v })} />
                  <Slider label="Curve samples" min={8} max={120} step={2} value={sel.curveSamples} onChange={(v) => updateSel({ curveSamples: v })} />
                </Section>
              )}

              {sel.style === "blob" && (
                <Section title="Blob params">
                  <Row>
                    <label style={layout.lbl}>Seed</label>
                    <input
                      type="number"
                      value={sel.blobSeed}
                      onChange={(e) => updateSel({ blobSeed: parseInt(e.target.value, 10) || 0 })}
                      style={layout.input}
                    />
                    <button
                      onClick={() => updateSel({ blobSeed: Math.floor(Math.random() * 1e6) })}
                      style={layout.buttonSm}
                    >
                      ↻
                    </button>
                  </Row>
                </Section>
              )}

              <Section title="Canvas">
                <Row>
                  <label style={layout.lbl}>Background</label>
                  <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} />
                  <span style={{ fontSize: 12, fontFamily: "monospace" }}>{bg}</span>
                </Row>
              </Section>
            </>
          ) : (
            <div style={{ padding: 24, fontSize: 13, opacity: 0.6 }}>
              No shape selected. Add one from the library.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

// ─── Library thumb ──────────────────────────────────────────────────────────

const ShapeThumb: React.FC<{ shape: Shape }> = ({ shape }) => {
  const node = useMemo(
    () => renderShape({ ...shape, curveSamples: Math.min(shape.curveSamples, 24) }),
    [shape],
  );
  return (
    <svg
      width="40"
      height="40"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      style={{ background: "#fff", borderRadius: 3, flexShrink: 0, border: "1px solid #eee" }}
    >
      {node}
    </svg>
  );
};

// ─── UI primitives ──────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ borderTop: "1px solid #e2dfd7", padding: "14px 16px" }}>
    <div style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.6, marginBottom: 10 }}>
      {title}
    </div>
    {children}
  </div>
);

const Row: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>{children}</div>
);

const Slider: React.FC<{
  label: string;
  min: number; max: number; step: number;
  value: number; onChange: (v: number) => void;
}> = ({ label, min, max, step, value, onChange }) => (
  <Row>
    <label style={layout.lbl}>{label}</label>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{ flex: 1 }}
    />
    <span style={{ width: 48, textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 12 }}>
      {value}
    </span>
  </Row>
);

const layout: Record<string, React.CSSProperties> = {
  root: { display: "flex", flexDirection: "column", height: "100%" },
  header: {
    display: "flex", alignItems: "center", gap: 14, padding: "12px 18px",
    borderBottom: "1px solid #e2dfd7", background: "#FFFFFF",
  },
  body: { display: "flex", flex: 1, minHeight: 0 },
  library: {
    width: 280, borderRight: "1px solid #e2dfd7", background: "#FAF8F2",
    display: "flex", flexDirection: "column",
  },
  libraryHead: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 16px", borderBottom: "1px solid #e2dfd7", background: "#FFFFFF",
  },
  libraryItem: {
    display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
    background: "#FFFFFF", border: "1px solid #ddd", borderRadius: 4, cursor: "pointer",
    fontSize: 13, textAlign: "left",
  },
  canvasWrap: {
    flex: 1, padding: 24, display: "flex", alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  inspector: {
    width: 340, borderLeft: "1px solid #e2dfd7", background: "#FFFFFF",
    overflow: "auto",
  },
  buttonPrimary: {
    padding: "6px 12px", fontSize: 13, border: "1px solid #0e0e0e",
    background: "#0e0e0e", color: "#FFFFFF", cursor: "pointer", borderRadius: 4,
  },
  buttonSm: {
    padding: "5px 10px", fontSize: 12, border: "1px solid #0e0e0e",
    background: "#FFFFFF", cursor: "pointer", borderRadius: 4,
  },
  lbl: { width: 110, fontSize: 12, opacity: 0.7, flexShrink: 0 },
  input: { flex: 1, fontSize: 13, padding: 4, border: "1px solid #ccc", borderRadius: 3 },
  deleteX: {
    width: 20, height: 20, lineHeight: "18px", textAlign: "center", borderRadius: 3, color: "#999", fontSize: 16, flexShrink: 0,
  },
};
