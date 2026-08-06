import { describe, expect, it } from "vitest";
import { assert, array, constant, integer, oneof, property, tuple } from "fast-check";

import type { EditorState } from "./editorStore";
import { createEditorState, deleteSelection, redo, select, undo } from "./editorStore";
import {
  addClip,
  addMarker,
  addTrack,
  clipEnd,
  clipStart,
  compositionEndBeat,
  deleteMarker,
  deleteTime,
  insertTime,
  moveClip,
  moveMarker,
  moveTrack,
  obscuredClipIds,
  overlappingClips,
  renameMarker,
  renameTrack,
  resizeClip,
  rippleMoveClip,
  setClipGroup,
  setClipLocked,
  setClipMute,
  setClipRepeat,
  setClipTransposition,
  snapBeat,
  splitClip,
} from "./clipCommands";

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

const withDuration = {
  ...composition,
  render_settings: { duration_seconds: 30, format: "wav_pcm24" as const },
};

function clipById(state: EditorState, id: string) {
  const clip = state.composition.clips.find((item) => item.id === id);
  if (!clip) throw new Error(`clip ${id} missing`);
  return clip;
}

describe("clipCommands — placement, déplacement et redimensionnement", () => {
  it("ajoute un clip snappé sur la grille et le sélectionne", () => {
    let state = createEditorState(composition);
    state = addClip(state, "pattern-1", 3.7, 1.9);
    expect(state.composition.clips).toHaveLength(3);
    const added = state.composition.clips[2];
    expect(added.start_beat).toBe(3.75);
    expect(added.length_beats).toBe(2);
    expect(added.repeat_count).toBe(1);
    expect(added.transposition).toBe(0);
    expect(added.locked).toBe(false);
    expect(state.selection.clips).toEqual([added.id]);
    expect(undo(state).composition).toEqual(composition);
  });

  it("refuse un clip sur un pattern inconnu", () => {
    const state = createEditorState(composition);
    expect(addClip(state, "pattern-inconnu", 0, 1)).toBe(state);
  });

  it("déplace un clip et ne le laisse jamais avant le début", () => {
    let state = createEditorState(composition);
    state = moveClip(state, "clip-2", 2.5);
    expect(clipStart(clipById(state, "clip-2"))).toBe(2.5);
    state = moveClip(state, "clip-2", -5);
    expect(clipStart(clipById(state, "clip-2"))).toBe(0);
    expect(state.undoStack).toHaveLength(2);
  });

  it("regroupe les déplacements continus dans une seule annulation", () => {
    let state = createEditorState(composition);
    for (const delta of [0.5, 0.25, 1]) state = moveClip(state, "clip-2", delta, true);
    expect(state.undoStack).toHaveLength(1);
    state = undo(state);
    expect(clipStart(clipById(state, "clip-2"))).toBe(0);
  });

  it("ne déplace pas un clip verrouillé", () => {
    let state = createEditorState(composition);
    state = setClipLocked(state, "clip-2", true);
    const before = state;
    expect(moveClip(state, "clip-2", 3)).toBe(state);
    expect(state).toEqual(before);
  });

  it("déplace ensemble les clips du même groupe", () => {
    let state = createEditorState(composition);
    state = setClipGroup(state, "clip-1", "section A");
    state = setClipGroup(state, "clip-2", "section A");
    state = moveClip(state, "clip-1", 8);
    expect(clipStart(clipById(state, "clip-1"))).toBe(8);
    expect(clipStart(clipById(state, "clip-2"))).toBe(8);
    const solo = setClipGroup(createEditorState(composition), "clip-1", "section A");
    const moved = moveClip(solo, "clip-1", 4);
    expect(clipStart(clipById(moved, "clip-2"))).toBe(0);
  });

  it("redimensionne un clip avec une longueur minimale", () => {
    let state = createEditorState(composition);
    state = resizeClip(state, "clip-2", 2);
    expect(clipById(state, "clip-2").length_beats).toBe(6);
    state = resizeClip(state, "clip-2", -10);
    expect(clipById(state, "clip-2").length_beats).toBe(0.25);
    expect(resizeClip(createEditorState(composition), "clip-2", 0).undoStack).toHaveLength(0);
  });

  it("refuse de redimensionner un clip verrouillé", () => {
    const state = setClipLocked(createEditorState(composition), "clip-2", true);
    expect(resizeClip(state, "clip-2", 2)).toBe(state);
  });
});

