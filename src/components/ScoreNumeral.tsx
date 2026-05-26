import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { fonts } from "../lib/theme";

type Props = {
  value: number;
  /** Color of the numeral */
  color: string;
  /** Anchor X coordinate within the panel; meaning depends on `align` */
  cx: number;
  cy: number;
  /** Frame at which this digit should change from value-1 → value */
  bumpFrame: number;
  /** Initial value (typically 0). The numeral sits at this value before bumpFrame. */
  initialValue?: number;
  /** How to interpret cx: `center` (default) treats cx as the midline; `right` treats cx as the right edge. */
  align?: "center" | "right";
  /** Frames the digit-flip wipe takes. Default 14 — pass a smaller number for a snappier flip. */
  sweepFrames?: number;
  /** Optional outline color (text-stroke). When unset, no outline is drawn. */
  outlineColor?: string;
  /** Outline thickness in px. Defaults to 6 when an outlineColor is supplied. */
  outlineWidth?: number;
  /** Direction of the digit-flip wipe. Defaults to vertical (top → bottom). */
  sweepDirection?: "vertical" | "horizontal";
};

const DEFAULT_SWEEP = 14;

/**
 * Score numeral whose container stays absolutely still. When the value
 * changes, the digit transitions via a stadium-scoreboard horizontal wipe:
 * the old digit recedes from the top, the new digit fills in behind a thin
 * colored scan-line sweeping top → bottom. Pairs with `ScoreFlare` (rendered
 * separately) for the football "stadium light" flash.
 */
