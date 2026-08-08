import { array, assert, integer, property } from "fast-check";
import { describe, expect, it } from "vitest";

import {
  addPattern,
  clearPatternRow,
  createEditorState,
  duplicatePattern,
  fillPatternRow,
  patternLengthBeats,
  patternName,
  redo,
  renamePattern,
  setPatternColor,
  setPatternLength,
  setStep,
  setStepField,
  setStepFieldCells,
  setSteps,
  setTrackChannelFlag,
  stepBeat,
  undo,
  varyPattern,
} from "./editorStore";

const composition = {
  id: "composition-1",
  revision: 0,
  title: "Lignes de nuit",
  tempo_bpm: 120,
  time_signature: [4, 4] as [number, number],
  tracks: [
    { id: "track-1", name: "Batterie", kind: "drums" },
    { id: "track-2", name: "Basse", kind: "bass" },
  ],
  patterns: [{ id: "pattern-1", track_id: "track-1", events: [] }],
  clips: [{ id: "clip-1", pattern_id: "pattern-1", start_beat: 0, length_beats: 4 }],
};

const kick = 36;
const clap = 39;

describe("séquenceur — activation des pas", () => {
  it("active un pas en créant un événement au bon temps avec les défauts", () => {
    let state = createEditorState(composition);
    state = setStep(state, "pattern-1", kick, 3, 4, true);
    const events = state.composition.patterns[0].events;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      start_beat: 0.75,
      midi_note: kick,
      velocity: 0.7,
      probability: 1,
      micro_timing_beats: 0,
      pan: 0,
    });
    expect(events[0].duration_beats).toBe(0.25);
  });

  it("désactive un pas en supprimant l’événement exact et undo le restaure", () => {
    let state = createEditorState(composition);
    state = setStep(state, "pattern-1", kick, 2, 4, true);
    state = setStep(state, "pattern-1", kick, 2, 4, false);
    expect(state.composition.patterns[0].events).toHaveLength(0);
    state = undo(state);
    expect(state.composition.patterns[0].events).toHaveLength(1);
  });

  it("préserve les pas d’une autre percussion sur le même temps", () => {
    let state = createEditorState(composition);
    state = setStep(state, "pattern-1", kick, 1, 4, true);
    state = setStep(state, "pattern-1", clap, 1, 4, true);
    const events = state.composition.patterns[0].events;
    expect(events).toHaveLength(2);
    state = setStep(state, "pattern-1", kick, 1, 4, false);
    expect(state.composition.patterns[0].events).toHaveLength(1);
    expect(state.composition.patterns[0].events[0].midi_note).toBe(clap);
  });

  it("calcule les temps de pas exacts pour chaque résolution", () => {
    expect(stepBeat(3, 1)).toBe(3);
    expect(stepBeat(3, 2)).toBe(1.5);
    expect(stepBeat(3, 4)).toBe(0.75);
    expect(stepBeat(7, 8)).toBe(0.875);
    expect(stepBeat(0, 4)).toBe(0);
  });
});

describe("séquenceur — champs d’un pas", () => {
  function active(state: ReturnType<typeof createEditorState>, midiNote: number, stepIndex: number) {
    return setStep(state, "pattern-1", midiNote, stepIndex, 4, true);
  }

  it("modifie la vélocité, la probabilité et le micro-décalage du pas sélectionné", () => {
    let state = active(createEditorState(composition), kick, 2);
    state = setStepField(state, "pattern-1", kick, 2, 4, "velocity", 0.35);
    state = setStepField(state, "pattern-1", kick, 2, 4, "probability", 0.5);
    state = setStepField(state, "pattern-1", kick, 2, 4, "micro_timing_beats", 0.25);
    const event = state.composition.patterns[0].events[0];
    expect(event.velocity).toBe(0.35);
    expect(event.probability).toBe(0.5);
    expect(event.micro_timing_beats).toBe(0.25);
  });

  it("borne les valeurs aux limites du schéma", () => {
    let state = active(createEditorState(composition), kick, 0);
    state = setStepField(state, "pattern-1", kick, 0, 4, "velocity", 0);
    state = setStepField(state, "pattern-1", kick, 0, 4, "probability", 2);
    state = setStepField(state, "pattern-1", kick, 0, 4, "micro_timing_beats", 5);
    const event = state.composition.patterns[0].events[0];
    expect(event.velocity).toBe(0.05);
    expect(event.probability).toBe(1);
    expect(event.micro_timing_beats).toBe(1);
  });

  it("ne change rien et n’ajoute pas d’historique sur un pas vide", () => {
    let state = createEditorState(composition);
    const before = state.undoStack.length;
    state = setStepField(state, "pattern-1", kick, 5, 4, "velocity", 0.9);
    expect(state.composition.patterns[0].events).toHaveLength(0);
    expect(state.undoStack.length).toBe(before);
  });

  it("annule et rétablit la modification d’un champ", () => {
    let state = active(createEditorState(composition), kick, 1);
    state = setStepField(state, "pattern-1", kick, 1, 4, "velocity", 0.2);
    state = undo(state);
    expect(state.composition.patterns[0].events[0].velocity).toBe(0.7);
    state = redo(state);
    expect(state.composition.patterns[0].events[0].velocity).toBe(0.2);
  });
});

