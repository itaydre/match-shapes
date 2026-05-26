import { getProject, types } from "@theatre/core";
import type { ISheet, ISheetObject } from "@theatre/core";
import studio from "@theatre/studio";

// One project, one sheet. Studio is initialised immediately — this lab
// is always an authoring environment, never a render target.
studio.initialize();

const PROJECT_ID = "theatre-lab";
export const project = getProject(PROJECT_ID);
export const sheet: ISheet = project.sheet("Stage");

export const T = types;

// Number of shape slots. Theatre sheets are static (objects must exist
// when the sheet is created), so we pre-allocate N slots and let the
// user configure each one via its `kind` enum prop.
export const SLOT_COUNT = 8;

export type ShapeKind =
  | "off"
  | "circle"
  | "rect"
  | "polygon"
  | "star"
  | "line"
  | "ring";

const KIND_OPTIONS = {
  off: "Off",
  circle: "Circle",
  rect: "Rect",
  polygon: "Polygon",
  star: "Star",
  line: "Line",
  ring: "Ring",
} as const;

// Each slot exposes a generous set of props. Slot-specific props (sides,
// points, strokeWidth) are always present so switching `kind` is loss-free.
export const buildShapeSlot = (i: number): ISheetObject<{
  kind: ShapeKind;
  x: number;
  y: number;
  size: number;
  rotation: number;
  fill: { r: number; g: number; b: number; a: number };
  stroke: { r: number; g: number; b: number; a: number };
  strokeWidth: number;
  opacity: number;
  sides: number;
  innerRatio: number;
  aspect: number;
  length: number;
}> => {
  // Defaults stagger across the canvas so newly enabled shapes are
  // visible rather than stacking at the origin.
  const defaultX = 200 + (i % 4) * 220;
  const defaultY = 200 + Math.floor(i / 4) * 260;
  const palette = [
    { r: 0.84, g: 0.19, b: 0.12 },
    { r: 0.0, g: 0.61, b: 0.23 },
    { r: 1.0, g: 0.87, b: 0.0 },
    { r: 0.0, g: 0.15, b: 0.46 },
    { r: 0.33, g: 0.09, b: 0.96 },
    { r: 1.0, g: 0.41, b: 0.0 },
    { r: 0.46, g: 0.67, b: 0.86 },
    { r: 0.05, g: 0.05, b: 0.05 },
  ];
  const pal = palette[i % palette.length]!;
  return sheet.object(`Slot ${i + 1}`, {
    kind: T.stringLiteral("off", KIND_OPTIONS),
    x: T.number(defaultX, { range: [0, 1080], nudgeMultiplier: 1 }),
    y: T.number(defaultY, { range: [0, 1080], nudgeMultiplier: 1 }),
    size: T.number(120, { range: [0, 600], nudgeMultiplier: 1 }),
    rotation: T.number(0, { range: [-Math.PI * 2, Math.PI * 2] }),
    fill: T.rgba({ r: pal.r, g: pal.g, b: pal.b, a: 1 }),
    stroke: T.rgba({ r: 0.05, g: 0.05, b: 0.05, a: 1 }),
    strokeWidth: T.number(0, { range: [0, 40] }),
    opacity: T.number(1, { range: [0, 1] }),
    sides: T.number(5, { range: [3, 24] }),
    innerRatio: T.number(0.45, { range: [0.05, 0.95] }),
    aspect: T.number(1, { range: [0.1, 4] }),
    length: T.number(300, { range: [10, 1200] }),
  });
};

export const slots = Array.from({ length: SLOT_COUNT }, (_, i) =>
  buildShapeSlot(i),
);

// Global stage controls — backdrop colour, canvas-level rotation, etc.
export const stageObj = sheet.object("Stage Controls", {
  backdrop: T.rgba({ r: 0.94, g: 0.93, b: 0.91, a: 1 }),
  pan: T.number(0, { range: [-300, 300] }),
  zoom: T.number(1, { range: [0.5, 2] }),
});

export { studio };
export { PROJECT_ID };
