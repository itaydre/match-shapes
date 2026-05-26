// @refresh reset
import "./embeddedFonts"; // register Sharp Grotesk VF (embedded, no web-font fetch)
import React, { useMemo } from "react";
import type {
  StaticPreviewGoal,
  StaticPreviewTeam,
  MatchEvent,
} from "./StaticPreview";
import {
  ShapeRenderer,
  SHAPE_FAMILIES,
  SHAPE_BUILDERS,
  applyShapeVariation,
  type ShapeFamily,
  type RevealOverrides,
} from "./showcaseShapes";

// Per-goal animation styles — a curated pool of GSAP configs so
// each goal in a fixture gets a visibly distinct reveal feel
// (different ease / mode / pacing) on top of its already-distinct
// shape family. Goal id hashes into this list, so the same goal
// always animates the same way across reloads but the 4–6 goals
// inside a single fixture each pull a different entry.
export const ANIM_STYLES: RevealOverrides[] = [
  // classic bouncy burst — the gallery's reveal. Tuned in the anim-tuner
  // lab: violent back-out pop + a 1.7-power slow-mo tail.
  { ease: "back.out(5.90)", forceMode: "burst", staggerSec: 1.8, cellDurationSec: 0.82, staggerFrom: "center", staggerPower: 1.7 },
  // fast clean grow
  { ease: "power3.out", forceMode: "grow", staggerSec: 1.4, cellDurationSec: 0.5, staggerFrom: "center" },
  // snappy fade
  { ease: "expo.out", forceMode: "fade", staggerSec: 1.2, cellDurationSec: 0.4, staggerFrom: "center" },
  // soft fade explosion (every goal blows OUT from centre, even
  // the fade variant — no edges-in or random scatter slots left in
  // the pool so the whole gallery feels like centred eruptions).
  { ease: "power2.out", forceMode: "fade", staggerSec: 2.0, cellDurationSec: 0.6, staggerFrom: "center" },
  // confident outward back-out
  { ease: "back.out(1.7)", forceMode: "burst", staggerSec: 2.2, cellDurationSec: 0.7, staggerFrom: "center" },

  // ── "Goal scored" explosion family — every cell erupts from the
  // centre, the core detonates almost instantly, then each outer ring
  // is spread progressively further apart so the tail drifts in like
  // slow motion. The high cellDurationSec + decelerating ease make each
  // individual shard shoot out fast and settle slowly. ──────────────
  // shockwave — extreme expo deceleration, violent core, long slow tail
  { ease: "expo.out", forceMode: "burst", staggerSec: 3.2, cellDurationSec: 0.9, staggerFrom: "center", staggerPower: 2.6 },
  // detonation — heaviest slow-mo tail (power4 ease + widest spread)
  { ease: "power4.out", forceMode: "burst", staggerSec: 3.8, cellDurationSec: 1.2, staggerFrom: "center", staggerPower: 3.2 },
  // center bang — the whole core detonates on frame 0 with a hard
  // overshoot (someone slams the centre), then a long slow-mo drift out
  { ease: "back.out(5)", forceMode: "burst", staggerSec: 3.6, cellDurationSec: 0.95, staggerFrom: "center", staggerPower: 4.8 },
];

// StaticPreviewV3 — focused-match chrome (same as StaticPreviewV2)
// but each goal renders as one of the 13 showcase shape families,
// staggered cell-by-cell from its focal (same animation as
// shape-showcase.html). The chrome is duplicated rather than shared
// with V2 to keep the surfaces independently editable.

const CANVAS_W = 1080;
const CANVAS_H = 1920;
// Tunable field-layout values. All of these can be overridden per
// instance via the `layout` prop (the blank-card lab wires sliders to
// them); the defaults are the production card geometry.
export type LayoutConfig = {
  sideInset: number;
  topInset: number;
  bottomInset: number;
  barH: number; // team colour-bar height
  teamNameSize: number;
  circleScale: number; // midfield circle radius as a fraction of PANEL_W
  sideTextSize: number; // vertical competition / venue captions
  sideTextWeight: number;
  scoreSize: number; // giant score numerals
  scoreWeight: number; // Sharp Grotesk VF weight axis (wght) for the numerals
  scoreTopOffset: number; // top score baseline offset below its half-centre
  scoreBottomOffset: number; // bottom score baseline offset below its half-centre
  goalLabelSize: number; // goal minute-label font size (scorer derived from it)
  goalLabelWeight: number; // goal minute + scorer label font weight
  possessionSize: number; // possession % readout font size
  possessionWeight: number; // possession % readout font weight
};

export const DEFAULT_LAYOUT: LayoutConfig = {
  sideInset: 125,
  topInset: 190,
  bottomInset: 190,
  barH: 22,
  teamNameSize: 92,
  circleScale: 0.2047, // radius = PANEL_W(850) × 0.2047 ≈ 174 → 348px diameter
  sideTextSize: 26,
  sideTextWeight: 660,
  scoreSize: 745,
  scoreWeight: 500,
  scoreTopOffset: 340,
  scoreBottomOffset: 200,
  goalLabelSize: 50,
  goalLabelWeight: 600,
  possessionSize: 14,
  possessionWeight: 700,
};

const CARD_BG = "#F4F4F4";
const PANEL_BG = "#FFFFFF";
// Border drawn around team-colour bars whose fill is (near-)white, so
// they read against the white pitch instead of vanishing.
const WHITE_BAR_BORDER = "#d1cdc9";

const FONT_NUMERALS =
  '"Sharp Grotesk VF", "Sharp Grotesk", Inter, ui-sans-serif, sans-serif';
