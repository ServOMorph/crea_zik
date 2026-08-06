import { describe, expect, it } from "vitest";

import {
  addAutomationLane,
  addAutomationPoint,
  addAutomationPointSnapped,
  automationLaneBaseValue,
  automationLaneLabel,
  automationTarget,
  automationValueAtBeat,
  clearSelection,
  copyAutomationLanes,
  copySelection,
  createEditorState,
  cutSelection,
  deleteSelection,
  duplicateAutomationLane,
  duplicateSelection,
  evaluateAutomation,
  execute,
  invertAutomationValues,
  isDirty,
  markSaveFailed,
  markSaved,
  markSaving,
  moveAutomationPoint,
  paste,
  redo,
  removeAutomationLane,
  removeAutomationPoint,
  scaleAutomationValues,
  select,
  selectAll,
  selectRectangle,
  setAutomationInterpolation,
  setGrid,
  transaction,
  undo,
  updateAutomationPoint,
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
    { id: "pattern-1", track_id: "track-1", events: [] },
    { id: "pattern-2", track_id: "track-2", events: [] },
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
    expect(state.selection).toEqual({
      tracks: [],
      patterns: [],
      clips: [],
      markers: [],
      automation_lanes: [],
      notes: [],
    });
  });

  it("supprime en cascade un pattern puis ses clips", () => {
    let state = createEditorState(composition);
    state = select(state, "patterns", ["pattern-1"]);
    state = deleteSelection(state, "patterns");
    expect(state.composition.patterns.map((pattern) => pattern.id)).toEqual(["pattern-2"]);
    expect(state.composition.clips.map((clip) => clip.id)).toEqual(["clip-2"]);
    expect(state.undoStack.at(-1)?.label).toBe("Supprimer patterns");
    expect(state.selection).toEqual({
      tracks: [],
      patterns: [],
      clips: [],
      markers: [],
      automation_lanes: [],
      notes: [],
    });
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
      patterns: [{ id: "pattern-1", track_id: "track-1", events: [] }],
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

describe("editorStore — automations", () => {
  const trackA = "aaaa1111-0000-0000-0000-000000000001";
  const trackB = "bbbb2222-0000-0000-0000-000000000002";
  const automationComposition = {
    ...composition,
    tracks: [
      { id: trackA, name: "Batterie", kind: "drums", gain: 1 },
      { id: trackB, name: "Basse", kind: "bass", gain: 1 },
    ],
    patterns: [],
    clips: [],
  };

  it("crée une lane avec des points par défaut et refuse une cible dupliquée ou invalide", () => {
    const state = createEditorState(automationComposition);
    const target = automationTarget(trackA, "gain");
    const withLane = addAutomationLane(state, target);
    expect(withLane.composition.automation_lanes).toHaveLength(1);
    expect(withLane.composition.automation_lanes?.[0].target).toBe(target);
    expect(addAutomationLane(withLane, target)).toBe(withLane);
    expect(addAutomationLane(state, "not-a-valid-target")).toBe(state);
  });

  it("ajoute, déplace, met à jour et supprime des points en conservant l'ordre trié", () => {
    let state = addAutomationLane(createEditorState(automationComposition), automationTarget(trackA, "gain"));
    const laneId = state.composition.automation_lanes![0].id;
    state = addAutomationPoint(state, laneId, { beat: 2, value: 0.5, interpolation: "linear" });
    expect(state.composition.automation_lanes![0].points.map((point) => point.beat)).toEqual([0, 2, 4]);
    state = moveAutomationPoint(state, laneId, 2, 3, false);
    expect(state.composition.automation_lanes![0].points.map((point) => point.beat)).toEqual([0, 3, 4]);
    state = updateAutomationPoint(state, laneId, 3, { value: 0.9 }, false);
    expect(state.composition.automation_lanes![0].points.find((point) => point.beat === 3)?.value).toBe(0.9);
    state = setAutomationInterpolation(state, laneId, 3, "smooth");
    expect(state.composition.automation_lanes![0].points.find((point) => point.beat === 3)?.interpolation).toBe(
      "smooth",
    );
    state = removeAutomationPoint(state, laneId, 3);
    expect(state.composition.automation_lanes![0].points.map((point) => point.beat)).toEqual([0, 4]);
  });

  it("groupe les mises à jour de point consécutives avec groupWithPrevious", () => {
    let state = addAutomationLane(createEditorState(automationComposition), automationTarget(trackA, "gain"));
    const laneId = state.composition.automation_lanes![0].id;
    const beforeGroup = state.undoStack.length;
    state = updateAutomationPoint(state, laneId, 0, { value: 0.3 }, true);
    state = updateAutomationPoint(state, laneId, 0, { value: 0.6 }, true);
    expect(state.undoStack).toHaveLength(beforeGroup + 1);
    expect(state.composition.automation_lanes![0].points[0].value).toBe(0.6);
  });

  it("conserve le point existant lors d'un ajout au même beat", () => {
    let state = addAutomationLane(createEditorState(automationComposition), automationTarget(trackA, "gain"));
    const laneId = state.composition.automation_lanes![0].id;
    const originalValue = state.composition.automation_lanes![0].points.find((point) => point.beat === 4)?.value;
    state = addAutomationPoint(state, laneId, { beat: 4, value: 0.7, interpolation: "linear" });
    expect(state.composition.automation_lanes![0].points).toHaveLength(2);
    expect(state.composition.automation_lanes![0].points.find((point) => point.beat === 4)?.value).toBe(
      originalValue,
    );
  });

  it("supprime, duplique et copie les lanes", () => {
    let state = addAutomationLane(createEditorState(automationComposition), automationTarget(trackA, "gain"));
    const laneId = state.composition.automation_lanes![0].id;
    state = duplicateAutomationLane(state, laneId);
    expect(state.composition.automation_lanes).toHaveLength(2);
    expect(state.composition.automation_lanes![1].target).toBe(state.composition.automation_lanes![0].target);
    expect(state.composition.automation_lanes![1].id).not.toBe(laneId);
    state = copyAutomationLanes(state);
    expect(state.composition.automation_lanes).toHaveLength(4);
    state = removeAutomationLane(state, laneId);
    expect(state.composition.automation_lanes).toHaveLength(3);
    expect(state.composition.automation_lanes!.some((lane) => lane.id === laneId)).toBe(false);
  });

  it("met à l'échelle et inverse les valeurs d'une lane", () => {
    let state = addAutomationLane(createEditorState(automationComposition), automationTarget(trackA, "gain"), [
      { beat: 0, value: 0.2, interpolation: "linear" },
      { beat: 4, value: 0.8, interpolation: "linear" },
    ]);
    const laneId = state.composition.automation_lanes![0].id;
    state = scaleAutomationValues(state, laneId, 2);
    expect(state.composition.automation_lanes![0].points.map((point) => point.value)).toEqual([0.4, 1.6]);
    state = invertAutomationValues(state, laneId);
    expect(state.composition.automation_lanes![0].points.map((point) => point.value)).toEqual([1.6, 0.4]);
    expect(scaleAutomationValues(state, laneId, Number.NaN)).toBe(state);
  });

  it("snape le beat d'un nouveau point sur la grille", () => {
    let state = addAutomationLane(createEditorState(automationComposition), automationTarget(trackA, "gain"));
    const laneId = state.composition.automation_lanes![0].id;
    state = addAutomationPointSnapped(state, laneId, { beat: 1.1, value: 0.4, interpolation: "linear" });
    expect(state.composition.automation_lanes![0].points.some((point) => point.beat === 1)).toBe(true);
  });

  it("évalue la valeur courante d'une automation et retourne undefined sans lane", () => {
    const state = addAutomationLane(createEditorState(automationComposition), automationTarget(trackA, "gain"), [
      { beat: 0, value: 0, interpolation: "linear" },
      { beat: 4, value: 1, interpolation: "linear" },
    ]);
    expect(automationValueAtBeat(state.composition, automationTarget(trackA, "gain"), 2)).toBeCloseTo(0.5);
    expect(automationValueAtBeat(state.composition, automationTarget(trackB, "gain"), 2)).toBeUndefined();
    const lane = state.composition.automation_lanes![0];
    expect(evaluateAutomation({ ...lane, points: [] }, 2)).toBe(0);
  });

  it("calcule la valeur de base depuis la piste et libelle une lane", () => {
    const state = addAutomationLane(createEditorState(automationComposition), automationTarget(trackA, "gain"));
    expect(automationLaneBaseValue(state.composition, automationTarget(trackA, "gain"))).toBe(1);
    expect(automationLaneLabel(state.composition, automationTarget(trackA, "gain"))).toBe("Batterie · Gain");
    expect(automationLaneLabel(state.composition, automationTarget(trackA, "pan"))).toBe("Batterie · Pan");
    expect(automationLaneBaseValue(state.composition, "track.aaaa9999-0000-0000-0000-000000000009.gain")).toBe(0);
  });
});