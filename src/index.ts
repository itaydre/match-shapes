// match-shapes — public API
// ─────────────────────────────────────────────────────────────────────
// Import everything via this single entry. Underlying source files
// may be split for maintenance; the public surface stays here.

export {
  // Core types
  type Cell,
  type CellBase,
  type ShapeBuilder,
  type ShapeFamily,
  type WrapAnimation,
  type RevealOverrides,
  // Vortex disc params (the parameterised family — pattern for
  // future shapes to follow when adding variants).
  type VortexDiscParams,
  // Builders + registry
  SHAPE_BUILDERS,
  SHAPE_FAMILIES,
  // Renderer
  ShapeRenderer,
} from "./showcaseShapes";

export {
  TEAM_PALETTES,
  getTeamPalette,
  type TeamPalette,
} from "./palettes";

export {
  HERO_FAMILIES,
  familiesForGame,
  pickHeroFamily,
  pickFamilyForGoal,
  stringSeed,
} from "./pickFamily";
