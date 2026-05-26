import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  LabOverride,
  LabBoundaryShape,
} from "../src/GridMatchCardBrazilSketch";
import { StaticPreview } from "./StaticPreview";
import {
  computeGoalImportance,
  importanceToWarp,
  importanceToLayers,
  type MatchContext,
  type Stage,
} from "../src/lib/goalImportance";
// NOTE: all heavy imports (Player, composition, cellGrid, anything pulling
// `remotion` core) are deferred to the dynamic loader below. Static imports
// here are intentionally kept to types-only + plain JS constants so the
// control panel can mount even if Remotion fails to load.
import type {
  CellGridSettings,
  CellGridType,
} from "../src/lib/cellGrid";
import type { MatchCardProps } from "../src/schema";

// Mirrors src/lib/theme.ts (1080×2340) and src/lib/timing.ts (30fps × 9s).
const CANVAS_W = 1080;
const CANVAS_H = 2340;
const FPS = 30;
const DURATION_FRAMES = 270;

// Mirrors DEFAULT_SETTINGS in src/lib/cellGrid.ts — duplicated locally so
// this file has zero runtime dependency on the cellGrid module at load.
const DEFAULT_SETTINGS: CellGridSettings = {
  colorRandomness: 34,
  dominantColor: 30,
  colorClustering: 30,
  colorContrast: 56,
  distortionStrength: 55,
  outwardForce: 20,
  pinchIntensity: 0,
  edgeOrganicness: 0,
  curvature: 0,
  asymmetry: 20,
  shapeDensity: 27,
  shapeScale: 0.5,
  rotation: 151,
  margin: 100,
  seed: 123,
};


// Brazil Sketch Lab — a standalone tweak surface mirroring the reference
// Figma mockup. The control panel mutates a single `LabOverride` object
// which is passed through `inputProps` so the embedded `<Player>` re-renders
// live as sliders/dropdowns change. Composition logic itself lives in
// GridMatchCardBrazilSketch; this page is purely UI.

type BoundaryShape = LabBoundaryShape;

const BOUNDARY_SHAPES: BoundaryShape[] = [
  "circle",
  "square",
  "rectangle",
  "oval",
  "arch",
  "capsule",
  "organic_blob",
  "irregular_polygon",
];

const GEOMETRIC_LOGICS: CellGridType[] = [
  "blocks",
  "wedges",
  "arcs",
  "checker_fields",
  "warped_bands",
  "radial_segments",
  "radial_burst",
  "kinetic_shockwave",
  "fragmented_ray",
  "mixed",
  "plotter_lines",
  "particle_burst",
  "ink_spiral",
];

const DEFAULT_HOME = {
  name: "France",
  // Tricolore in flag order: blue | white | red. Blue leads as the
  // dominant team identity colour so the score numeral, UI chips,
  // and goal animations all read as France-blue.
  flagPrimary: "#0055A4",
  flagSecondary: "#FFFFFF",
  flagAccent: "#EF4135",
};
const DEFAULT_AWAY = {
  name: "Brazil",
  flagPrimary: "#009C3B",
  flagSecondary: "#FFDF00",
  flagAccent: "#002776",
};

// Inlined to avoid importing src/lib/timing.ts (it sits next to modules
// that pull `remotion` core, which we keep behind the dynamic loader).
// Matches minuteToFrame in src/lib/timing.ts: KICKOFF_END=15, MATCH_END=240.
const minuteToFrame = (minute: number) =>
  15 + Math.max(0, Math.min(1, minute / 90)) * (240 - 15);

// A lab goal — a Goal plus its per-goal animation recipe. The recipe is
// not part of the persisted match schema; it's only consumed by the
// composition's `previewOverrides[i]` lab hook.
type LabGoal = {
  id: string;
  team: "home" | "away";
  minute: number;
  scorer: string;
  recipe: {
    type: CellGridType;
    boundary: LabBoundaryShape;
    settings: CellGridSettings;
    // Sub-zone placement inside the team's half. All 0..100.
    //   posX / posY: centre of the goal's box (% of team zone width/height)
    //   size: edge length of the box (% of zone min dimension)
    posX: number;
    posY: number;
    size: number;
    // Field-layer controls (passed straight to buildFieldLayers).
    moireStrength: number;
    blendTarget: CellGridType;
    blendAmount: number;
    recursionDepth: number;
  };
};

// Preset positions for auto-placing the Nth goal on a team so newly
// added goals don't all stack on the same spot. 5 distinct slots, then
// cycles. Each entry is [posX, posY] in 0..100 within the team zone.
const AUTO_POSITIONS: Array<[number, number]> = [
  [50, 50],
  [25, 30],
  [75, 30],
  [25, 70],
  [75, 70],
];
const autoPosition = (teamGoalIndex: number): [number, number] =>
  AUTO_POSITIONS[teamGoalIndex % AUTO_POSITIONS.length]!;

let _goalIdCounter = 0;
const nextGoalId = () => `goal-${++_goalIdCounter}`;

const makeRecipe = (
  team: "home" | "away",
  index: number,
  teamGoalIndex = 0,
): LabGoal["recipe"] => {
  const [px, py] = autoPosition(teamGoalIndex);
  // Each successive goal on the same team gets DRAMATICALLY more
  // twisted and distorted while sharing the team's geometric logic.
  // The intensity ramp is the only thing that differs between a
  // team's 1st and 3rd goal — same pattern type, very different feel.
  const k = teamGoalIndex; // 0 = first goal, 1 = second, …
  const distortionStrength = Math.min(100, 45 + k * 18);
  const outwardForce = Math.min(80, 18 + k * 14);
  const curvature = Math.min(180, (team === "home" ? 0 : 25) + k * 40);
  const pinchIntensity = Math.min(100, k * 28);
  const rotation = ((team === "home" ? 0 : 18) + k * 47) % 360;
  const asymmetry = Math.min(100, 14 + k * 12);
  return ({
  type: team === "home" ? "radial_burst" : "checker_fields",
  boundary: team === "home" ? "circle" : "rectangle",
  posX: px,
  posY: py,
  size: 55,
  moireStrength: 0,
  blendTarget: team === "home" ? "checker_fields" : "radial_burst",
  blendAmount: 0,
  recursionDepth: 0,
  settings: {
    ...DEFAULT_SETTINGS,
    colorRandomness: 30,
    dominantColor: 55,
    colorClustering: 25,
    colorContrast: 50,
    distortionStrength,
    outwardForce,
    pinchIntensity,
    curvature,
    asymmetry,
    shapeDensity: 22,
    shapeScale: 0.6,
    rotation,
    margin: 40,
    seed: 7 + index * 13,
  },
  });
};

