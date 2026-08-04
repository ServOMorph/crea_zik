import { cleanup, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Application } from "./Application";

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

function stubApi(overrides?: { projects?: typeof projects; gallery?: typeof gallery }) {
  const projectList = overrides?.projects ?? projects;
  const galleryList = overrides?.gallery ?? gallery;
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL | Request) => {
      const path = String(input);
      if (path === "/api/projects") return Promise.resolve(jsonResponse(projectList));
      if (path === "/api/composition-gallery") return Promise.resolve(jsonResponse(galleryList));
      if (path === "/api/projects/project-1/compositions/composition-1") {
        return Promise.resolve(jsonResponse(composition));
      }
      return Promise.resolve(jsonResponse({ detail: "Introuvable" }, 404));
    }),
  );
}

describe("Application accessibility", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  async function runAxe(container: HTMLElement) {
    return axe.run(container, {
      rules: {
        // jsdom does not compute real layout/paint, contrast checks are meaningless here.
        "color-contrast": { enabled: false },
      },
    });
  }

  it("has no violations on the studio shell", async () => {
    const { container } = render(<Application studioPage={<div>Studio</div>} />);

    const results = await runAxe(container);
    expect(results.violations).toEqual([]);
  });

  it("has no violations on the editor workspace", async () => {
    stubApi();
    window.history.replaceState({}, "", "/editor?project=project-1&composition=composition-1");
    const { container } = render(<Application studioPage={<div>Studio</div>} />);

    await screen.findByRole("textbox", { name: "Titre de la composition" });
    const results = await runAxe(container);
    expect(results.violations).toEqual([]);
  });

  it("has no violations on the missing project state", async () => {
    stubApi();
    window.history.replaceState({}, "", "/editor?project=absent&composition=composition-1");
    const { container } = render(<Application studioPage={<div>Studio</div>} />);

    await screen.findByRole("alert");
    const results = await runAxe(container);
    expect(results.violations).toEqual([]);
  });

  it("has no violations on the empty state", async () => {
    stubApi({ projects: [], gallery: [] });
    window.history.replaceState({}, "", "/editor");
    const { container } = render(<Application studioPage={<div>Studio</div>} />);

    await screen.findByText("Aucun projet ou exemple disponible.");
    const results = await runAxe(container);
    expect(results.violations).toEqual([]);
  });
});