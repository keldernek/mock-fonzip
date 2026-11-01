import type { JsonObject } from "../spec/json";
import { deref, isJsonObject, type Json } from "../spec/json";
import { specRuntime } from "../spec/runtime";

export function sampleValue(schema: JsonObject): Json {
  const { spec } = specRuntime();
  const resolved = deref(spec, schema);
  if (!isJsonObject(resolved)) return null;
  if (Array.isArray(resolved.enum)) {
    const first = resolved.enum.find((value) => value !== null);
    if (first !== undefined) return first;
  }
  if (resolved.default !== undefined && resolved.default !== null) {
    return resolved.default;
  }
  const anyOf = resolved.anyOf ?? resolved.allOf;
  if (Array.isArray(anyOf)) {
    const first = anyOf.find(isJsonObject);
    return first ? sampleValue(first) : null;
  }
  switch (resolved.type) {
    case "integer":
    case "number":
      return typeof resolved.minimum === "number" ? resolved.minimum : 1;
    case "boolean":
      return true;
    case "array": {
      const items = resolved.items;
      return isJsonObject(items) ? [sampleValue(items)] : [];
    }
    case "object":
      return sampleObject(resolved);
    case "string":
      if (resolved.format === "date-time") return "2026-10-01T10:00:00+03:00";
      if (resolved.format === "date") return "2026-10-01";
      if (resolved.format === "email") return "ornek@kelder.example";
      if (resolved.format === "uri" || resolved.format === "url") {
        return "https://kelder.example/hook";
      }
      return "ornek";
    default:
      return isJsonObject(resolved.properties) ? sampleObject(resolved) : null;
  }
}

function sampleObject(schema: JsonObject): JsonObject {
  const properties = isJsonObject(schema.properties) ? schema.properties : {};
  const required = Array.isArray(schema.required) ? schema.required : [];
  const out: JsonObject = {};
  for (const name of required) {
    if (typeof name !== "string") continue;
    const property = properties[name];
    out[name] = isJsonObject(property) ? sampleValue(property) : "ornek";
  }
  return out;
}
