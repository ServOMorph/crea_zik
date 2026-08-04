import { expect, test } from "./fixtures";

test("la sidebar garde le lien actif et l'historique du navigateur en navigation simple", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Studio" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Éditeur musical" })).not.toHaveAttribute("aria-current");

  await page.getByRole("link", { name: "Éditeur musical" }).click();
  await expect(page.getByRole("heading", { name: "Éditeur musical" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Éditeur musical" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Studio" })).not.toHaveAttribute("aria-current");

  await page.goBack();
  await expect(page.getByRole("link", { name: "Studio" })).toHaveAttribute("aria-current", "page");

  await page.goForward();
  await expect(page.getByRole("heading", { name: "Éditeur musical" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Éditeur musical" })).toHaveAttribute("aria-current", "page");
});

test("une URL directe vers un projet absent affiche l'état introuvable", async ({ page }) => {
  await page.goto("/editor?project=absent&composition=composition-1");

  await expect(page.getByRole("alert")).toHaveText("Projet introuvable.");
  await expect(page.getByRole("link", { name: "Éditeur musical" })).toHaveAttribute("aria-current", "page");
});

test("la route éditeur sans composition est conservée en revenant depuis le studio", async ({ page }) => {
  await page.goto("/editor");
  await expect(page.getByRole("heading", { name: "Ouvrir Lignes de nuit" })).toBeVisible();

  await page.getByRole("link", { name: "Studio" }).click();
  await page.getByRole("link", { name: "Éditeur musical" }).click();

  await expect(page).toHaveURL(/\/editor$/);
  await expect(page.getByRole("heading", { name: "Ouvrir Lignes de nuit" })).toBeVisible();
});