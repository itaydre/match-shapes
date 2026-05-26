import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  StaticPreview,
  type StaticPreviewGoal,
  type StaticPreviewTeam,
  type MatchEvent,
} from "./StaticPreview";
import { StaticPreviewV3 } from "./StaticPreviewV3";
import { SHAPE_FAMILIES, type ShapeFamily } from "./showcaseShapes";

// ── Per-match shape shuffle (mirrors GameGalleryV2) ──────────────────
// Each match gets a fresh shuffled permutation of all shape families;
// every goal is assigned a distinct family, de-clustered so no two
// visually-similar shapes land on consecutive goals.
const v1Seed = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) & 0x7fffffff;
  }
  return h;
};
const v1Rand = (seed: number) => {
  let h = seed || 1;
  return () => {
    h = (h * 1664525 + 1013904223) & 0x7fffffff;
    return h / 0x7fffffff;
  };
};
const v1FamiliesForGame = (gameId: string): ShapeFamily[] => {
  const rand = v1Rand(v1Seed(gameId));
  const order = [...SHAPE_FAMILIES];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
};
const v1FamilyGroup = (f: ShapeFamily): string => {
  if (f === "lens_mandala") return "lens";
  if (
    f.startsWith("vortex_disc") ||
    f === "polar_vortex" ||
    f === "polar_swirl" ||
    f === "interference_mandala" ||
    f === "shatter_mandala" ||
    f === "mandala_curves" ||
    f === "crown_dial" ||
    f === "basket_vortex" ||
    f === "radial_checker" ||
    f === "swirl_checker" ||
    f === "shard_vortex" ||
    f === "collapsed_quadrant" ||
    f === "checker_spiral" ||
    f === "checker_tunnel" ||
    f === "ring_spiral" ||
    f === "pixel_swirl" ||
    f === "solar_flare" ||
    f === "tactical_scan" ||
    f === "spiral_tunnel" ||
    f === "chip_storm"
  ) {
    return "radial";
  }
  if (f.includes("ribbon")) return "ribbon";
  if (f.includes("arcs")) return "arcs";
  if (f.includes("burst")) return "burst";
  if (f.includes("pixel")) return "pixel";
  if (f.startsWith("sphere")) return "sphere";
  return f;
};
// Dense / high-impact families — used for single-goal matches so a 1-0
// lands a strong shape, never a sparse spokes/rays one.
const V1_STRONG_FAMILIES: ShapeFamily[] = [
  "radial_burst",
  "fragmented_burst",
  "burst_segments",
  "primary_sunburst",
  "solar_flare",
  "shatter_mandala",
  "pixel_bloom",
  "vortex_disc",
  "vortex_disc_spinner",
  "warped_checker",
  "swirl_checker",
  "shard_vortex",
  "interference_mandala",
];

export const v1BuildFamilyMap = (
  gameId: string,
  goals: StaticPreviewGoal[],
): Map<string, ShapeFamily> => {
  const sorted = [...goals].sort((a, b) => a.minute - b.minute);
  const map = new Map<string, ShapeFamily>();
  if (sorted.length === 0) return map;
  // A single-goal match (e.g. 1-0) gets ONE decisive, dense shape — never
  // a sparse "lines of spokes" family — so the lone goal carries the card.
  if (sorted.length === 1) {
    const g = sorted[0]!;
    const fam =
      V1_STRONG_FAMILIES[v1Seed(gameId) % V1_STRONG_FAMILIES.length]!;
    map.set(g.id, fam);
    return map;
  }
  const shuffled = v1FamiliesForGame(gameId);
  // "Perspective fans & beams" are barred from late goals (minute 80+).
  const LATE_BANNED: ShapeFamily[] = [
    "signal_fan",
    "perspective_fan",
    "beam_projection",
  ];
  const used = new Set<ShapeFamily>();
  let cursor = 0;
  let prevGroup = "";
  for (const g of sorted) {
    const banned = (f: ShapeFamily) =>
      g.minute >= 80 && LATE_BANNED.includes(f);
    let pick: ShapeFamily | null = null;
    for (let scan = 0; scan < shuffled.length; scan++) {
      const cand = shuffled[(cursor + scan) % shuffled.length]!;
      if (used.has(cand)) continue;
      if (banned(cand)) continue;
      // Never put two consecutive goals in the same category.
      if (v1FamilyGroup(cand) === prevGroup) continue;
      pick = cand;
      cursor = (cursor + scan + 1) % shuffled.length;
      break;
    }
    if (!pick) {
      // Keep the category different and respect the late-goal ban where
      // possible; only relax as an absolute last resort.
      pick =
        shuffled.find((f) => !banned(f) && v1FamilyGroup(f) !== prevGroup) ??
        shuffled.find((f) => !banned(f) && !used.has(f)) ??
        shuffled.find((f) => !banned(f)) ??
        shuffled[cursor % shuffled.length]!;
      cursor = (cursor + 1) % shuffled.length;
    }
    used.add(pick);
    prevGroup = v1FamilyGroup(pick);
    map.set(g.id, pick);
  }
  return map;
};
import {
  DEFAULT_SETTINGS,
  type CellGridSettings,
  type CellGridType,
} from "../src/lib/cellGrid";
import type { LabBoundaryShape } from "../src/lib/boundaryShapes";
import { getPreset } from "../src/lib/animationSet";
import {
  computeGoalImportance,
  type MatchContext,
} from "../src/lib/goalImportance";

