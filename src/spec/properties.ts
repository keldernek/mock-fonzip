import { deref, isJsonObject, type Json, type JsonObject } from "./json";

function join(prefix: string, key: string): string {
  return prefix === "" ? key : `${prefix}.${key}`;
}

export function documentedPaths(spec: JsonObject, schema: Json): Set<string> {
  const paths = new Set<string>();
  const walk = (
    node: Json | undefined,
    prefix: string,
    seen: ReadonlySet<string>,
  ): void => {
    if (!isJsonObject(node)) return;
    let nextSeen = seen;
    if (typeof node.$ref === "string") {
      if (seen.has(node.$ref)) return;
      nextSeen = new Set([...seen, node.$ref]);
    }
    const resolved = deref(spec, node);
    if (!isJsonObject(resolved)) return;
    for (const key of ["anyOf", "allOf", "oneOf"]) {
      const branches = resolved[key];
      if (Array.isArray(branches)) {
        for (const branch of branches) walk(branch, prefix, nextSeen);
      }
    }
    if (isJsonObject(resolved.properties)) {
      for (const [name, property] of Object.entries(resolved.properties)) {
        const path = join(prefix, name);
        paths.add(path);
        walk(property, path, nextSeen);
      }
    }
    if (resolved.type === "array")
      walk(resolved.items, `${prefix}[]`, nextSeen);
  };
  walk(schema, "", new Set());
  return paths;
}

export function presentPaths(
  value: unknown,
  prefix = "",
  into = new Set<string>(),
): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) presentPaths(item, `${prefix}[]`, into);
    return into;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      const path = join(prefix, key);
      into.add(path);
      presentPaths(item, path, into);
    }
  }
  return into;
}
