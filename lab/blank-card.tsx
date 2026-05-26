import React from "react";
import { createRoot } from "react-dom/client";
import { BlankCardLab } from "../playground/BlankCardLab";

const root = createRoot(document.getElementById("root")!);
root.render(<BlankCardLab />);
