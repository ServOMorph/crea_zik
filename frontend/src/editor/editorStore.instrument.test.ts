import { describe, expect, it } from "vitest";

import {
  createEditorState,
  redo,
  resetInstrumentParameter,
  resetInstrumentParameters,
  restoreInstrumentParameters,
  setInstrumentListLength,
  setInstrumentParameter,
  undo,
  type EditableComposition,
} from "./editorStore";

const composition: EditableComposition = {
  id: "composition-1",
  revision: 0,
  title: "Test",
  tempo_bpm: 120,
  time_signature: [4, 4],
  tracks: [{ id: "track-1", name: "Basse", kind: "bass" }],
  patterns: [],
  clips: [],
};

const lowpassBounds = { minimum: 20, maximum: 20000, default: 620 };
const ratioBounds = { minimum: 0.25, maximum: 8, default: 1 };

describe("editorStore — instrument", () => {
  it("crée l'instrument au premier réglage et borne la valeur", () => {
    let state = createEditorState(composition);
    state = setInstrumentParameter(state, "track-1", "lowpass_hz", 99999, lowpassBounds);
    expect(state.composition.tracks[0].instrument?.parameters.lowpass_hz).toBe(20000);
    state = setInstrumentParameter(state, "track-1", "lowpass_hz", -5, lowpassBounds);
    expect(state.composition.tracks[0].instrument?.parameters.lowpass_hz).toBe(20);
  });

  it("ignore les valeurs non finies sans créer d'entrée d'historique", () => {
    const state = createEditorState(composition);
    const next = setInstrumentParameter(state, "track-1", "lowpass_hz", Number.NaN, lowpassBounds);
    expect(next).toBe(state);
    expect(undo(next)).toBe(next);
  });

  it("borne les champs d'un élément de liste", () => {
    let state = createEditorState(composition);
    state = setInstrumentListLength(state, "track-1", "oscillators", 2, () => ({ ratio: 1, gain: 1 }));
    state = setInstrumentParameter(state, "track-1", "oscillators[1].ratio", 999, ratioBounds);
    expect(state.composition.tracks[0].instrument?.parameters.oscillators).toEqual([
      { ratio: 1, gain: 1 },
      { ratio: 8, gain: 1 },
    ]);
  });

  it("enregistre l'historique et se rétablit via undo/redo", () => {
    let state = createEditorState(composition);
    state = setInstrumentParameter(state, "track-1", "lowpass_hz", 1000, lowpassBounds);
    expect(state.composition.tracks[0].instrument?.parameters.lowpass_hz).toBe(1000);
    state = undo(state);
    expect(state.composition.tracks[0].instrument).toBeUndefined();
    state = redo(state);
    expect(state.composition.tracks[0].instrument?.parameters.lowpass_hz).toBe(1000);
  });

  it("regroupe les réglages consécutifs du même paramètre en une entrée", () => {
    let state = createEditorState(composition);
    state = setInstrumentParameter(state, "track-1", "lowpass_hz", 700, lowpassBounds, true);
    state = setInstrumentParameter(state, "track-1", "lowpass_hz", 800, lowpassBounds, true);
    expect(state.undoStack).toHaveLength(1);
    state = undo(state);
    expect(state.composition.tracks[0].instrument).toBeUndefined();
  });

  it("réinitialise un paramètre vers sa valeur par défaut", () => {
    let state = createEditorState(composition);
    state = setInstrumentParameter(state, "track-1", "lowpass_hz", 2000, lowpassBounds);
    state = resetInstrumentParameter(state, "track-1", "lowpass_hz", lowpassBounds);
    expect(state.composition.tracks[0].instrument?.parameters.lowpass_hz).toBe(620);
  });

  it("réinitialise tout l'instrument en supprimant les réglages", () => {
    let state = createEditorState(composition);
    state = setInstrumentParameter(state, "track-1", "lowpass_hz", 2000, lowpassBounds);
    state = resetInstrumentParameters(state, "track-1");
    expect(state.composition.tracks[0].instrument).toBeUndefined();
  });

  it("restaure un jeu complet de paramètres", () => {
    let state = createEditorState(composition);
    state = restoreInstrumentParameters(state, "track-1", {
      lowpass_hz: 750,
      oscillators: [{ ratio: 1, gain: 1 }],
    });
    expect(state.composition.tracks[0].instrument?.parameters).toEqual({
      lowpass_hz: 750,
      oscillators: [{ ratio: 1, gain: 1 }],
    });
    expect(state.undoStack[0].label).toBe("Restaurer les paramètres");
  });

  it("n'ajoute pas d'élément au-delà de la longueur demandée et tronque", () => {
    let state = createEditorState(composition);
    state = setInstrumentListLength(state, "track-1", "oscillators", 3, () => ({ ratio: 1, gain: 1 }));
    state = setInstrumentListLength(state, "track-1", "oscillators", 1, () => ({ ratio: 1, gain: 1 }));
    expect(state.composition.tracks[0].instrument?.parameters.oscillators).toEqual([{ ratio: 1, gain: 1 }]);
  });
});