describe("séquenceur — canal et patterns", () => {
  it("crée un canal mixer à la première bascule de mute ou solo", () => {
    let state = createEditorState(composition);
    state = setTrackChannelFlag(state, "track-1", "mute", true);
    expect(state.composition.mixer_channels).toEqual([
      expect.objectContaining({ track_id: "track-1", mute: true, solo: false, gain: 1, pan: 0 }),
    ]);
    state = setTrackChannelFlag(state, "track-1", "solo", true);
    expect(state.composition.mixer_channels?.[0]).toMatchObject({ mute: true, solo: true });
    state = undo(state);
    expect(state.composition.mixer_channels?.[0]).toMatchObject({ mute: true, solo: false });
  });

  it("ajoute un pattern vide sur la piste demandée", () => {
    const state = addPattern(createEditorState(composition), "track-2");
    const added = state.composition.patterns.at(-1);
    expect(added).toMatchObject({ track_id: "track-2", events: [] });
    expect(added?.id).not.toBe("pattern-1");
  });

  it("bascule un groupe de pas en une seule commande annulable", () => {
    let state = createEditorState(composition);
    state = setSteps(state, "pattern-1", [{ midiNote: kick, stepIndex: 0 }, { midiNote: clap, stepIndex: 2 }], 4, true);
    expect(state.undoStack).toHaveLength(1);
    expect(state.composition.patterns[0].events).toHaveLength(2);
    state = undo(state);
    expect(state.composition.patterns[0].events).toHaveLength(0);
  });

  it("applique un champ à un groupe de pas en une seule commande", () => {
    let state = createEditorState(composition);
    state = setSteps(state, "pattern-1", [{ midiNote: kick, stepIndex: 0 }, { midiNote: kick, stepIndex: 2 }], 4, true);
    state = setStepFieldCells(state, "pattern-1", [{ midiNote: kick, stepIndex: 0 }, { midiNote: kick, stepIndex: 2 }], 4, "velocity", 0.3);
    expect(state.undoStack).toHaveLength(2);
    expect(state.composition.patterns[0].events.map((event) => event.velocity)).toEqual([0.3, 0.3]);
    expect(undo(state).composition.patterns[0].events.map((event) => event.velocity)).toEqual([0.7, 0.7]);
  });
});

describe("séquenceur — longueur et remplissages", () => {
  it("fixe la longueur du pattern et la restitue comme longueur de référence", () => {
    let state = createEditorState(composition);
    state = setPatternLength(state, "pattern-1", 8);
    expect(state.composition.patterns[0].length_beats).toBe(8);
    expect(patternLengthBeats(state.composition.patterns[0])).toBe(8);
    state = undo(state);
    expect(state.composition.patterns[0].length_beats).toBeUndefined();
  });

  it("borne la longueur aux limites de la commande", () => {
    let state = createEditorState(composition);
    state = setPatternLength(state, "pattern-1", 0.1);
    expect(state.composition.patterns[0].length_beats).toBe(0.25);
    state = setPatternLength(state, "pattern-1", 5000);
    expect(state.composition.patterns[0].length_beats).toBe(1024);
  });

  it("remplit toute la rangée puis réduit aux temps entiers puis la vide", () => {
    let state = createEditorState(composition);
    state = fillPatternRow(state, "pattern-1", kick, 4, "all");
    expect(state.composition.patterns[0].events.filter((event) => event.midi_note === kick)).toHaveLength(16);
    state = fillPatternRow(state, "pattern-1", kick, 4, "beats");
    const beatsOnly = state.composition.patterns[0].events
      .filter((event) => event.midi_note === kick)
      .map((event) => event.start_beat);
    expect(beatsOnly).toEqual([0, 1, 2, 3]);
    state = clearPatternRow(state, "pattern-1", kick);
    expect(state.composition.patterns[0].events.filter((event) => event.midi_note === kick)).toHaveLength(0);
  });

  it("ne remplit pas sur un temps fractionnaire en mode temps", () => {
    let state = createEditorState(composition);
    state = fillPatternRow(state, "pattern-1", kick, 2, "beats");
    const beats = state.composition.patterns[0].events.map((event) => event.start_beat);
    expect(beats.every((beat) => beat % 1 === 0)).toBe(true);
  });

  it("préserve les autres percussions quand on remplit une rangée", () => {
    let state = createEditorState(composition);
    state = setStep(state, "pattern-1", clap, 1, 4, true);
    state = fillPatternRow(state, "pattern-1", kick, 4, "all");
    expect(state.composition.patterns[0].events.filter((event) => event.midi_note === clap)).toHaveLength(1);
  });
});

