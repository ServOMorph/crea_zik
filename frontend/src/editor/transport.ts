import { EditableComposition } from "./editorStore";

export type BeatRange = { startBeat: number; endBeat: number };

export type TransportStatus = "stopped" | "playing" | "paused";

export type TransportMode = "song" | "pattern";

export type TransportState = {
  status: TransportStatus;
  positionBeat: number;
  mode: TransportMode;
  loop: { enabled: boolean; range: BeatRange };
  selection: BeatRange;
  monitoringGain: number;
  muted: boolean;
  clipping: boolean;
};

type RenderSettings = { duration_seconds?: unknown };

function finite(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function compositionDurationBeats(composition: EditableComposition) {
  const settings = composition.render_settings as RenderSettings | undefined;
  const durationSeconds = finite(settings?.duration_seconds, 0);
  if (durationSeconds > 0) return durationSeconds * (composition.tempo_bpm / 60);
  return Math.max(1, ...composition.clips.map((clip) => clip.start_beat + clip.length_beats));
}

export function normaliseRange(range: BeatRange, durationBeats: number): BeatRange {
  const startBeat = Math.max(0, Math.min(range.startBeat, durationBeats));
  const endBeat = Math.max(startBeat + 0.25, Math.min(range.endBeat, durationBeats));
  return endBeat > startBeat ? { startBeat, endBeat } : { startBeat: 0, endBeat: Math.min(0.25, durationBeats) };
}

export function createTransportState(composition: EditableComposition): TransportState {
  const durationBeats = compositionDurationBeats(composition);
  const selection = normaliseRange({ startBeat: 0, endBeat: Math.min(16, durationBeats) }, durationBeats);
  return {
    status: "stopped",
    positionBeat: 0,
    mode: "song",
    loop: { enabled: false, range: selection },
    selection,
    monitoringGain: 1,
    muted: false,
    clipping: false,
  };
}

export function seek(state: TransportState, positionBeat: number, durationBeats: number): TransportState {
  return { ...state, positionBeat: Math.max(0, Math.min(positionBeat, durationBeats)) };
}

export function advance(
  state: TransportState,
  elapsedSeconds: number,
  tempoBpm: number,
  durationBeats: number,
): TransportState {
  if (state.status !== "playing") return state;
  let positionBeat = state.positionBeat + elapsedSeconds * (tempoBpm / 60);
  if (state.loop.enabled) {
    const loop = normaliseRange(state.loop.range, durationBeats);
    if (positionBeat >= loop.endBeat)
      positionBeat = loop.startBeat + ((positionBeat - loop.startBeat) % (loop.endBeat - loop.startBeat));
  }
  if (positionBeat >= durationBeats) return { ...state, positionBeat: durationBeats, status: "stopped" };
  return { ...state, positionBeat };
}

export function formatMusicalPosition(positionBeat: number, timeSignature: [number, number]) {
  const beatsPerBar = timeSignature[0] || 4;
  const bar = Math.floor(positionBeat / beatsPerBar) + 1;
  const beat = Math.floor(positionBeat % beatsPerBar) + 1;
  return `${bar}.${beat}`;
}

function stableValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableValue(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function previewKey(composition: EditableComposition, range: BeatRange) {
  let hash = 2166136261;
  const source = `${stableValue(composition)}:${range.startBeat}:${range.endBeat}`;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `preview-${(hash >>> 0).toString(16)}`;
}

export function rangesIntersect(first: BeatRange, second: BeatRange) {
  return first.startBeat < second.endBeat && second.startBeat < first.endBeat;
}

export class PreviewCache<T> {
  private readonly entries = new Map<string, { range: BeatRange; value: T }>();

  get(key: string) {
    return this.entries.get(key)?.value;
  }

  set(key: string, range: BeatRange, value: T) {
    this.entries.set(key, { range, value });
  }

  invalidate(range?: BeatRange) {
    if (!range) {
      this.entries.clear();
      return;
    }
    for (const [key, entry] of this.entries) if (rangesIntersect(entry.range, range)) this.entries.delete(key);
  }
}

export type MeterStats = { peak: number; rms: number; clipping: boolean };

export function peakOf(channels: Float32Array[]): number {
  let peak = 0;
  for (const channel of channels) {
    for (let index = 0; index < channel.length; index += 1) {
      const value = Math.abs(channel[index]);
      if (value > peak) peak = value;
    }
  }
  return peak;
}

export function rmsOf(channels: Float32Array[]): number {
  let sumSquares = 0;
  let count = 0;
  for (const channel of channels) {
    for (let index = 0; index < channel.length; index += 1) {
      sumSquares += channel[index] * channel[index];
      count += 1;
    }
  }
  return count > 0 ? Math.sqrt(sumSquares / count) : 0;
}

export function meterStatsFromBuffer(buffer: AudioBuffer): MeterStats {
  const channels: Float32Array[] = [];
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    channels.push(buffer.getChannelData(channel));
  }
  const peak = peakOf(channels);
  return { peak, rms: rmsOf(channels), clipping: peak >= 0.999 };
}

export class PreviewRequestGate {
  private activeRequest = 0;

  begin() {
    this.activeRequest += 1;
    return this.activeRequest;
  }

  cancel() {
    this.activeRequest += 1;
  }

  isCurrent(request: number) {
    return request === this.activeRequest;
  }
}
