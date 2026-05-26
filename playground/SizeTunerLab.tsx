import React, { useMemo, useState } from "react";
import { StaticPreviewV3, computeTierByGoalId } from "./StaticPreviewV3";
import {
  GAMES,
  MATCH_CONTEXTS,
  DEFAULT_MATCH_CONTEXT,
} from "./GameGallery";
import { computeGoalImportance } from "../src/lib/goalImportance";

// Size Tuner — a single fixture (France 4–2 Croatia, 2018 final) wired
// to live S/M/L slider controls. The three sliders drive the
// `tierSizes` prop on StaticPreviewV3 — each tier is a fraction of the
// PITCH WIDTH (an absolute reference), so you see the absolute shape
// sizes recompute as you drag. Tier ASSIGNMENT uses the shared
// computeTierByGoalId rule (winning goal / underdog first / late
// equaliser / 1-0 → L; consolation → S; else M/S by importance).

const GAME = GAMES.find((g) => g.id === "wc18-final-fr-cr")!;

// Frame near match-end so every goal's shape is fully rendered.
const STATIC_FRAME = 175;

const DEFAULTS = { S: 0.35, M: 0.65, L: 0.9 };
// Pitch width that the tier fractions multiply (default layout:
// 1080 − 2×125 side inset). Used to show the absolute px per tier.
const PITCH_W = 830;

const Slider: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
}> = ({ label, value, onChange }) => (
  <label style={styles.sliderRow}>
    <span style={styles.sliderLabel}>{label}</span>
    <input
      type="range"
      min={0.2}
      max={1.4}
      step={0.01}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={styles.range}
    />
    <span style={styles.sliderValue}>{value.toFixed(2)}</span>
  </label>
);