describe("séquenceur — nom, couleur, duplication et variation", () => {
  it("renomme un pattern et affiche un nom par défaut sinon", () => {
    let state = createEditorState(composition);
    expect(patternName(state, "pattern-1")).toBe("Pattern 1");
    state = renamePattern(state, "pattern-1", "  Groove principal  ");
    expect(state.composition.patterns[0].name).toBe("Groove principal");
    expect(renamePattern(state, "pattern-1", "   ")).toBe(state);
    state = undo(state);
    expect(state.composition.patterns[0].name).toBeUndefined();
  });

  it("applique une couleur valide et refuse les autres", () => {
    let state = createEditorState(composition);
    state = setPatternColor(state, "pattern-1", "#A1B2C3");
    expect(state.composition.patterns[0].color).toBe("#a1b2c3");
    expect(setPatternColor(state, "pattern-1", "rouge")).toBe(state);
  });

  it("duplique le pattern avec des identifiants neufs et un nom marqué", () => {
    let state = createEditorState(composition);
    state = setStep(state, "pattern-1", kick, 0, 4, true);
    state = setPatternLength(state, "pattern-1", 8);
    state = duplicatePattern(state, "pattern-1");
    const original = state.composition.patterns[0];
    const copy = state.composition.patterns.at(-1)!;
    expect(copy.id).not.toBe(original.id);
    expect(copy.events).toHaveLength(1);
    expect(copy.events[0].id).not.toBe(original.events[0].id);
    expect(copy.name).toBe("Pattern 1 (copie)");
    expect(copy.length_beats).toBe(8);
    expect(undo(state).composition.patterns).toHaveLength(1);
  });

  it("crée une variation déterministe : même salt même résultat, salts différents modifient", () => {
    let state = createEditorState(composition);
    state = setStep(state, "pattern-1", kick, 0, 4, true);
    const withoutIds = (next: ReturnType<typeof createEditorState>) =>
      next.composition.patterns.at(-1)!.events.map((event) => {
        const { id, ...rest } = event;
        void id;
        return rest;
      });
    const first = varyPattern(state, "pattern-1", 7);
    const second = varyPattern(state, "pattern-1", 7);
    expect(withoutIds(first)).toEqual(withoutIds(second));
    const distinct = new Set(
      [7, 8, 9, 10, 11, 12, 13, 14].map((salt) =>
        JSON.stringify(withoutIds(varyPattern(state, "pattern-1", salt))),
      ),
    );
    expect(distinct.size).toBeGreaterThan(1);
    expect(first.composition.patterns.at(-1)?.name).toBe("Pattern 1 (variation)");
    const sourceIds = new Set(state.composition.patterns[0].events.map((event) => event.id));
    const variationIds = first.composition.patterns.at(-1)!.events.map((event) => event.id);
    expect(variationIds.some((id) => sourceIds.has(id))).toBe(false);
  });
});

describe("séquenceur — propriétés", () => {
  it("rétablit l’état exact après n’importe quelle séquence de toggles et undo", () => {
    assert(
      property(
        array(integer({ min: 0, max: 15 }), { minLength: 1, maxLength: 40 }),
        array(integer({ min: 0, max: 15 }), { minLength: 1, maxLength: 40 }),
        (steps, removes) => {
          let state = createEditorState(composition);
          for (const step of steps) state = setStep(state, "pattern-1", kick, step, 4, true);
          for (const step of removes) state = setStep(state, "pattern-1", kick, step, 4, false);
          for (let index = 0; index < steps.length + removes.length; index += 1) state = undo(state);
          expect(state.composition.patterns[0].events).toEqual([]);
          expect(state.undoStack).toEqual([]);
        },
      ),
      { numRuns: 100 },
    );
  });
});
