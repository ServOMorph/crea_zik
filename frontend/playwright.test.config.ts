import { defineConfig } from "@playwright/test";

// Configuration pour réutiliser les serveurs déjà démarrés (backend:8001, frontend:5180)
// Utiliser avec : npx playwright test --config playwright.test.config.ts --grep "<nom-du-test>"
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,  // Timeout global augmenté à 90s (pour les rendus lents en local)
  use: {
    baseURL: "http://127.0.0.1:5180",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    serviceWorkers: "block",
  },
  webServer: [
    {
      command: "uv run uvicorn crea_zik.api:app --host 127.0.0.1 --port 8001",
      cwd: "..",
      url: "http://127.0.0.1:8001/api/health",
      env: { CREA_ZIK_PROJECT_ROOT: process.env.CREA_ZIK_PROJECT_ROOT ?? "test-results/projects" },
      reuseExistingServer: true,  // ← Autorise la réutilisation du backend existant
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5180",
      url: "http://127.0.0.1:5180",
      env: { CREA_ZIK_API_URL: "http://127.0.0.1:8001" },
      reuseExistingServer: true,  // ← Autorise la réutilisation du frontend existant
    },
  ],
});
