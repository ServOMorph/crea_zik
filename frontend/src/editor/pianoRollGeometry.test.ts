import { assert, integer, property } from "fast-check";
import { describe, expect, it } from "vitest";

import {
  MIDI_MAX,
  MIDI_MIN,
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

import type { NoteEvent } from "./editorStore";

const flat = { horizontalZoom: 1, scrollBeat: 0 };

describe("pianoRoll — géométrie temps", () => {
  it("fait un aller-retour exact entre beats et pixels", () => {
    assert(
      property(integer({ min: 0, max: 100000 }), (milliBeats) => {
        const beat = milliBeats / 1000;
        expect(xToBeat(beatToX(beat, flat), flat)).toBeCloseTo(beat, 6);
      }),
    );
  });

  it("fait un aller-retour exact entre midi et pixels", () => {
    assert(
      property(integer({ min: MIDI_MIN, max: MIDI_MAX }), (midi) => {
        expect(yToNote(noteToY(midi, 80), 80)).toBe(midi);
      }),
    );
  });

  it("convertit avec zoom et scroll", () => {
    const zoomed = { horizontalZoom: 2, scrollBeat: 4 };
    expect(beatToX(4, zoomed)).toBe(0);
    expect(beatToX(5, zoomed)).toBe(PIXELS_PER_BEAT * 2);
    expect(xToBeat(0, zoomed)).toBe(4);
    expect(noteToY(60, 64)).toBe(4 * 24);
    expect(noteToY(64, 64)).toBe(0);
  });

  it("snap arrondit au multiple et reste monotone et idempotent", () => {
    assert(
      property(integer({ min: 0, max: 100000 }), (milliBeats) => {
        const beat = milliBeats / 1000;
        const snapped = snapToGrid(beat, 0.5);
        expect(snapped % 0.5).toBe(0);
        expect(snapToGrid(snapped, 0.5)).toBe(snapped);
      }),
    );
    expect(snapToGrid(0.49, 0.5)).toBe(0.5);
    expect(snapToGrid(1.7, 1)).toBe(2);
    expect(snapToGrid(2.1, 1)).toBe(2);
  });
});

describe("pianoRoll — plage visible", () => {
  function event(midi_note: number): NoteEvent {
    return {
      id: String(midi_note),
      start_beat: 0,
      duration_beats: 0.5,
      midi_note,
      velocity: 0.7,
      probability: 1,
      micro_timing_beats: 0,
      pan: 0,
    };
  }

  it("englobe les événements dans des bornes octavées", () => {
    assert(
      property(integer({ min: 0, max: 55 }), integer({ min: 44, max: 60 }), (low, high) => {
        const range = visibleRange([event(MIDI_MIN + low), event(MIDI_MAX - high)]);
        expect(range.minMidi).toBeLessThanOrEqual(MIDI_MIN + low);
        expect(range.maxMidi).toBeGreaterThanOrEqual(MIDI_MAX - high);
        expect(range.minMidi % 12).toBe(0);
        expect((range.maxMidi + 1) % 12).toBe(0);
        expect(range.rows).toBe(range.maxMidi - range.minMidi + 1);
      }),
    );
  });

  it("clamp les bornes à la plage midi sur les extrêmes", () => {
    expect(visibleRange([event(0), event(127)])).toEqual({ minMidi: 0, maxMidi: 127, rows: 128 });
  });

  it("retourne une plage par défaut sur un pattern vide", () => {
    expect(visibleRange([])).toEqual({ minMidi: 48, maxMidi: 72, rows: 25 });
  });
});

describe("pianoRoll — notes et gammes", () => {
  it("nomme les notes en français avec octave", () => {
    expect(noteName(60)).toBe("Do4");
    expect(noteName(62)).toBe("Ré4");
    expect(noteName(69)).toBe("La4");
    expect(noteName(9)).toBe("La-1");
    expect(noteName(0)).toBe("Do-1");
    expect(noteName(127)).toBe("Sol9");
    expect(noteName(500)).toBe("Sol9");
  });

  it("calcule la classe de note modulo 12", () => {
    assert(
      property(integer({ min: MIDI_MIN, max: MIDI_MAX }), (midi) => {
        expect(noteClass(midi)).toBe(((midi % 12) + 12) % 12);
        expect(noteName(midi).startsWith(["Do", "Do#", "Ré", "Ré#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"][noteClass(midi)])).toBe(true);
      }),
    );
  });

  it("construit les degrés des gammes majeure et mineure", () => {
    expect([...scaleDegrees(0, "majeure")].sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect([...scaleDegrees(9, "mineure")].sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect([...scaleDegrees(0, "mineure")].sort((a, b) => a - b)).toEqual([0, 2, 3, 5, 7, 8, 10]);
    expect(inScale(60, scaleDegrees(0, "majeure"))).toBe(true);
    expect(inScale(61, scaleDegrees(0, "majeure"))).toBe(false);
    expect(inScale(57, scaleDegrees(9, "mineure"))).toBe(true);
  });
});
