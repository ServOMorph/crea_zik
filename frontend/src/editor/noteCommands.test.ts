import { describe, expect, it } from "vitest";

import { createEditorState, undo } from "./editorStore";
import type { EditorState } from "./editorStore";
import {
  addNote,
  buildChord,
  deleteNotes,
  duplicateNotes,
  humanizeNotes,
  invertNotes,
  legatoNotes,
  moveNotes,
  quantizeNotes,
  resizeNotes,
  selectAllNotes,
  selectNotes,
  setNoteFields,
  swingNotes,
  transposeNotes,
  uniformDuration,
} from "./noteCommands";

function makeState(): EditorState {
  return createEditorState({
    id: "composition-1",
    revision: 0,
    title: "Lignes de nuit",
    tempo_bpm: 120,
    time_signature: [4, 4] as [number, number],
    tracks: [{ id: "track-1", name: "Basse", kind: "bass" }],
    patterns: [
      {
        id: "pattern-1",
        track_id: "track-1",
        length_beats: 60,
        events: [
          { id: "note-a", start_beat: 0, duration_beats: 0.5, midi_note: 40, velocity: 0.7, probability: 1, micro_timing_beats: 0, pan: 0 },
          { id: "note-b", start_beat: 1.5, duration_beats: 1, midi_note: 43, velocity: 0.5, probability: 1, micro_timing_beats: 0, pan: 0 },
          { id: "note-c", start_beat: 2, duration_beats: 0.5, midi_note: 45, velocity: 0.9, probability: 1, micro_timing_beats: 0, pan: 0 },
        ],
      },
    ],
    clips: [],
  });
}

function notesOf(state: EditorState) {
  return state.composition.patterns[0].events;
}

function undoStackLength(state: EditorState) {
  return state.undoStack.length;
}

describe("commandes notes — sélection", () => {
  it("sélectionne des notes (additif ou non) et tout un pattern", () => {
    let state = makeState();
    state = selectNotes(state, ["note-a"]);
    expect(state.selection.notes).toEqual(["note-a"]);
    state = selectNotes(state, ["note-b"], true);
    expect(state.selection.notes).toEqual(["note-a", "note-b"]);
    state = selectAllNotes(state, "pattern-1");
    expect(state.selection.notes).toEqual(["note-a", "note-b", "note-c"]);
  });

  it("supprime les notes sélectionnées, vide la sélection, et undo restaure tout", () => {
    let state = makeState();
    state = selectNotes(state, ["note-a", "note-c"]);
    state = deleteNotes(state, "pattern-1", ["note-a", "note-c"]);
    expect(notesOf(state).map((event) => event.id)).toEqual(["note-b"]);
    expect(state.selection.notes).toEqual([]);
    state = undo(state);
    expect(notesOf(state)).toHaveLength(3);
  });

  it("ne supprime rien ni n’ajoute d’historique quand il n’y a aucune note", () => {
    let state = makeState();
    state = deleteNotes(state, "pattern-1", []);
    expect(undoStackLength(state)).toBe(0);
    state = deleteNotes(state, "pattern-999", ["note-a"]);
    expect(undoStackLength(state)).toBe(0);
  });
});

describe("commandes notes — création et édition", () => {
  it("crée une note avec les valeurs par défaut et la sélectionne", () => {
    let state = makeState();
    state = addNote(state, "pattern-1", 3, 0.25, 50);
    const created = state.composition.patterns[0].events.find((event) => event.id === state.selection.notes[0]);
    expect(created).toBeDefined();
    expect(created).toMatchObject({
      start_beat: 3,
      duration_beats: 0.25,
      midi_note: 50,
      velocity: 0.7,
      probability: 1,
      micro_timing_beats: 0,
      pan: 0,
    });
    expect(state.selection.notes).toHaveLength(1);
  });

  it("borne la création (start ≥ 0, durée minimale, midi 0–127)", () => {
    let state = addNote(makeState(), "pattern-1", -2, 0, -5);
    let created = notesOf(state).at(-1)!;
    expect(created.start_beat).toBe(0);
    expect(created.duration_beats).toBe(0.05);
    expect(created.midi_note).toBe(0);
    state = addNote(state, "pattern-1", 1, 2, 200);
    created = notesOf(state).at(-1)!;
    expect(created.midi_note).toBe(127);
  });

  it("modifie les champs de notes en bornant aux limites", () => {
    let state = makeState();
    state = setNoteFields(state, "pattern-1", ["note-a"], "velocity", 0.35);
    state = setNoteFields(state, "pattern-1", ["note-a"], "velocity", 0);
    state = setNoteFields(state, "pattern-1", ["note-a"], "micro_timing_beats", 5);
    state = setNoteFields(state, "pattern-1", ["note-a"], "pan", -3);
    const note = notesOf(state)[0];
    expect(note.velocity).toBe(0.05);
    expect(note.micro_timing_beats).toBe(1);
    expect(note.pan).toBe(-1);
  });

  it("ne change rien sur des notes inexistantes ou pattern absent", () => {
    let state = makeState();
    const before = undoStackLength(state);
    state = setNoteFields(state, "pattern-1", ["ghost"], "velocity", 0.9);
    state = setNoteFields(state, "pattern-999", ["note-a"], "velocity", 0.9);
    expect(undoStackLength(state)).toBe(before);
    expect(notesOf(state)[0].velocity).toBe(0.7);
  });

  it("fusionne les modifications dans l’historique quand groupWithPrevious", () => {
    let state = makeState();
    state = setNoteFields(state, "pattern-1", ["note-a"], "velocity", 0.4, true);
    state = setNoteFields(state, "pattern-1", ["note-a"], "velocity", 0.5, true);
    expect(undoStackLength(state)).toBe(1);
    state = setNoteFields(state, "pattern-1", ["note-a"], "velocity", 0.6);
    expect(undoStackLength(state)).toBe(2);
  });
});

