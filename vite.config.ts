import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Suffix on every hashed asset filename. Content hashes alone repeat across
// deploys that change only docs, so a bad edge-cache entry for a given URL can
// outlive several releases. Bumping this revision moves every asset to a new URL.
const ASSET_REVISION = "r2";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [dyadComponentTagger(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@content": path.resolve(__dirname, "./content"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash]-${ASSET_REVISION}.js`,
        chunkFileNames: `assets/[name]-[hash]-${ASSET_REVISION}.js`,
        assetFileNames: `assets/[name]-[hash]-${ASSET_REVISION}[extname]`,
      },
    },
  },
}));
