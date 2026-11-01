import { isJsonObject, mapJson, type Json, type JsonObject } from "./json";

const REQUEST_BODY_REF = /^#\/components\/requestBodies\/([^/]+)$/;

function nullableWithoutType(node: JsonObject): JsonObject {
  if (node.nullable !== true || node.type !== undefined) return node;
  const { nullable: _nullable, allOf, description, ...rest } = node;
  const branches = Array.isArray(allOf) ? allOf : [rest];
  return {
    ...(description === undefined ? {} : { description }),
    anyOf: [...branches, { type: "null" }],
  };
}

function uniqueEnum(node: JsonObject): JsonObject {
  if (!Array.isArray(node.enum)) return node;
  const seen = new Set<string>();
  const values = node.enum.filter((value) => {
    const key = JSON.stringify(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return values.length === node.enum.length ? node : { ...node, enum: values };
}

const DUES_LISTING_AS_PUBLISHED = JSON.stringify(["a", "p", "d", "d"]);

function correctDuesListingEnum(node: JsonObject): JsonObject {
  return node.name === "listing" &&
    isJsonObject(node.schema) &&
    JSON.stringify(node.schema.enum) === DUES_LISTING_AS_PUBLISHED
    ? { ...node, schema: { ...node.schema, enum: ["a", "p", "d", "r"] } }
    : node;
}

function oneOfAsAnyOf(node: JsonObject): JsonObject {
  if (!Array.isArray(node.oneOf)) return node;
  const { oneOf, ...rest } = node;
  return { ...rest, anyOf: oneOf };
}

function requestBodySchema(spec: JsonObject, name: string): Json {
  const components = spec.components;
  if (!isJsonObject(components)) return null;
  const bodies = components.requestBodies;
  if (!isJsonObject(bodies)) return null;
  const body = bodies[name];
  if (!isJsonObject(body) || !isJsonObject(body.content)) return null;
  const media = body.content["application/json"];
  return isJsonObject(media) ? (media.schema ?? null) : null;
}

function hoistRequestBodySchemas(spec: JsonObject): JsonObject {
  const hoisted = new Map<string, Json>();
  const rewritten = mapJson(spec, (node, key) => {
    if (key === "requestBody" || typeof node.$ref !== "string") return node;
    const match = REQUEST_BODY_REF.exec(node.$ref);
    const name = match?.[1];
    if (name === undefined) return node;
    const schema = requestBodySchema(spec, name);
    if (schema === null) return node;
    hoisted.set(name, schema);
    return { ...node, $ref: `#/components/schemas/${name}` };
  });
  if (!isJsonObject(rewritten) || !isJsonObject(rewritten.components)) {
    return spec;
  }
  const schemas = rewritten.components.schemas;
  if (!isJsonObject(schemas)) return spec;
  for (const name of hoisted.keys()) {
    if (schemas[name] !== undefined) {
      throw new Error(`cannot hoist requestBodies/${name}: schema exists`);
    }
  }
  return {
    ...rewritten,
    components: {
      ...rewritten.components,
      schemas: { ...schemas, ...Object.fromEntries(hoisted) },
    },
  };
}

export function normalizeSpec(spec: Json): JsonObject {
  if (!isJsonObject(spec)) throw new Error("the spec is not a JSON object");
  const corrected = mapJson(
    hoistRequestBodySchemas(spec),
    correctDuesListingEnum,
  );
  const normalized = mapJson(corrected, (node, key) =>
    key === "requestBody"
      ? node
      : uniqueEnum(oneOfAsAnyOf(nullableWithoutType(node))),
  );
  if (!isJsonObject(normalized)) throw new Error("normalization lost the root");
  return normalized;
}
