import { useEffect, useState } from "react";

import { ApiError } from "../api/client";
import {
  PluginArtifact,
  PluginManifest,
  PluginParameter,
  PluginSummary,
  getPluginManifest,
  getPluginPreset,
  listPlugins,
  renderPlugin,
} from "./api";

type ParamValues = Record<string, number | boolean | string>;

function ParameterControl({
  parameter,
  value,
  onChange,
}: {
  parameter: PluginParameter;
  value: number | boolean | string;
  onChange: (value: number | boolean | string) => void;
}) {
  const inputId = `plugin-param-${parameter.id}`;
  if (parameter.type === "bool") {
    return (
      <label htmlFor={inputId}>
        <input
          checked={Boolean(value)}
          id={inputId}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        {parameter.id}
      </label>
    );
  }
  if (parameter.type === "enum") {
    return (
      <label htmlFor={inputId}>
        {parameter.id}
        <select id={inputId} onChange={(event) => onChange(event.target.value)} value={String(value)}>
          {(parameter.values ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }
  const range = (parameter.max ?? 1) - (parameter.min ?? 0);
  const step = parameter.type === "int" ? 1 : range / 1000 || 0.001;
  return (
    <label htmlFor={inputId}>
      {parameter.id}
      {parameter.unit ? ` (${parameter.unit})` : ""}
      <input
        id={inputId}
        max={parameter.max}
        min={parameter.min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={Number(value)}
      />
      <output htmlFor={inputId}>{Number(value)}</output>
    </label>
  );
}

export function PluginBench() {
  const [plugins, setPlugins] = useState<PluginSummary[] | null>(null);
  const [pluginId, setPluginId] = useState<string | null>(null);
  const [manifest, setManifest] = useState<PluginManifest | null>(null);
  const [preset, setPreset] = useState<string | null>(null);
  const [paramValues, setParamValues] = useState<ParamValues>({});
  const [artifact, setArtifact] = useState<PluginArtifact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    listPlugins()
      .then((items) => {
        setPlugins(items);
        setPluginId((current) => current ?? items[0]?.plugin_id ?? null);
      })
      .catch((requestError: unknown) =>
        setError(requestError instanceof ApiError ? requestError.message : "Erreur réseau"),
      );
  }, []);

  useEffect(() => {
    if (!pluginId) return;
    setArtifact(null);
    getPluginManifest(pluginId)
      .then((loaded) => {
        setManifest(loaded);
        setPreset(loaded.presets[0] ?? null);
      })
      .catch((requestError: unknown) =>
        setError(requestError instanceof ApiError ? requestError.message : "Erreur réseau"),
      );
  }, [pluginId]);

  useEffect(() => {
    if (!pluginId || !preset) return;
    getPluginPreset(pluginId, preset)
      .then((values) => setParamValues(values))
      .catch((requestError: unknown) =>
        setError(requestError instanceof ApiError ? requestError.message : "Erreur réseau"),
      );
  }, [pluginId, preset]);

  const handleRender = async () => {
    if (!pluginId || !preset) return;
    setRendering(true);
    setError(null);
    try {
      const result = await renderPlugin(pluginId, { preset, overrides: paramValues, velocity: 1 });
      setArtifact(result);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Erreur réseau");
    } finally {
      setRendering(false);
    }
  };

  const handleReset = () => {
    if (!pluginId || !preset) return;
    getPluginPreset(pluginId, preset)
      .then((values) => setParamValues(values))
      .catch((requestError: unknown) =>
        setError(requestError instanceof ApiError ? requestError.message : "Erreur réseau"),
      );
  };

  return (
    <section aria-label="Banc de test des plugins" className="plugin-bench">
      <h1>Plugins</h1>
      {error && <p role="alert">{error}</p>}
      <label htmlFor="plugin-select">
        Plugin
        <select
          id="plugin-select"
          onChange={(event) => setPluginId(event.target.value)}
          value={pluginId ?? ""}
        >
          {(plugins ?? []).map((item) => (
            <option key={item.plugin_id} value={item.plugin_id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {manifest && (
        <label htmlFor="preset-select">
          Preset
          <select
            id="preset-select"
            onChange={(event) => setPreset(event.target.value)}
            value={preset ?? ""}
          >
            {manifest.presets.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      )}
      <button onClick={handleReset} type="button">
        Réinitialiser
      </button>
      {manifest?.parameter_groups.map((group) => (
        <fieldset key={group.id}>
          <legend>{group.label}</legend>
          {group.parameters.map((parameter) => (
            <ParameterControl
              key={parameter.id}
              onChange={(value) => setParamValues((current) => ({ ...current, [parameter.id]: value }))}
              parameter={parameter}
              value={paramValues[parameter.id] ?? parameter.default}
            />
          ))}
        </fieldset>
      ))}
      <button disabled={rendering || !preset} onClick={handleRender} type="button">
        {rendering ? "Rendu en cours…" : "Rendre"}
      </button>
      {artifact && (
        <div>
          <audio controls src={`/projects/${artifact.wav}`} />
          <a download href={`/projects/${artifact.wav}`}>
            Télécharger le WAV
          </a>
        </div>
      )}
    </section>
  );
}