// Canonical national-team palettes (primary | secondary | accent).
// These are the colours used on the actual flags / kits, not stylised
// match-card tweaks.
const TEAMS: Record<string, StaticPreviewTeam> = {
  BRAZIL: {
    name: "Brazil",
    flagPrimary: "#009C3B",
    flagSecondary: "#FEDD00",
    flagAccent: "#002776",
    flagWeights: [0.6, 0.3, 0.1],
    flagColors: ["#009C3B", "#FEDD00", "#002776"], // green, yellow, blue
    goalLang: "br",
  },
  ARGENTINA: {
    name: "Argentina",
    flagPrimary: "#75AADB",
    flagSecondary: "#EFEFEF",
    flagAccent: "#F6B40E",
    flagWeights: [0.45, 0.45, 0.1],
    flagColors: ["#75AADB", "#FFFFFF", "#F6B40E"], // sky blue, white, sun gold
    goalLang: "es-ar",
  },
  FRANCE: {
    name: "France",
    flagPrimary: "#0055A4",
    flagSecondary: "#EFEFEF",
    flagAccent: "#EF4135",
    flagWeights: [0.34, 0.33, 0.33],
    flagColors: ["#0055A4", "#FFFFFF", "#EF4135"], // blue, white, red
    goalLang: "fr",
  },
  GERMANY: {
    name: "Germany",
    flagPrimary: "#000000",
    flagSecondary: "#DD0000",
    flagAccent: "#FFCE00",
    flagWeights: [0.34, 0.33, 0.33],
    flagColors: ["#000000", "#DD0000", "#FFCE00"], // black, red, gold
    goalLang: "de",
  },
  SPAIN: {
    name: "Spain",
    flagPrimary: "#AA151B",
    flagSecondary: "#F1BF00",
    flagAccent: "#AD1519",
    flagWeights: [0.5, 0.4, 0.1],
    flagColors: ["#AA151B", "#F1BF00"], // red, yellow
    goalLang: "es",
  },
  ITALY: {
    name: "Italy",
    flagPrimary: "#008C45",
    flagSecondary: "#EFEFEF",
    flagAccent: "#CD212A",
    flagWeights: [0.34, 0.33, 0.33],
    flagColors: ["#008C45", "#FFFFFF", "#CD212A"], // green, white, red
    goalLang: "it",
  },
  NETHERLANDS: {
    name: "Netherlands",
    flagPrimary: "#AE1C28",
    flagSecondary: "#EFEFEF",
    flagAccent: "#21468B",
    flagWeights: [0.34, 0.33, 0.33],
    flagColors: ["#AE1C28", "#FFFFFF", "#21468B"], // red, white, blue
    goalLang: "nl",
  },
  ENGLAND: {
    name: "England",
    flagPrimary: "#CE1124",
    flagSecondary: "#EFEFEF",
    flagAccent: "#012169",
    flagWeights: [0.3, 0.65, 0.05],
    flagColors: ["#FFFFFF", "#CE1124"], // white field, red cross
    goalLang: "en",
  },
  PORTUGAL: {
    name: "Portugal",
    flagPrimary: "#046A38",
    flagSecondary: "#DA291C",
    flagAccent: "#FFE600",
    flagWeights: [0.4, 0.55, 0.05],
    flagColors: ["#046A38", "#DA291C", "#FFE600"], // green, red, gold
    goalLang: "pt",
  },
  CROATIA: {
    name: "Croatia",
    flagPrimary: "#FF0000",
    flagSecondary: "#EFEFEF",
    flagAccent: "#171796",
    flagWeights: [0.4, 0.45, 0.15],
    flagColors: ["#FF0000", "#FFFFFF", "#171796"], // red, white, blue
    goalLang: "hr",
  },
  JAPAN: {
    name: "Japan",
    flagPrimary: "#EFEFEF",
    flagSecondary: "#BC002D",
    flagAccent: "#BC002D",
    flagWeights: [0.78, 0.22, 0.0],
    flagColors: ["#FFFFFF", "#BC002D"], // white field, red disc
    goalLang: "jp",
  },
  IRAN: {
    name: "Iran",
    flagPrimary: "#239F40", // green stripe
    flagSecondary: "#EFEFEF", // white stripe
    flagAccent: "#DA0000", // red stripe
    flagWeights: [0.34, 0.33, 0.33],
    flagColors: ["#239F40", "#FFFFFF", "#DA0000"], // green, white, red
    goalLang: "fa",
  },
  WALES: {
    name: "Wales",
    flagPrimary: "#D30731",
    flagSecondary: "#EFEFEF",
    flagAccent: "#00AB39",
    flagWeights: [0.55, 0.35, 0.1],
    flagColors: ["#FFFFFF", "#00AB39", "#D30731"], // white, green, red dragon
    goalLang: "en",
  },
  BARCELONA: {
    name: "Barcelona",
    flagPrimary: "#004D98", // Blaugrana blue
    flagSecondary: "#A50044", // Blaugrana garnet
    flagAccent: "#FFED02", // crest yellow
    flagWeights: [0.48, 0.44, 0.08],
    flagColors: ["#004D98", "#A50044", "#FFED02"], // blue, garnet, gold
    goalLang: "es",
  },
  REAL_MADRID: {
    name: "Real Madrid",
    flagPrimary: "#EFEFEF", // white kit base
    flagSecondary: "#00529F", // royal blue trim
    flagAccent: "#FEBE10", // crest gold
    flagWeights: [0.7, 0.22, 0.08],
    flagColors: ["#FFFFFF", "#00529F", "#FEBE10"], // white, blue, gold
    goalLang: "es",
  },
  SAUDI_ARABIA: {
    name: "Saudi Arabia",
    flagPrimary: "#006C35", // flag green
    flagSecondary: "#EFEFEF",
    flagAccent: "#0B4D2C",
    flagWeights: [0.7, 0.25, 0.05],
    flagColors: ["#006C35", "#FFFFFF"], // green field, white emblem
    goalLang: "ar-sa", // dedicated Saudi commentator clip
  },
  MOROCCO: {
    name: "Morocco",
    flagPrimary: "#C1272D", // flag red
    flagSecondary: "#006233", // green star
    flagAccent: "#EFEFEF",
    flagWeights: [0.78, 0.18, 0.04],
    flagColors: ["#C1272D", "#006233"], // red field, green star
    goalLang: "ar-ma", // dedicated Moroccan ecstatic clip
  },
  SOUTH_KOREA: {
    name: "South Korea",
    flagPrimary: "#EFEFEF",
    flagSecondary: "#CD2E3A", // taegeuk red
    flagAccent: "#0047A0", // taegeuk blue
    flagWeights: [0.55, 0.25, 0.2],
    flagColors: ["#FFFFFF", "#CD2E3A", "#0047A0", "#000000"], // white, red, blue, black
    goalLang: "ko",
  },
  TURKEY: {
    name: "Türkiye",
    flagPrimary: "#E30A17", // flag red
    flagSecondary: "#EFEFEF",
    flagAccent: "#B7080F",
    flagWeights: [0.82, 0.16, 0.02],
    flagColors: ["#E30A17", "#FFFFFF"], // red field, white star & crescent
    goalLang: "tr",
  },
  POLAND: {
    name: "Poland",
    flagPrimary: "#DC143C", // flag red half
    flagSecondary: "#EFEFEF", // flag white half
    flagAccent: "#9B1B30",
    flagWeights: [0.49, 0.49, 0.02],
    flagColors: ["#FFFFFF", "#DC143C"], // white, red
    goalLang: "pl",
  },
  UZBEKISTAN: {
    name: "Uzbekistan",
    flagPrimary: "#1EB53A", // green stripe
    flagSecondary: "#0099B5", // blue stripe
    flagAccent: "#CE1126", // red stripe
    flagWeights: [0.42, 0.42, 0.16],
    flagColors: ["#0099B5", "#FFFFFF", "#1EB53A", "#CE1126"], // blue, white, green, red
    goalLang: "uz",
  },
  TUNISIA: {
    name: "Tunisia",
    flagPrimary: "#E70013", // flag red
    flagSecondary: "#EFEFEF", // white disc
    flagAccent: "#A40C16",
    flagWeights: [0.78, 0.2, 0.02],
    flagColors: ["#E70013", "#FFFFFF"], // red field, white disc
    goalLang: "ar", // shared Algerian-style track (goal-ar.mp3)
  },
  // ── Per-country Arabic commentary tracks ─────────────────────
  // Each of these countries has its OWN authentic commentator clip
  // in public/audio/goal-ar-{cc}.mp3 (cc = country code). Used
  // instead of the generic Arabic track so each broadcast voice
  // matches the team.
  QATAR: {
    name: "Qatar",
    flagPrimary: "#8A1538", // maroon
    flagSecondary: "#EFEFEF",
    flagAccent: "#5B0E25",
    flagWeights: [0.85, 0.13, 0.02],
    goalLang: "ar-qa",
  },
  JORDAN: {
    name: "Jordan",
    flagPrimary: "#000000", // black band
    flagSecondary: "#EFEFEF", // white band
    flagAccent: "#007A3D", // green band
    flagWeights: [0.34, 0.34, 0.32],
    goalLang: "ar-jo",
  },
  IRAQ: {
    name: "Iraq",
    flagPrimary: "#CE1126", // red band
    flagSecondary: "#EFEFEF", // white band
    flagAccent: "#007A3D", // green band
    flagWeights: [0.34, 0.34, 0.32],
    goalLang: "ar-iq",
  },
  EGYPT: {
    name: "Egypt",
    flagPrimary: "#CE1126", // red band
    flagSecondary: "#EFEFEF", // white band
    flagAccent: "#000000", // black band
    flagWeights: [0.34, 0.34, 0.32],
    goalLang: "ar-eg",
  },
  SWITZERLAND: {
    name: "Switzerland",
    flagPrimary: "#FF0000", // flag red
    flagSecondary: "#EFEFEF", // white cross
    flagAccent: "#C30000",
    flagWeights: [0.82, 0.16, 0.02],
    goalLang: "de-ch",
  },
  // 2026 World Cup hosts.
  USA: {
    name: "USA",
    flagPrimary: "#0A3161", // old glory blue
    flagSecondary: "#EFEFEF", // white
    flagAccent: "#B31942", // old glory red
    flagWeights: [0.4, 0.3, 0.3],
    flagColors: ["#0A3161", "#FFFFFF", "#B31942"],
    goalLang: "en",
  },
  CANADA: {
    name: "Canada",
    flagPrimary: "#D80621", // flag red
    flagSecondary: "#EFEFEF", // white centre band
    flagAccent: "#A50517",
    flagWeights: [0.6, 0.38, 0.02],
    flagColors: ["#D80621", "#FFFFFF", "#D80621"],
    goalLang: "en",
  },
  MEXICO: {
    name: "Mexico",
    flagPrimary: "#006847", // green
    flagSecondary: "#EFEFEF", // white
    flagAccent: "#CE1126", // red
    flagWeights: [0.4, 0.3, 0.3],
    flagColors: ["#006847", "#FFFFFF", "#CE1126"],
    goalLang: "es",
  },
};

// Helper: build a per-team recipe from a type, boundary, and a small
// settings override. Each goal gets a auto-position slot.
const AUTO_POSITIONS: Array<[number, number]> = [
  [50, 50],
  [25, 30],
  [75, 30],
  [25, 70],
  [75, 70],
];

// Per-rank personality profile. Each rank in a game selects a
// fundamentally different visual class — type, boundary, and the
// settings cluster all swing together so consecutive goals never
// read as variants of each other. Five distinct personalities cover
// the max-five-goals AUTO_POSITIONS slot table.
export type GoalPersonality = {
  type: CellGridType;
  boundary: LabBoundaryShape;
  size: number;
  settings: Partial<CellGridSettings>;
  // Render-time toggle propagated to the goal recipe. Personalities
  // can opt in to specific visual effects without those effects
  // leaking into every other goal in the gallery.
  drift?: boolean;
};

