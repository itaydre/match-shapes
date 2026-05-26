/**
 * The video is 9 seconds at 30fps = 270 frames.
 * frame 0..15  → "kick off" (initial 0-0 still)
 * frame 15..240 → match plays out, possession shifts, goals fire
 * frame 240..270 → final state holds
 */
export const FPS = 30;
export const DURATION_SECONDS = 9;
export const DURATION_FRAMES = FPS * DURATION_SECONDS;

export const KICKOFF_END = 15;
export const MATCH_END = 240;
export const MATCH_FRAMES = MATCH_END - KICKOFF_END;

// Domain helpers --------------------------------------------------------------
export const MATCH_MINUTES = 90;

/** Convert a match minute (0..90) into a video frame. */
export const minuteToFrame = (minute: number): number => {
  const t = Math.max(0, Math.min(1, minute / MATCH_MINUTES));
  return KICKOFF_END + t * MATCH_FRAMES;
};

/** Convert a video frame into a match minute (0..90). */
export const frameToMinute = (frame: number): number => {
  if (frame <= KICKOFF_END) return 0;
  if (frame >= MATCH_END) return MATCH_MINUTES;
  return ((frame - KICKOFF_END) / MATCH_FRAMES) * MATCH_MINUTES;
};
