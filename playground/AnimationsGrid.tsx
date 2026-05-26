// @refresh reset
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ShapePreview, type ShapeRecipe } from "./ShapeStudio";
import {
  GOAL_PERSONALITIES,
  type GoalPersonality,
} from "./GameGallery";
import { ANIMATION_SET } from "../src/lib/animationSet";
import { DEFAULT_SETTINGS } from "../src/lib/cellGrid";

// AnimationsGrid — single static specimen page showing every shape
// animation at its final settled frame. Two sections:
//   1. The 14 goal personalities (used inside game cards)
//   2. The curated ANIMATION_SET presets
// No interaction — just a design-audit surface.

const FINAL_FRAME = 269;
const TILE = 240;

// Showcase palettes. The grid uses one palette across the whole page
// so visual differences read as shape variety, not colour variety.
const PALETTES: Record<string, { name: string; colors: string[] }> = {
  brazil: { name: "Brazil", colors: ["#009C3B", "#FEDD00", "#002776"] },
  argentina: { name: "Argentina", colors: ["#75AADB", "#FFFFFF", "#F6B40E"] },
  france: { name: "France", colors: ["#0055A4", "#FFFFFF", "#EF4135"] },
  germany: { name: "Germany", colors: ["#000000", "#DD0000", "#FFCE00"] },
  morocco: { name: "Morocco", colors: ["#C1272D", "#006233", "#FFFFFF"] },
  ink: { name: "Ink", colors: ["#0A0A0A", "#3F3F3F", "#888888"] },
  duotone: { name: "Duotone", colors: ["#E5202B", "#0A0A0A", "#F1ECDF"] },
};

// Round-robin expansion to 12 slots — same shape as ShapeStudio so
// the preview math sees an expanded palette.
const expandPalette = (colors: string[]): string[] => {
  const slots = 12;
  const out: string[] = [];
  for (let i = 0; i < slots; i++) out.push(colors[i % colors.length]!);
  return out;
};

// Convert a GoalPersonality (used inside game cards) into the
// ShapeRecipe shape ShapePreview expects.
const personalityToRecipe = (
  p: GoalPersonality,
  idx: number,
  palette: string[],
): ShapeRecipe => ({
  id: `personality-${idx}`,
  name: `Personality ${idx + 1}`,
  type: p.type,
  boundary: p.boundary,
  settings: {
    ...DEFAULT_SETTINGS,
    ...p.settings,
    seed: (p.settings.seed ?? 0) + idx * 47,
  },
  moireStrength: 0,
  blendTarget: "wedges",
  blendAmount: 0,
  recursionDepth: 0,
  palette,
  thumbFrame: FINAL_FRAME,
});

const presetToRecipe = (
  preset: (typeof ANIMATION_SET)[number],
  palette: string[],
): ShapeRecipe => ({
  id: `preset-${preset.id}`,
  name: preset.name,
  type: preset.recipe.type,
  boundary: preset.recipe.boundary,
  settings: preset.recipe.settings,
  moireStrength: preset.recipe.moireStrength,
  blendTarget: preset.recipe.blendTarget,
  blendAmount: preset.recipe.blendAmount,
  recursionDepth: preset.recipe.recursionDepth,
  palette,
  thumbFrame: FINAL_FRAME,
});

export const AnimationsGrid: React.FC = () => {
  const [paletteKey, setPaletteKey] = useState<string>("brazil");
  const palette = useMemo(
    () => expandPalette(PALETTES[paletteKey]!.colors),
    [paletteKey],
  );

  const personalities = useMemo(
    () => GOAL_PERSONALITIES.map((p, i) => personalityToRecipe(p, i, palette)),
    [palette],
  );
  const presets = useMemo(
    () => ANIMATION_SET.map((p) => presetToRecipe(p, palette)),
    [palette],
  );

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <div style={styles.brand}>
          <span style={styles.title}>Animations Grid</span>
          <span style={styles.subtitle}>
            Every shape system, frozen at frame {FINAL_FRAME}
          </span>
        </div>
        <div style={styles.paletteRow}>
          {Object.entries(PALETTES).map(([key, p]) => (
            <button
              key={key}
              style={{
                ...styles.paletteBtn,
                ...(key === paletteKey ? styles.paletteBtnActive : {}),
              }}
              onClick={() => setPaletteKey(key)}
              title={p.name}
            >
              <span style={styles.paletteBtnLabel}>{p.name}</span>
              <span style={styles.paletteBtnChips}>
                {p.colors.map((c, i) => (
                  <span
                    key={i}
                    style={{ ...styles.paletteBtnChip, background: c }}
                  />
                ))}
              </span>
            </button>
          ))}
        </div>
      </header>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>
            Goal Personalities · {personalities.length}
          </span>
          <span style={styles.sectionHint}>
            Drawn into game cards by the per-game shuffle.
          </span>
        </div>
        <div style={styles.grid}>
          {personalities.map((r, idx) => (
            <Tile key={r.id} recipe={r} label={`${idx + 1} · ${r.type}`} />
          ))}
        </div>
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>
            Animation Set · {presets.length}
          </span>
          <span style={styles.sectionHint}>
            Curated presets authored in Shape Studio.
          </span>
        </div>
        <div style={styles.grid}>
          {presets.map((r) => (
            <Tile key={r.id} recipe={r} label={r.name} />
          ))}
        </div>
      </section>
    </div>
  );
};