// Every personality is bounded by a circle so the goal eruption
// always reads as a disc — the differentiator is the internal shape
// system, not the silhouette. Densities are tuned so the disc looks
// filled, not scattered.
export const GOAL_PERSONALITIES: GoalPersonality[] = [
  // 1 — SOFT SQUISH. Dense organic-blob field pushed outward, with
  // very high edgeOrganicness for soft jellied edges. Authored recipe.
  {
    type: "squishy_blobs", boundary: "circle", size: 65,
    settings: {
      colorRandomness: 71, dominantColor: 30, colorClustering: 30,
      colorContrast: 56, distortionStrength: 100, outwardForce: 32,
      pinchIntensity: 0, edgeOrganicness: 94, curvature: 49,
      asymmetry: 0, shapeDensity: 50, shapeScale: 1.5,
      rotation: 65, margin: 107,
    },
  },
  // 2 — PIXEL GRID. Crisp Cartesian pixels filling a circular clip.
  {
    type: "blocks", boundary: "circle", size: 70,
    settings: {
      shapeDensity: 26, shapeScale: 0.85, distortionStrength: 6,
      outwardForce: 0, pinchIntensity: 0, curvature: 0,
      asymmetry: 0, rotation: 0, margin: 6, edgeOrganicness: 0,
      colorRandomness: 80,
    },
  },
  // 3 — POLAR CHECKER. Many wedges × rings, light swirl.
  {
    type: "radial_checker", boundary: "circle", size: 68,
    settings: {
      shapeDensity: 48, shapeScale: 1.0, distortionStrength: 18,
      outwardForce: 12, pinchIntensity: 4, curvature: 36,
      asymmetry: 6, rotation: 24, margin: 8, edgeOrganicness: 0,
      colorRandomness: 18,
    },
  },
  // 5 — BURST SPOKES. Radial spokes erupting from the focal centre.
  {
    type: "radial_burst", boundary: "circle", size: 72,
    settings: {
      shapeDensity: 42, shapeScale: 1.0, distortionStrength: 75,
      outwardForce: 65, pinchIntensity: 0, curvature: 45,
      asymmetry: 55, rotation: 200, margin: 4, edgeOrganicness: 15,
      colorRandomness: 55,
    },
  },
  // 6 — TOPO MAP. Dense contour bands inside a circular crop.
  {
    type: "pixel_topography", boundary: "circle", size: 72,
    settings: {
      shapeDensity: 46, shapeScale: 0.9, distortionStrength: 0,
      outwardForce: 0, pinchIntensity: 0, curvature: 90,
      asymmetry: 60, rotation: 0, margin: 4, edgeOrganicness: 0,
      colorRandomness: 15, colorClustering: 70,
    },
  },
  // 7 — INK SWIRL. Archimedean spiral filling the whole disc —
  // denser steps, wider radial reach, symmetric so the swirl reads
  // as a complete spiral rather than a fragment.
  {
    type: "ink_spiral", boundary: "circle", size: 72,
    settings: {
      shapeDensity: 64, shapeScale: 1.3, distortionStrength: 18,
      outwardForce: 6, pinchIntensity: 6, curvature: 45,
      asymmetry: 0, rotation: 5, margin: 2, edgeOrganicness: 0,
      colorRandomness: 30,
    },
  },
  // 8 — PARTICLE CLOUD. Many particles pushed outward to fill the disc.
  {
    type: "particle_burst", boundary: "circle", size: 70,
    settings: {
      shapeDensity: 40, shapeScale: 0.8, distortionStrength: 35,
      outwardForce: 30, pinchIntensity: 0, curvature: 20,
      asymmetry: 25, rotation: 0, margin: 4, edgeOrganicness: 10,
      colorRandomness: 65,
    },
  },
  // 9 — WEDGE FAN. More pie slices for a full disc read.
  {
    type: "wedges", boundary: "circle", size: 68,
    settings: {
      shapeDensity: 26, shapeScale: 1.05, distortionStrength: 12,
      outwardForce: 0, pinchIntensity: 0, curvature: 8,
      asymmetry: 0, rotation: 0, margin: 6, edgeOrganicness: 0,
      colorRandomness: 25,
    },
  },
  // 10 — WAVE BANDS. Tighter band stack filling the circle.
  {
    type: "warped_bands", boundary: "circle", size: 70,
    settings: {
      shapeDensity: 22, shapeScale: 1.05, distortionStrength: 55,
      outwardForce: 20, pinchIntensity: 0, curvature: 100,
      asymmetry: 35, rotation: 90, margin: 8, edgeOrganicness: 5,
      colorRandomness: 35,
    },
  },
  // 11 — OPTICAL DIAL. More rings + denser per-ring wedge counts.
  {
    type: "optical_dial", boundary: "circle", size: 68,
    settings: {
      shapeDensity: 40, shapeScale: 1.0, distortionStrength: 20,
      outwardForce: 5, pinchIntensity: 8, curvature: 24,
      asymmetry: 4, rotation: 12, margin: 6, edgeOrganicness: 0,
      colorRandomness: 12,
    },
  },
  // 12 — SHOCKWAVE. Concentric pulse filling the entire disc —
  // denser rings, wider reach, full radial symmetry so the wave
  // reads as a complete, holistic shape rather than a lopsided arc.
  {
    type: "kinetic_shockwave", boundary: "circle", size: 72,
    settings: {
      shapeDensity: 60, shapeScale: 1.25, distortionStrength: 55,
      outwardForce: 35, pinchIntensity: 0, curvature: 55,
      asymmetry: 0, rotation: 0, margin: 2, edgeOrganicness: 5,
      colorRandomness: 45,
    },
  },
  // 13 — FRAG RAYS. Lightning shards filling the whole disc — fully
  // symmetric (asymmetry 0) so the rays fan in every direction, not
  // bunched on one side.
  {
    type: "fragmented_ray", boundary: "circle", size: 72,
    settings: {
      shapeDensity: 62, shapeScale: 1.15, distortionStrength: 65,
      outwardForce: 35, pinchIntensity: 0, curvature: 40,
      asymmetry: 0, rotation: 165, margin: 2, edgeOrganicness: 18,
      colorRandomness: 50,
    },
  },
  // 14 — MANDALA. Multi-layer moiré-beat radial composition, dense.
  {
    type: "interference_mandala", boundary: "circle", size: 70,
    settings: {
      shapeDensity: 48, shapeScale: 1.0, distortionStrength: 22,
      outwardForce: 8, pinchIntensity: 5, curvature: 30,
      asymmetry: 6, rotation: 8, margin: 6, edgeOrganicness: 0,
      colorRandomness: 18,
    },
  },
  // 15 — TRIANGLE TESSELLATION. Stained-glass grid of right
  // triangles filling the whole disc — denser tessellation, fully
  // symmetric so the field reads holistically.
  {
    type: "triangle_grid", boundary: "circle", size: 72,
    settings: {
      shapeDensity: 44, shapeScale: 1.05, distortionStrength: 14,
      outwardForce: 6, pinchIntensity: 0, curvature: 16,
      asymmetry: 0, rotation: 0, margin: 2, edgeOrganicness: 0,
      colorRandomness: 35,
    },
  },
  // 19 — TOPOGRAPHIC LINES. Concentric thin contour rings with sine
  // wobble — an elevation-map / topographic disc.
  {
    type: "topographic_lines", boundary: "circle", size: 72,
    settings: {
      shapeDensity: 26, shapeScale: 1.0, distortionStrength: 18,
      outwardForce: 6, pinchIntensity: 0, curvature: 90,
      asymmetry: 25, rotation: 0, margin: 4, edgeOrganicness: 0,
      colorRandomness: 30,
    },
  },
  // 20 — ZIGZAG SPIRAL. Ceremonial / folk-printed spiral: sawtooth
  // bands curving inward + vesica-leaf ornaments around the rim.
  {
    type: "zigzag_spiral", boundary: "circle", size: 72,
    settings: {
      shapeDensity: 36, shapeScale: 1.0, distortionStrength: 22,
      outwardForce: 8, pinchIntensity: 0, curvature: 24,
      asymmetry: 8, rotation: 0, margin: 4, edgeOrganicness: 0,
      colorRandomness: 18,
    },
  },
  // 21 — SPIRAL FLOWER. Phyllotaxis-style flower with petals laid
  // out on a golden-angle spiral, growing toward the rim.
  {
    type: "spiral_flower", boundary: "circle", size: 72,
    settings: {
      shapeDensity: 30, shapeScale: 1.05, distortionStrength: 18,
      outwardForce: 8, pinchIntensity: 0, curvature: 18,
      asymmetry: 6, rotation: 0, margin: 4, edgeOrganicness: 0,
      colorRandomness: 30,
    },
  },
  // 23 — VORTEX RINGS. Concentric rings shifting diagonally toward
  // a vortex point, each ring using a different graphic treatment
  // (dots / stripes / arcs / checker / outline / blocks).
  {
    type: "vortex_rings", boundary: "circle", size: 72,
    settings: {
      shapeDensity: 32, shapeScale: 1.0, distortionStrength: 22,
      outwardForce: 10, pinchIntensity: 0, curvature: 22,
      asymmetry: 6, rotation: 0, margin: 4, edgeOrganicness: 0,
      colorRandomness: 35,
    },
  },
  // 25 — HALFTONE BLOB. Halftone dot grid with dot sizes driven by
  // a smooth density field — airbrushed cloud volumes through dots.
  {
    type: "halftone_blob", boundary: "circle", size: 72,
    settings: {
      shapeDensity: 38, shapeScale: 1.0, distortionStrength: 0,
      outwardForce: 0, pinchIntensity: 0, curvature: 0,
      asymmetry: 0, rotation: 0, margin: 4, edgeOrganicness: 0,
      colorRandomness: 25,
    },
  },
  // 27 — CHROMATIC DITHER. Dense pixel grid driven by a diagonal
  // sine flow field with CMYK-style channel offsets per cell.
  {
    type: "chromatic_dither", boundary: "circle", size: 72,
    settings: {
      shapeDensity: 32, shapeScale: 1.0, distortionStrength: 0,
      outwardForce: 0, pinchIntensity: 0, curvature: 0,
      asymmetry: 0, rotation: 0, margin: 4, edgeOrganicness: 0,
      colorRandomness: 40,
    },
  },
  // 29 — HALF-TRIANGLE SQUARE. Cartesian grid where each cell
  // splits into two right-triangles (NW+SE) at varied rotations,
  // bounded by a square silhouette. Reads as a tessellated banner
  // built from triangular pixels.
  {
    type: "triangle_grid", boundary: "square", size: 76,
    settings: {
      shapeDensity: 22, shapeScale: 1.0, distortionStrength: 14,
      outwardForce: 6, pinchIntensity: 0, curvature: 0,
      asymmetry: 8, rotation: 28, margin: 2, edgeOrganicness: 0,
      colorRandomness: 65,
    },
  },
  // 32 — CONCENTRIC SPOKES. Three concentric rings of radial tapered
  // wedges around a tiny central dot — op-art dial / instrument face.
  {
    type: "concentric_spokes", boundary: "circle", size: 76,
    settings: {
      shapeDensity: 30, shapeScale: 1.0, distortionStrength: 0,
      outwardForce: 0, pinchIntensity: 0, curvature: 0,
      asymmetry: 0, rotation: 0, margin: 4, edgeOrganicness: 0,
      colorRandomness: 25,
    },
  },
];

// Per-goal boundary overrides — applied AFTER personality
// assignment, so the cells still come from the personality but get
// silhouetted into a specific formal shape (circle / triangle /
// hexagon / etc.) instead of the personality's default boundary.
// Used by the MatchFocus single-card surface to demo formal shapes.
const GOAL_BOUNDARY_OVERRIDES: Record<string, LabBoundaryShape> = {
  // 2018 WC Final — formal silhouettes paired by emotional weight so
  // higher-importance goals get richer, more "filled" shapes.
  "wc18-2": "circle", // Perišić equalizer — biggest moment for Croatia
  "wc18-3": "hexagon", // Griezmann penalty — France retakes lead
  "wc18-5": "circle", // Mbappé — iconic teen finish (big disc)
  "wc18-6": "triangle", // Mandžukić — late chase from 1-4, drifting triangle
};

// Per-goal post-reveal drift toggle — the boundary clip + cells
// continue to translate/rotate after the fade-in completes. Used on
// the triangle-bounded goal in the focused game.
const GOAL_DRIFT_OVERRIDES: Record<string, boolean> = {
  "wc18-6": true,
};

// Per-game emotional-logic context. Fed into the rules engine so
// each goal gets its own importance score. Pick stage, team
// strengths (FIFA-ranking style 0..100), and historical rivalry
// per fixture. Default below is used if the game id isn't listed.
export const DEFAULT_MATCH_CONTEXT: MatchContext = {
  stage: "group",
  homeStrength: 70,
  awayStrength: 70,
  rivalry: 30,
};