const FONT_TEAM_NAMES = 'Anton, "Anton Regular", ui-sans-serif, sans-serif';
const FONT_VERTICAL =
  '"Google Sans Flex", "Roboto Flex", Inter, ui-sans-serif, sans-serif';

export type StaticPreviewV3Props = {
  goals: StaticPreviewGoal[];
  frame: number;
  home: StaticPreviewTeam;
  away: StaticPreviewTeam;
  competition?: string;
  venueAndDate?: string;
  finalHomePossession?: number;
  events?: MatchEvent[];
  kickoffEnd?: number;
  matchEnd?: number;
  showLabelWell?: boolean;
  // Optional per-goal family override; default cycles through
  // SHAPE_FAMILIES so each fixture shows a tour of the language.
  familyForGoal?: (goal: StaticPreviewGoal, rank: number) => ShapeFamily;
  // Per-goal emotional-importance score (0..1) from the rules engine.
  // Drives visual amplification: bigger shapes, harder score bumps.
  // Goals not in the map (or no map supplied) default to 0.5.
  importanceById?: Map<string, number>;
  // Optional partial override of the field layout (used by the lab).
  layout?: Partial<LayoutConfig>;
  // Optional explicit colours for the three top/bottom bar segments.
  // Defaults to each team's flag primary/secondary/accent. Lets the
  // bars differ from the numeral-driving flag colours.
  barColorsHome?: [string, string, string];
  barColorsAway?: [string, string, string];
  // Hide the possession % readout + playhead marker (for blank/review).
  hidePossession?: boolean;
  // Repaint the flag-white (grey #EFEFEF) goal cells to pure white with
  // a light-grey border, instead of leaving them grey. Off by default.
  whiteFlagCells?: boolean;
  // Which side is the pre-match underdog (lower strength). Used by the
  // LARGE size-tier rule: only special moments earn the biggest shape.
  underdog?: "home" | "away";
  // Debug aid: draw a small S/M/L chip beside each goal shape showing
  // its assigned size tier. Off by default; the gallery turns it on.
  showSizeBadge?: boolean;
  // Override the three shape SIZE TIERS (fraction of the PITCH WIDTH —
  // an absolute reference). Defaults to S 0.35 / M 0.65 / L 0.9. The
  // size tuner lab drives this live; the gallery leaves it unset.
  tierSizes?: { S: number; M: number; L: number };
};

const minuteToFrame = (
  minute: number,
  kickoffEnd: number,
  matchEnd: number,
) => {
  const t = Math.max(0, Math.min(1, minute / 90));
  return kickoffEnd + t * (matchEnd - kickoffEnd);
};

const isLightHex = (hex: string) => {
  const h = hex.replace("#", "");
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return r * 0.2126 + g * 0.7152 + b * 0.0722 > 205;
};

// Near-white = ALL channels bright (low saturation). Unlike isLightHex
// (luminance-based) this does NOT catch saturated brights like yellow,
// so a flag's yellow survives while only true white is substituted.
const isNearWhite = (hex: string) => {
  const h = hex.replace("#", "");
  if (h.length !== 6) return false;
  return (
    parseInt(h.slice(0, 2), 16) > 210 &&
    parseInt(h.slice(2, 4), 16) > 210 &&
    parseInt(h.slice(4, 6), 16) > 210
  );
};

const numeralColor = (t: StaticPreviewTeam) =>
  isLightHex(t.flagPrimary) ? t.flagAccent : t.flagPrimary;

// Per-game shape SIZE TIER (S/M/L). Exported as a pure function so the
// gallery card and the size-tuner lab assign tiers identically. LARGE
// is RESERVED for:
//   1. the match's FIRST goal, scored by the underdog;
//   2. a closing-stages (≥80') EQUALISER;
//   3. the WINNING goal (the go-ahead that stuck), at ANY minute;
//   4. a 1-0 final (lone decisive goal).
// CONSOLATION goals (the eventual loser scoring while still behind) are
// forced SMALL. Everything else is MEDIUM for the top-two by importance,
// SMALL beyond that.
export const computeTierByGoalId = (
  goals: { id: string; team: "home" | "away"; minute: number }[],
  importanceById?: Map<string, number>,
  underdog?: "home" | "away",
): Map<string, "S" | "M" | "L"> => {
  const importanceOf = (id: string) => importanceById?.get(id) ?? 0.5;
  const LATE = 80; // "last minute" window — closing stages (80'+)
  const map = new Map<string, "S" | "M" | "L">();
  if (goals.length === 0) return map;

  const chrono = [...goals].sort((a, b) =>
    a.minute !== b.minute ? a.minute - b.minute : a.id < b.id ? -1 : 1,
  );
  const large = new Set<string>();
  if (underdog && chrono[0]!.team === underdog) large.add(chrono[0]!.id);

  let h = 0;
  let a = 0;
  let prevLeader: "home" | "away" | null = null;
  let decisiveGoAhead: { id: string; minute: number } | null = null;
  for (const g of chrono) {
    if (g.team === "home") h++;
    else a++;
    if (h === a && h > 0 && g.minute >= LATE) large.add(g.id); // late equaliser
    const leader = h > a ? "home" : a > h ? "away" : null;
    if (leader && leader !== prevLeader) {
      decisiveGoAhead = { id: g.id, minute: g.minute };
    }
    prevLeader = leader;
  }
  const winner = h > a ? "home" : a > h ? "away" : null;
  if (winner && decisiveGoAhead) large.add(decisiveGoAhead.id); // winning goal
  if (h + a === 1) large.add(chrono[0]!.id); // 1-0 final

  const consolation = new Set<string>();
  if (winner) {
    const loser = winner === "home" ? "away" : "home";
    let hh = 0;
    let aa = 0;
    for (const g of chrono) {
      if (g.team === "home") hh++;
      else aa++;
      const mine = g.team === "home" ? hh : aa;
      const theirs = g.team === "home" ? aa : hh;
      if (g.team === loser && mine < theirs) consolation.add(g.id);
    }
  }

  const rest = [...goals]
    .filter((g) => !large.has(g.id))
    .sort((x, y) => {
      const di = importanceOf(y.id) - importanceOf(x.id);
      if (di !== 0) return di;
      if (x.minute !== y.minute) return x.minute - y.minute;
      return x.id < y.id ? -1 : 1;
    });
  for (const g of goals) if (large.has(g.id)) map.set(g.id, "L");
  let mCount = 0;
  for (const g of rest) {
    if (consolation.has(g.id)) {
      map.set(g.id, "S");
      continue;
    }
    map.set(g.id, mCount < 2 ? "M" : "S");
    mCount++;
  }
  return map;
};

