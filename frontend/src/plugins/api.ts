import { apiRequest } from "../api/client";

export type PluginSummary = {
  plugin_id: string;
  name: string;
  version: string;
  presets: string[];
};

export type PluginParameter = {
  id: string;
  type: "float" | "int" | "bool" | "enum";
  unit?: string;
  curve?: "linear" | "exponential";
  min?: number;
  max?: number;
  default: number | boolean | string;
  values?: string[];
};

export type PluginParameterGroup = {
  id: string;
  label: string;
  parameters: PluginParameter[];
};

export type PluginManifest = {
  schema_version: number;
  plugin_id: string;
  name: string;
  version: string;
  kind: string;
  engine: { module: string; function: string; sample_rate: number };
  parameter_groups: PluginParameterGroup[];
  presets: string[];
};

export type PluginArtifact = {
  wav: string;
  sha256: string;
  duration_seconds: number;
  peak: number;
  dc_offset: number;
  is_clipping: boolean;
  sample_rate: number;
  channels: number;
};

export function listPlugins(): Promise<PluginSummary[]> {
  return apiRequest<PluginSummary[]>("/api/plugins");
}

export function getPluginManifest(pluginId: string): Promise<PluginManifest> {
  return apiRequest<PluginManifest>(`/api/plugins/${pluginId}/manifest`);
}

export function getPluginPreset(
  pluginId: string,
  preset: string,
): Promise<Record<string, number | boolean | string>> {
  return apiRequest<Record<string, number | boolean | string>>(`/api/plugins/${pluginId}/presets/${preset}`);
}

export function renderPlugin(
  pluginId: string,
  request: { preset: string; overrides?: Record<string, number | boolean | string>; velocity?: number },
): Promise<PluginArtifact> {
  return apiRequest<PluginArtifact>(`/api/plugins/${pluginId}/render`, {
    method: "POST",
    body: JSON.stringify({ overrides: {}, velocity: 1, ...request }),
  });
}
