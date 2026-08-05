import { execute, fnv1a, newId, patternLengthBeats } from "./editorStore";
import type { EditorState, NoteEvent, Pattern } from "./editorStore";

export type NoteField = "velocity" | "probability" | "micro_timing_beats" | "pan";

export const NOTE_FIELD_BOUNDS: Record<NoteField, [number, number]> = {
  velocity: [0.05, 1],
  probability: [0.05, 1],
  micro_timing_beats: [-1, 1],
  pan: [-1, 1],
};

export const NOTE_DURATION_MIN = 0.05;

function patternById(state: EditorState, patternId: string) {
  return state.composition.patterns.find((pattern) => pattern.id === patternId);
}

function notesByIds(pattern: Pattern, noteIds: string[]) {
  const wanted = new Set(noteIds);
  return pattern.events.filter((event) => wanted.has(event.id));
}

function allNotesWhenEmpty(pattern: Pattern, noteIds: string[]) {
  return noteIds.length ? notesByIds(pattern, noteIds) : pattern.events;
}

export function selectNotes(state: EditorState, noteIds: string[], additive = false): EditorState {
  const selected = additive ? new Set([...state.selection.notes, ...noteIds]) : new Set(noteIds);
  return { ...state, selection: { ...state.selection, notes: [...selected] } };
}

export function selectAllNotes(state: EditorState, patternId: string): EditorState {
  const pattern = patternById(state, patternId);
  if (!pattern) return state;
  return selectNotes(state, pattern.events.map((event) => event.id));
}

function clearNotes(state: EditorState): EditorState {
  return { ...state, selection: { ...state.selection, notes: [] } };
}

export function deleteNotes(state: EditorState, patternId: string, noteIds: string[]): EditorState {
  const ids = new Set(noteIds);
  if (ids.size === 0) return state;
  const next = execute(state, "Supprimer des notes", (draft) => {
    const pattern = draft.patterns.find((item) => item.id === patternId);
    if (!pattern) return;
    pattern.events = pattern.events.filter((event) => !ids.has(event.id));
  });
  return clearNotes(next);
}

export function addNote(
  state: EditorState,
  patternId: string,
  startBeat: number,
  durationBeats: number,
  midiNote: number,
  velocity = 0.7,
): EditorState {
  const start = Math.max(0, startBeat);
  const duration = Math.max(NOTE_DURATION_MIN, durationBeats);
  const midi = Math.max(0, Math.min(127, Math.round(midiNote)));
  const next = execute(state, "Créer une note", (draft) => {
    const pattern = draft.patterns.find((item) => item.id === patternId);
    if (!pattern) return;
    pattern.events.push({
      id: newId(),
      start_beat: start,
      duration_beats: duration,
      midi_note: midi,
      velocity,
      probability: 1,
      micro_timing_beats: 0,
      pan: 0,
    });
  });
  return selectNotes(next, [next.composition.patterns.find((pattern) => pattern.id === patternId)?.events.at(-1)?.id ?? ""]);
}

export function setNoteFields(
  state: EditorState,
  patternId: string,
  noteIds: string[],
  field: NoteField,
  value: number,
  groupWithPrevious = false,
): EditorState {
  const pattern = patternById(state, patternId);
  if (!pattern) return state;
  const selected = notesByIds(pattern, noteIds);
  if (!selected.length) return state;
  const [min, max] = NOTE_FIELD_BOUNDS[field];
  const bounded = Math.min(max, Math.max(min, value));
  return execute(
    state,
    "Modifier des notes",
    (draft) => {
      const draftPattern = draft.patterns.find((item) => item.id === patternId);
      if (!draftPattern) return;
      const wanted = new Set(noteIds);
      for (const event of draftPattern.events) if (wanted.has(event.id)) event[field] = bounded;
    },
    groupWithPrevious,
  );
}

export function moveNotes(
  state: EditorState,
  patternId: string,
  noteIds: string[],
  deltaBeats: number,
  deltaMidi: number,
  groupWithPrevious = false,
): EditorState {
  const pattern = patternById(state, patternId);
  if (!pattern) return state;
  const selected = notesByIds(pattern, noteIds);
  if (!selected.length) return state;
  return execute(
    state,
    "Déplacer des notes",
    (draft) => {
      const draftPattern = draft.patterns.find((item) => item.id === patternId);
      if (!draftPattern) return;
      const wanted = new Set(noteIds);
      for (const event of draftPattern.events) {
        if (!wanted.has(event.id)) continue;
        event.start_beat = Math.max(0, Math.round((event.start_beat + deltaBeats) * 1000) / 1000);
        event.midi_note = Math.max(0, Math.min(127, Math.round(event.midi_note + deltaMidi)));
      }
    },
    groupWithPrevious,
  );
}

