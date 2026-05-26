import { staticFile, delayRender, continueRender } from "remotion";

const loadLocalFont = (
  family: string,
  url: string,
  format: "truetype" | "opentype",
) => {
  const handle = delayRender(`load-font:${family}`);
  const face = new FontFace(family, `url('${url}') format('${format}')`);
  face
    .load()
    .then(() => {
      document.fonts.add(face);
      continueRender(handle);
    })
    .catch((err) => {
      console.error(`Error loading ${family}`, err);
      continueRender(handle);
    });
  return family;
};

const goboldBold = loadLocalFont(
  "Gobold Bold",
  staticFile("fonts/gobold-bold.ttf"),
  "truetype",
);
const gothamProBold = loadLocalFont(
  "Gotham Pro Bold",
  staticFile("fonts/gothampro-bold.otf"),
  "opentype",
);
const sharpGrotesk = loadLocalFont(
  "Sharp Grotesk",
  staticFile("fonts/sharpgrotesk.ttf"),
  "truetype",
);

export const fonts = {
  // small caps / labels / mono-feel chrome
  body: gothamProBold,
  // general display headings (team names, big titles)
  display: goboldBold,
  // goal/score numerals — variable grotesk
  score: sharpGrotesk,
};

export const palette = {
  bg: "#F1EEE7",
  panel: "#FFFFFF",
  ink: "#1A1A1A",
  hairline: "rgba(20,20,20,0.10)",
  hairlineFaint: "rgba(20,20,20,0.05)",
};

// iPhone Pro display proportions: 19.5:9 portrait → 1080 × 2340
export const CANVAS_W = 1080;
export const CANVAS_H = 2340;