describe("clipCommands — découpe, répétition et transposition", () => {
  it("découpe un clip en deux en préservant la durée totale", () => {
    let state = createEditorState(composition);
    state = splitClip(state, "clip-1", 2.5);
    const clips = state.composition.clips.filter((clip) => clip.pattern_id === "pattern-1");
    expect(clips).toHaveLength(2);
    expect(clipStart(clips[0])).toBe(0);
    expect(clipStart(clips[1])).toBe(2.5);
    expect(clipEnd(clips[0])).toBe(2.5);
    expect(clipEnd(clips[1])).toBe(4);
    expect(state.selection.clips).toEqual([clips[0].id, clips[1].id]);
    expect(undo(state).composition).toEqual(composition);
  });

  it("refuse de découper hors de la plage du clip ou un clip verrouillé", () => {
    const state = createEditorState(composition);
    expect(splitClip(state, "clip-1", 4)).toBe(state);
    expect(splitClip(state, "clip-1", 0)).toBe(state);
    const locked = setClipLocked(state, "clip-1", true);
    expect(splitClip(locked, "clip-1", 2)).toBe(locked);
  });

  it("découpe un clip répété en conservant sa durée totale", () => {
    let state = createEditorState(composition);
    state = setClipRepeat(state, "clip-1", 3);
    state = splitClip(state, "clip-1", 6);
    const clips = state.composition.clips.filter((clip) => clip.pattern_id === "pattern-1");
    expect(clipStart(clips[0])).toBe(0);
    expect(clipEnd(clips[0])).toBe(6);
    expect(clipStart(clips[1])).toBe(6);
    expect(clipEnd(clips[1])).toBe(12);
  });

  it("borne la répétition entre 1 et 10000", () => {
    let state = createEditorState(composition);
    state = setClipRepeat(state, "clip-1", 0);
    expect(clipById(state, "clip-1").repeat_count).toBe(1);
    state = setClipRepeat(state, "clip-1", 99999);
    expect(clipById(state, "clip-1").repeat_count).toBe(10000);
    expect(setClipRepeat(state, "clip-1", Number.NaN)).toBe(state);
  });

  it("transpose un clip dans les bornes", () => {
    let state = createEditorState(composition);
    state = setClipTransposition(state, "clip-1", 60);
    expect(clipById(state, "clip-1").transposition).toBe(48);
    state = setClipTransposition(state, "clip-1", -60);
    expect(clipById(state, "clip-1").transposition).toBe(-48);
    expect(setClipTransposition(state, "clip-1", Number.NaN)).toBe(state);
  });

  it("mute, verrouille et groupe un clip", () => {
    let state = createEditorState(composition);
    state = setClipMute(state, "clip-1", true);
    expect(clipById(state, "clip-1").mute).toBe(true);
    state = setClipLocked(state, "clip-1", true);
    expect(clipById(state, "clip-1").locked).toBe(true);
    state = setClipGroup(state, "clip-1", "  A  ");
    expect(clipById(state, "clip-1").group).toBe("A");
    state = setClipGroup(state, "clip-1", null);
    expect(clipById(state, "clip-1").group).toBe(null);
    expect(setClipGroup(state, "clip-1", "   ")).toBe(state);
  });
});

describe("clipCommands — insert/delete time et ripple", () => {
  it("insère du temps en décalant clips et marqueurs", () => {
    let state = createEditorState({ ...composition, markers: [{ id: "marker-1", beat: 8, label: "intro" }] });
    state = setClipRepeat(state, "clip-1", 2);
    state = insertTime(state, 6, 4);
    expect(clipStart(clipById(state, "clip-1"))).toBe(0);
    expect(clipById(state, "clip-1").length_beats).toBe(8);
    expect(clipStart(clipById(state, "clip-2"))).toBe(0);
    expect(state.composition.markers?.[0].beat).toBe(12);
  });

  it("supprime du temps en tronquant, supprimant et décalant", () => {
    let state = createEditorState({
      ...composition,
      markers: [
        { id: "marker-1", beat: 6, label: "tombe" },
        { id: "marker-2", beat: 10, label: "reste" },
      ],
      clips: [
        { id: "clip-1", pattern_id: "pattern-1", start_beat: 0, length_beats: 8 },
        { id: "clip-2", pattern_id: "pattern-2", start_beat: 4, length_beats: 4 },
        { id: "clip-3", pattern_id: "pattern-1", start_beat: 10, length_beats: 2 },
        { id: "clip-4", pattern_id: "pattern-2", start_beat: 14, length_beats: 2 },
      ],
    });
    state = deleteTime(state, 4, 4);
    expect(clipById(state, "clip-1").length_beats).toBe(4);
    expect(state.composition.clips.some((clip) => clip.id === "clip-2")).toBe(false);
    expect(clipById(state, "clip-3").start_beat).toBe(6);
    expect(clipById(state, "clip-3").length_beats).toBe(2);
    expect(clipById(state, "clip-4").start_beat).toBe(10);
    expect(state.composition.markers?.map((marker) => marker.beat)).toEqual([6]);
  });

  it("déplace avec ripple les clips et marqueurs suivants", () => {
    let state = createEditorState({ ...composition, markers: [{ id: "marker-1", beat: 8, label: "outro" }] });
    state = moveClip(state, "clip-2", 12);
    state = rippleMoveClip(state, "clip-1", 4);
    expect(clipStart(clipById(state, "clip-1"))).toBe(4);
    expect(clipStart(clipById(state, "clip-2"))).toBe(16);
    expect(state.composition.markers?.[0].beat).toBe(12);
  });

  it("le ripple n'entraîne pas les clips verrouillés", () => {
    let state = createEditorState(composition);
    state = setClipLocked(state, "clip-2", true);
    state = rippleMoveClip(state, "clip-1", 4);
    expect(clipStart(clipById(state, "clip-2"))).toBe(0);
  });
});