export const MATCH_CONTEXTS: Record<string, MatchContext> = {
  "wc18-final-fr-cr": {
    stage: "final",
    homeStrength: 88, // France — heavy favorite, eventual champion
    awayStrength: 72, // Croatia — overachieving underdog finalist
    rivalry: 35,
  },
  // Qatar 2022 lineup
  "ar-fr-final": {
    stage: "final",
    homeStrength: 86, // Argentina
    awayStrength: 86, // France — defending champs
    rivalry: 45,
  },
  "ksa-ar": {
    stage: "group",
    homeStrength: 55, // Saudi Arabia
    awayStrength: 86, // Argentina — pre-tournament favorites
    rivalry: 30,
  },
  "jp-de": {
    stage: "group",
    homeStrength: 80, // Germany
    awayStrength: 65, // Japan
    rivalry: 20,
  },
  "ma-pt": {
    stage: "knockout",
    homeStrength: 64, // Morocco — semifinal-bound underdog
    awayStrength: 82, // Portugal
    rivalry: 25,
  },
  "br-kr": {
    stage: "knockout",
    homeStrength: 86, // Brazil
    awayStrength: 62, // South Korea
    rivalry: 20,
  },
  "tn-fr": {
    stage: "group",
    homeStrength: 58, // Tunisia
    awayStrength: 86, // France
    rivalry: 25,
  },
  "ir-wal": {
    stage: "group",
    homeStrength: 60, // Iran
    awayStrength: 64, // Wales
    rivalry: 30,
  },
  "jp-es": {
    stage: "group",
    homeStrength: 65, // Japan
    awayStrength: 84, // Spain
    rivalry: 25,
  },
  "br-ge-2014-sf": {
    stage: "knockout",
    homeStrength: 84, // Brazil — host nation
    awayStrength: 90, // Germany — eventual champions
    rivalry: 45,
  },
  "pt-es-2018-gs": {
    stage: "group",
    homeStrength: 82, // Portugal — reigning Euro champs
    awayStrength: 86, // Spain
    rivalry: 55, // Iberian derby
  },
  "nl-ar-2022-qf": {
    stage: "knockout",
    homeStrength: 80, // Netherlands
    awayStrength: 86, // Argentina — eventual champions
    rivalry: 55, // famously bad-tempered
  },
  "nl-ar-2014-sf": {
    stage: "knockout",
    homeStrength: 82, // Netherlands
    awayStrength: 84, // Argentina — finalists
    rivalry: 35,
  },
  // World Cup 2026 — predicted fixtures.
  "mx-ar-2026": {
    stage: "group",
    homeStrength: 70, // Mexico — host
    awayStrength: 88, // Argentina — holders
    rivalry: 40,
  },
  "us-en-2026": {
    stage: "group",
    homeStrength: 68, // USA — host
    awayStrength: 84, // England
    rivalry: 35,
  },
  "ca-fr-2026": {
    stage: "group",
    homeStrength: 64, // Canada — host
    awayStrength: 88, // France
    rivalry: 25,
  },
  "br-es-2026": {
    stage: "group",
    homeStrength: 87, // Brazil
    awayStrength: 86, // Spain
    rivalry: 45,
  },
  "pt-ge-2026": {
    stage: "knockout",
    homeStrength: 84, // Portugal
    awayStrength: 85, // Germany
    rivalry: 40,
  },
  "ar-br-2026-final": {
    stage: "final",
    homeStrength: 90, // Argentina
    awayStrength: 89, // Brazil
    rivalry: 60, // superclásico
  },
};

// Per-goal preset override — drops a curated ANIMATION_SET recipe
// straight into the goal slot, taking precedence over the personality
// shuffle. The boundary + drift overrides still layer on top, so the
// preset's cell field can be re-bounded to a formal silhouette.
const GOAL_PRESET_OVERRIDES: Record<string, string> = {
  // 2018 WC Final — pair each curated preset with the goal whose
  // emotional shape it suits:
  //   - own goal opener → "squishy-blob-01" (inward, quieter)
  //   - equalizer → "interference-mandala-01" (high drama, moiré)
  //   - go-ahead penalty → "squishy-blob-02" (outward bloom)
  //   - iconic Mbappé → "plotter-lines-01" (kinetic cyclone)
  "wc18-1": "squishy-blob-01",
  "wc18-2": "interference-mandala-01",
  "wc18-3": "squishy-blob-02",
  "wc18-5": "plotter-lines-01",
};

// Manual personality overrides keyed by goal id. When a goal id
// appears here, its index into GOAL_PERSONALITIES is forced and the
// per-game shuffle pick is ignored. Used to guarantee that the new
// shape types surface somewhere on the gallery instead of being lost
// in the shuffle.
const GOAL_PERSONALITY_OVERRIDES: Record<string, number> = {
  // Paik Seung-Ho (Brazil 4-1 South Korea, 76') → SOFT SQUISH.
  "brkr-5": 0,
  // Mix the surviving personalities across the gallery so every
  // remaining type appears at least once.
  "arfr-1": 18, // Messi 23' → HALFTONE BLOB
  "arfr-2": 13, // Di María 36' → TRIANGLE TESSELLATION
  "arfr-3": 17, // Mbappé 80' → VORTEX RINGS
  "arfr-4": 15, // Mbappé 81' → ZIGZAG SPIRAL
  "ksa-1": 14, // Messi 10' → TOPOGRAPHIC LINES
  "ksa-2": 16, // Al-Shehri 48' → SPIRAL FLOWER
  "ksa-3": 19, // Al-Dawsari 53' → CHROMATIC DITHER
  "jpde-1": 14, // Gündoğan 33' → TOPOGRAPHIC LINES
  "jpde-2": 21, // Doan 75' → CONCENTRIC SPOKES
  "mapt-1": 12, // En-Nesyri 42' → MANDALA
  "brkr-2": 17, // Neymar 13' → VORTEX RINGS
  // brkr-3 (Richarlison 29') previously pinned to PINWHEEL TILT;
  // that personality has been removed — falling back to shuffle.
  "brkr-4": 16, // Paquetá 36' → SPIRAL FLOWER
  "jp-3": 14, // Tanaka 51' → TOPOGRAPHIC LINES
  "ir-2": 15, // Rezaeian 71' → ZIGZAG SPIRAL
  // 2018 WC Final pinned per goal. wc18-1/2/3/5 are preset overrides;
  // wc18-4 (Pogba) previously pinned to PINWHEEL TILT (removed) and
  // now falls back to the shuffle. wc18-6 (Mandžukić) keeps the
  // CONCENTRIC SPOKES pin with its triangle boundary + drift.
  "wc18-6": 21, // Mandžukić 69' → CONCENTRIC SPOKES (triangle + drift)
};

// Deterministic string → 31-bit seed (djb2). Same input always
// produces the same seed; different inputs almost always differ.
const stringSeed = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) & 0x7fffffff;
  }
  return h;
};

// Fisher–Yates shuffle driven by a seeded LCG. Stable across reloads
// for the same seed, so the gallery doesn't reshuffle on every render.
const shuffleByGameSeed = <T,>(arr: T[], seed: number): T[] => {
  const out = arr.slice();
  let h = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1664525 + 1013904223) & 0x7fffffff;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
};

// Rewrite each goal's recipe to a personality drawn from a per-game
// shuffled permutation of GOAL_PERSONALITIES. Goals are assigned in
// chronological order so the timeline reads as a deliberate
// progression instead of a random walk; the per-game shuffle means
// no two fixtures share the same goal-to-goal rhythm.
const assignGoalPersonalities = (
  goals: StaticPreviewGoal[],
  gameId: string,
) => {
  const seed = stringSeed(gameId);
  const order = shuffleByGameSeed(GOAL_PERSONALITIES, seed);
  const sorted = [...goals].sort((a, b) => a.minute - b.minute);
  sorted.forEach((goal, idx) => {
    const overrideIdx = GOAL_PERSONALITY_OVERRIDES[goal.id];
    const personality =
      overrideIdx !== undefined
        ? GOAL_PERSONALITIES[overrideIdx % GOAL_PERSONALITIES.length]!
        : order[idx % order.length]!;
    const boundaryOverride = GOAL_BOUNDARY_OVERRIDES[goal.id];
    const driftOverride = GOAL_DRIFT_OVERRIDES[goal.id];
    // Preset override — if this goal id has a curated ANIMATION_SET
    // entry pinned, use the preset's full recipe and let boundary +
    // drift overrides layer on top.
    const presetId = GOAL_PRESET_OVERRIDES[goal.id];
    const preset = presetId ? getPreset(presetId) : undefined;
    if (preset) {
      goal.recipe = {
        type: preset.recipe.type,
        boundary: boundaryOverride ?? preset.recipe.boundary,
        drift: driftOverride ?? personality.drift,
        posX: goal.recipe.posX,
        posY: goal.recipe.posY,
        size: preset.recipe.size,
        moireStrength: preset.recipe.moireStrength,
        blendAmount: preset.recipe.blendAmount,
        blendTarget: preset.recipe.blendTarget,
        recursionDepth: preset.recipe.recursionDepth,
        settings: { ...preset.recipe.settings },
      };
      return;
    }
    goal.recipe = {
      type: personality.type,
      boundary: boundaryOverride ?? personality.boundary,
      drift: driftOverride ?? personality.drift,
      // Preserve the chronological position assigned upstream.
      posX: goal.recipe.posX,
      posY: goal.recipe.posY,
      size: personality.size,
      // Layered effects intentionally off — each personality's
      // signature reads cleanest as a single shape system.
      moireStrength: 0,
      blendAmount: 0,
      blendTarget: "wedges",
      recursionDepth: 0,
      settings: {
        ...DEFAULT_SETTINGS,
        ...personality.settings,
        // Seed varies by chronological order + per-game offset, so
        // even two games hitting the same personality at the same
        // rank don't render identical patterns.
        seed: 11 + idx * 47 + (seed % 1000),
      },
    };
  });
};

export const makeGoal = (
  id: string,
  team: "home" | "away",
  minute: number,
  scorer: string,
  // Type and boundary args are kept for callsite back-compat but
  // ignored — the rank-driven personality profile owns the visual
  // identity now. Pass anything; it doesn't affect the output.
  _type: CellGridType,
  _boundary: LabBoundaryShape,
  rank: number,
  overrides: Partial<CellGridSettings> = {},
): StaticPreviewGoal => {
  const [px, py] = AUTO_POSITIONS[rank % AUTO_POSITIONS.length]!;
  const personality = GOAL_PERSONALITIES[rank % GOAL_PERSONALITIES.length]!;
  return {
    id,
    team,
    minute,
    scorer,
    recipe: {
      type: personality.type,
      boundary: personality.boundary,
      posX: px,
      posY: py,
      size: personality.size,
      // Layered effects (moiré / blend / recursion) intentionally
      // off here — the per-rank type swing is already doing the
      // heavy lifting; stacking layers on top blurs each
      // personality's signature.
      moireStrength: 0,
      blendAmount: 0,
      blendTarget: "wedges",
      recursionDepth: 0,
      settings: {
        ...DEFAULT_SETTINGS,
        ...personality.settings,
        // Seed still varies per rank so a 6th-goal scenario (rank 5,
        // recycling personality 0) doesn't render identically to the
        // first goal.
        seed: 11 + rank * 47,
        ...overrides,
      },
    },
  };
};

export type Game = {
  id: string;
  competition: string;
  venueAndDate: string;
  home: StaticPreviewTeam;
  away: StaticPreviewTeam;
  goals: StaticPreviewGoal[];
  // Final home-possession share at full time (0..1).
  finalHomePossession: number;
  // Sub-goal match events (shots, fouls, cards, corners, free kicks,
  // penalties) plotted on the timeline.
  events?: MatchEvent[];
};

// Quick helper for sample events so the GAMES list stays readable.
export const ev = (
  id: string,
  team: "home" | "away",
  minute: number,
  type: MatchEvent["type"],
): MatchEvent => ({ id, team, minute, type });

