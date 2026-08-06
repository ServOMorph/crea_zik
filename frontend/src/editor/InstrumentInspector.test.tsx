import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InstrumentInspector } from "./InstrumentInspector";
import type { InstrumentKindRegistry } from "./instrumentRegistry";
import type { InstrumentParameters, Track } from "./editorStore";

const track: Track = {
  id: "track-1",
  name: "Basse",
  kind: "bass",
  instrument: {
    parameters: {
      lowpass_hz: 500,
      oscillators: [
        { ratio: 1, gain: 1 },
        { ratio: 2, gain: 0.33 },
      ],
    },
  },
};

const registry: InstrumentKindRegistry = {
  groups: [
    {
      id: "filter",
      label: "Filtre",
      parameters: [
        {
          type: "scalar",
          path: "lowpass_hz",
          label: "Passe-bas",
          kind: "hz",
          default: 620,
          minimum: 20,
          maximum: 20000,
          step: 1,
          unit: "Hz",
        },
      ],
    },
    {
      id: "oscillators",
      label: "Oscillateurs",
      parameters: [
        {
          type: "list",
          path: "oscillators",
          label: "Oscillateurs",
          itemLabel: "Harmonique",
          minItems: 1,
          maxItems: 8,
          fields: [
            {
              path: "oscillators[].ratio",
              label: "Ratio",
              kind: "ratio",
              default: 1,
              minimum: 0.25,
              maximum: 8,
              step: 0.01,
              unit: "",
            },
          ],
        },
      ],
    },
  ],
  defaults: { lowpass_hz: 620, oscillators: [{ ratio: 1, gain: 1 }] },
};

function renderInspector(overrides: Partial<Parameters<typeof InstrumentInspector>[0]> = {}) {
  const props = {
    track,
    registry,
    projectId: "project-1",
    compositionId: "composition-1",
    onSetParameter: vi.fn(),
    onResetAll: vi.fn(),
    onSetListLength: vi.fn(),
    onRestoreParameters: vi.fn(),
    onPreviewPattern: vi.fn(),
    onPreviewTrack: vi.fn(),
    ...overrides,
  };
  const utils = render(<InstrumentInspector {...props} />);
  return { props, ...utils };
}

