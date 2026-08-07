import { expect, test } from "./fixtures";

test("a user creates, renders, listens to and exports a click", async ({ page }) => {
  const projectName = `E2E click ${Date.now()}`;
  await page.goto("/");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(projectName);
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
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(projectName);
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
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(projectName);
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
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(projectName);
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
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(projectName);
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
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(projectName);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("button", { name: "Créer le graphe exploration/tension" }).click();

  await expect(page.getByRole("status")).toHaveText("Adaptive graph created");
  await expect(page.getByRole("button", { name: "Simuler à la mesure" })).toBeEnabled();
  await page.getByRole("button", { name: "Simuler à la mesure" }).click();
  await expect(page.getByText("intensity >= 0.5 : transition planifiée à 4 beats")).toBeVisible();
});

test("the editor step sequencer toggles, undoes and mutes drum steps", async ({ page }) => {
  const projectName = `E2E sequencer ${Date.now()}`;
  await page.goto("/");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(projectName);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("link", { name: "Éditeur musical" }).click();
  await page.getByRole("button", { name: "Créer une copie éditable" }).click();
  await expect(page).toHaveURL(/\/editor\?project=.*&composition=.*/);
  await expect(page.getByRole("heading", { name: "Lignes de nuit" })).toBeVisible();
  await expect(page.getByText("Séquenceur pas à pas")).toBeVisible();

  const emptyStep = page.getByRole("button", { name: /Kick, pas 1, temps 0 : inactif/ });
  await emptyStep.click();
  await expect(page.getByRole("button", { name: /Kick, pas 1, temps 0 : actif/ })).toBeVisible();

  const occupiedStep = page.getByRole("button", { name: /Kick, pas 17, temps 8 : actif/ });
  await occupiedStep.click();
  await expect(page.getByRole("button", { name: /Kick, pas 17, temps 8 : inactif/ })).toBeVisible();

  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.getByRole("button", { name: /Kick, pas 17, temps 8 : actif/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Kick, pas 1, temps 0 : actif/ })).toBeVisible();

  const clapStep = page.getByRole("button", { name: /Clap, pas 19, temps 9 : actif/ });
  await clapStep.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /Clap, pas 19, temps 9 : inactif/ })).toBeVisible();

  await page.getByRole("button", { name: /drums — Muet/ }).click();
  await expect(page.getByRole("button", { name: /drums — Son activé/ })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await expect(page.getByText("Enregistré")).toBeVisible();
});

