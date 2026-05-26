// @refresh reset
import React, { useEffect, useMemo, useRef, useState } from "react";

// Card Layout Editor — visual tool for sculpting the match-card
// constants in StaticPreviewV3.tsx. Renders a scaled-down 1080 × 1920
// canvas with draggable handles around every layout primitive (panel
// bounds, flag bars, team-name baselines, score numerals). The user
// repositions them with the mouse; values update live in the
// sidebar. Save/Load uses localStorage so refreshes don't lose
// state. "Copy as TypeScript" emits a paste-ready snippet to drop
// back into StaticPreviewV3.tsx.

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const STORAGE_KEY = "match-card-layout-v1";

type LayoutState = {
  // Outer chrome
  topInset: number;
  bottomInset: number;
  sideInset: number;
  barHeight: number;
  // Pitch (panel) — independent of outer chrome so the editor can
  // pull it tighter than the flag bars if desired.
  panelLeft: number;
  panelRight: number;
  panelTop: number;
  panelBottom: number;
  // Team-name labels
  teamNameSize: number;
  topTitleY: number; // baseline
  bottomTitleY: number; // baseline
  // Score numerals
  numeralSize: number;
  homeNumeralY: number; // baseline
  awayNumeralY: number; // baseline
  homeNumeralX: number; // centre x
  awayNumeralX: number; // centre x
};

const DEFAULT_LAYOUT: LayoutState = {
  topInset: 170,
  bottomInset: 170,
  sideInset: 96,
  barHeight: 15,
  panelLeft: 96,
  panelRight: 984,
  panelTop: 185,
  panelBottom: 1735,
  teamNameSize: 92,
  topTitleY: 124,
  bottomTitleY: 1862,
  numeralSize: 720,
  homeNumeralY: 740,
  awayNumeralY: 1480,
  homeNumeralX: 540,
  awayNumeralX: 540,
};

const loadLayout = (): LayoutState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<LayoutState>;
    return { ...DEFAULT_LAYOUT, ...parsed };
  } catch {
    return DEFAULT_LAYOUT;
  }
};

type DragHandle =
  | { kind: "panel-edge"; side: "top" | "bottom" | "left" | "right" }
  | { kind: "panel-move" }
  | { kind: "bar"; which: "top" | "bottom" }
  | { kind: "title"; which: "top" | "bottom" }
  | { kind: "numeral"; which: "home" | "away"; axis: "x" | "y" }
  | { kind: "inset"; side: "top" | "bottom" | "side" };

