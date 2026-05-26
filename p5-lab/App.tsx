import React from "react";
import p5 from "p5";
import { SKETCHES, type Sketch, type Controls, type ControlValues, valuesOf } from "./sketches";
import { MatchCardFrame } from "./MatchCardFrame";
import { SandboxedSketchHost } from "./SandboxedSketchHost";
import { Chat } from "./Chat";
import {
  loadUserSketches,
  addUserSketch,
  removeUserSketch,
  type UserSketch,
} from "./userSketches";

// ── Built-in sketch host (p5 in main thread) ─────────────────────────────

const SketchHost: React.FC<{
  sketch: Sketch;
  controls: Controls;
  preview: boolean;
}> = ({ sketch, controls, preview }) => {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const valuesRef = React.useRef<ControlValues>(valuesOf(controls));

  React.useEffect(() => {
    valuesRef.current = valuesOf(controls);
  }, [controls]);

  React.useEffect(() => {
    if (!hostRef.current) return;
    const sketchFn = sketch.factory(() => valuesRef.current);
    const instance = new p5(sketchFn, hostRef.current);
    const applyCanvasFit = () => {
      const canvas = hostRef.current?.querySelector("canvas");
      if (canvas) {
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.objectFit = "fill";
        canvas.style.display = "block";
      }
    };
    applyCanvasFit();
    const id = window.setTimeout(applyCanvasFit, 0);
    return () => {
      window.clearTimeout(id);
      instance.remove();
    };
  }, [sketch]);

  return (
    <div
      ref={hostRef}
      style={preview ? hostPreview : hostStandalone}
    />
  );
};

const hostPreview: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};
const hostStandalone: React.CSSProperties = {
  aspectRatio: "1 / 1",
  height: "min(100%, calc(100vh - 200px))",
  background: "#0d0d0e",
  boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px #2a2a2e",
  borderRadius: 6,
  overflow: "hidden",
};

// ── Inspector + controls ─────────────────────────────────────────────────

