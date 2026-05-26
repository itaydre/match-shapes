import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BaseLayout, PANEL_BOUNDS } from "./components/BaseLayout";
import { ScoreNumeral } from "./components/ScoreNumeral";
import { matchCardSchema } from "./schema";
import type { MatchCardProps, Goal } from "./schema";
import { minuteToFrame } from "./lib/timing";

// Radial-burst goal animation. Each goal fires a dense fan of thin
// two-colour bars on a black ground (magenta/cyan reference).
//
// Lifecycle per goal (length BURST_DUR frames):
//   • 0..EXPAND   — bars scale from 0 → fills the ENTIRE canvas
//                   (overrides the panel boundaries, takes the screen).
//   • EXPAND..HOLD — held at full-screen size.
//   • HOLD..END   — eases back down to a small bloom around the focal
//                   cell (the "resize" the user described).
// Multiple goals fire their bursts in sequence; while one's resizing,
// the next can already begin its takeover.

const CANVAS_W = 1080;
const CANVAS_H = 2340;
const BURST_DUR = 110;
const EXPAND_FRAMES = 12;
const HOLD_FRAMES = 28; // up to which the burst stays at full screen
const SHRINK_END = BURST_DUR; // by this frame the burst has settled small
const SMALL_RADIUS = 220;
const BARS = 64;

