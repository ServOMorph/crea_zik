import { useRef, useState } from "react";

import type { NoteEvent, Pattern, TimeGrid } from "./editorStore";
import { patternLengthBeats } from "./editorStore";
import type { ChordType, NoteField } from "./noteCommands";
import {
  KEY_WIDTH,
  MIDI_MAX,
  ROW_HEIGHT,
  PIXELS_PER_BEAT,
  beatToX,
  inScale,
  noteClass,
  noteName,
  noteToY,
  scaleDegrees,
  snapToGrid,
  visibleRange,
  xToBeat,
  yToNote,
} from "./pianoRollGeometry";

const TONIC_NAMES = ["Do", "Do#", "Ré", "Ré#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];

type PianoRollProps = {
  pattern: Pattern;
  grid: TimeGrid;
  selectedNoteIds: string[];
  positionBeat?: number;
  onSelectNotes: (noteIds: string[], additive: boolean) => void;
  onAddNote: (startBeat: number, durationBeats: number, midiNote: number) => void;
  onMoveNotes: (noteIds: string[], deltaBeats: number, deltaMidi: number, groupWithPrevious?: boolean) => void;
  onResizeNotes: (noteIds: string[], deltaBeats: number, groupWithPrevious?: boolean) => void;
  onDeleteNotes: (noteIds: string[]) => void;
  onSetNoteFields: (noteIds: string[], field: NoteField, value: number, groupWithPrevious?: boolean) => void;
  onQuantize: (noteIds: string[]) => void;
  onSwing: (noteIds: string[], amount: number) => void;
  onHumanize: (noteIds: string[]) => void;
  onTranspose: (noteIds: string[], semitones: number) => void;
  onLegato: (noteIds: string[]) => void;
  onUniformDuration: (noteIds: string[], durationBeats: number) => void;
  onInvert: (noteIds: string[], axisMidi: number) => void;
  onBuildChord: (rootNoteId: string, type: ChordType) => void;
  onDuplicateNotes: (noteIds: string[], deltaBeats: number, deltaMidi: number) => void;
  onPreview: () => void;
  ghostNotes?: NoteEvent[];
};

const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);
const DEFAULT_DURATION = 0.5;
const RESIZE_HANDLE_PX = 8;
const DRAG_THRESHOLD_PX = 6;
const LANE_HEIGHT = 56;
const LANE_FIELDS: { field: NoteField; label: string }[] = [
  { field: "velocity", label: "Vélocité" },
  { field: "probability", label: "Probabilité" },
  { field: "micro_timing_beats", label: "Micro-décalage" },
  { field: "pan", label: "Pan" },
];

function laneValue(field: NoteField, y: number): number {
  const ratio = 1 - Math.min(LANE_HEIGHT, Math.max(0, y)) / LANE_HEIGHT;
  if (field === "velocity" || field === "probability") {
    return Math.round(Math.min(1, Math.max(0.05, 0.05 + ratio * 0.95)) * 100) / 100;
  }
  return Math.round(Math.min(1, Math.max(-1, (ratio - 0.5) * 2)) / 0.05) * 0.05;
}

function laneBarStyle(field: NoteField, event: NoteEvent, horizontalZoom: number) {
  const width = Math.max(4, event.duration_beats * PIXELS_PER_BEAT * horizontalZoom);
  if (field === "velocity" || field === "probability") {
    return { bottom: 5, height: Math.max(4, event[field] * (LANE_HEIGHT - 10)), width };
  }
  const value = field === "micro_timing_beats" ? event.micro_timing_beats : event.pan;
  const top = (1 - (value + 1) / 2) * (LANE_HEIGHT - 12) + 5;
  const marginLeft = field === "micro_timing_beats" ? value * 14 : 0;
  return { top, height: 8, width, marginLeft };
}

function laneDisplay(field: NoteField, event: NoteEvent) {
  if (field === "velocity" || field === "probability") return `${Math.round(event[field] * 100)} %`;
  if (field === "micro_timing_beats") return `${event.micro_timing_beats} temps`;
  return `${Math.round(event.pan * 100)} %`;
}

