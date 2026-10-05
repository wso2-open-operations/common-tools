import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const srcPath = (relative = ""): string =>
  fileURLToPath(new URL(relative ? `./src/${relative}` : "./src", import.meta.url));

// Oxygen UI's single-file bundle styles the MUI X Data Grid and wires Prism
// at module top level (ListingTable, CodeBlock). Those calls are not
// tree-shakeable, so every consumer ships ~380 KB (minified) of grid and
// syntax highlighter it may never render - this dashboard uses neither.
// Point both at throwing stubs; drop these entries (and src/build-stubs) if
// a screen ever needs ListingTable or CodeBlock.
const unusedOxygenDeps = [
  { find: /^@mui\/x-data-grid$/, replacement: srcPath("build-stubs/mui-x-data-grid.tsx") },
  { find: /^prismjs(\/components\/.*)?$/, replacement: srcPath("build-stubs/prismjs.ts") },
];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@", replacement: srcPath() },
      { find: "@components", replacement: srcPath("components") },
      { find: "@config", replacement: srcPath("config") },
      { find: "@hooks", replacement: srcPath("hooks") },
      { find: "@utils", replacement: srcPath("utils") },
      ...unusedOxygenDeps,
    ],
  },
});
