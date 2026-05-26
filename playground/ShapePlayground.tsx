// @refresh reset
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ShapeRenderer,
  SHAPE_BUILDERS,
  SHAPE_FAMILIES,
  type ShapeFamily,
  type RevealOverrides,
} from "./showcaseShapes";

// ShapePlayground — interactive editor for the 24 showcase shape
// families + their GSAP stagger animation parameters. Controls on
// the left, live shape preview on the right. Bumping any control
// re-fires the GSAP timeline so changes preview instantly.

const PALETTES: Record<string, { name: string; colors: string[] }> = {
  brazil: { name: "Brazil", colors: ["#FEDD00", "#009C3B", "#002776", "#FFFFFF", "#000000"] },
  france: { name: "France", colors: ["#0055A4", "#EF4135", "#EFEFEF", "#FFFFFF", "#000000"] },
  argentina: { name: "Argentina", colors: ["#75AADB", "#F6B40E", "#EFEFEF", "#FFFFFF", "#000000"] },
  croatia: { name: "Croatia", colors: ["#FF0000", "#171796", "#EFEFEF", "#FFFFFF", "#000000"] },
  spain: { name: "Spain", colors: ["#AA151B", "#F1BF00", "#FFFFFF", "#000000", "#AD1519"] },
  germany: { name: "Germany", colors: ["#FFCE00", "#DD0000", "#000000", "#FFFFFF", "#222222"] },
  morocco: { name: "Morocco", colors: ["#C1272D", "#006233", "#FFFFFF", "#000000", "#A40C16"] },
  mono: { name: "Mono", colors: ["#FFFFFF", "#888888", "#444444", "#222222", "#000000"] },
};

const EASES = [
  "back.out(3.4)",
  "back.out(1.7)",
  "back.in(2)",
  "back.inOut(1.7)",
  "power1.out",
  "power2.out",
  "power3.out",
  "power4.out",
  "expo.out",
  "elastic.out(1, 0.4)",
  "elastic.out(1, 0.8)",
  "bounce.out",
  "circ.out",
  "sine.out",
  "none",
];

const MODES: Array<"burst" | "fade" | "grow"> = ["burst", "fade", "grow"];
const STAGGER_FROMS: Array<"start" | "random" | "center" | "edges"> = [
  "start", "random", "center", "edges",
];

// Per-family tuned presets. When the family dropdown changes, the
// playground snaps every other control to that shape's preset so
// each family can have its own "best settings" remembered. Add new
// entries by tweaking a shape in the playground and pinning the
// resulting GSAP-config block here.
type ShapePreset = {
  paletteKey: string;
  seed: number;
  staggerSec: number;
  durationSec: number;
  easeKey: string;
  forceMode: "" | "burst" | "fade" | "grow";
  staggerFrom: "start" | "random" | "center" | "edges";
};

const DEFAULT_PRESET: ShapePreset = {
  paletteKey: "brazil",
  seed: 42,
  staggerSec: 2.3,
  durationSec: 0.8,
  easeKey: "back.out(3.4)",
  forceMode: "",
  staggerFrom: "center",
};

const SHAPE_PRESETS: Partial<Record<ShapeFamily, ShapePreset>> = {
  modular_x: {
    paletteKey: "brazil",
    seed: 42,
    staggerSec: 2.3,
    durationSec: 0.8,
    easeKey: "back.out(3.4)",
    forceMode: "",
    staggerFrom: "center",
  },
  fragmented_burst: {
    paletteKey: "brazil",
    seed: 42,
    staggerSec: 2.3,
    durationSec: 0.8,
    easeKey: "back.in(2)",
    forceMode: "",
    staggerFrom: "center",
  },
  polar_vortex: {
    paletteKey: "brazil",
    seed: 42,
    staggerSec: 2.15,
    durationSec: 0.8,
    easeKey: "power2.out",
    forceMode: "",
    staggerFrom: "center",
  },
};

