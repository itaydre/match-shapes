// ─────────────────────────────────────────────────────────────────────
// Match data types — the minimal shape the renderer needs. Decoupled
// from the authoring tool's richer recipe types: only the fields the
// card actually reads are kept.
// ─────────────────────────────────────────────────────────────────────

export type MatchEventType =
  | "shot"
  | "foul"
  | "yellow_card"
  | "red_card"
  | "corner"
  | "free_kick"
  | "penalty";

export type MatchEvent = {
  id: string;
  team: "home" | "away";
  minute: number;
  type: MatchEventType;
};

export type StaticPreviewGoal = {
  id: string;
  team: "home" | "away";
  minute: number;
  scorer: string;
  // The card reads only posX / posY / size from the recipe; other
  // authoring fields are optional and ignored at render time.
  recipe: {
    posX: number; // 0..100 — horizontal placement (match minute axis)
    posY: number; // 0..100 — vertical placement within team half
    size: number; // 0..~105 — shape scale (importance-weighted)
    [extra: string]: unknown;
  };
};

export type StaticPreviewTeam = {
  name: string;
  flagPrimary: string;
  flagSecondary: string;
  flagAccent: string;
  // Relative usage of each flag colour, [primary, secondary, accent].
  flagWeights?: [number, number, number];
  // Two-letter (or tagged) language code → picks the commentator yell
  // when this team scores. Matches an entry in GOAL_AUDIO of audio.ts.
  goalLang?: string;
};