// Dominant flag colour — the highest-weighted flag colour that isn't
// near-white (white reads as nothing on the pitch). Used for the goal
// minute label next to the scorer.
const dominantFlagColor = (t: StaticPreviewTeam): string => {
  const entries: Array<[string, number]> = [
    [t.flagPrimary, t.flagWeights?.[0] ?? 0.34],
    [t.flagSecondary, t.flagWeights?.[1] ?? 0.33],
    [t.flagAccent, t.flagWeights?.[2] ?? 0.33],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  for (const [c] of entries) if (!isLightHex(c)) return c;
  return numeralColor(t);
};

const stringSeed = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) & 0x7fffffff;
  }
  return h;
};

// Build a palette per goal from ONLY the scoring team's actual flag
// colours — primary + secondary + accent, deduplicated, dominant ink
// first. No invented neutrals: white/black are added ONLY if they're
// genuinely one of the team's flag colours (e.g. Japan's white field,
// Germany's black band), never appended by default.
// Build a palette whose colour FREQUENCY matches the flag weights, so a
// colour that covers only a little of the flag (e.g. a thin accent
// stripe) appears only a little in the artwork. A Bresenham-style
// accumulator interleaves the colours — proportions read across the
// whole shape rather than clustering into bands.
const weightedFlagPalette = (
  team: StaticPreviewTeam,
  slots = 24,
): string[] => {
  // White / near-white reads as nothing on the white pitch, so in the
  // ARTWORK (shapes + stat dots) it renders as a neutral grey instead.
  // The team-colour bars keep true white — they use the raw flag colours.
  const colors = [team.flagPrimary, team.flagSecondary, team.flagAccent].map(
    (c) => (isNearWhite(c) ? "#EFEFEF" : c),
  );
  const w = team.flagWeights ?? [0.34, 0.33, 0.33];
  const total = (w[0] ?? 0) + (w[1] ?? 0) + (w[2] ?? 0) || 1;
  const inc = colors.map((_, i) => (w[i] ?? 0) / total);
  const acc = [0, 0, 0];
  const out: string[] = [];
  for (let s = 0; s < slots; s++) {
    for (let i = 0; i < 3; i++) acc[i] += inc[i]!;
    let pick = 0;
    for (let i = 1; i < 3; i++) if (acc[i]! > acc[pick]!) pick = i;
    acc[pick]! -= 1;
    out.push(colors[pick] ?? "#000000");
  }
  return out;
};

// Per-goal shape palette: a dark ink first (kept at index 0 so builders
// that use palette[0] for structure stay legible), then the flag colours
// distributed by their real proportions.
const paletteForGoal = (team: StaticPreviewTeam): string[] => [
  numeralColor(team),
  ...weightedFlagPalette(team),
];

