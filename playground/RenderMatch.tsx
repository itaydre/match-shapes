// @refresh reset
import React, { useEffect, useMemo, useState } from "react";
import { StaticPreviewV3 } from "./StaticPreviewV3";
import {
  GAMES,
  MATCH_CONTEXTS,
  DEFAULT_MATCH_CONTEXT,
  v1BuildFamilyMap,
} from "./GameGallery";
import { computeGoalImportance } from "../src/lib/goalImportance";

// RenderMatch — a single gallery match card rendered at exactly
// 1080×1920 with the `frame` driven entirely from outside (window
// hooks), so the headless renderer can step frame-by-frame. Props are
// the SAME ones GalleryCard feeds StaticPreviewV3 (same family shuffle,
// same importance scoring), so the output matches the gallery exactly.

const matchId =
  new URLSearchParams(window.location.search).get("match") ?? GAMES[0]!.id;

export const RenderMatch: React.FC = () => {
  const game = useMemo(
    () => GAMES.find((g) => g.id === matchId) ?? GAMES[0]!,
    [],
  );
  const [frame, setFrame] = useState(0);

  const familyMap = useMemo(
    () => v1BuildFamilyMap(game.id, game.goals),
    [game],
  );
  const importanceById = useMemo(() => {
    const ctx = MATCH_CONTEXTS[game.id] ?? DEFAULT_MATCH_CONTEXT;
    const map = new Map<string, number>();
    for (const g of game.goals) {
      const b = computeGoalImportance(
        { id: g.id, team: g.team, minute: g.minute },
        game.goals.map((x) => ({ id: x.id, team: x.team, minute: x.minute })),
        ctx,
      );
      map.set(g.id, b.importance);
    }
    return map;
  }, [game]);
  const underdog: "home" | "away" = useMemo(() => {
    const ctx = MATCH_CONTEXTS[game.id] ?? DEFAULT_MATCH_CONTEXT;
    return ctx.homeStrength <= ctx.awayStrength ? "home" : "away";
  }, [game]);

  useEffect(() => {
    // External control hooks for the headless renderer.
    (window as unknown as { __setFrame: (f: number) => void }).__setFrame = (
      f: number,
    ) => setFrame(f);
    (window as unknown as { __renderReady: boolean }).__renderReady = true;
  }, []);

  return (
    <div
      id="render-card"
      style={{ width: 1080, height: 1920, background: "#F4F4F4" }}
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
    </div>
  );
};