const DEFAULT_GOALS: LabGoal[] = [
  {
    id: nextGoalId(),
    team: "home",
    minute: 14,
    scorer: "MBAPPÉ",
    recipe: makeRecipe("home", 0, 0),
  },
  {
    id: nextGoalId(),
    team: "away",
    minute: 27,
    scorer: "VINICIUS JR.",
    recipe: makeRecipe("away", 1, 0),
  },
  {
    id: nextGoalId(),
    team: "home",
    minute: 41,
    scorer: "GRIEZMANN",
    recipe: makeRecipe("home", 2, 1),
  },
  {
    id: nextGoalId(),
    team: "away",
    minute: 63,
    scorer: "RODRYGO",
    recipe: makeRecipe("away", 3, 1),
  },
  {
    id: nextGoalId(),
    team: "home",
    minute: 84,
    scorer: "DEMBÉLÉ",
    recipe: makeRecipe("home", 4, 2),
  },
];

// Dynamic loader — static `import { Player } from "@remotion/player"`
// has been observed to blank this Vite playground at module-load time
// (see Gallery.tsx for the same workaround). We import at first render
// and stash the components in state.
const useLabDeps = () => {
  const [deps, setDeps] = useState<{
    Player: React.ComponentType<any>;
    Composition: React.ComponentType<any>;
    buildDefaultTimeline: (mean: number, jitter: number) => number[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const playerMod = await import("@remotion/player");
        const compMod = await import("../src/GridMatchCardBrazilSketch");
        const possMod = await import("../src/lib/possession");
        if (cancelled) return;
        setDeps({
          Player: playerMod.Player as any,
          Composition: compMod.GridMatchCardBrazilSketch as any,
          buildDefaultTimeline: possMod.buildDefaultTimeline,
        });
      } catch (err) {
        if (cancelled) return;
        const e = err as Error;
        setError(`${e.message}\n${e.stack ?? ""}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return { deps, error };
};

export const BrazilSketchLab: React.FC = () => {
  const { deps, error } = useLabDeps();
  const [goals, setGoals] = useState<LabGoal[]>(DEFAULT_GOALS);
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_GOALS[0]!.id);
  const playerRef = useRef<{ seekTo?: (frame: number) => void } | null>(null);
  const [viewMode, setViewMode] = useState<"video" | "static">("static");
  // Static-preview frame scrubber. Defaults to ~end of timeline so
  // every goal has fired and patterns are visible by default.
  const [staticFrame, setStaticFrame] = useState<number>(260);
  // Match context — drives the goal-importance rules engine. France
  // vs Brazil out of the box reads as a roughly even knockout fixture
  // with high rivalry tradition.
  const [matchContext, setMatchContext] = useState<MatchContext>({
    stage: "knockout",
    homeStrength: 75,
    awayStrength: 78,
    rivalry: 55,
  });

  // Keep goals in chronological order so timeline reads match the player.
  const sortedGoals = useMemo(
    () => [...goals].sort((a, b) => a.minute - b.minute),
    [goals],
  );
  const selected =
    sortedGoals.find((g) => g.id === selectedId) ?? sortedGoals[0] ?? null;

  // Per-goal importance score, recomputed whenever the goals or
  // match-context change. The score itself doesn't auto-rewrite the
  // recipe (that would clobber the user's manual slider edits) — the
  // "Apply rules" button does that explicitly. The score IS shown
  // live on each goal row so the user can see what the system thinks.
  const importanceById = useMemo(() => {
    const minimal = sortedGoals.map((g) => ({
      id: g.id,
      team: g.team,
      minute: g.minute,
    }));
    const out = new Map<string, number>();
    for (const g of minimal) {
      out.set(g.id, computeGoalImportance(g, minimal, matchContext).importance);
    }
    return out;
  }, [sortedGoals, matchContext]);

  // Rewrite every goal's warp params + layer behaviours from its
  // current importance score. Preserves pattern type, boundary,
  // position, colour controls — only the intensity-driven knobs are
  // overwritten.
  const applyRulesToAll = () => {
    setGoals((gs) => {
      const minimal = gs
        .slice()
        .sort((a, b) => a.minute - b.minute)
        .map((g) => ({ id: g.id, team: g.team, minute: g.minute }));
      return gs.map((g) => {
        const k = computeGoalImportance(
          { id: g.id, team: g.team, minute: g.minute },
          minimal,
          matchContext,
        ).importance;
        const warp = importanceToWarp(k, g.team);
        const layers = importanceToLayers(k);
        return {
          ...g,
          recipe: {
            ...g.recipe,
            size: layers.size,
            moireStrength: layers.moireStrength,
            recursionDepth: layers.recursionDepth,
            settings: {
              ...g.recipe.settings,
              ...warp,
            },
          },
        };
      });
    });
  };

  const updateGoal = useCallback(
    (id: string, patch: Partial<LabGoal>) =>
      setGoals((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g))),
    [],
  );
  const updateRecipe = useCallback(
    (id: string, patch: Partial<LabGoal["recipe"]>) =>
      setGoals((gs) =>
        gs.map((g) =>
          g.id === id ? { ...g, recipe: { ...g.recipe, ...patch } } : g,
        ),
      ),
    [],
  );
  const updateSetting = useCallback(
    <K extends keyof CellGridSettings>(
      id: string,
      key: K,
      value: CellGridSettings[K],
    ) =>
      setGoals((gs) =>
        gs.map((g) =>
          g.id === id
            ? {
                ...g,
                recipe: {
                  ...g.recipe,
                  settings: { ...g.recipe.settings, [key]: value },
                },
              }
            : g,
        ),
      ),
    [],
  );
  const addGoal = (team: "home" | "away") => {
    // Append at the latest existing minute + 5 (capped at 90) so the
    // newcomer doesn't shadow an earlier one.
    const lastMin = goals.reduce((m, g) => Math.max(m, g.minute), 0);
    const minute = Math.min(90, lastMin + 5);
    // Auto-position the new goal using the slot index AMONG its team —
    // so the 2nd home goal lands in slot 1, not slot N.
    const teamGoalIndex = goals.filter((g) => g.team === team).length;
    const id = nextGoalId();
    // Seed the new goal's intensity from the current match context.
    const minimal = [
      ...sortedGoals.map((g) => ({ id: g.id, team: g.team, minute: g.minute })),
      { id, team, minute },
    ];
    const k = computeGoalImportance(
      { id, team, minute },
      minimal,
      matchContext,
    ).importance;
    const warp = importanceToWarp(k, team);
    const layers = importanceToLayers(k);
    const baseRecipe = makeRecipe(team, goals.length, teamGoalIndex);
    const newGoal: LabGoal = {
      id,
      team,
      minute,
      scorer: team === "home" ? "MBAPPÉ" : "VINICIUS JR.",
      recipe: {
        ...baseRecipe,
        size: layers.size,
        moireStrength: layers.moireStrength,
        recursionDepth: layers.recursionDepth,
        settings: { ...baseRecipe.settings, ...warp },
      },
    };
    setGoals((gs) => [...gs, newGoal]);
    setSelectedId(id);
  };
  const deleteGoal = (id: string) => {
    setGoals((gs) => {
      const next = gs.filter((g) => g.id !== id);
      if (id === selectedId && next.length > 0) {
        setSelectedId(next[0]!.id);
      }
      return next;
    });
  };
  // Seek the player to a goal's trigger frame so its reveal animation
  // starts right away when the user clicks it in the list.
  const selectGoal = (g: LabGoal) => {
    setSelectedId(g.id);
    const target = Math.max(0, Math.round(minuteToFrame(g.minute)) - 2);
    playerRef.current?.seekTo?.(target);
  };

  const inputProps = useMemo<
    | (MatchCardProps & {
        previewOverrides: (LabOverride | null)[];
      })
    | null
  >(() => {
    if (!deps) return null;
    if (sortedGoals.length === 0) return null;
    const matchGoals: MatchCardProps["goals"] = sortedGoals.map((g) => ({
      team: g.team,
      minute: g.minute,
      style: 0,
      scorer: g.scorer || undefined,
    }));
    const overrides: LabOverride[] = sortedGoals.map((g) => ({
      type: g.recipe.type,
      settings: g.recipe.settings,
      boundary: g.recipe.boundary,
      posX: g.recipe.posX,
      posY: g.recipe.posY,
      size: g.recipe.size,
      moireStrength: g.recipe.moireStrength,
      blendTarget: g.recipe.blendTarget,
      blendAmount: g.recipe.blendAmount,
      recursionDepth: g.recipe.recursionDepth,
    }));
    return {
      home: DEFAULT_HOME,
      away: DEFAULT_AWAY,
      competition: "MATCH CARD LAB",
      venue: "PLAYGROUND",
      date: "—",
      goals: matchGoals,
      possessionTimeline: deps.buildDefaultTimeline(0.5, 0),
      emotion: 0.7,
      clash: 0.5,
      shotDensity: 0,
      glitch: 0,
      showGrid: false,
      showShots: false,
      previewOverrides: overrides,
    };
  }, [sortedGoals, deps]);

  const settings = selected?.recipe.settings ?? DEFAULT_SETTINGS;
  const type = selected?.recipe.type ?? "blocks";
  const boundary = selected?.recipe.boundary ?? "rectangle";
  const update = <K extends keyof CellGridSettings>(
    key: K,
    value: CellGridSettings[K],
  ) => {
    if (!selected) return;
    updateSetting(selected.id, key, value);
  };

  return (
    <div style={ui.shell}>
      <aside style={ui.panel}>
        <Section title="Match Context">
          <Dropdown
            label="Stage"
            value={matchContext.stage}
            options={["group", "knockout", "final"] as Stage[]}
            onChange={(v) =>
              setMatchContext((c) => ({ ...c, stage: v as Stage }))
            }
          />
          <Slider
            label="Home Strength"
            min={0}
            max={100}
            step={1}
            value={matchContext.homeStrength}
            onChange={(v) =>
              setMatchContext((c) => ({ ...c, homeStrength: v }))
            }
          />
          <Slider
            label="Away Strength"
            min={0}
            max={100}
            step={1}
            value={matchContext.awayStrength}
            onChange={(v) =>
              setMatchContext((c) => ({ ...c, awayStrength: v }))
            }
          />
          <Slider
            label="Rivalry"
            min={0}
            max={100}
            step={1}
            value={matchContext.rivalry}
            onChange={(v) => setMatchContext((c) => ({ ...c, rivalry: v }))}
          />
          <button
            type="button"
            onClick={applyRulesToAll}
            style={ui.shuffleBtn}
          >
            Apply rules to all goals
          </button>
        </Section>

        <GoalEditor
          goals={sortedGoals}
          selectedId={selected?.id ?? null}
          onSelect={selectGoal}
          onAddHome={() => addGoal("home")}
          onAddAway={() => addGoal("away")}
          onUpdate={updateGoal}
          onDelete={deleteGoal}
          importanceById={importanceById}
        />

        {!selected && (
          <div style={ui.noSelection}>
            Add a goal to start editing its animation.
          </div>
        )}

        <Section title="Goal Placement">
          <Slider
            label="Position X"
            min={0}
            max={100}
            step={1}
            value={selected?.recipe.posX ?? 50}
            onChange={(v) =>
              selected && updateRecipe(selected.id, { posX: v })
            }
          />
          <Slider
            label="Position Y"
            min={0}
            max={100}
            step={1}
            value={selected?.recipe.posY ?? 50}
            onChange={(v) =>
              selected && updateRecipe(selected.id, { posY: v })
            }
          />
          <Slider
            label="Goal Size"
            min={10}
            max={100}
            step={1}
            value={selected?.recipe.size ?? 55}
            onChange={(v) =>
              selected && updateRecipe(selected.id, { size: v })
            }
          />
          <PlacementMiniMap
            goals={sortedGoals}
            selectedId={selected?.id ?? null}
            onSelect={selectGoal}
            onMove={(id, posX, posY) => updateRecipe(id, { posX, posY })}
          />
        </Section>

        <Section title="Pattern Source">
          <Dropdown
            label="Composition Silhouette"
            value={boundary}
            options={BOUNDARY_SHAPES}
            onChange={(v) =>
              selected &&
              updateRecipe(selected.id, { boundary: v as BoundaryShape })
            }
          />
          <Dropdown
            label="Geometric Logic"
            value={type}
            options={GEOMETRIC_LOGICS}
            onChange={(v) =>
              selected &&
              updateRecipe(selected.id, { type: v as CellGridType })
            }
          />
        </Section>

        <Section title="Form & Silhouette">
          <Slider
            label="Module Density"
            min={0}
            max={100}
            step={1}
            value={settings.shapeDensity}
            onChange={(v) => update("shapeDensity", v)}
          />
          <Slider
            label="Module Scale"
            min={0.1}
            max={1.5}
            step={0.05}
            value={settings.shapeScale}
            onChange={(v) => update("shapeScale", v)}
            format={(v) => v.toFixed(2)}
          />
          <Slider
            label="Structural Asymmetry"
            min={0}
            max={100}
            step={1}
            value={settings.asymmetry}
            onChange={(v) => update("asymmetry", v)}
          />
        </Section>

        <Section title="Color & Distribution">
          <Slider
            label="Color Grouping Strength"
            min={0}
            max={100}
            step={1}
            value={settings.colorClustering}
            onChange={(v) => {
              update("colorClustering", v);
              // Pair: as clustering rises, randomness drops so the
              // single slider behaves as a coherent "grouping" knob.
              update("colorRandomness", Math.max(0, 60 - v * 0.5));
              update("dominantColor", Math.min(80, 30 + v * 0.4));
            }}
          />
          <ShuffleSeedButton
            onShuffle={() =>
              update("seed", Math.floor(Math.random() * 10000))
            }
          />
        </Section>

        <Section title="Distortion & Twist">
          <Slider
            label="Warp Intensity"
            min={0}
            max={100}
            step={1}
            value={settings.distortionStrength}
            onChange={(v) => update("distortionStrength", v)}
          />
          <Slider
            label="Radial Expansion"
            min={-100}
            max={100}
            step={1}
            value={settings.outwardForce}
            onChange={(v) => update("outwardForce", v)}
            signed
          />
          <Slider
            label="Spiral Twist"
            min={0}
            max={180}
            step={1}
            value={settings.curvature}
            onChange={(v) => update("curvature", v)}
          />
          <Slider
            label="Pinch Intensity"
            min={0}
            max={100}
            step={1}
            value={settings.pinchIntensity ?? 0}
            onChange={(v) => update("pinchIntensity", v)}
          />
          <Slider
            label="Global Rotation"
            min={0}
            max={360}
            step={1}
            value={settings.rotation}
            onChange={(v) => update("rotation", v)}
          />
          <Slider
            label="Composition Seed"
            min={0}
            max={9999}
            step={1}
            value={settings.seed}
            onChange={(v) => update("seed", v)}
          />
        </Section>

      </aside>

      <main style={ui.stage}>
        <div style={ui.stageHead}>
          <strong style={{ fontSize: 14, letterSpacing: "0.04em" }}>
            MATCH CARD LAB
          </strong>
          <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, opacity: 0.55 }}>
              {sortedGoals.length} goal{sortedGoals.length === 1 ? "" : "s"} ·{" "}
              {selected
                ? `${selected.team === "home" ? "HOME" : "AWAY"} @ ${selected.minute}' · ${selected.recipe.type}`
                : "No goal selected"}
            </span>
            <span style={ui.viewToggle}>
              {(["static", "video"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setViewMode(m)}
                  style={{
                    ...ui.viewToggleBtn,
                    background: viewMode === m ? "#0e0e0e" : "transparent",
                    color: viewMode === m ? "#fff" : "#0e0e0e",
                  }}
                >
                  {m === "static" ? "Animation" : "Video"}
                </button>
              ))}
            </span>
          </span>
        </div>
        <div style={ui.playerWrap}>
          {viewMode === "video" && error && (
            <pre style={ui.errorBox}>
              {`Failed to load preview deps:\n\n${error}`}
            </pre>
          )}
          {viewMode === "video" && !error && (!deps || !inputProps) && (
            <div style={ui.loading}>Loading preview…</div>
          )}
          {viewMode === "video" && deps && inputProps && (
            <PlayerStage
              deps={deps}
              inputProps={inputProps}
              playerRef={playerRef}
            />
          )}
          {viewMode === "static" && (
            <StaticStage
              goals={sortedGoals}
              selectedId={selected?.id ?? null}
              frame={staticFrame}
              onFrameChange={setStaticFrame}
              home={DEFAULT_HOME}
              away={DEFAULT_AWAY}
              importanceById={importanceById}
            />
          )}
        </div>
      </main>
    </div>
  );
};