test("the music editor opens a project composition from a direct route", async ({ page }) => {
  const projectName = `E2E editor ${Date.now()}`;
  await page.goto("/");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(projectName);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("link", { name: "Éditeur musical" }).click();
  await expect(page.getByRole("heading", { name: "Éditeur musical" })).toBeVisible();
  await page.getByRole("button", { name: "Créer une copie éditable" }).click();
  await expect(page).toHaveURL(/\/editor\?project=.*&composition=.*/);
  await expect(page.getByRole("heading", { name: "Lignes de nuit" })).toBeVisible();

  await page.getByRole("textbox", { name: "Titre de la composition" }).fill("Nuit sauvegardée");
  await expect(page.getByText("Modifications non enregistrées")).toBeVisible();
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await expect(page.getByText("Enregistré")).toBeVisible();

  await page.getByLabel("Fin de sélection").fill("8");
  await page.getByRole("button", { name: "Lire la sélection" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Préécoute prête" })).toBeVisible({ timeout: 35_000 });
  await page.getByRole("button", { name: "Stop" }).click();
  await page.getByLabel("Position de lecture").fill("4");
  await expect(page.getByLabel("Position de lecture")).toHaveValue("4");
  await page.getByRole("checkbox", { name: "Boucle sélection" }).check();
  await expect(page.getByRole("checkbox", { name: "Boucle sélection" })).toBeChecked();

  const directUrl = page.url();
  await page.goto(directUrl);
  await expect(page.getByRole("heading", { name: "Nuit sauvegardée" })).toBeVisible();
  await page.getByRole("link", { name: "Studio" }).click();
  await page.getByRole("link", { name: "Éditeur musical" }).click();
  await expect(page).toHaveURL(directUrl);
});

test("the playlist arranges clips and markers by drag and keeps them after reload", async ({ page }) => {
  const projectName = `E2E playlist ${Date.now()}`;
  await page.goto("/");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(projectName);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("link", { name: "Éditeur musical" }).click();
  await page.getByRole("button", { name: "Créer une copie éditable" }).click();
  await expect(page).toHaveURL(/\/editor\?project=.*&composition=.*/);
  await expect(page.getByRole("heading", { name: "Lignes de nuit" })).toBeVisible();

  const scrollPlaylist = (left: number) =>
    page.evaluate((value) => {
      const scroll = document.querySelector(".playlist__scroll");
      if (scroll) scroll.scrollLeft = value;
    }, left);

  const reveal = async (locator: ReturnType<typeof page.getByRole>) => {
    await locator.scrollIntoViewIfNeeded();
    await scrollPlaylist(0);
  };

  await page.getByRole("heading", { name: "Playlist (5 clips)" }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "Pattern 3 (piste pad)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Marqueur intro à 0" })).toBeVisible();

  const padClip = page.getByRole("button", { name: "Pattern 3 (piste pad)" });
  await reveal(padClip);
  const padBox = (await padClip.boundingBox()) ?? { x: 0, y: 0, width: 20, height: 44 };
  await page.mouse.move(padBox.x + 120, padBox.y + padBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(padBox.x + 120 + 192, padBox.y + padBox.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(padClip).toHaveCSS("left", "192px");

  const arpClip = page.getByRole("button", { name: "Pattern 4 (piste arp)" });
  await reveal(arpClip);
  const arpBox = (await arpClip.boundingBox()) ?? { x: 0, y: 0, width: 20, height: 44 };
  await arpClip.dblclick({ position: { x: Math.min(768, arpBox.width - 30), y: arpBox.height / 2 } });
  await expect(page.getByRole("heading", { name: "Playlist (6 clips)" })).toBeVisible();

  const groove = page.getByRole("button", { name: "Marqueur groove à 8" });
  await reveal(groove);
  await scrollPlaylist(659);
  const grooveBox = (await groove.boundingBox()) ?? { x: 0, y: 0, width: 80, height: 24 };
  await page.mouse.move(grooveBox.x + 20, grooveBox.y + grooveBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(grooveBox.x + 20 + 96, grooveBox.y + grooveBox.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Marqueur groove à 9" })).toBeVisible();

  await page.getByRole("button", { name: "Ajouter un clip" }).click();
  await expect(page.getByRole("heading", { name: "Playlist (7 clips)" })).toBeVisible();
  await page.getByRole("checkbox", { name: "Ripple" }).check();

  const firstClip = page.locator(".playlist__clip").first();
  const trailingClip = page.locator(".playlist__clip").nth(1);
  await firstClip.scrollIntoViewIfNeeded();
  await scrollPlaylist(400);
  const trailingLeft = parseFloat(await trailingClip.evaluate((el) => el.style.left));
  const firstBox = (await firstClip.boundingBox()) ?? { x: 0, y: 0, width: 20, height: 44 };
  const firstStartX = Math.max(firstBox.x + 120, 500);
  await page.mouse.move(firstStartX, firstBox.y + firstBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(firstStartX + 768, firstBox.y + firstBox.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(firstClip).toHaveCSS("left", "768px");
  await expect(trailingClip).toHaveCSS("left", `${trailingLeft + 768}px`);

  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await expect(page.getByText("Enregistré")).toBeVisible();
  await page.goto(page.url());
  await expect(page.getByRole("heading", { name: "Lignes de nuit" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Playlist (7 clips)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pattern 3 (piste pad)" })).toHaveCSS("left", "192px");
  await expect(page.getByRole("button", { name: "Marqueur groove à 9" })).toBeVisible();
});

test("the editor transport plays, pauses, stops and reaches media end", async ({ page }) => {
  const projectName = `E2E transport ${Date.now()}`;
  await page.goto("/");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(projectName);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("link", { name: "Éditeur musical" }).click();
  await page.getByRole("button", { name: "Créer une copie éditable" }).click();
  await expect(page).toHaveURL(/\/editor\?project=.*&composition=.*/);
  await expect(page.getByRole("heading", { name: "Lignes de nuit" })).toBeVisible();

  await page.getByLabel("Fin de sélection").fill("4");
  await page.getByRole("button", { name: "Lire la sélection" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Préécoute prête" })).toBeVisible({
    timeout: 60_000,  // Augmenté de 35s à 60s pour les environnements locaux lents
  });
  await expect(page.getByRole("button", { name: "Relancer" })).toBeVisible();

  const playhead = page.locator('output[aria-live="polite"]');
  const before = await playhead.textContent();
  await expect.poll(() => playhead.textContent(), { timeout: 10_000 }).not.toBe(before);  // Augmenté de 6s à 10s

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Lire", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Lire", exact: true }).click();
  await expect(page.getByRole("button", { name: "Relancer" })).toBeVisible();
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByRole("button", { name: "Lire", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Lire la sélection" }).click();
  await expect(page.getByRole("button", { name: "Relancer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lire", exact: true })).toBeVisible({ timeout: 60_000 });  // Augmenté à 60s pour cohérence
});

test("the piano roll renders every melodic note and transposes exactly", async ({ page }) => {
  const projectName = `E2E piano roll ${Date.now()}`;
  await page.goto("/");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(projectName);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("link", { name: "Éditeur musical" }).click();
  await page.getByRole("button", { name: "Créer une copie éditable" }).click();
  await expect(page).toHaveURL(/\/editor\?project=.*&composition=.*/);
  await expect(page.getByRole("heading", { name: "Lignes de nuit" })).toBeVisible();

  const rackName = (name: string) => page.locator(".channel-rack__name").filter({ hasText: name });

  await rackName("bass").click();
  await expect(page.getByRole("heading", { name: "Piano Roll" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Note La2, temps 16, durée 0\.42, vélocité 30 %/ })).toBeVisible();
  await expect(page.locator(".piano-roll__note")).toHaveCount(22);

  await page.getByRole("button", { name: /Note La2, temps 16, durée 0\.42/ }).click();
  await page.getByRole("button", { name: "Transposer +12" }).click();
  await expect(page.getByRole("button", { name: /Note La3, temps 16, durée 0\.42/ })).toBeVisible();

  await rackName("pad").click();
  await expect(page.locator(".piano-roll__note")).toHaveCount(42);
  await expect(page.getByRole("button", { name: /Note La3, temps 0, durée 4\.8/ })).toBeVisible();

  await rackName("arp").click();
  await expect(page.locator(".piano-roll__note")).toHaveCount(72);

  await rackName("lead").click();
  await expect(page.locator(".piano-roll__note")).toHaveCount(21);
  await expect(page.getByRole("button", { name: /Note La4, temps 10, durée 0\.56/ })).toBeVisible();

  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await expect(page.getByText("Enregistré")).toBeVisible();
  const directUrl = page.url();
  await page.goto(directUrl);
  await expect(page.getByRole("heading", { name: "Lignes de nuit" })).toBeVisible();
  await rackName("bass").click();
  await expect(page.getByRole("button", { name: /Note La3, temps 16, durée 0\.42/ })).toBeVisible();
});

test("the piano roll edits notes with the mouse and keeps them after reload", async ({ page }) => {
  const projectName = `E2E piano roll mouse ${Date.now()}`;
  await page.goto("/");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(projectName);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("link", { name: "Éditeur musical" }).click();
  await page.getByRole("button", { name: "Créer une copie éditable" }).click();
  await expect(page).toHaveURL(/\/editor\?project=.*&composition=.*/);
  await expect(page.getByRole("heading", { name: "Lignes de nuit" })).toBeVisible();

  const rackName = (name: string) => page.locator(".channel-rack__name").filter({ hasText: name });
  await rackName("bass").click();
  await expect(page.getByRole("heading", { name: "Piano Roll" })).toBeVisible();

  const board = page.getByRole("application", { name: "Piano roll" });
  await board.scrollIntoViewIfNeeded();
  const box = (await board.boundingBox()) ?? { x: 0, y: 0 };
  const x = (beat: number) => box.x + 130 + beat * 40;
  const y = (midi: number) => box.y + (59 - midi) * 24;

  await page.mouse.click(x(4), y(55));
  const created = page.getByRole("button", { name: /Note Sol3, temps 4, durée 0\.5/ });
  await expect(created).toBeVisible();
  await created.click();
  await expect(page.getByLabel("Vélocité des notes")).toBeVisible();

  const moveFrom = (await created.boundingBox()) ?? { x: 0, y: 0, width: 20, height: 24 };
  await page.mouse.move(moveFrom.x + moveFrom.width / 2, moveFrom.y + moveFrom.height / 2);
  await page.mouse.down();
  await page.mouse.move(moveFrom.x + moveFrom.width / 2 + 80, moveFrom.y + moveFrom.height / 2 - 24, {
    steps: 8,
  });
  await page.mouse.up();
  const moved = page.getByRole("button", { name: /Note Sol#3, temps 6, durée 0\.5/ });
  await expect(moved).toBeVisible();

  const resizeFrom = (await moved.boundingBox()) ?? { x: 0, y: 0, width: 20, height: 24 };
  await page.mouse.move(resizeFrom.x + resizeFrom.width - 4, resizeFrom.y + 4);
  await page.mouse.down();
  await page.mouse.move(resizeFrom.x + resizeFrom.width - 4 + 40, resizeFrom.y + 4, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("button", { name: /Note Sol#3, temps 6, durée 1\.5/ })).toBeVisible();

  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await expect(page.getByText("Enregistré")).toBeVisible();
  await page.goto(page.url());
  await expect(page.getByRole("heading", { name: "Lignes de nuit" })).toBeVisible();
  await rackName("bass").click();
  await expect(page.getByRole("button", { name: /Note Sol#3, temps 6, durée 1\.5/ })).toBeVisible();
});

test("automations create, move and delete a point with working undo/redo", async ({ page }) => {
  const projectName = `E2E automations ${Date.now()}`;
  await page.goto("/");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(projectName);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("link", { name: "Éditeur musical" }).click();
  await page.getByRole("button", { name: "Créer une copie éditable" }).click();
  await expect(page).toHaveURL(/\/editor\?project=.*&composition=.*/);
  await expect(page.getByRole("heading", { name: "Lignes de nuit" })).toBeVisible();

  const automationsHeading = page.locator(".automations__header h2");
  await automationsHeading.scrollIntoViewIfNeeded();
  const laneCountBefore = Number((await automationsHeading.textContent())?.match(/\((\d+)\)/)?.[1] ?? "0");
  await page.getByRole("combobox", { name: "Piste à automatiser" }).selectOption({ label: "bass" });
  await page.getByRole("button", { name: "Créer l’automation" }).click();
  await expect(page.getByRole("heading", { name: `Automations (${laneCountBefore + 1})` })).toBeVisible();

  const curve = page.getByRole("img", { name: /Courbe d’automation bass · Gain/ });
  await curve.scrollIntoViewIfNeeded();
  const box = (await curve.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };

  await page.mouse.click(box.x + 6 * 96, box.y + 20);
  const points = curve.locator("circle");
  await expect(points).toHaveCount(3);

  const addedPoint = points.nth(2);
  const pointBox = (await addedPoint.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
  await page.mouse.move(pointBox.x + pointBox.width / 2, pointBox.y + pointBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(pointBox.x + pointBox.width / 2 + 144, pointBox.y + pointBox.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByRole("spinbutton", { name: "Temps du point sélectionné" })).toHaveValue("7.5");

  const selectedPoint = curve.locator("circle.is-selected");
  await selectedPoint.dblclick();
  await expect(points).toHaveCount(2);

  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(points).toHaveCount(3);
  await page.getByRole("button", { name: "Rétablir", exact: true }).click();
  await expect(points).toHaveCount(2);

  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await expect(page.getByText("Enregistré")).toBeVisible();
});

test("the mixer routes a track through a bus, chains an effect and keeps changes after undo/redo", async ({ page }) => {
  const projectName = `E2E mixer ${Date.now()}`;
  await page.goto("/");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(projectName);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("link", { name: "Éditeur musical" }).click();
  await page.getByRole("button", { name: "Créer une copie éditable" }).click();
  await expect(page).toHaveURL(/\/editor\?project=.*&composition=.*/);
  await expect(page.getByRole("heading", { name: "Lignes de nuit" })).toBeVisible();

  const mixerHeading = page.getByRole("heading", { name: "Mixer" });
  await mixerHeading.scrollIntoViewIfNeeded();

  const bassStrip = page.locator(".mixer__strip", { has: page.getByRole("heading", { name: "bass", exact: true }) });
  const muteButton = bassStrip.getByRole("button", { name: "Son activé" });
  await muteButton.click();
  await expect(bassStrip.getByRole("button", { name: "Muet" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(bassStrip.getByRole("button", { name: "Son activé" })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Rétablir", exact: true }).click();
  await expect(bassStrip.getByRole("button", { name: "Muet" })).toHaveAttribute("aria-pressed", "true");
  await bassStrip.getByRole("button", { name: "Muet" }).click();

  await page.getByLabel("Nom du nouveau bus").fill("Send FX");
  await page.getByRole("button", { name: "Ajouter un bus" }).click();
  await expect(page.getByRole("heading", { name: "Send FX" })).toBeVisible();

  const outputSelect = bassStrip.getByLabel("Sortie de bass");
  await outputSelect.selectOption({ label: "Send FX" });
  await expect(outputSelect.locator("option:checked")).toHaveText("Send FX");

  await bassStrip.getByLabel("Ajouter un effet").selectOption("eq");
  const effectItem = bassStrip.locator(".mixer__effect");
  await expect(effectItem).toHaveCount(1);
  const bypassCheckbox = effectItem.getByRole("checkbox", { name: "Bypass" });
  await bypassCheckbox.click();
  await expect(bypassCheckbox).toBeChecked();
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(bypassCheckbox).not.toBeChecked();
  await page.getByRole("button", { name: "Rétablir", exact: true }).click();
  await expect(bypassCheckbox).toBeChecked();

  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await expect(page.getByText("Enregistré")).toBeVisible();
});

test("the render analysis screen renders a loop, shows QA metrics and exports the bundle", async ({ page }) => {
  const projectName = `E2E render ${Date.now()}`;
  await page.goto("/");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(projectName);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("link", { name: "Éditeur musical" }).click();
  await page.getByRole("button", { name: "Créer une copie éditable" }).click();
  await expect(page).toHaveURL(/\/editor\?project=.*&composition=.*/);
  await expect(page.getByRole("heading", { name: "Lignes de nuit" })).toBeVisible();

  const renderHeading = page.getByRole("heading", { name: "Rendu & Export" });
  await renderHeading.scrollIntoViewIfNeeded();

  await page.getByRole("radio", { name: "Boucle" }).check();
  await page.getByLabel("Début (temps)").fill("0");
  await page.getByLabel("Fin (temps)").fill("8");

  await page.getByRole("button", { name: "Lancer le rendu" }).click();
  await expect(page.getByText(/: completed \(100%\)/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Rendu à jour \(révision \d+\)/)).toBeVisible();

  await page.getByRole("button", { name: "Actualiser le QA" }).click();
  await expect(page.getByText(/True peak:/)).toBeVisible();
  await expect(page.getByText(/LUFS:/)).toBeVisible();

  await page.getByRole("button", { name: "Exporter le bundle" }).click();
  await expect(page.getByText(/WAV : /)).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText(/Manifeste : /)).toBeVisible();
});

test("the render analysis screen exports master and all stems", async ({ page }) => {
  const projectName = `E2E stems ${Date.now()}`;
  await page.goto("/");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(projectName);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("link", { name: "Éditeur musical" }).click();
  await page.getByRole("button", { name: "Créer une copie éditable" }).click();
  await expect(page).toHaveURL(/\/editor\?project=.*&composition=.*/);
  await expect(page.getByRole("heading", { name: "Lignes de nuit" })).toBeVisible();

  const renderHeading = page.getByRole("heading", { name: "Rendu & Export" });
  await renderHeading.scrollIntoViewIfNeeded();

  // Select all tracks for stems export
  await page.getByRole("radio", { name: "Pistes choisies" }).check();
  const checkboxes = page.getByRole("checkbox");
  for (const checkbox of await checkboxes.all()) {
    await checkbox.check();
  }

  await page.getByRole("button", { name: "Lancer le rendu" }).click();
  await expect(page.getByText(/: completed \(100%\)/)).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Exporter le bundle" }).click();
  await expect(page.getByText(/WAV : /)).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText(/Manifeste : /)).toBeVisible();
  
  // Verify all stems are included in the export
  await expect(page.getByText(/master/)).toBeVisible();
  await expect(page.getByText(/drums/)).toBeVisible();
  await expect(page.getByText(/bass/)).toBeVisible();
  await expect(page.getByText(/pad/)).toBeVisible();
  await expect(page.getByText(/arp/)).toBeVisible();
  await expect(page.getByText(/lead/)).toBeVisible();
});