const Inspector: React.FC<{
  name: string;
  description: string;
  controls: Controls;
  setControls: (c: Controls) => void;
  resetControls: () => void;
  isUserSketch: boolean;
  onDelete?: () => void;
}> = ({ name, description, controls, setControls, resetControls, isUserSketch, onDelete }) => {
  const update = (key: string, value: number | string | boolean) => {
    const spec = controls[key]!;
    setControls({ ...controls, [key]: { ...spec, value } as typeof spec });
  };

  return (
    <div style={inspectorBody}>
      <div style={{ padding: "16px 18px", borderBottom: "1px solid #2a2a2e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{name}</div>
          {isUserSketch && (
            <span
              style={{
                fontSize: 10,
                background: "#2a4d9b",
                color: "#fff",
                padding: "2px 6px",
                borderRadius: 2,
                letterSpacing: "0.08em",
              }}
            >
              AI
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, opacity: 0.6, lineHeight: 1.45, marginTop: 4 }}>
          {description}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
          <button onClick={resetControls} style={{ ...btn, flex: 1 }}>
            Reset
          </button>
          {isUserSketch && onDelete && (
            <button onClick={onDelete} style={{ ...btn, color: "#ff8a80" }}>
              Delete
            </button>
          )}
        </div>
      </div>
      <div style={{ padding: "8px 18px 24px", overflow: "auto" }}>
        {Object.entries(controls).map(([key, spec]) => (
          <div key={key} style={{ marginTop: 14 }}>
            <label style={{ fontSize: 11, opacity: 0.65, display: "block", marginBottom: 6 }}>
              {spec.label}
            </label>
            {spec.kind === "number" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="range"
                  min={spec.min}
                  max={spec.max}
                  step={spec.step}
                  value={spec.value}
                  onChange={(e) => update(key, parseFloat(e.target.value))}
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  min={spec.min}
                  max={spec.max}
                  step={spec.step}
                  value={spec.value}
                  onChange={(e) => update(key, parseFloat(e.target.value) || 0)}
                  style={numInput}
                />
              </div>
            )}
            {spec.kind === "color" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="color"
                  value={spec.value}
                  onChange={(e) => update(key, e.target.value)}
                  style={{ width: 36, height: 28, padding: 0, background: "transparent", border: "1px solid #333", borderRadius: 3 }}
                />
                <input
                  type="text"
                  value={spec.value}
                  onChange={(e) => update(key, e.target.value)}
                  style={{ ...numInput, width: 90 }}
                />
              </div>
            )}
            {spec.kind === "toggle" && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={spec.value}
                  onChange={(e) => update(key, e.target.checked)}
                />
                {spec.value ? "On" : "Off"}
              </label>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Topbar ───────────────────────────────────────────────────────────────

const Topbar: React.FC<{
  sketchId: string;
  setSketchId: (id: string) => void;
  builtIns: Sketch[];
  userSketches: UserSketch[];
  preview: boolean;
  setPreview: (b: boolean) => void;
  onSavePng: () => void;
  onExportControls: () => void;
}> = ({ sketchId, setSketchId, builtIns, userSketches, preview, setPreview, onSavePng, onExportControls }) => (
  <div style={topbar}>
    <strong style={{ fontSize: 14, letterSpacing: "0.08em" }}>P5 LAB</strong>
    <span style={{ width: 1, height: 18, background: "#333", marginInline: 4 }} />
    <select
      value={sketchId}
      onChange={(e) => setSketchId(e.target.value)}
      style={topSelect}
    >
      <optgroup label="Built-in">
        {builtIns.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </optgroup>
      {userSketches.length > 0 && (
        <optgroup label="AI generated">
          {userSketches.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
    <label style={previewToggle(preview)}>
      <input
        type="checkbox"
        checked={preview}
        onChange={(e) => setPreview(e.target.checked)}
      />
      Match-card preview
    </label>
    <button onClick={onSavePng} style={btn}>Save PNG</button>
    <button onClick={onExportControls} style={btnPrimary}>Copy controls JSON</button>
    <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.55 }}>
      p5.js · live params · AI sandboxed in iframe
    </span>
  </div>
);

const topbar: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 12,
  padding: "10px 16px", background: "#16161a", borderBottom: "1px solid #2a2a2e",
  flexShrink: 0,
};
const topSelect: React.CSSProperties = {
  background: "#1a1a1c", color: "#fff", border: "1px solid #333",
  padding: "5px 8px", borderRadius: 3, fontSize: 13, minWidth: 200,
};
const previewToggle = (on: boolean): React.CSSProperties => ({
  display: "flex", alignItems: "center", gap: 6, fontSize: 12, opacity: 0.85,
  padding: "5px 10px", background: on ? "#22232a" : "transparent",
  border: "1px solid #3a3a3f", borderRadius: 3, cursor: "pointer",
});

const btn: React.CSSProperties = {
  padding: "6px 14px", fontSize: 12, border: "1px solid #3a3a3f",
  background: "#22232a", color: "#e8e6e1", cursor: "pointer", borderRadius: 3,
};
const btnPrimary: React.CSSProperties = {
  ...btn, background: "#e8e6e1", color: "#16161a",
  border: "1px solid #e8e6e1", fontWeight: 600,
};
const numInput: React.CSSProperties = {
  width: 64, background: "#1a1a1c", color: "#fff", border: "1px solid #333",
  padding: "3px 6px", borderRadius: 3, fontSize: 12,
};
const inspectorBody: React.CSSProperties = {
  display: "flex", flexDirection: "column", height: "100%", overflow: "hidden",
};

// ── Right panel with tabs: Controls / AI Chat ───────────────────────────

const RightPanel: React.FC<{
  tab: "controls" | "chat";
  setTab: (t: "controls" | "chat") => void;
  controlsNode: React.ReactNode;
  chatNode: React.ReactNode;
}> = ({ tab, setTab, controlsNode, chatNode }) => (
  <aside style={rightPanel}>
    <div style={tabBar}>
      <button
        onClick={() => setTab("controls")}
        style={tabBtn(tab === "controls")}
      >
        Controls
      </button>
      <button
        onClick={() => setTab("chat")}
        style={tabBtn(tab === "chat")}
      >
        AI Chat
      </button>
    </div>
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ display: tab === "controls" ? "flex" : "none", flex: 1, minHeight: 0, flexDirection: "column" }}>
        {controlsNode}
      </div>
      <div style={{ display: tab === "chat" ? "flex" : "none", flex: 1, minHeight: 0, flexDirection: "column" }}>
        {chatNode}
      </div>
    </div>
  </aside>
);

const rightPanel: React.CSSProperties = {
  width: 360, borderLeft: "1px solid #2a2a2e", background: "#13131a",
  display: "flex", flexDirection: "column", flexShrink: 0,
};
const tabBar: React.CSSProperties = {
  display: "flex", borderBottom: "1px solid #2a2a2e", flexShrink: 0,
};
const tabBtn = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: "10px 14px", fontSize: 12, fontWeight: 600,
  letterSpacing: "0.08em", textTransform: "uppercase",
  background: active ? "#0d0d0e" : "transparent",
  color: active ? "#e8e6e1" : "#888",
  border: "none", cursor: "pointer",
  borderBottom: active ? "2px solid #e8e6e1" : "2px solid transparent",
});

// ── App ──────────────────────────────────────────────────────────────────

export const App: React.FC = () => {
  const [userSketches, setUserSketches] = React.useState<UserSketch[]>(() =>
    loadUserSketches(),
  );
  const [sketchId, setSketchId] = React.useState<string>(SKETCHES[0]!.id);
  const [preview, setPreview] = React.useState(true);
  const [tab, setTab] = React.useState<"controls" | "chat">("controls");

  // Resolve active sketch (built-in or AI). Fall back to first built-in.
  const activeBuiltIn = SKETCHES.find((s) => s.id === sketchId);
  const activeUser = userSketches.find((s) => s.id === sketchId);
  const isUser = !!activeUser;
  const active = activeBuiltIn ?? activeUser ?? SKETCHES[0]!;

  // Controls live in state so slider drags re-render. Keyed by sketchId
  // so switching sketches resets to that sketch's defaults.
  const [controls, setControls] = React.useState<Controls>(active.controls);
  React.useEffect(() => {
    setControls(active.controls);
  }, [sketchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const onNewSketch = (s: UserSketch) => {
    setUserSketches(addUserSketch(s));
    setSketchId(s.id);
    setTab("controls");
  };

  const onDeleteActive = () => {
    if (!activeUser) return;
    const next = removeUserSketch(activeUser.id);
    setUserSketches(next);
    setSketchId(SKETCHES[0]!.id);
  };

  const resetControls = () => setControls({ ...active.controls });

  const onSavePng = () => {
    const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${active.id}-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const onExportControls = async () => {
    const out: Record<string, number | string | boolean> = {};
    for (const k of Object.keys(controls)) out[k] = controls[k]!.value;
    await navigator.clipboard.writeText(JSON.stringify(out, null, 2));
    alert("Copied controls JSON to clipboard.");
  };

  const sketchNode = isUser ? (
    <SandboxedSketchHost
      key={activeUser!.id}
      factoryCode={activeUser!.factoryCode}
      controls={controls}
      preview={preview}
    />
  ) : (
    <SketchHost sketch={activeBuiltIn ?? SKETCHES[0]!} controls={controls} preview={preview} />
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar
        sketchId={sketchId}
        setSketchId={setSketchId}
        builtIns={SKETCHES}
        userSketches={userSketches}
        preview={preview}
        setPreview={setPreview}
        onSavePng={onSavePng}
        onExportControls={onExportControls}
      />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div style={canvasArea}>
          {preview ? (
            <MatchCardFrame>{sketchNode}</MatchCardFrame>
          ) : (
            sketchNode
          )}
        </div>
        <RightPanel
          tab={tab}
          setTab={setTab}
          controlsNode={
            <Inspector
              name={active.name}
              description={active.description}
              controls={controls}
              setControls={setControls}
              resetControls={resetControls}
              isUserSketch={isUser}
              onDelete={onDeleteActive}
            />
          }
          chatNode={<Chat onNewSketch={onNewSketch} />}
        />
      </div>
    </div>
  );
};

const canvasArea: React.CSSProperties = {
  flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
  padding: 24, minHeight: 0, background: "#0d0d0e",
};