const Tile: React.FC<{ recipe: ShapeRecipe; label: string }> = ({
  recipe,
  label,
}) => {
  // Each tile owns its own frame state so click can replay just this
  // tile's reveal animation. Default = FINAL_FRAME (fully settled),
  // matching the page's original static-thumbnail behaviour.
  const [frame, setFrame] = useState<number>(FINAL_FRAME);
  const rafRef = useRef<number | null>(null);
  const animatingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      animatingRef.current = false;
    };
  }, []);

  const handleReplay = () => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    const start = performance.now();
    setFrame(0);
    const tick = (now: number) => {
      const f = ((now - start) / 1000) * 30;
      if (f >= FINAL_FRAME) {
        setFrame(FINAL_FRAME);
        animatingRef.current = false;
        rafRef.current = null;
        return;
      }
      setFrame(f);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const showOverlay = !animatingRef.current && frame >= FINAL_FRAME;
  return (
    <div
      style={{ ...styles.tile, cursor: "pointer" }}
      onClick={handleReplay}
      role="button"
      tabIndex={0}
    >
      <div style={{ ...styles.tileCanvas, position: "relative" }}>
        <ShapePreview
          recipe={recipe}
          frame={frame}
          width={TILE}
          height={TILE}
          // ShapePreview only runs the per-cell stagger when
          // animate=true. We always want stagger here so click-to-
          // replay re-erupts the field; the parent owns the playhead
          // via `frame` so the cells march in lockstep with the rAF.
          animate
          showHole={false}
        />
        {showOverlay && (
          <div style={tileStyles.playOverlay}>
            <div style={tileStyles.playBtn}>▶</div>
          </div>
        )}
      </div>
      <div style={styles.tileLabel}>{label}</div>
    </div>
  );
};

const tileStyles: Record<string, React.CSSProperties> = {
  playOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(14,14,14,0.22)",
    pointerEvents: "none",
    opacity: 0.85,
  },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.92)",
    color: "#0E0E0E",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    paddingLeft: 4,
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
  },
};

const C = {
  bg: "#0E0E0E",
  panel: "#161616",
  ink: "#F2F2F2",
  muted: "rgba(242,242,242,0.55)",
  hair: "rgba(255,255,255,0.08)",
};

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: "100vh",
    background: C.bg,
    color: C.ink,
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    paddingBottom: 64,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 24,
    padding: "20px 32px",
    borderBottom: `1px solid ${C.hair}`,
    position: "sticky",
    top: 0,
    background: C.bg,
    zIndex: 5,
    flexWrap: "wrap",
  },
  brand: { display: "flex", flexDirection: "column", lineHeight: 1.1 },
  title: {
    fontFamily: 'Anton, sans-serif',
    fontSize: 28,
    letterSpacing: "-0.02em",
    textTransform: "uppercase",
  },
  subtitle: {
    fontSize: 11,
    letterSpacing: "0.22em",
    fontWeight: 800,
    color: C.muted,
    textTransform: "uppercase",
    marginTop: 4,
  },
  paletteRow: { display: "flex", gap: 6, flexWrap: "wrap" },
  paletteBtn: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    padding: "6px 10px",
    background: "transparent",
    border: `1px solid ${C.hair}`,
    color: C.ink,
    cursor: "pointer",
    font: "inherit",
    borderRadius: 4,
  },
  paletteBtnActive: { borderColor: C.ink, background: "rgba(255,255,255,0.04)" },
  paletteBtnLabel: {
    fontSize: 10,
    letterSpacing: "0.18em",
    fontWeight: 800,
    textTransform: "uppercase",
  },
  paletteBtnChips: { display: "flex", gap: 2 },
  paletteBtnChip: { width: 14, height: 12, display: "inline-block" },
  section: { padding: "24px 32px 8px" },
  sectionHeader: {
    display: "flex",
    alignItems: "baseline",
    gap: 18,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: "0.28em",
    fontWeight: 900,
    textTransform: "uppercase",
    color: C.ink,
  },
  sectionHint: {
    fontSize: 11,
    letterSpacing: "0.06em",
    color: C.muted,
    fontStyle: "italic",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: `repeat(auto-fill, minmax(${TILE}px, 1fr))`,
    gap: 12,
  },
  tile: {
    background: C.panel,
    border: `1px solid ${C.hair}`,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  tileCanvas: {
    aspectRatio: "1 / 1",
    background: "#F4F4F4",
  },
  tileLabel: {
    padding: "10px 12px",
    fontSize: 11,
    letterSpacing: "0.12em",
    fontWeight: 700,
    textTransform: "uppercase",
    color: C.ink,
    borderTop: `1px solid ${C.hair}`,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
};