export const StaticPreviewV3: React.FC<StaticPreviewV3Props> = ({
  goals,
  frame,
  home,
  away,
  competition = "WORLD CUP 2026",
  venueAndDate = "Estadio Azteca | 11.6.2026",
  finalHomePossession = 0.66,
  events = [],
  kickoffEnd = 15,
  matchEnd = 180,
  showLabelWell = false,
  familyForGoal,
  importanceById,
  layout,
  barColorsHome,
  barColorsAway,
  hidePossession = false,
  whiteFlagCells = false,
  tierSizes,
  underdog,
  showSizeBadge = false,
}) => {
  // Merge layout overrides over the defaults, then derive the field
  // geometry from them (shadowing what used to be module constants).
  const L: LayoutConfig = { ...DEFAULT_LAYOUT, ...layout };
  const TOP_INSET = L.topInset;
  const BOTTOM_INSET = L.bottomInset;
  const SIDE_INSET = L.sideInset;
  const BAR_H = L.barH;
  const TEAM_NAME_SIZE = L.teamNameSize;
  const PANEL = {
    left: SIDE_INSET,
    top: TOP_INSET + BAR_H,
    right: CANVAS_W - SIDE_INSET,
    bottom: CANVAS_H - BOTTOM_INSET - BAR_H,
  };
  const PANEL_W = PANEL.right - PANEL.left;
  const PANEL_H = PANEL.bottom - PANEL.top;
  // Emotional importance per goal — used to scale shape size and
  // score bumps. Default 0.5 if the caller doesn't supply scores.
  const importanceOf = (goalId: string): number =>
    importanceById?.get(goalId) ?? 0.5;
  const midY = (PANEL.top + PANEL.bottom) / 2;
  const cxPanel = (PANEL.left + PANEL.right) / 2;
  const thirdW = (CANVAS_W - SIDE_INSET * 2) / 3;

  const homePossession = useMemo(() => {
    const t = Math.max(
      0,
      Math.min(1, (frame - kickoffEnd) / (matchEnd - kickoffEnd)),
    );
    const base = 0.5 + t * (finalHomePossession - 0.5);
    // Drift multiplied by t so the readout starts at exactly 50/50
    // at kickoff and only begins to wobble as play develops.
    const drift =
      (Math.sin(frame * 0.07) * 0.012 + Math.sin(frame * 0.19 + 0.6) * 0.008) *
      t;
    return Math.max(0.02, Math.min(0.98, base + drift));
  }, [frame, kickoffEnd, matchEnd, finalHomePossession]);
  const awayPossession = 1 - homePossession;

  const POSS_AMPLITUDE = 580;
  const kickoffT = Math.max(
    0,
    Math.min(1, (frame - kickoffEnd) / (matchEnd - kickoffEnd)),
  );
  const possDrift = -(homePossession - 0.5) * 2 * POSS_AMPLITUDE;
  // Wobble gated by kickoffT so the midfield is dead-centre at
  // kickoff and only starts drifting once play begins.
  const wobble =
    (Math.sin(frame * 0.045) * 38 +
      Math.sin(frame * 0.082 + 1.3) * 18 +
      Math.sin(frame * 0.027 + 2.1) * 22) *
    kickoffT;
  const dynamicMidY = midY + possDrift + wobble;

  let homeFired = 0;
  let awayFired = 0;
  let lastHomeBumpFrame = -Infinity;
  let lastAwayBumpFrame = -Infinity;
  for (const g of goals) {
    const trigger = minuteToFrame(g.minute, kickoffEnd, matchEnd);
    if (frame < trigger) continue;
    if (g.team === "home") {
      homeFired++;
      lastHomeBumpFrame = Math.max(lastHomeBumpFrame, trigger);
    } else {
      awayFired++;
      lastAwayBumpFrame = Math.max(lastAwayBumpFrame, trigger);
    }
  }
  const BUMP_DUR = 16;
  const bumpAmount = (lastTrigger: number): number => {
    if (lastTrigger === -Infinity) return 0;
    const dt = frame - lastTrigger;
    if (dt < 0 || dt > BUMP_DUR) return 0;
    return Math.sin((dt / BUMP_DUR) * Math.PI);
  };
  // Bump magnitude is also driven by the most-recent goal's
  // importance — a routine extension barely nudges the digit; a
  // final-minute knockout equaliser punches it hard.
  const lastHomeImportance = (() => {
    let best = 0.5;
    let bestF = -Infinity;
    for (const g of goals) {
      if (g.team !== "home") continue;
      const trig = minuteToFrame(g.minute, kickoffEnd, matchEnd);
      if (trig <= frame && trig >= bestF) {
        bestF = trig;
        best = importanceOf(g.id);
      }
    }
    return best;
  })();
  const lastAwayImportance = (() => {
    let best = 0.5;
    let bestF = -Infinity;
    for (const g of goals) {
      if (g.team !== "away") continue;
      const trig = minuteToFrame(g.minute, kickoffEnd, matchEnd);
      if (trig <= frame && trig >= bestF) {
        bestF = trig;
        best = importanceOf(g.id);
      }
    }
    return best;
  })();
  const homeBumpScale =
    1 + bumpAmount(lastHomeBumpFrame) * (0.10 + lastHomeImportance * 0.22);
  const awayBumpScale =
    1 + bumpAmount(lastAwayBumpFrame) * (0.10 + lastAwayImportance * 0.22);

  const sortedGoals = useMemo(
    () => [...goals].sort((a, b) => a.minute - b.minute),
    [goals],
  );

  // Per-game shape SIZE TIER (S/M/L) — assigned by the shared rule
  // (see computeTierByGoalId for the LARGE / consolation logic).
  const tierByGoalId = useMemo(
    () => computeTierByGoalId(goals, importanceById, underdog),
    [goals, importanceById, underdog],
  );

  // Tier → fraction of the PITCH WIDTH (a fixed, absolute reference).
  // Same-tier goals read at one consistent size regardless of the
  // half-pitch geometry. The size tuner lab overrides via `tierSizes`.
  const TIER_FRAC: Record<"S" | "M" | "L", number> = tierSizes ?? {
    S: 0.35,
    M: 0.65,
    L: 0.9,
  };

  // Per-goal pre-compute: zone, family, cells (memoised so the
  // builder doesn't re-run every frame), localFrame.
  const renderedGoals = useMemo(() => {
    return sortedGoals.map((g, idx) => {
      const teamZone = {
        x: PANEL.left,
        y: g.team === "home" ? PANEL.top : midY,
        w: PANEL_W,
        h: g.team === "home" ? midY - PANEL.top : PANEL.bottom - midY,
      };
      // Size = one of three fixed tiers (S/M/L) keyed off the goal's
      // importance RANK within this game (see tierByGoalId above). A
      // tiny seeded ±5% jitter keeps two same-tier shapes from reading
      // pixel-identical without breaking the S/M/L grouping.
      const tier = tierByGoalId.get(g.id) ?? "M";
      const jitter = 0.95 + ((stringSeed(`${g.id}:scale`) % 1000) / 1000) * 0.1;
      const sizeFrac = TIER_FRAC[tier] * jitter;
      // Absolute size: tier value is a fraction of the PITCH WIDTH (a
      // fixed reference), NOT the team-half's short side — so the shape's
      // total size is consistent regardless of the half-pitch geometry.
      const subSize = PANEL_W * sizeFrac;
      // Timeline X: map the goal's MINUTE (0–90) to a horizontal position
      // so an 11' goal sits near the left, a 45' goal mid-pitch and a late
      // goal toward the right — a true match timeline (not even spacing).
      // Y keeps the recipe's vertical placement for variety.
      const cxFrac = Math.max(0, Math.min(1, g.minute / 90));
      const cyFrac = g.recipe.posY / 100;
      const centreX = teamZone.x + cxFrac * teamZone.w;
      const centreY = teamZone.y + cyFrac * teamZone.h;
      const half = subSize / 2;
      // Position so the bloom (a) STARTS inside the field — its origin is
      // within the pitch on X and within its own team-half on Y — and
      // (b) keeps uniform padding from the card's total edge on ALL four
      // sides, so it may spill past the pitch but is never cut at the
      // canvas boundary, wherever the goal's origin lands.
      const ORIGIN_MARGIN = 70;
      const CARD_PAD = 40;
      const clampRange = (v: number, lo: number, hi: number) =>
        lo <= hi ? Math.max(lo, Math.min(hi, v)) : (lo + hi) / 2;
      // Clamp the CENTRE so the shape's FULL bounding box (centre ± half)
      // keeps CARD_PAD of clearance from the canvas edge. Late/early goals
      // are gently pulled inward instead of spilling past the card and
      // getting cut — the minute-accurate X is preserved wherever the
      // bloom already fits within the padded bounds.
      const clampedCX = clampRange(
        centreX,
        CARD_PAD + half,
        CANVAS_W - CARD_PAD - half,
      );
      const clampedCY = clampRange(
        centreY,
        Math.max(teamZone.y + ORIGIN_MARGIN, CARD_PAD + half),
        Math.min(
          teamZone.y + teamZone.h - ORIGIN_MARGIN,
          CANVAS_H - CARD_PAD - half,
        ),
      );
      const zone = {
        x: clampedCX - half,
        y: clampedCY - half,
        w: subSize,
        h: subSize,
      };
      const family: ShapeFamily = familyForGoal
        ? familyForGoal(g, idx)
        : SHAPE_FAMILIES[idx % SHAPE_FAMILIES.length]!;
      const palette = paletteForGoal(g.team === "home" ? home : away);
      const seed = stringSeed(`${g.id}:${idx}:${family}`);
      let cells: ReturnType<typeof SHAPE_BUILDERS[ShapeFamily]>["cells"] = [];
      let focal = { x: 0, y: 0 };
      let spinDegPerSec = 0;
      try {
        const built = SHAPE_BUILDERS[family](seed, subSize, palette);
        // Per-goal variation — varies particle density + spin so the
        // same family looks different every match / goal. Seeded off
        // the goal id so it's stable across reloads.
        const variation = applyShapeVariation(
          built,
          stringSeed(`${g.id}:var`),
        );
        cells = variation.cells;
        // Anchor on the shape's TRUE origin (where the bloom starts and
        // the rays converge) so the minute/scorer label sits where the
        // animation begins, not on a random outer cell.
        focal = built.focal;
        spinDegPerSec = variation.spinDegPerSec;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`[StaticPreviewV3] ${family} threw:`, e);
      }
      // The bloom's ORIGIN (its focal/apex — where a fan converges or a
      // burst erupts) must sit on the open field, clear of the team-colour
      // bars (top/bottom). Shift the shape VERTICALLY only so the focal
      // lands inside the pitch interior; X is left untouched so the goals
      // keep their chronological left→right order.
      {
        const FM = 80; // keep the focal this far off the bars
        const cyZone = zone.y + zone.h / 2;
        const apexY = cyZone + focal.y;
        const targetY = Math.max(
          PANEL.top + FM,
          Math.min(PANEL.bottom - FM, apexY),
        );
        zone.y += targetY - apexY;
        // Don't let the focal shift push the bloom past the card padding
        // top/bottom — keep the whole shape inside the card.
        zone.y = Math.max(
          CARD_PAD,
          Math.min(CANVAS_H - CARD_PAD - zone.h, zone.y),
        );
        // Protect the team name: a shape may cover at most HALF its
        // team's title (down to the title's vertical centre). Home
        // titles sit at TOP_INSET/2, away at CANVAS_H − BOTTOM_INSET/2.
        const topTitleMid = TOP_INSET / 2;
        const bottomTitleMid = CANVAS_H - BOTTOM_INSET / 2;
        if (g.team === "home") {
          // Top edge can't rise above the home title's midline.
          zone.y = Math.max(zone.y, topTitleMid);
        } else {
          // Bottom edge can't drop below the away title's midline.
          zone.y = Math.min(zone.y, bottomTitleMid - zone.h);
        }
      }
      return { goal: g, zone, family, cells, focal, spinDegPerSec };
    });
  }, [sortedGoals, home, away, midY, familyForGoal, tierByGoalId, tierSizes]);

  return (
    <svg
      data-match-card-svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      width="100%"
      height="100%"
      style={{ display: "block", background: CARD_BG }}
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill={CARD_BG} />

      {/* Team names — each title is vertically CENTRED in its edge→bar
          band via dominantBaseline="central", so England's gap from the
          top of the field equals Croatia's gap from the bottom. The
          bands are equal size (TOP_INSET === BOTTOM_INSET), so the gaps
          are identical and independent of the font's cap metrics. */}
      {(() => {
        const topCenterY = TOP_INSET / 2;
        const bottomCenterY = CANVAS_H - BOTTOM_INSET / 2;
        return (
          <>
            <text
              x={CANVAS_W / 2}
              y={topCenterY}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily={FONT_TEAM_NAMES}
              fontWeight={400}
              fontSize={TEAM_NAME_SIZE}
              letterSpacing={2}
              fill={numeralColor(home)}
            >
              {home.name.toUpperCase()}
            </text>
            <text
              x={CANVAS_W / 2}
              y={bottomCenterY}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily={FONT_TEAM_NAMES}
              fontWeight={400}
              fontSize={TEAM_NAME_SIZE}
              letterSpacing={2}
              fill={numeralColor(away)}
            >
              {away.name.toUpperCase()}
            </text>
          </>
        );
      })()}

      {/* Team-colour bars — one EQUAL-width bar per DISTINCT flag colour
          (3 colours → 3 equal bars, 2 → 2 equal halves, 1 → 1 full bar),
          spanning the pitch width so the row is always symmetrical. */}
      {(() => {
        const topY = TOP_INSET;
        const botY = CANVAS_H - BOTTOM_INSET - BAR_H;
        // White (or near-white) bars get a hairline border so they
        // don't disappear against the white pitch.
        const stroke = (c: string) =>
          isLightHex(c)
            ? { stroke: WHITE_BAR_BORDER, strokeWidth: 1 }
            : {};
        // Distinct colours, order preserved, case-insensitive.
        const distinct = (cols: string[]) =>
          cols.filter(
            (c, i) =>
              cols.findIndex((d) => d.toLowerCase() === c.toLowerCase()) === i,
          );
        const homeBars = distinct(
          barColorsHome ??
            home.flagColors ?? [
              home.flagPrimary,
              home.flagSecondary,
              home.flagAccent,
            ],
        );
        const awayBars = distinct(
          barColorsAway ??
            away.flagColors ?? [
              away.flagPrimary,
              away.flagSecondary,
              away.flagAccent,
            ],
        );
        const renderRow = (cols: string[], y: number, key: string) => {
          const w = PANEL_W / cols.length;
          return cols.map((color, i) => (
            <rect
              key={`${key}-${i}`}
              x={SIDE_INSET + i * w}
              y={y}
              width={w}
              height={BAR_H}
              fill={color}
              {...stroke(color)}
            />
          ));
        };
        return (
          <>
            {renderRow(homeBars, topY, "barH")}
            {renderRow(awayBars, botY, "barA")}
          </>
        );
      })()}

      <defs>
        <clipPath id="v3-panel-clip">
          <rect x={PANEL.left} y={PANEL.top} width={PANEL_W} height={PANEL_H} />
        </clipPath>
      </defs>

      <rect x={PANEL.left} y={PANEL.top} width={PANEL_W} height={PANEL_H} fill={PANEL_BG} />
      <rect x={PANEL.left} y={PANEL.top} width={PANEL_W} height={PANEL_H}
        fill="none" stroke="rgba(10,10,10,0.08)" strokeWidth={1} />

      {/* Goal shapes — each rendered via ShapeRenderer at the goal's
          (cx, cy) zone centre. NO clipPath: the bloom is ALLOWED to
          spill outside the pitch as it bursts. Only its starting point
          (origin/focal) is clamped inside the field (see renderedGoals),
          so it always starts within and then bursts outward. */}
      <g>
        {renderedGoals.map(({ goal, zone, cells, focal, spinDegPerSec }) => {
          const triggerFrame = minuteToFrame(
            goal.minute,
            kickoffEnd,
            matchEnd,
          );
          const localFrame = Math.max(0, frame - triggerFrame);
          if (frame < triggerFrame) return null;
          const cx = zone.x + zone.w / 2;
          const cy = zone.y + zone.h / 2;
          // Per-goal continuous spin (deg/sec → current angle).
          const spinDeg = (spinDegPerSec * localFrame) / 30;
          return (
            <g
              key={`goal-${goal.id}`}
              // Translate into the goal's zone, then apply the per-goal
              // rotation so this render's spin differs from the same
              // shape elsewhere.
              transform={`translate(${cx} ${cy}) rotate(${spinDeg.toFixed(2)})`}
            >
              <ShapeRenderer
                cells={cells}
                focal={focal}
                localFrame={localFrame}
                breathing
                // Optional (per-game): repaint flag-white cells to pure
                // white + a light-grey border. Other games leave them grey.
                whiteCells={
                  whiteFlagCells
                    ? { fill: "#FFFFFF", stroke: WHITE_BAR_BORDER, strokeWidth: 2 }
                    : undefined
                }
                // playToken keyed on goal-id + trigger frame so each
                // goal's GSAP timeline fires exactly once on mount.
                playToken={Math.floor(triggerFrame)}
                // Every goal uses the same reveal — the classic bouncy
                // burst (ANIM_STYLES[0]). (The full pool is kept for the
                // anim-styles lab; swap the index to vary again.)
                revealOverrides={ANIM_STYLES[0]}
              />
            </g>
          );
        })}
      </g>

      {/* S/M/L size-tier badges (debug aid) — a small chip beside each
          goal's focal showing the tier the size rules assigned. */}
      {showSizeBadge && (
        <g>
          {renderedGoals.map(({ goal, zone, focal }) => {
            const triggerFrame = minuteToFrame(goal.minute, kickoffEnd, matchEnd);
            if (frame < triggerFrame) return null;
            const tier = tierByGoalId.get(goal.id) ?? "M";
            const cx = zone.x + zone.w / 2 + focal.x;
            const cy = zone.y + zone.h / 2 + focal.y;
            const bx = cx + 30; // sit up-right of the focal/minute label
            const by = cy - 30;
            const fill =
              tier === "L" ? "#1769FF" : tier === "M" ? "#0A0A0A" : "#9A9A9A";
            return (
              <g key={`tier-${goal.id}`}>
                <rect
                  x={bx - 13}
                  y={by - 13}
                  width={26}
                  height={26}
                  rx={6}
                  fill={fill}
                />
                <text
                  x={bx}
                  y={by + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontFamily={FONT_VERTICAL}
                  fontWeight={800}
                  fontSize={16}
                  fill="#FFFFFF"
                >
                  {tier}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {/* Score numerals — match the gallery's typography exactly so V3
          reads as the same poster system: fontSize 720, Sharp Grotesk
          wdth 8.4 / wght 666, same vertical anchors + pivot. */}
      {(() => {
        const homeBaseY = (PANEL.top + midY) / 2 + L.scoreTopOffset;
        const awayBaseY = (midY + PANEL.bottom) / 2 + L.scoreBottomOffset;
        const homePivotY = homeBaseY - 260;
        const awayPivotY = awayBaseY - 260;
        return (
          <>
            <g
              transform={`translate(${cxPanel} ${homePivotY}) scale(${homeBumpScale.toFixed(3)}) translate(${(-cxPanel).toFixed(3)} ${(-homePivotY).toFixed(3)})`}
            >
              <text
                x={cxPanel}
                y={homeBaseY}
                textAnchor="middle"
                fontFamily={FONT_NUMERALS}
                fontWeight={900}
                fontSize={L.scoreSize}
                fill={numeralColor(home)}
                style={{
                  fontVariantNumeric: "tabular-nums",
                  fontVariationSettings: `"wdth" 8.4, "wght" ${L.scoreWeight}`,
                }}
              >
                {homeFired}
              </text>
            </g>
            <g
              transform={`translate(${cxPanel} ${awayPivotY}) scale(${awayBumpScale.toFixed(3)}) translate(${(-cxPanel).toFixed(3)} ${(-awayPivotY).toFixed(3)})`}
            >
              <text
                x={cxPanel}
                y={awayBaseY}
                textAnchor="middle"
                fontFamily={FONT_NUMERALS}
                fontWeight={900}
                fontSize={L.scoreSize}
                fill={numeralColor(away)}
                style={{
                  fontVariantNumeric: "tabular-nums",
                  fontVariationSettings: `"wdth" 8.4, "wght" ${L.scoreWeight}`,
                }}
              >
                {awayFired}
              </text>
            </g>
          </>
        );
      })()}

      {/* Midfield line + circle — drawn AFTER the score numerals so they
          sit ABOVE the big numbers in z-order. Clipped to the pitch panel. */}
      <g clipPath="url(#v3-panel-clip)" pointerEvents="none">
        <line x1={PANEL.left} y1={dynamicMidY} x2={PANEL.right} y2={dynamicMidY}
          stroke="#d1cdc9" strokeWidth={2} />
        <circle cx={(PANEL.left + PANEL.right) / 2} cy={dynamicMidY}
          r={PANEL_W * L.circleScale} fill="none"
          stroke="#d1cdc9" strokeWidth={2} />
      </g>

      {/* Event markers */}
      <g>
        {(() => {
          const hash01 = (s: string) => {
            let h = 2166136261;
            for (let i = 0; i < s.length; i++) {
              h ^= s.charCodeAt(i);
              h = Math.imul(h, 16777619);
            }
            return ((h >>> 0) % 10000) / 10000;
          };
          return events
            .filter((e) => {
              const trigger =
                kickoffEnd +
                Math.max(0, Math.min(1, e.minute / 90)) *
                  (matchEnd - kickoffEnd);
              return frame >= trigger;
            })
            .map((e) => {
              const x = PANEL.left + (e.minute / 90) * PANEL_W;
              const isHomeEv = e.team === "home";
              const h = hash01(e.id);
              // Stat dots use the FULL weighted team palette (same logic
              // as the goal artwork) so they read in all the flag's
              // colours in their real proportions — not one flat colour.
              const evPalette = weightedFlagPalette(isHomeEv ? home : away);
              const teamCol =
                evPalette[Math.floor(h * evPalette.length)] ??
                numeralColor(isHomeEv ? home : away);
              const minOff = (isHomeEv ? PANEL.top : midY) + 36;
              const maxOff = (isHomeEv ? midY : PANEL.bottom) - 36;
              const y = minOff + h * (maxOff - minOff);
              // Cards (yellow/red) sit FLUSH against the live midline —
              // home square's bottom edge on the line, away square's top
              // edge on the line, no gap. A gap of exactly half the
              // square (10) puts the inner edge right on the midline.
              const CARD_HALF = 10;
              const cardY = isHomeEv
                ? dynamicMidY - CARD_HALF
                : dynamicMidY + CARD_HALF;
              // Keep the whole square inside the pitch panel, with a
              // small margin so a last-minute card sits just shy of the
              // touchline instead of flush against the field edge.
              const CARD_EDGE_GAP = 8;
              const cardX = Math.max(
                PANEL.left + CARD_HALF + CARD_EDGE_GAP,
                Math.min(PANEL.right - CARD_HALF - CARD_EDGE_GAP, x),
              );
              if (e.type === "yellow_card") {
                return (
                  <rect key={e.id} x={cardX - CARD_HALF} y={cardY - CARD_HALF}
                    width={20} height={20} fill="#FFD400" />
                );
              }
              if (e.type === "red_card") {
                return (
                  <rect key={e.id} x={cardX - CARD_HALF} y={cardY - CARD_HALF}
                    width={20} height={20} fill="#E32636" />
                );
              }
              const r = e.type === "penalty" ? 13 : 10;
              return <circle key={e.id} cx={x} cy={y} r={r} fill={teamCol} />;
            });
        })()}
      </g>

      {/* Possession % + playhead */}
      <g>
        {!hidePossession && (() => {
          const currentMinute = Math.max(
            0,
            Math.min(90, ((frame - kickoffEnd) / (matchEnd - kickoffEnd)) * 90),
          );
          const px = PANEL.left + (currentMinute / 90) * PANEL_W;
          const POSS_FONT = L.possessionSize;
          const POSS_OFFSET = POSS_FONT / 2 + 6;
          const POSS_X = PANEL.right - 18;
          return (
            <>
              <text x={POSS_X} y={dynamicMidY - POSS_OFFSET}
                textAnchor="end" dominantBaseline="middle"
                fontFamily={FONT_VERTICAL} fontWeight={L.possessionWeight} fontSize={POSS_FONT}
                fill={numeralColor(home)}
                style={{ fontVariantNumeric: "tabular-nums" }}>
                {Math.round(homePossession * 100)}%
              </text>
              <text x={POSS_X} y={dynamicMidY + POSS_OFFSET}
                textAnchor="end" dominantBaseline="middle"
                fontFamily={FONT_VERTICAL} fontWeight={L.possessionWeight} fontSize={POSS_FONT}
                fill={numeralColor(away)}
                style={{ fontVariantNumeric: "tabular-nums" }}>
                {Math.round(awayPossession * 100)}%
              </text>
              {/* Playhead dot + minute both hide at full time — once
                  the game is over there's no live timeline to mark. */}
              {currentMinute < 90 && (
                <>
                  <circle cx={px} cy={dynamicMidY} r={4} fill="#d1cdc9" />
                  <text x={px} y={dynamicMidY - 12}
                    textAnchor="middle" dominantBaseline="baseline"
                    fontFamily={FONT_VERTICAL} fontWeight={700} fontSize={14}
                    fill="#d1cdc9"
                    style={{ fontVariantNumeric: "tabular-nums" }}>
                    {Math.round(currentMinute)}'
                  </text>
                </>
              )}
            </>
          );
        })()}
      </g>

      {/* Scorer labels — same layout as V2 (minute hugs centre,
          scorer name rotates 90° on the opposing side). */}
      {renderedGoals.map(({ goal, zone, focal }) => {
        const triggerFrame = minuteToFrame(
          goal.minute,
          kickoffEnd,
          matchEnd,
        );
        const localFrame = Math.max(0, frame - triggerFrame);
        if (frame < triggerFrame) return null;
        const LABEL_START = 12;
        const LABEL_FADE = 10;
        const labelT = Math.max(
          0,
          Math.min(1, (localFrame - LABEL_START) / LABEL_FADE),
        );
        if (labelT <= 0) return null;
        const labelEased = 1 - Math.pow(1 - labelT, 3);
        const isHome = goal.team === "home";
        const ownTeam = isHome ? home : away;
        // Anchor the label stack on the shape's focal point (the burst
        // origin / spinner hub), not the zone centre.
        const cxBox = zone.x + zone.w / 2 + focal.x;
        const cyBox = zone.y + zone.h / 2 + focal.y;
        const minuteText = `'${goal.minute}`;
        const scorerText = goal.scorer.toUpperCase();
        const MINUTE_FONT = L.goalLabelSize;
        const SCORER_FONT = 12;
        const SCORER_CHAR_W = SCORER_FONT * 0.62;
        const scorerLen = goal.scorer.length * SCORER_CHAR_W;
        const LABEL_GAP = 18;
        // The minute string "'81" is anchored at cxBox, but the leading
        // apostrophe pushes the visible DIGITS right of cxBox. Centre the
        // scorer name (and measure the gap) on the digits, not the string:
        // shift its axis right by ~half the apostrophe's width.
        const APOS_SHIFT = MINUTE_FONT * 0.13;
        const labelCx = cxBox + APOS_SHIFT;
        const MINUTE_CAP_HALF = MINUTE_FONT * 0.36; // ≈ cap-height / 2
        const dir = isHome ? 1 : -1;
        const minuteY = cyBox;
        const scorerCenterY =
          cyBox + dir * (MINUTE_CAP_HALF + LABEL_GAP + scorerLen / 2);
        const scorerRotation = isHome ? 90 : -90;
        void showLabelWell;
        return (
          <g key={`label-${goal.id}`} opacity={labelEased}>
            {/* Minute — upright, normal left-to-right reading ('81), centred
                on the focal. Only the scorer name below is rotated. */}
            <text
              x={cxBox}
              y={minuteY}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily={FONT_NUMERALS}
              fontWeight={L.goalLabelWeight}
              fontSize={MINUTE_FONT}
              letterSpacing={1}
              fill={dominantFlagColor(ownTeam)}
              style={{
                fontVariantNumeric: "tabular-nums",
                fontVariationSettings: `"wdth" 8.4, "wght" ${L.goalLabelWeight}`,
              }}
            >
              {minuteText}
            </text>
            <g
              transform={`translate(${labelCx} ${scorerCenterY}) rotate(${scorerRotation})`}
            >
              <text
                x={0}
                y={0}
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily={FONT_VERTICAL}
                fontWeight={700}
                fontSize={SCORER_FONT}
                letterSpacing={2}
                fill="#000000"
              >
                {scorerText}
              </text>
            </g>
          </g>
        );
      })}

      {/* Side captions — rendered LAST so they sit above the goal artwork
          on both sides (the bloom can spill into the side strips but must
          never cover the competition / venue text). */}
      <g transform={`translate(${SIDE_INSET / 2} ${CANVAS_H / 2}) rotate(-90)`}>
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily={FONT_VERTICAL}
          fontWeight={L.sideTextWeight}
          fontSize={L.sideTextSize}
          letterSpacing={6}
          fill="#0E0E0E"
        >
          {competition.toUpperCase()}
        </text>
      </g>
      <g transform={`translate(${CANVAS_W - SIDE_INSET / 2} ${CANVAS_H / 2}) rotate(90)`}>
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily={FONT_VERTICAL}
          fontWeight={L.sideTextWeight}
          fontSize={L.sideTextSize}
          letterSpacing={6}
          fill="#0E0E0E"
        >
          {venueAndDate.toUpperCase()}
        </text>
      </g>
    </svg>
  );
};