describe("commandes notes — déplacements", () => {
  it("déplace les notes en temps et hauteur, borné à 0 et 127", () => {
    let state = makeState();
    state = moveNotes(state, "pattern-1", ["note-b", "note-c"], 0.25, 3);
    expect(notesOf(state)[1]).toMatchObject({ start_beat: 1.75, midi_note: 46 });
    expect(notesOf(state)[2]).toMatchObject({ start_beat: 2.25, midi_note: 48 });
    state = moveNotes(state, "pattern-1", ["note-b"], -100, -100);
    expect(notesOf(state)[1]).toMatchObject({ start_beat: 0, midi_note: 0 });
  });

  it("redimensionne en bornant à la durée minimale", () => {
    let state = makeState();
    state = resizeNotes(state, "pattern-1", ["note-a"], 1.5);
    expect(notesOf(state)[0].duration_beats).toBe(2);
    state = resizeNotes(state, "pattern-1", ["note-a"], -10);
    expect(notesOf(state)[0].duration_beats).toBe(0.05);
  });

  it("duplique avec des ids neufs, décalés, et sélectionne les copies", () => {
    let state = makeState();
    state = selectNotes(state, ["note-a"]);
    state = duplicateNotes(state, "pattern-1", ["note-a"], 4, 12);
    expect(notesOf(state)).toHaveLength(4);
    const copies = notesOf(state).filter((event) => event.start_beat === 4);
    expect(copies).toHaveLength(1);
    expect(copies[0]).toMatchObject({ start_beat: 4, midi_note: 52, duration_beats: 0.5 });
    expect(copies[0].id).not.toBe("note-a");
    expect(state.selection.notes).toEqual([copies[0].id]);
  });
});

describe("commandes notes — quantize, swing, humanize", () => {
  it("quantifie sur la grille demandée", () => {
    let state = makeState();
    state = quantizeNotes(state, "pattern-1", ["note-a", "note-b"], 1);
    expect(notesOf(state)[0].start_beat).toBe(0);
    expect(notesOf(state)[1].start_beat).toBe(2);
  });

  it("applique le swing aux off-beats seulement, borné à [0, 1]", () => {
    let state = makeState();
    state = swingNotes(state, "pattern-1", ["note-b"], 0.5);
    expect(notesOf(state)[1].start_beat).toBe(1.625);
    expect(notesOf(state)[0].start_beat).toBe(0);
    state = swingNotes(makeState(), "pattern-1", ["note-b"], 3);
    expect(notesOf(state)[1].start_beat).toBe(1.75);
  });

  it("applique swing et humanize à tout le pattern quand la sélection est vide", () => {
    let state = makeState();
    state = swingNotes(state, "pattern-1", [], 0.5);
    expect(notesOf(state)[1].start_beat).toBe(1.625);
    state = humanizeNotes(state, "pattern-1", [], 42, 0.5);
    const first = notesOf(state)[0];
    expect(first.velocity).not.toBe(0.7);
    expect(first.micro_timing_beats).not.toBe(0);
  });

  it("humanise de façon déterministe avec bornes respectées", () => {
    let state = makeState();
    state = humanizeNotes(state, "pattern-1", ["note-a", "note-b", "note-c"], 7, 1);
    const frozen = JSON.stringify(notesOf(state));
    state = humanizeNotes(makeState(), "pattern-1", ["note-a", "note-b", "note-c"], 7, 1);
    expect(JSON.stringify(notesOf(state))).toBe(frozen);
    for (const note of notesOf(state)) {
      expect(note.velocity).toBeGreaterThanOrEqual(0.05);
      expect(note.velocity).toBeLessThanOrEqual(1);
      expect(note.micro_timing_beats).toBeGreaterThanOrEqual(-1);
      expect(note.micro_timing_beats).toBeLessThanOrEqual(1);
    }
  });
});

