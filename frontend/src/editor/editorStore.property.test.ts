import { assert, array, integer, oneof, property, string, tuple } from "fast-check";
import { describe, expect, it } from "vitest";

import type { EditorState } from "./editorStore";
import { createEditorState, execute, redo, undo } from "./editorStore";

type Action = { label: string; run: (state: EditorState) => EditorState };

const baseComposition = {
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

const tempos = integer({ min: 20, max: 400 }).map<Action>((tempo) => ({
  label: "tempo",
  run: (state) =>
    execute(state, "Tempo", (draft) => {
      draft.tempo_bpm = tempo;
    }),
}));

const titles = string({ maxLength: 12 }).map<Action>((title) => ({
  label: "titre",
  run: (state) =>
    execute(state, "Titre", (draft) => {
      draft.title = title;
    }),
}));

const meters = tuple(integer({ min: 1, max: 12 }), integer({ min: 1, max: 16 })).map<Action>(
  ([numerator, denominator]) => ({
    label: "métrique",
    run: (state) =>
      execute(state, "Métrique", (draft) => {
        draft.time_signature = [numerator, denominator];
      }),
  }),
);

const trackNames = string({ maxLength: 8 });
const trackKinds = integer({ min: 0, max: 4 }).map(
  (value) => ["drums", "bass", "pad", "arp", "lead"][value] as string,
);

const addTrack = tuple(trackKinds, trackNames).map<Action>(([kind, name]) => ({
  label: "ajouter piste",
  run: (state) =>
    execute(state, "Ajouter piste", (draft) => {
      draft.tracks.push({ id: crypto.randomUUID(), name, kind });
    }),
}));

const removeTrack = integer({ min: 0, max: 11 }).map<Action>((offset) => ({
  label: "supprimer piste",
  run: (state) => {
    const tracks = state.composition.tracks;
    if (tracks.length === 0) return state;
    const id = tracks[offset % tracks.length].id;
    return execute(state, "Supprimer piste", (draft) => {
      const ids = new Set([id]);
      draft.tracks = draft.tracks.filter((track) => !ids.has(track.id));
      const patternIds = new Set(
        draft.patterns.filter((pattern) => ids.has(pattern.track_id)).map((pattern) => pattern.id),
      );
      draft.patterns = draft.patterns.filter((pattern) => !patternIds.has(pattern.id));
      draft.clips = draft.clips.filter((clip) => !patternIds.has(clip.pattern_id));
    });
  },
}));

const addPattern = integer({ min: 0, max: 11 }).map<Action>((offset) => ({
  label: "ajouter pattern",
  run: (state) => {
    if (state.composition.tracks.length === 0) return state;
    const trackId = state.composition.tracks[offset % state.composition.tracks.length].id;
    return execute(state, "Ajouter pattern", (draft) => {
      draft.patterns.push({ id: crypto.randomUUID(), track_id: trackId, events: [] });
    });
  },
}));

const removePattern = integer({ min: 0, max: 11 }).map<Action>((offset) => ({
  label: "supprimer pattern",
  run: (state) => {
    const patterns = state.composition.patterns;
    if (patterns.length === 0) return state;
    const id = patterns[offset % patterns.length].id;
    return execute(state, "Supprimer pattern", (draft) => {
      draft.patterns = draft.patterns.filter((pattern) => pattern.id !== id);
      draft.clips = draft.clips.filter((clip) => clip.pattern_id !== id);
    });
  },
}));

const addClip = integer({ min: 0, max: 11 }).map<Action>((offset) => ({
  label: "ajouter clip",
  run: (state) => {
    if (state.composition.patterns.length === 0) return state;
    const patternId = state.composition.patterns[offset % state.composition.patterns.length].id;
    return execute(state, "Ajouter clip", (draft) => {
      draft.clips.push({
        id: crypto.randomUUID(),
        pattern_id: patternId,
        start_beat: 0,
        length_beats: 4,
      });
    });
  },
}));

const removeClip = integer({ min: 0, max: 11 }).map<Action>((offset) => ({
  label: "supprimer clip",
  run: (state) => {
    const clips = state.composition.clips;
    if (clips.length === 0) return state;
    const id = clips[offset % clips.length].id;
    return execute(state, "Supprimer clip", (draft) => {
      draft.clips = draft.clips.filter((clip) => clip.id !== id);
    });
  },
}));

const actionArbitrary = oneof(tempos, titles, meters, addTrack, removeTrack, addPattern, removePattern, addClip, removeClip);

const sequenceArbitrary = array(actionArbitrary, { minLength: 1, maxLength: 15 });

describe("editorStore — propriétés d'inverse", () => {
  it("chaque action est annulée exactement par undo puis rejouée exactement par redo", () => {
    assert(
      property(sequenceArbitrary, (actions) => {
        let state = createEditorState(baseComposition);
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

  it("une séquence entière est défaite jusqu'à l'état initial puis refaite jusqu'à l'état final", () => {
    assert(
      property(sequenceArbitrary, (actions) => {
        let state = createEditorState(baseComposition);
        for (const action of actions) state = action.run(state);
        const finalComposition = state.composition;
        const entryCount = state.undoStack.length;
        let rewound = state;
        for (let index = 0; index < actions.length; index += 1) rewound = undo(rewound);
        expect(rewound.composition).toEqual(baseComposition);
        expect(rewound.undoStack).toHaveLength(0);
        let redone = rewound;
        for (let index = 0; index < actions.length; index += 1) redone = redo(redone);
        expect(redone.composition).toEqual(finalComposition);
        expect(redone.redoStack).toHaveLength(0);
        expect(redone.undoStack).toHaveLength(entryCount);
      }),
      { numRuns: 100 },
    );
  });
});