// Goal importance & emotional intensity rules.
// Pure functions — no UI, no Remotion. Imports nothing from the
// composition. The lab and the composition can both call this to
// derive a 0..1 intensity score per goal and to convert that score
// into concrete animation parameters.
//
// Implements the rules from the "Goal Importance & Emotional
// Intensity in Football" brief: stage × expectedness × scoreChange
// × rivalry × lateness, with comebacks amplified and late equalizers
// boosted on top.

import type { CellGridSettings } from "./cellGrid";

export type Stage = "group" | "knockout" | "final";

export type MatchContext = {
  stage: Stage;
  // 0..100. Higher = stronger team (FIFA-ranking-style relative
  // strength). The gap between the two drives the "expectedness"
  // multiplier — underdog goals carry more emotional weight than the
  // favourite scoring on cruise control.
  homeStrength: number;
  awayStrength: number;
  // 0..100. Historical rivalry / fixture prestige. 0 = friendly,
  // 30 = standard, 70 = derby, 100 = Clásico / Superclásico.
  rivalry: number;
};

export type GoalForRules = {
  id: string;
  team: "home" | "away";
  minute: number;
};

const STAGE_WEIGHT: Record<Stage, number> = {
  group: 0.4,
  knockout: 0.7,
  final: 1.0,
};

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

// Compute the score-before-this-goal by tallying every earlier goal.
const scoreBefore = (goal: GoalForRules, allGoals: GoalForRules[]) => {
  let home = 0;
  let away = 0;
  for (const g of allGoals) {
    if (g.id === goal.id) continue;
    if (g.minute > goal.minute) continue;
    // Stable order: ties at the same minute use id ordering.
    if (g.minute === goal.minute && g.id >= goal.id) continue;
    if (g.team === "home") home++;
    else away++;
  }
  return { home, away };
};

// Expectedness — underdog goals feel HUGE; heavy-favourite goals
// feel routine. Strength gap 0..100 → multiplier centred on 1.0.
const expectednessFor = (
  scorerTeam: "home" | "away",
  homeStrength: number,
  awayStrength: number,
) => {
  const favorite: "home" | "away" =
    homeStrength >= awayStrength ? "home" : "away";
  const gap = Math.abs(homeStrength - awayStrength) / 100; // 0..1
  if (scorerTeam === favorite) {
    // Favourite scoring as expected — taper down with bigger gap.
    return 1.0 - gap * 0.5; // 0.5..1.0
  }
  // Underdog scoring — surprise bonus scales with the gap.
  return 1.0 + gap * 0.4; // 1.0..1.4
};

// Scoreline psychology + comeback amplification.
const scoreChangeFor = (
  scorerTeam: "home" | "away",
  scoreBeforeHome: number,
  scoreBeforeAway: number,
) => {
  const own = scorerTeam === "home" ? scoreBeforeHome : scoreBeforeAway;
  const opp = scorerTeam === "home" ? scoreBeforeAway : scoreBeforeHome;
  const newOwn = own + 1;
  // Equalizer — own goal count goes from opp-1 to opp.
  if (newOwn === opp) {
    return 1.05;
  }
  // Going ahead from level — classic 1-0 opener weight.
  if (own === opp) {
    return 1.0;
  }
  // Comeback — trailing and catching up. Bigger reversal = more
  // emotional. Capped at 1.3.
  if (own < opp) {
    // newOwn could be opp (equalizer handled above) or still < opp.
    const oldDeficit = opp - own;
    const newDeficit = opp - newOwn;
    return Math.min(1.3, 1.0 + (oldDeficit - newDeficit) * 0.15);
  }
  // Extending lead — diminishing returns. 1-0 (already past),
  // 2-0 = 0.65, 3-0 = 0.4, 4-0 = 0.25, beyond = 0.18.
  const lead = newOwn - opp;
  if (lead === 2) return 0.65;
  if (lead === 3) return 0.4;
  if (lead === 4) return 0.25;
  return 0.18;
};