describe("clipCommands — marqueurs et pistes", () => {
  it("ajoute, renomme, déplace et supprime un marqueur", () => {
    let state = createEditorState({ ...composition, markers: [] });
    state = addMarker(state, 8.3, "  intro  ");
    const marker = state.composition.markers?.[0];
    expect(marker?.beat).toBe(8.25);
    expect(marker?.label).toBe("intro");
    expect(state.selection.markers).toEqual([marker?.id]);
    state = renameMarker(state, marker!.id, "début");
    expect(state.composition.markers?.[0].label).toBe("début");
    state = moveMarker(state, marker!.id, 16.7);
    expect(state.composition.markers?.[0].beat).toBe(16.75);
    state = deleteMarker(state, marker!.id);
    expect(state.composition.markers).toEqual([]);
  });

  it("refuse les libellés vides", () => {
    const state = createEditorState({ ...composition, markers: [] });
    expect(addMarker(state, 0, "   ")).toBe(state);
    const withMarker = addMarker(state, 0, "ok");
    const markerId = withMarker.composition.markers![0].id;
    expect(renameMarker(withMarker, markerId, " ")).toBe(withMarker);
  });

  it("ajoute, renomme et réorganise une piste", () => {
    let state = createEditorState(composition);
    state = addTrack(state, "  FX  ", "midi");
    expect(state.composition.tracks).toHaveLength(3);
    const track = state.composition.tracks[2];
    expect(track.name).toBe("FX");
    expect(state.selection.tracks).toEqual([track.id]);
    expect(addTrack(state, "X", "inconnu")).toBe(state);
    expect(addTrack(state, "   ", "midi")).toBe(state);
    state = renameTrack(state, track.id, "Effets");
    expect(state.composition.tracks[2].name).toBe("Effets");
    state = moveTrack(state, track.id, -1);
    expect(state.composition.tracks[1].id).toBe(track.id);
    state = moveTrack(state, track.id, -1);
    expect(state.composition.tracks[0].id).toBe(track.id);
    expect(moveTrack(state, track.id, -1)).toBe(state);
  });
});

describe("clipCommands — durée calculée et chevauchements", () => {
  it("calcule la durée depuis les clips répétés", () => {
    let state = createEditorState(composition);
    expect(compositionEndBeat(state.composition)).toBe(4);
    state = setClipRepeat(state, "clip-1", 3);
    expect(compositionEndBeat(state.composition)).toBe(12);
  });

  it("étend la durée de rendu quand la structure dépasse la durée actuelle", () => {
    let state = createEditorState(withDuration);
    state = moveClip(state, "clip-1", 100);
    expect(state.composition.render_settings?.duration_seconds).toBeGreaterThan(50);
    state = moveClip(state, "clip-1", -100);
    expect(state.composition.render_settings?.duration_seconds).toBe(52);
  });

  it("snappe les beats à la grille", () => {
    expect(snapBeat(3.7, 0.25)).toBe(3.75);
    expect(snapBeat(3.1, 0.5)).toBe(3);
  });

  it("détecte les chevauchements et désigne le clip masqué", () => {
    const state = createEditorState({
      ...composition,
      clips: [
        { id: "clip-1", pattern_id: "pattern-1", start_beat: 0, length_beats: 8 },
        { id: "clip-2", pattern_id: "pattern-1", start_beat: 4, length_beats: 4 },
        { id: "clip-3", pattern_id: "pattern-2", start_beat: 0, length_beats: 4 },
      ],
    });
    const overlaps = overlappingClips(state.composition, state.composition.clips[0]);
    expect(overlaps.map((clip) => clip.id)).toEqual(["clip-2"]);
    expect(overlappingClips(state.composition, state.composition.clips[2])).toEqual([]);
    expect(obscuredClipIds(state.composition)).toEqual(new Set(["clip-1"]));
  });
});

