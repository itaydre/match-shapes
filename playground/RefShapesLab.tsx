// @refresh reset
import React, { useMemo } from "react";
import { ShapeRenderer } from "./showcaseShapes";
import { REF_SHAPES } from "./refShapes";

// RefShapesLab — static preview grid for the experimental ref-folder
// shapes. Each card paints one shape at its final state (no animation)
// on a flag-only palette. Separate from the production showcase.

const PALETTES: Array<{ name: string; colors: string[] }> = [
  { name: "Brazil", colors: ["#FEDD00", "#009C3B", "#002776", "#FFFFFF"] },
  { name: "France", colors: ["#0055A4", "#EF4135", "#FFFFFF"] },
  { name: "Argentina", colors: ["#75AADB", "#F6B40E", "#FFFFFF"] },
  { name: "Germany", colors: ["#000000", "#DD0000", "#FFCE00"] },
  { name: "Italy", colors: ["#008C45", "#FFFFFF", "#CD212A"] },
  { name: "Netherlands", colors: ["#AE1C28", "#FFFFFF", "#21468B"] },
];

const SIZE = 460;

export const RefShapesLab: React.FC = () => {
  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <span style={styles.title}>REF SHAPES · INVENTED FROM new_15.5</span>
        <span style={styles.subtitle}>static · radial / op-art family</span>
      </div>
      <div className="ref-grid" style={styles.grid}>
        {REF_SHAPES.map((shape, i) => (
          <Card key={shape.key} index={i + 1} shape={shape} palette={PALETTES[i % PALETTES.length]!} />
        ))}
      </div>
    </div>
  );
};

const Card: React.FC<{
  index: number;
  shape: (typeof REF_SHAPES)[number];
  palette: { name: string; colors: string[] };
}> = ({ index, shape, palette }) => {
  const { cells, focal } = useMemo(() => {
    try {
      return shape.build(1234 + index * 7, SIZE, palette.colors);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`[RefShapesLab] ${shape.key} threw:`, e);
      return { cells: [], focal: { x: 0, y: 0 } };
    }
  }, [shape, palette, index]);

  return (
    <div style={styles.card}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`-${SIZE / 2 + SIZE * 0.12} -${SIZE / 2 + SIZE * 0.12} ${SIZE * 1.24} ${SIZE * 1.24}`}
        width="100%"
        height="100%"
        style={{ display: "block" }}
      >
        {/* Static — final state, no reveal. */}
        <ShapeRenderer cells={cells} focal={focal} localFrame={300} playToken={0} autoPlay={false} />
      </svg>
      <div style={styles.footer}>
        <span style={styles.label}>
          {index}. {shape.label.toUpperCase()}
        </span>
        <span style={styles.team}>{palette.name.toUpperCase()}</span>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    width: "100%",
    background: "#FFFFFF",
    color: "#0A0A0A",
    fontFamily: '"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif',
    padding: "32px 32px 64px",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 28,
    letterSpacing: 2,
  },
  title: { fontSize: 14, fontWeight: 800, letterSpacing: 4 },
  subtitle: { fontSize: 11, fontWeight: 500, letterSpacing: 3, color: "rgba(0,0,0,0.5)" },
  grid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 },
  card: {
    position: "relative",
    aspectRatio: "1 / 1",
    background: "#F5F5F5",
    border: "1px solid rgba(0,0,0,0.08)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: "10px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 11,
    letterSpacing: 2,
    color: "rgba(0,0,0,0.75)",
    background: "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.85) 100%)",
    pointerEvents: "none",
  },
  label: { fontWeight: 800 },
  team: { fontWeight: 500, color: "rgba(0,0,0,0.5)" },
};
