import React from "react";
import { createRoot } from "react-dom/client";
import { AnimTunerLab } from "../playground/AnimTunerLab";

const root = createRoot(document.getElementById("root")!);
root.render(<AnimTunerLab />);