type ClipAction = { run: (state: EditorState) => EditorState };

const addClipAction = tuple(integer({ min: 0, max: 1 }), integer({ min: 0, max: 3 })).map<ClipAction>(
  ([patternOffset, beatIndex]) => ({
    run: (state) => {
      if (state.composition.patterns.length === 0) return state;
      const pattern = state.composition.patterns[patternOffset % state.composition.patterns.length];
      return addClip(state, pattern.id, beatIndex * 4, 4);
    },
  }),
);

const moveClipAction = tuple(integer({ min: 0, max: 1 }), integer({ min: -2, max: 2 })).map<ClipAction>(
  ([clipOffset, delta]) => ({
    run: (state) => {
      if (state.composition.clips.length === 0) return state;
      const clip = state.composition.clips[clipOffset % state.composition.clips.length];
      return moveClip(state, clip.id, clip.locked ? 0 : delta * 2);
    },
  }),
);

const resizeClipAction = tuple(integer({ min: 0, max: 1 }), integer({ min: -3, max: 3 })).map<ClipAction>(
  ([clipOffset, delta]) => ({
    run: (state) => {
      if (state.composition.clips.length === 0) return state;
      const clip = state.composition.clips[clipOffset % state.composition.clips.length];
      return resizeClip(state, clip.id, clip.locked ? 0 : delta);
    },
  }),
);

const repeatClipAction = integer({ min: 0, max: 1 }).map<ClipAction>((clipOffset) => ({
  run: (state) => {
    if (state.composition.clips.length === 0) return state;
    const clip = state.composition.clips[clipOffset % state.composition.clips.length];
    return setClipRepeat(state, clip.id, 1 + (clip.repeat_count ?? 1) % 5);
  },
}));

const splitClipAction = integer({ min: 0, max: 1 }).map<ClipAction>((clipOffset) => ({
  run: (state) => {
    if (state.composition.clips.length === 0) return state;
    const clip = state.composition.clips[clipOffset % state.composition.clips.length];
    return splitClip(state, clip.id, clip.start_beat + 2);
  },
}));

const lockClipAction = integer({ min: 0, max: 1 }).map<ClipAction>((clipOffset) => ({
  run: (state) => {
    if (state.composition.clips.length === 0) return state;
    const clip = state.composition.clips[clipOffset % state.composition.clips.length];
    return setClipLocked(state, clip.id, !(clip.locked ?? false));
  },
}));

const removeClipAction = integer({ min: 0, max: 3 }).map<ClipAction>((offset) => ({
  run: (state) => {
    const clips = state.composition.clips;
    if (clips.length === 0) return state;
    return deleteSelection(select(state, "clips", [clips[offset % clips.length].id]), "clips");
  },
}));

const insertDeleteAction = tuple(integer({ min: 0, max: 3 }), integer({ min: 0, max: 1 })).map<ClipAction>(
  ([beat, kind]) => ({
    run: (state) => (kind === 0 ? insertTime(state, beat * 4, 4) : deleteTime(state, beat * 4, 4)),
  }),
);

const markerAction = integer({ min: 0, max: 3 }).map<ClipAction>((beat) => ({
  run: (state) => addMarker(state, beat * 4, "m"),
}));

const addTrackAction = constant(0).map<ClipAction>(() => ({
  run: (state) => addTrack(state, "Piste", "midi"),
}));

const moveTrackAction = constant(0).map<ClipAction>(() => ({
  run: (state) => {
    if (state.composition.tracks.length === 0) return state;
    return moveTrack(state, state.composition.tracks[0].id, 1);
  },
}));

const clipActionArbitrary = oneof(
  addClipAction,
  moveClipAction,
  resizeClipAction,
  repeatClipAction,
  splitClipAction,
  lockClipAction,
  removeClipAction,
  insertDeleteAction,
  markerAction,
  addTrackAction,
  moveTrackAction,
);

describe("clipCommands — propriétés d'inverse", () => {
  it("chaque commande clip est annulée exactement par undo puis rejouée par redo", () => {
    assert(
      property(array(clipActionArbitrary, { minLength: 1, maxLength: 12 }), (actions) => {
        let state = createEditorState(composition);
        const snapshots: EditorState[] = [state];
        for (const action of actions) {
          state = action.run(state);
          snapshots.push(state);
        }
        for (let index = 1; index < snapshots.length; index += 1) {
          if (snapshots[index] === snapshots[index - 1]) continue;
          expect(undo(snapshots[index]).composition).toEqual(snapshots[index - 1].composition);
          expect(redo(undo(snapshots[index])).composition).toEqual(snapshots[index].composition);
        }
      }),
      { numRuns: 100 },
    );
  });
});
