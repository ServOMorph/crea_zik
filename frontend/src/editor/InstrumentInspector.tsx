import { useState } from "react";
import {
  instrumentParameters,
  parameterValue,
  type InstrumentParameters,
  type ParameterBounds,
  type Track,
} from "./editorStore";
import {
  currentScalar,
  finiteNumber,
  itemPath,
  itemTemplate,
  listItems,
  scalarBounds,
  type InstrumentKindRegistry,
  type ListParameter,
} from "./instrumentRegistry";

type ControlParameter = {
  path: string;
  label: string;
  default: number;
  minimum: number | null;
  maximum: number | null;
  step: number;
  unit: string;
};

export type InstrumentInspectorProps = {
  track: Track;
  registry: InstrumentKindRegistry | null;
  projectId: string;
  compositionId: string;
  onSetParameter: (path: string, value: number, bounds: ParameterBounds, groupWithPrevious?: boolean) => void;
  onResetAll: () => void;
  onSetListLength: (path: string, count: number, itemTemplate: () => unknown) => void;
  onRestoreParameters: (parameters: InstrumentParameters) => void;
  onPreviewPattern: (() => void) | null;
  onPreviewTrack: () => void;
};

let audioContext: AudioContext | null = null;

async function playPreviewWav(wavPath: string) {
  const response = await fetch(wavPath);
  if (!response.ok) throw new Error(`Préécoute indisponible (HTTP ${response.status})`);
  const buffer = await response.arrayBuffer();
  const Ctor =
    window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) throw new Error("AudioContext indisponible");
  audioContext ??= new Ctor();
  const decoded = await audioContext.decodeAudioData(buffer);
  const source = audioContext.createBufferSource();
  source.buffer = decoded;
  source.connect(audioContext.destination);
  source.start();
}