export const CardLayoutEditor: React.FC = () => {
  const [layout, setLayout] = useState<LayoutState>(loadLayout);
  const [dragging, setDragging] = useState<DragHandle | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  // Pixel-snap toggle — useful when laying out grids that need to
  // line up exactly.
  const [snap, setSnap] = useState(true);

  // Convert a clientX/Y to SVG-viewBox coords.
  const clientToSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((clientY - rect.top) / rect.height) * CANVAS_H;
    return { x, y };
  };

  const snapVal = (v: number) => (snap ? Math.round(v) : v);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => {
      const { x, y } = clientToSvg(e.clientX, e.clientY);
      setLayout((cur) => {
        const next = { ...cur };
        switch (dragging.kind) {
          case "panel-edge": {
            if (dragging.side === "top") next.panelTop = snapVal(y);
            if (dragging.side === "bottom") next.panelBottom = snapVal(y);
            if (dragging.side === "left") next.panelLeft = snapVal(x);
            if (dragging.side === "right") next.panelRight = snapVal(x);
            break;
          }
          case "panel-move": {
            // Translate the whole panel — keep its size, recentre on
            // the cursor. The cursor sits at the panel centre while
            // dragging.
            const w = cur.panelRight - cur.panelLeft;
            const h = cur.panelBottom - cur.panelTop;
            next.panelLeft = snapVal(x - w / 2);
            next.panelRight = snapVal(x + w / 2);
            next.panelTop = snapVal(y - h / 2);
            next.panelBottom = snapVal(y + h / 2);
            break;
          }
          case "bar": {
            if (dragging.which === "top") next.topInset = snapVal(y);
            else
              next.bottomInset = snapVal(
                CANVAS_H - y - cur.barHeight,
              );
            break;
          }
          case "title": {
            if (dragging.which === "top") next.topTitleY = snapVal(y);
            else next.bottomTitleY = snapVal(y);
            break;
          }
          case "numeral": {
            if (dragging.which === "home") {
              if (dragging.axis === "y") next.homeNumeralY = snapVal(y);
              else next.homeNumeralX = snapVal(x);
            } else {
              if (dragging.axis === "y") next.awayNumeralY = snapVal(y);
              else next.awayNumeralX = snapVal(x);
            }
            break;
          }
          case "inset": {
            if (dragging.side === "top") next.topInset = snapVal(y);
            if (dragging.side === "bottom")
              next.bottomInset = snapVal(CANVAS_H - y);
            if (dragging.side === "side") next.sideInset = snapVal(x);
            break;
          }
        }
        return next;
      });
    };
    const up = () => setDragging(null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, snap]);

  // Derived numbers for readouts.
  const panelW = layout.panelRight - layout.panelLeft;
  const panelH = layout.panelBottom - layout.panelTop;
  const cap = Math.round(layout.teamNameSize * 0.72);
  const topTitleBarGap = layout.topInset - layout.topTitleY;
  const bottomBarBottomY = CANVAS_H - layout.bottomInset;
  const bottomTitleTopOfCap = layout.bottomTitleY - cap;
  const bottomTitleBarGap = bottomTitleTopOfCap - bottomBarBottomY;

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  };
  const reset = () => {
    if (!confirm("Reset all layout values to defaults?")) return;
    setLayout(DEFAULT_LAYOUT);
    localStorage.removeItem(STORAGE_KEY);
  };
  const copyTS = () => {
    const snippet = buildTsSnippet(layout);
    try {
      navigator.clipboard.writeText(snippet);
    } catch {
      // Fallback: textarea select+exec.
      const ta = document.createElement("textarea");
      ta.value = snippet;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  };

  return (
    <div style={styles.shell}>
      <div style={styles.canvasShell}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          style={styles.canvas}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Card background */}
          <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#F4F4F4" />

          {/* Side inset guides */}
          <line
            x1={layout.sideInset}
            y1={0}
            x2={layout.sideInset}
            y2={CANVAS_H}
            stroke="rgba(0,0,0,0.06)"
            strokeWidth={1}
            strokeDasharray="6 6"
          />
          <line
            x1={CANVAS_W - layout.sideInset}
            y1={0}
            x2={CANVAS_W - layout.sideInset}
            y2={CANVAS_H}
            stroke="rgba(0,0,0,0.06)"
            strokeWidth={1}
            strokeDasharray="6 6"
          />

          {/* Top flag bar */}
          <DraggableRect
            x={layout.sideInset}
            y={layout.topInset}
            w={CANVAS_W - 2 * layout.sideInset}
            h={layout.barHeight}
            fill="#E62E32"
            onPress={() => setDragging({ kind: "bar", which: "top" })}
            label="TOP BAR"
          />
          {/* Bottom flag bar */}
          <DraggableRect
            x={layout.sideInset}
            y={CANVAS_H - layout.bottomInset - layout.barHeight}
            w={CANVAS_W - 2 * layout.sideInset}
            h={layout.barHeight}
            fill="#2E62E6"
            onPress={() => setDragging({ kind: "bar", which: "bottom" })}
            label="BOTTOM BAR"
          />

          {/* Pitch (panel) */}
          <rect
            x={layout.panelLeft}
            y={layout.panelTop}
            width={panelW}
            height={panelH}
            fill="#FFFFFF"
            stroke="rgba(10,10,10,0.5)"
            strokeWidth={2}
          />
          {/* Pitch midline */}
          <line
            x1={layout.panelLeft}
            y1={(layout.panelTop + layout.panelBottom) / 2}
            x2={layout.panelRight}
            y2={(layout.panelTop + layout.panelBottom) / 2}
            stroke="rgba(10,10,10,0.25)"
            strokeWidth={2}
          />
          {/* Pitch centre-grab — drag to move whole panel */}
          <rect
            x={(layout.panelLeft + layout.panelRight) / 2 - 60}
            y={(layout.panelTop + layout.panelBottom) / 2 - 60}
            width={120}
            height={120}
            fill="rgba(0,150,255,0.08)"
            stroke="rgba(0,150,255,0.6)"
            strokeWidth={2}
            strokeDasharray="6 6"
            style={{ cursor: "move" }}
            onMouseDown={() => setDragging({ kind: "panel-move" })}
          />
          <text
            x={(layout.panelLeft + layout.panelRight) / 2}
            y={(layout.panelTop + layout.panelBottom) / 2 + 6}
            textAnchor="middle"
            fontFamily="ui-sans-serif"
            fontSize={18}
            fill="rgba(0,80,140,0.85)"
            style={{ pointerEvents: "none" }}
          >
            DRAG PITCH
          </text>

          {/* Pitch edge handles */}
          <EdgeHandle
            orientation="h"
            x={layout.panelLeft}
            y={layout.panelTop}
            length={panelW}
            onPress={() =>
              setDragging({ kind: "panel-edge", side: "top" })
            }
          />
          <EdgeHandle
            orientation="h"
            x={layout.panelLeft}
            y={layout.panelBottom}
            length={panelW}
            onPress={() =>
              setDragging({ kind: "panel-edge", side: "bottom" })
            }
          />
          <EdgeHandle
            orientation="v"
            x={layout.panelLeft}
            y={layout.panelTop}
            length={panelH}
            onPress={() =>
              setDragging({ kind: "panel-edge", side: "left" })
            }
          />
          <EdgeHandle
            orientation="v"
            x={layout.panelRight}
            y={layout.panelTop}
            length={panelH}
            onPress={() =>
              setDragging({ kind: "panel-edge", side: "right" })
            }
          />

          {/* Score numerals — placeholder rectangles around baselines */}
          <NumeralPlaceholder
            cx={layout.homeNumeralX}
            cy={layout.homeNumeralY}
            size={layout.numeralSize}
            label="4"
            onPress={(axis) =>
              setDragging({ kind: "numeral", which: "home", axis })
            }
          />
          <NumeralPlaceholder
            cx={layout.awayNumeralX}
            cy={layout.awayNumeralY}
            size={layout.numeralSize}
            label="1"
            onPress={(axis) =>
              setDragging({ kind: "numeral", which: "away", axis })
            }
          />

          {/* Team-name labels */}
          <TitleHandle
            baselineY={layout.topTitleY}
            label="HOME TEAM"
            size={layout.teamNameSize}
            onPress={() => setDragging({ kind: "title", which: "top" })}
          />
          <TitleHandle
            baselineY={layout.bottomTitleY}
            label="AWAY TEAM"
            size={layout.teamNameSize}
            onPress={() => setDragging({ kind: "title", which: "bottom" })}
          />

          {/* Measurement annotations */}
          <Measurement
            x1={CANVAS_W - 40}
            y1={layout.topTitleY}
            x2={CANVAS_W - 40}
            y2={layout.topInset}
            label={`${topTitleBarGap.toFixed(0)} top-gap`}
          />
          <Measurement
            x1={CANVAS_W - 40}
            y1={bottomBarBottomY}
            x2={CANVAS_W - 40}
            y2={bottomTitleTopOfCap}
            label={`${bottomTitleBarGap.toFixed(0)} bot-gap`}
          />
        </svg>
      </div>

      <div style={styles.sidebar}>
        <div style={styles.sectionTitle}>CARD LAYOUT EDITOR</div>
        <div style={styles.hint}>
          Drag handles on the canvas, or edit values directly. Cmd-S
          to save.
        </div>

        <div style={styles.btnRow}>
          <button style={styles.btn} onClick={save}>
            Save
          </button>
          <button style={styles.btn} onClick={reset}>
            Reset
          </button>
          <button style={styles.btnPrimary} onClick={copyTS}>
            Copy TS
          </button>
          <label style={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={snap}
              onChange={(e) => setSnap(e.target.checked)}
            />{" "}
            snap
          </label>
        </div>

        <Section title="Pitch (panel)">
          <Row label="left" value={layout.panelLeft}
            onChange={(v) => setLayout({ ...layout, panelLeft: v })} />
          <Row label="right" value={layout.panelRight}
            onChange={(v) => setLayout({ ...layout, panelRight: v })} />
          <Row label="top" value={layout.panelTop}
            onChange={(v) => setLayout({ ...layout, panelTop: v })} />
          <Row label="bottom" value={layout.panelBottom}
            onChange={(v) => setLayout({ ...layout, panelBottom: v })} />
          <Readout label="width" value={panelW} />
          <Readout label="height" value={panelH} />
        </Section>

        <Section title="Outer chrome">
          <Row label="topInset" value={layout.topInset}
            onChange={(v) => setLayout({ ...layout, topInset: v })} />
          <Row label="bottomInset" value={layout.bottomInset}
            onChange={(v) => setLayout({ ...layout, bottomInset: v })} />
          <Row label="sideInset" value={layout.sideInset}
            onChange={(v) => setLayout({ ...layout, sideInset: v })} />
          <Row label="barHeight" value={layout.barHeight}
            onChange={(v) => setLayout({ ...layout, barHeight: v })} />
        </Section>

        <Section title="Team-name labels">
          <Row label="size" value={layout.teamNameSize}
            onChange={(v) => setLayout({ ...layout, teamNameSize: v })} />
          <Row label="topY" value={layout.topTitleY}
            onChange={(v) => setLayout({ ...layout, topTitleY: v })} />
          <Row label="bottomY" value={layout.bottomTitleY}
            onChange={(v) => setLayout({ ...layout, bottomTitleY: v })} />
          <Readout label="cap (~0.72×)" value={cap} />
          <Readout label="top→bar gap" value={topTitleBarGap} />
          <Readout label="bar→bot gap" value={bottomTitleBarGap} />
        </Section>

        <Section title="Score numerals">
          <Row label="size" value={layout.numeralSize}
            onChange={(v) => setLayout({ ...layout, numeralSize: v })} />
          <Row label="homeX" value={layout.homeNumeralX}
            onChange={(v) => setLayout({ ...layout, homeNumeralX: v })} />
          <Row label="homeY" value={layout.homeNumeralY}
            onChange={(v) => setLayout({ ...layout, homeNumeralY: v })} />
          <Row label="awayX" value={layout.awayNumeralX}
            onChange={(v) => setLayout({ ...layout, awayNumeralX: v })} />
          <Row label="awayY" value={layout.awayNumeralY}
            onChange={(v) => setLayout({ ...layout, awayNumeralY: v })} />
        </Section>

        <details style={styles.snippetWrap}>
          <summary style={styles.snippetSummary}>Preview snippet</summary>
          <pre style={styles.snippet}>{buildTsSnippet(layout)}</pre>
        </details>
      </div>
    </div>
  );
};

