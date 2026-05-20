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
  type VortexDiscParams,
  type ShapeVariation,
  // Builders + registry
  SHAPE_BUILDERS,
  SHAPE_FAMILIES,
  // Per-render variation (particle density + spin)
  applyShapeVariation,
  // Renderer
  ShapeRenderer,
} from "./showcaseShapes";

export {
  TEAM_PALETTES,
  getTeamPalette,
  type TeamPalette,
} from "./palettes";

export {
  stringSeed,
  familiesForGame,
  familyGroup,
  buildMatchShapeMap,
  pickFamilyForGoal,
} from "./pickFamily";

// Match data types (decoupled from the authoring tool).
export {
  type MatchEvent,
  type MatchEventType,
  type StaticPreviewGoal,
  type StaticPreviewTeam,
} from "./matchTypes";

// Full animated match-card SVG — pitch chrome (timeline, midline,
// possession bands, score numerals, event scatter) + one shape per
// goal. Drive it with a `frame` prop (0..matchEnd). Pair with a rAF
// playhead + the audio controller for the live render.
export {
  StaticPreviewV3 as MatchCardSVG,
  type StaticPreviewV3Props as MatchCardSVGProps,
} from "./MatchCardSVG";

// Audio — crowd loop + per-goal commentator yells.
export {
  GOAL_AUDIO,
  goalAudioPath,
  MatchAudio,
  type MatchAudioOptions,
} from "./audio";
