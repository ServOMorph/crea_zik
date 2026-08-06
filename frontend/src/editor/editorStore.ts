export type Track = {
  id: string;
  name: string;
  kind: string;
  gain?: number;
  pan?: number;
  [key: string]: unknown;
};

export type NoteEvent = {
  id: string;
  start_beat: number;
  duration_beats: number;
  midi_note: number;
  velocity: number;
  probability: number;
  micro_timing_beats: number;
  pan: number;
  [key: string]: unknown;
};

export type Pattern = {
  id: string;
  track_id: string;
  events: NoteEvent[];
  name?: string | null;
  color?: string | null;
  length_beats?: number | null;
  [key: string]: unknown;
};
export type Clip = {
  id: string;
  pattern_id: string;
  start_beat: number;
  length_beats: number;
  repeat_count?: number;
  transposition?: number;
  mute?: boolean;
  locked?: boolean;
  group?: string | null;
  [key: string]: unknown;
};

export type Marker = {
  id: string;
  beat: number;
  label: string;
  [key: string]: unknown;
};

export type MixerChannel = {
  id: string;
  track_id: string | null;
  gain: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  output: string;
  sends: Record<string, number>;
  effects: Record<string, unknown>[];
  [key: string]: unknown;
};

export type EditableComposition = {
  id: string;
  revision: number;
  title: string;
  tempo_bpm: number;
  time_signature: [number, number];
  tracks: Track[];
  patterns: Pattern[];
  clips: Clip[];
  markers?: Marker[];
  render_settings?: { duration_seconds?: number; [key: string]: unknown };
  mixer_channels?: MixerChannel[];
  master_channel?: MixerChannel;
  [key: string]: unknown;
};

export type CollectionName = "tracks" | "patterns" | "clips" | "markers";

export type EditorSelection = Record<CollectionName, string[]> & { notes: string[] };

export type TimeGrid = {
  snapBeats: number;
  horizontalZoom: number;
  verticalZoom: number;
  scrollBeat: number;
};

export type SelectionRectangle = {
  trackIds: string[];
  startBeat: number;
  endBeat: number;
};

type HistoryEntry = { label: string; before: EditableComposition; after: EditableComposition };

export type EditorState = {
  composition: EditableComposition;
  savedComposition: EditableComposition;
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  selection: EditorSelection;
  clipboard: { collection: CollectionName; records: Record<string, unknown>[] } | null;
  grid: TimeGrid;
  saveError: string | null;
  saving: boolean;
};

export type EditorOperation = (composition: EditableComposition) => void;

