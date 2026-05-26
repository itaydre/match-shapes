import React, { useState } from "react";

// ─────────────────────────────────────────────────────────────────────
// Stub Gallery — temporarily replaced with a manual loader so we can
// isolate whether the Player imports are what's blanking the page.
// Click "Load Player" to dynamically import @remotion/player at
// click-time (not module-load-time). If the page renders fine but
// clicking the button throws, the error overlay will show exactly
// what's wrong.
// ─────────────────────────────────────────────────────────────────────

export const Gallery: React.FC = () => {
  const [status, setStatus] = useState("idle");
  const [PlayerCmp, setPlayerCmp] = useState<React.ComponentType<any> | null>(
    null,
  );
  const [Compo, setCompo] = useState<React.ComponentType<any> | null>(null);
  const [props, setProps] = useState<any>(null);

  const load = async () => {
    setStatus("importing @remotion/player…");
    try {
      const { Player } = await import("@remotion/player");
      setStatus("importing GridMatchCardShardsPlus…");
      const mod = await import("../src/GridMatchCardShardsPlus");
      setStatus("importing possession util…");
      const possession = await import("../src/lib/possession");
      setStatus("ready");
      setPlayerCmp(() => Player as any);
      setCompo(() => mod.GridMatchCardShardsPlus as any);
      setProps({
        home: {
          name: "England",
          flagPrimary: "#D5311E",
          flagSecondary: "#FFFFFF",
          flagAccent: "#D5311E",
        },
        away: {
          name: "Brazil",
          flagPrimary: "#009C3B",
          flagSecondary: "#FFDF00",
          flagAccent: "#002776",
        },
        competition: "FIFA WORLD CUP 2026",
        venue: "LEVI'S STADIUM",
        date: "30.6.2026",
        goals: [
          { team: "home", minute: 14, style: 0, cell: 7 },
          { team: "home", minute: 28, style: 1, cell: 14 },
          { team: "away", minute: 47, style: 2, cell: 12 },
          { team: "away", minute: 68, style: 3, cell: 6 },
          { team: "home", minute: 88, style: 4, cell: 9 },
        ],
        possessionTimeline: possession.buildDefaultTimeline(0.5, 0),
        emotion: 0.7,
        clash: 0.5,
        shotDensity: 0,
        glitch: 0.45,
        showGrid: false,
        showShots: false,
      });
    } catch (e) {
      setStatus(`FAILED: ${(e as Error).message}\n${(e as Error).stack ?? ""}`);
      // eslint-disable-next-line no-console
      console.error(e);
    }
  };

  return (
    <div
      style={{
        padding: 24,
        height: "100%",
        boxSizing: "border-box",
        overflow: "auto",
        background: "#F1EEE7",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Compositions Gallery (debug mode)</h2>
      <p style={{ fontSize: 13, color: "#444" }}>
        If you can read this, the playground app itself is fine. Click the
        button below to dynamically import the Remotion composition and the
        Player — any error during import will be displayed.
      </p>
      <button
        onClick={load}
        style={{
          padding: "10px 18px",
          fontSize: 14,
          background: "#0e0e0e",
          color: "#fff",
          border: 0,
          borderRadius: 4,
          cursor: "pointer",
        }}
      >
        Load Player
      </button>
      <pre
        style={{
          marginTop: 16,
          padding: 12,
          background: "#FFFFFF",
          border: "1px solid #ddd",
          borderRadius: 4,
          fontSize: 12,
          whiteSpace: "pre-wrap",
          maxHeight: 240,
          overflow: "auto",
        }}
      >
        status: {status}
      </pre>
      {PlayerCmp && Compo && props && (
        <div
          style={{
            marginTop: 24,
            width: 270,
            height: 480,
            background: "#000",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <PlayerCmp
            component={Compo}
            durationInFrames={270}
            compositionWidth={1080}
            compositionHeight={2340}
            fps={30}
            style={{ width: 270, height: 480 }}
            inputProps={props}
            autoPlay
            loop
            controls={false}
          />
        </div>
      )}
    </div>
  );
};
