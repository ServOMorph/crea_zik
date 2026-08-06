import { useCallback, useRef, useState } from "react";

import { apiRequest } from "../api/client";
import type { ChannelSelector, EditableComposition, EditorState, MixerChannel, ParameterBounds } from "./editorStore";
import { busChannels, channelForTrack } from "./editorStore";
import { effectParameterBounds, effectParametersOf, type EffectRegistryPayload } from "./effectRegistry";
import { meterStatsFromBuffer, rmsOf, type MeterStats } from "./transport";

type AbSample = { buffer: AudioBuffer; rms: number };

type JobResponse = {
  id: string;
  state: "queued" | "running" | "completed" | "failed" | "cancelled";
  error?: string | null;
  wav?: string | null;
};

export type MixerProps = {
  editor: EditorState;
  registry: EffectRegistryPayload | null;
  projectId: string;
  compositionId: string;
  ensureSaved: () => Promise<EditableComposition | null>;
  onSetFlag: (selector: ChannelSelector, flag: "mute" | "solo", value: boolean) => void;
  onSetField: (selector: ChannelSelector, field: "gain" | "pan", value: number) => void;
  onSetOutput: (selector: Exclude<ChannelSelector, { kind: "master" }>, output: string) => void;
  onSetSend: (selector: Exclude<ChannelSelector, { kind: "master" }>, targetId: string, amount: number) => void;
  onAddBus: (name: string) => void;
  onRemoveBus: (channelId: string) => void;
  onAddEffect: (selector: ChannelSelector, kind: string) => void;
  onRemoveEffect: (selector: ChannelSelector, effectId: string) => void;
  onMoveEffect: (selector: ChannelSelector, effectId: string, direction: "up" | "down") => void;
  onSetEffectBypass: (selector: ChannelSelector, effectId: string, value: boolean) => void;
  onSetEffectParameter: (
    selector: ChannelSelector,
    effectId: string,
    key: string,
    value: number,
    bounds?: ParameterBounds,
  ) => void;
  onSetStemFaderMode: (mode: "pre" | "post") => void;
};