const EMPTY_SELECTION: EditorSelection = { tracks: [], patterns: [], clips: [], markers: [], notes: [] };
const DEFAULT_GRID: TimeGrid = { snapBeats: 0.25, horizontalZoom: 1, verticalZoom: 1, scrollBeat: 0 };
const MAX_HISTORY = 200;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function same(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function newId() {
  return crypto.randomUUID();
}

function collectionRecords(composition: EditableComposition, collection: CollectionName) {
  return composition[collection] as Record<string, unknown>[];
}

function limitHistory(entries: HistoryEntry[]) {
  return entries.slice(-MAX_HISTORY);
}

export function createEditorState(composition: EditableComposition): EditorState {
  const initial = clone(composition);
  return {
    composition: initial,
    savedComposition: clone(initial),
    undoStack: [],
    redoStack: [],
    selection: clone(EMPTY_SELECTION),
    clipboard: null,
    grid: { ...DEFAULT_GRID },
    saveError: null,
    saving: false,
  };
}

export function isDirty(state: EditorState) {
  return !same(state.composition, state.savedComposition);
}

export function execute(
  state: EditorState,
  label: string,
  operation: EditorOperation,
  groupWithPrevious = false,
): EditorState {
  const before = clone(state.composition);
  const after = clone(state.composition);
  operation(after);
  if (same(before, after)) return state;
  const previous = state.undoStack.at(-1);
  const grouped = groupWithPrevious && previous?.label === label && same(previous.after, before);
  const entry: HistoryEntry = {
    label,
    before: grouped ? previous.before : before,
    after: clone(after),
  };
  return {
    ...state,
    composition: after,
    undoStack: limitHistory(grouped ? [...state.undoStack.slice(0, -1), entry] : [...state.undoStack, entry]),
    redoStack: [],
    saveError: null,
  };
}

export function transaction(state: EditorState, label: string, operations: EditorOperation[]) {
  return execute(state, label, (composition) => operations.forEach((operation) => operation(composition)));
}

export function undo(state: EditorState): EditorState {
  const entry = state.undoStack.at(-1);
  if (!entry) return state;
  return {
    ...state,
    composition: clone(entry.before),
    undoStack: state.undoStack.slice(0, -1),
    redoStack: [...state.redoStack, entry],
    saveError: null,
  };
}

export function redo(state: EditorState): EditorState {
  const entry = state.redoStack.at(-1);
  if (!entry) return state;
  return {
    ...state,
    composition: clone(entry.after),
    undoStack: [...state.undoStack, entry],
    redoStack: state.redoStack.slice(0, -1),
    saveError: null,
  };
}

export function select(state: EditorState, collection: CollectionName, ids: string[], additive = false): EditorState {
  const selected = additive ? new Set([...state.selection[collection], ...ids]) : new Set(ids);
  return { ...state, selection: { ...state.selection, [collection]: [...selected] } };
}

export function selectAll(state: EditorState, collection: CollectionName): EditorState {
  return select(
    state,
    collection,
    collectionRecords(state.composition, collection).map((record) => String(record.id)),
  );
}

export function selectRectangle(state: EditorState, rectangle: SelectionRectangle, additive = false): EditorState {
  if (rectangle.startBeat > rectangle.endBeat) return state;
  const trackIds = new Set(rectangle.trackIds);
  const patternIds = new Set(
    state.composition.patterns.filter((pattern) => trackIds.has(pattern.track_id)).map((pattern) => pattern.id),
  );
  const clipIds = state.composition.clips
    .filter((clip) => {
      const clipEnd = clip.start_beat + clip.length_beats;
      return patternIds.has(clip.pattern_id) && clip.start_beat <= rectangle.endBeat && clipEnd >= rectangle.startBeat;
    })
    .map((clip) => clip.id);
  return select(state, "clips", clipIds, additive);
}

export function clearSelection(state: EditorState): EditorState {
  return { ...state, selection: clone(EMPTY_SELECTION) };
}

export function setGrid(state: EditorState, next: Partial<TimeGrid>): EditorState {
  const grid = { ...state.grid, ...next };
  if (grid.snapBeats <= 0 || grid.horizontalZoom <= 0 || grid.verticalZoom <= 0 || grid.scrollBeat < 0) return state;
  return { ...state, grid };
}

export function copySelection(state: EditorState, collection: CollectionName): EditorState {
  const selected = new Set(state.selection[collection]);
  const records = collectionRecords(state.composition, collection).filter((record) => selected.has(String(record.id)));
  return { ...state, clipboard: { collection, records: clone(records) } };
}

function deleteFromDraft(composition: EditableComposition, collection: CollectionName, ids: Set<string>) {
  if (collection === "tracks") {
    composition.tracks = composition.tracks.filter((track) => !ids.has(track.id));
    const patternIds = new Set(
      composition.patterns.filter((pattern) => ids.has(pattern.track_id)).map((pattern) => pattern.id),
    );
    composition.patterns = composition.patterns.filter((pattern) => !patternIds.has(pattern.id));
    composition.clips = composition.clips.filter((clip) => !patternIds.has(clip.pattern_id));
    return;
  }
  if (collection === "patterns") {
    composition.patterns = composition.patterns.filter((pattern) => !ids.has(pattern.id));
    composition.clips = composition.clips.filter((clip) => !ids.has(clip.pattern_id));
    return;
  }
  composition.clips = composition.clips.filter((clip) => !ids.has(clip.id));
}

export function deleteSelection(state: EditorState, collection: CollectionName): EditorState {
  const ids = new Set(state.selection[collection]);
  if (ids.size === 0) return state;
  const next = execute(state, `Supprimer ${collection}`, (composition) =>
    deleteFromDraft(composition, collection, ids),
  );
  return { ...next, selection: { ...next.selection, [collection]: [] } };
}

export function cutSelection(state: EditorState, collection: CollectionName): EditorState {
  return deleteSelection(copySelection(state, collection), collection);
}

export function paste(state: EditorState): EditorState {
  if (!state.clipboard || state.clipboard.records.length === 0) return state;
  const { collection, records } = state.clipboard;
  const copies = records.map((record) => ({ ...clone(record), id: newId() }));
  const next = execute(state, `Coller ${collection}`, (composition) => {
    (composition[collection] as Record<string, unknown>[]).push(...copies);
  });
  return select(
    next,
    collection,
    copies.map((record) => String(record.id)),
  );
}

export function duplicateSelection(state: EditorState, collection: CollectionName): EditorState {
  return paste(copySelection(state, collection));
}

export function markSaving(state: EditorState): EditorState {
  return { ...state, saving: true, saveError: null };
}

export function markSaveFailed(state: EditorState, message: string): EditorState {
  return { ...state, saving: false, saveError: message };
}

export function markSaved(state: EditorState, composition: EditableComposition): EditorState {
  const saved = clone(composition);
  return { ...state, composition: saved, savedComposition: clone(saved), saving: false, saveError: null };
}

export type StepField = "velocity" | "probability" | "micro_timing_beats" | "duration_beats";

const STEP_FIELD_BOUNDS: Record<StepField, [number, number]> = {
  velocity: [0.05, 1],
  probability: [0.05, 1],
  micro_timing_beats: [-1, 1],
  duration_beats: [0.05, 4],
};

export function stepBeat(stepIndex: number, stepsPerBeat: number) {
  return Math.round(stepIndex * (1 / stepsPerBeat) * 1000) / 1000;
}

export function patternLengthBeats(pattern: Pattern) {
  if (typeof pattern.length_beats === "number" && pattern.length_beats > 0) return pattern.length_beats;
  const end = pattern.events.reduce((max, event) => Math.max(max, event.start_beat + event.duration_beats), 0);
  return Math.max(end, 4);
}

function makeStepEvent(midiNote: number, beat: number, stepsPerBeat: number): NoteEvent {
  return {
    id: newId(),
    start_beat: beat,
    duration_beats: Math.min(1 / stepsPerBeat, 0.5),
    midi_note: midiNote,
    velocity: 0.7,
    probability: 1,
    micro_timing_beats: 0,
    pan: 0,
  };
}

function toggleStep(
  pattern: Pattern,
  midiNote: number,
  stepIndex: number,
  stepsPerBeat: number,
  enabled: boolean,
) {
  const beat = stepBeat(stepIndex, stepsPerBeat);
  const existingIndex = pattern.events.findIndex(
    (event) => event.midi_note === midiNote && Math.abs(event.start_beat - beat) < 1e-9,
  );
  if (enabled && existingIndex === -1) {
    pattern.events.push(makeStepEvent(midiNote, beat, stepsPerBeat));
  } else if (!enabled && existingIndex !== -1) {
    pattern.events.splice(existingIndex, 1);
  }
}

export type StepCell = { midiNote: number; stepIndex: number };

export function setStep(
  state: EditorState,
  patternId: string,
  midiNote: number,
  stepIndex: number,
  stepsPerBeat: number,
  enabled: boolean,
): EditorState {
  return setSteps(state, patternId, [{ midiNote, stepIndex }], stepsPerBeat, enabled);
}

export function setSteps(
  state: EditorState,
  patternId: string,
  cells: StepCell[],
  stepsPerBeat: number,
  enabled: boolean,
): EditorState {
  if (cells.length === 0) return state;
  return execute(state, enabled ? "Activer des pas" : "Désactiver des pas", (draft) => {
    const pattern = draft.patterns.find((item) => item.id === patternId);
    if (!pattern) return;
    for (const cell of cells) toggleStep(pattern, cell.midiNote, cell.stepIndex, stepsPerBeat, enabled);
  });
}

export function setStepFieldCells(
  state: EditorState,
  patternId: string,
  cells: StepCell[],
  stepsPerBeat: number,
  field: StepField,
  value: number,
): EditorState {
  if (cells.length === 0) return state;
  return execute(state, "Modifier des pas", (draft) => {
    const pattern = draft.patterns.find((item) => item.id === patternId);
    if (!pattern) return;
    const [min, max] = STEP_FIELD_BOUNDS[field];
    const bounded = Math.min(max, Math.max(min, value));
    for (const cell of cells) {
      const beat = stepBeat(cell.stepIndex, stepsPerBeat);
      const event = pattern.events.find(
        (item) => item.midi_note === cell.midiNote && Math.abs(item.start_beat - beat) < 1e-9,
      );
      if (!event) continue;
      event[field] = bounded;
    }
  });
}

export function stepEvent(events: NoteEvent[], midiNote: number, beat: number) {
  return events.find((event) => event.midi_note === midiNote && Math.abs(event.start_beat - beat) < 1e-9);
}

export function setStepField(
  state: EditorState,
  patternId: string,
  midiNote: number,
  stepIndex: number,
  stepsPerBeat: number,
  field: StepField,
  value: number,
): EditorState {
  return setStepFieldCells(state, patternId, [{ midiNote, stepIndex }], stepsPerBeat, field, value);
}

export function setTrackChannelFlag(
  state: EditorState,
  trackId: string,
  flag: "mute" | "solo",
  value: boolean,
): EditorState {
  return execute(state, `Modifier le ${flag}`, (draft) => {
    const channels = draft.mixer_channels ?? [];
    if (!draft.mixer_channels) draft.mixer_channels = channels;
    let channel = channels.find((item) => item.track_id === trackId);
    if (!channel) {
      channel = {
        id: newId(),
        track_id: trackId,
        gain: 1,
        pan: 0,
        mute: false,
        solo: false,
        output: "master",
        sends: {},
        effects: [],
      };
      channels.push(channel);
    }
    channel[flag] = value;
  });
}

export function addPattern(state: EditorState, trackId: string): EditorState {
  return execute(state, "Ajouter un pattern", (draft) => {
    draft.patterns.push({ id: newId(), track_id: trackId, events: [] });
  });
}

export function patternName(state: EditorState, patternId: string) {
  const pattern = state.composition.patterns.find((item) => item.id === patternId);
  if (pattern?.name) return pattern.name;
  const index = state.composition.patterns.findIndex((item) => item.id === patternId);
  return `Pattern ${index + 1}`;
}

const PATTERN_LENGTH_MIN = 0.25;
const PATTERN_LENGTH_MAX = 1024;

export function setPatternLength(
  state: EditorState,
  patternId: string,
  lengthBeats: number,
  groupWithPrevious = false,
): EditorState {
  const bounded = Math.round(Math.min(PATTERN_LENGTH_MAX, Math.max(PATTERN_LENGTH_MIN, lengthBeats)) * 1000) / 1000;
  return execute(state, "Modifier la longueur du pattern", (draft) => {
    const pattern = draft.patterns.find((item) => item.id === patternId);
    if (!pattern) return;
    pattern.length_beats = bounded;
  }, groupWithPrevious);
}

export function renamePattern(
  state: EditorState,
  patternId: string,
  name: string,
  groupWithPrevious = false,
): EditorState {
  const normalized = name.trim();
  if (!normalized) return state;
  return execute(state, "Renommer le pattern", (draft) => {
    const pattern = draft.patterns.find((item) => item.id === patternId);
    if (!pattern) return;
    pattern.name = normalized;
  }, groupWithPrevious);
}

const PATTERN_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export function setPatternColor(state: EditorState, patternId: string, color: string): EditorState {
  if (!PATTERN_COLOR_PATTERN.test(color)) return state;
  return execute(state, "Changer la couleur du pattern", (draft) => {
    const pattern = draft.patterns.find((item) => item.id === patternId);
    if (!pattern) return;
    pattern.color = color.toLowerCase();
  });
}

export function duplicatePattern(state: EditorState, patternId: string): EditorState {
  return execute(state, "Dupliquer le pattern", (draft) => {
    const source = draft.patterns.find((item) => item.id === patternId);
    if (!source) return;
    const base = source.name ?? patternName(state, patternId);
    const events = source.events.map((event) => ({ ...clone(event), id: newId() }));
    draft.patterns.push({ ...clone(source), id: newId(), name: `${base} (copie)`, events });
  });
}

export function fnv1a(text: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function varyPattern(state: EditorState, patternId: string, salt: number): EditorState {
  return execute(state, "Créer une variation", (draft) => {
    const source = draft.patterns.find((item) => item.id === patternId);
    if (!source) return;
    const base = source.name ?? patternName(state, patternId);
    const events = source.events.map((event) => {
      const modified = { ...clone(event), id: newId() };
      const choice = fnv1a(`${salt}:${event.id}`) % 5;
      if (choice === 0) modified.velocity = Math.min(1, Math.max(0.05, event.velocity * 0.85));
      else if (choice === 1) modified.velocity = Math.min(1, Math.max(0.05, event.velocity * 1.1));
      else if (choice === 2) modified.probability = Math.min(1, Math.max(0.05, event.probability * 0.8));
      else if (choice === 3)
        modified.micro_timing_beats = Math.min(1, Math.max(-1, event.micro_timing_beats + 0.1));
      return modified;
    });
    draft.patterns.push({ ...clone(source), id: newId(), name: `${base} (variation)`, events });
  });
}

export function fillPatternRow(
  state: EditorState,
  patternId: string,
  midiNote: number,
  stepsPerBeat: number,
  kind: "all" | "beats",
): EditorState {
  return execute(state, kind === "all" ? "Remplir la rangée" : "Remplir aux temps", (draft) => {
    const pattern = draft.patterns.find((item) => item.id === patternId);
    if (!pattern) return;
    const stepCount = Math.ceil(patternLengthBeats(pattern) * stepsPerBeat);
    const otherRows = pattern.events.filter((event) => event.midi_note !== midiNote);
    const filled: NoteEvent[] = [];
    for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
      const beat = stepBeat(stepIndex, stepsPerBeat);
      if (kind === "beats" && beat % 1 !== 0) continue;
      const existing = pattern.events.find(
        (event) => event.midi_note === midiNote && Math.abs(event.start_beat - beat) < 1e-9,
      );
      filled.push(existing ? clone(existing) : makeStepEvent(midiNote, beat, stepsPerBeat));
    }
    pattern.events = [...otherRows, ...filled];
  });
}

export function clearPatternRow(state: EditorState, patternId: string, midiNote: number): EditorState {
  return execute(state, "Vider la rangée", (draft) => {
    const pattern = draft.patterns.find((item) => item.id === patternId);
    if (!pattern) return;
    pattern.events = pattern.events.filter((event) => event.midi_note !== midiNote);
  });
}