const DraggableRect: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  onPress: () => void;
  label: string;
}> = ({ x, y, w, h, fill, onPress, label }) => (
  <g style={{ cursor: "ns-resize" }} onMouseDown={onPress}>
    <rect x={x} y={y} width={w} height={h} fill={fill} />
    <text
      x={x + w / 2}
      y={y + h / 2 + 4}
      textAnchor="middle"
      fontFamily="ui-sans-serif"
      fontSize={10}
      fill="rgba(255,255,255,0.85)"
      style={{ pointerEvents: "none" }}
    >
      {label}
    </text>
  </g>
);

const EdgeHandle: React.FC<{
  orientation: "h" | "v";
  x: number;
  y: number;
  length: number;
  onPress: () => void;
}> = ({ orientation, x, y, length, onPress }) => {
  const w = orientation === "h" ? length : 20;
  const h = orientation === "h" ? 20 : length;
  const dx = orientation === "h" ? 0 : -10;
  const dy = orientation === "h" ? -10 : 0;
  return (
    <rect
      x={x + dx}
      y={y + dy}
      width={w}
      height={h}
      fill="rgba(0,150,255,0.35)"
      style={{
        cursor: orientation === "h" ? "ns-resize" : "ew-resize",
      }}
      onMouseDown={onPress}
    />
  );
};

