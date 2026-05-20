// ─────────────────────────────────────────────────────────────────────
// Team palettes — 5-colour kit sets pulled from international and
// club flags. palette[0] is the brand-defining primary; palette[1]
// the secondary accent; palette[2] tertiary; palette[3] neutral
// light; palette[4] neutral dark. Shape builders cycle through all
// five so every team colour reads on the rendered card.
// ─────────────────────────────────────────────────────────────────────

export type TeamPalette = {
  name: string;
  colors: string[];
};

export const TEAM_PALETTES: TeamPalette[] = [
  // Strictly the colours found on each national flag. No padding,
  // no derived shades, no neutral defaults. Variable length per team;
  // shape builders cycle via `palette[i % palette.length]`.
  { name: "Brazil",       colors: ["#FEDD00", "#009C3B", "#002776", "#FFFFFF"] },
  { name: "France",       colors: ["#0055A4", "#EF4135", "#FFFFFF"] },
  { name: "Argentina",    colors: ["#75AADB", "#F6B40E", "#FFFFFF"] },
  { name: "Croatia",      colors: ["#FF0000", "#171796", "#FFFFFF"] },
  { name: "Spain",        colors: ["#AA151B", "#F1BF00"] },
  { name: "Germany",      colors: ["#000000", "#DD0000", "#FFCE00"] },
  { name: "Netherlands",  colors: ["#AE1C28", "#21468B", "#FFFFFF", "#FF7F00"] },
  { name: "Portugal",     colors: ["#046A38", "#DA291C", "#FFE600", "#FFFFFF"] },
  { name: "Japan",        colors: ["#BC002D", "#FFFFFF"] },
  { name: "Morocco",      colors: ["#C1272D", "#006233", "#FFFFFF"] },
  { name: "England",      colors: ["#CE1124", "#FFFFFF", "#012169"] },
  { name: "South Korea",  colors: ["#CD2E3A", "#0047A0", "#000000", "#FFFFFF"] },
  { name: "Italy",        colors: ["#008C45", "#FFFFFF", "#CD212A"] },
];

// Look up a palette by team name (case-insensitive, partial-OK so
// "Korea" finds "South Korea"). Falls back to the first palette if
// the name doesn't match — never throws.
export const getTeamPalette = (teamName: string): TeamPalette => {
  const needle = teamName.trim().toLowerCase();
  return (
    TEAM_PALETTES.find((p) => p.name.toLowerCase() === needle) ??
    TEAM_PALETTES.find((p) => p.name.toLowerCase().includes(needle)) ??
    TEAM_PALETTES[0]!
  );
};
