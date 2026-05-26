import React from "react";
import { Composition } from "remotion";
import { MatchVideo, MATCH_FPS, MATCH_DURATION } from "./MatchVideo";

// Registered compositions. Pick the fixture with the `matchId` input
// prop (Studio left panel → Props, or `--props` on the CLI). Defaults to
// the 2018 World Cup final.
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MatchVideo"
      component={MatchVideo}
      durationInFrames={MATCH_DURATION}
      fps={MATCH_FPS}
      width={1080}
      height={1920}
      defaultProps={{ matchId: "wc18-final-fr-cr" }}
    />
  );
};
