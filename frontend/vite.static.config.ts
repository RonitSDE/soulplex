// Builds the self-contained live demo (frontend + in-browser mock backend) as one HTML file.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath } from "node:url";

const empty = fileURLToPath(new URL("./src/mock/empty.css", import.meta.url));

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  define: { "import.meta.env.VITE_STATIC": JSON.stringify("1") },
  resolve: { alias: [{ find: /^@fontsource-variable\/.*\.css$/, replacement: empty }] },
  build: { outDir: "dist-static", chunkSizeWarningLimit: 4000, assetsInlineLimit: 100000000 },
});