// Five fixtures — each pairs a different home/away national team set
// with a distinctive home-pattern + away-pattern combination so the
// gallery reads as a span of the system's visual range.
// Per-game y-slot patterns. Each game picks one pattern so the
// vertical rhythm of goals differs between fixtures — even if two
// games have the same number of goals, the y placements zig-zag
// differently. posX still maps to match minute.
const Y_SLOT_PATTERNS: number[][] = [
  [35, 70, 22, 58, 80],
  [62, 28, 75, 42, 18],
  [30, 65, 48, 80, 25],
  [70, 30, 58, 20, 78],
  [50, 22, 78, 38, 62],
];
const assignChronologicalPositions = (
  goals: StaticPreviewGoal[],
  gameIndex = 0,
) => {
  const pattern =
    Y_SLOT_PATTERNS[gameIndex % Y_SLOT_PATTERNS.length] ?? Y_SLOT_PATTERNS[0]!;
  const startX = 8;
  const endX = 92;
  const homeGoals = [...goals]
    .filter((g) => g.team === "home")
    .sort((a, b) => a.minute - b.minute);
  const awayGoals = [...goals]
    .filter((g) => g.team === "away")
    .sort((a, b) => a.minute - b.minute);
  for (const g of goals) {
    const t = Math.max(0, Math.min(1, g.minute / 90));
    g.recipe.posX = startX + t * (endX - startX);
    const teamList = g.team === "home" ? homeGoals : awayGoals;
    const rank = teamList.indexOf(g);
    // Offset the away team's slot index so the two teams don't land
    // on identical rows within the same game.
    const slotIdx = g.team === "home" ? rank : rank + 2;
    g.recipe.posY = pattern[slotIdx % pattern.length] ?? 50;
  }
  return goals;
};

