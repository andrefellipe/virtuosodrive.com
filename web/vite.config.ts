import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The page is built once per Release. Its fingerprinted files are served
// from the Release's own folder (VD_BASE, for example "/r/a1b2c3d/"), so
// that going back to an earlier Release finds that Release's files still
// in place; the entry document alone is served from the root.
export default defineConfig({
  plugins: [react()],
  base: process.env.VD_BASE ?? "/",
  build: {
    outDir: "../dist/web",
    emptyOutDir: true,
    sourcemap: false,
    assetsInlineLimit: 0,
  },
});