const TitleHandle: React.FC<{
  baselineY: number;
  label: string;
  size: number;
  onPress: () => void;
}> = ({ baselineY, label, size, onPress }) => {
  const cap = Math.round(size * 0.72);
  return (
    <g style={{ cursor: "ns-resize" }} onMouseDown={onPress}>
      <rect
        x={120}
        y={baselineY - cap - 6}
        width={CANVAS_W - 240}
        height={cap + 12}
        fill="rgba(0,150,255,0.08)"
        stroke="rgba(0,150,255,0.65)"
        strokeWidth={2}
        strokeDasharray="6 6"
      />
      <text
        x={CANVAS_W / 2}
        y={baselineY}
        textAnchor="middle"
        fontFamily="Anton, ui-sans-serif"
        fontSize={size}
        fill="rgba(10,10,10,0.85)"
        style={{ pointerEvents: "none" }}
      >
        {label}
      </text>
    </g>
  );
};

const NumeralPlaceholder: React.FC<{
  cx: number;
  cy: number;
  size: number;
  label: string;
  onPress: (axis: "x" | "y") => void;
}> = ({ cx, cy, size, label, onPress }) => {
  const w = size * 0.7;
  const h = size * 0.78;
  return (
    <g>
      <rect
        x={cx - w / 2}
        y={cy - h * 0.78}
        width={w}
        height={h}
        fill="rgba(0,150,255,0.06)"
        stroke="rgba(0,150,255,0.55)"
        strokeWidth={2}
        strokeDasharray="6 6"
        style={{ cursor: "move" }}
        onMouseDown={() => onPress("y")}
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        fontFamily='"Sharp Grotesk VF", "Sharp Grotesk", Inter, ui-sans-serif'
        fontWeight={900}
        fontSize={size}
        fill="rgba(10,10,10,0.18)"
        style={{ pointerEvents: "none" }}
      >
        {label}
      </text>
      {/* Horizontal handle strip */}
      <rect
        x={cx - 40}
        y={cy + 20}
        width={80}
        height={24}
        fill="rgba(0,150,255,0.45)"
        style={{ cursor: "ew-resize" }}
        onMouseDown={() => onPress("x")}
      />
    </g>
  );
};

