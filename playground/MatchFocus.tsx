import React from "react";
import { GAMES, GalleryCard, type Game } from "./GameGallery";

// MatchFocus — single-card surface dedicated to one fixture so we
// can iterate on its goals without the rest of the gallery competing
// for attention. GalleryCard hardcodes its own height; we just centre
// it inside the viewport.

const FOCUS_GAME_ID = "wc18-final-fr-cr"; // France 4-2 Croatia, 2018 WC Final, Luzhniki

export const MatchFocus: React.FC = () => {
  const game: Game | undefined = GAMES.find((g) => g.id === FOCUS_GAME_ID);
  if (!game) {
    return (
      <div style={styles.missing}>
        <div style={styles.missingTitle}>No match found</div>
        <div style={styles.missingHint}>
          FOCUS_GAME_ID is set to "{FOCUS_GAME_ID}" — no fixture with that id
          exists in GAMES.
        </div>
      </div>
    );
  }
  return (
    <div style={styles.shell}>
      <GalleryCard game={game} />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  shell: {
    background: "#0E0E0E",
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    overflow: "auto",
  },
  missing: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#220000",
    color: "#FF8888",
    fontFamily: "ui-monospace, monospace",
    gap: 12,
    padding: 24,
    textAlign: "center",
  },
  missingTitle: { fontSize: 20, fontWeight: 800 },
  missingHint: { fontSize: 13 },
};
