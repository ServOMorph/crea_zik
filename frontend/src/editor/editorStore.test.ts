import { describe, expect, it } from "vitest";

import {
  clearSelection,
  copySelection,
  createEditorState,
  cutSelection,
  deleteSelection,
  duplicateSelection,
  execute,
  isDirty,
  markSaveFailed,
  markSaved,
  markSaving,
  paste,
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

describe("editorStore — historique", () => {
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
    expect(state.undoStack).toHaveLength(0);
    expect(state.redoStack).toHaveLength(100);
    for (let index = 0; index < 100; index += 1) state = redo(state);
    expect(state.composition.tempo_bpm).toBe(220);
    expect(state.redoStack).toHaveLength(0);
    expect(state.undoStack).toHaveLength(100);
  });

  it("ne fait rien lorsqu'on undo ou redo sur une pile vide", () => {
    const state = createEditorState(composition);
    expect(undo(state)).toBe(state);
    expect(redo(state)).toBe(state);
  });

  it("ne crée pas d'entrée d'historique quand une opération ne change rien", () => {
    const state = createEditorState(composition);
    const next = execute(state, "Sans effet", () => {});
    expect(next).toBe(state);
    expect(state.undoStack).toHaveLength(0);
    expect(state.redoStack).toHaveLength(0);
    expect(isDirty(state)).toBe(false);
  });

  it("borne l'historique à deux cents entrées", () => {
    let state = createEditorState(composition);
    for (let index = 0; index < 250; index += 1) {
      state = execute(state, `Tempo ${index}`, (draft) => {
        draft.tempo_bpm += 1;
      });
    }
    expect(state.undoStack).toHaveLength(200);
    for (let index = 0; index < 205; index += 1) state = undo(state);
    expect(state.composition.tempo_bpm).toBe(170);
  });
});

describe("editorStore — commandes et sauvegarde", () => {
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
    state = markSaving(state);
    expect(state.saving).toBe(true);
    state = markSaveFailed(state, "Conflit de révision");
    expect(isDirty(state)).toBe(true);
    expect(state.saving).toBe(false);
    expect(state.saveError).toBe("Conflit de révision");
    state = markSaved(state, { ...state.composition, revision: 1 });
    expect(isDirty(state)).toBe(false);
    expect(state.composition.revision).toBe(1);
    expect(state.saveError).toBe(null);
    expect(state.saving).toBe(false);
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

  it("ne regroupe pas une frappe quand l'état courant a dérivé de la commande précédente", () => {
    let state = createEditorState(composition);
    state = execute(
      state,
      "Modifier le titre",
      (draft) => {
        draft.title = "N";
      },
      true,
    );
    state = markSaved(state, { ...state.composition, revision: 1 });
    state = execute(
      state,
      "Modifier le titre",
      (draft) => {
        draft.title = "Nu";
      },
      true,
    );
    expect(state.undoStack).toHaveLength(2);
  });
});

