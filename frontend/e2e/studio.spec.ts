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
  await expect.poll(() => audio.evaluate(element => (element as HTMLAudioElement).readyState)).toBeGreaterThanOrEqual(1);
  await expect.poll(() => audio.evaluate(element => (element as HTMLAudioElement).duration)).toBeGreaterThan(0);
  await expect(page.getByRole("link", { name: "Download WAV" })).toHaveAttribute("download", "");
});

test("a gallery example is copied, rendered and listened to", async ({ page }) => {
  const projectName = `E2E gallery ${Date.now()}`;
  await page.goto("/");
  await page.getByRole("textbox", { name: "Name" }).fill(projectName);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  const gallery = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Clic tactile", exact: true }),
  });
  await gallery.getByRole("button", { name: "Open, render and listen" }).click();

  await expect(page.getByText("Render complete")).toBeVisible({ timeout: 35_000 });
  await expect(page.getByRole("link", { name: "Download WAV" })).toHaveAttribute("download", "");
  const project = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: projectName, exact: true }),
  });
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
