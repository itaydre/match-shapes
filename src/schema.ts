import { z } from "zod";
import { zColor } from "@remotion/zod-types";

export const goalSchema = z.object({
  team: z.enum(["home", "away"]),
  // Match minute 0..90 — drives both timeline position and visual trigger.
  minute: z.number().min(0).max(120),
  // Which abstract style to render in the goal cell (0..4).
  // 0 ripple, 1 sunburst, 2 dome, 3 checker pinwheel, 4 shard burst
  style: z.number().int().min(0).max(4),
  // Grid cell index inside that team's half (0..gridCells-1). Picked manually
  // to match the source poster; the renderer will fall back to a hash slot if omitted.
  cell: z.number().int().min(0).optional(),
  // Scorer name shown next to the goal. Optional — compositions fall back to
  // their built-in rotating roster.
  scorer: z.string().optional(),
});

export const teamSchema = z.object({
  name: z.string(),
  flagPrimary: zColor(),
  flagSecondary: zColor(),
  flagAccent: zColor(),
});

export const matchCardSchema = z.object({
  // Match metadata --------------------------------------------------------
  home: teamSchema,
  away: teamSchema,
  competition: z.string(),
  venue: z.string(),
  // Static-style date so it round-trips cleanly through Studio (no Date object).
  date: z.string(),

  // Timeline --------------------------------------------------------------
  goals: z.array(goalSchema),
  // Per-second possession share for the home team. Length should equal match
  // length in "minutes". The midpoint is driven by the cumulative average.
  possessionTimeline: z.array(z.number().min(0).max(1)),

  // Emotion controls (Studio sliders) -------------------------------------
  emotion: z.number().min(0).max(1),
  clash: z.number().min(0).max(1),
  shotDensity: z.number().min(0).max(1),
  glitch: z.number().min(0).max(1),
  showGrid: z.boolean(),
  showShots: z.boolean(),
});

export type MatchCardProps = z.infer<typeof matchCardSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type Team = z.infer<typeof teamSchema>;
