// @refresh reset
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import gsap from "gsap";
import {
  SHAPE_BUILDERS,
  SHAPE_FAMILIES,
  type Cell,
  type ShapeFamily,
} from "../playground/showcaseShapes";

const SIZE = 640;
const PALETTE = ["#FEDD00", "#009C3B", "#002776", "#FFFFFF", "#000000"];
// Drag radius and per-sample push (in SVG units).
const INFLUENCE_RADIUS = 110;
const PUSH_STRENGTH = 9;
// Grid options the user can pick from. Pixels per grid step in SVG
// userspace.
const GRID_OPTIONS = [12, 16, 20, 24, 32, 40];
const DEFAULT_GRID = 20;

type Displacement = { x: number; y: number };

const stringSeed = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) & 0x7fffffff;
  }
  return h;
};

// Minimal renderer for the five cell kinds. Each cell paints at its
// own intrinsic coords; the parent <g> handles displacement so the
// cell's rotation/size never change — the mash only translates.
const renderCell = (cell: Cell): React.ReactElement => {
  switch (cell.kind) {
    case "rect": {
      const minDim = Math.min(cell.w, cell.h);
      const defaultRx = minDim * 0.18;
      const rx = cell.rx !== undefined ? cell.rx : defaultRx;
      const rotation =
        cell.rotation !== undefined
          ? `rotate(${cell.rotation} ${cell.cx} ${cell.cy})`
          : undefined;
      return (
        <rect
          x={cell.cx - cell.w / 2}
          y={cell.cy - cell.h / 2}
          width={cell.w}
          height={cell.h}
          rx={rx}
          fill={cell.color}
          transform={rotation}
        />
      );
    }
    case "circle":
      return (
        <circle cx={cell.cx} cy={cell.cy} r={cell.r} fill={cell.color} />
      );
    case "line":
      return (
        <line
          x1={cell.x1}
          y1={cell.y1}
          x2={cell.x2}
          y2={cell.y2}
          stroke={cell.color}
          strokeWidth={cell.strokeW}
          strokeLinecap="round"
        />
      );
    case "wedge":
      return (
        <path
          d={wedgePath(cell.innerR, cell.outerR, cell.startA, cell.endA)}
          fill={cell.color}
        />
      );
    case "path":
      return <path d={cell.d} fill={cell.color} />;
  }
};

