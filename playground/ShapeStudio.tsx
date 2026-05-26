import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  buildFieldLayers,
  DEFAULT_SETTINGS,
  type CellGridSettings,
  type CellGridType,
} from "../src/lib/cellGrid";
import {
  boundaryPathForBox,
  ALL_BOUNDARY_SHAPES,
  type LabBoundaryShape,
} from "../src/lib/boundaryShapes";
import { oscillateSettings } from "../src/lib/oscillate";

// ─────────────────────────────────────────────────────────────────────
// Shape Studio — author surface for the cellGrid + boundary system.
// One shape, full focus. Tune everything live, animate, save to a local
// library, export as JSON / TS for the gallery to consume.

const FPS = 30;
const TOTAL_FRAMES = 270;

const PREVIEW_W = 720;
const PREVIEW_H = 720;

const CELL_TYPES: CellGridType[] = [
  "blocks",
  "wedges",
  "arcs",
  "checker_fields",
  "warped_bands",
  "radial_segments",
  "radial_burst",
  "kinetic_shockwave",
  "fragmented_ray",
  "mixed",
  "plotter_lines",
  "particle_burst",
  "ink_spiral",
  "squishy_blobs",
  "radial_checker",
  "optical_dial",
  "pixel_topography",
  "poster_stack",
  "interference_mandala",
  "crescent_grid",
  "sine_stripes",
  "triangle_grid",
  "hexagon_grid",
  "ellipse_field",
  "primitive_soup",
  "polygon_mix",
  "voronoi_cells",
  "delaunay_mesh",
  "mesh_gradient",
  "topographic_lines",
  "polygon_composite",
  "zigzag_spiral",
  "spiral_flower",
  "signal_burst",
  "vortex_rings",
  "ribbon_teardrop",
  "halftone_blob",
  "ink_splatter",
  "chromatic_dither",
  "vector_junctions",
  "pinwheel_tilt",
  "concentric_spokes",
];

// Curated starter palettes (national-team flag triads + a neutral one).
const PALETTES: Record<string, { name: string; colors: string[] }> = {
  brazil: { name: "Brazil", colors: ["#009C3B", "#FEDD00", "#002776"] },
  argentina: { name: "Argentina", colors: ["#75AADB", "#FFFFFF", "#F6B40E"] },
  france: { name: "France", colors: ["#0055A4", "#FFFFFF", "#EF4135"] },
  germany: { name: "Germany", colors: ["#000000", "#DD0000", "#FFCE00"] },
  spain: { name: "Spain", colors: ["#AA151B", "#F1BF00", "#AD1519"] },
  morocco: { name: "Morocco", colors: ["#C1272D", "#006233", "#FFFFFF"] },
  ink: { name: "Ink", colors: ["#0A0A0A", "#3F3F3F", "#888888"] },
  duotone: { name: "Duotone", colors: ["#E5202B", "#0A0A0A", "#F1ECDF"] },
};

export type ShapeRecipe = {
  id: string;
  name: string;
  type: CellGridType;
  boundary: LabBoundaryShape;
  settings: CellGridSettings;
  moireStrength: number;
  blendTarget: CellGridType;
  blendAmount: number;
  recursionDepth: number;
  palette: string[];
  // Snapshot frame for the thumbnail.
  thumbFrame: number;
};

const LIBRARY_KEY = "shape-studio:library:v1";

const makeId = () => Math.random().toString(36).slice(2, 9);

const defaultRecipe = (): ShapeRecipe => ({
  id: makeId(),
  name: "Untitled shape",
  type: "radial_burst",
  boundary: "circle",
  settings: { ...DEFAULT_SETTINGS },
  moireStrength: 0,
  blendTarget: "wedges",
  blendAmount: 0,
  recursionDepth: 0,
  palette: PALETTES.brazil!.colors.slice(),
  thumbFrame: 110,
});

