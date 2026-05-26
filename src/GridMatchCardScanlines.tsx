import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BaseLayout, PANEL_BOUNDS } from "./components/BaseLayout";
import { ScoreNumeral } from "./components/ScoreNumeral";
import { matchCardSchema } from "./schema";
import type { MatchCardProps, Goal } from "./schema";
import { minuteToFrame } from "./lib/timing";

// Reactive scanline distortion. Dense vertical bars in team colours
// oscillate like audio frequencies; horizontal slice bands shift those
// bars sideways with offset timing, producing a glitched analog-TV
// feel. Each goal punches a band of compressed / expanded bars into
// existence at its focal y, plus a soft radial team-colour glow that
// pulses. A turbulence-driven displacement filter adds the liquid
// instability over the whole composition.

const VERTICAL_BARS = 56;
const SLICE_BANDS = 12;

type ResolvedGoal = {
  goal: Goal;
  triggerFrame: number;
  focalY: number;
  primary: string;
  secondary: string;
};

export const GridMatchCardScanlines: React.FC<MatchCardProps> = (props) => {
  const frame = useCurrentFrame();
  const { home, away, competition, venue, date, goals } = props;

  const midY = (PANEL_BOUNDS.top + PANEL_BOUNDS.bottom) / 2;
  const cx = (PANEL_BOUNDS.left + PANEL_BOUNDS.right) / 2;
  const panelLeft = PANEL_BOUNDS.left;
  const panelRight = PANEL_BOUNDS.right;
  const panelTop = PANEL_BOUNDS.top;
  const panelBottom = PANEL_BOUNDS.bottom;
  const panelW = PANEL_BOUNDS.width;
  const panelH = PANEL_BOUNDS.height;
  const barW = panelW / VERTICAL_BARS;
  const bandH = panelH / SLICE_BANDS;

  const resolved: ResolvedGoal[] = goals.map((g) => {
    const triggerFrame = minuteToFrame(g.minute);
    const halfRow = Math.floor(g.cell / 5);
    const focalRowFraction = halfRow / 4 + 1 / 8;
    const focalY =
      g.team === "home"
        ? panelTop + focalRowFraction * (panelH / 2)
        : midY + focalRowFraction * (panelH / 2);
    return {
      goal: g,
      triggerFrame,
      focalY,
      primary: g.team === "home" ? home.flagPrimary : away.flagPrimary,
      secondary: g.team === "home" ? home.flagSecondary : away.flagSecondary,
    };
  });

  // Render the vertical bar set. Each bar has its own phase so the
  // tops + bottoms oscillate like an audio spectrum analyser.
  const renderBars = (color: string, phaseOffset: number) => {
    const out: React.ReactNode[] = [];
    for (let b = 0; b < VERTICAL_BARS; b++) {
      // Stagger the oscillation across the row — high-frequency
      // primary swing + low-frequency global breath.
      const phase = b * 0.34 + frame * 0.18 + phaseOffset;
      const swing = Math.sin(phase) * 0.4 + Math.sin(phase * 0.27) * 0.2;
      // Bar height covers most of the panel; only its top edge moves.
      const topY = panelTop + (swing + 0.5) * 30; // 0..60px wobble
      const bottomY = panelBottom - (swing * -1 + 0.5) * 30;
      out.push(
        <rect
          key={b}
          x={panelLeft + b * barW}
          y={topY}
          width={barW * 0.6}
          height={bottomY - topY}
          fill={color}
          opacity={0.85}
        />,
      );
    }
    return out;
  };

  // Score state.
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

  // Aggregate the freshest goal so the global filter parameters react.
  let strongestReveal = 0;
  let activePrimary = home.flagPrimary;
  let activeSecondary = home.flagSecondary;
  for (const rg of resolved) {
    const local = frame - rg.triggerFrame;
    if (local < 0) continue;
    const t = Math.min(1, local / 36);
    const eased = 1 - Math.pow(1 - t, 3);
    if (eased > strongestReveal) {
      strongestReveal = eased;
      activePrimary = rg.primary;
      activeSecondary = rg.secondary;
    }
  }

  // Ambient baseline + goal kick on the warp & blur.
  const warpScale = 6 + strongestReveal * 36;
  const blurStd = 0.6 + strongestReveal * 2.4;

  return (
    <AbsoluteFill style={{ background: "#080812" }}>
      <BaseLayout
        home={home}
        away={away}
        competition={competition}
        venue={venue}
        date={date}
      />
      <svg
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
        width={1080}
        height={2340}
        viewBox="0 0 1080 2340"
      >
        <defs>
          <clipPath id="panel-clip-scanlines">
            <rect
              x={panelLeft}
              y={panelTop}
              width={panelW}
              height={panelH}
            />
          </clipPath>
          {/* Soft team-colour glow gradient that pulses with the freshest
              goal — replaces the magenta-violet of the reference. */}
          <radialGradient id="scan-glow" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor={activePrimary} stopOpacity="0.55" />
            <stop offset="40%" stopColor={activeSecondary} stopOpacity="0.32" />
            <stop offset="100%" stopColor={activePrimary} stopOpacity="0" />
          </radialGradient>
          {/* Slice-band clipPaths — each horizontal slice gets its own
              bars rendered offset, so the bands shift relative to one
              another. */}
          {Array.from({ length: SLICE_BANDS }).map((_, b) => {
            const y = panelTop + b * bandH;
            return (
              <clipPath key={`band-${b}`} id={`scan-band-${b}`}>
                <rect
                  x={panelLeft}
                  y={y}
                  width={panelW}
                  height={bandH + 1}
                />
              </clipPath>
            );
          })}
          {/* Displacement filter — gives the whole composition the liquid
              analog-TV instability described in the brief. Strength
              ramps up when a goal fires. */}
          <filter id="scan-warp" x="-6%" y="-6%" width="112%" height="112%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.008 0.04"
              numOctaves="2"
              seed="13"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={warpScale}
              xChannelSelector="R"
              yChannelSelector="G"
              result="warped"
            />
            <feGaussianBlur in="warped" stdDeviation={blurStd} />
          </filter>
        </defs>
        <g clipPath="url(#panel-clip-scanlines)">
          {/* Dark ground so the neon bars read brightly. */}
          <rect
            x={panelLeft}
            y={panelTop}
            width={panelW}
            height={panelH}
            fill="#080812"
          />
          {/* Slice bands — each contains its own copy of the vertical
              bar set, translated sideways by a slice-specific amount
              and rendered in primary or secondary based on parity.
              The slide rate also varies, so adjacent bands appear to
              tear past each other. */}
          <g filter="url(#scan-warp)">
            {Array.from({ length: SLICE_BANDS }).map((_, b) => {
              const t =
                Math.sin(frame * 0.05 + b * 0.6) * barW * 6 +
                Math.sin(frame * 0.012 + b * 1.3) * barW * 2;
              const color = b % 2 === 0 ? activePrimary : activeSecondary;
              const phaseOffset = b * 0.9;
              return (
                <g
                  key={`slice-${b}`}
                  clipPath={`url(#scan-band-${b})`}
                  transform={`translate(${t} 0)`}
                >
                  {renderBars(color, phaseOffset)}
                </g>
              );
            })}
            {/* Pulsing glow blob centred on the freshest goal's focal y,
                in team primary — magenta-violet replaced by team palette. */}
            {strongestReveal > 0.001 && (
              <ellipse
                cx={cx}
                cy={
                  resolved.find(
                    (rg) =>
                      frame - rg.triggerFrame >= 0 &&
                      frame - rg.triggerFrame <= 36,
                  )?.focalY ?? midY
                }
                rx={panelW * 0.5}
                ry={panelH * 0.32 * strongestReveal}
                fill="url(#scan-glow)"
                opacity={0.7 + Math.sin(frame * 0.16) * 0.18}
              />
            )}
          </g>
        </g>
      </svg>
      <ScoreNumeral
        value={homeScoreNow}
        color={"#FFFFFF"}
        cx={cx}
        cy={(panelTop + midY) / 2}
        bumpFrame={lastHomeBump}
        sweepFrames={8}
        sweepDirection="horizontal"
        outlineColor={home.flagPrimary}
        outlineWidth={12}
      />
      <ScoreNumeral
        value={awayScoreNow}
        color={"#FFFFFF"}
        cx={cx}
        cy={(midY + panelBottom) / 2}
        bumpFrame={lastAwayBump}
        sweepFrames={8}
        sweepDirection="horizontal"
        outlineColor={away.flagPrimary}
        outlineWidth={12}
      />
    </AbsoluteFill>
  );
};

export { matchCardSchema };