// Every goal in a game uses a DIFFERENT geometric logic + boundary
// so each card reads as a tour of the system — no two patterns
// repeat within a single fixture.
export const GAMES: Game[] = [
  // ── Qatar 2022 — Final ────────────────────────────────────────
  // Argentina 3-3 France (Argentina won 4-2 on penalties), Lusail
  // Stadium, 18 December 2022. Regulation-only goals shown (no extra
  // time): Messi 23' (pen) + Di Maria 36'; Mbappé 80' (pen) + 81'.
  {
    id: "ar-fr-final",
    competition: "WORLD CUP 2022 · FINAL",
    venueAndDate: "Lusail | december 18",
    home: TEAMS.ARGENTINA!,
    away: TEAMS.FRANCE!,
    finalHomePossession: 0.46, // France pushed late; near-even regulation
    goals: [
      makeGoal("arfr-1", "home", 23, "MESSI", "radial_burst", "circle", 0),
      makeGoal("arfr-2", "home", 36, "DI MARÍA", "kinetic_shockwave", "oval", 1),
      makeGoal("arfr-3", "away", 80, "MBAPPÉ", "particle_burst", "organic_blob", 0),
      makeGoal("arfr-4", "away", 81, "MBAPPÉ", "wedges", "arch", 1),
    ],
    events: [
      ev("arfr-s1", "home", 8, "shot"),
      ev("arfr-s2", "away", 17, "shot"),
      ev("arfr-c1", "home", 21, "corner"),
      ev("arfr-yc1", "away", 28, "yellow_card"), // Upamecano
      ev("arfr-c2", "away", 33, "corner"),
      ev("arfr-yc2", "home", 45, "yellow_card"), // E. Fernández (dive)
      ev("arfr-s3", "away", 52, "shot"),
      ev("arfr-s4", "home", 58, "shot"),
      ev("arfr-yc3", "away", 64, "yellow_card"), // Tchouaméni
      ev("arfr-c3", "away", 70, "corner"),
      ev("arfr-yc4", "home", 73, "yellow_card"), // Paredes
      ev("arfr-s5", "away", 79, "shot"),
      ev("arfr-yc5", "away", 87, "yellow_card"), // Thuram (simulation)
      ev("arfr-s6", "home", 89, "shot"),
    ],
  },
  // ── Qatar 2022 — Group C, Match Day 1 ─────────────────────────
  // Argentina 1-2 Saudi Arabia, Lusail Stadium, 22 November 2022.
  // Biggest WC upset of the modern era: KSA scored twice in 5 mins.
  {
    id: "ksa-ar",
    competition: "WORLD CUP 2022 · GROUP C",
    venueAndDate: "Lusail | november 22",
    home: TEAMS.SAUDI_ARABIA!,
    away: TEAMS.ARGENTINA!,
    finalHomePossession: 0.32, // KSA defended; Argentina dominated possession
    goals: [
      makeGoal("ksa-1", "away", 10, "MESSI", "blocks", "rectangle", 0),
      makeGoal("ksa-2", "home", 48, "AL-SHEHRI", "fragmented_ray", "circle", 0),
      makeGoal("ksa-3", "home", 53, "AL-DAWSARI", "ink_spiral", "irregular_polygon", 1),
    ],
    events: [
      ev("ksa-s1", "away", 5, "shot"),
      ev("ksa-c1", "away", 17, "corner"),
      ev("ksa-s2", "away", 27, "shot"),
      ev("ksa-c2", "away", 35, "corner"),
      ev("ksa-s3", "home", 46, "shot"),
      ev("ksa-s4", "away", 62, "shot"),
      ev("ksa-c3", "away", 68, "corner"),
      ev("ksa-yc1", "home", 75, "yellow_card"), // Al Bulayhi
      ev("ksa-yc2", "home", 79, "yellow_card"), // Al Dawsari
      ev("ksa-yc3", "home", 82, "yellow_card"), // Abdulhamid
      ev("ksa-s5", "away", 84, "shot"),
      ev("ksa-yc4", "home", 87, "yellow_card"), // Al Abed
      ev("ksa-c4", "away", 89, "corner"),
      ev("ksa-yc5", "home", 90, "yellow_card"), // Al Owais
    ],
  },
  // ── Qatar 2022 — Group E, Match Day 1 ─────────────────────────
  // Germany 1-2 Japan, Khalifa International Stadium, 23 November
  // 2022. Japan came from behind with two late substitute goals.
  {
    id: "jp-de",
    competition: "WORLD CUP 2022 · GROUP E",
    venueAndDate: "Khalifa Intl. | november 23",
    home: TEAMS.GERMANY!,
    away: TEAMS.JAPAN!,
    finalHomePossession: 0.74, // Germany dominated; Japan won on the counter
    goals: [
      makeGoal("jpde-1", "home", 33, "GÜNDOĞAN", "wedges", "arch", 0),
      makeGoal("jpde-2", "away", 75, "DOAN", "radial_burst", "circle", 0),
      makeGoal("jpde-3", "away", 83, "ASANO", "kinetic_shockwave", "oval", 1),
    ],
    events: [
      ev("jpde-s1", "away", 7, "shot"), // Maeda goal ruled offside
      ev("jpde-s2", "home", 18, "shot"),
      ev("jpde-c1", "home", 24, "corner"),
      ev("jpde-s3", "home", 31, "shot"), // pre-penalty
      ev("jpde-s4", "home", 44, "shot"), // Havertz offside
      ev("jpde-c2", "home", 51, "corner"),
      ev("jpde-s5", "home", 60, "shot"), // Gündoğan hit the post
      ev("jpde-c3", "home", 68, "corner"),
      ev("jpde-s6", "away", 71, "shot"),
      ev("jpde-s7", "home", 78, "shot"),
      ev("jpde-c4", "away", 86, "corner"),
    ],
  },
  // ── Qatar 2022 — Quarterfinal ─────────────────────────────────
  // Morocco 1-0 Portugal, Al Thumama Stadium, 10 December 2022.
  // En-Nesyri's header. First African side ever in a WC semi-final.
  {
    id: "ma-pt",
    competition: "WORLD CUP 2022 · QUARTERFINAL",
    venueAndDate: "Al Thumama | december 10",
    home: TEAMS.MOROCCO!,
    away: TEAMS.PORTUGAL!,
    finalHomePossession: 0.27, // Portugal pressed; Morocco defended deep
    goals: [
      makeGoal("mapt-1", "home", 42, "EN-NESYRI", "radial_burst", "circle", 0),
    ],
    events: [
      ev("mapt-s1", "away", 9, "shot"),
      ev("mapt-c1", "away", 18, "corner"),
      ev("mapt-s2", "away", 25, "shot"),
      ev("mapt-c2", "away", 31, "corner"),
      ev("mapt-s3", "away", 38, "shot"),
      ev("mapt-s4", "away", 56, "shot"),
      ev("mapt-c3", "away", 61, "corner"),
      ev("mapt-yc1", "home", 70, "yellow_card"), // Achraf Dari
      ev("mapt-s5", "away", 74, "shot"),
      ev("mapt-c4", "away", 79, "corner"),
      ev("mapt-s6", "home", 83, "shot"),
      ev("mapt-rc1", "home", 90, "red_card"), // Cheddira late
      ev("mapt-s7", "away", 90, "shot"),
    ],
  },
  // ── Qatar 2022 — Round of 16 ──────────────────────────────────
  // Brazil 4-1 South Korea, Stadium 974, 5 December 2022. Brazil
  // led 3-0 inside 29 minutes — earliest 3-goal lead in their WC
  // history. Neymar's first goal since his ankle injury.
  {
    id: "br-kr",
    competition: "WORLD CUP 2022 · ROUND OF 16",
    venueAndDate: "Stadium 974 | december 5",
    home: TEAMS.BRAZIL!,
    away: TEAMS.SOUTH_KOREA!,
    finalHomePossession: 0.55,
    goals: [
      makeGoal("brkr-1", "home", 7, "VINÍCIUS JR.", "radial_burst", "circle", 0),
      makeGoal("brkr-2", "home", 13, "NEYMAR", "kinetic_shockwave", "oval", 1),
      makeGoal("brkr-3", "home", 29, "RICHARLISON", "particle_burst", "organic_blob", 2),
      makeGoal("brkr-4", "home", 36, "PAQUETÁ", "wedges", "arch", 3),
      makeGoal("brkr-5", "away", 76, "PAIK SEUNG-HO", "fragmented_ray", "irregular_polygon", 0),
    ],
    events: [
      ev("brkr-s1", "home", 4, "shot"),
      ev("brkr-c1", "home", 11, "corner"),
      ev("brkr-s2", "home", 23, "shot"),
      ev("brkr-s3", "away", 34, "shot"),
      ev("brkr-c2", "home", 41, "corner"),
      ev("brkr-s4", "away", 49, "shot"),
      ev("brkr-c3", "away", 57, "corner"),
      ev("brkr-s5", "away", 64, "shot"),
      ev("brkr-s6", "home", 71, "shot"),
      ev("brkr-c4", "away", 81, "corner"),
      ev("brkr-s7", "away", 87, "shot"),
    ],
  },
  // ── Qatar 2022 — Group D ─────────────────────────────────────
  // Tunisia 1-0 France, Education City Stadium, 30 November 2022.
  // French-born Khazri sinks the holders. Griezmann thought he'd
  // equalised in injury time but VAR ruled it offside.
  {
    id: "tn-fr",
    competition: "WORLD CUP 2022 · GROUP D",
    venueAndDate: "Education City | 30.11.2022",
    home: TEAMS.TUNISIA!,
    away: TEAMS.FRANCE!,
    finalHomePossession: 0.341, // France dominated possession; Tunisia won
    goals: [
      makeGoal("tnfr-1", "home", 58, "KHAZRI", "radial_burst", "circle", 0),
    ],
    events: [
      ev("tnfr-s1", "away", 5, "shot"),
      ev("tnfr-c1", "away", 12, "corner"),
      ev("tnfr-s2", "home", 19, "shot"),
      ev("tnfr-c2", "home", 26, "corner"),
      ev("tnfr-s3", "away", 33, "shot"),
      ev("tnfr-c3", "away", 41, "corner"),
      ev("tnfr-s4", "home", 47, "shot"),
      ev("tnfr-c4", "home", 53, "corner"),
      ev("tnfr-s5", "away", 61, "shot"),
      ev("tnfr-c5", "away", 68, "corner"),
      ev("tnfr-yc1", "home", 72, "yellow_card"),
      ev("tnfr-s6", "home", 78, "shot"),
      ev("tnfr-c6", "home", 84, "corner"),
      ev("tnfr-s7", "away", 90, "shot"), // Griezmann ruled offside in stoppage
    ],
  },
  {
    id: "ir-wal",
    competition: "WORLD CUP · GROUP B",
    venueAndDate: "Ahmad bin Ali | november 25",
    home: TEAMS.IRAN!,
    away: TEAMS.WALES!,
    finalHomePossession: 0.51, // near-even possession; Iran exploded late
    goals: [
      // Real timing was 98' + 101' (stoppage). For visual purposes
      // pulled into one-per-half within regulation: 38' + 71'.
      makeGoal("ir-1", "home", 38, "CHESHMI", "radial_burst", "circle", 0),
      makeGoal("ir-2", "home", 71, "REZAEIAN", "kinetic_shockwave", "oval", 1),
    ],
    events: [
      ev("ir-c1", "away", 11, "corner"),
      ev("ir-s1", "away", 24, "shot"),
      ev("ir-yc1", "home", 32, "yellow_card"),
      ev("ir-f1", "away", 46, "foul"),
      ev("ir-s2", "home", 55, "shot"),
      ev("ir-fk1", "home", 62, "free_kick"),
      ev("ir-c2", "home", 78, "corner"),
      ev("ir-s3", "away", 88, "shot"),
    ],
  },
  {
    id: "jp-es",
    competition: "WORLD CUP · GROUP E",
    venueAndDate: "Khalifa Intl. | december 1",
    home: TEAMS.JAPAN!,
    away: TEAMS.SPAIN!,
    finalHomePossession: 0.18, // Spain dominated possession; Japan won
    goals: [
      makeGoal("jp-1", "away", 11, "MORATA", "blocks", "rectangle", 0),
      makeGoal("jp-2", "home", 48, "DOAN", "radial_burst", "circle", 1),
      makeGoal("jp-3", "home", 51, "TANAKA", "kinetic_shockwave", "oval", 2),
    ],
    events: [
      ev("jp-s1", "away", 4, "shot"),
      ev("jp-c1", "away", 14, "corner"),
      ev("jp-f1", "home", 24, "foul"),
      ev("jp-s2", "away", 31, "shot"),
      ev("jp-yc1", "away", 39, "yellow_card"),
      ev("jp-fk1", "home", 56, "free_kick"),
      ev("jp-s3", "home", 63, "shot"),
      ev("jp-c2", "home", 70, "corner"),
      ev("jp-f2", "away", 77, "foul"),
      ev("jp-yc2", "away", 84, "yellow_card"),
      ev("jp-s4", "away", 89, "shot"),
    ],
  },
  // ── WORLD CUP 2018 — FINAL ────────────────────────────────────
  // France 4-2 Croatia, Luzhniki Stadium, Moscow, 15 July 2018.
  // First WC final since 1966 with 6 goals. Croatia dominated
  // possession; France's pace + finishing won it. Pinned as the
  // focused-match fixture used by /match-focus.html.
  {
    id: "wc18-final-fr-cr",
    competition: "WORLD CUP 2018 · FINAL",
    venueAndDate: "Luzhniki | 15.7.2018",
    home: TEAMS.FRANCE!,
    away: TEAMS.CROATIA!,
    // Croatia held the ball; France countered. ~39% home possession
    // closely matches the actual broadcast stat (FIFA recorded 60%
    // Croatia / 40% France during regulation).
    finalHomePossession: 0.4,
    goals: [
      // 18' Mandžukić own goal — counts for France (home). Griezmann
      // free-kick glanced off Mandžukić's head into the net.
      makeGoal("wc18-1", "home", 18, "MANDŽUKIĆ (OG)", "radial_burst", "circle", 0),
      // 28' Perišić — Croatia equalize; outside-of-the-foot finish.
      makeGoal("wc18-2", "away", 28, "PERIŠIĆ", "kinetic_shockwave", "circle", 0),
      // 38' Griezmann penalty — VAR-awarded handball on Perišić.
      makeGoal("wc18-3", "home", 38, "GRIEZMANN", "wedges", "circle", 1),
      // 59' Pogba — second-chance finish after Mbappé's cross deflected.
      makeGoal("wc18-4", "home", 59, "POGBA", "particle_burst", "circle", 2),
      // 65' Mbappé — 19-year-old becomes the second teenager (after
      // Pelé in 1958) to score in a World Cup final.
      makeGoal("wc18-5", "home", 65, "MBAPPÉ", "ink_spiral", "circle", 3),
      // 69' Mandžukić's actual goal — Lloris dribbling error gifted.
      makeGoal("wc18-6", "away", 69, "MANDŽUKIĆ", "fragmented_ray", "circle", 1),
    ],
    events: [
      ev("wc18-c1", "away", 6, "corner"),
      ev("wc18-s1", "away", 11, "shot"),
      ev("wc18-c2", "home", 17, "corner"), // free-kick that led to the OG
      ev("wc18-s2", "away", 25, "shot"),
      ev("wc18-s3", "home", 33, "shot"),
      ev("wc18-yc1", "away", 36, "yellow_card"), // Brozović
      ev("wc18-s4", "home", 47, "shot"),
      ev("wc18-c3", "away", 53, "corner"),
      ev("wc18-s5", "away", 57, "shot"),
      ev("wc18-yc2", "home", 61, "yellow_card"), // Matuidi
      ev("wc18-c4", "away", 73, "corner"),
      ev("wc18-yc3", "away", 78, "yellow_card"), // Vrsaljko
      ev("wc18-s6", "away", 82, "shot"),
      ev("wc18-s7", "away", 88, "shot"),
    ],
  },
  // ── World Cup highlight reels ────────────────────────────────
  // Three famous fixtures from past World Cups, with real scorers,
  // minutes, possession and bookings.
  //
  // Brazil 1-7 Germany — 2014 World Cup Semi-final, Estádio
  // Mineirão, Belo Horizonte, 8 July 2014. Germany scored four goals
  // in six minutes (23'-29'); Oscar pulled one back at 90'. The most
  // famous collapse in World Cup history.
  {
    id: "br-ge-2014-sf",
    competition: "WORLD CUP 2014 · SEMI-FINAL",
    venueAndDate: "Belo Horizonte | july 8",
    home: TEAMS.BRAZIL!,
    away: TEAMS.GERMANY!,
    finalHomePossession: 0.52, // Brazil held the ball; Germany was clinical
    goals: [
      makeGoal("brge-1", "away", 11, "MÜLLER", "radial_burst", "circle", 0),
      makeGoal("brge-2", "away", 23, "KLOSE", "kinetic_shockwave", "oval", 1),
      makeGoal("brge-3", "away", 24, "KROOS", "particle_burst", "organic_blob", 2),
      makeGoal("brge-4", "away", 26, "KROOS", "wedges", "arch", 3),
      makeGoal("brge-5", "away", 29, "KHEDIRA", "blocks", "rectangle", 4),
      makeGoal("brge-6", "away", 69, "SCHÜRRLE", "fragmented_ray", "irregular_polygon", 5),
      makeGoal("brge-7", "away", 79, "SCHÜRRLE", "ink_spiral", "circle", 6),
      makeGoal("brge-8", "home", 90, "OSCAR", "radial_burst", "oval", 0),
    ],
    events: [
      ev("brge-s1", "away", 7, "shot"),
      ev("brge-c1", "away", 18, "corner"),
      ev("brge-c2", "away", 31, "corner"),
      ev("brge-s2", "home", 40, "shot"),
      ev("brge-yc1", "home", 45, "yellow_card"), // Dante
      ev("brge-s3", "home", 56, "shot"),
      ev("brge-c3", "home", 64, "corner"),
      ev("brge-s4", "home", 73, "shot"),
      ev("brge-s5", "home", 84, "shot"),
    ],
  },
  // Portugal 3-3 Spain — 2018 World Cup Group B, Fisht Stadium,
  // Sochi, 15 June 2018. Cristiano Ronaldo hat-trick (incl. a 4th-min
  // penalty and an 88th-min free kick) cancelled out Diego Costa's
  // brace and Nacho's volley in a six-goal Iberian classic.
  {
    id: "pt-es-2018-gs",
    competition: "WORLD CUP 2018 · GROUP B",
    venueAndDate: "Sochi | june 15",
    home: TEAMS.PORTUGAL!,
    away: TEAMS.SPAIN!,
    finalHomePossession: 0.32, // Spain dominated possession ~68%
    goals: [
      makeGoal("ptes-1", "home", 4, "RONALDO", "radial_burst", "circle", 0),
      makeGoal("ptes-2", "away", 24, "COSTA", "kinetic_shockwave", "oval", 0),
      makeGoal("ptes-3", "home", 44, "RONALDO", "particle_burst", "organic_blob", 1),
      makeGoal("ptes-4", "away", 55, "COSTA", "wedges", "arch", 1),
      makeGoal("ptes-5", "away", 58, "NACHO", "blocks", "rectangle", 2),
      makeGoal("ptes-6", "home", 88, "RONALDO", "fragmented_ray", "irregular_polygon", 2),
    ],
    events: [
      ev("ptes-s1", "away", 9, "shot"),
      ev("ptes-c1", "away", 19, "corner"),
      ev("ptes-s2", "home", 31, "shot"),
      ev("ptes-c2", "away", 41, "corner"),
      ev("ptes-yc1", "home", 51, "yellow_card"), // Bruno Fernandes
      ev("ptes-c3", "away", 63, "corner"),
      ev("ptes-s3", "away", 71, "shot"),
      ev("ptes-yc2", "away", 78, "yellow_card"), // Busquets
      ev("ptes-s4", "away", 85, "shot"),
    ],
  },
  // ── Netherlands 2-2 Argentina ─────────────────────────────────
  // 2022 World Cup Quarter-final, Lusail Stadium, 9 December 2022.
  // Argentina led 2-0 through Molina (35') and a Messi penalty (73')
  // before Wout Weghorst struck twice late — the second from a
  // training-ground free kick in the 11th minute of stoppage time —
  // to force extra time. Argentina won on penalties. The match set a
  // World Cup record for cards (17 yellows + a red).
  {
    id: "nl-ar-2022-qf",
    competition: "WORLD CUP 2022 · QUARTER-FINAL",
    venueAndDate: "Lusail | december 9",
    home: TEAMS.NETHERLANDS!,
    away: TEAMS.ARGENTINA!,
    finalHomePossession: 0.44, // Argentina edged possession
    goals: [
      makeGoal("nlar-1", "away", 35, "MOLINA",   "radial_burst",      "circle",            0),
      makeGoal("nlar-2", "away", 73, "MESSI",    "kinetic_shockwave", "oval",              1),
      makeGoal("nlar-3", "home", 83, "WEGHORST", "particle_burst",    "organic_blob",      0),
      makeGoal("nlar-4", "home", 90, "WEGHORST", "wedges",            "arch",              1),
    ],
    events: [
      ev("nlar-s1",  "away",  6, "shot"),
      ev("nlar-c1",  "away", 14, "corner"),
      ev("nlar-yc1", "home", 22, "yellow_card"), // Berghuis
      ev("nlar-f1",  "home", 30, "foul"),
      ev("nlar-yc2", "away", 38, "yellow_card"), // Paredes
      ev("nlar-yc3", "home", 44, "yellow_card"), // de Roon
      ev("nlar-s2",  "home", 52, "shot"),
      ev("nlar-yc4", "away", 60, "yellow_card"), // Acuña
      ev("nlar-c2",  "home", 67, "corner"),
      ev("nlar-yc5", "home", 77, "yellow_card"), // Dumfries
      ev("nlar-yc6", "away", 81, "yellow_card"), // Messi
      ev("nlar-s3",  "away", 86, "shot"),
      ev("nlar-yc7", "away", 89, "yellow_card"), // Paredes scuffle
      ev("nlar-yc8", "home", 90, "yellow_card"), // late mass booking
      ev("nlar-rc1", "home", 90, "red_card"),     // Dumfries — 2nd yellow
    ],
  },
  // ── Netherlands 0-0 Argentina ─────────────────────────────────
  // 2014 World Cup Semi-final, Arena de São Paulo, 9 July 2014.
  // Goalless through 120 minutes — a tense war of attrition that
  // Argentina won 4-2 on penalties. No goals: the card reads 0-0 and
  // is carried entirely by the shots, corners and bookings.
  {
    id: "nl-ar-2014-sf",
    competition: "WORLD CUP 2014 · SEMI-FINAL",
    venueAndDate: "São Paulo | july 9",
    home: TEAMS.NETHERLANDS!,
    away: TEAMS.ARGENTINA!,
    finalHomePossession: 0.48, // near-even; chances were scarce
    goals: [],
    events: [
      ev("nlar14-s1", "away", 8, "shot"),
      ev("nlar14-c1", "home", 16, "corner"),
      ev("nlar14-s2", "home", 24, "shot"),
      ev("nlar14-yc1", "home", 31, "yellow_card"), // de Jong
      ev("nlar14-c2", "away", 39, "corner"),
      ev("nlar14-s3", "away", 52, "shot"),
      ev("nlar14-yc2", "away", 58, "yellow_card"), // Mascherano
      ev("nlar14-s4", "home", 66, "shot"),
      ev("nlar14-c3", "home", 74, "corner"),
      ev("nlar14-yc3", "home", 80, "yellow_card"), // Kuyt
      ev("nlar14-s5", "away", 88, "shot"),
    ],
  },
  // ── WORLD CUP 2026 — predicted fixtures ───────────────────────
  // Invented results for the upcoming USA/Canada/Mexico tournament:
  // the three hosts plus blockbuster ties, with plausible scorelines
  // and current scorers. Predictions, not real results.
  //
  // Host 1 — Mexico vs Argentina at the Azteca.
  {
    id: "mx-ar-2026",
    competition: "WORLD CUP 2026 · GROUP A",
    venueAndDate: "Mexico City | june 11",
    home: TEAMS.MEXICO!,
    away: TEAMS.ARGENTINA!,
    finalHomePossession: 0.4, // Argentina control the ball
    goals: [
      makeGoal("mxar-1", "away", 28, "J. ÁLVAREZ", "radial_burst", "circle", 0),
      makeGoal("mxar-2", "home", 52, "S. GIMÉNEZ", "kinetic_shockwave", "oval", 0),
      makeGoal("mxar-3", "away", 67, "MESSI", "particle_burst", "organic_blob", 1),
    ],
    events: [
      ev("mxar-s1", "away", 9, "shot"),
      ev("mxar-c1", "away", 19, "corner"),
      ev("mxar-yc1", "home", 34, "yellow_card"),
      ev("mxar-s2", "home", 47, "shot"),
      ev("mxar-c2", "away", 61, "corner"),
      ev("mxar-yc2", "home", 73, "yellow_card"),
      ev("mxar-s3", "away", 84, "shot"),
    ],
  },
  // Host 2 — USA vs England.
  {
    id: "us-en-2026",
    competition: "WORLD CUP 2026 · GROUP D",
    venueAndDate: "East Rutherford | june 15",
    home: TEAMS.USA!,
    away: TEAMS.ENGLAND!,
    finalHomePossession: 0.42,
    goals: [
      makeGoal("usen-1", "home", 40, "PULISIC", "radial_burst", "circle", 0),
      makeGoal("usen-2", "away", 58, "KANE", "kinetic_shockwave", "oval", 0),
    ],
    events: [
      ev("usen-s1", "away", 7, "shot"),
      ev("usen-c1", "away", 22, "corner"),
      ev("usen-yc1", "home", 35, "yellow_card"),
      ev("usen-s2", "home", 49, "shot"),
      ev("usen-c2", "home", 66, "corner"),
      ev("usen-yc2", "away", 78, "yellow_card"),
      ev("usen-s3", "away", 86, "shot"),
    ],
  },
  // Host 3 — Canada vs France.
  {
    id: "ca-fr-2026",
    competition: "WORLD CUP 2026 · GROUP F",
    venueAndDate: "Toronto | june 18",
    home: TEAMS.CANADA!,
    away: TEAMS.FRANCE!,
    finalHomePossession: 0.38,
    goals: [
      makeGoal("cafr-1", "away", 21, "MBAPPÉ", "radial_burst", "circle", 0),
      makeGoal("cafr-2", "away", 55, "MBAPPÉ", "kinetic_shockwave", "oval", 1),
      makeGoal("cafr-3", "home", 64, "DAVID", "particle_burst", "organic_blob", 0),
      makeGoal("cafr-4", "away", 78, "DEMBÉLÉ", "wedges", "arch", 2),
    ],
    events: [
      ev("cafr-s1", "away", 6, "shot"),
      ev("cafr-c1", "away", 18, "corner"),
      ev("cafr-s2", "away", 33, "shot"),
      ev("cafr-yc1", "home", 44, "yellow_card"),
      ev("cafr-c2", "away", 59, "corner"),
      ev("cafr-yc2", "home", 71, "yellow_card"),
      ev("cafr-s3", "home", 83, "shot"),
    ],
  },
  // Blockbuster — Brazil vs Spain.
  {
    id: "br-es-2026",
    competition: "WORLD CUP 2026 · GROUP E",
    venueAndDate: "Atlanta | june 24",
    home: TEAMS.BRAZIL!,
    away: TEAMS.SPAIN!,
    finalHomePossession: 0.48,
    goals: [
      makeGoal("bres-1", "away", 18, "YAMAL", "radial_burst", "circle", 0),
      makeGoal("bres-2", "home", 33, "VINÍCIUS", "kinetic_shockwave", "oval", 0),
      makeGoal("bres-3", "home", 70, "RAPHINHA", "particle_burst", "organic_blob", 1),
      makeGoal("bres-4", "away", 81, "MORATA", "wedges", "arch", 1),
    ],
    events: [
      ev("bres-s1", "home", 11, "shot"),
      ev("bres-c1", "away", 24, "corner"),
      ev("bres-yc1", "away", 38, "yellow_card"),
      ev("bres-s2", "home", 52, "shot"),
      ev("bres-c2", "home", 63, "corner"),
      ev("bres-yc2", "home", 76, "yellow_card"),
      ev("bres-s3", "away", 88, "shot"),
    ],
  },
  // Knockout — Portugal vs Germany.
  {
    id: "pt-ge-2026",
    competition: "WORLD CUP 2026 · ROUND OF 16",
    venueAndDate: "Dallas | july 4",
    home: TEAMS.PORTUGAL!,
    away: TEAMS.GERMANY!,
    finalHomePossession: 0.45,
    goals: [
      makeGoal("ptge-1", "home", 12, "RONALDO", "radial_burst", "circle", 0),
      makeGoal("ptge-2", "away", 59, "MUSIALA", "kinetic_shockwave", "oval", 0),
      makeGoal("ptge-3", "home", 74, "B. FERNANDES", "particle_burst", "organic_blob", 1),
    ],
    events: [
      ev("ptge-s1", "away", 8, "shot"),
      ev("ptge-c1", "home", 21, "corner"),
      ev("ptge-yc1", "away", 33, "yellow_card"),
      ev("ptge-s2", "home", 48, "shot"),
      ev("ptge-c2", "away", 64, "corner"),
      ev("ptge-yc2", "home", 79, "yellow_card"),
      ev("ptge-s3", "away", 87, "shot"),
    ],
  },
  // Predicted FINAL — Argentina vs Brazil, the dream superclásico.
  {
    id: "ar-br-2026-final",
    competition: "WORLD CUP 2026 · FINAL",
    venueAndDate: "East Rutherford | july 19",
    home: TEAMS.ARGENTINA!,
    away: TEAMS.BRAZIL!,
    finalHomePossession: 0.49,
    goals: [
      makeGoal("arbr-1", "home", 22, "MESSI", "radial_burst", "circle", 0),
      makeGoal("arbr-2", "away", 45, "VINÍCIUS", "kinetic_shockwave", "oval", 0),
      makeGoal("arbr-3", "home", 61, "LAUTARO", "particle_burst", "organic_blob", 1),
      makeGoal("arbr-4", "away", 70, "RODRYGO", "wedges", "arch", 1),
      makeGoal("arbr-5", "home", 88, "J. ÁLVAREZ", "blocks", "rectangle", 2),
    ],
    events: [
      ev("arbr-s1", "away", 10, "shot"),
      ev("arbr-c1", "home", 19, "corner"),
      ev("arbr-yc1", "away", 31, "yellow_card"),
      ev("arbr-s2", "home", 44, "shot"),
      ev("arbr-yc2", "home", 57, "yellow_card"),
      ev("arbr-c2", "away", 68, "corner"),
      ev("arbr-yc3", "away", 75, "yellow_card"),
      ev("arbr-s3", "home", 84, "shot"),
    ],
  },
];

