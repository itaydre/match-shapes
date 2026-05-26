import { frameToMinute, MATCH_MINUTES } from "./timing";

/**
 * Returns the home team's cumulative possession share at a given video frame.
 * The midpoint divider position derives from this — when home dominated, the
 * line drops (giving the home team more of the field).
 */
export const possessionAtFrame = (
  frame: number,
  timeline: number[],
): number => {
  if (timeline.length === 0) return 0.5;
  const minute = frameToMinute(frame);
  // No data yet → 50/50.
  if (minute <= 0) return 0.5;
  const lookahead = Math.min(timeline.length, Math.ceil(minute));
  let sum = 0;
  for (let i = 0; i < lookahead; i++) sum += timeline[i] ?? 0.5;
  return sum / lookahead;
};

/** Smooth a possession value into the final midpoint Y as a fraction (0..1). */
export const possessionToMidpoint = (homeShare: number): number => {
  // Home team is on TOP. Higher home possession ⇒ midpoint moves DOWN
  // (giving them more visual real estate). Damp the swing so it never hits
  // the team-name bars.
  const minY = 0.32;
  const maxY = 0.62;
  return minY + (1 - homeShare) * (maxY - minY);
};

export const buildDefaultTimeline = (
  homeBias = 0.55,
  variance = 0.18,
): number[] => {
  const out: number[] = [];
  for (let m = 0; m < MATCH_MINUTES; m++) {
    const wave = Math.sin((m / MATCH_MINUTES) * Math.PI * 3) * variance;
    const v = homeBias + wave;
    out.push(Math.max(0.1, Math.min(0.9, v)));
  }
  return out;
};
