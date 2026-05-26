import type { CellGridSettings, CellGridType } from "./cellGrid";
import type { LabBoundaryShape } from "./boundaryShapes";

// ─────────────────────────────────────────────────────────────────────
// AnimationSet — curated, source-of-truth list of shape recipes that
// the team has approved for use in real goal cards. Each entry mirrors
// the `recipe` field of a StaticPreviewGoal, so a consumer (gallery,
// studio, future Remotion comps) can pull a preset by id and drop it
// straight into a goal slot.
//
// To add a new preset:
//   1. Tune it in Shape Studio (lab/shape-studio.html).
//   2. Click "Copy TS recipe".
//   3. Paste the recipe block as a new ANIMATION_SET entry below,
//      give it an id + name + short description.

export type AnimationRecipe = {
  type: CellGridType;
  boundary: LabBoundaryShape;
  // Position inside the team zone, percent 0..100.
  posX: number;
  posY: number;
  // Size as percent of the team zone's shorter dimension.
  size: number;
  moireStrength: number;
  blendTarget: CellGridType;
  blendAmount: number;
  recursionDepth: number;
  settings: CellGridSettings;
};

export type AnimationPreset = {
  id: string;
  name: string;
  description: string;
  recipe: AnimationRecipe;
};

export const ANIMATION_SET: AnimationPreset[] = [
  {
    id: "squishy-blob-01",
    name: "Squishy Blob 01",
    description:
      "Inward-pulled soft blobs under high twist. Pinch + negative outward force squeezes the field toward its centre; curvature 127 swirls the squeeze.",
    recipe: {
      type: "squishy_blobs",
      boundary: "circle",
      posX: 50,
      posY: 50,
      size: 65,
      moireStrength: 0,
      blendTarget: "wedges",
      blendAmount: 0,
      recursionDepth: 0,
      settings: {
        colorRandomness: 34,
        dominantColor: 30,
        colorClustering: 30,
        colorContrast: 56,
        distortionStrength: 28,
        outwardForce: -36,
        pinchIntensity: 25,
        edgeOrganicness: 20,
        curvature: 127,
        asymmetry: 20,
        shapeDensity: 50,
        shapeScale: 1.15,
        rotation: 7,
        margin: 5,
        seed: 4165,
      },
    },
  },
  {
    id: "plotter-lines-01",
    name: "Plotter Lines 01",
    description:
      "Heavily warped plotter-line field. Distortion 95 + curvature 167 twist the lines through a wide margin so the strokes pull into a swirling cyclone read.",
    recipe: {
      type: "plotter_lines",
      boundary: "circle",
      posX: 50,
      posY: 50,
      size: 65,
      moireStrength: 0,
      blendTarget: "wedges",
      blendAmount: 0,
      recursionDepth: 0,
      settings: {
        colorRandomness: 43,
        dominantColor: 14,
        colorClustering: 30,
        colorContrast: 56,
        distortionStrength: 95,
        outwardForce: 55,
        pinchIntensity: 0,
        edgeOrganicness: 4,
        curvature: 167,
        asymmetry: 0,
        shapeDensity: 50,
        shapeScale: 1.45,
        rotation: 120,
        margin: 127,
        seed: 2393,
      },
    },
  },
  {
    id: "interference-mandala-01",
    name: "Interference Mandala 01",
    description:
      "Outward-blown mandala with no inner distortion. Outward 100 + edgeOrganicness 62 push the moiré rings to the rim; wide margin keeps the centre breathing.",
    recipe: {
      type: "interference_mandala",
      boundary: "circle",
      posX: 50,
      posY: 50,
      size: 65,
      moireStrength: 0,
      blendTarget: "wedges",
      blendAmount: 0,
      recursionDepth: 0,
      settings: {
        colorRandomness: 71,
        dominantColor: 30,
        colorClustering: 30,
        colorContrast: 56,
        distortionStrength: 0,
        outwardForce: 100,
        pinchIntensity: 0,
        edgeOrganicness: 62,
        curvature: 26,
        asymmetry: 0,
        shapeDensity: 50,
        shapeScale: 1.5,
        rotation: 65,
        margin: 107,
        seed: 0,
      },
    },
  },
];

export const getPreset = (id: string): AnimationPreset | undefined =>
  ANIMATION_SET.find((p) => p.id === id);