// Post-process: lay every game's goals out chronologically L→R, then
// rewrite each goal's recipe to a personality drawn from a per-game
// shuffled permutation of GOAL_PERSONALITIES. The gallery shows only
// real WC fixtures — synthetic preset cards from ANIMATION_SET live
// in source for the studio to consume, not in this list.
GAMES.forEach((g, i) => {
  assignChronologicalPositions(g.goals, i);
  assignGoalPersonalities(g.goals, g.id);
});

// Light-color check + numeral-pick rotation copied from
// BrazilSketchLab so the gallery doesn't depend on the lab module.
const isLightHex = (hex: string): boolean => {
  const h = hex.replace("#", "");
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return r * 0.2126 + g * 0.7152 + b * 0.0722 > 205;
};
// Goal palettes use ONLY the team's flag colours, expanded
// proportionally to each colour's actual share of the flag so
// (e.g.) Brazil's green appears far more often than its blue.
const PALETTE_SLOTS = 12;
const paletteOf = (t: StaticPreviewTeam): string[] => {
  const lightPrimary = isLightHex(t.flagPrimary);
  const baseColors: [string, string, string] = lightPrimary
    ? [t.flagAccent, t.flagSecondary, t.flagPrimary]
    : [t.flagPrimary, t.flagSecondary, t.flagAccent];
  // Weights are authored in [primary, secondary, accent] order;
  // re-map them to the colour order above when we've rotated.
  const wInput = t.flagWeights ?? [0.34, 0.33, 0.33];
  const baseWeights: [number, number, number] = lightPrimary
    ? [wInput[2], wInput[1], wInput[0]]
    : [wInput[0], wInput[1], wInput[2]];
  const palette: string[] = [];
  for (let i = 0; i < baseColors.length; i++) {
    const slots = Math.max(1, Math.round(baseWeights[i]! * PALETTE_SLOTS));
    for (let j = 0; j < slots; j++) palette.push(baseColors[i]!);
  }
  return palette;
};