// Static SVG preview stage — no Remotion runtime, scrub frames live.
const StaticStage: React.FC<{
  goals: LabGoal[];
  selectedId: string | null;
  frame: number;
  onFrameChange: (f: number) => void;
  home: typeof DEFAULT_HOME;
  away: typeof DEFAULT_AWAY;
  importanceById: Map<string, number>;
}> = ({ goals, selectedId, frame, onFrameChange, home, away, importanceById }) => {
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  // Track latest frame in a ref so the rAF loop reads it without
  // having to re-subscribe every frame (closure-stale otherwise).
  const frameRef = useRef(frame);
  frameRef.current = frame;

  // Record the entire 270-frame timeline as a WebM. Steps each frame
  // through React's state, rasterises the resulting SVG to a canvas,
  // and feeds the canvas stream to MediaRecorder. The download
  // happens client-side — no Vercel/Remotion render needed.
  const downloadAnimation = async () => {
    if (recording) return;
    const svg = document.querySelector(
      "[data-match-card-svg]",
    ) as SVGSVGElement | null;
    if (!svg) {
      alert("Preview not ready");
      return;
    }
    // Prefer WebCodecs (Chrome 94+ / Safari 16.4+) — encodes each
    // frame synchronously into an MP4 container without holding
    // pre-rendered images in memory. Falls back to MediaRecorder.
    const hasWebCodecs =
      typeof window !== "undefined" &&
      typeof window.VideoEncoder !== "undefined" &&
      typeof window.VideoFrame !== "undefined";
    setRecording(true);
    setPlaying(false);
    setRecordProgress(0);

    const W = 1080;
    const H = 1920;
    const TOTAL_FRAMES = 270;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setRecording(false);
      return;
    }

    // Two-rAF wait — gives React time to commit the new frame to the
    // DOM before we serialise it.
    const waitForRender = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );

    // Clone the live SVG and stamp it with explicit width/height
    // attributes — the in-DOM version uses 100%/100% which collapses
    // to 300×150 when loaded as a standalone Image (so half the
    // scene gets cropped). Done once per call.
    const serializeFrame = (): string => {
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("width", String(W));
      clone.setAttribute("height", String(H));
      return new XMLSerializer().serializeToString(clone);
    };

    // Decode the current StaticPreview SVG to an HTMLImageElement and
    // paint it on the recording canvas. Returns the URL so the caller
    // can release it after the frame is consumed.
    const renderCurrentSvgToCanvas = async (): Promise<string> => {
      const svgStr = serializeFrame();
      const blob = new Blob([svgStr], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          ctx.fillStyle = "#F4F4F4";
          ctx.fillRect(0, 0, W, H);
          ctx.drawImage(img, 0, 0, W, H);
          resolve();
        };
        img.onerror = () => reject(new Error("svg → image failed"));
        img.src = url;
      });
      return url;
    };

    try {
      if (hasWebCodecs) {
        // ── WebCodecs path — encode each frame inline. Memory stays
        // flat because frames are dropped after VideoFrame.close().
        const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
        const muxer = new Muxer({
          target: new ArrayBufferTarget(),
          video: {
            codec: "avc",
            width: W,
            height: H,
            frameRate: 30,
          },
          fastStart: "in-memory",
        });
        const encoder = new VideoEncoder({
          output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
          error: (err) => {
            console.error("VideoEncoder error", err);
          },
        });
        encoder.configure({
          codec: "avc1.42001f", // H.264 baseline, level 3.1
          width: W,
          height: H,
          framerate: 30,
          bitrate: 8_000_000,
        });
        for (let f = 0; f < TOTAL_FRAMES; f++) {
          onFrameChange(f);
          await waitForRender();
          const url = await renderCurrentSvgToCanvas();
          const videoFrame = new VideoFrame(canvas, {
            timestamp: Math.round((f * 1_000_000) / 30),
            duration: Math.round(1_000_000 / 30),
          });
          encoder.encode(videoFrame, { keyFrame: f % 30 === 0 });
          videoFrame.close();
          URL.revokeObjectURL(url);
          setRecordProgress((f + 1) / TOTAL_FRAMES);
          // Yield every few frames so the UI / progress paint.
          if (f % 8 === 0) await new Promise((r) => setTimeout(r, 0));
        }
        await encoder.flush();
        encoder.close();
        muxer.finalize();
        const buf = (muxer.target as InstanceType<typeof ArrayBufferTarget>)
          .buffer as ArrayBuffer;
        const out = new Blob([buf], { type: "video/mp4" });
        const dlUrl = URL.createObjectURL(out);
        const a = document.createElement("a");
        a.href = dlUrl;
        a.download = "match-card-lab.mp4";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(dlUrl), 5_000);
      } else {
        // ── MediaRecorder fallback. Slower & memory-heavier; only
        // used in browsers without WebCodecs (older Firefox etc.).
        const mimes = [
          'video/mp4;codecs="avc1.42E01E"',
          "video/mp4",
          "video/webm;codecs=vp9",
          "video/webm",
        ];
        const mime = mimes.find(
          (m) =>
            typeof MediaRecorder !== "undefined" &&
            MediaRecorder.isTypeSupported(m),
        );
        if (!mime) {
          alert("This browser cannot encode video.");
          return;
        }
        const outputType = mime.startsWith("video/mp4")
          ? "video/mp4"
          : "video/webm";
        const outputExt = outputType === "video/mp4" ? "mp4" : "webm";
        const stream = canvas.captureStream(30);
        const chunks: Blob[] = [];
        const recorder = new MediaRecorder(stream, {
          mimeType: mime,
          videoBitsPerSecond: 8_000_000,
        });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        // Seed frame 0 + paint it before start so MediaRecorder's
        // first sample isn't a blank canvas.
        onFrameChange(0);
        await waitForRender();
        const firstUrl = await renderCurrentSvgToCanvas();
        URL.revokeObjectURL(firstUrl);
        recorder.start();
        const FRAME_MS = 1000 / 30;
        const start = performance.now();
        for (let f = 1; f < TOTAL_FRAMES; f++) {
          onFrameChange(f);
          await waitForRender();
          const url = await renderCurrentSvgToCanvas();
          URL.revokeObjectURL(url);
          const target = start + f * FRAME_MS;
          const now = performance.now();
          if (target > now) {
            await new Promise((r) => setTimeout(r, target - now));
          }
          setRecordProgress((f + 1) / TOTAL_FRAMES);
        }
        await new Promise((r) => setTimeout(r, FRAME_MS * 2));
        recorder.stop();
        await new Promise<void>((resolve) => {
          recorder.onstop = () => resolve();
          setTimeout(resolve, 5_000);
        });
        const out = new Blob(chunks, { type: outputType });
        const dlUrl = URL.createObjectURL(out);
        const a = document.createElement("a");
        a.href = dlUrl;
        a.download = `match-card-lab.${outputExt}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(dlUrl), 5_000);
      }
    } catch (err) {
      console.error(err);
      alert(
        `Recording failed: ${(err as Error).message ?? "unknown error"}`,
      );
    } finally {
      setRecording(false);
      setRecordProgress(0);
    }
  };

  // Looped playback at 30fps.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const next = (frameRef.current + (dt / 1000) * 30) % 270;
      onFrameChange(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, onFrameChange]);
  // Build the same palette ordering the composition uses: if primary
  // is too light to lead, rotate so accent comes first.
  const isLightHex = (hex: string) => {
    const h = hex.replace("#", "");
    if (h.length !== 6) return false;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return r * 0.2126 + g * 0.7152 + b * 0.0722 > 205;
  };
  const paletteOf = (t: { flagPrimary: string; flagSecondary: string; flagAccent: string }) =>
    isLightHex(t.flagPrimary)
      ? [t.flagAccent, t.flagSecondary, t.flagPrimary]
      : [t.flagPrimary, t.flagSecondary, t.flagAccent];
  return (
    <div style={staticStageUi.shell}>
      <div style={staticStageUi.svgWrap}>
        <div style={staticStageUi.videoFrame}>
          <StaticPreview
            goals={goals}
            selectedId={selectedId}
            frame={frame}
            home={home}
            away={away}
            homePalette={paletteOf(home)}
            awayPalette={paletteOf(away)}
            importanceById={importanceById}
          />
        </div>
      </div>
      <div style={staticStageUi.scrubber}>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          style={staticStageUi.playBtn}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <span style={staticStageUi.frameLabel}>
          frame{" "}
          <strong style={{ fontVariantNumeric: "tabular-nums" }}>
            {Math.round(frame)}
          </strong>{" "}
          / 270
        </span>
        <input
          type="range"
          min={0}
          max={270}
          step={1}
          value={frame}
          onChange={(e) => {
            // User-driven scrub — pause playback so the slider wins.
            if (playing) setPlaying(false);
            onFrameChange(parseFloat(e.target.value));
          }}
          style={staticStageUi.range}
        />
        <button
          type="button"
          onClick={downloadAnimation}
          disabled={recording}
          style={{
            ...staticStageUi.downloadBtn,
            opacity: recording ? 0.6 : 1,
            cursor: recording ? "default" : "pointer",
          }}
        >
          {recording
            ? `Recording… ${Math.round(recordProgress * 100)}%`
            : "↓ Download"}
        </button>
      </div>
    </div>
  );
};

const staticStageUi: Record<string, React.CSSProperties> = {
  shell: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    gap: 8,
  },
  svgWrap: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#E9E9E9",
    overflow: "hidden",
    padding: 16,
  },
  // Exact bounds of the rendered 1080×1920 frame — anything outside
  // this box does NOT appear in the downloaded WebM. Outlined so the
  // user can see the cut at a glance.
  videoFrame: {
    aspectRatio: "9 / 16",
    height: "100%",
    maxHeight: "100%",
    maxWidth: "100%",
    background: "#F4F4F4",
    border: "2px solid #0E0E0E",
    boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
    overflow: "hidden",
    display: "flex",
  },
  scrubber: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "6px 12px",
    background: "#FFFFFF",
    border: "1px solid #ECECEC",
    borderRadius: 999,
  },
  frameLabel: {
    fontSize: 12,
    color: "#5a5a5a",
    whiteSpace: "nowrap",
    minWidth: 100,
  },
  range: {
    flex: 1,
    accentColor: "#0e0e0e",
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    border: "none",
    background: "#0e0e0e",
    color: "#FFFFFF",
    fontSize: 11,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontFamily: "inherit",
  },
  downloadBtn: {
    height: 28,
    padding: "0 14px",
    borderRadius: 999,
    border: "1px solid #0e0e0e",
    background: "#0e0e0e",
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: 600,
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    flexShrink: 0,
    cursor: "pointer",
  },
};

// Aliasing the dynamically-loaded components to local PascalCase
// identifiers keeps JSX clean (no `<deps.Player>` member-access tags).
const PlayerStage: React.FC<{
  deps: {
    Player: React.ComponentType<any>;
    Composition: React.ComponentType<any>;
  };
  inputProps: unknown;
  playerRef: React.MutableRefObject<
    { seekTo?: (frame: number) => void } | null
  >;
}> = ({ deps, inputProps, playerRef }) => {
  const PlayerCmp = deps.Player;
  return (
    <PlayerCmp
      ref={playerRef}
      component={deps.Composition}
      inputProps={inputProps}
      durationInFrames={DURATION_FRAMES}
      compositionWidth={CANVAS_W}
      compositionHeight={CANVAS_H}
      fps={FPS}
      controls
      loop
      autoPlay
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 6,
        overflow: "hidden",
        background: "#000",
      }}
    />
  );
};

// ─── Goal placement mini-map ──────────────────────────────────────────────
// A tiny panel-shaped diagram (matching the 1080x2340 aspect, split
// in half for home/away) plotting every goal's sub-box. Lets the user
// see the final composition at a glance, even before scrubbing to the
// end of the timeline.
const PlacementMiniMap: React.FC<{
  goals: LabGoal[];
  selectedId: string | null;
  onSelect: (g: LabGoal) => void;
  onMove: (id: string, posX: number, posY: number) => void;
}> = ({ goals, selectedId, onSelect, onMove }) => {
  const W = 240;
  const H = 240 * (2340 / 1080);
  const half = H / 2;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Convert a pointer event to SVG-viewBox coordinates. Without this,
  // CSS-scaled SVGs report client coords that don't line up with the
  // viewBox math used to place each goal.
  const eventToSvg = (e: React.PointerEvent): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  };

  const handlePointerDown = (g: LabGoal) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(g);
    setDraggingId(g.id);
    // Capture so the pointer keeps firing move/up even if the cursor
    // leaves the SVG bounds during the drag.
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingId) return;
    const pt = eventToSvg(e);
    if (!pt) return;
    const goal = goals.find((gg) => gg.id === draggingId);
    if (!goal) return;
    const zoneTop = goal.team === "home" ? 0 : half;
    const zoneH = half;
    const posX = Math.max(0, Math.min(100, (pt.x / W) * 100));
    const posY = Math.max(
      0,
      Math.min(100, ((pt.y - zoneTop) / zoneH) * 100),
    );
    onMove(draggingId, posX, posY);
  };

  const endDrag = () => {
    if (draggingId) setDraggingId(null);
  };

  return (
    <div style={ui.miniMapWrap}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        style={ui.miniMapSvg}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* Panel halves */}
        <rect x={0} y={0} width={W} height={half} fill="#FAFAFA" />
        <rect x={0} y={half} width={W} height={H - half} fill="#F1F1F1" />
        <line
          x1={0}
          y1={half}
          x2={W}
          y2={half}
          stroke="#D7D7D7"
          strokeDasharray="4 4"
          strokeWidth={1}
        />
        {goals.map((g) => {
          const zoneTop = g.team === "home" ? 0 : half;
          const zoneH = half;
          const zoneMin = Math.min(W, zoneH);
          const sizePx = (g.recipe.size / 100) * zoneMin;
          const cx = (g.recipe.posX / 100) * W;
          const cy = zoneTop + (g.recipe.posY / 100) * zoneH;
          const halfBox = sizePx / 2;
          const ccx = Math.max(halfBox, Math.min(W - halfBox, cx));
          const ccy = Math.max(
            zoneTop + halfBox,
            Math.min(zoneTop + zoneH - halfBox, cy),
          );
          const isSelected = g.id === selectedId;
          const isDragging = g.id === draggingId;
          const color = TEAM_COLORS[g.team];
          return (
            <g
              key={g.id}
              style={{
                cursor: isDragging ? "grabbing" : "grab",
                touchAction: "none",
              }}
              onPointerDown={handlePointerDown(g)}
            >
              <rect
                x={ccx - halfBox}
                y={ccy - halfBox}
                width={sizePx}
                height={sizePx}
                fill={color}
                fillOpacity={isSelected || isDragging ? 0.42 : 0.18}
                stroke={color}
                strokeWidth={isSelected || isDragging ? 2.5 : 1}
              />
              <text
                x={ccx}
                y={ccy + 4}
                textAnchor="middle"
                fontSize={11}
                fontWeight={700}
                fill={isSelected || isDragging ? "#fff" : color}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {g.minute}&apos;
              </text>
            </g>
          );
        })}
      </svg>
      <div style={ui.miniMapHint}>
        Drag a box to reposition · top = home · bottom = away
      </div>
    </div>
  );
};

// Small filled pill showing a goal's importance score 0..1 — used in
// the goal list so the user can see what the rules engine thinks of
// each goal at a glance. Tinted with the team's UI colour for instant
// recognition.
const ImportancePill: React.FC<{ value: number; team: "home" | "away" }> = ({
  value,
  team,
}) => {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const color = TEAM_COLORS[team];
  return (
    <span
      style={{
        position: "relative",
        width: 56,
        height: 20,
        borderRadius: 999,
        background: "#F1F1F1",
        overflow: "hidden",
        flexShrink: 0,
      }}
      title={`Importance ${pct.toFixed(0)}%`}
    >
      <span
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: `${pct}%`,
          background: color,
          opacity: 0.85,
        }}
      />
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 700,
          color: pct > 50 ? "#fff" : "#0e0e0e",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {pct.toFixed(0)}
      </span>
    </span>
  );
};

// ─── Goal list editor ──────────────────────────────────────────────────────

// Some teams (France) have a near-white flagPrimary, which is unusable
// as a UI background — it disappears against the panel and erases
// white text on chips/buttons. For lab UI only, pick the first non-pale
// colour from the team's tricolor.
const isLightHex = (hex: string): boolean => {
  const h = hex.replace("#", "");
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Rec. 709 luma — anything brighter than ~80% reads as "white-ish".
  return r * 0.2126 + g * 0.7152 + b * 0.0722 > 205;
};
const teamUiColor = (t: {
  flagPrimary: string;
  flagSecondary: string;
  flagAccent: string;
}): string =>
  [t.flagPrimary, t.flagSecondary, t.flagAccent].find((c) => !isLightHex(c)) ??
  t.flagPrimary;

const TEAM_COLORS: Record<"home" | "away", string> = {
  home: teamUiColor(DEFAULT_HOME),
  away: teamUiColor(DEFAULT_AWAY),
};

const GoalEditor: React.FC<{
  goals: LabGoal[];
  selectedId: string | null;
  onSelect: (g: LabGoal) => void;
  onAddHome: () => void;
  onAddAway: () => void;
  onUpdate: (id: string, patch: Partial<LabGoal>) => void;
  onDelete: (id: string) => void;
  importanceById: Map<string, number>;
}> = ({ goals, selectedId, onSelect, onAddHome, onAddAway, onUpdate, onDelete, importanceById }) => {
  return (
    <div style={ui.section}>
      <div style={ui.sectionHead as React.CSSProperties}>
        <span>Goals ({goals.length})</span>
        <span style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={onAddHome}
            style={{ ...ui.smallBtn, background: TEAM_COLORS.home, color: "#fff" }}
          >
            + Home
          </button>
          <button
            type="button"
            onClick={onAddAway}
            style={{ ...ui.smallBtn, background: TEAM_COLORS.away, color: "#fff" }}
          >
            + Away
          </button>
        </span>
      </div>
      <div style={ui.goalList}>
        {goals.length === 0 && (
          <div style={ui.goalListEmpty}>No goals yet — add one above.</div>
        )}
        {goals.map((g) => {
          const isSelected = g.id === selectedId;
          return (
            <div
              key={g.id}
              onClick={() => onSelect(g)}
              style={{
                ...ui.goalRow,
                borderColor: isSelected ? "#0E0E0E" : "#ECECEC",
                background: isSelected ? "#FAFAFA" : "#FFFFFF",
              }}
            >
              <span
                style={{
                  ...ui.teamChip,
                  background: TEAM_COLORS[g.team],
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate(g.id, { team: g.team === "home" ? "away" : "home" });
                }}
                title="Click to swap team"
              >
                {g.team === "home" ? "H" : "A"}
              </span>
              <input
                type="number"
                min={0}
                max={120}
                value={g.minute}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) =>
                  onUpdate(g.id, {
                    minute: Math.max(0, Math.min(120, parseInt(e.target.value, 10) || 0)),
                  })
                }
                style={ui.minuteInput}
              />
              <span style={ui.minuteSuffix}>&apos;</span>
              <input
                type="text"
                value={g.scorer}
                placeholder="Scorer"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onUpdate(g.id, { scorer: e.target.value })}
                style={ui.scorerInput}
              />
              <ImportancePill
                value={importanceById.get(g.id) ?? 0}
                team={g.team}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(g.id);
                }}
                style={ui.deleteX}
                title="Delete goal"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Primitives ─────────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => {
  const [open, setOpen] = useState(true);
  return (
    <div style={ui.section}>
      <button onClick={() => setOpen((o) => !o)} style={ui.sectionHead}>
        <span>{title}</span>
        <span
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 120ms ease",
            opacity: 0.6,
            fontSize: 11,
          }}
        >
          ▾
        </span>
      </button>
      {open && <div style={ui.sectionBody}>{children}</div>}
    </div>
  );
};

const Slider: React.FC<{
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  // When set on a signed range (e.g. -100..100), the filled bar grows
  // from the visual zero in the middle outward, so negative values
  // read as a left-pointing fill.
  signed?: boolean;
  track?: boolean;
}> = ({
  label,
  min,
  max,
  step,
  value,
  onChange,
  format,
  signed,
  track = true,
}) => {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const display = format ? format(value) : String(Math.round(value));
  // Signed bar geometry: zero anchor is wherever 0 falls in the range
  // (typically 50% for symmetric -N..N ranges).
  const zeroPct = Math.max(0, Math.min(1, (0 - min) / (max - min)));
  const signedLeft = Math.min(pct, zeroPct);
  const signedWidth = Math.abs(pct - zeroPct);
  return (
    <label style={ui.row}>
      <span style={ui.rowLabel}>{label}</span>
      <span style={ui.barShell}>
        {track && !signed && (
          <span style={{ ...ui.barFill, width: `${pct * 100}%` }} />
        )}
        {track && signed && (
          <>
            {/* zero tick — faint vertical line marking the midpoint */}
            <span
              style={{
                position: "absolute",
                top: 4,
                bottom: 4,
                left: `${zeroPct * 100}%`,
                width: 1,
                background: "rgba(0,0,0,0.15)",
              }}
            />
            <span
              style={{
                ...ui.barFill,
                left: `${signedLeft * 100}%`,
                width: `${signedWidth * 100}%`,
              }}
            />
          </>
        )}
        <span
          style={{
            ...ui.barValue,
            color:
              track && !signed && pct > 0.5
                ? "#fff"
                : track && signed && signedWidth > 0.18
                  ? "#fff"
                  : "#0e0e0e",
            left: track ? `calc(${pct * 100}% - 30px)` : "50%",
            transform: track ? "none" : "translateX(-50%)",
          }}
        >
          {display}
        </span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={ui.rangeInput}
        />
      </span>
    </label>
  );
};

const ShuffleSeedButton: React.FC<{ onShuffle: () => void }> = ({
  onShuffle,
}) => (
  <button type="button" onClick={onShuffle} style={ui.shuffleBtn}>
    Shuffle Distribution Seed
  </button>
);

const Dropdown: React.FC<{
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
  <label style={ui.row}>
    <span style={ui.rowLabel}>{label}</span>
    <span style={ui.dropdownShell}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={ui.select}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <span style={ui.dropdownChevron}>▾</span>
    </span>
  </label>
);

const ui: Record<string, React.CSSProperties> = {
  shell: {
    display: "grid",
    gridTemplateColumns: "360px 1fr",
    height: "100%",
    background: "#FAFAFA",
    color: "#0e0e0e",
  },
  panel: {
    overflow: "auto",
    background: "#FFFFFF",
    borderRight: "1px solid #ECECEC",
    padding: "16px 18px 60px",
  },
  section: {
    border: "1px solid #ECECEC",
    borderRadius: 10,
    background: "#FFFFFF",
    boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
    marginBottom: 14,
    overflow: "hidden",
  },
  sectionHead: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.01em",
    color: "#0e0e0e",
  },
  sectionBody: {
    padding: "4px 16px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    borderTop: "1px solid #F2F2F2",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "130px 1fr",
    alignItems: "center",
    gap: 12,
  },
  rowLabel: {
    fontSize: 12,
    opacity: 0.78,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  barShell: {
    position: "relative",
    height: 28,
    background: "#F1F1F1",
    borderRadius: 999,
    overflow: "hidden",
    display: "block",
  },
  barFill: {
    position: "absolute",
    inset: "0 auto 0 0",
    background: "#0E0E0E",
    borderRadius: 999,
    transition: "width 60ms linear",
  },
  barValue: {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: 12,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    pointerEvents: "none",
    padding: "0 8px",
    minWidth: 24,
    textAlign: "right",
  },
  rangeInput: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    opacity: 0,
    cursor: "ew-resize",
    margin: 0,
  },
  dropdownShell: {
    position: "relative",
    height: 28,
    background: "#FFFFFF",
    border: "1px solid #E4E4E4",
    borderRadius: 8,
    display: "block",
  },
  select: {
    appearance: "none",
    WebkitAppearance: "none",
    width: "100%",
    height: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    padding: "0 28px 0 12px",
    fontSize: 12,
    fontWeight: 500,
    color: "#0e0e0e",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  dropdownChevron: {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: 10,
    opacity: 0.55,
    pointerEvents: "none",
  },
  stage: {
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    background: "#FAFAFA",
  },
  stageHead: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    padding: "14px 24px",
    borderBottom: "1px solid #ECECEC",
    background: "#FFFFFF",
  },
  playerWrap: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loading: {
    padding: "12px 18px",
    fontSize: 13,
    background: "#FFFFFF",
    border: "1px solid #ECECEC",
    borderRadius: 6,
    color: "#5a5a5a",
  },
  errorBox: {
    padding: 16,
    fontSize: 12,
    background: "#FFF1F0",
    color: "#B00020",
    border: "1px solid #FBD3CF",
    borderRadius: 6,
    whiteSpace: "pre-wrap",
    maxHeight: "70vh",
    overflow: "auto",
    fontFamily: "ui-monospace, SFMono-Regular, monospace",
  },
  noSelection: {
    margin: "0 0 14px 0",
    padding: "10px 14px",
    fontSize: 12,
    color: "#7a7a7a",
    background: "#FFFFFF",
    border: "1px dashed #DDDDDD",
    borderRadius: 8,
    textAlign: "center" as const,
  },
  goalList: {
    padding: "8px 12px 12px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    borderTop: "1px solid #F2F2F2",
  },
  goalListEmpty: {
    padding: "12px 6px",
    fontSize: 12,
    color: "#9a9a9a",
    textAlign: "center" as const,
  },
  goalRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 8px",
    border: "1px solid #ECECEC",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 12,
    transition: "background 80ms ease, border-color 80ms ease",
  },
  teamChip: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
    borderRadius: 6,
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
  },
  minuteInput: {
    width: 42,
    padding: "4px 6px",
    fontSize: 12,
    border: "1px solid #E4E4E4",
    borderRadius: 6,
    fontVariantNumeric: "tabular-nums" as const,
    textAlign: "right" as const,
    background: "#FFFFFF",
    color: "#0e0e0e",
    fontFamily: "inherit",
  },
  minuteSuffix: {
    fontSize: 11,
    opacity: 0.55,
    marginLeft: -4,
  },
  scorerInput: {
    flex: 1,
    minWidth: 0,
    padding: "4px 8px",
    fontSize: 12,
    border: "1px solid #E4E4E4",
    borderRadius: 6,
    background: "#FFFFFF",
    color: "#0e0e0e",
    fontFamily: "inherit",
  },
  recipeTag: {
    fontSize: 10,
    opacity: 0.6,
    fontFamily: "ui-monospace, SFMono-Regular, monospace",
    maxWidth: 110,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  },
  deleteX: {
    width: 22,
    height: 22,
    border: "none",
    background: "transparent",
    color: "#9a9a9a",
    fontSize: 16,
    cursor: "pointer",
    borderRadius: 4,
    lineHeight: "20px",
    padding: 0,
    flexShrink: 0,
  },
  smallBtn: {
    border: "none",
    fontSize: 11,
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  miniMapWrap: {
    marginTop: 12,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 6,
  },
  miniMapSvg: {
    background: "#FFFFFF",
    border: "1px solid #ECECEC",
    borderRadius: 8,
    display: "block",
  },
  miniMapHint: {
    fontSize: 10,
    color: "#9a9a9a",
    textAlign: "center" as const,
    lineHeight: 1.4,
  },
  viewToggle: {
    display: "inline-flex",
    background: "#F1F1F1",
    borderRadius: 999,
    padding: 2,
    gap: 2,
  },
  viewToggleBtn: {
    fontSize: 11,
    fontWeight: 600,
    padding: "4px 12px",
    border: "none",
    borderRadius: 999,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 100ms ease, color 100ms ease",
  },
  shuffleBtn: {
    width: "100%",
    padding: "9px 12px",
    fontSize: 12,
    fontWeight: 600,
    background: "#F1F1F1",
    color: "#0E0E0E",
    border: "none",
    borderRadius: 999,
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "0.01em",
  },
};
