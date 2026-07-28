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
  const audio = page.locator("audio");
  await expect(audio).toHaveAttribute("src", /\/projects\//);
  await expect.poll(() => audio.evaluate(element => (element as HTMLAudioElement).readyState)).toBeGreaterThanOrEqual(1);
  await expect.poll(() => audio.evaluate(element => (element as HTMLAudioElement).duration)).toBeGreaterThan(0);
  await expect(page.getByRole("link", { name: "Download WAV" })).toHaveAttribute("download", "");
});