// Card with an independent play / pause button. Each card stays
// static at frame 0 until the user clicks the play overlay. Plays
// once through to frame 269, freezes there. Clicking again resets
// to frame 0 and replays from the start. No automatic looping.
//
// Audio: each card owns one looping crowd track + a final whistle at
// match end. Triggers fire once per playthrough; "Replay" clears them.
const TOTAL_FRAMES = 270;
const END_FRAME = TOTAL_FRAMES - 1;
const KICKOFF_END = 15;
const MATCH_END = 180; // Match clock ends earlier than video so late-game goals still have room for their reveal animation.

export const GalleryCard: React.FC<{ game: Game }> = ({ game }) => {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  // ── Audio refs ─────────────────────────────────────────────────
  const crowdRef = useRef<HTMLAudioElement | null>(null);
  const goalsFiredRef = useRef<Set<string>>(new Set());
  const whistleFiredRef = useRef(false);
  useEffect(() => {
    const crowd = new Audio("/audio/crowd.mp3");
    crowd.loop = true;
    // Sound muted for v1 gallery (per user). Re-enable by bumping
    // this volume + the whistle/goal volumes below.
    crowd.volume = 0;
    crowdRef.current = crowd;
    return () => {
      crowd.pause();
      crowd.src = "";
    };
  }, []);
  // Play / pause the crowd loop when `playing` flips.
  useEffect(() => {
    const c = crowdRef.current;
    if (!c) return;
    if (playing) {
      c.currentTime = 0;
      c.play().catch(() => {});
    } else {
      c.pause();
    }
  }, [playing]);
  // Final whistle on the way through the frame. (Goal-shout / "yell"
  // audio has been removed from the project.)
  useEffect(() => {
    if (!playing) return;
    if (!whistleFiredRef.current && frame >= MATCH_END) {
      const a = new Audio("/audio/whistle.mp3");
      a.volume = 0; // muted for v1 gallery
      a.play().catch(() => {});
      whistleFiredRef.current = true;
    }
  }, [frame, playing, game.goals]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const next = frameRef.current + (dt / 1000) * 30;
      if (next >= END_FRAME) {
        // Freeze at the final frame and stop the loop.
        setFrame(END_FRAME);
        setPlaying(false);
        return;
      }
      setFrame(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  const home = useMemo(() => paletteOf(game.home), [game.home]);
  const away = useMemo(() => paletteOf(game.away), [game.away]);
  void home;
  void away;
  // Per-match shuffled shape assignment — each goal a distinct family.
  const familyMap = useMemo(
    () => v1BuildFamilyMap(game.id, game.goals),
    [game.id, game.goals],
  );
  // Emotional-logic verification: derive a 0..1 importance per goal
  // from the rules engine in src/lib/goalImportance.ts. Wired through
  // to StaticPreview so future renderers can scale size/intensity by
  // importance. Logs the per-goal breakdown to the console so the
  // math is auditable on the focused match.
  const importanceById = useMemo(() => {
    const ctx = MATCH_CONTEXTS[game.id] ?? DEFAULT_MATCH_CONTEXT;
    const map = new Map<string, number>();
    const breakdowns: Array<{
      id: string;
      scorer: string;
      minute: number;
      team: string;
      importance: number;
      stage: number;
      expectedness: number;
      scoreChange: number;
      rivalry: number;
      lateness: number;
      scoreBefore: { home: number; away: number };
    }> = [];
    for (const g of game.goals) {
      const b = computeGoalImportance(
        { id: g.id, team: g.team, minute: g.minute },
        game.goals.map((x) => ({ id: x.id, team: x.team, minute: x.minute })),
        ctx,
      );
      map.set(g.id, b.importance);
      breakdowns.push({
        id: g.id,
        scorer: g.scorer,
        minute: g.minute,
        team: g.team,
        importance: Math.round(b.importance * 100) / 100,
        stage: b.stage,
        expectedness: Math.round(b.expectedness * 100) / 100,
        scoreChange: Math.round(b.scoreChange * 100) / 100,
        rivalry: Math.round(b.rivalry * 100) / 100,
        lateness: Math.round(b.lateness * 100) / 100,
        scoreBefore: b.scoreBefore,
      });
    }
    // Console table so the user can audit the per-goal math.
    if (typeof console !== "undefined" && console.table) {
      // eslint-disable-next-line no-console
      console.groupCollapsed(`Emotional logic — ${game.id}`);
      // eslint-disable-next-line no-console
      console.table(breakdowns);
      // eslint-disable-next-line no-console
      console.groupEnd();
    }
    return map;
  }, [game.id, game.goals]);
  // Pre-match underdog (lower strength) — drives the LARGE size-tier
  // rule for "first goal by the underdog".
  const underdog: "home" | "away" = useMemo(() => {
    const ctx = MATCH_CONTEXTS[game.id] ?? DEFAULT_MATCH_CONTEXT;
    return ctx.homeStrength <= ctx.awayStrength ? "home" : "away";
  }, [game.id]);
  const handleToggle = () => {
    if (playing) {
      setPlaying(false);
    } else {
      // If frozen at the end, replay from frame 0 + clear triggers
      // so all the goal shouts and whistle fire again.
      if (frameRef.current >= END_FRAME) {
        setFrame(0);
        goalsFiredRef.current.clear();
        whistleFiredRef.current = false;
      }
      setPlaying(true);
    }
  };
  return (
    <div
      style={styles.card}
      onClick={handleToggle}
      role="button"
      tabIndex={0}
    >
      <StaticPreviewV3
        goals={game.goals}
        frame={frame}
        home={game.home}
        away={game.away}
        competition={game.competition}
        venueAndDate={game.venueAndDate}
        finalHomePossession={game.finalHomePossession}
        events={game.events}
        importanceById={importanceById}
        showLabelWell={false}
        familyForGoal={(g) => familyMap.get(g.id)!}
        underdog={underdog}
      />
      {!playing && frame < END_FRAME && (
        <div style={styles.playOverlay}>
          <div style={styles.playButton}>▶</div>
        </div>
      )}
    </div>
  );
};

export const GameGallery: React.FC = () => {
  // Filter out example-* fixtures — those are synthetic test cards
  // for match-focus, not real WC matches.
  const visibleGames = GAMES.filter((g) => !g.id.startsWith("example-"));
  return (
    <div style={styles.shell}>
      <div style={styles.row}>
        {visibleGames.map((g) => (
          <GalleryCard key={g.id} game={g} />
        ))}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  shell: {
    background: "#0E0E0E",
    minHeight: "100vh",
    width: "100%",
    overflow: "auto",
  },
  row: {
    display: "flex",
    gap: 16,
    padding: 16,
    minWidth: "min-content",
    height: "100vh",
    justifyContent: "center",
  },
  card: {
    position: "relative",
    aspectRatio: "9 / 16",
    height: "calc(100vh - 32px)",
    flexShrink: 0,
    background: "#F4F4F4",
    border: "2px solid #000",
    overflow: "hidden",
    display: "flex",
    cursor: "pointer",
  },
  playOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0, 0, 0, 0.18)",
    backdropFilter: "blur(2px)",
    pointerEvents: "none",
  },
  playButton: {
    width: 76,
    height: 76,
    borderRadius: 999,
    background: "rgba(0, 0, 0, 0.78)",
    color: "#FFFFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 28,
    paddingLeft: 6, // optical centre of the ▶ glyph
    boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
  },
};