describe("commandes notes — transformations", () => {
  it("transpose en bornant à la plage midi", () => {
    let state = makeState();
    state = transposeNotes(state, "pattern-1", ["note-a", "note-b"], 12);
    expect(notesOf(state)[0].midi_note).toBe(52);
    expect(notesOf(state)[1].midi_note).toBe(55);
    state = transposeNotes(state, "pattern-1", ["note-a"], 200);
    expect(notesOf(state)[0].midi_note).toBe(127);
  });

  it("étend en legato jusqu’à la note suivante, et jusqu’à la fin du pattern sinon", () => {
    let state = makeState();
    state = legatoNotes(state, "pattern-1", ["note-a", "note-c"]);
    expect(notesOf(state)[0].duration_beats).toBe(1.5);
    expect(notesOf(state)[2].duration_beats).toBe(60 - 2);
    state = legatoNotes(makeState(), "pattern-1", ["note-a", "note-b", "note-c"]);
    expect(notesOf(state)[0].duration_beats).toBe(1.5);
    expect(notesOf(state)[1].duration_beats).toBe(0.5);
  });

  it("uniformise la durée avec borne minimale", () => {
    let state = makeState();
    state = uniformDuration(state, "pattern-1", ["note-a", "note-b"], 2);
    expect(notesOf(state)[0].duration_beats).toBe(2);
    expect(notesOf(state)[1].duration_beats).toBe(2);
    state = uniformDuration(state, "pattern-1", ["note-a"], 0);
    expect(notesOf(state)[0].duration_beats).toBe(0.05);
  });

  it("inverse autour de l’axe donné", () => {
    let state = makeState();
    state = invertNotes(state, "pattern-1", ["note-a"], 48);
    expect(notesOf(state)[0].midi_note).toBe(56);
    state = invertNotes(state, "pattern-1", ["note-a"], 100);
    expect(notesOf(state)[0].midi_note).toBe(127);
  });
});

describe("commandes notes — accords", () => {
  it("construit les triades et septièmes autour de la note racine", () => {
    let state = makeState();
    state = buildChord(state, "pattern-1", "note-a", "majeur");
    const chord = notesOf(state)
      .filter((event) => !["note-b", "note-c"].includes(event.id))
      .map((event) => event.midi_note)
      .sort((a, b) => a - b);
    expect(chord).toEqual([40, 44, 47]);
    state = buildChord(makeState(), "pattern-1", "note-a", "mineur");
    expect(
      notesOf(state)
        .filter((event) => !["note-b", "note-c"].includes(event.id))
        .map((event) => event.midi_note)
        .sort((a, b) => a - b),
    ).toEqual([40, 43, 47]);
    state = buildChord(makeState(), "pattern-1", "note-a", "septieme");
    expect(
      notesOf(state)
        .filter((event) => !["note-b", "note-c"].includes(event.id))
        .map((event) => event.midi_note)
        .sort((a, b) => a - b),
    ).toEqual([40, 44, 47, 50]);
  });

  it("reprend le temps, la durée et la vélocité de la racine, sélectionne l’accord, undo restaure", () => {
    let state = makeState();
    state = selectNotes(state, ["note-b"]);
    state = buildChord(state, "pattern-1", "note-b", "majeur");
    expect(notesOf(state)).toHaveLength(5);
    for (const event of notesOf(state).filter((item) => !["note-a", "note-b", "note-c"].includes(item.id))) {
      expect(event.start_beat).toBe(1.5);
      expect(event.duration_beats).toBe(1);
      expect(event.velocity).toBe(0.5);
      expect(event.id).not.toBe("note-b");
    }
    expect(state.selection.notes).toHaveLength(3);
    const chordMidis = new Set(state.selection.notes.map((id) => notesOf(state).find((event) => event.id === id)!.midi_note));
    expect(chordMidis).toEqual(new Set([43, 47, 50]));
    state = undo(state);
    expect(notesOf(state)).toHaveLength(3);
    expect(state.selection.notes).toHaveLength(3);
  });

  it("ne fait rien sur une racine inexistante", () => {
    let state = makeState();
    const before = undoStackLength(state);
    state = buildChord(state, "pattern-1", "ghost", "majeur");
    expect(undoStackLength(state)).toBe(before);
  });
});
