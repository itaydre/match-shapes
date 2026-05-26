import { getProject, types } from "@theatre/core";
import type { ISheet } from "@theatre/core";
import studio from "@theatre/studio";
import { getRemotionEnvironment } from "remotion";

// Statically importing @theatre/studio registers it with @theatre/core
// synchronously — without this, getProject() throws because core thinks
// studio is missing and refuses to start with an empty state. We then
// only call studio.initialize() when running inside Remotion Studio so
// the editor UI does not appear during headless renders.
const env = getRemotionEnvironment();
if (typeof window !== "undefined" && env.isStudio) {
  studio.initialize();
}

const PROJECT_ID = "match-card";

// Saved state placeholder. Once you click "Save All to File" in the
// Theatre Studio panel, drop the JSON next to this file and import it
// here as `state` to make headless renders deterministic.
const savedState: object | undefined = undefined;

export const project = getProject(
  PROJECT_ID,
  savedState ? { state: savedState as never } : undefined,
);

// Kept for API compatibility with the composition — initialization now
// happens unconditionally at module load above.
export const ensureStudio = (): void => {};

export const sheet = (name: string): ISheet => project.sheet(name);

export const T = types;
