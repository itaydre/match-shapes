import React from "react";

type Props = {
  y: number;
  width: number;
  /** Stroke color (typically a translucent ink). */
  color?: string;
  /** Center circle radius in CSS pixels. */
  radius?: number;
};

/**
 * Soccer-pitch style midfield markings: the half-way line, the center circle,
 * and the center spot. Strong enough to read clearly but still feels like
 * pitch ink rather than a UI element.
 */
export const Midline: React.FC<Props> = ({
  y,
  width,
  color = "rgba(20,20,20,0.22)",
  radius = 130,
}) => {
  const cx = width / 2;
  return (
    <>
      <div
        style={{
          position: "absolute",
          top: y - 1,
          left: 0,
          width,
          height: 2,
          background: color,
        }}
      />
      <svg
        style={{
          position: "absolute",
          top: y - radius - 4,
          left: cx - radius - 4,
          pointerEvents: "none",
        }}
        width={radius * 2 + 8}
        height={radius * 2 + 8}
        viewBox={`0 0 ${radius * 2 + 8} ${radius * 2 + 8}`}
      >
        <circle
          cx={radius + 4}
          cy={radius + 4}
          r={radius}
          stroke={color}
          strokeWidth={2}
          fill="none"
        />
        <circle
          cx={radius + 4}
          cy={radius + 4}
          r={5}
          fill={color}
        />
      </svg>
    </>
  );
};
