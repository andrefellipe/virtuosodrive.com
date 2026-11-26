import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Only the part of Bootstrap the page uses: its base ("reboot") styles.
import "bootstrap/dist/css/bootstrap-reboot.min.css";
import "./styles.css";
import { App } from "./App.tsx";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("The entry document has no #root element");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
