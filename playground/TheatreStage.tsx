import React from "react";
import { getProject, types } from "@theatre/core";
import type { ISheet, ISheetObject } from "@theatre/core";
import studio from "@theatre/studio";

// Theatre.js authoring stage. Theatre owns the clock — its sequence is
// the source of truth and the SVG re-renders whenever any sheet-object
// value changes. There is no Remotion frame here. When the animation
// looks right, click "Export state" to copy a JSON blob that can be
// fed back into a Remotion composition via getProject(id, { state }).

// Initialise Studio once at module load (idempotent).
let studioStarted = false;
const ensureStudio = () => {
  if (studioStarted) return;
  studioStarted = true;
  studio.initialize();
};

const PROJECT_ID = "match-card-stage";

const project = getProject(PROJECT_ID);
const sheet: ISheet = project.sheet("WedgeBurst");

// One sheet object per animated "track". Every prop here is sequence-able
// out of the box — right-click the prop in the Studio panel and choose
// "Sequence this prop" to start keyframing.
const burst = sheet.object("Burst", {
  reachMul: types.number(0, { range: [0, 2] }),
  thicknessMul: types.number(1, { range: [0.1, 4] }),
  focalDX: types.number(0, { range: [-400, 400] }),
  focalDY: types.number(0, { range: [-600, 600] }),
  rotation: types.number(0, { range: [-Math.PI, Math.PI] }),
  wedgeCount: types.number(40, { range: [4, 120] }),
  whiteAlpha: types.number(0, { range: [0, 1] }),
});

const teams = sheet.object("Teams", {
  homeScore: types.number(0, { range: [0, 9] }),
  awayScore: types.number(0, { range: [0, 9] }),
});

const SCORING_TEAM_PALETTE = [
  "#009C3B", // Brazil green
  "#FFDF00", // Brazil yellow
  "#002776", // Brazil blue
];

// 9:16 canvas — matches Remotion's CANVAS_W/CANVAS_H.
const CANVAS_W = 1080;
const CANVAS_H = 2340;
const PANEL_LEFT = 60;
const PANEL_TOP = 380;
const PANEL_RIGHT = 1020;
const PANEL_BOTTOM = 1980;
const PANEL_W = PANEL_RIGHT - PANEL_LEFT;
const PANEL_H = PANEL_BOTTOM - PANEL_TOP;
const cx = (PANEL_LEFT + PANEL_RIGHT) / 2;
const midY = (PANEL_TOP + PANEL_BOTTOM) / 2;

// Custom hook — subscribes to a Theatre sheet object and returns its
// current value, re-rendering on every change.
const useTheatreValue = <T,>(obj: ISheetObject<T>): T => {
  const [val, setVal] = React.useState(obj.value);
  React.useEffect(() => obj.onValuesChange((v) => setVal(v)), [obj]);
  return val;
};

const TimelineControls: React.FC = () => {
  const [playing, setPlaying] = React.useState(false);
  const [position, setPosition] = React.useState(0);

  React.useEffect(() => {
    let raf = 0;
    const tick = () => {
      setPosition(sheet.sequence.position);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const play = () => {
    setPlaying(true);
    sheet.sequence.play({ iterationCount: 1, range: [0, 10] }).then(() => {
      setPlaying(false);
    });
  };
  const pause = () => {
    sheet.sequence.pause();
    setPlaying(false);
  };
  const rewind = () => {
    sheet.sequence.position = 0;
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        background: "#FFFFFF",
        borderBottom: "1px solid #e2dfd7",
      }}
    >
      <button onClick={playing ? pause : play} style={btnStyle}>
        {playing ? "Pause" : "Play"}
      </button>
      <button onClick={rewind} style={btnStyle}>
        Rewind
      </button>
      <span style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.7 }}>
        t = {position.toFixed(2)}s
      </span>
      <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.6 }}>
        Right-click any prop in the Theatre panel below → "Sequence this prop"
        → scrub the timeline → click the diamond to add a keyframe.
      </span>
      <button
        onClick={async () => {
          const state = studio.createContentOfSaveFile(PROJECT_ID);
          const txt = JSON.stringify(state, null, 2);
          await navigator.clipboard.writeText(txt);
          alert("Theatre state JSON copied to clipboard. Save it as src/lib/theatreState.json.");
        }}
        style={btnPrimary}
      >
        Export state
      </button>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  padding: "6px 14px",
  fontSize: 13,
  border: "1px solid #0e0e0e",
  background: "#FFFFFF",
  cursor: "pointer",
  borderRadius: 4,
};
const btnPrimary: React.CSSProperties = {
  ...btnStyle,
  background: "#0e0e0e",
  color: "#FFFFFF",
};