// Expand the 3-colour base palette to 12 slots so the cellGrid's
// weighted picks land on visibly different cells.
const expandPalette = (colors: string[]): string[] => {
  const slots = 12;
  const out: string[] = [];
  for (let i = 0; i < slots; i++) out.push(colors[i % colors.length]!);
  return out;
};

// ─────────────────────────────────────────────────────────────────────
// Per-cell stagger renderer — same logic as StaticPreview but isolated.

export const ShapePreview: React.FC<{
  recipe: ShapeRecipe;
  frame: number;
  width: number;
  height: number;
  animate: boolean;
  // When true (default), the central "label well" hole clip is
  // applied so the centre is empty for score numerals. Specimen /
  // grid views want the full disc — pass false.
  showHole?: boolean;
}> = ({ recipe, frame, width, height, animate, showHole = true }) => {
  const KICKOFF = 15;
  const localFrame = Math.max(0, frame - KICKOFF);

  const liveSettings = useMemo(
    () =>
      animate
        ? oscillateSettings(recipe.settings, localFrame, FPS)
        : recipe.settings,
    [recipe.settings, localFrame, animate],
  );

  const palette = useMemo(() => expandPalette(recipe.palette), [recipe.palette]);

  const inset = 24;
  const zoneW = width - inset * 2;
  const zoneH = height - inset * 2;

  const layers = useMemo(
    () =>
      buildFieldLayers(recipe.type, liveSettings, zoneW, zoneH, palette, {
        moireStrength: recipe.moireStrength,
        blendTarget: recipe.blendTarget,
        blendAmount: recipe.blendAmount,
        recursionDepth: recipe.recursionDepth,
      }),
    [recipe.type, liveSettings, zoneW, zoneH, palette, recipe.moireStrength, recipe.blendTarget, recipe.blendAmount, recipe.recursionDepth],
  );

  const boundaryPath = useMemo(
    () => boundaryPathForBox(recipe.boundary, inset, inset, zoneW, zoneH, recipe.settings.seed),
    [recipe.boundary, inset, zoneW, zoneH, recipe.settings.seed],
  );

  // Central hole — the "label well" where score numerals sit in the
  // gallery. Even-odd path: outer rect + inscribed circle = cells
  // visible everywhere EXCEPT inside the central disc.
  const holePath = useMemo(() => {
    const r = Math.min(zoneW, zoneH) * 0.22;
    const hcx = inset + zoneW / 2;
    const hcy = inset + zoneH / 2;
    return `M ${inset},${inset} h ${zoneW} v ${zoneH} h ${-zoneW} Z M ${hcx - r},${hcy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0 Z`;
  }, [inset, zoneW, zoneH]);

  const focalX = zoneW / 2;
  const focalY = zoneH / 2;
  const maxDist = Math.hypot(focalX, focalY);
  const STAGGER_TOTAL = 70;
  const PER_CELL = 24;
  const SPAN = Math.max(1, STAGGER_TOTAL - PER_CELL);

  const clipId = `boundary-${recipe.id}`;
  const holeId = `hole-${recipe.id}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <clipPath id={clipId}>
          <path d={boundaryPath} />
        </clipPath>
        {showHole && (
          <clipPath id={holeId} clipPathUnits="userSpaceOnUse">
            <path d={holePath} fillRule="evenodd" />
          </clipPath>
        )}
      </defs>
      <rect x={0} y={0} width={width} height={height} fill="#F4F4F4" />
      <path d={boundaryPath} fill="#FFFFFF" />
      <g clipPath={`url(#${clipId})`}>
       <g clipPath={showHole ? `url(#${holeId})` : undefined}>
        <g transform={`translate(${inset} ${inset})`}>
          {layers.map((layer, li) => (
            <g key={li} opacity={layer.opacity} transform={layer.transform}>
              {layer.cells.map((cell, ci) => {
                const cx = cell.cx ?? focalX;
                const cy = cell.cy ?? focalY;
                let scale = 1;
                if (animate) {
                  const d = Math.hypot(cx - focalX, cy - focalY);
                  const delay = (d / maxDist) * SPAN;
                  const t = Math.max(0, Math.min(1, (localFrame - delay) / PER_CELL));
                  if (t <= 0) return null;
                  const s = 2.7;
                  const t2 = t - 1;
                  scale = t2 * t2 * ((s + 1) * t2 + s) + 1;
                }
                const transform = `translate(${cx} ${cy}) scale(${scale.toFixed(3)}) translate(${(-cx).toFixed(3)} ${(-cy).toFixed(3)})`;
                return cell.d ? (
                  <path key={ci} d={cell.d} fill={cell.color} transform={transform} />
                ) : (
                  <rect
                    key={ci}
                    x={cell.x}
                    y={cell.y}
                    width={cell.w}
                    height={cell.h}
                    fill={cell.color}
                    transform={`${transform} ${cell.transform ?? ""}`}
                  />
                );
              })}
            </g>
          ))}
        </g>
       </g>
      </g>
      <path d={boundaryPath} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={1} />
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Controls

const Slider: React.FC<{
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
}> = ({ label, min, max, step = 1, value, onChange }) => (
  <div style={styles.row}>
    <label style={styles.rowLabel}>{label}</label>
    <input
      style={styles.range}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
    />
    <span style={styles.rowValue}>
      {Number.isInteger(value) ? value : Number(value).toFixed(2)}
    </span>
  </div>
);

const Dropdown: React.FC<{
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
  <div style={styles.row}>
    <label style={styles.rowLabel}>{label}</label>
    <select
      style={styles.select}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o.replaceAll("_", " ")}
        </option>
      ))}
    </select>
  </div>
);

