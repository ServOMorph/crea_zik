import { useCallback, useEffect, useRef, useState } from "react";

import { apiRequest } from "../api/client";
import { EditableComposition } from "./editorStore";
import {
  BeatRange,
  compositionDurationBeats,
  createTransportState,
  formatMusicalPosition,
  normaliseRange,
  PreviewCache,
  PreviewRequestGate,
  previewKey,
  TransportState,
} from "./transport";

type JobResponse = {
  id: string;
  state: "queued" | "running" | "completed" | "failed" | "cancelled";
  error?: string | null;
  wav?: string | null;
};

type Playback = { source: AudioBufferSourceNode; range: BeatRange; startedAt: number; startBeat: number };

type TransportBarProps = {
  composition: EditableComposition;
  projectId: string;
  compositionId: string;
  ensureSaved: () => Promise<EditableComposition | null>;
};

function sleep(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function clipDetected(buffer: AudioBuffer) {
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const samples = buffer.getChannelData(channel);
    for (let index = 0; index < samples.length; index += 1) if (Math.abs(samples[index]) >= 0.999) return true;
  }
  return false;
}

export function TransportBar({ composition, projectId, compositionId, ensureSaved }: TransportBarProps) {
  const durationBeats = compositionDurationBeats(composition);
  const [transport, setTransport] = useState<TransportState>(() => createTransportState(composition));
  const [message, setMessage] = useState("Prêt à préécouter.");
  const cacheRef = useRef(new PreviewCache<string>());
  const requestGateRef = useRef(new PreviewRequestGate());
  const jobIdRef = useRef<string | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const playbackRef = useRef<Playback | null>(null);
  const previousCompositionKey = useRef(previewKey(composition, { startBeat: 0, endBeat: durationBeats }));

  const cancelPreview = useCallback(() => {
    requestGateRef.current.cancel();
    const jobId = jobIdRef.current;
    jobIdRef.current = null;
    if (jobId) void apiRequest(`/api/jobs/${jobId}/cancel`, { method: "POST" }).catch(() => undefined);
  }, []);

  const stopPlayback = useCallback((reset = false) => {
    cancelPreview();
    const playback = playbackRef.current;
    playbackRef.current = null;
    if (playback) {
      playback.source.onended = null;
      playback.source.stop();
    }
    setTransport((current) => ({ ...current, status: "stopped", positionBeat: reset ? 0 : current.positionBeat }));
  }, [cancelPreview]);

  useEffect(() => {
    return () => {
      cancelPreview();
      stopPlayback();
      void contextRef.current?.close();
    };
  }, [cancelPreview, stopPlayback]);

  useEffect(() => {
    const compositionKey = previewKey(composition, { startBeat: 0, endBeat: durationBeats });
    if (previousCompositionKey.current === compositionKey) return;
    previousCompositionKey.current = compositionKey;
    cacheRef.current.invalidate();
    if (playbackRef.current) {
      stopPlayback();
      setMessage("Préécoute interrompue : la composition a été modifiée.");
    }
  }, [composition, durationBeats, stopPlayback]);

  useEffect(() => {
    const frame = () => {
      const playback = playbackRef.current;
      const context = contextRef.current;
      if (playback && context) {
        const beatsPerSecond = composition.tempo_bpm / 60;
        let positionBeat = playback.startBeat + (context.currentTime - playback.startedAt) * beatsPerSecond;
        if (transport.loop.enabled && positionBeat >= transport.loop.range.endBeat) {
          const loopLength = transport.loop.range.endBeat - transport.loop.range.startBeat;
          positionBeat =
            transport.loop.range.startBeat + ((positionBeat - transport.loop.range.startBeat) % loopLength);
        }
        setTransport((current) => ({ ...current, status: "playing", positionBeat }));
      }
      const frameId = window.requestAnimationFrame(frame);
      animationFrameRef.current = frameId;
    };
    const animationFrameRef = { current: window.requestAnimationFrame(frame) };
    return () => window.cancelAnimationFrame(animationFrameRef.current);
  }, [composition.tempo_bpm, transport.loop.enabled, transport.loop.range.endBeat, transport.loop.range.startBeat]);

  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = transport.muted ? 0 : transport.monitoringGain;
  }, [transport.monitoringGain, transport.muted]);

  const requestPreview = useCallback(
    async (range: BeatRange) => {
      cancelPreview();
      const currentRequest = requestGateRef.current.begin();
      setMessage("Rendu de la préécoute…");
      const savedComposition = await ensureSaved();
      if (!savedComposition || !requestGateRef.current.isCurrent(currentRequest)) return null;
      const key = previewKey(savedComposition, range);
      const cached = cacheRef.current.get(key);
      if (cached) {
        setMessage("Préécoute chargée depuis le cache.");
        return cached;
      }
      try {
        let job = await apiRequest<JobResponse>(`/api/projects/${projectId}/compositions/${compositionId}/render`, {
          method: "POST",
          body: JSON.stringify({ start_beat: range.startBeat, end_beat: range.endBeat }),
        });
        jobIdRef.current = job.id;
        while (job.state === "queued" || job.state === "running") {
          await sleep(150);
          if (!requestGateRef.current.isCurrent(currentRequest)) return null;
          job = await apiRequest<JobResponse>(`/api/jobs/${job.id}`);
        }
        jobIdRef.current = null;
        if (!requestGateRef.current.isCurrent(currentRequest)) return null;
        if (job.state !== "completed" || !job.wav) throw new Error(job.error || "Rendu de préécoute indisponible.");
        const wav = `/projects/${job.wav}`;
        cacheRef.current.set(key, range, wav);
        setMessage("Préécoute prête.");
        return wav;
      } catch (error) {
        if (requestGateRef.current.isCurrent(currentRequest))
          setMessage(error instanceof Error ? error.message : "Préécoute impossible.");
        return null;
      }
    },
    [cancelPreview, compositionId, ensureSaved, projectId],
  );

  const playRange = useCallback(
    async (requestedRange: BeatRange) => {
      const range = normaliseRange(requestedRange, durationBeats);
      stopPlayback();
      const wav = await requestPreview(range);
      if (!wav) return;
      try {
        const response = await fetch(wav);
        if (!response.ok) throw new Error("Fichier de préécoute inaccessible.");
        const context = contextRef.current || new AudioContext();
        contextRef.current = context;
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        const source = context.createBufferSource();
        const gain = gainRef.current || context.createGain();
        gainRef.current = gain;
        gain.gain.value = transport.muted ? 0 : transport.monitoringGain;
        source.buffer = buffer;
        source.connect(gain).connect(context.destination);
        const startBeat = Math.max(range.startBeat, transport.positionBeat);
        const offset = (startBeat - range.startBeat) * (60 / composition.tempo_bpm);
        if (
          transport.loop.enabled &&
          transport.loop.range.startBeat >= range.startBeat &&
          transport.loop.range.endBeat <= range.endBeat
        ) {
          source.loop = true;
          source.loopStart = (transport.loop.range.startBeat - range.startBeat) * (60 / composition.tempo_bpm);
          source.loopEnd = (transport.loop.range.endBeat - range.startBeat) * (60 / composition.tempo_bpm);
        }
        await context.resume();
        const playback: Playback = { source, range, startedAt: context.currentTime, startBeat };
        playbackRef.current = playback;
        source.onended = () => {
          if (playbackRef.current !== playback) return;
          playbackRef.current = null;
          setTransport((current) => ({ ...current, status: "stopped", positionBeat: range.endBeat }));
        };
        source.start(0, offset);
        setTransport((current) => ({
          ...current,
          status: "playing",
          positionBeat: startBeat,
          clipping: clipDetected(buffer),
        }));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Lecture impossible.");
      }
    },
    [
      composition.tempo_bpm,
      durationBeats,
      requestPreview,
      stopPlayback,
      transport.loop,
      transport.monitoringGain,
      transport.muted,
      transport.positionBeat,
    ],
  );

  const pause = () => {
    stopPlayback();
    setTransport((current) => ({ ...current, status: "paused" }));
  };

  const seekTo = (positionBeat: number) => {
    const bounded = Math.max(0, Math.min(positionBeat, durationBeats));
    const wasPlaying = playbackRef.current !== null;
    stopPlayback();
    setTransport((current) => ({ ...current, positionBeat: bounded, status: "paused" }));
    if (wasPlaying) void playRange({ startBeat: 0, endBeat: durationBeats });
  };

  const selectedPatternRange = composition.clips.find(
    (clip) => clip.start_beat <= transport.positionBeat && clip.start_beat + clip.length_beats > transport.positionBeat,
  );
  const defaultRange =
    transport.mode === "pattern" && selectedPatternRange
      ? {
          startBeat: selectedPatternRange.start_beat,
          endBeat: selectedPatternRange.start_beat + selectedPatternRange.length_beats,
        }
      : { startBeat: 0, endBeat: durationBeats };

  return (
    <section className="editor-transport" aria-label="Transport de la composition">
      <div className="editor-transport__controls">
        <button type="button" onClick={() => void playRange(defaultRange)}>
          {transport.status === "playing" ? "Relancer" : "Lire"}
        </button>
        <button type="button" disabled={transport.status !== "playing"} onClick={pause}>
          Pause
        </button>
        <button type="button" onClick={() => stopPlayback(true)}>
          Stop
        </button>
        <button type="button" onClick={() => seekTo(0)}>
          Retour au début
        </button>
        <output aria-live="polite">{formatMusicalPosition(transport.positionBeat, composition.time_signature)}</output>
        <span>{Math.round(transport.positionBeat * (60 / composition.tempo_bpm) * 10) / 10}s</span>
      </div>
      <label className="editor-transport__position">
        Position
        <input
          aria-label="Position de lecture"
          type="range"
          min="0"
          max={durationBeats}
          step="0.25"
          value={transport.positionBeat}
          onChange={(event) => seekTo(Number(event.target.value))}
        />
      </label>
      <div className="editor-transport__settings">
        <label>
          Mode
          <select
            value={transport.mode}
            onChange={(event) =>
              setTransport((current) => ({ ...current, mode: event.target.value as TransportState["mode"] }))
            }
          >
            <option value="song">Morceau</option>
            <option value="pattern">Pattern actif</option>
          </select>
        </label>
        <label>
          Début sélection
          <input
            aria-label="Début de sélection"
            type="number"
            min="0"
            max={durationBeats}
            step="0.25"
            value={transport.selection.startBeat}
            onChange={(event) =>
              setTransport((current) => ({
                ...current,
                selection: normaliseRange(
                  { ...current.selection, startBeat: Number(event.target.value) },
                  durationBeats,
                ),
              }))
            }
          />
        </label>
        <label>
          Fin sélection
          <input
            aria-label="Fin de sélection"
            type="number"
            min="0.25"
            max={durationBeats}
            step="0.25"
            value={transport.selection.endBeat}
            onChange={(event) =>
              setTransport((current) => ({
                ...current,
                selection: normaliseRange({ ...current.selection, endBeat: Number(event.target.value) }, durationBeats),
              }))
            }
          />
        </label>
        <button type="button" onClick={() => void playRange(transport.selection)}>
          Lire la sélection
        </button>
        <label className="editor-transport__loop">
          <input
            type="checkbox"
            checked={transport.loop.enabled}
            onChange={(event) =>
              setTransport((current) => ({
                ...current,
                loop: { enabled: event.target.checked, range: current.selection },
              }))
            }
          />
          Boucle sélection
        </label>
        <label>
          Volume monitoring
          <input
            aria-label="Volume monitoring"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={transport.monitoringGain}
            onChange={(event) =>
              setTransport((current) => ({ ...current, monitoringGain: Number(event.target.value) }))
            }
          />
        </label>
        <button
          type="button"
          aria-pressed={transport.muted}
          onClick={() => setTransport((current) => ({ ...current, muted: !current.muted }))}
        >
          {transport.muted ? "Son activé" : "Muet"}
        </button>
        {transport.clipping && (
          <span className="editor-transport__clip" role="status">
            Écrêtage détecté
          </span>
        )}
      </div>
      <p className="editor-transport__message" role="status">
        {message}
      </p>
    </section>
  );
}
