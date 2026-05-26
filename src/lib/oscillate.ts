// Parameter oscillator for the warp field. Implements the "geometry
// under tension" motion brief: instead of keyframing shapes, we vary
// the warp settings as continuous functions of time. Multiple
// frequencies + phase offsets layered together produce the
// hypnotic / signal-like read described in the brief (Riley / Vasarely
// op-art, signal interference, breathing pressure fields).
//
// Pure function — no Remotion dependency — so it can run inside a
// Remotion composition OR a static SVG preview.

import type { CellGridSettings } from "./cellGrid";

export type OscillateOptions = {
  // How aggressively the oscillators modulate the base value. 0 = no
  // animation (cells are static, equivalent to the current frame's
  // base settings). 1 = full amplitude as specced below.
  intensity?: number;
};

// Layer two sine waves at different frequencies/phases for each
// parameter so the field reads as a non-trivial pressure pattern (not
// a single sine wobble).
export const oscillateSettings = (
  base: CellGridSettings,
  localFrame: number,
  fps: number,
  opts: OscillateOptions = {},
): CellGridSettings => {
  const intensity = opts.intensity ?? 1;
  if (intensity <= 0) return base;
  const t = localFrame / fps; // seconds since the goal fired

  // Heavier oscillator amplitudes + an extra high-frequency layer
  // on each axis for the "ravey" continuous motion the brief calls
  // for. The geometry never sits still.
  const rotation =
    base.rotation +
    t * 18 * intensity +
    (Math.sin(t * 0.3) * 8 + Math.cos(t * 1.4) * 5) * intensity;

  // Twist (curvature) — three-frequency stack now.
  const curvature =
    base.curvature +
    (Math.sin(t * 0.5) * 34 +
      Math.sin(t * 1.3 + 1.5) * 14 +
      Math.sin(t * 2.7 + 0.4) * 6) *
      intensity;

  // Bulge — bigger swings, sign-preserving.
  const outwardForce =
    base.outwardForce +
    (Math.sin(t * 0.7 + 0.5) * 22 +
      Math.sin(t * 1.9) * 10 +
      Math.cos(t * 3.4) * 4) *
      intensity;

  // Pinch — clamped to ≥0 because negative pinch is meaningless.
  const pinchIntensity = Math.max(
    0,
    (base.pinchIntensity ?? 0) +
      (Math.sin(t * 0.9 + 1.0) * 28 +
        Math.cos(t * 2.1) * 12 +
        Math.sin(t * 3.5 + 0.7) * 5) *
        intensity,
  );

  // Distortion strength — beat-like fast pulse layered over a slow
  // breathing curve.
  const distortionStrength = Math.max(
    0,
    base.distortionStrength +
      (Math.sin(t * 0.4 + 2.0) * 18 + Math.sin(t * 2.8) * 8) * intensity,
  );

  return {
    ...base,
    rotation,
    curvature,
    outwardForce,
    pinchIntensity,
    distortionStrength,
  };
};
