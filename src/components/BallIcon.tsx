import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { Team } from "../schema";

type Props = {
  cx: number;
  cy: number;
  size: number;
  home: Team;
  away: Team;
  /** Frame at which the ball morphs from outline → glitchy flag wheel. */
  morphFrame: number;
  glitch: number;
};

/**
 * In the initial state this is a soft outline ball at midfield. As the match
 * progresses it cross-fades into a glitchy flag-segmented disk, echoing the
 * abstract goal art and reinforcing the "tension" feel.
 */
export const BallIcon: React.FC<Props> = ({
  cx,
  cy,
  size,
  home,
  away,
  morphFrame,
  glitch,
}) => {
  const frame = useCurrentFrame();

  const morph = interpolate(frame, [morphFrame, morphFrame + 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const r = size / 2;

  return (
    <svg
      style={{
        position: "absolute",
        left: cx - r,
        top: cy - r,
        pointerEvents: "none",
      }}
      width={size}
      height={size}
      viewBox="-50 -50 100 100"
    >
      {/* Outline ball — fades out as morph progresses */}
      <circle
        cx={0}
        cy={0}
        r={46}
        stroke="rgba(20,20,20,0.35)"
        strokeWidth={1.4}
        fill="none"
        opacity={1 - morph}
      />

      {/* Flag wheel — fades in */}
      <g opacity={morph}>
        {Array.from({ length: 8 }).map((_, i) => {
          const a0 = (i / 8) * Math.PI * 2;
          const a1 = ((i + 1) / 8) * Math.PI * 2;
          const fill =
            i % 3 === 0
              ? home.flagPrimary
              : i % 3 === 1
                ? away.flagPrimary
                : "#FFFFFF";
          const wob = glitch * (i % 2 === 0 ? 2 : -2);
          const x0 = Math.cos(a0) * (44 + wob);
          const y0 = Math.sin(a0) * (44 + wob);
          const x1 = Math.cos(a1) * (44 + wob);
          const y1 = Math.sin(a1) * (44 + wob);
          return (
            <path
              key={i}
              d={`M 0 0 L ${x0} ${y0} A 44 44 0 0 1 ${x1} ${y1} Z`}
              fill={fill}
              stroke="rgba(20,20,20,0.2)"
              strokeWidth={0.3}
            />
          );
        })}
        <circle
          cx={0}
          cy={0}
          r={10}
          fill="white"
          stroke="rgba(20,20,20,0.25)"
          strokeWidth={0.6}
        />
      </g>

      {/* Glitch chromatic split at high `clash`/`glitch` levels */}
      {glitch > 0.05 ? (
        <g opacity={morph * glitch}>
          <circle
            cx={glitch * 4}
            cy={0}
            r={44}
            fill="none"
            stroke={home.flagPrimary}
            strokeWidth={0.8}
            opacity={0.6}
          />
          <circle
            cx={-glitch * 4}
            cy={0}
            r={44}
            fill="none"
            stroke={away.flagPrimary}
            strokeWidth={0.8}
            opacity={0.6}
          />
        </g>
      ) : null}
    </svg>
  );
};
