// ─────────────────────────────────────────────────────────────────────
// Family selection — assigns a ShapeFamily to each goal in a match.
// Deterministic per match id (stable across reloads) but a fresh
// random ordering per match, so every fixture's goals read as a
// different lineup: ribbon → a vortex variant → mandala → … and no
// two goals in one match repeat a shape or land two visually-similar
// shapes back to back.
// ─────────────────────────────────────────────────────────────────────

import { SHAPE_FAMILIES, type ShapeFamily } from "./showcaseShapes";

// 5381-style string hash — seeds the per-match RNG. Stable across
// reloads.
export const stringSeed = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) & 0x7fffffff;
  }
  return h;
};

// Seeded LCG — stable per match id, distinct between matches.
const seededRand = (seed: number) => {
  let h = seed || 1;
  return () => {
    h = (h * 1664525 + 1013904223) & 0x7fffffff;
    return h / 0x7fffffff;
  };
};

// A fully shuffled permutation of every shape family, seeded by the
// match id. Each match gets its own random ordering.
export const familiesForGame = (matchId: string): ShapeFamily[] => {
  const rand = seededRand(stringSeed(matchId));
  const order = [...SHAPE_FAMILIES];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
};

// Coarse "family group" — keeps two visually-similar shapes (two
// vortex-disc variants, two mandalas, …) off consecutive goals.
export const familyGroup = (f: ShapeFamily): string => {
  // lens_mandala is the cyclone spiral — visually distinct, its own
  // group, fine to show next to a radial shape.
  if (f === "lens_mandala") return "lens";
  // All radial swirl / wheel / mandala shapes read alike → one group
  // so two never land on consecutive goals.
  if (
    f.startsWith("vortex_disc") ||
    f === "polar_vortex" ||
    f === "polar_swirl" ||
    f === "interference_mandala" ||
    f === "shatter_mandala" ||
    f === "mandala_curves" ||
    f === "crown_dial"
  ) {
    return "radial";
  }
  if (f.includes("ribbon")) return "ribbon";
  if (f.includes("arcs")) return "arcs";
  if (f.includes("burst")) return "burst";
  if (f.includes("pixel")) return "pixel";
  return f;
};

type GoalLike = { id: string; minute: number };

// Build a goal-id → ShapeFamily map for one match. Walks the match's
// shuffled permutation, giving each goal (chronological order) the
// next family that hasn't been used in this match AND isn't in the
// same visual group as the previous goal. Guarantees every goal a
// distinct, varied shape.
export const buildMatchShapeMap = (
  matchId: string,
  goals: GoalLike[],
): Map<string, ShapeFamily> => {
  const sorted = [...goals].sort((a, b) => a.minute - b.minute);
  const map = new Map<string, ShapeFamily>();
  if (sorted.length === 0) return map;

  const shuffled = familiesForGame(matchId);
  const used = new Set<ShapeFamily>();
  let cursor = 0;
  let prevGroup = "";

  for (const g of sorted) {
    let pick: ShapeFamily | null = null;
    for (let scan = 0; scan < shuffled.length; scan++) {
      const cand = shuffled[(cursor + scan) % shuffled.length]!;
      if (used.has(cand)) continue;
      const remaining = shuffled.length - used.size;
      if (familyGroup(cand) === prevGroup && remaining > 1) continue;
      pick = cand;
      cursor = (cursor + scan + 1) % shuffled.length;
      break;
    }
    if (!pick) {
      pick =
        shuffled.find((f) => !used.has(f)) ??
        shuffled[cursor % shuffled.length]!;
      cursor = (cursor + 1) % shuffled.length;
    }
    used.add(pick);
    prevGroup = familyGroup(pick);
    map.set(g.id, pick);
  }
  return map;
};

// Convenience single-goal picker — derives the goal's family from the
// full match map so it stays consistent with the other goals.
export const pickFamilyForGoal = (
  matchId: string,
  goals: GoalLike[],
  goalId: string,
): ShapeFamily =>
  buildMatchShapeMap(matchId, goals).get(goalId) ?? SHAPE_FAMILIES[0]!;
