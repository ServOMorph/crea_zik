import type { Clip, EditableComposition, EditorOperation, EditorState, Marker } from "./editorStore";
import { execute, newId, select } from "./editorStore";

const CLIP_LENGTH_MIN = 0.25;
const CLIP_LENGTH_MAX = 100_000;
const CLIP_REPEAT_MAX = 10_000;
const CLIP_TRANSPOSITION_BOUND = 48;
const LABEL_MAX_LENGTH = 80;
const TRACK_KINDS = ["drums", "bass", "pad", "arp", "lead", "audio", "midi"];

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function snapBeat(value: number, snapBeats: number) {
  if (!(snapBeats > 0)) return round3(value);
  return round3(Math.round(value / snapBeats) * snapBeats);
}

export function clipStart(clip: Clip) {
  return clip.start_beat;
}

export function clipEnd(clip: Clip) {
  return clip.start_beat + clip.length_beats * (clip.repeat_count ?? 1);
}

export function compositionEndBeat(composition: EditableComposition) {
  return Math.max(0, ...composition.clips.map(clipEnd));
}

function clipLocked(clip: Clip) {
  return clip.locked ?? false;
}

function clipGroup(clip: Clip) {
  return clip.group ?? null;
}

function ensureDurationCovers(composition: EditableComposition) {
  const settings = composition.render_settings;
  if (!settings || typeof settings.duration_seconds !== "number") return;
  const required = (compositionEndBeat(composition) * 60) / composition.tempo_bpm;
  if (settings.duration_seconds < required) settings.duration_seconds = round3(required);
}

function withDuration(state: EditorState, label: string, operation: EditorOperation, groupWithPrevious = false) {
  return execute(
    state,
    label,
    (draft) => {
      operation(draft);
      ensureDurationCovers(draft);
    },
    groupWithPrevious,
  );
}

export function addClip(state: EditorState, patternId: string, startBeat: number, lengthBeats: number) {
  const snap = state.grid.snapBeats;
  const start = Math.max(0, snapBeat(startBeat, snap));
  const length = Math.min(CLIP_LENGTH_MAX, Math.max(CLIP_LENGTH_MIN, snapBeat(lengthBeats, snap)));
  if (!state.composition.patterns.some((pattern) => pattern.id === patternId)) return state;
  const clip: Clip = {
    id: newId(),
    pattern_id: patternId,
    start_beat: start,
    length_beats: length,
    repeat_count: 1,
    transposition: 0,
    mute: false,
    locked: false,
    group: null,
  };
  const next = withDuration(state, "Placer un clip", (draft) => {
    draft.clips.push(clip);
  });
  return select(next, "clips", [clip.id]);
}

export function moveClip(state: EditorState, clipId: string, deltaBeats: number, groupWithPrevious = false) {
  const target = state.composition.clips.find((clip) => clip.id === clipId);
  if (!target || clipLocked(target)) return state;
  const group = clipGroup(target);
  const next = withDuration(
    state,
    "Déplacer un clip",
    (draft) => {
      for (const clip of draft.clips) {
        if (clip.id === clipId || (group !== null && clipGroup(clip) === group)) {
          if (clipLocked(clip)) continue;
          clip.start_beat = Math.max(0, round3(clip.start_beat + deltaBeats));
        }
      }
    },
    groupWithPrevious,
  );
  return next;
}

export function resizeClip(state: EditorState, clipId: string, deltaBeats: number, groupWithPrevious = false) {
  const target = state.composition.clips.find((clip) => clip.id === clipId);
  if (!target || clipLocked(target)) return state;
  return withDuration(
    state,
    "Redimensionner un clip",
    (draft) => {
      const clip = draft.clips.find((item) => item.id === clipId);
      if (!clip || clipLocked(clip)) return;
      const nextLength = round3(clip.length_beats + deltaBeats);
      clip.length_beats = Math.min(CLIP_LENGTH_MAX, Math.max(CLIP_LENGTH_MIN, nextLength));
    },
    groupWithPrevious,
  );
}

export function splitClip(state: EditorState, clipId: string, atBeat: number) {
  const target = state.composition.clips.find((clip) => clip.id === clipId);
  if (!target || clipLocked(target)) return state;
  const start = target.start_beat;
  const end = clipEnd(target);
  const cut = Math.max(start, Math.min(end, snapBeat(atBeat, state.grid.snapBeats)));
  if (cut <= start || cut >= end) return state;
  const left: Clip = {
    ...target,
    length_beats: round3(cut - start),
    repeat_count: 1,
  };
  const right: Clip = {
    ...target,
    id: newId(),
    start_beat: cut,
    length_beats: round3(end - cut),
    repeat_count: 1,
  };
  const next = withDuration(state, "Découper un clip", (draft) => {
    const index = draft.clips.findIndex((clip) => clip.id === clipId);
    if (index === -1) return;
    draft.clips.splice(index, 1, left, right);
  });
  return select(next, "clips", [left.id, right.id]);
}

