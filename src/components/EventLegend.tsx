import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { fonts, palette } from "../lib/theme";

/**
 * Tiny floating legend that fades in around the same time as the events
 * themselves. Sits on the inside of the right margin so it doesn't compete
 * with the venue caption.
 */
const ITEMS: { key: string; label: string; render: () => React.ReactNode }[] = [
  {
    key: "shot",
    label: "SHOT",
    render: () => <circle cx={6} cy={6} r={4} fill={palette.ink} />,
  },
  {
    key: "foul",
    label: "FOUL",
    render: () => (
      <circle
        cx={6}
        cy={6}
        r={4}
        fill="none"
        stroke={palette.ink}
        strokeWidth={1.2}
      />
    ),
  },
  {
    key: "yellow",
    label: "YELLOW",
    render: () => (
      <rect x={2} y={1} width={8} height={11} fill="#F5C518" />
    ),
  },
  {
    key: "red",
    label: "RED",
    render: () => (
      <rect x={2} y={1} width={8} height={11} fill="#E13929" />
    ),
  },
  {
    key: "corner",
    label: "CORNER",
    render: () => (
      <polygon points="6,1 11,11 1,11" fill={palette.ink} />
    ),
  },
  {
    key: "freekick",
    label: "FREE KICK",
    render: () => (
      <line
        x1={1}
        y1={6}
        x2={11}
        y2={6}
        stroke={palette.ink}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    ),
  },
  {
    key: "penalty",
    label: "PENALTY",
    render: () => (
      <g>
        <circle
          cx={6}
          cy={6}
          r={5}
          fill="none"
          stroke={palette.ink}
          strokeWidth={1.1}
        />
        <circle cx={6} cy={6} r={1.6} fill={palette.ink} />
      </g>
    ),
  },
];

type Props = {
  bottom: number;
  left: number;
  startFrame: number;
};

export const EventLegend: React.FC<Props> = ({ bottom, left, startFrame }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [startFrame, startFrame + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        bottom,
        left,
        display: "flex",
        gap: 18,
        opacity: o,
        fontFamily: fonts.body,
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: 1.6,
        color: palette.ink,
        alignItems: "center",
      }}
    >
      {ITEMS.map((it) => (
        <div
          key={it.key}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <svg width={12} height={12} viewBox="0 0 12 12">
            {it.render()}
          </svg>
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  );
};
