import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Application } from "./Application";

const projects = [{ id: "project-1", name: "Projet test", compositions: [] }];
const gallery = [{ id: "example-1", title: "Lignes de nuit", tempo_bpm: 120, time_signature: [4, 4] }];
const composition = {
  ...gallery[0],
  revision: 1,
  tracks: [{ id: "track-1", name: "Batterie", kind: "drums" }],
  patterns: [],
  clips: [],
};

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

describe("Application", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        const path = String(input);
        if (path === "/api/projects") return Promise.resolve(jsonResponse(projects));
        if (path === "/api/composition-gallery") return Promise.resolve(jsonResponse(gallery));
        if (path === "/api/projects/project-1/compositions/composition-1") {
          if (init?.method === "PUT") {
            const body = JSON.parse(String(init.body)) as {
              expected_revision: number;
              composition: typeof composition;
            };
            return Promise.resolve(jsonResponse({ ...body.composition, revision: body.expected_revision + 1 }));
          }
          return Promise.resolve(jsonResponse({ ...composition, id: "composition-1" }));
        }
        return Promise.resolve(jsonResponse({ detail: "Introuvable" }, 404));
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("navigue au clavier, met à jour le lien actif et respecte l’historique", async () => {
    const user = userEvent.setup();
    render(<Application studioPage={<h1>Studio existant</h1>} />);

    await user.tab();
    expect(screen.getByRole("button", { name: "Replier la navigation" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Studio" })).toHaveFocus();

    await user.click(screen.getByRole("link", { name: "Éditeur musical" }));
    expect(window.location.pathname).toBe("/editor");
    expect(await screen.findByRole("heading", { name: "Éditeur musical" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Éditeur musical" })).toHaveAttribute("aria-current", "page");

    await user.click(screen.getByRole("link", { name: "Studio" }));
    await act(async () => {
      window.history.back();
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(await screen.findByRole("heading", { name: "Éditeur musical" })).toBeVisible();
  });

  it("ouvre directement une composition et conserve sa route en revenant depuis le studio", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/editor?project=project-1&composition=composition-1");
    render(<Application studioPage={<h1>Studio existant</h1>} />);

    expect(await screen.findByRole("heading", { name: "Lignes de nuit" })).toBeVisible();
    await user.click(screen.getByRole("link", { name: "Studio" }));
    await user.click(screen.getByRole("link", { name: "Éditeur musical" }));

    expect(window.location.search).toBe("?project=project-1&composition=composition-1");
    expect(await screen.findByRole("heading", { name: "Lignes de nuit" })).toBeVisible();
  });

  it("signale un projet absent dans une route directe", async () => {
    window.history.replaceState({}, "", "/editor?project=absent&composition=composition-1");
    render(<Application studioPage={<h1>Studio existant</h1>} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Projet introuvable.");
  });

  it("sauvegarde une composition modifiée", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/editor?project=project-1&composition=composition-1");
    render(<Application studioPage={<h1>Studio existant</h1>} />);

    const title = await screen.findByRole("textbox", { name: "Titre de la composition" });
    await user.clear(title);
    await user.type(title, "Nuit sauvegardée");
    expect(screen.getByText("Modifications non enregistrées")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Sauvegarder" }));

    expect(await screen.findByText("Révision 2")).toBeVisible();
    expect(screen.getByText("Enregistré")).toBeVisible();
  });
});