describe("editorStore — sélection et presse-papier", () => {
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
    expect(state.composition.clips).toHaveLength(2);
    expect(state.composition.clips.every((clip) => clip.pattern_id === "pattern-2")).toBe(true);
    expect(state.undoStack.at(-1)?.label).toBe("Supprimer tracks");
    expect(state.selection.tracks).toEqual([]);
    expect(state.selection.patterns).toEqual([]);
    expect(state.selection.clips).toHaveLength(2);
    state = setGrid(state, { snapBeats: 0.5, horizontalZoom: 2, scrollBeat: 8 });
    expect(state.grid).toMatchObject({ snapBeats: 0.5, horizontalZoom: 2, scrollBeat: 8 });
    expect(setGrid(state, { snapBeats: 0 })).toBe(state);
    state = copySelection(state, "tracks");
    state = clearSelection(state);
    expect(state.selection).toEqual({ tracks: [], patterns: [], clips: [] });
  });

  it("supprime en cascade un pattern puis ses clips", () => {
    let state = createEditorState(composition);
    state = select(state, "patterns", ["pattern-1"]);
    state = deleteSelection(state, "patterns");
    expect(state.composition.patterns.map((pattern) => pattern.id)).toEqual(["pattern-2"]);
    expect(state.composition.clips.map((clip) => clip.id)).toEqual(["clip-2"]);
    expect(state.undoStack.at(-1)?.label).toBe("Supprimer patterns");
    expect(state.selection).toEqual({ tracks: [], patterns: [], clips: [] });
    expect(state.undoStack).toHaveLength(1);
    expect(undo(state).composition).toEqual(composition);
  });

  it("supprime les clips sélectionnés sans toucher aux patterns", () => {
    let state = createEditorState(composition);
    state = select(state, "clips", ["clip-1"]);
    state = deleteSelection(state, "clips");
    expect(state.composition.clips.map((clip) => clip.id)).toEqual(["clip-2"]);
    expect(state.composition.patterns).toHaveLength(2);
    expect(state.undoStack.at(-1)?.label).toBe("Supprimer clips");
    expect(state.selection.clips).toEqual([]);
    expect(undo(state).composition).toEqual(composition);
  });

  it("ne supprime rien quand la sélection est vide", () => {
    const state = createEditorState(composition);
    expect(deleteSelection(state, "tracks")).toBe(state);
  });

  it("sélectionne en mode additif sans doublon et remplace en mode non additif", () => {
    let state = createEditorState(composition);
    state = select(state, "clips", ["clip-1"]);
    state = select(state, "clips", ["clip-1", "clip-2"], true);
    expect(state.selection.clips).toEqual(["clip-1", "clip-2"]);
    state = select(state, "tracks", ["track-1"]);
    state = select(state, "tracks", ["track-2"]);
    expect(state.selection.tracks).toEqual(["track-2"]);
  });

  it("ignore un rectangle inversé et respecte les limites du clip", () => {
    let state = createEditorState(composition);
    state = selectRectangle(state, { trackIds: ["track-1"], startBeat: 3, endBeat: 2 });
    expect(state.selection.clips).toEqual([]);
    state = selectRectangle(state, { trackIds: ["track-1"], startBeat: 6, endBeat: 8 });
    expect(state.selection.clips).toEqual([]);
    state = selectRectangle(state, { trackIds: ["track-2"], startBeat: 0, endBeat: 1 });
    expect(state.selection.clips).toEqual(["clip-2"]);
    state = selectRectangle(state, { trackIds: ["track-1"], startBeat: 4, endBeat: 4 });
    expect(state.selection.clips).toEqual(["clip-1"]);
  });

  it("traite les bords du rectangle comme inclusifs", () => {
    const edgeComposition = {
      ...composition,
      patterns: [{ id: "pattern-1", track_id: "track-1" }],
      clips: [
        { id: "clip-edge-end", pattern_id: "pattern-1", start_beat: 0, length_beats: 8 },
        { id: "clip-edge-start", pattern_id: "pattern-1", start_beat: 10, length_beats: 2 },
      ],
    };
    let state = createEditorState(edgeComposition);
    state = selectRectangle(state, { trackIds: ["track-1"], startBeat: 8, endBeat: 10 });
    expect(state.selection.clips).toEqual(["clip-edge-end", "clip-edge-start"]);
    state = selectRectangle(state, { trackIds: ["track-1"], startBeat: 0, endBeat: 2 });
    expect(state.selection.clips).toEqual(["clip-edge-end"]);
  });

  it("coupe une sélection et colle des identifiants neufs", () => {
    let state = createEditorState(composition);
    state = selectAll(state, "clips");
    state = cutSelection(state, "clips");
    expect(state.composition.clips).toHaveLength(0);
    state = paste(state);
    expect(state.composition.clips).toHaveLength(2);
    const ids = new Set(state.composition.clips.map((clip) => clip.id));
    expect(ids.size).toBe(2);
    expect(ids.has("clip-1")).toBe(false);
    expect(state.selection.clips).toHaveLength(2);
    expect(state.undoStack.at(-1)?.label).toBe("Coller clips");
  });

  it("ne colle rien sans presse-papier ou avec un presse-papier vide", () => {
    const state = createEditorState(composition);
    expect(paste(state)).toBe(state);
    const emptyClipboard = copySelection(state, "tracks");
    expect(emptyClipboard.clipboard?.records).toEqual([]);
    expect(paste(emptyClipboard)).toBe(emptyClipboard);
  });
});

describe("editorStore — grille", () => {
  it("initialise la grille avec les valeurs par défaut", () => {
    expect(createEditorState(composition).grid).toEqual({
      snapBeats: 0.25,
      horizontalZoom: 1,
      verticalZoom: 1,
      scrollBeat: 0,
    });
  });

  it("refuse toute borne invalide sur la grille", () => {
    const state = createEditorState(composition);
    expect(setGrid(state, { snapBeats: -0.5 })).toBe(state);
    expect(setGrid(state, { horizontalZoom: 0 })).toBe(state);
    expect(setGrid(state, { verticalZoom: 0 })).toBe(state);
    expect(setGrid(state, { verticalZoom: -1 })).toBe(state);
    expect(setGrid(state, { scrollBeat: -1 })).toBe(state);
    expect(setGrid(state, { horizontalZoom: 1.5, verticalZoom: 2 }).grid).toMatchObject({
      horizontalZoom: 1.5,
      verticalZoom: 2,
    });
  });
});