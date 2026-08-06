import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RenderAnalysis } from "./RenderAnalysis";
import type { Track } from "./editorStore";

function jsonResponse(payload: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload } as Response;
}

class MockAudioContext {
  decodeAudioData() {
    return Promise.resolve({
      duration: 1.5,
      numberOfChannels: 1,
      getChannelData: () => new Float32Array(100).fill(0.5),
    });
  }
}

const TRACKS: Track[] = [
  { id: "t-1", name: "Kick", kind: "drum" },
  { id: "t-2", name: "Bass", kind: "bass" },
];

function defaultProps(
  overrides: Partial<ComponentProps<typeof RenderAnalysis>> = {},
): ComponentProps<typeof RenderAnalysis> {
  return {
    projectId: "p1",
    compositionId: "c1",
    tracks: TRACKS,
    selectedClipIds: [],
    renderFormat: "wav_pcm24",
    onSetRenderFormat: vi.fn(),
    ensureSaved: vi.fn().mockResolvedValue({ id: "c1", revision: 1 }),
    ...overrides,
  };
}

function stubApi(options?: {
  jobStates?: Array<{ state: string; progress: number; error?: string }>;
  renders?: unknown[];
  qa?: unknown;
}) {
  const calls: { method: string; path: string; body?: string }[] = [];
  let jobCallIndex = 0;
  const jobStates = options?.jobStates ?? [{ state: "completed", progress: 100 }];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      calls.push({ method, path, body: init?.body as string | undefined });

      if (path.endsWith("/render") && method === "POST") {
        return jsonResponse({ id: "job-1", state: "queued", progress: 0 });
      }
      if (path === "/api/jobs/job-1" && method === "GET") {
        const next = jobStates[Math.min(jobCallIndex, jobStates.length - 1)];
        jobCallIndex += 1;
        return jsonResponse({ id: "job-1", ...next });
      }
      if (path === "/api/jobs/job-1/cancel" && method === "POST") {
        return jsonResponse({ id: "job-1", state: "cancelled", progress: 50 });
      }
      if (path.endsWith("/renders") && method === "GET") {
        return jsonResponse(
          options?.renders ?? [
            { revision: 2, up_to_date: true, stale: false, manifest_url: "/manifest.json", qa_url: "/qa.json" },
            { revision: 1, up_to_date: false, stale: true, manifest_url: null, qa_url: null },
          ],
        );
      }
      if (path.endsWith("/qa.json") && method === "GET") {
        return jsonResponse(
          options?.qa ?? {
            passed: true,
            profile: "standard",
            issues: [],
            metrics: { sample_peak: 0.9, true_peak: 0.95, lufs: -14, rms: 0.3, dc_offset: 0.001 },
          },
        );
      }
      if (path.endsWith("/promote") && method === "POST") {
        return jsonResponse({ revision: 2, promoted: true, waiver: null });
      }
      if (path.endsWith("/export") && method === "POST") {
        return jsonResponse({ wav: "/exports/c1.wav", manifest: "/exports/c1.manifest.json" });
      }
      if (path.endsWith("/artifact") && method === "GET") {
        return jsonResponse({ wav: "renders/c1.wav" });
      }
      if (path.startsWith("/projects/") && method === "GET") {
        return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) } as unknown as Response;
      }
      return jsonResponse({ detail: "Introuvable" }, 404);
    }),
  );
  return calls;
}

