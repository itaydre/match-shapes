import React from "react";

export const GRID_COLS = 5;
export const GRID_ROWS = 4;

export type GridRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export const cellRect = (
  index: number,
  bounds: { left: number; top: number; width: number; height: number },
): GridRect => {
  const cw = bounds.width / GRID_COLS;
  const ch = bounds.height / GRID_ROWS;
  const col = index % GRID_COLS;
  const row = Math.floor(index / GRID_COLS) % GRID_ROWS;
  return {
    x: bounds.left + col * cw,
    y: bounds.top + row * ch,
    w: cw,
    h: ch,
  };
};

export const cellCount = GRID_COLS * GRID_ROWS;

type Props = {
  bounds: { left: number; top: number; width: number; height: number };
  visible: boolean;
  color: string;
};

/** Light dotted-grid overlay. Rendered for the home half and the away half. */
export const TeamGrid: React.FC<Props> = ({ bounds, visible, color }) => {
  if (!visible) return null;
  const cw = bounds.width / GRID_COLS;
  const ch = bounds.height / GRID_ROWS;
  const lines: React.ReactNode[] = [];
  for (let c = 1; c < GRID_COLS; c++) {
    lines.push(
      <line
        key={`v${c}`}
        x1={c * cw}
        y1={0}
        x2={c * cw}
        y2={bounds.height}
        stroke={color}
        strokeWidth={0.6}
        strokeDasharray="2 6"
      />,
    );
  }
  for (let r = 1; r < GRID_ROWS; r++) {
    lines.push(
      <line
        key={`h${r}`}
        x1={0}
        y1={r * ch}
        x2={bounds.width}
        y2={r * ch}
        stroke={color}
        strokeWidth={0.6}
        strokeDasharray="2 6"
      />,
    );
  }
  return (
    <svg
      style={{
        position: "absolute",
        left: bounds.left,
        top: bounds.top,
        pointerEvents: "none",
      }}
      width={bounds.width}
      height={bounds.height}
    >
      {lines}
    </svg>
  );
};
