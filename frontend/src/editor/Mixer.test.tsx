import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEditorState } from "./editorStore";
import type { ChannelSelector, EditorState } from "./editorStore";
import { Mixer } from "./Mixer";
import type { MixerProps } from "./Mixer";

function makeState(overrides: Partial<EditorState["composition"]> = {}): EditorState {
  return createEditorState({
    id: "composition-1",
    revision: 0,
    title: "Lignes de nuit",
    tempo_bpm: 120,
    time_signature: [4, 4] as [number, number],
    tracks: [
      { id: "track-1", name: "Pad", kind: "pad", gain: 1, pan: 0 },
      { id: "track-2", name: "Basse", kind: "bass", gain: 1, pan: 0 },
    ],
    patterns: [],
    clips: [],
    markers: [],
    mixer_channels: [
      {
        id: "channel-1",
        track_id: "track-1",
        gain: 1,
        pan: 0,
        mute: false,
        solo: false,
        output: "master",
        sends: {},
        effects: [{ id: "effect-1", kind: "eq", bypass: false, parameters: { freq_hz: 1000, gain_db: 0, q: 1 } }],
      },
    ],
    master_channel: {
      id: "master-1",
      track_id: null,
      gain: 1,
      pan: 0,
      mute: false,
      solo: false,
      output: "master",
      sends: {},
      effects: [],
    },
    ...overrides,
  });
}

type Harness = {
  onSetFlag: ReturnType<typeof vi.fn>;
  onSetField: ReturnType<typeof vi.fn>;
  onSetOutput: ReturnType<typeof vi.fn>;
  onSetSend: ReturnType<typeof vi.fn>;
  onAddBus: ReturnType<typeof vi.fn>;
  onRemoveBus: ReturnType<typeof vi.fn>;
  onAddEffect: ReturnType<typeof vi.fn>;
  onRemoveEffect: ReturnType<typeof vi.fn>;
  onMoveEffect: ReturnType<typeof vi.fn>;
  onSetEffectBypass: ReturnType<typeof vi.fn>;
  onSetEffectParameter: ReturnType<typeof vi.fn>;
  onSetStemFaderMode: ReturnType<typeof vi.fn>;
};

