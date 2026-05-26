// @refresh reset
import React, { useMemo, useState } from "react";
import {
  StaticPreviewV3,
  DEFAULT_LAYOUT,
  type LayoutConfig,
} from "./StaticPreviewV3";
import type { StaticPreviewTeam } from "./StaticPreview";
import { makeGoal, ev, v1BuildFamilyMap } from "./GameGallery";

// BlankCardLab — reference sketch (left) beside a live render (centre),
// with a controls sidebar (right) that drives the field layout live via
// StaticPreviewV3's `layout` prop.

// Full-time frame (last of 270) so every goal has fired and the
// possession readout has settled to its final share — the lab now
// previews a populated card (goals + minute labels + possession %),
// not just the blank 0-0 pitch.
const REVIEW_FRAME = 269;

// Sample fixture data: Mexico 2-1 South Africa (matches the reference
// sketch) — South Africa's 6-colour flag demonstrates the per-colour
// bar count.
const GOALS = [
  makeGoal("bc-1", "home", 24, "HIRVING LOZANO", "radial_burst", "circle", 0),
  makeGoal("bc-2", "away", 70, "LYLE MOTHIBA", "wedges", "oval", 1),
  makeGoal("bc-3", "home", 81, "SANTIAGO GIMENEZ", "particle_burst", "arch", 2),
];
const EVENTS = [
  ev("bc-s1", "home", 9, "shot"),
  ev("bc-c1", "home", 19, "corner"),
  ev("bc-yc1", "away", 31, "yellow_card"),
  ev("bc-s2", "away", 44, "shot"),
  ev("bc-c2", "home", 62, "corner"),
  ev("bc-s3", "home", 78, "shot"),
];
const FINAL_HOME_POSSESSION = 0.58;

const HOME: StaticPreviewTeam = {
  name: "Mexico",
  flagPrimary: "#006847", // green
  flagSecondary: "#CE1126", // red
  flagAccent: "#FFFFFF", // white
  flagWeights: [0.4, 0.4, 0.2],
  // Mexico's flag: green, white, red (3 vertical bands).
  flagColors: ["#006847", "#FFFFFF", "#CE1126"],
  goalLang: "es",
};

const AWAY: StaticPreviewTeam = {
  name: "South Africa",
  flagPrimary: "#007A4D", // green
  flagSecondary: "#DE3831", // red
  flagAccent: "#002395", // blue
  flagWeights: [0.45, 0.3, 0.25],
  // South Africa's flag: 6 distinct colours → 6 equal bars.
  flagColors: ["#DE3831", "#FFFFFF", "#007A4D", "#FFB81C", "#000000", "#002395"],
  goalLang: "en",
};

type SliderDef = {
  key: keyof LayoutConfig;
  label: string;
  min: number;
  max: number;
  step: number;
};

const SLIDERS: SliderDef[] = [
  { key: "sideInset", label: "Side inset", min: 60, max: 140, step: 0.1 },
  { key: "topInset", label: "Top inset", min: 100, max: 240, step: 0.1 },
  { key: "bottomInset", label: "Bottom inset", min: 100, max: 240, step: 0.1 },
  { key: "barH", label: "Bar height", min: 6, max: 48, step: 1 },
  { key: "teamNameSize", label: "Team name size", min: 50, max: 150, step: 1 },
  { key: "circleScale", label: "Midfield circle", min: 0.1, max: 0.4, step: 0.001 },
  { key: "sideTextSize", label: "Side text size", min: 12, max: 44, step: 1 },
  { key: "sideTextWeight", label: "Side text weight", min: 300, max: 900, step: 10 },
  { key: "scoreSize", label: "Score size", min: 500, max: 1000, step: 1 },
  { key: "scoreWeight", label: "Score weight", min: 250, max: 900, step: 1 },
  { key: "scoreTopOffset", label: "Score top offset", min: 0, max: 500, step: 1 },
  { key: "scoreBottomOffset", label: "Score bottom offset", min: 0, max: 500, step: 1 },
  { key: "goalLabelSize", label: "Goal label size", min: 16, max: 96, step: 1 },
  { key: "goalLabelWeight", label: "Goal label weight", min: 300, max: 900, step: 10 },
  { key: "possessionSize", label: "Possession size", min: 16, max: 96, step: 1 },
  { key: "possessionWeight", label: "Possession weight", min: 300, max: 900, step: 10 },
];

export const BlankCardLab: React.FC = () => {
  const [layout, setLayout] = useState<LayoutConfig>({ ...DEFAULT_LAYOUT });
  const familyMap = useMemo(
    () => v1BuildFamilyMap("blank-card", GOALS),
    [],
  );

  const set = (key: keyof LayoutConfig, value: number) =>
    setLayout((l) => ({ ...l, [key]: value }));

  return (
    <div style={styles.shell}>
      <img src="/blank-card-ref.png" alt="reference sketch" style={styles.card} />
      <div style={styles.card}>
        <StaticPreviewV3
          goals={GOALS}
          frame={REVIEW_FRAME}
          home={HOME}
          away={AWAY}
          competition="WORLD CUP 2026"
          venueAndDate="Estadio Azteca | 11.6.2026"
          finalHomePossession={FINAL_HOME_POSSESSION}
          events={EVENTS}
          familyForGoal={(g) => familyMap.get(g.id)!}
          showLabelWell={false}
          layout={layout}
        />
      </div>
      <div style={styles.panel}>
        <div style={styles.panelHead}>
          <span style={styles.panelTitle}>FIELD CONTROLS</span>
          <button
            style={styles.reset}
            onClick={() => setLayout({ ...DEFAULT_LAYOUT })}
          >
            reset
          </button>
        </div>
        {SLIDERS.map((s) => (
          <label key={s.key} style={styles.row}>
            <div style={styles.rowTop}>
              <span>{s.label}</span>
              <span style={styles.val}>
                {s.step < 1 ? layout[s.key].toFixed(3) : Math.round(layout[s.key])}
              </span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={layout[s.key]}
              onChange={(e) => set(s.key, Number(e.target.value))}
              style={styles.slider}
            />
          </label>
        ))}
        <button
          style={styles.copy}
          onClick={() => {
            // eslint-disable-next-line no-console
            console.log("layout =", JSON.stringify(layout, null, 2));
          }}
        >
          log values to console
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  shell: {
    background: "#0E0E0E",
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 20,
    padding: 16,
    boxSizing: "border-box",
    overflow: "auto",
  },
  card: {
    width: "min(380px, 90vh * 0.5625)",
    aspectRatio: "1080 / 1920",
    background: "#F4F4F4",
    boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
    objectFit: "contain",
    display: "block",
    flexShrink: 0,
  },
  panel: {
    width: 280,
    flexShrink: 0,
    background: "#1A1A1A",
    border: "1px solid #2C2C2C",
    borderRadius: 8,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    color: "#E6E6E6",
    fontFamily: "ui-monospace, monospace",
    fontSize: 12,
    position: "sticky",
    top: 16,
  },
  panelHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  panelTitle: { fontWeight: 700, letterSpacing: 2 },
  reset: {
    background: "#333",
    color: "#EEE",
    border: "none",
    borderRadius: 4,
    padding: "4px 10px",
    cursor: "pointer",
    fontSize: 11,
  },
  row: { display: "flex", flexDirection: "column", gap: 4 },
  rowTop: { display: "flex", justifyContent: "space-between" },
  val: { color: "#7FB0FF" },
  slider: { width: "100%" },
  copy: {
    marginTop: 4,
    background: "#2563EB",
    color: "#FFF",
    border: "none",
    borderRadius: 4,
    padding: "8px 10px",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 700,
  },
};