// ─────────────────────────────────────────────────────────────────────
// Studio

export const ShapeStudio: React.FC = () => {
  const [recipe, setRecipe] = useState<ShapeRecipe>(defaultRecipe);
  const [frame, setFrame] = useState<number>(110);
  const [playing, setPlaying] = useState<boolean>(false);
  const [library, setLibrary] = useState<ShapeRecipe[]>(() => {
    try {
      const raw = localStorage.getItem(LIBRARY_KEY);
      return raw ? (JSON.parse(raw) as ShapeRecipe[]) : [];
    } catch {
      return [];
    }
  });
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1400);
  };

  // Animation loop ─────────────────────────────────────────────────
  const frameRef = useRef(frame);
  frameRef.current = frame;
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const next = frameRef.current + (dt / 1000) * FPS;
      if (next >= TOTAL_FRAMES - 1) {
        setFrame(TOTAL_FRAMES - 1);
        setPlaying(false);
        return;
      }
      setFrame(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // Persist library ─────────────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
    } catch {}
  }, [library]);

  // Helpers ─────────────────────────────────────────────────────────
  const setSetting = <K extends keyof CellGridSettings>(k: K, v: CellGridSettings[K]) =>
    setRecipe((r) => ({ ...r, settings: { ...r.settings, [k]: v } }));

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
    } else {
      if (frame >= TOTAL_FRAMES - 1) setFrame(0);
      setPlaying(true);
    }
  };

  const randomize = () => {
    const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
    const r = Math.random;
    setRecipe((current) => ({
      ...current,
      id: makeId(),
      type: pick(CELL_TYPES),
      boundary: pick(ALL_BOUNDARY_SHAPES),
      settings: {
        ...current.settings,
        distortionStrength: Math.round(20 + r() * 70),
        outwardForce: Math.round(-30 + r() * 110),
        pinchIntensity: Math.round(r() * 60),
        edgeOrganicness: Math.round(r() * 40),
        curvature: Math.round(r() * 160),
        asymmetry: Math.round(r() * 80),
        shapeDensity: Math.round(12 + r() * 36),
        shapeScale: Number((0.4 + r() * 0.9).toFixed(2)),
        rotation: Math.round(r() * 360),
        margin: Math.round(20 + r() * 80),
        seed: Math.floor(r() * 9999),
        colorRandomness: Math.round(r() * 100),
        dominantColor: Math.round(r() * 100),
        colorClustering: Math.round(r() * 100),
        colorContrast: Math.round(r() * 100),
      },
    }));
    setFrame(110);
  };

  const reset = () => {
    setRecipe(defaultRecipe());
    setFrame(110);
  };

  const saveToLibrary = () => {
    const snapshot: ShapeRecipe = { ...recipe, id: makeId(), thumbFrame: Math.round(frame) };
    setLibrary((lib) => [snapshot, ...lib]);
    showToast(`Saved "${recipe.name}"`);
  };

  const loadFromLibrary = (item: ShapeRecipe) => {
    setRecipe({ ...item, id: makeId() });
    setFrame(item.thumbFrame ?? 110);
    setPlaying(false);
  };

  const deleteFromLibrary = (id: string) => {
    setLibrary((lib) => lib.filter((x) => x.id !== id));
  };

  const exportTS = () => {
    const snippet = `// Paste into GameGallery.tsx (or any recipe consumer).
{
  type: "${recipe.type}",
  boundary: "${recipe.boundary}",
  posX: 50, posY: 50, size: 65,
  moireStrength: ${recipe.moireStrength},
  blendTarget: "${recipe.blendTarget}",
  blendAmount: ${recipe.blendAmount},
  recursionDepth: ${recipe.recursionDepth},
  settings: ${JSON.stringify(recipe.settings, null, 2).replace(/\n/g, "\n  ")},
}`;
    navigator.clipboard.writeText(snippet);
    showToast("TS recipe copied");
  };

  const exportJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(recipe, null, 2));
    showToast("JSON copied");
  };

  const exportLibrary = () => {
    navigator.clipboard.writeText(JSON.stringify(library, null, 2));
    showToast(`Library exported (${library.length} shapes)`);
  };

  const setPaletteByKey = (k: string) => {
    const p = PALETTES[k];
    if (p) setRecipe((r) => ({ ...r, palette: p.colors.slice() }));
  };

  const updatePaletteColor = (i: number, color: string) => {
    setRecipe((r) => {
      const copy = r.palette.slice();
      copy[i] = color;
      return { ...r, palette: copy };
    });
  };

  // ─────────────────────────────────────────────────────────────────

  return (
    <div style={styles.shell}>
      {/* TOP BAR */}
      <div style={styles.topbar}>
        <div style={styles.brand}>
          <span style={styles.brandTitle}>Shape Studio</span>
          <span style={styles.brandSubtitle}>cellGrid · boundary · author</span>
        </div>
        <input
          style={styles.nameInput}
          value={recipe.name}
          onChange={(e) => setRecipe({ ...recipe, name: e.target.value })}
        />
        <div style={styles.topActions}>
          <button style={styles.btnSecondary} onClick={randomize}>Randomize</button>
          <button style={styles.btnSecondary} onClick={reset}>Reset</button>
          <button style={styles.btnPrimary} onClick={saveToLibrary}>Save to library</button>
        </div>
      </div>

      <div style={styles.body}>
        {/* PREVIEW */}
        <div style={styles.previewWrap}>
          <div style={styles.previewBox}>
            <ShapePreview
              recipe={recipe}
              frame={frame}
              width={PREVIEW_W}
              height={PREVIEW_H}
              animate
            />
          </div>
          <div style={styles.transport}>
            <button style={styles.playBtn} onClick={togglePlay}>
              {playing ? "❚❚" : "▶"}
            </button>
            <input
              style={styles.scrubber}
              type="range"
              min={0}
              max={TOTAL_FRAMES - 1}
              step={1}
              value={Math.round(frame)}
              onChange={(e) => {
                setPlaying(false);
                setFrame(parseInt(e.target.value, 10));
              }}
            />
            <span style={styles.frameLabel}>
              f{Math.round(frame).toString().padStart(3, "0")} / {TOTAL_FRAMES - 1}
            </span>
          </div>
        </div>

        {/* CONTROLS */}
        <div style={styles.controls}>
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Shape</div>
            <Dropdown
              label="Type"
              value={recipe.type}
              options={CELL_TYPES}
              onChange={(v) => setRecipe({ ...recipe, type: v as CellGridType })}
            />
            <Dropdown
              label="Boundary"
              value={recipe.boundary}
              options={ALL_BOUNDARY_SHAPES}
              onChange={(v) => setRecipe({ ...recipe, boundary: v as LabBoundaryShape })}
            />
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>Layout</div>
            <Slider label="Density"  min={5}  max={50}  value={recipe.settings.shapeDensity} onChange={(v) => setSetting("shapeDensity", v)} />
            <Slider label="Scale"    min={0.1} max={1.5} step={0.05} value={recipe.settings.shapeScale} onChange={(v) => setSetting("shapeScale", v)} />
            <Slider label="Rotation" min={0}  max={360} value={recipe.settings.rotation} onChange={(v) => setSetting("rotation", v)} />
            <Slider label="Margin"   min={0}  max={200} value={recipe.settings.margin} onChange={(v) => setSetting("margin", v)} />
            <Slider label="Seed"     min={0}  max={9999} value={recipe.settings.seed} onChange={(v) => setSetting("seed", v)} />
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>Distortion</div>
            <Slider label="Distortion" min={0}    max={100} value={recipe.settings.distortionStrength} onChange={(v) => setSetting("distortionStrength", v)} />
            <Slider label="Outward"    min={-100} max={100} value={recipe.settings.outwardForce} onChange={(v) => setSetting("outwardForce", v)} />
            <Slider label="Pinch"      min={0}    max={100} value={recipe.settings.pinchIntensity ?? 0} onChange={(v) => setSetting("pinchIntensity", v)} />
            <Slider label="Edge org."  min={0}    max={100} value={recipe.settings.edgeOrganicness ?? 0} onChange={(v) => setSetting("edgeOrganicness", v)} />
            <Slider label="Curvature"  min={0}    max={180} value={recipe.settings.curvature} onChange={(v) => setSetting("curvature", v)} />
            <Slider label="Asymmetry"  min={0}    max={100} value={recipe.settings.asymmetry} onChange={(v) => setSetting("asymmetry", v)} />
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>Color</div>
            <Slider label="Randomness"  min={0} max={100} value={recipe.settings.colorRandomness}  onChange={(v) => setSetting("colorRandomness", v)} />
            <Slider label="Dominant"    min={0} max={100} value={recipe.settings.dominantColor}    onChange={(v) => setSetting("dominantColor", v)} />
            <Slider label="Clustering"  min={0} max={100} value={recipe.settings.colorClustering}  onChange={(v) => setSetting("colorClustering", v)} />
            <Slider label="Contrast"    min={0} max={100} value={recipe.settings.colorContrast}    onChange={(v) => setSetting("colorContrast", v)} />

            <div style={styles.paletteRow}>
              {Object.entries(PALETTES).map(([key, p]) => (
                <button
                  key={key}
                  style={styles.paletteSwatchBtn}
                  title={p.name}
                  onClick={() => setPaletteByKey(key)}
                >
                  {p.colors.map((c, i) => (
                    <span key={i} style={{ ...styles.paletteSwatchChip, background: c }} />
                  ))}
                </button>
              ))}
            </div>

            <div style={styles.customPaletteRow}>
              {recipe.palette.map((c, i) => (
                <input
                  key={i}
                  type="color"
                  value={c}
                  onChange={(e) => updatePaletteColor(i, e.target.value)}
                  style={styles.colorInput}
                />
              ))}
            </div>
          </div>

          <div style={styles.exportRow}>
            <button style={styles.btnPrimary} onClick={exportTS}>Copy TS recipe</button>
            <button style={styles.btnSecondary} onClick={exportJSON}>Copy JSON</button>
          </div>
        </div>
      </div>

      {/* LIBRARY STRIP */}
      <div style={styles.library}>
        <div style={styles.libraryHeader}>
          <span style={styles.libraryTitle}>Library · {library.length}</span>
          {library.length > 0 && (
            <button style={styles.linkBtn} onClick={exportLibrary}>Export all</button>
          )}
        </div>
        <div style={styles.libraryScroll}>
          {library.length === 0 && (
            <div style={styles.libraryEmpty}>
              Save a shape with the button above to start a library.
            </div>
          )}
          {library.map((item) => (
            <div key={item.id} style={styles.libraryItem}>
              <button style={styles.libraryThumb} onClick={() => loadFromLibrary(item)} title={item.name}>
                <ShapePreview recipe={item} frame={item.thumbFrame} width={160} height={160} animate={false} />
              </button>
              <div style={styles.libraryRow}>
                <span style={styles.libraryName}>{item.name}</span>
                <button style={styles.libraryDel} onClick={() => deleteFromLibrary(item.id)} title="Remove">
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Styles

const C = {
  bg: "#FAFAFA",
  panel: "#FFFFFF",
  ink: "#0A0A0A",
  muted: "rgba(10,10,10,0.55)",
  hair: "rgba(10,10,10,0.1)",
  accent: "#E5202B",
};

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: "100vh",
    background: C.bg,
    color: C.ink,
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    display: "flex",
    flexDirection: "column",
  },
  topbar: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "14px 22px",
    borderBottom: `1px solid ${C.hair}`,
    background: C.panel,
  },
  brand: { display: "flex", flexDirection: "column", lineHeight: 1.1 },
  brandTitle: {
    fontFamily: 'Anton, sans-serif', fontSize: 24, letterSpacing: "-0.02em",
  },
  brandSubtitle: {
    fontSize: 10, letterSpacing: "0.22em", fontWeight: 800,
    color: C.muted, textTransform: "uppercase", marginTop: 2,
  },
  nameInput: {
    flex: 1, maxWidth: 380, font: "inherit", fontSize: 14, fontWeight: 700,
    padding: "8px 12px", border: `1px solid ${C.hair}`, borderRadius: 6,
    background: C.bg, color: C.ink,
  },
  topActions: { display: "flex", gap: 8 },
  btnPrimary: {
    font: "inherit", fontSize: 11, letterSpacing: "0.16em", fontWeight: 800,
    textTransform: "uppercase", padding: "10px 14px", border: "none",
    background: C.ink, color: "#FFF", cursor: "pointer", borderRadius: 4,
  },
  btnSecondary: {
    font: "inherit", fontSize: 11, letterSpacing: "0.16em", fontWeight: 800,
    textTransform: "uppercase", padding: "10px 14px",
    background: "transparent", color: C.ink, cursor: "pointer",
    border: `1px solid ${C.ink}`, borderRadius: 4,
  },
  body: { display: "grid", gridTemplateColumns: "1fr 380px", gap: 0, flex: 1, minHeight: 0 },
  previewWrap: {
    padding: 24, display: "flex", flexDirection: "column", alignItems: "center",
    gap: 16, justifyContent: "center", overflow: "auto",
  },
  previewBox: {
    width: PREVIEW_W, height: PREVIEW_H,
    background: C.panel, border: `1px solid ${C.hair}`,
    boxShadow: "0 12px 32px rgba(0,0,0,0.08)",
  },
  transport: {
    display: "flex", alignItems: "center", gap: 14,
    width: PREVIEW_W, padding: "10px 14px",
    background: C.panel, border: `1px solid ${C.hair}`, borderRadius: 6,
  },
  playBtn: {
    width: 40, height: 40, borderRadius: 999, border: "none",
    background: C.ink, color: "#FFF", cursor: "pointer", fontSize: 14,
  },
  scrubber: { flex: 1 },
  frameLabel: {
    fontFamily: "ui-monospace, SF Mono, monospace", fontSize: 11,
    letterSpacing: "0.06em", color: C.muted, whiteSpace: "nowrap",
  },
  controls: {
    background: C.panel, borderLeft: `1px solid ${C.hair}`,
    overflowY: "auto", padding: "20px 18px 40px",
  },
  section: { paddingBottom: 14, borderBottom: `1px solid ${C.hair}`, marginBottom: 14 },
  sectionTitle: {
    fontSize: 10, letterSpacing: "0.28em", fontWeight: 900,
    textTransform: "uppercase", color: C.ink, marginBottom: 10,
  },
  row: {
    display: "grid", gridTemplateColumns: "92px 1fr 42px", gap: 8,
    alignItems: "center", marginBottom: 8,
  },
  rowLabel: {
    fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
    textTransform: "uppercase", color: C.ink,
  },
  range: { width: "100%" },
  rowValue: {
    fontSize: 11, fontWeight: 800, color: C.muted, textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  },
  select: {
    width: "100%", font: "inherit", fontSize: 12, padding: "5px 6px",
    border: `1px solid ${C.hair}`, background: C.bg, color: C.ink,
    gridColumn: "2 / span 2",
  },
  paletteRow: { display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" },
  paletteSwatchBtn: {
    display: "flex", padding: 2, border: `1px solid ${C.hair}`,
    background: C.bg, cursor: "pointer", borderRadius: 4,
  },
  paletteSwatchChip: { width: 12, height: 16, display: "inline-block" },
  customPaletteRow: { display: "flex", gap: 4, marginTop: 8 },
  colorInput: {
    width: 28, height: 22, border: `1px solid ${C.hair}`, background: C.bg,
    padding: 0, cursor: "pointer",
  },
  exportRow: { display: "flex", gap: 8, marginTop: 8 },
  library: {
    background: C.panel, borderTop: `1px solid ${C.hair}`,
    padding: "12px 22px 14px",
  },
  libraryHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 8,
  },
  libraryTitle: {
    fontSize: 10, letterSpacing: "0.28em", fontWeight: 900,
    textTransform: "uppercase",
  },
  linkBtn: {
    font: "inherit", fontSize: 10, letterSpacing: "0.18em", fontWeight: 800,
    textTransform: "uppercase", background: "transparent", border: "none",
    cursor: "pointer", color: C.ink,
  },
  libraryScroll: {
    display: "flex", gap: 10, overflowX: "auto", padding: "4px 0",
    minHeight: 200,
  },
  libraryEmpty: {
    fontSize: 12, color: C.muted, fontStyle: "italic",
    padding: "60px 0 0 4px",
  },
  libraryItem: { display: "flex", flexDirection: "column", flexShrink: 0, width: 160 },
  libraryThumb: {
    width: 160, height: 160, border: `1px solid ${C.hair}`,
    background: C.bg, padding: 0, cursor: "pointer",
  },
  libraryRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "4px 2px 0",
  },
  libraryName: {
    fontSize: 11, fontWeight: 700, color: C.ink, overflow: "hidden",
    textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  libraryDel: {
    border: "none", background: "transparent", cursor: "pointer",
    color: C.muted, fontSize: 16, padding: 0, lineHeight: 1,
  },
  toast: {
    position: "fixed", bottom: 24, right: 24, background: C.ink,
    color: "#FFF", padding: "12px 18px", fontSize: 11,
    letterSpacing: "0.22em", fontWeight: 900, textTransform: "uppercase",
    boxShadow: "0 8px 24px rgba(0,0,0,0.25)", zIndex: 100,
  },
};
