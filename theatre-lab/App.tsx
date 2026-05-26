import React from "react";
import { sheet, slots, stageObj, studio, PROJECT_ID } from "./theatre";
import { Shape } from "./Shape";
import type { ISheetObject } from "@theatre/core";

const CANVAS = 1080;

const useTheatreValue = <T,>(obj: ISheetObject<T>): T => {
  const [v, setV] = React.useState(obj.value);
  React.useEffect(() => obj.onValuesChange((n) => setV(n)), [obj]);
  return v;
};

const rgba = (c: { r: number; g: number; b: number; a: number }) =>
  `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${c.a})`;

const Topbar: React.FC<{
  position: number;
  duration: number;
  setDuration: (d: number) => void;
  loop: boolean;
  setLoop: (b: boolean) => void;
}> = ({ position, duration, setDuration, loop, setLoop }) => {
  const [playing, setPlaying] = React.useState(false);

  const play = () => {
    setPlaying(true);
    sheet.sequence
      .play({
        iterationCount: loop ? Infinity : 1,
        range: [0, duration],
      })
      .then(() => setPlaying(false));
  };
  const pause = () => {
    sheet.sequence.pause();
    setPlaying(false);
  };
  const rewind = () => {
    sheet.sequence.position = 0;
  };
  const exportState = async () => {
    const state = studio.createContentOfSaveFile(PROJECT_ID);
    const txt = JSON.stringify(state, null, 2);
    await navigator.clipboard.writeText(txt);
    alert("Theatre state JSON copied to clipboard.");
  };

  return (
    <div style={topbar}>
      <strong style={{ fontSize: 14, letterSpacing: "0.08em" }}>
        THEATRE LAB
      </strong>
      <span style={{ width: 1, height: 18, background: "#333", marginInline: 4 }} />
      <button onClick={playing ? pause : play} style={btn}>
        {playing ? "Pause" : "Play"}
      </button>
      <button onClick={rewind} style={btn}>
        Rewind
      </button>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, opacity: 0.85 }}>
        <input
          type="checkbox"
          checked={loop}
          onChange={(e) => setLoop(e.target.checked)}
        />
        Loop
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, opacity: 0.85 }}>
        Duration
        <input
          type="number"
          min={1}
          max={120}
          step={1}
          value={duration}
          onChange={(e) => setDuration(Math.max(1, parseFloat(e.target.value) || 1))}
          style={{
            width: 60,
            background: "#1a1a1c",
            color: "#fff",
            border: "1px solid #333",
            padding: "3px 6px",
            borderRadius: 3,
            fontSize: 12,
          }}
        />
        s
      </label>
      <span style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.7 }}>
        t = {position.toFixed(2)}s / {duration}s
      </span>
      <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.55, maxWidth: 460 }}>
        Right-click any prop in the Theatre Studio panel below → "Sequence this prop" → scrub to a time → click the diamond to add a keyframe.
      </span>
      <button onClick={exportState} style={btnPrimary}>
        Export state JSON
      </button>
    </div>
  );
};

const topbar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "10px 16px",
  background: "#16161a",
  borderBottom: "1px solid #2a2a2e",
  flexShrink: 0,
};

const btn: React.CSSProperties = {
  padding: "6px 14px",
  fontSize: 12,
  border: "1px solid #3a3a3f",
  background: "#22232a",
  color: "#e8e6e1",
  cursor: "pointer",
  borderRadius: 3,
};
const btnPrimary: React.CSSProperties = {
  ...btn,
  background: "#e8e6e1",
  color: "#16161a",
  border: "1px solid #e8e6e1",
  fontWeight: 600,
};

const Stage: React.FC = () => {
  const s = useTheatreValue(stageObj);
  const bg = rgba(s.backdrop);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        minHeight: 0,
        background: "#0d0d0e",
      }}
    >
      <svg
        viewBox={`0 0 ${CANVAS} ${CANVAS}`}
        style={{
          aspectRatio: "1 / 1",
          height: "min(100%, calc(100vw - 320px))",
          maxHeight: "calc(100vh - 240px)",
          background: bg,
          borderRadius: 6,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px #2a2a2e",
        }}
      >
        <g transform={`translate(${s.pan} 0) scale(${s.zoom})`}>
          {slots.map((slot, i) => (
            <Shape key={i} obj={slot} />
          ))}
        </g>
      </svg>
    </div>
  );
};

export const App: React.FC = () => {
  const [position, setPosition] = React.useState(0);
  const [duration, setDuration] = React.useState(6);
  const [loop, setLoop] = React.useState(false);

  // Continuous read of the timeline position for the readout.
  React.useEffect(() => {
    let raf = 0;
    const tick = () => {
      setPosition(sheet.sequence.position);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar
        position={position}
        duration={duration}
        setDuration={setDuration}
        loop={loop}
        setLoop={setLoop}
      />
      <Stage />
    </div>
  );
};
