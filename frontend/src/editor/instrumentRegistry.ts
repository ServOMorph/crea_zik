import { parameterValue, type InstrumentParameters, type ParameterBounds } from "./editorStore";

export type ScalarParameter = {
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

export type ListParameterField = {
  path: string;
  label: string;
  kind: string;
  default: number;
  minimum: number | null;
  maximum: number | null;
  step: number;
  unit: string;
};

export type ListParameter = {
  type: "list";
  path: string;
  label: string;
  itemLabel: string;
  minItems: number;
  maxItems: number;
  fields: ListParameterField[];
};

export type ParameterGroup = {
  id: string;
  label: string;
  parameters: Array<ScalarParameter | ListParameter>;
};

export type InstrumentKindRegistry = {
  groups: ParameterGroup[];
  defaults: InstrumentParameters;
};

export type InstrumentRegistryPayload = Record<string, InstrumentKindRegistry>;

let cachedRegistry: Promise<InstrumentRegistryPayload> | null = null;

export function fetchInstrumentRegistry(): Promise<InstrumentRegistryPayload> {
  if (!cachedRegistry) {
    cachedRegistry = fetch("/api/instrument-registry", { headers: { accept: "application/json" } })
      .then((response) => {
        if (!response.ok) throw new Error(`Registre indisponible (HTTP ${response.status})`);
        return response.json() as Promise<InstrumentRegistryPayload>;
      })
      .catch((error: unknown) => {
        cachedRegistry = null;
        throw error;
      });
  }
  return cachedRegistry;
}

export function itemPath(fieldPath: string, index: number): string {
  return fieldPath.replaceAll("[]", `[${index}]`);
}

export function itemFieldKey(listPath: string, fieldPath: string): string {
  const suffix = fieldPath.slice(listPath.length).replace(/^\[\]/, "");
  return suffix.startsWith(".") ? suffix.slice(1) : suffix;
}

export function itemTemplate(list: ListParameter): unknown {
  const objectField = list.fields.find((field) => field.path !== `${list.path}[]`);
  if (objectField) {
    const item: Record<string, unknown> = {};
    for (const field of list.fields) {
      const key = itemFieldKey(list.path, field.path);
      if (key) item[key] = field.default;
    }
    return item;
  }
  return list.fields[0]?.default ?? 0;
}

export function scalarBounds(parameter: {
  minimum: number | null;
  maximum: number | null;
  default: number;
}): ParameterBounds {
  return {
    minimum: parameter.minimum ?? Number.NEGATIVE_INFINITY,
    maximum: parameter.maximum ?? Number.POSITIVE_INFINITY,
    default: parameter.default,
  };
}

export function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

export function currentScalar(parameters: InstrumentParameters, parameter: { path: string; default: number }): number {
  const value = finiteNumber(parameterValue(parameters, parameter.path));
  return value ?? parameter.default;
}

export function listItems(parameters: InstrumentParameters, list: ListParameter): unknown[] {
  const value = parameterValue(parameters, list.path);
  return Array.isArray(value) ? value : [];
}
