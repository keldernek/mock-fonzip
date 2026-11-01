export type Json = null | boolean | number | string | Json[] | JsonObject;
export interface JsonObject {
  [key: string]: Json;
}

export function isJsonObject(value: Json | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toJson(value: unknown): Json {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map(toJson);
  if (typeof value === "object") {
    const out: JsonObject = {};
    for (const [key, item] of Object.entries(value)) out[key] = toJson(item);
    return out;
  }
  throw new Error(`not JSON: ${typeof value}`);
}

export function mapJson(
  node: Json,
  visit: (object: JsonObject, key: string | null) => JsonObject,
  key: string | null = null,
): Json {
  if (Array.isArray(node)) {
    return node.map((item) => mapJson(item, visit, null));
  }
  if (!isJsonObject(node)) return node;
  const out: JsonObject = {};
  for (const [childKey, item] of Object.entries(node)) {
    out[childKey] = mapJson(item, visit, childKey);
  }
  return visit(out, key);
}
