import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorLanding } from "./EditorLanding";

const projects = [{ id: "project-1", name: "Projet test", compositions: [] }];
const gallery = [{ id: "example-1", title: "Lignes de nuit", tempo_bpm: 120, time_signature: [4, 4] }];
const composition = {
  ...gallery[0],
  id: "composition-1",
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

function defaultFetch() {
  return vi.fn((input: string | URL | Request) => {
    const path = String(input);
    if (path === "/api/projects") return Promise.resolve(jsonResponse(projects));
    if (path === "/api/composition-gallery") return Promise.resolve(jsonResponse(gallery));
    if (path === "/api/projects/project-1/compositions/composition-1") {
      return Promise.resolve(jsonResponse(composition));
    }
    return Promise.resolve(jsonResponse({ detail: "Introuvable" }, 404));
  });
}

function renderLanding(search = "") {
  return render(
    <EditorLanding search={search} onNavigate={vi.fn()} onDirtyChange={vi.fn()} />,
  );
}

describe("EditorLanding states", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("affiche l’état de chargement pendant la requête", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    renderLanding();

    expect(screen.getByRole("status")).toHaveTextContent("Chargement de l’éditeur…");
  });

  it("affiche l’état vide quand aucun projet ni exemple n’est disponible", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        if (String(input) === "/api/projects") return Promise.resolve(jsonResponse([]));
        if (String(input) === "/api/composition-gallery") return Promise.resolve(jsonResponse([]));
        return Promise.resolve(jsonResponse({ detail: "Introuvable" }, 404));
      }),
    );
    renderLanding();

    expect(await screen.findByText("Aucun projet ou exemple disponible.")).toBeVisible();
  });

  it("affiche l’état erreur quand l’API échoue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        if (String(input) === "/api/projects") return Promise.resolve(jsonResponse({ detail: "Serveur indisponible" }, 500));
        if (String(input) === "/api/composition-gallery") return Promise.resolve(jsonResponse({ detail: "Serveur indisponible" }, 500));
        return Promise.resolve(jsonResponse({ detail: "Introuvable" }, 404));
      }),
    );
    renderLanding();

    expect(await screen.findByRole("alert")).toHaveTextContent("Erreur : Serveur indisponible");
  });

  it("signale un projet introuvable sans charger l’éditeur", async () => {
    vi.stubGlobal("fetch", defaultFetch());
    renderLanding("?project=absent&composition=composition-1");

    expect(await screen.findByRole("alert")).toHaveTextContent("Projet introuvable.");
    expect(screen.queryByLabelText("Titre de la composition")).not.toBeInTheDocument();
  });

  it("affiche la bannière hors ligne à la perte du réseau et la retire au retour", async () => {
    vi.stubGlobal("fetch", defaultFetch());
    renderLanding("?project=project-1&composition=composition-1");

    await screen.findByRole("heading", { name: "Éditeur musical" });
    expect(screen.queryByText(/Hors ligne/)).toBeNull();

    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await act(async () => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByText(/Hors ligne/)).toHaveTextContent("Hors ligne");

    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByText(/Hors ligne/)).not.toBeInTheDocument();
  });

  it("affiche l’écran de création d’une copie sur une route éditeur sans composition", async () => {
    vi.stubGlobal("fetch", defaultFetch());
    renderLanding();

    expect(await screen.findByRole("heading", { name: "Ouvrir Lignes de nuit" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Créer une copie éditable" })).toBeVisible();
  });
});