export const ShapePlayground: React.FC = () => {
  // Default opens on the most recently pinned preset.
  const [family, setFamily] = useState<ShapeFamily>("polar_vortex");
  const initialPreset = SHAPE_PRESETS["polar_vortex"] ?? DEFAULT_PRESET;
  const [paletteKey, setPaletteKey] = useState<string>(initialPreset.paletteKey);
  const [seedInput, setSeedInput] = useState<number>(initialPreset.seed);
  const [staggerSec, setStaggerSec] = useState<number>(initialPreset.staggerSec);
  const [durationSec, setDurationSec] = useState<number>(initialPreset.durationSec);
  const [easeKey, setEaseKey] = useState<string>(initialPreset.easeKey);
  const [forceMode, setForceMode] = useState<"" | "burst" | "fade" | "grow">(initialPreset.forceMode);
  const [staggerFrom, setStaggerFrom] = useState<"start" | "random" | "center" | "edges">(initialPreset.staggerFrom);

  // When the shape changes, snap every other control to that
  // shape's preset (or the default if none is registered yet).
  const applyPreset = (f: ShapeFamily) => {
    const p = SHAPE_PRESETS[f] ?? DEFAULT_PRESET;
    setPaletteKey(p.paletteKey);
    setSeedInput(p.seed);
    setStaggerSec(p.staggerSec);
    setDurationSec(p.durationSec);
    setEaseKey(p.easeKey);
    setForceMode(p.forceMode);
    setStaggerFrom(p.staggerFrom);
  };
  const [playToken, setPlayToken] = useState(0);
  const [frame, setFrame] = useState<number>(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(performance.now());

  // Perpetual rAF for wrap animations.
  useEffect(() => {
    let cancelled = false;
    const tick = (now: number) => {
      if (cancelled) return;
      setFrame(((now - startRef.current) / 1000) * 30);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const SIZE = 540;
  const palette = PALETTES[paletteKey]!.colors;
  const { cells, focal, wrapAnimation } = useMemo(() => {
    try {
      return SHAPE_BUILDERS[family](seedInput, SIZE, palette);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`[ShapePlayground] builder ${family} threw:`, e);
      return { cells: [], focal: { x: 0, y: 0 }, wrapAnimation: undefined };
    }
  }, [family, seedInput, palette]);

  const overrides: RevealOverrides = useMemo(
    () => ({
      staggerSec,
      cellDurationSec: durationSec,
      ease: easeKey,
      forceMode: forceMode === "" ? undefined : forceMode,
      staggerFrom,
    }),
    [staggerSec, durationSec, easeKey, forceMode, staggerFrom],
  );

  const handleReplay = () => {
    startRef.current = performance.now();
    setFrame(0);
    setPlayToken((t) => t + 1);
  };

  const handleRandomSeed = () => {
    setSeedInput(Math.floor(Math.random() * 1e6));
    setPlayToken((t) => t + 1);
  };

  return (
    <div style={styles.shell}>
      <aside style={styles.panel}>
        <div style={styles.brand}>
          <span style={styles.brandTitle}>SHAPE PLAYGROUND</span>
          <span style={styles.brandSub}>GSAP stagger editor · {SHAPE_FAMILIES.length} shapes</span>
        </div>

        <Section label="Shape">
          <select
            value={family}
            onChange={(e) => {
              const f = e.target.value as ShapeFamily;
              setFamily(f);
              applyPreset(f);
              setPlayToken((t) => t + 1);
            }}
            style={styles.select}
          >
            {SHAPE_FAMILIES.map((f) => (
              <option key={f} value={f}>{f.replace(/_/g, " ")}</option>
            ))}
          </select>
        </Section>

        <Section label="Palette">
          <div style={styles.swatchRow}>
            {Object.entries(PALETTES).map(([k, p]) => (
              <button
                key={k}
                onClick={() => { setPaletteKey(k); setPlayToken((t) => t + 1); }}
                title={p.name}
                style={{
                  ...styles.swatch,
                  outline: k === paletteKey ? "2px solid #FFF" : "1px solid rgba(255,255,255,0.18)",
                }}
              >
                {p.colors.slice(0, 4).map((c, i) => (
                  <span key={i} style={{ background: c, flex: 1, height: "100%" }} />
                ))}
              </button>
            ))}
          </div>
        </Section>

        <Section label="Seed">
          <div style={styles.row}>
            <input
              type="number"
              value={seedInput}
              onChange={(e) => { setSeedInput(Number(e.target.value) || 0); setPlayToken((t) => t + 1); }}
              style={styles.numInput}
            />
            <button onClick={handleRandomSeed} style={styles.button}>random</button>
          </div>
        </Section>

        <Section label="Stagger window">
          <Slider value={staggerSec} min={0.1} max={6} step={0.05} unit="s"
            onChange={(v) => { setStaggerSec(v); setPlayToken((t) => t + 1); }} />
        </Section>

        <Section label="Per-cell duration">
          <Slider value={durationSec} min={0.05} max={2.5} step={0.05} unit="s"
            onChange={(v) => { setDurationSec(v); setPlayToken((t) => t + 1); }} />
        </Section>

        <Section label="Ease">
          <select
            value={easeKey}
            onChange={(e) => { setEaseKey(e.target.value); setPlayToken((t) => t + 1); }}
            style={styles.select}
          >
            {EASES.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </Section>

        <Section label="Force reveal mode">
          <select
            value={forceMode}
            onChange={(e) => { setForceMode(e.target.value as "" | "burst" | "fade" | "grow"); setPlayToken((t) => t + 1); }}
            style={styles.select}
          >
            <option value="">(use per-cell default)</option>
            {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Section>

        <Section label="Stagger from">
          <select
            value={staggerFrom}
            onChange={(e) => { setStaggerFrom(e.target.value as typeof staggerFrom); setPlayToken((t) => t + 1); }}
            style={styles.select}
          >
            {STAGGER_FROMS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </Section>

        <Section label="">
          <button onClick={handleReplay} style={styles.bigButton}>▶ REPLAY</button>
        </Section>

        <PresetBox
          family={family}
          paletteKey={paletteKey}
          seedInput={seedInput}
          staggerSec={staggerSec}
          durationSec={durationSec}
          easeKey={easeKey}
          forceMode={forceMode}
          staggerFrom={staggerFrom}
        />
      </aside>

      <main style={styles.stage}>
        <div style={styles.canvas}>
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
              wrapAnimation={wrapAnimation}
              playToken={playToken}
              revealOverrides={overrides}
            />
          </svg>
        </div>
        <div style={styles.statRow}>
          <span>cells <b>{cells.length}</b></span>
          <span>{family.replace(/_/g, " ")}</span>
          <span>play #{playToken}</span>
        </div>
      </main>
    </div>
  );
};

const Section: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={styles.section}>
    {label ? <div style={styles.sectionLabel}>{label}</div> : null}
    {children}
  </div>
);

// PresetBox — shows the live GSAP config in two formats:
//   1) plain-text summary (the same readable block as before)
//   2) JS object literal ready to paste into SHAPE_PRESETS in
//      ShapePlayground.tsx, with a single Copy button
// Lets you sculpt a config in the playground and snap it into the
// per-family preset map without retyping.
const PresetBox: React.FC<{
  family: string;
  paletteKey: string;
  seedInput: number;
  staggerSec: number;
  durationSec: number;
  easeKey: string;
  forceMode: "" | "burst" | "fade" | "grow";
  staggerFrom: "start" | "random" | "center" | "edges";
}> = (p) => {
  const [copied, setCopied] = useState(false);
  const summary = [
    `family: "${p.family}"`,
    `palette: "${p.paletteKey}"`,
    `seed: ${p.seedInput}`,
    `stagger: ${p.staggerSec.toFixed(2)}s`,
    `duration: ${p.durationSec.toFixed(2)}s`,
    `ease: "${p.easeKey}"`,
    p.forceMode ? `mode: "${p.forceMode}"` : `mode: <per-cell>`,
    `from: "${p.staggerFrom}"`,
  ].join("\n");
  const presetEntry =
    `${p.family}: {\n` +
    `  paletteKey: "${p.paletteKey}",\n` +
    `  seed: ${p.seedInput},\n` +
    `  staggerSec: ${p.staggerSec.toFixed(2)},\n` +
    `  durationSec: ${p.durationSec.toFixed(2)},\n` +
    `  easeKey: ${JSON.stringify(p.easeKey)},\n` +
    `  forceMode: ${JSON.stringify(p.forceMode)},\n` +
    `  staggerFrom: "${p.staggerFrom}",\n` +
    `},`;
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(presetEntry);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard API may fail in some contexts (e.g. http on non-localhost).
      // Fall back: select the <pre> contents and copy via execCommand.
      const el = document.getElementById("preset-code");
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        document.execCommand("copy");
        sel?.removeAllRanges();
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }
    }
  };
  return (
    <>
      <div style={styles.codeBox}>
        <div style={styles.codeLabel}>GSAP CONFIG</div>
        <pre style={styles.codePre}>{summary}</pre>
      </div>
      <div style={styles.codeBox}>
        <div style={styles.codeHeader}>
          <span style={styles.codeLabel}>SHAPE_PRESETS ENTRY</span>
          <button onClick={handleCopy} style={styles.copyButton}>
            {copied ? "✓ copied" : "copy"}
          </button>
        </div>
        <pre id="preset-code" style={styles.codePre}>{presetEntry}</pre>
      </div>
    </>
  );
};

const Slider: React.FC<{
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}> = ({ value, min, max, step, unit, onChange }) => (
  <div style={styles.sliderRow}>
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      style={styles.slider}
    />
    <span style={styles.sliderValue}>{value.toFixed(2)}{unit ?? ""}</span>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: "flex",
    minHeight: "100vh",
    width: "100%",
    background: "#0A0A0A",
    color: "#FFFFFF",
    fontFamily:
      'Inter, "Roboto Flex", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    overflow: "hidden",
  },
  panel: {
    width: 340,
    flexShrink: 0,
    padding: 24,
    borderRight: "1px solid rgba(255,255,255,0.06)",
    background: "#0A0A0A",
    overflowY: "auto",
    height: "100vh",
    boxSizing: "border-box",
  },
  brand: {
    display: "flex",
    flexDirection: "column",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: 4,
  },
  brandSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 1.5,
    marginTop: 4,
  },
  section: {
    marginBottom: 18,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 3,
    color: "rgba(255,255,255,0.55)",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  row: { display: "flex", gap: 8 },
  select: {
    width: "100%",
    height: 34,
    padding: "0 10px",
    background: "#161616",
    color: "#FFFFFF",
    border: "1px solid rgba(255,255,255,0.12)",
    fontSize: 13,
    fontFamily: "inherit",
  },
  numInput: {
    flex: 1,
    height: 34,
    padding: "0 10px",
    background: "#161616",
    color: "#FFFFFF",
    border: "1px solid rgba(255,255,255,0.12)",
    fontSize: 13,
    fontFamily: "inherit",
  },
  button: {
    height: 34,
    padding: "0 14px",
    background: "#161616",
    color: "#FFFFFF",
    border: "1px solid rgba(255,255,255,0.18)",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 2,
    cursor: "pointer",
  },
  bigButton: {
    width: "100%",
    height: 44,
    padding: "0 14px",
    background: "#FFFFFF",
    color: "#0A0A0A",
    border: "none",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 3,
    cursor: "pointer",
  },
  swatchRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 6,
  },
  swatch: {
    height: 28,
    border: "none",
    cursor: "pointer",
    padding: 0,
    display: "flex",
    background: "transparent",
  },
  sliderRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  slider: {
    flex: 1,
    accentColor: "#FFFFFF",
  },
  sliderValue: {
    fontSize: 11,
    fontFamily: "ui-monospace, monospace",
    color: "rgba(255,255,255,0.85)",
    minWidth: 50,
    textAlign: "right",
  },
  codeBox: {
    marginTop: 16,
    padding: 14,
    background: "#141414",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  codeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 3,
    color: "rgba(255,255,255,0.55)",
  },
  copyButton: {
    height: 24,
    padding: "0 10px",
    background: "rgba(255,255,255,0.1)",
    color: "#FFFFFF",
    border: "1px solid rgba(255,255,255,0.18)",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 2,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  codePre: {
    margin: 0,
    fontFamily: "ui-monospace, monospace",
    fontSize: 11,
    lineHeight: 1.6,
    color: "rgba(255,255,255,0.85)",
    whiteSpace: "pre-wrap",
  },
  stage: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
    minHeight: 0,
    background: "#000000",
  },
  canvas: {
    width: "min(640px, 70vh)",
    aspectRatio: "1 / 1",
    background: "#0A0A0A",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  statRow: {
    display: "flex",
    gap: 32,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.55)",
  },
};
