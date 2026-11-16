import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("the page has no #root element");
createRoot(root).render(<App />);
