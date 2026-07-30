import { expect, test } from "./fixtures";

test("the sidebar shell matches its visual baseline @visual", async ({ page }) => {
  await page.goto("/");
  const sidebar = page.locator(".sidebar");
  await expect(sidebar).toBeVisible();
  await expect(sidebar).toHaveScreenshot("sidebar-expanded.png", { maxDiffPixelRatio: 0.02 });

  await page.getByRole("button", { name: "Replier la navigation" }).click();
  await expect(sidebar).toHaveScreenshot("sidebar-collapsed.png", { maxDiffPixelRatio: 0.02 });
});
