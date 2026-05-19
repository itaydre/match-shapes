// ─────────────────────────────────────────────────────────────────────
// Family selection — picks a ShapeFamily for a given match / goal.
// Deterministic per-match-id so two reloads of the same fixture render
// identically, but every match gets a unique distribution.
// ─────────────────────────────────────────────────────────────────────

import { SHAPE_FAMILIES, type ShapeFamily } from "./showcaseShapes";

// 5381-style string hash — used to seed all the per-game pseudo-random
// pickers. Stable across reloads.
export const stringSeed = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) & 0x7fffffff;
  }
  return h;
};

// Curated "hero" shapes — reserved for the highest-importance goal
// in each match. These are the most visually arresting families.
export const HERO_FAMILIES: ShapeFamily[] = [
  "interference_mandala",
  "shatter_mandala",
  "mandala_curves",
  "polar_vortex",
  "crown_dial",
  "corner_arcs",
  "ripple_arcs",
  "scanline_ribbon",
  "spiral_bloom",
  "lens_mandala",
  "folded_z",
];

// Per-game tour of SHAPE_FAMILIES. Each game id hashes to a stable
// starting offset and stride so the goals of a single fixture
// collectively walk through every family before any repeats.
export const familiesForGame = (gameId: string): ShapeFamily[] => {
  const seed = stringSeed(gameId);
  const offset = seed % SHAPE_FAMILIES.length;
  const stride = 3 + ((seed >> 4) % 5); // 3..7, coprime with length
  const out: ShapeFamily[] = [];
  for (let i = 0; i < SHAPE_FAMILIES.length; i++) {
    out.push(
      SHAPE_FAMILIES[(offset + i * stride) % SHAPE_FAMILIES.length]!,
    );
  }
  return out;
};

// Deterministic hero pick per match id.
export const pickHeroFamily = (gameId: string): ShapeFamily => {
  const seed = stringSeed(gameId + ":hero");
  return HERO_FAMILIES[seed % HERO_FAMILIES.length]!;
};

// Convenience for the simplest case — pick one shape for a goal
// given match id + goal id. The hero goal of a match gets a hero
// family; subsequent goals walk the per-game pool.
export const pickFamilyForGoal = (
  matchId: string,
  goalId: string,
  isHero = false,
): ShapeFamily => {
  if (isHero) return pickHeroFamily(matchId);
  const pool = familiesForGame(matchId).filter(
    (f) => f !== pickHeroFamily(matchId),
  );
  const idx = stringSeed(goalId) % pool.length;
  return pool[idx]!;
};