export function resizeNotes(
  state: EditorState,
  patternId: string,
  noteIds: string[],
  deltaBeats: number,
  groupWithPrevious = false,
): EditorState {
  const pattern = patternById(state, patternId);
  if (!pattern) return state;
  const selected = notesByIds(pattern, noteIds);
  if (!selected.length) return state;
  return execute(
    state,
    "Redimensionner des notes",
    (draft) => {
      const draftPattern = draft.patterns.find((item) => item.id === patternId);
      if (!draftPattern) return;
      const wanted = new Set(noteIds);
      for (const event of draftPattern.events) {
        if (!wanted.has(event.id)) continue;
        event.duration_beats = Math.max(NOTE_DURATION_MIN, Math.round((event.duration_beats + deltaBeats) * 1000) / 1000);
      }
    },
    groupWithPrevious,
  );
}

export function duplicateNotes(
  state: EditorState,
  patternId: string,
  noteIds: string[],
  deltaBeats = 0,
  deltaMidi = 0,
): EditorState {
  const pattern = patternById(state, patternId);
  if (!pattern) return state;
  const selected = notesByIds(pattern, noteIds);
  if (!selected.length) return state;
  const next = execute(state, "Dupliquer des notes", (draft) => {
    const draftPattern = draft.patterns.find((item) => item.id === patternId);
    if (!draftPattern) return;
    for (const event of selected) {
      draftPattern.events.push({
        ...event,
        id: newId(),
        start_beat: Math.max(0, Math.round((event.start_beat + deltaBeats) * 1000) / 1000),
        midi_note: Math.max(0, Math.min(127, Math.round(event.midi_note + deltaMidi))),
      });
    }
  });
  const copies = next.composition.patterns.find((item) => item.id === patternId)?.events.slice(-selected.length) ?? [];
  return selectNotes(next, copies.map((event) => event.id));
}

export function quantizeNotes(state: EditorState, patternId: string, noteIds: string[], snapBeats: number): EditorState {
  const pattern = patternById(state, patternId);
  if (!pattern) return state;
  const selected = notesByIds(pattern, noteIds);
  if (!selected.length) return state;
  return execute(state, "Quantifier des notes", (draft) => {
    const draftPattern = draft.patterns.find((item) => item.id === patternId);
    if (!draftPattern) return;
    const wanted = new Set(noteIds);
    for (const event of draftPattern.events) {
      if (!wanted.has(event.id)) continue;
      const snapped = Math.round(event.start_beat / snapBeats) * snapBeats;
      event.start_beat = Math.max(0, Math.round(snapped * 1000) / 1000);
    }
  });
}

export function swingNotes(state: EditorState, patternId: string, noteIds: string[], amount: number): EditorState {
  const pattern = patternById(state, patternId);
  if (!pattern) return state;
  const selected = allNotesWhenEmpty(pattern, noteIds);
  if (!selected.length) return state;
  const bounded = Math.min(1, Math.max(0, amount));
  return execute(state, "Appliquer le swing", (draft) => {
    const draftPattern = draft.patterns.find((item) => item.id === patternId);
    if (!draftPattern) return;
    const wanted = noteIds.length ? new Set(noteIds) : null;
    for (const event of draftPattern.events) {
      if (wanted && !wanted.has(event.id)) continue;
      if (Math.abs(event.start_beat % 1 - 0.5) < 1e-9) {
        event.start_beat = Math.round((event.start_beat + bounded * 0.25) * 1000) / 1000;
      }
    }
  });
}

export function humanizeNotes(
  state: EditorState,
  patternId: string,
  noteIds: string[],
  seed: number,
  amount: number,
): EditorState {
  const pattern = patternById(state, patternId);
  if (!pattern) return state;
  const selected = allNotesWhenEmpty(pattern, noteIds);
  if (!selected.length) return state;
  const bounded = Math.min(1, Math.max(0, amount));
  return execute(state, "Humaniser des notes", (draft) => {
    const draftPattern = draft.patterns.find((item) => item.id === patternId);
    if (!draftPattern) return;
    const wanted = noteIds.length ? new Set(noteIds) : null;
    for (const event of draftPattern.events) {
      if (wanted && !wanted.has(event.id)) continue;
      const first = (fnv1a(`${seed}:${event.id}`) % 1000) / 1000;
      const second = (fnv1a(`${seed + 1}:${event.id}`) % 1000) / 1000;
      event.velocity = Math.min(1, Math.max(0.05, event.velocity * (1 - bounded * 0.3 + first * bounded * 0.3)));
      event.micro_timing_beats =
        Math.round((Math.max(-1, Math.min(1, event.micro_timing_beats + (second - 0.5) * bounded * 0.5))) * 1000) / 1000;
    }
  });
}

