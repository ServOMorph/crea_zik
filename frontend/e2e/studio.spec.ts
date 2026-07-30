import { expect, test } from "@playwright/test";

test("a user creates, renders, listens to and exports a click", async ({ page }) => {
  const projectName = `E2E click ${Date.now()}`;
  await page.goto("/");
  await page.getByRole("textbox", { name: "Name" }).fill(projectName);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  const project = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: projectName, exact: true }),
  });
  await project.getByRole("button", { name: "Create and render a click" }).click();

  await expect(page.getByText("Render complete")).toBeVisible({ timeout: 35_000 });
  await expect(page.getByRole("heading", { name: "Render jobs" })).toBeVisible();
  await expect(page.locator(".jobs")).toContainText("completed · 100 %");
  const audio = page.locator("audio");
  await expect(audio).toHaveAttribute("src", /\/projects\//);
  await expect
    .poll(() => audio.evaluate((element) => (element as HTMLAudioElement).readyState))
    .toBeGreaterThanOrEqual(1);
  await expect.poll(() => audio.evaluate((element) => (element as HTMLAudioElement).duration)).toBeGreaterThan(0);
  await expect(page.getByRole("link", { name: "Download WAV" })).toHaveAttribute("download", "");
  await page.getByRole("button", { name: "Export WAV" }).click();
  await expect(page.getByRole("heading", { name: "Export" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download exported WAV" })).toHaveAttribute("download", "");
  await expect(page.getByRole("link", { name: "Download provenance manifest" })).toHaveAttribute("download", "");
  await page.getByRole("button", { name: "Analyze" }).click();
  await expect(page.getByRole("status")).toHaveText("QA passed");
});

test("a gallery example is copied, rendered and listened to", async ({ page }) => {
  const projectName = `E2E gallery ${Date.now()}`;
  await page.goto("/");
  await page.getByRole("textbox", { name: "Name" }).fill(projectName);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  const project = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: projectName, exact: true }),
  });
  await expect(project).toBeVisible();
  const gallery = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Clic tactile", exact: true }),
  });
  await gallery.getByRole("button", { name: "Open, render and listen" }).click();

  await expect(page.getByText("Render complete")).toBeVisible({ timeout: 35_000 });
  await expect(page.getByRole("link", { name: "Download WAV" })).toHaveAttribute("download", "");
  await expect(project.getByRole("button", { name: "Render 2-minute cancellation demo" })).toBeVisible();
  await expect(project.getByText("Clic tactile")).toBeVisible();
  await project.getByRole("button", { name: "Render", exact: true }).click();
  await expect(page.getByText("Render complete")).toBeVisible({ timeout: 35_000 });
});

test("the Sound Designer creates and renders a parameterized patch", async ({ page }) => {
  const projectName = `E2E designer ${Date.now()}`;
  await page.goto("/");
  await page.getByRole("textbox", { name: "Name" }).fill(projectName);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByLabel("Patch name").fill("Designer impact");
  await page.getByLabel("Type").selectOption("modal_impact");
  await page.getByLabel("Seed").fill("99");
  await page.getByLabel("Duration (s)").fill("0.4");
  await page.getByLabel("Gain").fill("0.15");
  await page.getByRole("button", { name: "Create and render", exact: true }).click();

  await expect(page.getByText("Render complete")).toBeVisible({ timeout: 35_000 });
  const project = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: projectName, exact: true }),
  });
  await expect(project.getByText("Designer impact")).toBeVisible();
});

test("a user creates a short theme with a synchronized stem", async ({ page }) => {
  const projectName = `E2E theme ${Date.now()}`;
  await page.goto("/");
  await page.getByRole("textbox", { name: "Name" }).fill(projectName);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  const project = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: projectName, exact: true }),
  });
  await project.getByRole("button", { name: "Create and render a click" }).click();
  await expect(page.getByText("Render complete")).toBeVisible({ timeout: 35_000 });
  await project.getByRole("button", { name: "Create and render a 4-beat theme" }).click();

  await expect(page.getByText("Theme rendered with 1 stem")).toBeVisible({ timeout: 35_000 });
  await expect(page.locator("audio")).toHaveAttribute("src", /\/projects\/.*mix\.wav/);
});

test("an assistant proposal is previewed before explicit acceptance", async ({ page }) => {
  const projectName = `E2E assistant ${Date.now()}`;
  await page.route("**/proposals/generate", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        intent: "plus lumineux",
        rationale: "La brillance est une macro disponible.",
        expected_impacts: ["Le clic sera plus lumineux."],
        operations: [
          {
            op: "replace",
            patch_id: "00000000-0000-4000-8000-000000000001",
            path: "parameters.brightness",
            value: 0.8,
          },
        ],
      }),
    });
  });
  await page.route("**/proposals/preview", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ id: "preview", name: projectName, patches: [] }),
    });
  });
  await page.route("**/proposals/apply", async (route) => {
    const projectId =
      route
        .request()
        .url()
        .match(/projects\/([^/]+)\//)?.[1] ?? "preview";
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: projectId,
        name: projectName,
        patches: [],
        intent_history: [
          {
            id: "00000000-0000-4000-8000-000000000001",
            provider: "ollama",
            model: "qwen2.5:7b",
            decision: "accepted",
            proposal: { intent: "plus lumineux", rationale: "", expected_impacts: [], operations: [] },
          },
        ],
      }),
    });
  });
  await page.goto("/");
  await page.getByRole("textbox", { name: "Name" }).fill(projectName);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("textbox", { name: "Intention" }).fill("plus lumineux");
  await page.getByRole("button", { name: "Proposer" }).click();

  await expect(page.getByRole("heading", { name: "Proposition" })).toBeVisible();
  await expect(page.getByText("La brillance est une macro disponible.")).toBeVisible();
  await expect(page.getByText("brightness → 0.8")).toBeVisible();
  await page.getByRole("button", { name: "Aperçu" }).click();
  await expect(page.getByText("Aperçu calculé : aucune modification n’est encore enregistrée.")).toBeVisible();
  await page.getByRole("button", { name: "Accepter et enregistrer" }).click();
  await expect(page.getByRole("status")).toHaveText("Proposal accepted and saved");
  await expect(page.getByRole("heading", { name: "Historique des décisions" })).toBeVisible();
});

test("an adaptive graph is created and simulated at the next bar", async ({ page }) => {
  const projectName = `E2E adaptive ${Date.now()}`;
  await page.goto("/");
  await page.getByRole("textbox", { name: "Name" }).fill(projectName);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("button", { name: "Créer le graphe exploration/tension" }).click();

  await expect(page.getByRole("status")).toHaveText("Adaptive graph created");
  await expect(page.getByRole("button", { name: "Simuler à la mesure" })).toBeEnabled();
  await page.getByRole("button", { name: "Simuler à la mesure" }).click();
  await expect(page.getByText("intensity >= 0.5 : transition planifiée à 4 beats")).toBeVisible();
});
