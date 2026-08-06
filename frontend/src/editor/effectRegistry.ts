import type { ParameterBounds } from "./editorStore";

export type EffectScalarParameter = {
  type: "scalar";
  path: string;
  label: string;
  kind: string;
  default: number;
  minimum: number | null;
  maximum: number | null;
  step: number;
  unit: string;
};

export type EffectParameterGroup = {
  id: string;
  label: string;
  parameters: EffectScalarParameter[];
};

export type EffectKindRegistry = {
  groups: EffectParameterGroup[];
  defaults: Record<string, unknown>;
};

export type EffectRegistryPayload = Record<string, EffectKindRegistry>;

let cachedRegistry: Promise<EffectRegistryPayload> | null = null;

export function fetchEffectRegistry(): Promise<EffectRegistryPayload> {
  if (!cachedRegistry) {
    cachedRegistry = fetch("/api/effect-registry", { headers: { accept: "application/json" } })
      .then((response) => {
        if (!response.ok) throw new Error(`Registre d’effets indisponible (HTTP ${response.status})`);
        return response.json() as Promise<EffectRegistryPayload>;
      })
      .catch((error: unknown) => {
        cachedRegistry = null;
        throw error;
      });
  }
  return cachedRegistry;
}

export function effectParameterBounds(parameter: EffectScalarParameter): ParameterBounds {
  return {
    minimum: parameter.minimum ?? Number.NEGATIVE_INFINITY,
    maximum: parameter.maximum ?? Number.POSITIVE_INFINITY,
    default: parameter.default,
  };
}

export function effectParametersOf(registry: EffectRegistryPayload, kind: string): EffectScalarParameter[] {
  const groups = registry[kind]?.groups ?? [];
  return groups.flatMap((group) => group.parameters);
}