function sleep(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

const EMPTY_CHANNEL: Pick<MixerChannel, "gain" | "pan" | "mute" | "solo" | "output" | "sends" | "effects"> = {
  gain: 1,
  pan: 0,
  mute: false,
  solo: false,
  output: "master",
  sends: {},
  effects: [],
};

function EffectChain({
  selector,
  effects,
  registry,
  onAdd,
  onRemove,
  onMove,
  onBypass,
  onParameter,
}: {
  selector: ChannelSelector;
  effects: MixerChannel["effects"];
  registry: EffectRegistryPayload | null;
  onAdd: (selector: ChannelSelector, kind: string) => void;
  onRemove: (selector: ChannelSelector, effectId: string) => void;
  onMove: (selector: ChannelSelector, effectId: string, direction: "up" | "down") => void;
  onBypass: (selector: ChannelSelector, effectId: string, value: boolean) => void;
  onParameter: (selector: ChannelSelector, effectId: string, key: string, value: number, bounds?: ParameterBounds) => void;
}) {
  const kinds = registry ? Object.keys(registry) : ["eq", "saturation", "compressor", "delay"];
  return (
    <div className="mixer__effects">
      <ul className="mixer__effect-list">
        {effects.map((effect, index) => (
          <li key={effect.id} className="mixer__effect">
            <div className="mixer__effect-header">
              <span>{effect.kind}</span>
              <button type="button" disabled={index === 0} onClick={() => onMove(selector, effect.id, "up")}>
                ↑
              </button>
              <button
                type="button"
                disabled={index === effects.length - 1}
                onClick={() => onMove(selector, effect.id, "down")}
              >
                ↓
              </button>
              <label>
                <input
                  type="checkbox"
                  checked={effect.bypass}
                  onChange={(event) => onBypass(selector, effect.id, event.target.checked)}
                />
                Bypass
              </label>
              <button type="button" onClick={() => onRemove(selector, effect.id)}>
                Supprimer
              </button>
            </div>
            {registry &&
              effectParametersOf(registry, effect.kind).map((parameter) => (
                <label key={parameter.path} className="mixer__effect-parameter">
                  {parameter.label}
                  <input
                    type="number"
                    step={parameter.step}
                    value={effect.parameters[parameter.path] ?? parameter.default}
                    onChange={(event) =>
                      onParameter(
                        selector,
                        effect.id,
                        parameter.path,
                        Number(event.target.value),
                        effectParameterBounds(parameter),
                      )
                    }
                  />
                </label>
              ))}
          </li>
        ))}
      </ul>
      <select
        aria-label="Ajouter un effet"
        value=""
        onChange={(event) => {
          if (event.target.value) onAdd(selector, event.target.value);
          event.target.value = "";
        }}
      >
        <option value="" disabled>
          Ajouter un effet…
        </option>
        {kinds.map((kind) => (
          <option key={kind} value={kind}>
            {kind}
          </option>
        ))}
      </select>
    </div>
  );
}

function Meter({ stats }: { stats: MeterStats | undefined }) {
  if (!stats) return <div className="mixer__meter mixer__meter--empty">non mesuré</div>;
  const peakPercent = Math.min(100, stats.peak * 100);
  return (
    <div className="mixer__meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={peakPercent}>
      <div className={`mixer__meter-bar${stats.clipping ? " is-clipping" : ""}`} style={{ width: `${peakPercent}%` }} />
      <span className="mixer__meter-value">
        pic {stats.peak.toFixed(2)} · RMS {stats.rms.toFixed(2)}
        {stats.clipping ? " · écrêtage" : ""}
      </span>
    </div>
  );
}

export function Mixer({
  editor,
  registry,
  projectId,
  compositionId,
  ensureSaved,
  onSetFlag,
  onSetField,
  onSetOutput,
  onSetSend,
  onAddBus,
  onRemoveBus,
  onAddEffect,
  onRemoveEffect,
  onMoveEffect,
  onSetEffectBypass,
  onSetEffectParameter,
  onSetStemFaderMode,
}: MixerProps) {
  const composition = editor.composition;
  const buses = busChannels(composition);
  const master: MixerChannel = composition.master_channel ?? { id: "", track_id: null, ...EMPTY_CHANNEL };
  const [busName, setBusName] = useState("");
  const [meters, setMeters] = useState<Record<string, MeterStats>>({});
  const [measuring, setMeasuring] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<{ mixer_channels: MixerChannel[]; master_channel: MixerChannel } | null>(
    null,
  );
  const [abSamples, setAbSamples] = useState<{ a: AbSample | null; b: AbSample | null }>({ a: null, b: null });
  const [abPlaying, setAbPlaying] = useState<"a" | "b" | null>(null);
  const contextRef = useRef<AudioContext | null>(null);

  const measureTrack = useCallback(
    async (trackId: string) => {
      setMeasuring(trackId);
      try {
        const saved = await ensureSaved();
        if (!saved) return;
        let job = await apiRequest<JobResponse>(`/api/projects/${projectId}/compositions/${compositionId}/render`, {
          method: "POST",
          body: JSON.stringify({ track_ids: [trackId] }),
        });
        while (job.state === "queued" || job.state === "running") {
          await sleep(150);
          job = await apiRequest<JobResponse>(`/api/jobs/${job.id}`);
        }
        if (job.state !== "completed" || !job.wav) return;
        const response = await fetch(`/projects/${job.wav}`);
        if (!response.ok) return;
        const context = contextRef.current || new AudioContext();
        contextRef.current = context;
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        setMeters((current) => ({ ...current, [trackId]: meterStatsFromBuffer(buffer) }));
      } finally {
        setMeasuring(null);
      }
    },
    [compositionId, ensureSaved, projectId],
  );

  const renderMixerPreview = useCallback(
    async (overrides?: { mixer_channels: MixerChannel[]; master_channel: MixerChannel }): Promise<AbSample | null> => {
      const saved = await ensureSaved();
      if (!saved) return null;
      const response = await apiRequest<{ wav: string }>(
        `/api/projects/${projectId}/compositions/${compositionId}/mixer-preview`,
        { method: "POST", body: JSON.stringify(overrides ?? {}) },
      );
      const audioResponse = await fetch(`/projects/${response.wav}`);
      if (!audioResponse.ok) return null;
      const context = contextRef.current || new AudioContext();
      contextRef.current = context;
      const buffer = await context.decodeAudioData(await audioResponse.arrayBuffer());
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
      return { buffer, rms: rmsOf(channels) };
    },
    [compositionId, ensureSaved, projectId],
  );

  const playAB = useCallback(
    async (which: "a" | "b") => {
      setAbPlaying(which);
      try {
        let sample = abSamples[which];
        if (!sample) {
          sample = await renderMixerPreview(which === "a" && baseline ? baseline : undefined);
          if (!sample) return;
          setAbSamples((current) => ({ ...current, [which]: sample }));
        }
        const other = which === "a" ? abSamples.b : abSamples.a;
        const context = contextRef.current;
        if (!context) return;
        const source = context.createBufferSource();
        source.buffer = sample.buffer;
        const gain = context.createGain();
        gain.gain.value = other && sample.rms > 0 ? Math.min(4, other.rms / sample.rms) : 1;
        source.connect(gain).connect(context.destination);
        await context.resume();
        source.start();
      } finally {
        setAbPlaying(null);
      }
    },
    [abSamples, baseline, renderMixerPreview],
  );

  const outputOptions = [{ id: "master", label: "Master" }, ...buses.map((bus) => ({ id: bus.id, label: bus.name ?? "Bus" }))];

  return (
    <section className="mixer" aria-labelledby="mixer-heading">
      <div className="mixer__header">
        <h2 id="mixer-heading">Mixer</h2>
        <div className="mixer__toolbar">
          <label>
            Nouveau bus
            <input
              aria-label="Nom du nouveau bus"
              value={busName}
              onChange={(event) => setBusName(event.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={!busName.trim()}
            onClick={() => {
              onAddBus(busName);
              setBusName("");
            }}
          >
            Ajouter un bus
          </button>
          <label>
            Export des stems
            <select
              aria-label="Mode d’export des stems"
              value={(composition.render_settings?.stem_fader as string | undefined) ?? "post"}
              onChange={(event) => onSetStemFaderMode(event.target.value as "pre" | "post")}
            >
              <option value="post">Post-fader</option>
              <option value="pre">Pré-fader</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setBaseline({
                mixer_channels: structuredClone(composition.mixer_channels ?? []),
                master_channel: structuredClone(master),
              });
              setAbSamples({ a: null, b: null });
            }}
          >
            Capturer l’état actuel comme référence A
          </button>
          <button type="button" disabled={!baseline || abPlaying !== null} onClick={() => playAB("a")}>
            {abPlaying === "a" ? "Lecture…" : "Écouter A (référence)"}
          </button>
          <button type="button" disabled={abPlaying !== null} onClick={() => playAB("b")}>
            {abPlaying === "b" ? "Lecture…" : "Écouter B (actuel)"}
          </button>
        </div>
      </div>
      {baseline && (
        <p className="mixer__compare" role="status">
          Référence A capturée : « Écouter A » rejoue ce mix, « Écouter B » le mix actuel, à sonie perçue égalisée.
        </p>
      )}
      <div className="mixer__strips">
        {composition.tracks.map((track) => {
          const channel = channelForTrack(composition, track.id) ?? { ...EMPTY_CHANNEL, id: "", track_id: track.id };
          const selector: ChannelSelector = { kind: "track", trackId: track.id };
          return (
            <div className="mixer__strip" key={track.id}>
              <h3>{track.name}</h3>
              <label>
                Gain
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.01}
                  value={channel.gain}
                  onChange={(event) => onSetField(selector, "gain", Number(event.target.value))}
                  aria-label={`Gain de ${track.name}`}
                />
                <span>{channel.gain.toFixed(2)}</span>
              </label>
              <label>
                Pan
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.01}
                  value={channel.pan}
                  onChange={(event) => onSetField(selector, "pan", Number(event.target.value))}
                  aria-label={`Pan de ${track.name}`}
                />
                <span>{channel.pan.toFixed(2)}</span>
              </label>
              <div className="mixer__flags">
                <button
                  type="button"
                  className="mixer__flag"
                  aria-pressed={channel.mute}
                  onClick={() => onSetFlag(selector, "mute", !channel.mute)}
                >
                  {channel.mute ? "Muet" : "Son activé"}
                </button>
                <button
                  type="button"
                  className="mixer__flag"
                  aria-pressed={channel.solo}
                  onClick={() => onSetFlag(selector, "solo", !channel.solo)}
                >
                  {channel.solo ? "Solo actif" : "Solo"}
                </button>
              </div>
              <label>
                Sortie
                <select
                  aria-label={`Sortie de ${track.name}`}
                  value={channel.output}
                  onChange={(event) => onSetOutput(selector, event.target.value)}
                >
                  {outputOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {buses.length > 0 && (
                <div className="mixer__sends">
                  {buses.map((bus) => (
                    <label key={bus.id}>
                      Send {bus.name ?? "Bus"}
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={channel.sends[bus.id] ?? 0}
                        onChange={(event) => onSetSend(selector, bus.id, Number(event.target.value))}
                        aria-label={`Send de ${track.name} vers ${bus.name ?? "Bus"}`}
                      />
                    </label>
                  ))}
                </div>
              )}
              <EffectChain
                selector={selector}
                effects={channel.effects}
                registry={registry}
                onAdd={onAddEffect}
                onRemove={onRemoveEffect}
                onMove={onMoveEffect}
                onBypass={onSetEffectBypass}
                onParameter={onSetEffectParameter}
              />
              <Meter stats={meters[track.id]} />
              <button type="button" disabled={measuring === track.id} onClick={() => measureTrack(track.id)}>
                {measuring === track.id ? "Mesure…" : "Mesurer le niveau"}
              </button>
            </div>
          );
        })}
        {buses.map((bus) => {
          const selector: ChannelSelector = { kind: "bus", channelId: bus.id };
          const otherBuses = buses.filter((item) => item.id !== bus.id);
          const outputChoices = [
            { id: "master", label: "Master" },
            ...otherBuses.map((item) => ({ id: item.id, label: item.name ?? "Bus" })),
          ];
          return (
            <div className="mixer__strip mixer__strip--bus" key={bus.id}>
              <h3>{bus.name ?? "Bus"}</h3>
              <label>
                Gain
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.01}
                  value={bus.gain}
                  onChange={(event) => onSetField(selector, "gain", Number(event.target.value))}
                  aria-label={`Gain de ${bus.name ?? "Bus"}`}
                />
                <span>{bus.gain.toFixed(2)}</span>
              </label>
              <label>
                Pan
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.01}
                  value={bus.pan}
                  onChange={(event) => onSetField(selector, "pan", Number(event.target.value))}
                  aria-label={`Pan de ${bus.name ?? "Bus"}`}
                />
                <span>{bus.pan.toFixed(2)}</span>
              </label>
              <label>
                Sortie
                <select
                  aria-label={`Sortie de ${bus.name ?? "Bus"}`}
                  value={bus.output}
                  onChange={(event) => onSetOutput(selector, event.target.value)}
                >
                  {outputChoices.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <EffectChain
                selector={selector}
                effects={bus.effects}
                registry={registry}
                onAdd={onAddEffect}
                onRemove={onRemoveEffect}
                onMove={onMoveEffect}
                onBypass={onSetEffectBypass}
                onParameter={onSetEffectParameter}
              />
              <button type="button" onClick={() => onRemoveBus(bus.id)}>
                Supprimer ce bus
              </button>
            </div>
          );
        })}
        <div className="mixer__strip mixer__strip--master">
          <h3>Master</h3>
          <label>
            Gain
            <input
              type="range"
              min={0}
              max={2}
              step={0.01}
              value={master.gain}
              onChange={(event) => onSetField({ kind: "master" }, "gain", Number(event.target.value))}
              aria-label="Gain du master"
            />
            <span>{master.gain.toFixed(2)}</span>
          </label>
          <EffectChain
            selector={{ kind: "master" }}
            effects={master.effects}
            registry={registry}
            onAdd={onAddEffect}
            onRemove={onRemoveEffect}
            onMove={onMoveEffect}
            onBypass={onSetEffectBypass}
            onParameter={onSetEffectParameter}
          />
        </div>
      </div>
      <p className="mixer__hint">
        {buses.length > 0
          ? "Chaque piste ou bus peut router sa sortie vers un autre bus ou vers Master."
          : "Aucun bus créé : toutes les pistes sortent directement vers Master."}
      </p>
    </section>
  );
}