describe("InstrumentInspector", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("affiche les groupes, contrôles et valeurs du registre", () => {
    renderInspector();
    expect(screen.getByRole("group", { name: "Filtre" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Oscillateurs" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Passe-bas" })).toHaveValue("500");
    expect(screen.getByRole("slider", { name: "Harmonique 1 — Ratio" })).toHaveValue("1");
    expect(screen.getByRole("slider", { name: "Harmonique 2 — Ratio" })).toHaveValue("2");
  });

  it("émet un réglage borné lors du déplacement du curseur", () => {
    const { props } = renderInspector();
    fireEvent.change(screen.getByRole("slider", { name: "Passe-bas" }), { target: { value: "1000" } });
    expect(props.onSetParameter).toHaveBeenCalledWith(
      "lowpass_hz",
      1000,
      {
        minimum: 20,
        maximum: 20000,
        default: 620,
      },
      true,
    );
  });

  it("émet un réglage précis via la saisie numérique", () => {
    const { props } = renderInspector();
    fireEvent.change(screen.getByLabelText("Passe-bas — valeur précise"), { target: { value: "1250" } });
    expect(props.onSetParameter).toHaveBeenCalledWith(
      "lowpass_hz",
      1250,
      {
        minimum: 20,
        maximum: 20000,
        default: 620,
      },
      false,
    );
  });

  it("réinitialise un paramètre vers sa valeur par défaut", () => {
    const { props } = renderInspector();
    const resets = screen.getAllByRole("button", { name: "Réinitialiser" });
    fireEvent.click(resets[0]);
    expect(props.onSetParameter).toHaveBeenCalledWith("lowpass_hz", 620, {
      minimum: 20,
      maximum: 20000,
      default: 620,
    });
  });

  it("ajoute et retire des éléments de liste dans les bornes", () => {
    const { props } = renderInspector();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un élément à Oscillateurs" }));
    expect(props.onSetListLength).toHaveBeenCalledWith("oscillators", 3, expect.any(Function));
    fireEvent.click(screen.getByRole("button", { name: "Retirer un élément de Oscillateurs" }));
    expect(props.onSetListLength).toHaveBeenCalledWith("oscillators", 1, expect.any(Function));
  });

  it("réinitialise tout l'instrument", () => {
    const { props } = renderInspector();
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser tout" }));
    expect(props.onResetAll).toHaveBeenCalledTimes(1);
  });

  it("capture l'avant et restaure les paramètres d'origine", () => {
    const { props } = renderInspector();
    fireEvent.click(screen.getByRole("button", { name: "Comparer avant/après" }));
    expect(screen.getByRole("button", { name: "Comparaison active" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Restaurer l’avant" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restaurer l’avant" }));
    expect(props.onRestoreParameters).toHaveBeenCalledWith({
      lowpass_hz: 500,
      oscillators: [
        { ratio: 1, gain: 1 },
        { ratio: 2, gain: 0.33 },
      ],
    });
  });

  it("bascule le bypass qui affiche les valeurs par défaut du registre", () => {
    renderInspector();
    const bypass = screen.getByRole("button", { name: "Écouter l’original (bypass)" });
    fireEvent.click(bypass);
    expect(bypass).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("slider", { name: "Passe-bas" })).toHaveValue("620");
  });

  it("préécoute la note avec les paramètres locaux de la piste", async () => {
    const previewBodies: Array<{ track_id: string; midi_note: number; parameters: InstrumentParameters }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/instrument-preview")) {
          previewBodies.push(JSON.parse(String(init?.body)) as (typeof previewBodies)[number]);
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ wav: "previews/instrument-track-1.wav" }),
          } as Response);
        }
        if (url.endsWith(".wav")) {
          return Promise.resolve({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(0) } as Response);
        }
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}) } as Response);
      }),
    );
    const fakeSource = { buffer: null, connect: vi.fn(), start: vi.fn() };
    const fakeContext = {
      destination: {},
      decodeAudioData: async () => ({}) as AudioBuffer,
      createBufferSource: () => fakeSource,
    };
    vi.stubGlobal(
      "AudioContext",
      vi.fn(() => fakeContext),
    );

    const { props } = renderInspector();
    fireEvent.click(screen.getByRole("button", { name: "Écouter la note" }));

    await waitFor(() => expect(previewBodies).toHaveLength(1));
    expect(previewBodies[0].track_id).toBe("track-1");
    expect(previewBodies[0].midi_note).toBe(60);
    expect(previewBodies[0].parameters.lowpass_hz).toBe(500);
    expect(previewBodies[0].parameters.oscillators).toEqual([
      { ratio: 1, gain: 1 },
      { ratio: 2, gain: 0.33 },
    ]);
    expect(props.onPreviewPattern).not.toHaveBeenCalled();
  });

  it("préécoute le pattern et la piste via les rappels", () => {
    const { props } = renderInspector();
    fireEvent.click(screen.getByRole("button", { name: "Préécouter le pattern" }));
    fireEvent.click(screen.getByRole("button", { name: "Préécouter la piste" }));
    expect(props.onPreviewPattern).toHaveBeenCalledTimes(1);
    expect(props.onPreviewTrack).toHaveBeenCalledTimes(1);
  });

  it("affiche un état dégradé sans registre", () => {
    renderInspector({ registry: null });
    expect(screen.getByRole("status")).toHaveTextContent("Registre d’instruments indisponible.");
  });

  it("désactive la préécoute du pattern quand la piste n'a pas de pattern", () => {
    renderInspector({ onPreviewPattern: null });
    expect(screen.getByRole("button", { name: "Préécouter le pattern" })).toBeDisabled();
  });

  it("signale l'échec de préécoute", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: false, status: 503, json: async () => ({}) } as Response)),
    );
    vi.stubGlobal(
      "AudioContext",
      vi.fn(() => ({ destination: {} })),
    );
    renderInspector();
    fireEvent.click(screen.getByRole("button", { name: "Écouter la note" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Préécoute indisponible (HTTP 503)");
  });
});
