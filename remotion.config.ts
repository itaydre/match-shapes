import { Config } from "@remotion/cli/config";

// Match-card video render config. The composition is 1080×1920 @ 30fps.
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setEntryPoint("./remotion/index.ts");