const wedgePath = (
  innerR: number,
  outerR: number,
  startA: number,
  endA: number,
): string => {
  const x1 = Math.cos(startA) * outerR;
  const y1 = Math.sin(startA) * outerR;
  const x2 = Math.cos(endA) * outerR;
  const y2 = Math.sin(endA) * outerR;
  const x3 = Math.cos(endA) * innerR;
  const y3 = Math.sin(endA) * innerR;
  const x4 = Math.cos(startA) * innerR;
  const y4 = Math.sin(startA) * innerR;
  const sweep = endA - startA;
  const large = sweep > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${large} 0 ${x4} ${y4} Z`;
};

const easeFor = (mode: Cell["revealMode"]): string =>
  mode === "fade"
    ? "power2.out"
    : mode === "grow"
    ? "power3.out"
    : "back.out(3.2)";

const ShapeMash: React.FC = () => {
  const [family, setFamily] = useState<ShapeFamily>("sunburst_wedges");
  const [grid, setGrid] = useState<number>(DEFAULT_GRID);
  const [snap, setSnap] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const seed = useMemo(() => stringSeed(family), [family]);

  const { cells, focal } = useMemo(
    () => SHAPE_BUILDERS[family](seed, SIZE, PALETTE),
    [family, seed],
  );

  const svgRef = useRef<SVGSVGElement | null>(null);
  const groupRefs = useRef<Array<SVGGElement | null>>([]);
  // Per-cell displacement. Authoritative source — we push via
  // gsap.set during drag and read back here for export.
  const displacements = useRef<Displacement[]>([]);
  const isDragging = useRef(false);
  const [hint, setHint] = useState(
    "Drag across the shape to mash it. Cells snap to grid and stay put.",
  );
  // Bumps every time the mashed state changes — drives the displaced
  // count badge so the user can see they actually moved something.
  const [stateTick, setStateTick] = useState(0);

  // Snap helper — quantises a value to the nearest grid step.
  const snapTo = (v: number) => Math.round(v / grid) * grid;

  // Reset refs + cell positions whenever the shape changes.
  useEffect(() => {
    displacements.current = cells.map(() => ({ x: 0, y: 0 }));
    groupRefs.current = new Array(cells.length).fill(null);
    requestAnimationFrame(() => {
      groupRefs.current.forEach((g) => {
        if (g) gsap.set(g, { x: 0, y: 0 });
      });
      setStateTick((t) => t + 1);
    });
  }, [cells]);

  const toSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    (e.target as Element).setPointerCapture(e.pointerId);
    setHint("Mashing…");
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const cursor = toSvg(e.clientX, e.clientY);
    const disps = displacements.current;
    let anyChanged = false;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]!;
      const d = disps[i]!;
      const curX = cell.cx + d.x;
      const curY = cell.cy + d.y;
      const dx = curX - cursor.x;
      const dy = curY - cursor.y;
      const dist = Math.hypot(dx, dy);
      if (dist > INFLUENCE_RADIUS || dist < 0.1) continue;
      const falloff = 1 - dist / INFLUENCE_RADIUS;
      const push = PUSH_STRENGTH * falloff;
      // Compute the candidate new position (cell origin + accumulated
      // displacement + this sample's push outward from the cursor).
      let nextX = curX + (dx / dist) * push;
      let nextY = curY + (dy / dist) * push;
      // Snap the FINAL position to grid so cells live on lattice
      // points. Displacement is the delta between snapped position
      // and the cell's intrinsic centre — rotation/size untouched.
      if (snap) {
        nextX = snapTo(nextX);
        nextY = snapTo(nextY);
      }
      const newDX = nextX - cell.cx;
      const newDY = nextY - cell.cy;
      if (newDX === d.x && newDY === d.y) continue;
      d.x = newDX;
      d.y = newDY;
      anyChanged = true;
      const g = groupRefs.current[i];
      if (g) gsap.set(g, { x: d.x, y: d.y });
    }
    if (anyChanged) setStateTick((t) => t + 1);
  };

  const onPointerUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    setHint(
      "Mashed state held. Replay to animate home, or Copy Variation to export.",
    );
  };

  const replay = () => {
    isDragging.current = false;
    setHint("Replaying — cells settling back along their own reveal curves.");
    const disps = displacements.current;
    for (let i = 0; i < cells.length; i++) {
      const g = groupRefs.current[i];
      if (!g) continue;
      const cell = cells[i]!;
      const delay = (cell.revealOrder ?? 0) * 0.55;
      gsap.to(g, {
        x: 0,
        y: 0,
        duration: 0.75,
        delay,
        ease: easeFor(cell.revealMode),
      });
      disps[i] = { x: 0, y: 0 };
    }
    setTimeout(() => {
      setStateTick((t) => t + 1);
      setHint("Drag across the shape to mash it. Cells snap to grid.");
    }, 1200);
  };

  const reset = () => {
    isDragging.current = false;
    const disps = displacements.current;
    for (let i = 0; i < cells.length; i++) {
      const g = groupRefs.current[i];
      if (g) gsap.set(g, { x: 0, y: 0 });
      disps[i] = { x: 0, y: 0 };
    }
    setStateTick((t) => t + 1);
    setHint("Drag across the shape to mash it. Cells snap to grid.");
  };

  const copyVariation = () => {
    // Export a portable JSON snapshot of the current mashed state —
    // a paste-back-able list of cells with their displaced positions
    // and original geometry. Drop into a custom builder to reproduce.
    const out = cells.map((cell, i) => {
      const d = displacements.current[i] ?? { x: 0, y: 0 };
      const base = {
        kind: cell.kind,
        color: cell.color,
        // Origin coords (where the showcase builder placed the cell).
        origin: { x: round(cell.cx), y: round(cell.cy) },
        // Final coords after mashing — what you'd plug into a custom
        // builder to reproduce the mashed look.
        position: { x: round(cell.cx + d.x), y: round(cell.cy + d.y) },
        displacement: { x: round(d.x), y: round(d.y) },
      };
      // Per-kind extras — only the geometry the renderer needs.
      switch (cell.kind) {
        case "rect":
          return { ...base, w: round(cell.w), h: round(cell.h), rx: cell.rx ?? null, rotation: cell.rotation ?? null };
        case "circle":
          return { ...base, r: round(cell.r) };
        case "line":
          return { ...base, x1: round(cell.x1), y1: round(cell.y1), x2: round(cell.x2), y2: round(cell.y2), strokeW: round(cell.strokeW) };
        case "wedge":
          return { ...base, innerR: round(cell.innerR), outerR: round(cell.outerR), startA: round4(cell.startA), endA: round4(cell.endA) };
        case "path":
          return { ...base, d: cell.d };
      }
    });
    const payload = {
      family,
      seed,
      grid,
      size: SIZE,
      mashed: countMashed(displacements.current),
      cells: out,
    };
    const json = JSON.stringify(payload, null, 2);
    navigator.clipboard?.writeText(json).then(
      () => setHint(`Copied ${out.length} cells (${payload.mashed} mashed) to clipboard.`),
      () => setHint("Clipboard blocked — open devtools and copy from console."),
    );
    // eslint-disable-next-line no-console
    console.log("[shape-mash] variation JSON:\n" + json);
  };

  // Cell count badges
  const mashedCount = useMemo(() => {
    void stateTick;
    return countMashed(displacements.current);
  }, [stateTick]);

  return (
    <div style={s.page}>
      <header style={s.header}>
        <span style={s.title}>SHAPE MASH · GRID PLAYGROUND</span>
        <span style={s.subtitle}>{hint}</span>
      </header>

      <div style={s.body}>
        <div style={s.stage}>
          <svg
            ref={svgRef}
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`-${SIZE / 2} -${SIZE / 2} ${SIZE} ${SIZE}`}
            width="100%"
            height="100%"
            style={{ display: "block", cursor: "grab", touchAction: "none" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            <defs>
              <pattern
                id="mashgrid"
                width={grid}
                height={grid}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${grid} 0 L 0 0 L 0 ${grid}`}
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={0.6}
                />
              </pattern>
              <pattern
                id="mashgrid_major"
                width={grid * 5}
                height={grid * 5}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${grid * 5} 0 L 0 0 L 0 ${grid * 5}`}
                  fill="none"
                  stroke="rgba(255,255,255,0.18)"
                  strokeWidth={0.8}
                />
              </pattern>
            </defs>
            {showGrid && (
              <>
                <rect
                  x={-SIZE / 2}
                  y={-SIZE / 2}
                  width={SIZE}
                  height={SIZE}
                  fill="url(#mashgrid)"
                />
                <rect
                  x={-SIZE / 2}
                  y={-SIZE / 2}
                  width={SIZE}
                  height={SIZE}
                  fill="url(#mashgrid_major)"
                />
                <line
                  x1={-SIZE / 2}
                  y1={0}
                  x2={SIZE / 2}
                  y2={0}
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth={0.8}
                />
                <line
                  x1={0}
                  y1={-SIZE / 2}
                  x2={0}
                  y2={SIZE / 2}
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth={0.8}
                />
              </>
            )}
            {cells.map((cell, i) => (
              <g
                key={i}
                ref={(el) => {
                  groupRefs.current[i] = el;
                }}
              >
                {renderCell(cell)}
              </g>
            ))}
          </svg>
        </div>

        <aside style={s.controls}>
          <div style={s.field}>
            <div style={s.fieldLabel}>Shape</div>
            <select
              value={family}
              onChange={(e) => setFamily(e.target.value as ShapeFamily)}
              style={s.select}
            >
              {SHAPE_FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {f.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div style={s.field}>
            <div style={s.fieldLabel}>Grid step (px)</div>
            <div style={s.gridRow}>
              {GRID_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setGrid(opt)}
                  style={{
                    ...s.chip,
                    ...(opt === grid ? s.chipActive : null),
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div style={s.field}>
            <label style={s.toggleRow}>
              <input
                type="checkbox"
                checked={snap}
                onChange={(e) => setSnap(e.target.checked)}
              />
              <span style={s.toggleLabel}>Snap to grid</span>
            </label>
            <label style={s.toggleRow}>
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
              />
              <span style={s.toggleLabel}>Show grid</span>
            </label>
          </div>

          <button type="button" style={s.btnPrimary} onClick={copyVariation}>
            Copy variation JSON
          </button>
          <div style={s.btnRow}>
            <button type="button" style={s.btn} onClick={replay}>
              Replay
            </button>
            <button type="button" style={s.btn} onClick={reset}>
              Reset
            </button>
          </div>

          <div style={s.metaRow}>
            <span style={s.metaLabel}>Cells</span>
            <span style={s.metaValue}>{cells.length}</span>
          </div>
          <div style={s.metaRow}>
            <span style={s.metaLabel}>Mashed</span>
            <span style={s.metaValue}>{mashedCount}</span>
          </div>
          <div style={s.metaRow}>
            <span style={s.metaLabel}>Focal</span>
            <span style={s.metaValue}>
              ({focal.x.toFixed(0)}, {focal.y.toFixed(0)})
            </span>
          </div>

          <p style={s.help}>
            Drag the canvas to push nearby cells outward — each cell keeps
            its rotation and size, only its centre snaps to the grid. The
            mash holds when you release, so you can iterate. Copy Variation
            dumps every cell's geometry + displaced position to clipboard.
          </p>
        </aside>
      </div>
    </div>
  );
};

const round = (v: number) => Math.round(v * 100) / 100;
const round4 = (v: number) => Math.round(v * 10000) / 10000;
const countMashed = (disps: Displacement[]) =>
  disps.reduce((n, d) => n + (d.x !== 0 || d.y !== 0 ? 1 : 0), 0);

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
    gap: 16,
  },
  title: { fontSize: 14, fontWeight: 800, letterSpacing: 4 },
  subtitle: {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.55)",
    textAlign: "right",
    flex: 1,
    minWidth: 0,
  },
  body: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 320px",
    gap: 24,
    alignItems: "start",
  },
  stage: {
    aspectRatio: "1 / 1",
    background: "#0A0A0A",
    border: "1px solid rgba(255,255,255,0.08)",
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
  },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.85)",
  },
  select: {
    background: "#000",
    color: "#FFF",
    border: "1px solid rgba(255,255,255,0.2)",
    padding: "8px 10px",
    fontFamily: "ui-monospace, monospace",
    fontSize: 12,
  },
  gridRow: { display: "flex", gap: 4, flexWrap: "wrap" },
  chip: {
    padding: "6px 10px",
    border: "1px solid rgba(255,255,255,0.18)",
    background: "transparent",
    color: "rgba(255,255,255,0.7)",
    cursor: "pointer",
    fontSize: 11,
    fontFamily: "ui-monospace, monospace",
    minWidth: 36,
  },
  chipActive: {
    borderColor: "#FFF",
    color: "#FFF",
    background: "rgba(255,255,255,0.08)",
  },
  toggleRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    cursor: "pointer",
  },
  toggleLabel: { color: "rgba(255,255,255,0.85)" },
  btnPrimary: {
    padding: "10px 12px",
    border: "1px solid #FFF",
    background: "#FFF",
    color: "#000",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  btnRow: { display: "flex", gap: 8 },
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
  metaRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 11,
    fontFamily: "ui-monospace, monospace",
    color: "rgba(255,255,255,0.6)",
  },
  metaLabel: { color: "rgba(255,255,255,0.45)" },
  metaValue: {},
  help: {
    fontSize: 11,
    lineHeight: 1.5,
    color: "rgba(255,255,255,0.5)",
    margin: 0,
    marginTop: 4,
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
          {`Shape Mash error:\n\n${this.state.error.message}\n\n${this.state.error.stack ?? ""}`}
        </pre>
      );
    }
    return this.props.children as React.ReactElement;
  }
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <ErrorBoundary>
    <ShapeMash />
  </ErrorBoundary>,
);