const Measurement: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
}> = ({ x1, y1, x2, y2, label }) => (
  <g>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(0,150,255,0.7)" strokeWidth={2} />
    <line x1={x1 - 12} y1={y1} x2={x1 + 12} y2={y1} stroke="rgba(0,150,255,0.7)" strokeWidth={2} />
    <line x1={x2 - 12} y1={y2} x2={x2 + 12} y2={y2} stroke="rgba(0,150,255,0.7)" strokeWidth={2} />
    <text
      x={x1 - 16}
      y={(y1 + y2) / 2 + 6}
      textAnchor="end"
      fontFamily="ui-monospace, monospace"
      fontSize={20}
      fill="rgba(0,80,140,0.95)"
      style={{ pointerEvents: "none" }}
    >
      {label}
    </text>
  </g>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div style={styles.section}>
    <div style={styles.sectionHead}>{title}</div>
    <div style={styles.sectionBody}>{children}</div>
  </div>
);

const Row: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
}> = ({ label, value, onChange }) => (
  <div style={styles.row}>
    <div style={styles.rowLabel}>{label}</div>
    <input
      type="number"
      value={Math.round(value)}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (!Number.isNaN(v)) onChange(v);
      }}
      style={styles.rowInput}
    />
  </div>
);

const Readout: React.FC<{ label: string; value: number }> = ({
  label,
  value,
}) => (
  <div style={styles.row}>
    <div style={styles.rowLabel}>{label}</div>
    <div style={styles.rowReadout}>{Math.round(value)}</div>
  </div>
);