export function setClipRepeat(state: EditorState, clipId: string, repeatCount: number) {
  if (!Number.isFinite(repeatCount)) return state;
  const bounded = Math.round(Math.min(CLIP_REPEAT_MAX, Math.max(1, repeatCount)));
  return withDuration(state, "Répéter un clip", (draft) => {
    const clip = draft.clips.find((item) => item.id === clipId);
    if (!clip) return;
    clip.repeat_count = bounded;
  });
}

export function setClipMute(state: EditorState, clipId: string, mute: boolean) {
  return execute(state, mute ? "Mettre un clip en sourdine" : "Réactiver un clip", (draft) => {
    const clip = draft.clips.find((item) => item.id === clipId);
    if (!clip) return;
    clip.mute = mute;
  });
}

export function setClipLocked(state: EditorState, clipId: string, locked: boolean) {
  return execute(state, locked ? "Verrouiller un clip" : "Déverrouiller un clip", (draft) => {
    const clip = draft.clips.find((item) => item.id === clipId);
    if (!clip) return;
    clip.locked = locked;
  });
}

export function setClipGroup(state: EditorState, clipId: string, group: string | null) {
  const normalized = group === null ? null : group.trim();
  if (normalized !== null && (!normalized || normalized.length > LABEL_MAX_LENGTH)) return state;
  return execute(state, "Changer le groupe du clip", (draft) => {
    const clip = draft.clips.find((item) => item.id === clipId);
    if (!clip) return;
    clip.group = normalized;
  });
}

export function setClipTransposition(state: EditorState, clipId: string, semitones: number) {
  if (!Number.isFinite(semitones)) return state;
  const bounded = Math.round(
    Math.min(CLIP_TRANSPOSITION_BOUND, Math.max(-CLIP_TRANSPOSITION_BOUND, semitones)),
  );
  return execute(state, "Transposer un clip", (draft) => {
    const clip = draft.clips.find((item) => item.id === clipId);
    if (!clip) return;
    clip.transposition = bounded;
  });
}

export function insertTime(state: EditorState, beat: number, lengthBeats: number) {
  if (!(lengthBeats > 0)) return state;
  const at = Math.max(0, snapBeat(beat, state.grid.snapBeats));
  return withDuration(state, "Insérer du temps", (draft) => {
    for (const clip of draft.clips) {
      if (clip.start_beat >= at) {
        clip.start_beat = round3(clip.start_beat + lengthBeats);
      } else if (clipEnd(clip) > at) {
        clip.length_beats = round3(clip.length_beats + lengthBeats);
      }
    }
    if (draft.markers) {
      for (const marker of draft.markers) {
        if (marker.beat >= at) marker.beat = round3(marker.beat + lengthBeats);
      }
    }
  });
}

export function deleteTime(state: EditorState, beat: number, lengthBeats: number) {
  if (!(lengthBeats > 0)) return state;
  const from = Math.max(0, snapBeat(beat, state.grid.snapBeats));
  const to = round3(from + lengthBeats);
  return withDuration(state, "Supprimer du temps", (draft) => {
    const surviving: Clip[] = [];
    for (const clip of draft.clips) {
      const start = clip.start_beat;
      const end = clipEnd(clip);
      if (start >= from && end <= to) continue;
      if (start < from && end > to) {
        clip.length_beats = round3(clip.length_beats - lengthBeats);
        surviving.push(clip);
      } else if (start < from && end > from) {
        clip.length_beats = round3(from - start);
        surviving.push(clip);
      } else if (start >= from && start < to && end > to) {
        clip.start_beat = round3(from);
        clip.length_beats = round3(end - to);
        surviving.push(clip);
      } else if (start >= to) {
        clip.start_beat = round3(start - lengthBeats);
        surviving.push(clip);
      } else {
        surviving.push(clip);
      }
    }
    draft.clips = surviving;
    if (draft.markers) {
      draft.markers = draft.markers
        .filter((marker) => marker.beat < from || marker.beat >= to)
        .map((marker) => (marker.beat >= to ? { ...marker, beat: round3(marker.beat - lengthBeats) } : marker));
    }
  });
}

