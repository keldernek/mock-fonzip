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

const EXAMPLE_KEYS = new Set(["example", "examples"]);

export function mapJson(
  node: Json,
  visit: (object: JsonObject, key: string | null) => JsonObject,
  key: string | null = null,
): Json {
  if (key !== null && EXAMPLE_KEYS.has(key)) return node;
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

export function resolvePointer(root: Json, ref: string): Json {
  if (!ref.startsWith("#/")) throw new Error(`unsupported $ref ${ref}`);
  let node: Json | undefined = root;
  for (const raw of ref.slice(2).split("/")) {
    const segment = raw.replaceAll("~1", "/").replaceAll("~0", "~");
    node = isJsonObject(node) ? node[segment] : undefined;
    if (node === undefined) throw new Error(`dangling $ref ${ref}`);
  }
  return node;
}

export function deref(root: Json, node: Json | undefined): Json | undefined {
  if (isJsonObject(node) && typeof node.$ref === "string") {
    return deref(root, resolvePointer(root, node.$ref));
  }
  return node;
}
