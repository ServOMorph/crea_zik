import { describe, expect, it } from "vitest";

import {
  advance,
  compositionDurationBeats,
  createTransportState,
  formatMusicalPosition,
  PreviewCache,
  PreviewRequestGate,
  previewKey,
  seek,
} from "./transport";

const composition = {
  id: "composition-1",
  revision: 1,
  title: "Test",
  tempo_bpm: 120,
  time_signature: [4, 4] as [number, number],
  render_settings: { duration_seconds: 30 },
  tracks: [],
  patterns: [],
  clips: [{ id: "clip-1", pattern_id: "pattern-1", start_beat: 0, length_beats: 16 }],
};

describe("transport", () => {
  it("borne la tête de lecture et arrête la lecture à la fin", () => {
    const duration = compositionDurationBeats(composition);
    const playing = { ...createTransportState(composition), status: "playing" as const, positionBeat: 59 };

    expect(seek(playing, 99, duration).positionBeat).toBe(60);
    expect(advance(playing, 1, composition.tempo_bpm, duration)).toMatchObject({
      positionBeat: 60,
      status: "stopped",
    });
  });

  it("avance la position exactement selon l’horloge simulée en lecture", () => {
    const state = { ...createTransportState(composition), status: "playing" as const, positionBeat: 4 };

    expect(advance(state, 0.5, 120, 60).positionBeat).toBeCloseTo(5);
    expect(advance(state, 0.25, 120, 60).positionBeat).toBeCloseTo(4.5);
  });

  it("ne bouge pas la position en pause ou à l’arrêt", () => {
    const duration = compositionDurationBeats(composition);
    const paused = { ...createTransportState(composition), status: "paused" as const, positionBeat: 8 };
    const stopped = { ...createTransportState(composition), status: "stopped" as const, positionBeat: 2 };

    expect(advance(paused, 1, composition.tempo_bpm, duration).positionBeat).toBe(8);
    expect(advance(stopped, 1, composition.tempo_bpm, duration).positionBeat).toBe(2);
  });

  it("maintient la position bouclée sur plusieurs tours de boucle", () => {
    const state = {
      ...createTransportState(composition),
      status: "playing" as const,
      positionBeat: 7,
      loop: { enabled: true, range: { startBeat: 4, endBeat: 8 } },
    };
    let current = advance(state, 3, composition.tempo_bpm, 60);

    expect(current.positionBeat).toBeCloseTo(5);
    current = advance(current, 3.5, composition.tempo_bpm, 60);
    expect(current.positionBeat).toBeCloseTo(4);
  });

  it("reboucle la tête de lecture dans la plage définie", () => {
    const state = {
      ...createTransportState(composition),
      status: "playing" as const,
      positionBeat: 7,
      loop: { enabled: true, range: { startBeat: 4, endBeat: 8 } },
    };

    expect(advance(state, 1, composition.tempo_bpm, 60).positionBeat).toBe(5);
  });

  it("formate une position en mesures et temps", () => {
    expect(formatMusicalPosition(5.2, [4, 4])).toBe("2.2");
  });

  it("produit une clé différente pour une plage ou une composition modifiée", () => {
    const range = { startBeat: 0, endBeat: 8 };
    expect(previewKey(composition, range)).not.toBe(previewKey(composition, { startBeat: 8, endBeat: 16 }));
    expect(previewKey(composition, range)).not.toBe(previewKey({ ...composition, tempo_bpm: 121 }, range));
  });

  it("invalide uniquement les aperçus qui recouvrent une modification", () => {
    const cache = new PreviewCache<string>();
    cache.set("intro", { startBeat: 0, endBeat: 8 }, "intro.wav");
    cache.set("suite", { startBeat: 8, endBeat: 16 }, "suite.wav");

    cache.invalidate({ startBeat: 4, endBeat: 6 });

    expect(cache.get("intro")).toBeUndefined();
    expect(cache.get("suite")).toBe("suite.wav");
  });

  it("empêche une requête annulée de remplacer la préécoute la plus récente", () => {
    const gate = new PreviewRequestGate();
    const first = gate.begin();
    const second = gate.begin();

    expect(gate.isCurrent(first)).toBe(false);
    expect(gate.isCurrent(second)).toBe(true);
    gate.cancel();
    expect(gate.isCurrent(second)).toBe(false);
  });
});