describe("RenderAnalysis", () => {
  beforeEach(() => {
    stubApi();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("affiche le titre, la portée par défaut et les actions principales", () => {
    render(<RenderAnalysis {...defaultProps()} />);

    expect(screen.getByText("Rendu & Export")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Morceau entier" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Lancer le rendu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actualiser le QA" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Promouvoir en master" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exporter le bundle" })).toBeInTheDocument();
  });

  it("sauvegarde puis lance un rendu du morceau entier et suit l'état du job", async () => {
    const ensureSaved = vi.fn().mockResolvedValue({ id: "c1", revision: 1 });
    const calls = stubApi();
    render(<RenderAnalysis {...defaultProps({ ensureSaved })} />);

    fireEvent.click(screen.getByRole("button", { name: "Lancer le rendu" }));

    await waitFor(() => expect(ensureSaved).toHaveBeenCalled());
    await waitFor(() =>
      expect(calls.some((call) => call.method === "POST" && call.path.endsWith("/render") && call.body === "{}")).toBe(
        true,
      ),
    );
    await waitFor(() => expect(screen.getByText(/completed/)).toBeInTheDocument());
  });

  it("n'appelle pas le rendu si la sauvegarde préalable échoue", async () => {
    const ensureSaved = vi.fn().mockResolvedValue(null);
    const calls = stubApi();
    render(<RenderAnalysis {...defaultProps({ ensureSaved })} />);

    fireEvent.click(screen.getByRole("button", { name: "Lancer le rendu" }));

    await screen.findByText("Sauvegarde requise avant le rendu");
    expect(calls.some((call) => call.path.endsWith("/render"))).toBe(false);
  });

  it("lance un rendu limité aux pistes cochées", async () => {
    const calls = stubApi();
    render(<RenderAnalysis {...defaultProps()} />);

    fireEvent.click(screen.getByRole("radio", { name: "Pistes choisies" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Kick" }));
    fireEvent.click(screen.getByRole("button", { name: "Lancer le rendu" }));

    await waitFor(() => {
      const call = calls.find((item) => item.method === "POST" && item.path.endsWith("/render"));
      expect(call && JSON.parse(call.body ?? "{}")).toEqual({ track_ids: ["t-1"] });
    });
  });

  it("lance un rendu en boucle avec la plage indiquée", async () => {
    const calls = stubApi();
    render(<RenderAnalysis {...defaultProps()} />);

    fireEvent.click(screen.getByRole("radio", { name: "Boucle" }));
    fireEvent.change(screen.getByLabelText("Début (temps)"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Fin (temps)"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Lancer le rendu" }));

    await waitFor(() => {
      const call = calls.find((item) => item.method === "POST" && item.path.endsWith("/render"));
      expect(call && JSON.parse(call.body ?? "{}")).toEqual({ start_beat: 4, end_beat: 12, loop: true });
    });
  });

  it("lance un rendu sur la sélection de clips courante", async () => {
    const calls = stubApi();
    render(<RenderAnalysis {...defaultProps({ selectedClipIds: ["clip-9"] })} />);

    fireEvent.click(screen.getByRole("radio", { name: /Sélection/ }));
    fireEvent.click(screen.getByRole("button", { name: "Lancer le rendu" }));

    await waitFor(() => {
      const call = calls.find((item) => item.method === "POST" && item.path.endsWith("/render"));
      expect(call && JSON.parse(call.body ?? "{}")).toEqual({ clip_ids: ["clip-9"] });
    });
  });

  it("change le format de rendu sélectionné", () => {
    const onSetRenderFormat = vi.fn();
    render(<RenderAnalysis {...defaultProps({ onSetRenderFormat })} />);

    fireEvent.change(screen.getByLabelText("Format"), { target: { value: "wav_float32" } });

    expect(onSetRenderFormat).toHaveBeenCalledWith("wav_float32");
  });

  it("permet d'annuler un rendu en cours", async () => {
    const calls = stubApi({ jobStates: [{ state: "running", progress: 30 }] });
    render(<RenderAnalysis {...defaultProps()} />);

    fireEvent.click(screen.getByRole("button", { name: "Lancer le rendu" }));

    const cancelButton = await screen.findByRole("button", { name: "Annuler le rendu" });
    fireEvent.click(cancelButton);

    await waitFor(() => expect(calls.some((call) => call.path.endsWith("/cancel"))).toBe(true));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Annuler le rendu" })).toBeNull());
  });

  it("affiche un bouton Réessayer quand le rendu échoue", async () => {
    stubApi({ jobStates: [{ state: "failed", progress: 40, error: "moteur indisponible" }] });
    render(<RenderAnalysis {...defaultProps()} />);

    fireEvent.click(screen.getByRole("button", { name: "Lancer le rendu" }));

    await screen.findByText("moteur indisponible");
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });

  it("décode la forme d'onde et affiche la durée après un rendu réussi", async () => {
    vi.stubGlobal("AudioContext", MockAudioContext);
    const calls = stubApi();
    render(<RenderAnalysis {...defaultProps()} />);

    fireEvent.click(screen.getByRole("button", { name: "Lancer le rendu" }));

    await waitFor(() => expect(calls.some((call) => call.path.endsWith("/artifact"))).toBe(true));
    await screen.findByText("Durée : 1.50 s");
    expect(screen.getByRole("img", { name: "Forme d’onde du rendu" })).toBeInTheDocument();
  });

  it("actualise le QA du rendu le plus récent avec les métriques nommées", async () => {
    stubApi({
      qa: {
        passed: true,
        profile: "standard",
        issues: [],
        metrics: { sample_peak: 0.81, true_peak: 0.9, lufs: -13.2, rms: 0.25, dc_offset: 0.004 },
      },
    });
    render(<RenderAnalysis {...defaultProps()} />);

    fireEvent.click(screen.getByRole("button", { name: "Actualiser le QA" }));

    await screen.findByText(/standard/i);
    expect(screen.getByText("Réussi")).toBeInTheDocument();
    expect(screen.getByText(/True peak: 0.900/)).toBeInTheDocument();
    expect(screen.getByText(/LUFS: -13.200/)).toBeInTheDocument();
    expect(screen.getByText("Clipping : Non")).toBeInTheDocument();
  });

  it("signale le clipping quand il figure dans les problèmes QA", async () => {
    stubApi({
      qa: {
        passed: false,
        profile: "strict",
        issues: ["clipping"],
        metrics: { sample_peak: 1.0, true_peak: 1.02, lufs: -4, rms: 0.9, dc_offset: 0.01 },
      },
    });
    render(<RenderAnalysis {...defaultProps()} />);

    fireEvent.click(screen.getByRole("button", { name: "Actualiser le QA" }));

    await screen.findByText("Clipping : Oui");
  });

  it("affiche l'état à jour du dernier rendu après actualisation du QA", async () => {
    stubApi({ renders: [{ revision: 2, up_to_date: true, stale: false, manifest_url: "/m.json", qa_url: "/qa.json" }] });
    render(<RenderAnalysis {...defaultProps()} />);

    fireEvent.click(screen.getByRole("button", { name: "Actualiser le QA" }));

    await screen.findByText("Rendu à jour (révision 2)");
  });

  it("affiche l'état périmé du dernier rendu après actualisation du QA", async () => {
    stubApi({ renders: [{ revision: 3, up_to_date: false, stale: true, manifest_url: "/m.json", qa_url: "/qa.json" }] });
    render(<RenderAnalysis {...defaultProps()} />);

    fireEvent.click(screen.getByRole("button", { name: "Actualiser le QA" }));

    await screen.findByText("Rendu périmé (révision 3)");
  });

  it("affiche l'échec du QA et les problèmes associés", async () => {
    stubApi({ qa: { passed: false, profile: "strict", issues: ["Pic trop élevé"], metrics: {} } });
    render(<RenderAnalysis {...defaultProps()} />);

    fireEvent.click(screen.getByRole("button", { name: "Actualiser le QA" }));

    await screen.findByText("strict");
    const failBadge = await screen.findByText("Échec");
    expect(failBadge).toHaveClass("qa-fail");
    expect(screen.getByText("Pic trop élevé")).toBeInTheDocument();
  });

  it("promeut le rendu le plus récent en master", async () => {
    const calls = stubApi();
    render(<RenderAnalysis {...defaultProps()} />);

    fireEvent.click(screen.getByRole("button", { name: "Promouvoir en master" }));

    await waitFor(() =>
      expect(calls.some((call) => call.method === "POST" && call.path.endsWith("/renders/2/promote"))).toBe(true),
    );
  });

  it("exporte le bundle du rendu le plus récent", async () => {
    const calls = stubApi();
    render(<RenderAnalysis {...defaultProps()} />);

    fireEvent.click(screen.getByRole("button", { name: "Exporter le bundle" }));

    await waitFor(() =>
      expect(calls.some((call) => call.method === "POST" && call.path.endsWith("/renders/2/export"))).toBe(true),
    );
    expect(screen.getByText((content) => content.includes("/exports/c1.wav"))).toBeInTheDocument();
  });

  it("affiche une erreur quand la promotion échoue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const path = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (path.endsWith("/renders") && method === "GET") {
          return jsonResponse([
            { revision: 2, up_to_date: true, stale: false, manifest_url: "/m.json", qa_url: "/qa.json" },
          ]);
        }
        if (path.endsWith("/promote") && method === "POST") {
          return jsonResponse({ detail: "qa_check_failed" }, 422);
        }
        return jsonResponse({ detail: "Introuvable" }, 404);
      }),
    );

    render(<RenderAnalysis {...defaultProps()} />);

    fireEvent.click(screen.getByRole("button", { name: "Promouvoir en master" }));

    await screen.findByText("qa_check_failed");
  });

  it("affiche une erreur quand aucun rendu n'est disponible pour la promotion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const path = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (path.endsWith("/renders") && method === "GET") {
          return jsonResponse([]);
        }
        return jsonResponse({ detail: "Introuvable" }, 404);
      }),
    );

    render(<RenderAnalysis {...defaultProps()} />);

    fireEvent.click(screen.getByRole("button", { name: "Promouvoir en master" }));

    await screen.findByText("Aucun rendu disponible");
  });

  it("capture l'erreur d'export du bundle", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const path = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (path.endsWith("/renders") && method === "GET") {
          return jsonResponse([
            { revision: 2, up_to_date: true, stale: false, manifest_url: "/m.json", qa_url: "/qa.json" },
          ]);
        }
        if (path.endsWith("/export") && method === "POST") {
          return jsonResponse({ detail: "render_artifact_missing" }, 422);
        }
        return jsonResponse({ detail: "Introuvable" }, 404);
      }),
    );

    render(<RenderAnalysis {...defaultProps()} />);

    fireEvent.click(screen.getByRole("button", { name: "Exporter le bundle" }));

    await screen.findByText("render_artifact_missing");
  });

  it("désactive les actions tant qu'aucune composition n'est fournie", () => {
    render(<RenderAnalysis {...defaultProps({ projectId: "", compositionId: "" })} />);

    expect(screen.getByRole("button", { name: "Lancer le rendu" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Promouvoir en master" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Exporter le bundle" })).toBeDisabled();
  });

  it("masque le QA sans planter si la récupération échoue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const path = String(input);
        if (path.endsWith("/renders")) {
          return jsonResponse([{ revision: 2, up_to_date: true, stale: false, manifest_url: "/m.json", qa_url: "/missing.json" }]);
        }
        if (path.endsWith("/missing.json")) {
          return jsonResponse({ detail: "Introuvable" }, 404);
        }
        return jsonResponse({ detail: "Introuvable" }, 404);
      }),
    );

    render(<RenderAnalysis {...defaultProps()} />);

    fireEvent.click(screen.getByRole("button", { name: "Actualiser le QA" }));

    await waitFor(() => expect(screen.queryByText("qa-report")).toBeNull());
  });

  it("désactive l'export quand aucun rendu n'est disponible", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const path = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (path.endsWith("/renders") && method === "GET") {
          return jsonResponse([]);
        }
        return jsonResponse({ detail: "Introuvable" }, 404);
      }),
    );

    render(<RenderAnalysis {...defaultProps()} />);

    fireEvent.click(screen.getByRole("button", { name: "Exporter le bundle" }));

    await screen.findByText("Aucun rendu disponible pour l'export");
  });
});
