import type { Goal } from "../schema";

/**
 * Computes a 0..1 "drama weight" for a goal based on how it affects the match.
 *
 * The model blends four signals:
 *
 *  1. **Late ramp** — the closer to full time, the more weight. Goals before
 *     minute 60 get nothing from this; minute 90+ caps it.
 *  2. **Early shock** — goals in the opening 6 minutes earn a small premium
 *     for being unexpected.
 *  3. **Decisive state** — what the goal does to the score state matters more
 *     than when it happened. Equalizers and go-aheads earn the most. Goals
 *     scored when already ahead by 2+ are penalized as "padding".
 *  4. **Game winner** — if this is the final goal of the match AND its team
 *     wins, it gets a bonus on top of everything else.
 *
 * Output is clamped to [0.2, 1.0] so even mundane goals still have some
 * presence. Use the value as a multiplier for size, animation duration, ring
 * counts, stroke widths, and any "screen presence" overlays.
 */
export const goalWeight = (goal: Goal, allGoals: Goal[]): number => {
  // Score state immediately BEFORE this goal is counted.
  const beforeHome = allGoals.filter(
    (g) => g.team === "home" && g.minute < goal.minute,
  ).length;
  const beforeAway = allGoals.filter(
    (g) => g.team === "away" && g.minute < goal.minute,
  ).length;
  const afterHome = goal.team === "home" ? beforeHome + 1 : beforeHome;
  const afterAway = goal.team === "away" ? beforeAway + 1 : beforeAway;

  const teamWasBehind =
    goal.team === "home"
      ? beforeHome < beforeAway
      : beforeAway < beforeHome;
  const teamWasTied = beforeHome === beforeAway;
  const teamNowAhead =
    goal.team === "home"
      ? afterHome > afterAway
      : afterAway > afterHome;
  const teamLeadAfter = Math.abs(afterHome - afterAway);
  const teamWasAheadBy2Plus =
    goal.team === "home"
      ? beforeHome - beforeAway >= 2
      : beforeAway - beforeHome >= 2;

  // 1. Late-game ramp ------------------------------------------------------
  const late = clamp((goal.minute - 60) / 30, 0, 1); // 0 at 60', 1 at 90'+

  // 2. Early-shock (first ~6 minutes) -------------------------------------
  const early = goal.minute < 6 ? 1 - goal.minute / 6 : 0;

  // 3. Decisive state ------------------------------------------------------
  let decisive: number;
  const becameEqualizer =
    !teamWasTied && afterHome === afterAway;
  if (teamWasBehind && teamNowAhead) {
    decisive = 1; // flipped from losing to leading — the most dramatic state change
  } else if (becameEqualizer) {
    decisive = 0.7;
  } else if (teamWasTied && teamNowAhead) {
    decisive = 0.55;
  } else if (teamWasAheadBy2Plus) {
    decisive = -0.25; // padding goal
  } else {
    decisive = 0.15; // extending a 1-goal lead etc.
  }

  // 4. Game-winner bonus --------------------------------------------------
  // The "game winner" is the goal that made the final winning team go ahead
  // and never gave up the lead afterwards.
  const isGameWinner = computeIsGameWinner(goal, allGoals);
  const winnerBonus = isGameWinner ? 0.2 : 0;

  // Combine ---------------------------------------------------------------
  const base = 0.32;
  const weight =
    base + late * 0.35 + early * 0.18 + decisive * 0.3 + winnerBonus;

  return clamp(weight, 0.2, 1);
};

/**
 * Returns true when this goal both put the team ahead AND the team never lost
 * the lead between this goal and full time.
 */
const computeIsGameWinner = (goal: Goal, allGoals: Goal[]): boolean => {
  const beforeHome = allGoals.filter(
    (g) => g.team === "home" && g.minute < goal.minute,
  ).length;
  const beforeAway = allGoals.filter(
    (g) => g.team === "away" && g.minute < goal.minute,
  ).length;
  const afterHome = goal.team === "home" ? beforeHome + 1 : beforeHome;
  const afterAway = goal.team === "away" ? beforeAway + 1 : beforeAway;
  const teamNowAhead =
    goal.team === "home"
      ? afterHome > afterAway
      : afterAway > afterHome;
  if (!teamNowAhead) return false;

  // From this goal forward, the lead must never be tied or reversed.
  const subsequent = allGoals.filter((g) => g.minute > goal.minute);
  let h = afterHome;
  let a = afterAway;
  for (const g of subsequent) {
    if (g.team === "home") h++;
    else a++;
    const stillAhead =
      goal.team === "home" ? h > a : a > h;
    if (!stillAhead) return false;
  }
  // And the team must actually win at full time.
  const finalAhead = goal.team === "home" ? h > a : a > h;
  return finalAhead;
};

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