function renderMixer(state: EditorState): Harness {
  const harness: Harness = {
    onSetFlag: vi.fn(),
    onSetField: vi.fn(),
    onSetOutput: vi.fn(),
    onSetSend: vi.fn(),
    onAddBus: vi.fn(),
    onRemoveBus: vi.fn(),
    onAddEffect: vi.fn(),
    onRemoveEffect: vi.fn(),
    onMoveEffect: vi.fn(),
    onSetEffectBypass: vi.fn(),
    onSetEffectParameter: vi.fn(),
    onSetStemFaderMode: vi.fn(),
  };
  const props: MixerProps = {
    editor: state,
    registry: null,
    projectId: "project-1",
    compositionId: "composition-1",
    ensureSaved: vi.fn().mockResolvedValue(state.composition),
    ...harness,
  };
  render(<Mixer {...props} />);
  return harness;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Mixer", () => {
  it("affiche une tranche par piste et la tranche master", () => {
    renderMixer(makeState());
    expect(screen.getByRole("heading", { name: "Pad" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Basse" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Master" })).toBeInTheDocument();
  });

  it("bascule le mute d’une piste via son canal existant", () => {
    const harness = renderMixer(makeState());
    fireEvent.click(screen.getAllByRole("button", { name: "Son activé" })[0]);
    expect(harness.onSetFlag).toHaveBeenCalledWith(
      { kind: "track", trackId: "track-1" } satisfies ChannelSelector,
      "mute",
      true,
    );
  });

  it("bascule le solo d’une piste sans canal existant", () => {
    const harness = renderMixer(makeState());
    fireEvent.click(screen.getAllByRole("button", { name: "Solo" })[1]);
    expect(harness.onSetFlag).toHaveBeenCalledWith(
      { kind: "track", trackId: "track-2" } satisfies ChannelSelector,
      "solo",
      true,
    );
  });

  it("modifie le gain d’une piste", () => {
    const harness = renderMixer(makeState());
    fireEvent.change(screen.getByLabelText("Gain de Pad"), { target: { value: "1.5" } });
    expect(harness.onSetField).toHaveBeenCalledWith(
      { kind: "track", trackId: "track-1" } satisfies ChannelSelector,
      "gain",
      1.5,
    );
  });

  it("modifie le pan d’une piste", () => {
    const harness = renderMixer(makeState());
    fireEvent.change(screen.getByLabelText("Pan de Pad"), { target: { value: "-0.5" } });
    expect(harness.onSetField).toHaveBeenCalledWith(
      { kind: "track", trackId: "track-1" } satisfies ChannelSelector,
      "pan",
      -0.5,
    );
  });

  it("modifie le gain du master", () => {
    const harness = renderMixer(makeState());
    fireEvent.change(screen.getByLabelText("Gain du master"), { target: { value: "0.8" } });
    expect(harness.onSetField).toHaveBeenCalledWith({ kind: "master" } satisfies ChannelSelector, "gain", 0.8);
  });

  it("ajoute un bus depuis le champ nommé", () => {
    const harness = renderMixer(makeState());
    fireEvent.change(screen.getByLabelText("Nom du nouveau bus"), { target: { value: "Reverb bus" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un bus" }));
    expect(harness.onAddBus).toHaveBeenCalledWith("Reverb bus");
  });

  it("route une piste vers un bus existant", () => {
    const harness = renderMixer(
      makeState({
        mixer_channels: [
          {
            id: "channel-1",
            track_id: "track-1",
            gain: 1,
            pan: 0,
            mute: false,
            solo: false,
            output: "master",
            sends: {},
            effects: [],
          },
          {
            id: "bus-1",
            track_id: null,
            name: "Reverb bus",
            gain: 1,
            pan: 0,
            mute: false,
            solo: false,
            output: "master",
            sends: {},
            effects: [],
          },
        ],
      }),
    );
    fireEvent.change(screen.getByLabelText("Sortie de Pad"), { target: { value: "bus-1" } });
    expect(harness.onSetOutput).toHaveBeenCalledWith({ kind: "track", trackId: "track-1" }, "bus-1");
  });

  it("modifie un send vers un bus", () => {
    const harness = renderMixer(
      makeState({
        mixer_channels: [
          {
            id: "channel-1",
            track_id: "track-1",
            gain: 1,
            pan: 0,
            mute: false,
            solo: false,
            output: "master",
            sends: {},
            effects: [],
          },
          {
            id: "bus-1",
            track_id: null,
            name: "Reverb bus",
            gain: 1,
            pan: 0,
            mute: false,
            solo: false,
            output: "master",
            sends: {},
            effects: [],
          },
        ],
      }),
    );
    fireEvent.change(screen.getByLabelText("Send de Pad vers Reverb bus"), { target: { value: "0.4" } });
    expect(harness.onSetSend).toHaveBeenCalledWith({ kind: "track", trackId: "track-1" }, "bus-1", 0.4);
  });

  it("bascule le bypass d’un effet existant", () => {
    const harness = renderMixer(makeState());
    fireEvent.click(screen.getByRole("checkbox", { name: "Bypass" }));
    expect(harness.onSetEffectBypass).toHaveBeenCalledWith(
      { kind: "track", trackId: "track-1" } satisfies ChannelSelector,
      "effect-1",
      true,
    );
  });

  it("supprime un effet", () => {
    const harness = renderMixer(makeState());
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(harness.onRemoveEffect).toHaveBeenCalledWith(
      { kind: "track", trackId: "track-1" } satisfies ChannelSelector,
      "effect-1",
    );
  });

  it("ajoute un effet via le sélecteur", () => {
    const harness = renderMixer(makeState());
    fireEvent.change(screen.getAllByLabelText("Ajouter un effet")[0], { target: { value: "compressor" } });
    expect(harness.onAddEffect).toHaveBeenCalledWith(
      { kind: "track", trackId: "track-1" } satisfies ChannelSelector,
      "compressor",
    );
  });

  it("change le mode d’export des stems", () => {
    const harness = renderMixer(makeState());
    fireEvent.change(screen.getByLabelText("Mode d’export des stems"), { target: { value: "pre" } });
    expect(harness.onSetStemFaderMode).toHaveBeenCalledWith("pre");
  });
});
