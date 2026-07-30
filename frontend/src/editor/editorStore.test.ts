import { describe, expect, it } from "vitest";

import {
  clearSelection,
  copySelection,
  createEditorState,
  deleteSelection,
  duplicateSelection,
  execute,
  isDirty,
  markSaveFailed,
  markSaved,
  redo,
  select,
  selectAll,
  selectRectangle,
  setGrid,
  transaction,
  undo,
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
  patterns: [
    { id: "pattern-1", track_id: "track-1" },
    { id: "pattern-2", track_id: "track-2" },
  ],
  clips: [
    { id: "clip-1", pattern_id: "pattern-1", start_beat: 0, length_beats: 4 },
    { id: "clip-2", pattern_id: "pattern-2", start_beat: 0, length_beats: 4 },
  ],
};

describe("editorStore", () => {
  it("restaure exactement cent commandes avec undo puis redo", () => {
    let state = createEditorState(composition);
    for (let index = 0; index < 100; index += 1) {
      state = execute(state, "Tempo", (draft) => {
        draft.tempo_bpm += 1;
      });
    }
    expect(state.composition.tempo_bpm).toBe(220);
    for (let index = 0; index < 100; index += 1) state = undo(state);
    expect(state.composition).toEqual(composition);
    for (let index = 0; index < 100; index += 1) state = redo(state);
    expect(state.composition.tempo_bpm).toBe(220);
  });

  it("regroupe une transaction et préserve le dirty state après erreur de sauvegarde", () => {
    let state = createEditorState(composition);
    state = transaction(state, "Propriétés", [
      (draft) => {
        draft.title = "Nuit modifiée";
      },
      (draft) => {
        draft.tempo_bpm = 126;
      },
    ]);
    expect(state.undoStack).toHaveLength(1);
    expect(isDirty(state)).toBe(true);
    state = markSaveFailed(state, "Conflit de révision");
    expect(isDirty(state)).toBe(true);
    state = markSaved(state, { ...state.composition, revision: 1 });
    expect(isDirty(state)).toBe(false);
    expect(state.composition.revision).toBe(1);
  });

  it("regroupe la saisie continue dans une seule annulation", () => {
    let state = createEditorState(composition);
    for (const title of ["L", "Li", "Lig"]) {
      state = execute(
        state,
        "Modifier le titre",
        (draft) => {
          draft.title = title;
        },
        true,
      );
    }
    expect(state.undoStack).toHaveLength(1);
    expect(undo(state).composition.title).toBe("Lignes de nuit");
  });

  it("gère sélection, duplication, suppression en cascade et grille", () => {
    let state = createEditorState(composition);
    state = selectAll(state, "clips");
    expect(state.selection.clips).toEqual(["clip-1", "clip-2"]);
    state = selectRectangle(state, { trackIds: ["track-1"], startBeat: 1, endBeat: 2 });
    expect(state.selection.clips).toEqual(["clip-1"]);
    state = selectAll(state, "clips");
    state = duplicateSelection(state, "clips");
    expect(state.composition.clips).toHaveLength(4);
    expect(new Set(state.composition.clips.map((clip) => clip.id)).size).toBe(4);
    state = select(state, "tracks", ["track-1"]);
    state = deleteSelection(state, "tracks");
    expect(state.composition.tracks.map((track) => track.id)).toEqual(["track-2"]);
    expect(state.composition.patterns.map((pattern) => pattern.id)).toEqual(["pattern-2"]);
    expect(state.composition.clips.every((clip) => clip.pattern_id === "pattern-2")).toBe(true);
    state = setGrid(state, { snapBeats: 0.5, horizontalZoom: 2, scrollBeat: 8 });
    expect(state.grid).toMatchObject({ snapBeats: 0.5, horizontalZoom: 2, scrollBeat: 8 });
    expect(setGrid(state, { snapBeats: 0 })).toBe(state);
    state = copySelection(state, "tracks");
    state = clearSelection(state);
    expect(state.selection).toEqual({ tracks: [], patterns: [], clips: [] });
  });
});
