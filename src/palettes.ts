// ─────────────────────────────────────────────────────────────────────
// Team palettes — 5-colour kit sets pulled from international and
// club flags. palette[0] is the brand-defining primary; palette[1]
// the secondary accent; palette[2] tertiary; palette[3] neutral
// light; palette[4] neutral dark. Shape builders cycle through all
// five so every team colour reads on the rendered card.
// ─────────────────────────────────────────────────────────────────────

export type TeamPalette = {
  name: string;
  colors: [string, string, string, string, string];
};

export const TEAM_PALETTES: TeamPalette[] = [
  { name: "Brazil",       colors: ["#FEDD00", "#009C3B", "#002776", "#FFFFFF", "#000000"] },
  { name: "France",       colors: ["#0055A4", "#EF4135", "#EFEFEF", "#FFFFFF", "#000000"] },
  { name: "Argentina",    colors: ["#75AADB", "#F6B40E", "#EFEFEF", "#FFFFFF", "#000000"] },
  { name: "Croatia",      colors: ["#FF0000", "#171796", "#EFEFEF", "#FFFFFF", "#000000"] },
  { name: "Spain",        colors: ["#AA151B", "#F1BF00", "#AD1519", "#FFFFFF", "#000000"] },
  { name: "Germany",      colors: ["#FFCE00", "#DD0000", "#000000", "#FFFFFF", "#222222"] },
  { name: "Netherlands",  colors: ["#AE1C28", "#21468B", "#EFEFEF", "#FFFFFF", "#FF7F00"] },
  { name: "Portugal",     colors: ["#046A38", "#DA291C", "#FFE600", "#FFFFFF", "#000000"] },
  { name: "Japan",        colors: ["#BC002D", "#EFEFEF", "#FFFFFF", "#000000", "#BC002D"] },
  { name: "Morocco",      colors: ["#C1272D", "#006233", "#EFEFEF", "#FFFFFF", "#000000"] },
  { name: "England",      colors: ["#CE1124", "#012169", "#EFEFEF", "#FFFFFF", "#000000"] },
  { name: "South Korea",  colors: ["#CD2E3A", "#0047A0", "#EFEFEF", "#FFFFFF", "#000000"] },
  { name: "Italy",        colors: ["#008C45", "#CD212A", "#EFEFEF", "#FFFFFF", "#000000"] },
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