// Lateness — minute 80..90 ramps from 1.0 to 1.3. Anything earlier
// is neutral; anything in extra time (>90) caps at 1.3.
const latenessFor = (minute: number) => {
  if (minute <= 80) return 1.0;
  return 1.0 + Math.min(1, (minute - 80) / 10) * 0.3;
};

const rivalryFor = (rivalry: number) => 1.0 + clamp(rivalry / 100) * 0.4;

export type ImportanceBreakdown = {
  raw: number; // unclamped product
  importance: number; // normalized 0..1
  stage: number;
  expectedness: number;
  scoreChange: number;
  rivalry: number;
  lateness: number;
  scoreBefore: { home: number; away: number };
};

// Maximum theoretical product: 1.0 × 1.4 × 1.3 × 1.4 × 1.3 ≈ 3.31.
// Map to [0, 1] by dividing through that — but use 2.2 instead so
// "fully maxed" doesn't require literally every dial pinned. A goal
// at raw=2.2 already saturates the visual.
const NORMALISE_DIVISOR = 2.2;

export const computeGoalImportance = (
  goal: GoalForRules,
  allGoals: GoalForRules[],
  ctx: MatchContext,
): ImportanceBreakdown => {
  const before = scoreBefore(goal, allGoals);
  const stage = STAGE_WEIGHT[ctx.stage];
  const expectedness = expectednessFor(
    goal.team,
    ctx.homeStrength,
    ctx.awayStrength,
  );
  const scoreChange = scoreChangeFor(goal.team, before.home, before.away);
  const rivalry = rivalryFor(ctx.rivalry);
  const lateness = latenessFor(goal.minute);
  const raw = stage * expectedness * scoreChange * rivalry * lateness;
  const importance = clamp(raw / NORMALISE_DIVISOR);
  return {
    raw,
    importance,
    stage,
    expectedness,
    scoreChange,
    rivalry,
    lateness,
    scoreBefore: before,
  };
};

// Map an importance score 0..1 → concrete warp parameters. Used both
// when seeding new goals and when "Apply rules" recomputes every
// existing goal. Returns just the fields that should be ramped — the
// caller merges this into the rest of the recipe (pattern type,
// colour settings, position, size, etc.).
export const importanceToWarp = (
  importance: number,
  team: "home" | "away",
): Pick<
  CellGridSettings,
  | "distortionStrength"
  | "outwardForce"
  | "curvature"
  | "pinchIntensity"
  | "asymmetry"
  | "rotation"
> => {
  const k = clamp(importance);
  return {
    distortionStrength: 30 + k * 65, // 30..95
    outwardForce: 10 + k * 50, // 10..60
    curvature: (team === "home" ? 0 : 25) + k * 100,
    pinchIntensity: k * 70,
    asymmetry: 10 + k * 40,
    // Rotation drift — bigger goals turn the field more aggressively.
    rotation: (team === "home" ? 0 : 18) + k * 180,
  };
};

// Layer behaviours that only kick in at HIGH intensity — moiré
// interference for "this is enormous", recursive echoes for the
// hypnotic "tunnel" feel reserved for genuine moments.
export const importanceToLayers = (
  importance: number,
): { moireStrength: number; recursionDepth: number; size: number } => {
  const k = clamp(importance);
  return {
    // Moiré ghost: starts at importance ~0.55, ramps to 70 at 1.0.
    moireStrength: Math.max(0, (k - 0.55) / 0.45) * 70,
    // Recursive echoes: 0 until k>0.5, 1 at >0.5, 2 at >0.75, 3 at >0.9.
    recursionDepth: k > 0.9 ? 3 : k > 0.75 ? 2 : k > 0.5 ? 1 : 0,
    // Size — the bigger the moment, the bigger the box.
    size: 40 + k * 30,
  };
};
