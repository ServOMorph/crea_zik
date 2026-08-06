import { assert, array, constant, double, integer, oneof, property, string, tuple } from "fast-check";
import { describe, expect, it } from "vitest";

import type { ChannelSelector, EditorState } from "./editorStore";
import {
  addAutomationLane,
  addAutomationPoint,
  addBusChannel,
  addChannelEffect,
  automationTarget,
  busChannels,
  copyAutomationLanes,
  createEditorState,
  duplicateAutomationLane,
  execute,
  invertAutomationValues,
  moveAutomationPoint,
  moveChannelEffect,
  redo,
  removeAutomationLane,
  removeAutomationPoint,
  removeBusChannel,
  removeChannelEffect,
  scaleAutomationValues,
  setChannelEffectBypass,
  setChannelEffectParameter,
  setChannelField,
  setChannelFlag,
  setChannelOutput,
  setChannelSend,
  undo,
  updateAutomationPoint,
} from "./editorStore";

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

function laneAt(state: EditorState, offset: number) {
  const lanes = state.composition.automation_lanes ?? [];
  if (lanes.length === 0) return undefined;
  return lanes[offset % lanes.length];
}

// -0 est numériquement égal à 0 mais JSON.stringify/parse (clone) le normalise en 0 alors que
// l’état muté en mémoire garde le signe : évité pour ne pas comparer -0 à 0 avec toEqual.
function avoidNegativeZero(value: number): number {
  return value === 0 ? 0 : value;
}

const finiteValue = double({ min: -2, max: 2, noNaN: true, noDefaultInfinity: true }).map(avoidNegativeZero);
const finiteBeat = double({ min: 0, max: 32, noNaN: true, noDefaultInfinity: true }).map(avoidNegativeZero);
const interpolations = oneof(constant("step" as const), constant("linear" as const), constant("smooth" as const));

const addAutomation = tuple(integer({ min: 0, max: 11 }), oneof(constant("gain"), constant("pan"))).map<Action>(
  ([offset, property]) => ({
    label: "ajouter automation",
    run: (state) => {
      if (state.composition.tracks.length === 0) return state;
      const trackId = state.composition.tracks[offset % state.composition.tracks.length].id;
      return addAutomationLane(state, automationTarget(trackId, property));
    },
  }),
);

const addAutomationPointAction = tuple(integer({ min: 0, max: 11 }), finiteBeat, finiteValue, interpolations).map<Action>(
  ([offset, beat, value, interpolation]) => ({
    label: "ajouter point d’automation",
    run: (state) => {
      const lane = laneAt(state, offset);
      if (!lane) return state;
      return addAutomationPoint(state, lane.id, { beat, value, interpolation });
    },
  }),
);

const updateAutomation = tuple(integer({ min: 0, max: 11 }), integer({ min: 0, max: 11 }), finiteValue).map<Action>(
  ([laneOffset, pointOffset, value]) => ({
    label: "modifier point d’automation",
    run: (state) => {
      const lane = laneAt(state, laneOffset);
      if (!lane || lane.points.length === 0) return state;
      const point = lane.points[pointOffset % lane.points.length];
      return updateAutomationPoint(state, lane.id, point.beat, { value });
    },
  }),
);

const moveAutomation = tuple(integer({ min: 0, max: 11 }), integer({ min: 0, max: 11 }), finiteBeat).map<Action>(
  ([laneOffset, pointOffset, toBeat]) => ({
    label: "déplacer point d’automation",
    run: (state) => {
      const lane = laneAt(state, laneOffset);
      if (!lane || lane.points.length === 0) return state;
      const point = lane.points[pointOffset % lane.points.length];
      return moveAutomationPoint(state, lane.id, point.beat, toBeat);
    },
  }),
);

const removeAutomation = tuple(integer({ min: 0, max: 11 }), integer({ min: 0, max: 11 })).map<Action>(
  ([laneOffset, pointOffset]) => ({
    label: "supprimer point d’automation",
    run: (state) => {
      const lane = laneAt(state, laneOffset);
      if (!lane || lane.points.length === 0) return state;
      const point = lane.points[pointOffset % lane.points.length];
      return removeAutomationPoint(state, lane.id, point.beat);
    },
  }),
);

