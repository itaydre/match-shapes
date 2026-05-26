import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BaseLayout, PANEL_BOUNDS } from "./components/BaseLayout";
import { ScoreNumeral } from "./components/ScoreNumeral";
import { matchCardSchema } from "./schema";
import type { MatchCardProps, Goal } from "./schema";
import { minuteToFrame } from "./lib/timing";

// Neon kaleidoscope goal animation.
// Each goal stamps a half-bloom (radial gradients + dark voids) into
// the LEFT half of the panel, then a mirrored copy is rendered on the
// RIGHT via SVG transform — giving the symmetric kaleidoscopic look.
// The whole bloom layer runs through a stacked filter chain:
//   • feTurbulence + feDisplacementMap → smeary warps
//   • triple offset feColorMatrix + feBlend → chromatic-aberration fringe
//   • grain feTurbulence overlay masked to the bloom alpha → CRT noise

const NEON_PALETTE = ["#39FF14", "#FF00C8", "#00E5FF", "#FFE700"];

type ResolvedGoal = {
  goal: Goal;
  triggerFrame: number;
  focalY: number;
  primary: string;
};

export const GridMatchCardKaleidoscope: React.FC<MatchCardProps> = (props) => {
  const frame = useCurrentFrame();
  const { home, away, competition, venue, date, goals } = props;

  const midY = (PANEL_BOUNDS.top + PANEL_BOUNDS.bottom) / 2;
  const cx = (PANEL_BOUNDS.left + PANEL_BOUNDS.right) / 2;
  const panelCx = PANEL_BOUNDS.left + PANEL_BOUNDS.width / 2;

  const resolved: ResolvedGoal[] = goals.map((g) => {
    const triggerFrame = minuteToFrame(g.minute);
    const halfRow = Math.floor(g.cell / 5);
    const focalRowFraction = halfRow / 4 + 1 / 8;
    const focalY =
      g.team === "home"
        ? PANEL_BOUNDS.top + focalRowFraction * (PANEL_BOUNDS.height / 2)
        : midY + focalRowFraction * (PANEL_BOUNDS.height / 2);
    return {
      goal: g,
      triggerFrame,
      focalY,
      primary: g.team === "home" ? home.flagPrimary : away.flagPrimary,
    };
  });

  // Per-goal reveal 0..1 over 36 frames.
  const reveals = resolved.map((rg) => {
    const local = frame - rg.triggerFrame;
    if (local < 0) return 0;
    const t = Math.min(1, local / 36);
    return 1 - Math.pow(1 - t, 3);
  });

  // Render one goal's half-bloom into the LEFT half of the panel.
  // The mirror SVG transform reflects it onto the right.
  const renderHalfBloom = (rg: ResolvedGoal, reveal: number, i: number) => {
    if (reveal <= 0.001) return null;
    const fx = PANEL_BOUNDS.left + PANEL_BOUNDS.width * 0.25; // 1/4 panel
    const fy = rg.focalY;
    const rad = reveal * PANEL_BOUNDS.width * 0.6;
    // Build 4 stretched radial gradient ellipses, each in a different
    // neon hue, offset slightly so they layer into the smear.
    const blobs: React.ReactNode[] = [];
    for (let k = 0; k < 4; k++) {
      const color = NEON_PALETTE[(i + k) % NEON_PALETTE.length];
      const gid = `kb-${i}-${k}`;
      const offX = (k - 1.5) * rad * 0.35;
      const offY = Math.sin(k * 1.7 + i) * rad * 0.4;
      const rx = rad * (0.5 + (k % 2) * 0.4);
      const ry = rad * (1.5 - (k % 2) * 0.4);
      blobs.push(
        <g key={`b-${k}`}>
          <defs>
            <radialGradient id={gid} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={color} stopOpacity="0.9" />
              <stop offset="60%" stopColor={color} stopOpacity="0.5" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse
            cx={fx + offX}
            cy={fy + offY}
            rx={rx}
            ry={ry}
            fill={`url(#${gid})`}
          />
        </g>,
      );
    }
    // Dark void — a black ellipse near the upper-outer corner with a
    // colored halo via stroke.
    const voidR = rad * 0.4;
    blobs.push(
      <g key="void">
        <ellipse
          cx={fx - rad * 0.5}
          cy={fy - rad * 0.5}
          rx={voidR}
          ry={voidR}
          fill="#000000"
        />
        <ellipse
          cx={fx - rad * 0.5}
          cy={fy - rad * 0.5}
          rx={voidR}
          ry={voidR}
          fill="none"
          stroke={rg.primary}
          strokeWidth={voidR * 0.18}
          opacity={0.6}
        />
      </g>,
    );
    // Vertical streak down the centre seam — a tall thin gradient that
    // emerges from the focal toward the kaleidoscope axis.
    blobs.push(
      <g key="seam">
        <defs>
          <linearGradient id={`seam-${i}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={NEON_PALETTE[1]} stopOpacity="0" />
            <stop offset="100%" stopColor={NEON_PALETTE[1]} stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <rect
          x={fx + rad * 0.5}
          y={fy - rad}
          width={panelCx - (fx + rad * 0.5)}
          height={rad * 2}
          fill={`url(#seam-${i})`}
        />
      </g>,
    );
    return <g key={i}>{blobs}</g>;
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

  // Animate the global filter intensities so the goal landing reads as
  // a glitch into existence rather than always-on noise.
  const maxReveal = Math.max(0, ...reveals);
  const warpScale = maxReveal * 80;
  const blurStd = maxReveal * 4;
  const grainOpacity = Math.min(0.35, maxReveal * 0.55);

  return (
    <AbsoluteFill style={{ background: "#000000" }}>
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
          <clipPath id="panel-clip-kaleido">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
            />
          </clipPath>
          {/* Smear filter — turbulence-driven displacement + soft blur. */}
          <filter id="kal-smear" x="-15%" y="-15%" width="130%" height="130%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012"
              numOctaves="3"
              seed="11"
              result="warp"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="warp"
              scale={warpScale}
              xChannelSelector="R"
              yChannelSelector="G"
              result="warped"
            />
            <feGaussianBlur in="warped" stdDeviation={blurStd} result="blurred" />
            {/* Chromatic aberration — split into RGB shifts then recombine. */}
            <feOffset in="blurred" dx="-4" dy="0" result="redOffset" />
            <feColorMatrix
              in="redOffset"
              type="matrix"
              values="1 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 1 0"
              result="redOnly"
            />
            <feOffset in="blurred" dx="0" dy="0" result="grnOffset" />
            <feColorMatrix
              in="grnOffset"
              type="matrix"
              values="0 0 0 0 0
                      0 1 0 0 0
                      0 0 0 0 0
                      0 0 0 1 0"
              result="grnOnly"
            />
            <feOffset in="blurred" dx="4" dy="0" result="bluOffset" />
            <feColorMatrix
              in="bluOffset"
              type="matrix"
              values="0 0 0 0 0
                      0 0 0 0 0
                      0 0 1 0 0
                      0 0 0 1 0"
              result="bluOnly"
            />
            <feBlend in="redOnly" in2="grnOnly" mode="screen" result="rg" />
            <feBlend in="rg" in2="bluOnly" mode="screen" />
          </filter>
          {/* Grain filter — high-frequency noise, alpha-only, multiplied
              over the bloom group. */}
          <filter id="kal-grain" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="2"
              numOctaves="1"
              seed="3"
              result="grain"
            />
            <feColorMatrix
              in="grain"
              type="matrix"
              values="0 0 0 0 1
                      0 0 0 0 1
                      0 0 0 0 1
                      0 0 0 0.55 0"
              result="grainAlpha"
            />
            <feComposite in="grainAlpha" in2="SourceGraphic" operator="in" />
          </filter>
        </defs>
        <g clipPath="url(#panel-clip-kaleido)">
          {/* Dark ground — neon reads off black. */}
          <rect
            x={PANEL_BOUNDS.left}
            y={PANEL_BOUNDS.top}
            width={PANEL_BOUNDS.width}
            height={PANEL_BOUNDS.height}
            fill="#0a0a0a"
          />
          {/* Bloom group — half-blooms on the LEFT, mirrored to the RIGHT
              for kaleidoscopic symmetry, smeared + chromatically split. */}
          <g filter="url(#kal-smear)">
            <g>
              {resolved.map((rg, i) => renderHalfBloom(rg, reveals[i], i))}
            </g>
            <g transform={`translate(${panelCx * 2} 0) scale(-1 1)`}>
              {resolved.map((rg, i) => renderHalfBloom(rg, reveals[i], i))}
            </g>
          </g>
          {/* Grain overlay — only where the bloom painted. */}
          <g filter="url(#kal-grain)" opacity={grainOpacity}>
            <g>
              {resolved.map((rg, i) => renderHalfBloom(rg, reveals[i], i))}
            </g>
            <g transform={`translate(${panelCx * 2} 0) scale(-1 1)`}>
              {resolved.map((rg, i) => renderHalfBloom(rg, reveals[i], i))}
            </g>
          </g>
        </g>
      </svg>
      <ScoreNumeral
        value={homeScoreNow}
        color={"#FFFFFF"}
        cx={cx}
        cy={(PANEL_BOUNDS.top + midY) / 2}
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
        cy={(midY + PANEL_BOUNDS.bottom) / 2}
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
