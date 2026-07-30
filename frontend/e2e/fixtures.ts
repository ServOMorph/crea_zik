import { expect, test as base } from "@playwright/test";

const allowedHosts = new Set(["127.0.0.1", "localhost", "::1"]);

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route("**/*", async (route) => {
      const requestUrl = new URL(route.request().url());
      if (!allowedHosts.has(requestUrl.hostname)) {
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });
    await use(page);
  },
});

export { expect };
