import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { Team } from "../schema";
import type { GridRect } from "./TeamGrid";
import {
  CheckerWheel,
  ConcentricArcs,
  DomeArches,
  RadialBurst,
} from "../shapes/goal-shapes";

type Props = {
  rect: GridRect;
  team: Team;
  opponentColor: string;
  style: number; // 0..3
  triggerFrame: number;
  emotion: number; // 0..1
  clash: number; // 0..1
  /** Drama weight 0..1 from the goal-weight model. Drives size, duration, density. */
  weight: number;
};

const ORIGIN_BY_INDEX = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;

/**
 * Animated goal artwork. The base cell rectangle is grown by `weight`, and the
 * shape's intrinsic density (rings, wedges, slice count) is also scaled by
 * weight so dramatic goals don't just look bigger — they feel busier.
 */
export const GoalArt: React.FC<Props> = ({
  rect,
  team,
  opponentColor,
  style,
  triggerFrame,
  emotion,
  clash,
  weight,
}) => {
  const frame = useCurrentFrame();
  const local = frame - triggerFrame;
  if (local < 0) return null;

  // Non-linear radial build from the bloom's center. No pre-transition,
  // no float, no breath — element materializes by expanding outward and
  // then holds dead still.
  const enterDur = Math.round(22 + weight * 14); // 22..36 frames
  const t = Math.min(1, local / enterDur);
  const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
  // Cover the 100-unit viewBox plus its diagonal so the reveal completes cleanly.
  const revealR = eased * 75;

  // Size growth: even baseline goals fill ~2.5 cells; a 90' winner pushes the
  // whole team half. The intent is editorial collage — let shapes overlap each
  // other and the score numeral.
  const sizeMul = 2.5 + weight * 2.5;
  const grownW = rect.w * sizeMul;
  const grownH = rect.h * sizeMul;
  const grownX = rect.x + rect.w / 2 - grownW / 2;
  const grownY = rect.y + rect.h / 2 - grownH / 2;

  // Density / stroke scaling. Density bumps more than stroke so dramatic goals
  // feel busier without becoming chunkier.
  const ringMul = 1.2 + weight * 0.6;
  const strokeMul = 1 + weight * 0.4;

  const clipId = `goal-clip-${triggerFrame}-${style}`;

  return (
    <svg
      style={{
        position: "absolute",
        left: grownX,
        top: grownY,
        pointerEvents: "none",
        mixBlendMode: "multiply",
      }}
      width={grownW}
      height={grownH}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx={50} cy={50} r={revealR} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {style === 0 ? (
          <ConcentricArcs
            color={team.flagPrimary}
            ringCount={Math.round(18 * ringMul)}
            strokeWidth={2.2 * strokeMul}
            gap={5.4 / Math.sqrt(ringMul)}
            origin={ORIGIN_BY_INDEX[Math.abs(triggerFrame) % 4]}
          />
        ) : style === 1 ? (
          <RadialBurst
            color={team.flagPrimary}
            wedgeCount={Math.round(36 * ringMul)}
            wedgeWidth={1.3 * strokeMul}
            clash={clash}
          />
        ) : style === 2 ? (
          <DomeArches
            color={team.flagPrimary}
            sliceCount={Math.round(24 * ringMul)}
            strokeWidth={1.2 * strokeMul}
          />
        ) : (
          <CheckerWheel
            primary={team.flagPrimary}
            secondary={opponentColor}
            slices={Math.round(12 * Math.sqrt(ringMul))}
            rings={Math.round(3 * Math.sqrt(ringMul))}
            clash={clash}
          />
        )}
      </g>
    </svg>
  );
};

/**
 * Brief team-color overlay flash used when a high-weight goal lands. Fades
 * through 0 → ~0.18 alpha → 0 over ~24 frames so it punctuates the moment
 * without pulling focus from the artwork.
 */
type FlashProps = {
  triggerFrame: number;
  color: string;
  weight: number;
};

export const DramaticFlash: React.FC<FlashProps> = ({
  triggerFrame,
  color,
  weight,
}) => {
  const frame = useCurrentFrame();
  if (weight < 0.7) return null;
  const local = frame - triggerFrame;
  const peak = 0.06 + (weight - 0.7) * 0.5; // up to ~0.21 alpha at weight=1
  const o = interpolate(local, [0, 6, 24], [0, peak, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (o <= 0.001) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: color,
        opacity: o,
        pointerEvents: "none",
      }}
    />
  );
};
