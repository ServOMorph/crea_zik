import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  use: { baseURL: "http://127.0.0.1:5180" },
  webServer: [
    {
      command: "uv run uvicorn crea_zik.api:app --host 127.0.0.1 --port 8001",
      cwd: "..",
      url: "http://127.0.0.1:8001/api/health",
      env: { CREA_ZIK_PROJECT_ROOT: "test-results/projects" },
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5180",
      url: "http://127.0.0.1:5180",
      env: { CREA_ZIK_API_URL: "http://127.0.0.1:8001" },
      reuseExistingServer: false,
    },
  ],
});
