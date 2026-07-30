export type Track = {
  id: string;
  name: string;
  kind: string;
  gain?: number;
  pan?: number;
  [key: string]: unknown;
};

export type Pattern = { id: string; track_id: string; [key: string]: unknown };
export type Clip = { id: string; pattern_id: string; start_beat: number; length_beats: number; [key: string]: unknown };

export type EditableComposition = {
  id: string;
  revision: number;
  title: string;
  tempo_bpm: number;
  time_signature: [number, number];
  tracks: Track[];
  patterns: Pattern[];
  clips: Clip[];
  [key: string]: unknown;
};

export type CollectionName = "tracks" | "patterns" | "clips";

export type EditorSelection = Record<CollectionName, string[]>;

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

const EMPTY_SELECTION: EditorSelection = { tracks: [], patterns: [], clips: [] };
const DEFAULT_GRID: TimeGrid = { snapBeats: 0.25, horizontalZoom: 1, verticalZoom: 1, scrollBeat: 0 };
const MAX_HISTORY = 200;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function same(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function newId() {
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
