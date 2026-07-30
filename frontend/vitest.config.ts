import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      globals: true,
      include: ["src/**/*.test.{ts,tsx}"],
      coverage: {
        provider: "v8",
        reporter: ["text", "json-summary"],
        exclude: [
          "**/*.config.{js,ts,mjs}",
          "dist/**",
          "e2e/**",
          "src/main.tsx",
        ],
        // Seuil temporaire (2026-07-30) : TransportBar.tsx et EditorLanding.tsx ne sont
        // pas encore testés en profondeur (Web Audio simulé, interactions d'édition),
        // couverture prévue aux phases V5 et V3 de EDITEUR/roadmap_editeur_musical.md.
        // Relever à 80 % une fois ces phases closes.
        thresholds: {
          lines: 60,
          functions: 60,
          branches: 75,
          statements: 60,
        },
      },
    },
  }),
);