export function transposeNotes(state: EditorState, patternId: string, noteIds: string[], semitones: number): EditorState {
  const pattern = patternById(state, patternId);
  if (!pattern) return state;
  const selected = notesByIds(pattern, noteIds);
  if (!selected.length) return state;
  return execute(state, "Transposer des notes", (draft) => {
    const draftPattern = draft.patterns.find((item) => item.id === patternId);
    if (!draftPattern) return;
    const wanted = new Set(noteIds);
    for (const event of draftPattern.events) {
      if (!wanted.has(event.id)) continue;
      event.midi_note = Math.max(0, Math.min(127, event.midi_note + semitones));
    }
  });
}

export function legatoNotes(state: EditorState, patternId: string, noteIds: string[]): EditorState {
  const pattern = patternById(state, patternId);
  if (!pattern) return state;
  const selected = notesByIds(pattern, noteIds);
  if (!selected.length) return state;
  return execute(state, "Étendre en legato", (draft) => {
    const draftPattern = draft.patterns.find((item) => item.id === patternId);
    if (!draftPattern) return;
    const wanted = new Set(noteIds);
    for (const event of draftPattern.events) {
      if (!wanted.has(event.id)) continue;
      const next = draftPattern.events
        .filter((candidate) => candidate.start_beat > event.start_beat + 1e-9)
        .sort((first, second) => first.start_beat - second.start_beat)[0];
      const end = next ? next.start_beat : patternLengthBeats(draftPattern);
      event.duration_beats = Math.max(NOTE_DURATION_MIN, Math.round((end - event.start_beat) * 1000) / 1000);
    }
  });
}

export function uniformDuration(
  state: EditorState,
  patternId: string,
  noteIds: string[],
  durationBeats: number,
): EditorState {
  const pattern = patternById(state, patternId);
  if (!pattern) return state;
  const selected = notesByIds(pattern, noteIds);
  if (!selected.length) return state;
  const duration = Math.max(NOTE_DURATION_MIN, durationBeats);
  return execute(state, "Uniformiser la durée", (draft) => {
    const draftPattern = draft.patterns.find((item) => item.id === patternId);
    if (!draftPattern) return;
    const wanted = new Set(noteIds);
    for (const event of draftPattern.events) {
      if (wanted.has(event.id)) event.duration_beats = duration;
    }
  });
}

export function invertNotes(state: EditorState, patternId: string, noteIds: string[], axisMidi: number): EditorState {
  const pattern = patternById(state, patternId);
  if (!pattern) return state;
  const selected = notesByIds(pattern, noteIds);
  if (!selected.length) return state;
  return execute(state, "Inverser des notes", (draft) => {
    const draftPattern = draft.patterns.find((item) => item.id === patternId);
    if (!draftPattern) return;
    const wanted = new Set(noteIds);
    for (const event of draftPattern.events) {
      if (wanted.has(event.id)) event.midi_note = Math.max(0, Math.min(127, 2 * axisMidi - event.midi_note));
    }
  });
}

export type ChordType = "majeur" | "mineur" | "septieme";

const CHORD_INTERVALS: Record<ChordType, number[]> = {
  majeur: [0, 4, 7],
  mineur: [0, 3, 7],
  septieme: [0, 4, 7, 10],
};

export function buildChord(state: EditorState, patternId: string, rootNoteId: string, type: ChordType): EditorState {
  const pattern = patternById(state, patternId);
  if (!pattern) return state;
  const root = pattern.events.find((event) => event.id === rootNoteId);
  if (!root) return state;
  const intervals = CHORD_INTERVALS[type];
  const next = execute(state, "Créer un accord", (draft) => {
    const draftPattern = draft.patterns.find((item) => item.id === patternId);
    if (!draftPattern) return;
    for (const interval of intervals) {
      const midi = Math.max(0, Math.min(127, root.midi_note + interval));
      if (midi === root.midi_note && interval === 0) continue;
      draftPattern.events.push({
        ...root,
        id: newId(),
        midi_note: midi,
      });
    }
  });
  const copies = next.composition.patterns.find((item) => item.id === patternId)?.events.slice(-(intervals.length - 1)) ?? [];
  return selectNotes(next, [...noteIds(state, patternId), ...copies.map((event) => event.id)]);
}

function noteIds(state: EditorState, patternId: string) {
  const pattern = patternById(state, patternId);
  if (!pattern) return [];
  const rootNote = state.selection.notes
    .map((id) => pattern.events.find((event) => event.id === id))
    .filter((event): event is NoteEvent => Boolean(event));
  return rootNote.map((event) => event.id);
}
