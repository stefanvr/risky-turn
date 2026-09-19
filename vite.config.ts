import { defineConfig } from "vite";

export default defineConfig({
  /*
   * The game is published as a GitHub Pages project site at
   * stefanvr.github.io/risky-turn/, so every asset URL is prefixed with the
   * repository name. Changing the repository name means changing this.
   */
  base: "/risky-turn/",
  build: { target: "es2023" },
});