const Stage: React.FC = () => {
  const b = useTheatreValue(burst);
  const t = useTheatreValue(teams);

  const focalX = cx + b.focalDX;
  const focalY = midY + b.focalDY;
  const maxReach = Math.hypot(PANEL_W, PANEL_H) * 0.55 * b.reachMul;
  const count = Math.max(1, Math.floor(b.wedgeCount));

  const wedges: React.ReactNode[] = [];
  for (let w = 0; w < count; w++) {
    const r1 = (Math.sin(w * 12.9898) + 1) / 2;
    const r2 = (Math.sin(w * 78.233) + 1) / 2;
    const r3 = (Math.sin(w * 39.41) + 1) / 2;
    const angle = r1 * Math.PI * 2 + b.rotation;
    const len = (0.3 + r2 * 0.5) * maxReach;
    const baseAngle = (0.012 + r3 * 0.028) * b.thicknessMul;
    const a0 = angle - baseAngle / 2;
    const a1 = angle + baseAngle / 2;
    const color = SCORING_TEAM_PALETTE[w % SCORING_TEAM_PALETTE.length]!;
    wedges.push(
      <polygon
        key={w}
        points={`${focalX.toFixed(1)},${focalY.toFixed(1)} ${(focalX + Math.cos(a0) * len).toFixed(1)},${(focalY + Math.sin(a0) * len).toFixed(1)} ${(focalX + Math.cos(a1) * len).toFixed(1)},${(focalY + Math.sin(a1) * len).toFixed(1)}`}
        fill={color}
      />,
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#101010",
        padding: 24,
        minHeight: 0,
      }}
    >
      <svg
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        style={{
          height: "100%",
          maxHeight: "calc(100vh - 240px)",
          aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
          background: "#F1EEE7",
          borderRadius: 6,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        {/* Panel chrome — minimal stand-in for BaseLayout. */}
        <rect
          x={PANEL_LEFT}
          y={PANEL_TOP}
          width={PANEL_W}
          height={PANEL_H}
          fill="#FFFFFF"
          stroke="#0e0e0e"
          strokeWidth={6}
        />
        <defs>
          <clipPath id="stage-clip">
            <rect
              x={PANEL_LEFT}
              y={PANEL_TOP}
              width={PANEL_W}
              height={PANEL_H}
            />
          </clipPath>
        </defs>
        <g clipPath="url(#stage-clip)">
          {b.whiteAlpha > 0 && (
            <rect
              x={PANEL_LEFT}
              y={PANEL_TOP}
              width={PANEL_W}
              height={PANEL_H}
              fill="#FFFFFF"
              opacity={b.whiteAlpha}
            />
          )}
          {wedges}
        </g>
        {/* Score numerals — static text using the team palette. */}
        <text
          x={cx}
          y={(PANEL_TOP + midY) / 2 + 80}
          fontSize={260}
          fontWeight={900}
          textAnchor="middle"
          fill="#D5311E"
          fontFamily="Helvetica, Arial, sans-serif"
        >
          {Math.floor(t.homeScore)}
        </text>
        <text
          x={cx}
          y={(midY + PANEL_BOTTOM) / 2 + 80}
          fontSize={260}
          fontWeight={900}
          textAnchor="middle"
          fill="#009C3B"
          fontFamily="Helvetica, Arial, sans-serif"
        >
          {Math.floor(t.awayScore)}
        </text>
      </svg>
    </div>
  );
};

export const TheatreStage: React.FC = () => {
  React.useEffect(() => {
    ensureStudio();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TimelineControls />
      <Stage />
    </div>
  );
};
