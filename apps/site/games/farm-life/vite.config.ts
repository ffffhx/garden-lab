import { defineConfig } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  root: rootDir,
  build: {
    outDir: resolve(rootDir, "../../public/games/farm-life"),
    emptyOutDir: true,
  },
});