export function rippleMoveClip(state: EditorState, clipId: string, deltaBeats: number, groupWithPrevious = false) {
  const target = state.composition.clips.find((clip) => clip.id === clipId);
  if (!target || clipLocked(target)) return state;
  const originEnd = clipEnd(target);
  return withDuration(
    state,
    "Déplacer avec ripple",
    (draft) => {
      for (const clip of draft.clips) {
        if (clip.id === clipId) {
          clip.start_beat = Math.max(0, round3(clip.start_beat + deltaBeats));
        } else if (!clipLocked(clip) && clip.start_beat >= originEnd) {
          clip.start_beat = Math.max(0, round3(clip.start_beat + deltaBeats));
        }
      }
      if (draft.markers) {
        for (const marker of draft.markers) {
          if (marker.beat >= originEnd) marker.beat = Math.max(0, round3(marker.beat + deltaBeats));
        }
      }
    },
    groupWithPrevious,
  );
}

export function addMarker(state: EditorState, beat: number, label: string) {
  const normalized = label.trim();
  if (!normalized || normalized.length > LABEL_MAX_LENGTH) return state;
  const marker: Marker = {
    id: newId(),
    beat: Math.max(0, snapBeat(beat, state.grid.snapBeats)),
    label: normalized,
  };
  const next = execute(state, "Ajouter un marqueur", (draft) => {
    if (!draft.markers) draft.markers = [];
    draft.markers.push(marker);
  });
  return select(next, "markers", [marker.id]);
}

export function renameMarker(state: EditorState, markerId: string, label: string) {
  const normalized = label.trim();
  if (!normalized || normalized.length > LABEL_MAX_LENGTH) return state;
  return execute(state, "Renommer un marqueur", (draft) => {
    const marker = draft.markers?.find((item) => item.id === markerId);
    if (!marker) return;
    marker.label = normalized;
  });
}

export function moveMarker(state: EditorState, markerId: string, beat: number) {
  return execute(state, "Déplacer un marqueur", (draft) => {
    const marker = draft.markers?.find((item) => item.id === markerId);
    if (!marker) return;
    marker.beat = Math.max(0, snapBeat(beat, state.grid.snapBeats));
  });
}

export function deleteMarker(state: EditorState, markerId: string) {
  return execute(state, "Supprimer un marqueur", (draft) => {
    if (!draft.markers) return;
    draft.markers = draft.markers.filter((marker) => marker.id !== markerId);
  });
}

export function addTrack(state: EditorState, name: string, kind: string) {
  const normalized = name.trim();
  if (!normalized || !TRACK_KINDS.includes(kind)) return state;
  const track = { id: newId(), name: normalized, kind };
  const next = execute(state, "Ajouter une piste", (draft) => {
    draft.tracks.push(track);
  });
  return select(next, "tracks", [track.id]);
}

export function renameTrack(state: EditorState, trackId: string, name: string) {
  const normalized = name.trim();
  if (!normalized) return state;
  return execute(state, "Renommer une piste", (draft) => {
    const track = draft.tracks.find((item) => item.id === trackId);
    if (!track) return;
    track.name = normalized;
  });
}

export function moveTrack(state: EditorState, trackId: string, offset: -1 | 1) {
  return execute(state, "Réorganiser les pistes", (draft) => {
    const index = draft.tracks.findIndex((item) => item.id === trackId);
    const target = index + offset;
    if (index === -1 || target < 0 || target >= draft.tracks.length) return;
    const [track] = draft.tracks.splice(index, 1);
    draft.tracks.splice(target, 0, track);
  });
}

export function clipTrackId(composition: EditableComposition, clip: Clip) {
  return composition.patterns.find((pattern) => pattern.id === clip.pattern_id)?.track_id ?? null;
}

export function overlappingClips(composition: EditableComposition, clip: Clip) {
  const trackId = clipTrackId(composition, clip);
  if (!trackId) return [];
  return composition.clips.filter(
    (candidate) =>
      candidate.id !== clip.id &&
      clipTrackId(composition, candidate) === trackId &&
      clipStart(candidate) < clipEnd(clip) &&
      clipStart(clip) < clipEnd(candidate),
  );
}

export function obscuredClipIds(composition: EditableComposition) {
  const byTrack = new Map<string, Clip[]>();
  for (const clip of composition.clips) {
    const trackId = clipTrackId(composition, clip);
    if (!trackId) continue;
    const bucket = byTrack.get(trackId) ?? [];
    bucket.push(clip);
    byTrack.set(trackId, bucket);
  }
  const obscured = new Set<string>();
  for (const bucket of byTrack.values()) {
    const ordered = [...bucket].sort((left, right) => clipStart(left) - clipStart(right));
    for (let index = 0; index < ordered.length; index += 1) {
      const clip = ordered[index];
      for (let above = index + 1; above < ordered.length; above += 1) {
        if (clipStart(ordered[above]) < clipEnd(clip)) {
          obscured.add(clip.id);
          break;
        }
      }
    }
  }
  return obscured;
}