export const SizeTunerLab: React.FC = () => {
  const [tierSizes, setTierSizes] = useState(DEFAULTS);

  // Per-goal importance (0..1) — drives which goal ranks where, exactly
  // as the gallery computes it. Stable for this fixture.
  const importanceById = useMemo(() => {
    const ctx = MATCH_CONTEXTS[GAME.id] ?? DEFAULT_MATCH_CONTEXT;
    const map = new Map<string, number>();
    for (const g of GAME.goals) {
      const b = computeGoalImportance(
        { id: g.id, team: g.team, minute: g.minute },
        GAME.goals.map((x) => ({ id: x.id, team: x.team, minute: x.minute })),
        ctx,
      );
      map.set(g.id, b.importance);
    }
    return map;
  }, []);

  // Pre-match underdog (lower strength) — feeds the LARGE "first goal by
  // the underdog" rule, same as the gallery.
  const underdog: "home" | "away" = useMemo(() => {
    const ctx = MATCH_CONTEXTS[GAME.id] ?? DEFAULT_MATCH_CONTEXT;
    return ctx.homeStrength <= ctx.awayStrength ? "home" : "away";
  }, []);

  // Tier readout — uses the SHARED rule so the panel matches the card.
  const ranking = useMemo(() => {
    const tiers = computeTierByGoalId(GAME.goals, importanceById, underdog);
    return [...GAME.goals]
      .sort((a, b) => {
        const di =
          (importanceById.get(b.id) ?? 0) - (importanceById.get(a.id) ?? 0);
        if (di !== 0) return di;
        if (a.minute !== b.minute) return a.minute - b.minute;
        return a.id < b.id ? -1 : 1;
      })
      .map((g) => ({
        scorer: g.scorer,
        minute: g.minute,
        team: g.team,
        importance: importanceById.get(g.id) ?? 0,
        tier: tiers.get(g.id) ?? ("M" as "S" | "M" | "L"),
      }));
  }, [importanceById, underdog]);

  const set = (k: "S" | "M" | "L") => (v: number) =>
    setTierSizes((prev) => ({ ...prev, [k]: v }));

  return (
    <div style={styles.page}>
      <aside style={styles.panel}>
        <h1 style={styles.title}>Size Tuner</h1>
        <p style={styles.sub}>
          France 4–2 Croatia · 2018 final. Drag to set the three tier
          fractions (× pitch width ≈ {PITCH_W}px → absolute shape size).
        </p>

        <div style={styles.sliders}>
          <Slider label="S" value={tierSizes.S} onChange={set("S")} />
          <Slider label="M" value={tierSizes.M} onChange={set("M")} />
          <Slider label="L" value={tierSizes.L} onChange={set("L")} />
        </div>
        <div style={styles.pxRow}>
          {(["S", "M", "L"] as const).map((k) => (
            <span key={k} style={styles.pxChip}>
              {k} ≈ {Math.round(tierSizes[k] * PITCH_W)}px
            </span>
          ))}
        </div>

        <button
          style={styles.reset}
          onClick={() => setTierSizes(DEFAULTS)}
        >
          Reset to {DEFAULTS.S} / {DEFAULTS.M} / {DEFAULTS.L}
        </button>

        <h2 style={styles.h2}>Tiers this game</h2>
        <ul style={styles.list}>
          {ranking.map((r) => (
            <li key={r.scorer + r.minute} style={styles.listItem}>
              <span style={{ ...styles.tierBadge, ...badgeColor(r.tier) }}>
                {r.tier}
              </span>
              <span style={styles.scorer}>
                {r.minute}&apos; {r.scorer}
              </span>
              <span style={styles.imp}>{r.importance.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </aside>

      <main style={styles.stage}>
        <div style={styles.cardWrap}>
          <StaticPreviewV3
            goals={GAME.goals}
            frame={STATIC_FRAME}
            home={GAME.home}
            away={GAME.away}
            competition={GAME.competition}
            venueAndDate={GAME.venueAndDate}
            finalHomePossession={GAME.finalHomePossession}
            events={GAME.events}
            importanceById={importanceById}
            tierSizes={tierSizes}
            underdog={underdog}
          />
        </div>
      </main>
    </div>
  );
};

const badgeColor = (tier: "S" | "M" | "L"): React.CSSProperties => {
  if (tier === "L") return { background: "#1B53C0", color: "#fff" };
  if (tier === "M") return { background: "#9AB0E0", color: "#0a0a0a" };
  return { background: "#E2E6F0", color: "#555" };
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: "flex",
    minHeight: "100vh",
    background: "#1a1a1a",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
  },
  panel: {
    width: 320,
    flexShrink: 0,
    padding: "28px 24px",
    background: "#111",
    color: "#eee",
    borderRight: "1px solid #2a2a2a",
  },
  title: { fontSize: 22, fontWeight: 800, margin: "0 0 6px" },
  sub: { fontSize: 13, lineHeight: 1.5, color: "#9a9a9a", margin: "0 0 24px" },
  sliders: { display: "flex", flexDirection: "column", gap: 16 },
  sliderRow: { display: "flex", alignItems: "center", gap: 12 },
  sliderLabel: { width: 18, fontWeight: 700, fontSize: 15 },
  range: { flex: 1 },
  sliderValue: {
    width: 44,
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    fontSize: 14,
    color: "#cfcfcf",
  },
  pxRow: {
    display: "flex",
    gap: 8,
    marginTop: 12,
  },
  pxChip: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontVariantNumeric: "tabular-nums",
    color: "#bbb",
    background: "#1c1c1c",
    border: "1px solid #2a2a2a",
    borderRadius: 5,
    padding: "4px 0",
  },
  reset: {
    marginTop: 18,
    padding: "8px 12px",
    fontSize: 12,
    background: "#222",
    color: "#ccc",
    border: "1px solid #333",
    borderRadius: 6,
    cursor: "pointer",
  },
  h2: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#777",
    margin: "32px 0 10px",
  },
  list: { listStyle: "none", margin: 0, padding: 0 },
  listItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 0",
    fontSize: 13,
    borderBottom: "1px solid #222",
  },
  tierBadge: {
    width: 22,
    height: 22,
    borderRadius: 5,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 12,
    flexShrink: 0,
  },
  scorer: { flex: 1, color: "#ddd" },
  imp: {
    fontVariantNumeric: "tabular-nums",
    color: "#888",
    fontSize: 12,
  },
  stage: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    overflow: "auto",
  },
  cardWrap: {
    width: "min(440px, 90vh * 0.56)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  },
};