function formatValue(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

function clampNumber(value: number, minimum: number | null, maximum: number | null): number {
  let result = value;
  if (minimum !== null && result < minimum) result = minimum;
  if (maximum !== null && result > maximum) result = maximum;
  return result;
}

type ScalarControlProps = {
  parameter: ControlParameter;
  value: number;
  before: number | null;
  onChange: (value: number, groupWithPrevious: boolean) => void;
  onReset: () => void;
};

function ScalarControl({ parameter, value, before, onChange, onReset }: ScalarControlProps) {
  const minimum = parameter.minimum ?? 0;
  const maximum = parameter.maximum ?? 100;
  const clamped = clampNumber(value, minimum, maximum);
  const changed = before !== null && before !== value;
  return (
    <div className="instrument-inspector__control">
      <div className="instrument-inspector__row">
        <span className="instrument-inspector__label">
          {parameter.label}
          {before !== null && (
            <span className={`instrument-inspector__before${changed ? " is-changed" : ""}`}>
              avant {formatValue(before)} {parameter.unit}
            </span>
          )}
        </span>
        <button type="button" className="instrument-inspector__reset" onClick={onReset}>
          Réinitialiser
        </button>
      </div>
      <div className="instrument-inspector__slider">
        <input
          type="range"
          aria-label={parameter.label}
          min={minimum}
          max={maximum}
          step={parameter.step}
          value={clamped}
          onChange={(event) => onChange(Number(event.target.value), true)}
        />
        <input
          type="number"
          aria-label={`${parameter.label} — valeur précise`}
          min={minimum}
          max={maximum}
          step={parameter.step}
          value={clamped}
          onChange={(event) => onChange(Number(event.target.value), false)}
        />
        <span className="instrument-inspector__value">
          {formatValue(value)} {parameter.unit}
        </span>
      </div>
    </div>
  );
}

type ListControlProps = {
  list: ListParameter;
  parameters: InstrumentParameters;
  before: InstrumentParameters | null;
  onSetParameter: (path: string, value: number, bounds: ParameterBounds, groupWithPrevious?: boolean) => void;
  onSetListLength: (path: string, count: number, itemTemplate: () => unknown) => void;
};

function ListControl({ list, parameters, before, onSetParameter, onSetListLength }: ListControlProps) {
  const items = listItems(parameters, list);
  const scalarItem = list.fields.length === 1 && list.fields[0].path === `${list.path}[]`;
  const boundsFor = (field: ControlParameter): ParameterBounds => ({
    minimum: field.minimum ?? Number.NEGATIVE_INFINITY,
    maximum: field.maximum ?? Number.POSITIVE_INFINITY,
    default: field.default,
  });
  return (
    <div className="instrument-inspector__control">
      <div className="instrument-inspector__row">
        <span className="instrument-inspector__label">
          {list.label} ({items.length})
        </span>
        <div className="instrument-inspector__items">
          <button
            type="button"
            className="instrument-inspector__item-count"
            aria-label={`Retirer un élément de ${list.label}`}
            disabled={items.length <= list.minItems}
            onClick={() => onSetListLength(list.path, items.length - 1, () => itemTemplate(list))}
          >
            −
          </button>
          <button
            type="button"
            className="instrument-inspector__item-count"
            aria-label={`Ajouter un élément à ${list.label}`}
            disabled={items.length >= list.maxItems}
            onClick={() => onSetListLength(list.path, items.length + 1, () => itemTemplate(list))}
          >
            +
          </button>
        </div>
      </div>
      {items.map((item, index) => {
        if (scalarItem) {
          const field = list.fields[0];
          const control: ControlParameter = {
            path: itemPath(list.fields[0].path, index),
            label: `${list.itemLabel} ${index + 1}`,
            default: field.default,
            minimum: field.minimum,
            maximum: field.maximum,
            step: field.step,
            unit: field.unit,
          };
          return (
            <ScalarControl
              key={control.path}
              parameter={control}
              value={currentScalar(parameters, control)}
              before={finiteNumber(parameterValue(before ?? {}, control.path))}
              onChange={(value, group) => onSetParameter(control.path, value, boundsFor(control), group)}
              onReset={() => onSetParameter(control.path, field.default, boundsFor(control))}
            />
          );
        }
        return (
          <div key={`${list.path}[${index}]`} className="instrument-inspector__item">
            {list.fields.map((field) => {
              const control: ControlParameter = {
                path: itemPath(field.path, index),
                label: `${list.itemLabel} ${index + 1} — ${field.label}`,
                default: field.default,
                minimum: field.minimum,
                maximum: field.maximum,
                step: field.step,
                unit: field.unit,
              };
              return (
                <ScalarControl
                  key={control.path}
                  parameter={control}
                  value={currentScalar(parameters, control)}
                  before={finiteNumber(parameterValue(before ?? {}, control.path))}
                  onChange={(value, group) => onSetParameter(control.path, value, boundsFor(control), group)}
                  onReset={() => onSetParameter(control.path, field.default, boundsFor(control))}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function InstrumentInspector({
  track,
  registry,
  projectId,
  compositionId,
  onSetParameter,
  onResetAll,
  onSetListLength,
  onRestoreParameters,
  onPreviewPattern,
  onPreviewTrack,
}: InstrumentInspectorProps) {
  const [midiNote, setMidiNote] = useState(60);
  const [bypass, setBypass] = useState(false);
  const [compareBefore, setCompareBefore] = useState<InstrumentParameters | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const parameters = bypass ? (registry?.defaults ?? {}) : instrumentParameters(track);
  const comparing = compareBefore !== null;

  async function requestPreview(specific: InstrumentParameters) {
    setPreviewError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/compositions/${compositionId}/instrument-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track_id: track.id, midi_note: midiNote, parameters: specific }),
      });
      if (!response.ok) throw new Error(`Préécoute indisponible (HTTP ${response.status})`);
      const payload = (await response.json()) as { wav: string };
      await playPreviewWav(payload.wav);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Préécoute impossible");
    }
  }

  if (!registry) {
    return (
      <section className="instrument-inspector" aria-label="Inspecteur d’instrument">
        <p role="status">Registre d’instruments indisponible.</p>
      </section>
    );
  }

  return (
    <section className="instrument-inspector" aria-label="Inspecteur d’instrument">
      <div className="instrument-inspector__header">
        <h3>
          Instrument — {track.name} <span className="instrument-inspector__kind">{track.kind}</span>
        </h3>
        <div className="instrument-inspector__actions">
          <button
            type="button"
            aria-pressed={comparing}
            onClick={() => {
              if (comparing) setCompareBefore(null);
              else setCompareBefore(JSON.parse(JSON.stringify(parameters)) as InstrumentParameters);
            }}
          >
            {comparing ? "Comparaison active" : "Comparer avant/après"}
          </button>
          {comparing && (
            <button type="button" onClick={() => onRestoreParameters(compareBefore)}>
              Restaurer l’avant
            </button>
          )}
          <button type="button" aria-pressed={bypass} onClick={() => setBypass((current) => !current)}>
            Écouter l’original (bypass)
          </button>
          <button type="button" onClick={onResetAll}>
            Réinitialiser tout
          </button>
        </div>
      </div>
      <div className="instrument-inspector__preview">
        <label>
          Note
          <input
            type="number"
            aria-label="Note de préécoute"
            min="0"
            max="127"
            value={midiNote}
            onChange={(event) => setMidiNote(Number(event.target.value))}
          />
        </label>
        <button type="button" onClick={() => void requestPreview(parameters)}>
          Écouter la note
        </button>
        {comparing && (
          <>
            <button type="button" onClick={() => void requestPreview(compareBefore)}>
              Écouter l’avant
            </button>
            <button type="button" onClick={() => void requestPreview(parameters)}>
              Écouter l’après
            </button>
          </>
        )}
        <button type="button" disabled={!onPreviewPattern} onClick={onPreviewPattern ?? undefined}>
          Préécouter le pattern
        </button>
        <button type="button" onClick={onPreviewTrack}>
          Préécouter la piste
        </button>
      </div>
      {previewError && (
        <p className="instrument-inspector__error" role="alert">
          {previewError}
        </p>
      )}
      {registry.groups.map((group) => (
        <fieldset key={group.id} className="instrument-inspector__group">
          <legend>{group.label}</legend>
          {group.parameters.map((parameter) =>
            parameter.type === "list" ? (
              <ListControl
                key={parameter.path}
                list={parameter}
                parameters={parameters}
                before={compareBefore}
                onSetParameter={onSetParameter}
                onSetListLength={onSetListLength}
              />
            ) : (
              <ScalarControl
                key={parameter.path}
                parameter={parameter}
                value={currentScalar(parameters, parameter)}
                before={finiteNumber(parameterValue(compareBefore ?? {}, parameter.path))}
                onChange={(value, groupWithPrevious) =>
                  onSetParameter(parameter.path, value, scalarBounds(parameter), groupWithPrevious)
                }
                onReset={() => onSetParameter(parameter.path, parameter.default, scalarBounds(parameter))}
              />
            ),
          )}
        </fieldset>
      ))}
    </section>
  );
}