const buildTsSnippet = (l: LayoutState) =>
  `// Drop into StaticPreviewV3.tsx:
const CANVAS_W = 1080;
const CANVAS_H = 1920;
const TOP_INSET = ${Math.round(l.topInset)};
const BOTTOM_INSET = ${Math.round(l.bottomInset)};
const SIDE_INSET = ${Math.round(l.sideInset)};
const BAR_H = ${Math.round(l.barHeight)};
const TEAM_NAME_SIZE = ${Math.round(l.teamNameSize)};
const TEAM_NAME_GAP = ${Math.round(l.topInset - l.topTitleY)};
// Panel — width ${Math.round(l.panelRight - l.panelLeft)}, height ${Math.round(
    l.panelBottom - l.panelTop,
  )}
const PANEL = {
  left: ${Math.round(l.panelLeft)},
  top: ${Math.round(l.panelTop)},
  right: ${Math.round(l.panelRight)},
  bottom: ${Math.round(l.panelBottom)},
};
// Score numerals (replace homeBaseY / awayBaseY math):
const HOME_NUMERAL_Y = ${Math.round(l.homeNumeralY)};
const AWAY_NUMERAL_Y = ${Math.round(l.awayNumeralY)};
const HOME_NUMERAL_X = ${Math.round(l.homeNumeralX)};
const AWAY_NUMERAL_X = ${Math.round(l.awayNumeralX)};
const NUMERAL_SIZE = ${Math.round(l.numeralSize)};
`;

const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: "flex",
    width: "100vw",
    height: "100vh",
    background: "#0E0E0E",
    color: "#FFFFFF",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
  },
  canvasShell: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    overflow: "hidden",
  },
  canvas: {
    height: "calc(100vh - 48px)",
    aspectRatio: "1080 / 1920",
    background: "#F4F4F4",
    boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
    userSelect: "none",
  },
  sidebar: {
    width: 340,
    flexShrink: 0,
    background: "#161616",
    borderLeft: "1px solid rgba(255,255,255,0.08)",
    padding: 18,
    overflowY: "auto",
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  hint: {
    opacity: 0.6,
    fontSize: 11,
    marginBottom: 18,
    lineHeight: 1.5,
  },
  btnRow: {
    display: "flex",
    gap: 8,
    marginBottom: 18,
    alignItems: "center",
    flexWrap: "wrap",
  },
  btn: {
    padding: "8px 12px",
    background: "rgba(255,255,255,0.08)",
    color: "#FFFFFF",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
  },
  btnPrimary: {
    padding: "8px 12px",
    background: "rgba(0,150,255,0.85)",
    color: "#FFFFFF",
    border: "1px solid rgba(0,150,255,0.95)",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
  },
  toggleLabel: {
    fontSize: 11,
    opacity: 0.75,
    marginLeft: "auto",
    display: "flex",
    gap: 4,
    alignItems: "center",
  },
  section: { marginBottom: 14 },
  sectionHead: {
    fontSize: 11,
    letterSpacing: 1.2,
    opacity: 0.65,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  sectionBody: {
    display: "grid",
    gap: 4,
    background: "rgba(255,255,255,0.03)",
    padding: 8,
    borderRadius: 6,
  },
  row: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLabel: { fontSize: 11, opacity: 0.8 },
  rowInput: {
    width: 80,
    padding: "4px 6px",
    background: "rgba(255,255,255,0.06)",
    color: "#FFFFFF",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 4,
    fontFamily: "ui-monospace, monospace",
    fontSize: 12,
    textAlign: "right",
  },
  rowReadout: {
    width: 80,
    padding: "4px 6px",
    color: "rgba(255,255,255,0.55)",
    fontFamily: "ui-monospace, monospace",
    fontSize: 12,
    textAlign: "right",
  },
  snippetWrap: {
    marginTop: 18,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 6,
    padding: 10,
  },
  snippetSummary: {
    cursor: "pointer",
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 6,
  },
  snippet: {
    fontFamily: "ui-monospace, monospace",
    fontSize: 11,
    color: "rgba(255,255,255,0.78)",
    whiteSpace: "pre-wrap",
    margin: 0,
  },
};