type ResolvedGoal = {
  goal: Goal;
  triggerFrame: number;
  focalX: number;
  focalY: number;
  primary: string;
  secondary: string;
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutQuad = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export const GridMatchCardRadialBurst: React.FC<MatchCardProps> = (props) => {
  const frame = useCurrentFrame();
  const { home, away, competition, venue, date, goals } = props;

  const midY = (PANEL_BOUNDS.top + PANEL_BOUNDS.bottom) / 2;
  const cx = (PANEL_BOUNDS.left + PANEL_BOUNDS.right) / 2;

  const resolved: ResolvedGoal[] = goals.map((g) => {
    const triggerFrame = minuteToFrame(g.minute);
    const halfCol = g.cell % 5;
    const halfRow = Math.floor(g.cell / 5);
    const focalX =
      PANEL_BOUNDS.left + (halfCol / 5 + 1 / 10) * PANEL_BOUNDS.width;
    const focalRowFraction = halfRow / 4 + 1 / 8;
    const focalY =
      g.team === "home"
        ? PANEL_BOUNDS.top + focalRowFraction * (PANEL_BOUNDS.height / 2)
        : midY + focalRowFraction * (PANEL_BOUNDS.height / 2);
    return {
      goal: g,
      triggerFrame,
      focalX,
      focalY,
      primary: g.team === "home" ? home.flagPrimary : away.flagPrimary,
      secondary: g.team === "home" ? home.flagSecondary : away.flagSecondary,
    };
  });

  const homeFiredFrames = resolved
    .filter((rg) => rg.goal.team === "home" && frame >= rg.triggerFrame)
    .map((rg) => rg.triggerFrame);
  const awayFiredFrames = resolved
    .filter((rg) => rg.goal.team === "away" && frame >= rg.triggerFrame)
    .map((rg) => rg.triggerFrame);
  const homeScoreNow = homeFiredFrames.length;
  const awayScoreNow = awayFiredFrames.length;
  const lastHomeBump =
    homeFiredFrames.length > 0
      ? homeFiredFrames[homeFiredFrames.length - 1]
      : -1;
  const lastAwayBump =
    awayFiredFrames.length > 0
      ? awayFiredFrames[awayFiredFrames.length - 1]
      : -1;

  // Compute per-goal burst state. Returns {anchor, scaleNorm, opacity}
  // — scaleNorm is 0 (collapsed), 1 (full screen), or anything in
  // between during expand/shrink.
  const burstStates = resolved.map((rg) => {
    const local = frame - rg.triggerFrame;
    if (local < 0 || local > SHRINK_END) {
      return null;
    }
    let scaleNorm = 0;
    if (local <= EXPAND_FRAMES) {
      const t = local / EXPAND_FRAMES;
      scaleNorm = easeOutCubic(t);
    } else if (local <= HOLD_FRAMES) {
      scaleNorm = 1;
    } else {
      const t = (local - HOLD_FRAMES) / (SHRINK_END - HOLD_FRAMES);
      scaleNorm = 1 - easeInOutQuad(t);
    }
    return { rg, local, scaleNorm };
  });

  // Burst diameter — when scaleNorm=1, the fan reaches the PANEL
  // diagonal so it covers the pitch but stays inside the card chrome.
  const fullReach = Math.hypot(PANEL_BOUNDS.width, PANEL_BOUNDS.height);

  return (
    <AbsoluteFill>
      <BaseLayout
        home={home}
        away={away}
        competition={competition}
        venue={venue}
        date={date}
      />
      {/*
        Bursts intentionally render OUTSIDE the panel clip during their
        full-screen phase, so they black out the entire card chrome too.
      */}
      <svg
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
        width={CANVAS_W}
        height={CANVAS_H}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      >
        <defs>
          <clipPath id="radial-panel-clip">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
            />
          </clipPath>
        </defs>
        <g clipPath="url(#radial-panel-clip)">
        {burstStates.map((state, i) => {
          if (!state) return null;
          const { rg, scaleNorm } = state;
          // Anchor migrates from panel-bottom-centre (when expanded)
          // to focal cell (when collapsed) so the resize collapses
          // back to the goal's actual position on the pitch.
          const anchorX =
            (PANEL_BOUNDS.left + PANEL_BOUNDS.right) / 2 +
            (rg.focalX - (PANEL_BOUNDS.left + PANEL_BOUNDS.right) / 2) *
              (1 - scaleNorm);
          const anchorY =
            PANEL_BOUNDS.bottom +
            (rg.focalY - PANEL_BOUNDS.bottom) * (1 - scaleNorm);
          const reach =
            SMALL_RADIUS + (fullReach - SMALL_RADIUS) * scaleNorm;

          // Black takeover background — only at full screen, fades out
          // as the burst resizes back.
          const bgOpacity = Math.max(0, Math.min(1, scaleNorm * 1.6 - 0.4));

          // Build the fan — BARS thin rects rotated around the anchor,
          // fanning ~200° upward.
          const bars: React.ReactNode[] = [];
          const open = Math.PI * 1.1; // ~198°
          const startAng = -Math.PI / 2 - open / 2;
          // Each bar is built as a LINE that draws in from the anchor
          // toward its outer endpoint via strokeDashoffset. Bars are
          // staggered so the fan assembles spoke by spoke instead of
          // fading in as one image. During the resize phase the offset
          // animates back so each line collapses individually.
          const local = state.local;
          for (let b = 0; b < BARS; b++) {
            const u = b / BARS;
            const a = startAng + u * open;
            const lenJitter = 0.55 + Math.abs(Math.sin(b * 1.7 + i)) * 0.45;
            // Use the panel-diagonal max reach so the line's full
            // length is constant; the dash offset reveals only part
            // of it depending on the per-line phase.
            const len = fullReach * lenJitter;
            const barW = Math.max(3, fullReach * 0.014);
            const isGap = b % 7 === 3;
            const stroke = isGap
              ? "#0E0E0E"
              : b % 2 === 0
                ? rg.primary
                : rg.secondary;
            // Per-bar stagger — bars near the centre of the fan draw
            // in first, then the edges. Stagger amount keeps the
            // sequence inside the EXPAND window.
            const staggerCentre = Math.abs(u - 0.5) * EXPAND_FRAMES * 1.4;
            // Per-bar draw progress 0..1, derived from local frame
            // minus the bar's stagger. During the EXPAND+HOLD window
            // it climbs to 1; after HOLD it inverts back to 0.
            let lineProgress: number;
            if (local <= EXPAND_FRAMES + 4) {
              const t = Math.max(0, (local - staggerCentre) / 8);
              lineProgress = Math.max(0, Math.min(1, t));
            } else if (local <= HOLD_FRAMES) {
              lineProgress = 1;
            } else {
              // Each bar retracts at its own stagger, leading-edge first.
              const t =
                ((local - HOLD_FRAMES) - staggerCentre) /
                (SHRINK_END - HOLD_FRAMES);
              lineProgress = Math.max(0, Math.min(1, 1 - t));
            }
            const cos = Math.cos(a);
            const sin = Math.sin(a);
            const x1 = anchorX;
            const y1 = anchorY;
            const x2 = anchorX + cos * len;
            const y2 = anchorY + sin * len;
            const pathLen = 100;
            const offset = (1 - lineProgress) * pathLen;
            bars.push(
              <line
                key={b}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={stroke}
                strokeWidth={barW}
                pathLength={pathLen}
                strokeDasharray={pathLen}
                strokeDashoffset={offset}
                strokeLinecap="butt"
              />,
            );
          }

          return <g key={i}>{bars}</g>;
        })}
        </g>
      </svg>
      <ScoreNumeral
        value={homeScoreNow}
        color={home.flagPrimary}
        cx={cx}
        cy={(PANEL_BOUNDS.top + midY) / 2}
        bumpFrame={lastHomeBump}
        sweepFrames={8}
        sweepDirection="horizontal"
      />
      <ScoreNumeral
        value={awayScoreNow}
        color={away.flagPrimary}
        cx={cx}
        cy={(midY + PANEL_BOUNDS.bottom) / 2}
        bumpFrame={lastAwayBump}
        sweepFrames={8}
        sweepDirection="horizontal"
      />
    </AbsoluteFill>
  );
};

export { matchCardSchema };