type DragState =
  | { kind: "maybe-create"; startX: number; startY: number }
  | { kind: "rect"; startX: number; startY: number }
  | {
      kind: "move";
      noteIds: string[];
      startX: number;
      startY: number;
      starts: Map<string, { startBeat: number; midi: number }>;
      lastDeltaBeat: number;
      lastDeltaMidi: number;
    }
  | { kind: "resize"; noteIds: string[]; startX: number; ends: Map<string, number>; lastDelta: number };

function noteRect(event: NoteEvent, topMidiNote: number, geometry: { horizontalZoom: number; scrollBeat: number }) {
  return {
    x: beatToX(event.start_beat, geometry),
    y: noteToY(event.midi_note, topMidiNote),
    width: event.duration_beats * PIXELS_PER_BEAT * geometry.horizontalZoom,
    height: ROW_HEIGHT,
  };
}

export function PianoRoll({
  pattern,
  grid,
  selectedNoteIds,
  positionBeat,
  onSelectNotes,
  onAddNote,
  onMoveNotes,
  onResizeNotes,
  onDeleteNotes,
  onSetNoteFields,
  onQuantize,
  onSwing,
  onHumanize,
  onTranspose,
  onLegato,
  onUniformDuration,
  onInvert,
  onBuildChord,
  onDuplicateNotes,
  onPreview,
  ghostNotes = [],
}: PianoRollProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const laneDragRef = useRef<{ noteIds: string[]; field: NoteField; laneTop: number } | null>(null);
  const currentRef = useRef({ x: 0, y: 0 });
  const [swingAmount, setSwingAmount] = useState(0.25);
  const [uniformBeats, setUniformBeats] = useState(1);
  const [scale, setScale] = useState<{ tonic: number; mode: "majeure" | "mineure" }>({
    tonic: 0,
    mode: "majeure",
  });
  const degrees = scaleDegrees(scale.tonic, scale.mode);

  const geometry = { horizontalZoom: grid.horizontalZoom, scrollBeat: grid.scrollBeat };
  const lengthBeats = patternLengthBeats(pattern);
  const range = visibleRange(pattern.events);
  const topMidiNote = range.maxMidi;
  const boardWidth = lengthBeats * PIXELS_PER_BEAT * grid.horizontalZoom;
  const boardHeight = range.rows * ROW_HEIGHT;
  const selected = new Set(selectedNoteIds);
  const focus = pattern.events
    .filter((event) => selected.has(event.id))
    .sort((a, b) => a.start_beat - b.start_beat)
    .at(-1);
  const focusEvent = focus
    ? {
        velocity: focus.velocity,
        probability: focus.probability,
        microTiming: focus.micro_timing_beats,
        pan: focus.pan,
      }
    : null;

  const localPoint = (clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const selectionWidth = () => {
    const notes = pattern.events.filter((event) => selected.has(event.id));
    if (!notes.length) return grid.snapBeats;
    const minStart = Math.min(...notes.map((event) => event.start_beat));
    const maxEnd = Math.max(...notes.map((event) => event.start_beat + event.duration_beats));
    return Math.max(grid.snapBeats, maxEnd - minStart);
  };

  const selectInRect = (drag: Extract<DragState, { kind: "rect" }>) => {
    const current = currentRef.current;
    const minX = Math.max(KEY_WIDTH, Math.min(drag.startX, current.x));
    const maxX = Math.max(drag.startX, current.x);
    const minY = Math.min(drag.startY, current.y);
    const maxY = Math.max(drag.startY, current.y);
    const minBeat = xToBeat(minX - KEY_WIDTH, geometry);
    const maxBeat = xToBeat(maxX - KEY_WIDTH, geometry);
    const ids = pattern.events
      .filter((event) => {
        const rect = noteRect(event, topMidiNote, geometry);
        return (
          event.start_beat <= maxBeat &&
          event.start_beat + event.duration_beats >= minBeat &&
          rect.y <= maxY &&
          rect.y + rect.height >= minY
        );
      })
      .map((event) => event.id);
    onSelectNotes(ids, false);
  };

  const selectedIds = (event: NoteEvent) =>
    selectedNoteIds.includes(event.id) ? selectedNoteIds : [event.id];

  return (
    <section className="piano-roll" aria-labelledby="piano-roll-heading">
      <div className="piano-roll__toolbar">
        <h3 id="piano-roll-heading">Piano Roll</h3>
        <label>
          Tonique
          <select
            aria-label="Tonique de la gamme"
            value={scale.tonic}
            onChange={(event) => setScale({ ...scale, tonic: Number(event.target.value) })}
          >
            {TONIC_NAMES.map((name, tonic) => (
              <option key={name} value={tonic}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Gamme
          <select
            aria-label="Mode de la gamme"
            value={scale.mode}
            onChange={(event) =>
              setScale({ ...scale, mode: event.target.value as "majeure" | "mineure" })
            }
          >
            <option value="majeure">Majeure</option>
            <option value="mineure">Mineure</option>
          </select>
        </label>
        <button type="button" disabled={!selectedNoteIds.length} onClick={() => onQuantize(selectedNoteIds)}>
          Quantifier
        </button>
        <button
          type="button"
          disabled={!selectedNoteIds.length}
          onClick={() => onHumanize(selectedNoteIds)}
        >
          Humaniser
        </button>
        <label>
          Swing
          <input
            aria-label="Quantité de swing"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={swingAmount}
            onChange={(event) => setSwingAmount(Number(event.target.value))}
          />
          <output>{Math.round(swingAmount * 100)} %</output>
        </label>
        <button type="button" onClick={() => onSwing(selectedNoteIds, swingAmount)}>
          Appliquer le swing
        </button>
        <label>
          Durée uniforme
          <input
            aria-label="Durée uniforme"
            type="number"
            min="0.05"
            step="0.25"
            value={uniformBeats}
            onChange={(event) => setUniformBeats(Number(event.target.value))}
          />
        </label>
        <button
          type="button"
          disabled={!selectedNoteIds.length}
          onClick={() => onUniformDuration(selectedNoteIds, uniformBeats)}
        >
          Uniformiser
        </button>
        <button type="button" disabled={!selectedNoteIds.length} onClick={() => onTranspose(selectedNoteIds, -12)}>
          Transposer −12
        </button>
        <button type="button" disabled={!selectedNoteIds.length} onClick={() => onTranspose(selectedNoteIds, 12)}>
          Transposer +12
        </button>
        <button
          type="button"
          disabled={!selectedNoteIds.length}
          onClick={() => onBuildChord(selectedNoteIds.at(-1) ?? "", "majeur")}
        >
          Accord majeur
        </button>
        <button
          type="button"
          disabled={!selectedNoteIds.length}
          onClick={() => onBuildChord(selectedNoteIds.at(-1) ?? "", "mineur")}
        >
          Accord mineur
        </button>
        <button
          type="button"
          disabled={!selectedNoteIds.length}
          onClick={() => onBuildChord(selectedNoteIds.at(-1) ?? "", "septieme")}
        >
          Accord septième
        </button>
        <button type="button" disabled={!selectedNoteIds.length} onClick={() => onLegato(selectedNoteIds)}>
          Legato
        </button>
        <button
          type="button"
          disabled={!selectedNoteIds.length}
          onClick={() => onInvert(selectedNoteIds, focus?.midi_note ?? 60)}
        >
          Inverser
        </button>
        <button
          type="button"
          disabled={!selectedNoteIds.length}
          onClick={() => onDuplicateNotes(selectedNoteIds, selectionWidth(), 0)}
        >
          Dupliquer
        </button>
        <button type="button" disabled={!selectedNoteIds.length} onClick={() => onDeleteNotes(selectedNoteIds)}>
          Supprimer
        </button>
        <button type="button" onClick={() => onSelectNotes(pattern.events.map((event) => event.id), false)}>
          Tout sélectionner
        </button>
        <button type="button" onClick={onPreview}>
          Préécouter le pattern
        </button>
      </div>
      <div className="piano-roll__scroll">
        <div
          className="piano-roll__stage"
          style={{ width: KEY_WIDTH + boardWidth, height: boardHeight + LANE_FIELDS.length * LANE_HEIGHT }}
        >
          <div
            ref={boardRef}
            className="piano-roll__board"
            role="application"
            aria-label="Piano roll"
            tabIndex={0}
            style={{ width: KEY_WIDTH + boardWidth, height: boardHeight }}
          onKeyDown={(event) => {
            if ((event.key === "Delete" || event.key === "Backspace") && selectedNoteIds.length) {
              event.preventDefault();
              onDeleteNotes(selectedNoteIds);
            }
          }}
          onPointerDown={(pointerEvent) => {
            const { x, y } = localPoint(pointerEvent.clientX, pointerEvent.clientY);
            if (x <= KEY_WIDTH) return;
            dragRef.current = { kind: "maybe-create", startX: x, startY: y };
            currentRef.current = { x, y };
          }}
          onPointerMove={(pointerEvent) => {
            const drag = dragRef.current;
            if (!drag) return;
            const { x, y } = localPoint(pointerEvent.clientX, pointerEvent.clientY);
            currentRef.current = { x, y };
            if (drag.kind === "maybe-create") {
              if (Math.hypot(x - drag.startX, y - drag.startY) > DRAG_THRESHOLD_PX) {
                dragRef.current = { kind: "rect", startX: drag.startX, startY: drag.startY };
              }
              return;
            }
            if (drag.kind === "rect") return;
            if (drag.kind === "move") {
              const rawDelta = xToBeat(x, geometry) - xToBeat(drag.startX, geometry);
              const leader = drag.starts.get(drag.noteIds[0]);
              if (!leader) return;
              const snapped = snapToGrid(leader.startBeat + rawDelta, grid.snapBeats) - leader.startBeat;
              const deltaMidi = Math.round((drag.startY - y) / ROW_HEIGHT);
              onMoveNotes(
                drag.noteIds,
                snapped - drag.lastDeltaBeat,
                deltaMidi - drag.lastDeltaMidi,
                true,
              );
              drag.lastDeltaBeat = snapped;
              drag.lastDeltaMidi = deltaMidi;
            } else if (drag.kind === "resize") {
              const leader = drag.noteIds[0];
              const end = drag.ends.get(leader);
              if (end === undefined) return;
              const rawDelta = (x - drag.startX) / (PIXELS_PER_BEAT * grid.horizontalZoom);
              const newEnd = snapToGrid(end + rawDelta, grid.snapBeats);
              onResizeNotes(drag.noteIds, newEnd - end - drag.lastDelta, true);
              drag.lastDelta = newEnd - end;
            }
          }}
          onPointerUp={() => {
            const drag = dragRef.current;
            dragRef.current = null;
            if (!drag) return;
            if (drag.kind === "maybe-create") {
              const startBeat = Math.max(0, snapToGrid(xToBeat(drag.startX - KEY_WIDTH, geometry), grid.snapBeats));
              const midi = Math.max(0, Math.min(MIDI_MAX, yToNote(drag.startY, topMidiNote)));
              onAddNote(startBeat, DEFAULT_DURATION, midi);
            } else if (drag.kind === "rect") {
              selectInRect(drag);
            }
          }}
          onPointerLeave={() => {
            dragRef.current = null;
          }}
        >
          <div className="piano-roll__keys" style={{ width: KEY_WIDTH }}>
            {Array.from({ length: range.rows }, (_, offset) => {
              const midi = topMidiNote - offset;
              const midiClass = noteClass(midi);
              return (
                <button
                  key={midi}
                  type="button"
                  className={[
                    "piano-roll__key",
                    BLACK_KEYS.has(midiClass) ? "is-black" : undefined,
                    !inScale(midi, degrees) ? "is-offscale" : undefined,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-label={`Note ${noteName(midi)}`}
                  onClick={() => {
                    onSelectNotes(
                      pattern.events.filter((event) => event.midi_note === midi).map((event) => event.id),
                      false,
                    );
                  }}
                >
                  {midi % 12 === 0 || midi % 12 === 5 ? noteName(midi) : ""}
                </button>
              );
            })}
          </div>
          <div className="piano-roll__cells" style={{ left: KEY_WIDTH, width: boardWidth, height: boardHeight }}>
            {Array.from({ length: Math.ceil(lengthBeats / 4) + 1 }, (_, index) => {
              const beat = index * 4;
              const x = beatToX(beat, geometry);
              if (x < -1 || x > boardWidth + 1) return null;
              return <div key={beat} className="piano-roll__bar" style={{ left: x }} />;
            })}
            {positionBeat !== undefined && (
              <div
                className="piano-roll__playhead"
                style={{ left: beatToX(positionBeat, geometry) }}
              />
            )}
            {ghostNotes.map((event) => {
              const rect = noteRect(event, topMidiNote, geometry);
              return (
                <div
                  key={event.id}
                  className="piano-roll__ghost-note"
                  aria-hidden="true"
                  style={{
                    left: rect.x,
                    top: rect.y,
                    width: Math.max(rect.width, 4),
                    height: rect.height,
                  }}
                />
              );
            })}
            {pattern.events
              .slice()
              .sort((a, b) => a.start_beat - b.start_beat)
              .map((event) => {
                const rect = noteRect(event, topMidiNote, geometry);
                const isSelected = selected.has(event.id);
                const isFocus = focus?.id === event.id;
                return (
                  <div
                    key={event.id}
                    className={[
                      "piano-roll__note",
                      isSelected ? "is-selected" : undefined,
                      isFocus ? "is-focus" : undefined,
                      !inScale(event.midi_note, degrees) ? "is-offscale" : undefined,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{
                      left: rect.x,
                      top: rect.y,
                      width: Math.max(rect.width, 4),
                      height: rect.height,
                    }}
                    role="button"
                    aria-label={`Note ${noteName(event.midi_note)}, temps ${event.start_beat}, durée ${
                      event.duration_beats
                    }, vélocité ${Math.round(event.velocity * 100)} %`}
                    tabIndex={0}
                    onKeyDown={(keyEvent) => {
                      if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                        keyEvent.preventDefault();
                        onSelectNotes([event.id], keyEvent.ctrlKey || keyEvent.metaKey);
                      }
                    }}
                    onPointerDown={(pointerEvent) => {
                      pointerEvent.stopPropagation();
                      pointerEvent.preventDefault();
                      onSelectNotes([event.id], pointerEvent.ctrlKey || pointerEvent.metaKey);
                      const { x, y } = localPoint(pointerEvent.clientX, pointerEvent.clientY);
                      const ids = selectedIds(event);
                      if (rect.x + rect.width - (x - KEY_WIDTH) <= RESIZE_HANDLE_PX) {
                        dragRef.current = {
                          kind: "resize",
                          noteIds: ids,
                          startX: x,
                          ends: new Map(
                            ids.map((id) => {
                              const note = pattern.events.find((item) => item.id === id);
                              return [id, note ? note.start_beat + note.duration_beats : 0] as const;
                            }),
                          ),
                          lastDelta: 0,
                        };
                      } else {
                        dragRef.current = {
                          kind: "move",
                          noteIds: ids,
                          startX: x,
                          startY: y,
                          starts: new Map(
                            ids.map((id) => {
                              const note = pattern.events.find((item) => item.id === id);
                              return [id, { startBeat: note?.start_beat ?? 0, midi: note?.midi_note ?? 0 }] as const;
                            }),
                          ),
                          lastDeltaBeat: 0,
                          lastDeltaMidi: 0,
                        };
                      }
                      currentRef.current = { x, y };
                    }}
                  />
                );
              })}
          </div>
          <div
            className="piano-roll__lanes"
            style={{ top: boardHeight, width: KEY_WIDTH + boardWidth }}
            onPointerDown={(pointerEvent) => {
              const bar = (pointerEvent.target as HTMLElement).closest("[data-lane-bar]");
              if (!bar) return;
              pointerEvent.preventDefault();
              const { y } = localPoint(pointerEvent.clientX, pointerEvent.clientY);
              const field = bar.getAttribute("data-field") as NoteField;
              const noteIds = JSON.parse(bar.getAttribute("data-note-ids") ?? "[]") as string[];
              const laneTop = Number(bar.getAttribute("data-lane-top") ?? "0");
              laneDragRef.current = { noteIds, field, laneTop };
              onSetNoteFields(noteIds, field, laneValue(field, y - boardHeight - laneTop));
            }}
            onPointerMove={(pointerEvent) => {
              const drag = laneDragRef.current;
              if (!drag) return;
              const { y } = localPoint(pointerEvent.clientX, pointerEvent.clientY);
              onSetNoteFields(drag.noteIds, drag.field, laneValue(drag.field, y - boardHeight - drag.laneTop), true);
            }}
            onPointerUp={() => {
              laneDragRef.current = null;
            }}
            onPointerLeave={() => {
              laneDragRef.current = null;
            }}
          >
            {LANE_FIELDS.map((lane, laneIndex) => (
              <div
                key={lane.field}
                className="piano-roll__lane"
                style={{ height: LANE_HEIGHT }}
                role="group"
                aria-label={`Lane ${lane.label}`}
              >
                <span className="piano-roll__lane-label">{lane.label}</span>
                {pattern.events.map((event) => {
                  const bar = laneBarStyle(lane.field, event, grid.horizontalZoom);
                  return (
                    <div
                      key={event.id}
                      className={[
                        "piano-roll__lane-bar",
                        `is-${lane.field === "micro_timing_beats" ? "micro" : lane.field}`,
                      ].join(" ")}
                      style={{ left: KEY_WIDTH + beatToX(event.start_beat, geometry), ...bar }}
                      data-lane-bar
                      data-field={lane.field}
                      data-note-ids={JSON.stringify(selectedIds(event))}
                      data-lane-top={laneIndex * LANE_HEIGHT}
                      role="button"
                      aria-label={`${lane.label} de ${noteName(event.midi_note)} : ${laneDisplay(lane.field, event)}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>
      <div className="piano-roll__editor">
        {focusEvent && focus ? (
          <>
            <p>
              {noteName(focus.midi_note)} · temps {focus.start_beat}
              {selectedNoteIds.length > 1 ? ` · ${selectedNoteIds.length} notes sélectionnées` : ""}
            </p>
            <label>
              Vélocité
              <input
                aria-label="Vélocité des notes"
                type="range"
                min="0.05"
                max="1"
                step="0.01"
                value={focusEvent.velocity}
                onChange={(event) => onSetNoteFields(selectedNoteIds, "velocity", Number(event.target.value))}
              />
              <output>{Math.round(focusEvent.velocity * 100)} %</output>
            </label>
            <label>
              Probabilité
              <input
                aria-label="Probabilité des notes"
                type="range"
                min="0.05"
                max="1"
                step="0.01"
                value={focusEvent.probability}
                onChange={(event) => onSetNoteFields(selectedNoteIds, "probability", Number(event.target.value))}
              />
              <output>{Math.round(focusEvent.probability * 100)} %</output>
            </label>
            <label>
              Micro-décalage
              <input
                aria-label="Micro-décalage des notes"
                type="range"
                min="-1"
                max="1"
                step="0.05"
                value={focusEvent.microTiming}
                onChange={(event) => onSetNoteFields(selectedNoteIds, "micro_timing_beats", Number(event.target.value))}
              />
              <output>{focusEvent.microTiming} temps</output>
            </label>
            <label>
              Pan
              <input
                aria-label="Pan des notes"
                type="range"
                min="-1"
                max="1"
                step="0.05"
                value={focusEvent.pan}
                onChange={(event) => onSetNoteFields(selectedNoteIds, "pan", Number(event.target.value))}
              />
              <output>{Math.round(focusEvent.pan * 100)} %</output>
            </label>
          </>
        ) : (
          <p className="piano-roll__hint">Cliquez dans la grille pour créer une note, puis réglez-la ici.</p>
        )}
      </div>
    </section>
  );
}