const scaleAutomation = tuple(
  integer({ min: 0, max: 11 }),
  double({ min: -4, max: 4, noNaN: true, noDefaultInfinity: true }).map(avoidNegativeZero),
).map<Action>(([offset, factor]) => ({
  label: "mettre l’automation à l’échelle",
  run: (state) => {
    const lane = laneAt(state, offset);
    if (!lane) return state;
    return scaleAutomationValues(state, lane.id, factor);
  },
}));

const invertAutomation = integer({ min: 0, max: 11 }).map<Action>((offset) => ({
  label: "inverser l’automation",
  run: (state) => {
    const lane = laneAt(state, offset);
    if (!lane) return state;
    return invertAutomationValues(state, lane.id);
  },
}));

const duplicateAutomation = integer({ min: 0, max: 11 }).map<Action>((offset) => ({
  label: "dupliquer l’automation",
  run: (state) => {
    const lane = laneAt(state, offset);
    if (!lane) return state;
    return duplicateAutomationLane(state, lane.id);
  },
}));

const copyAutomation = constant(null).map<Action>(() => ({
  label: "copier les automations",
  run: (state) => copyAutomationLanes(state),
}));

const removeAutomationLaneAction = integer({ min: 0, max: 11 }).map<Action>((offset) => ({
  label: "supprimer l’automation",
  run: (state) => {
    const lane = laneAt(state, offset);
    if (!lane) return state;
    return removeAutomationLane(state, lane.id);
  },
}));

function trackSelectorAt(state: EditorState, offset: number): ChannelSelector | undefined {
  const tracks = state.composition.tracks;
  if (tracks.length === 0) return undefined;
  return { kind: "track", trackId: tracks[offset % tracks.length].id };
}

function busSelectorAt(state: EditorState, offset: number): ChannelSelector | undefined {
  const buses = busChannels(state.composition);
  if (buses.length === 0) return undefined;
  return { kind: "bus", channelId: buses[offset % buses.length].id };
}

function anyChannelSelectorAt(state: EditorState, offset: number): ChannelSelector {
  const buses = busChannels(state.composition);
  const pool = ["master" as const, ...state.composition.tracks.map((track) => track.id), ...buses.map((bus) => bus.id)];
  const pick = pool[offset % pool.length];
  if (pick === "master") return { kind: "master" };
  if (buses.some((bus) => bus.id === pick)) return { kind: "bus", channelId: pick };
  return { kind: "track", trackId: pick };
}

function channelOf(state: EditorState, selector: ChannelSelector) {
  if (selector.kind === "master") return state.composition.master_channel;
  if (selector.kind === "track") return (state.composition.mixer_channels ?? []).find((item) => item.track_id === selector.trackId);
  return (state.composition.mixer_channels ?? []).find((item) => item.id === selector.channelId);
}

const addBus = string({ maxLength: 8 }).map<Action>((name) => ({
  label: "ajouter un bus",
  run: (state) => addBusChannel(state, name || "bus"),
}));

const removeBus = integer({ min: 0, max: 11 }).map<Action>((offset) => ({
  label: "supprimer un bus",
  run: (state) => {
    const buses = busChannels(state.composition);
    if (buses.length === 0) return state;
    return removeBusChannel(state, buses[offset % buses.length].id);
  },
}));

const setFlag = tuple(integer({ min: 0, max: 11 }), oneof(constant("mute" as const), constant("solo" as const)), constant(true)).map<Action>(
  ([offset, flag, value]) => ({
    label: "modifier mute/solo",
    run: (state) => {
      const selector = trackSelectorAt(state, offset);
      if (!selector) return state;
      return setChannelFlag(state, selector, flag, value);
    },
  }),
);

const setField = tuple(
  integer({ min: 0, max: 11 }),
  oneof(constant("gain" as const), constant("pan" as const)),
  finiteValue,
).map<Action>(([offset, field, value]) => ({
  label: "modifier gain/pan",
  run: (state) => {
    const selector = anyChannelSelectorAt(state, offset);
    return setChannelField(state, selector, field, value);
  },
}));

