import React from "react";
import { createRoot } from "react-dom/client";
import { SeekTestLab } from "../playground/SeekTestLab";

const root = createRoot(document.getElementById("root")!);
root.render(<SeekTestLab />);