export const ScoreNumeral: React.FC<Props> = ({
  value,
  color,
  cx,
  cy,
  bumpFrame,
  initialValue = 0,
  align = "center",
  sweepFrames = DEFAULT_SWEEP,
  outlineColor,
  outlineWidth = 6,
  sweepDirection = "vertical",
}) => {
  const frame = useCurrentFrame();
  // bumpFrame < 0 → pre-goal idle state. Skip the entrance animation
  // entirely so the initial value renders statically from frame 0.
  if (bumpFrame < 0) {
    const FONT_SIZE = 720;
    const lineHeight = FONT_SIZE * 0.92;
    const width = FONT_SIZE * 0.7;
    const xShift = align === "right" ? "-100%" : "-50%";
    return (
      <div
        style={{
          position: "absolute",
          left: cx,
          top: cy,
          width,
          height: lineHeight,
          transform: `translate(${xShift}, -50%)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            fontFamily: fonts.score,
            fontWeight: 666,
            fontVariationSettings: '"wght" 666, "wdth" 8.4',
            fontSize: FONT_SIZE,
            lineHeight: `${lineHeight}px`,
            color,
            textAlign: align === "right" ? "right" : "center",
            userSelect: "none",
            height: lineHeight,
            width,
            ...(outlineColor
              ? {
                  WebkitTextStroke: `${outlineWidth}px ${outlineColor}`,
                  paintOrder: "stroke fill",
                }
              : {}),
          }}
        >
          {initialValue}
        </div>
      </div>
    );
  }
  const local = frame - bumpFrame;

  const previous = local <= 0 ? initialValue : Math.max(0, value - 1);
  const FONT_SIZE = 720;
  const lineHeight = FONT_SIZE * 0.92;
  const width = FONT_SIZE * 0.7;
  const xShift = align === "right" ? "-100%" : "-50%";

  const containerStyle: React.CSSProperties = {
    position: "absolute",
    left: cx,
    top: cy,
    width,
    height: lineHeight,
    transform: `translate(${xShift}, -50%)`,
  };

  const digitStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    fontFamily: fonts.score,
    fontWeight: 666,
    fontVariationSettings: '"wght" 666, "wdth" 8.4',
    fontSize: FONT_SIZE,
    lineHeight: `${lineHeight}px`,
    color,
    textAlign: align === "right" ? "right" : "center",
    userSelect: "none",
    height: lineHeight,
    width,
    ...(outlineColor
      ? {
          WebkitTextStroke: `${outlineWidth}px ${outlineColor}`,
          paintOrder: "stroke fill",
        }
      : {}),
  };

  // Outside the wipe window we just render the appropriate digit, no clipping.
  if (local <= 0) {
    return (
      <div style={containerStyle}>
        <div style={digitStyle}>{previous}</div>
      </div>
    );
  }
  if (local >= sweepFrames) {
    return (
      <div style={containerStyle}>
        <div style={digitStyle}>{value}</div>
      </div>
    );
  }

  const tRaw = local / sweepFrames;
  const t = Math.max(0, Math.min(1, tRaw));
  // Smooth ease-in-out — fast in the middle, soft at the edges.
  const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const horizontal = sweepDirection === "horizontal";

  if (horizontal) {
    // Slide transition: previous digit slides OUT to the left while the new
    // digit slides IN from the right. Both share the container so the swap
    // is positionally seamless. The container clips overflow so digits
    // disappear cleanly off the edges.
    return (
      <div style={{ ...containerStyle, overflow: "hidden" }}>
        <div
          style={{
            ...digitStyle,
            transform: `translateX(${(-eased * 110).toFixed(2)}%)`,
          }}
        >
          {previous}
        </div>
        <div
          style={{
            ...digitStyle,
            transform: `translateX(${((1 - eased) * 110).toFixed(2)}%)`,
          }}
        >
          {value}
        </div>
      </div>
    );
  }

  // Vertical sweep — original scoreboard wipe (kept for MatchCard).
  const wipePct = eased * 100;
  return (
    <div style={containerStyle}>
      <div style={{ ...digitStyle, clipPath: `inset(${wipePct}% 0 0 0)` }}>
        {previous}
      </div>
      <div
        style={{ ...digitStyle, clipPath: `inset(0 0 ${100 - wipePct}% 0)` }}
      >
        {value}
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: `${wipePct}%`,
          height: 6,
          background: color,
          opacity: 0.85,
          transform: "translateY(-3px)",
        }}
      />
    </div>
  );
};

/**
 * Brief radial flare that sits BEHIND the numeral and pulses outward at the
 * moment of a score change. Reinforces the goal-art language (we already use
 * radial bursts on the field) while giving the numeral itself a football
 * stadium-light feel.
 */
type FlareProps = {
  cx: number;
  cy: number;
  color: string;
  triggerFrame: number;
};

export const ScoreFlare: React.FC<FlareProps> = ({
  cx,
  cy,
  color,
  triggerFrame,
}) => {
  const frame = useCurrentFrame();
  const local = frame - triggerFrame;
  if (local < 0 || local > 28) return null;

  // Opacity: rises fast, falls fast.
  const o = interpolate(local, [0, 4, 22], [0, 0.55, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Radius: rays grow outward.
  const scale = interpolate(local, [0, 22], [0.4, 1.2], {
    extrapolateRight: "clamp",
  });

  const RAY_COUNT = 24;

  return (
    <svg
      style={{
        position: "absolute",
        left: cx - 600,
        top: cy - 600,
        pointerEvents: "none",
        opacity: o,
        mixBlendMode: "multiply",
      }}
      width={1200}
      height={1200}
      viewBox="-600 -600 1200 1200"
    >
      <g transform={`scale(${scale})`}>
        {Array.from({ length: RAY_COUNT }).map((_, i) => {
          const angle = (i / RAY_COUNT) * 360;
          return (
            <g key={i} transform={`rotate(${angle})`}>
              <polygon points="-3,-280 3,-280 1.4,-560 -1.4,-560" fill={color} />
            </g>
          );
        })}
        <circle cx={0} cy={0} r={300} fill="none" stroke={color} strokeWidth={4} />
        <circle cx={0} cy={0} r={420} fill="none" stroke={color} strokeWidth={2} />
      </g>
    </svg>
  );
};