const setOutput = tuple(integer({ min: 0, max: 11 }), integer({ min: 0, max: 11 })).map<Action>(
  ([selectorOffset, targetOffset]) => ({
    label: "modifier le routage",
    run: (state) => {
      const selector = trackSelectorAt(state, selectorOffset) ?? busSelectorAt(state, selectorOffset);
      if (!selector || selector.kind === "master") return state;
      const buses = busChannels(state.composition);
      const output = buses.length === 0 ? "master" : buses[targetOffset % buses.length].id;
      return setChannelOutput(state, selector, output);
    },
  }),
);

const setSend = tuple(integer({ min: 0, max: 11 }), integer({ min: 0, max: 11 }), double({ min: 0, max: 1, noNaN: true })).map<Action>(
  ([selectorOffset, busOffset, amount]) => ({
    label: "modifier un send",
    run: (state) => {
      const selector = trackSelectorAt(state, selectorOffset) ?? busSelectorAt(state, selectorOffset);
      const buses = busChannels(state.composition);
      if (!selector || selector.kind === "master" || buses.length === 0) return state;
      return setChannelSend(state, selector, buses[busOffset % buses.length].id, amount);
    },
  }),
);

const effectKinds = oneof(constant("eq"), constant("saturation"), constant("compressor"), constant("delay"));

const addEffect = tuple(integer({ min: 0, max: 11 }), effectKinds).map<Action>(([offset, kind]) => ({
  label: "ajouter un effet",
  run: (state) => addChannelEffect(state, anyChannelSelectorAt(state, offset), kind),
}));

const removeEffect = tuple(integer({ min: 0, max: 11 }), integer({ min: 0, max: 11 })).map<Action>(
  ([selectorOffset, effectOffset]) => ({
    label: "supprimer un effet",
    run: (state) => {
      const selector = anyChannelSelectorAt(state, selectorOffset);
      const channel = channelOf(state, selector);
      if (!channel || channel.effects.length === 0) return state;
      return removeChannelEffect(state, selector, channel.effects[effectOffset % channel.effects.length].id);
    },
  }),
);

const moveEffect = tuple(integer({ min: 0, max: 11 }), integer({ min: 0, max: 11 }), oneof(constant("up" as const), constant("down" as const))).map<Action>(
  ([selectorOffset, effectOffset, direction]) => ({
    label: "réordonner un effet",
    run: (state) => {
      const selector = anyChannelSelectorAt(state, selectorOffset);
      const channel = channelOf(state, selector);
      if (!channel || channel.effects.length === 0) return state;
      return moveChannelEffect(state, selector, channel.effects[effectOffset % channel.effects.length].id, direction);
    },
  }),
);

const setEffectBypass = tuple(integer({ min: 0, max: 11 }), integer({ min: 0, max: 11 })).map<Action>(
  ([selectorOffset, effectOffset]) => ({
    label: "basculer le bypass",
    run: (state) => {
      const selector = anyChannelSelectorAt(state, selectorOffset);
      const channel = channelOf(state, selector);
      if (!channel || channel.effects.length === 0) return state;
      const effect = channel.effects[effectOffset % channel.effects.length];
      return setChannelEffectBypass(state, selector, effect.id, !effect.bypass);
    },
  }),
);

const setEffectParameter = tuple(integer({ min: 0, max: 11 }), integer({ min: 0, max: 11 }), finiteValue).map<Action>(
  ([selectorOffset, effectOffset, value]) => ({
    label: "modifier un paramètre d’effet",
    run: (state) => {
      const selector = anyChannelSelectorAt(state, selectorOffset);
      const channel = channelOf(state, selector);
      if (!channel || channel.effects.length === 0) return state;
      const effect = channel.effects[effectOffset % channel.effects.length];
      return setChannelEffectParameter(state, selector, effect.id, "freq_hz", value);
    },
  }),
);

const actionArbitrary = oneof(
  tempos,
  titles,
  meters,
  addTrack,
  removeTrack,
  addPattern,
  removePattern,
  addClip,
  removeClip,
  addAutomation,
  addAutomationPointAction,
  updateAutomation,
  moveAutomation,
  removeAutomation,
  scaleAutomation,
  invertAutomation,
  duplicateAutomation,
  copyAutomation,
  removeAutomationLaneAction,
  addBus,
  removeBus,
  setFlag,
  setField,
  setOutput,
  setSend,
  addEffect,
  removeEffect,
  moveEffect,
  setEffectBypass,
  setEffectParameter,
);

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