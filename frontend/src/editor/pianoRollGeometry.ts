import type { NoteEvent } from "./editorStore";

export const KEY_WIDTH = 130;
export const ROW_HEIGHT = 24;
export const PIXELS_PER_BEAT = 40;
export const MIDI_MIN = 0;
export const MIDI_MAX = 127;

export type PianoGeometry = {
  horizontalZoom: number;
  scrollBeat: number;
};

export function beatToX(beat: number, geometry: PianoGeometry) {
  return (beat - geometry.scrollBeat) * PIXELS_PER_BEAT * geometry.horizontalZoom;
}

export function xToBeat(x: number, geometry: PianoGeometry) {
  return geometry.scrollBeat + x / (PIXELS_PER_BEAT * geometry.horizontalZoom);
}

export function snapToGrid(beat: number, snapBeats: number) {
  return Math.round(beat / snapBeats) * snapBeats;
}

export function noteToY(midiNote: number, topMidiNote: number, rowHeight = ROW_HEIGHT) {
  return (topMidiNote - midiNote) * rowHeight;
}

export function yToNote(y: number, topMidiNote: number, rowHeight = ROW_HEIGHT) {
  return Math.round(topMidiNote - y / rowHeight);
}

export function visibleRange(events: NoteEvent[]) {
  if (!events.length) return { minMidi: 48, maxMidi: 72, rows: 25 };
  const min = Math.min(...events.map((event) => event.midi_note));
  const max = Math.max(...events.map((event) => event.midi_note));
  const minMidi = Math.max(MIDI_MIN, Math.floor((min - 12) / 12) * 12);
  const maxMidi = Math.min(MIDI_MAX, Math.ceil((max + 12) / 12) * 12 - 1);
  return { minMidi, maxMidi, rows: maxMidi - minMidi + 1 };
}

const NOTE_NAMES = ["Do", "Do#", "Ré", "Ré#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];

export function noteName(midiNote: number) {
  const clamped = Math.max(MIDI_MIN, Math.min(MIDI_MAX, midiNote));
  const octave = Math.floor(clamped / 12) - 1;
  return `${NOTE_NAMES[clamped % 12]}${octave}`;
}

export function noteClass(midiNote: number) {
  return ((midiNote % 12) + 12) % 12;
}

export function scaleDegrees(tonic: number, mode: "majeure" | "mineure") {
  const intervals = mode === "majeure" ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
  return new Set(intervals.map((interval) => (tonic + interval) % 12));
}

export function inScale(midiNote: number, degrees: Set<number>) {
  return degrees.has(noteClass(midiNote));
}
