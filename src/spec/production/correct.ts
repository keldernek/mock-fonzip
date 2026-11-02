import { isJsonObject, type Json, type JsonObject } from "../json";

// A change to the pinned spec that makes it say what production answers.
// `bun run parity:prod --live` is the evidence for each one.
export interface ProductionCorrection {
  // A JSON pointer to an object schema in the normalized spec, such as
  // `#/components/schemas/Template` or
  // `#/components/responses/GetUserListResponse/content/application~1json/schema/properties/user_list/items`.
  // The node must be the schema itself, not a `$ref`, so that a schema
  // shared by several operations never changes by accident.
  readonly at: string;
  // What production showed, for example "prod sent null on 8 of 20 rows".
  readonly evidence: string;
  // Replaces the whole schema. Runs before every other field.
  readonly replace?: Json;
  // Documented name to the name production uses.
  readonly rename?: Readonly<Record<string, string>>;
  // Documented properties that production never sends.
  readonly remove?: readonly string[];
  // Properties to add, or to replace when production sends another type.
  readonly properties?: Readonly<Record<string, Json>>;
  // Properties that production sends as null. Runs after the fields above,
  // so it also applies to properties added there.
  readonly nullable?: readonly string[];
  // Properties production insists on, in a request body. Runs last.
  readonly require?: readonly string[];
}

const NULL_BRANCH: JsonObject = { type: "null" };

function isNullBranch(node: Json): boolean {
  return isJsonObject(node) && node.type === "null";
}

function decode(segment: string): string {
  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

function segmentsOf(pointer: string): string[] {
  if (!pointer.startsWith("#/")) {
    throw new Error(`production correction: ${pointer} is not a #/ pointer`);
  }
  return pointer.slice(2).split("/").map(decode);
}

function updateAt(
  node: Json,
  segments: readonly string[],
  pointer: string,
  update: (target: JsonObject) => JsonObject,
): Json {
  const [head, ...rest] = segments;
  if (head === undefined) {
    if (!isJsonObject(node)) {
      throw new Error(`production correction: ${pointer} is not an object`);
    }
    if (typeof node.$ref === "string") {
      throw new Error(
        `production correction: ${pointer} is a $ref to ${node.$ref}; point at that schema instead`,
      );
    }
    return update(node);
  }
  if (Array.isArray(node)) {
    const index = Number(head);
    if (!Number.isInteger(index) || node[index] === undefined) {
      throw new Error(`production correction: ${pointer} does not resolve`);
    }
    return node.map((item, at) =>
      at === index ? updateAt(item, rest, pointer, update) : item,
    );
  }
  if (!isJsonObject(node) || node[head] === undefined) {
    throw new Error(`production correction: ${pointer} does not resolve`);
  }
  return { ...node, [head]: updateAt(node[head], rest, pointer, update) };
}

// OAS 3.0 ignores `nullable` next to a `$ref` and Ajv needs a `type` for
// it, so a reference or a composition gains a null branch instead.
export function nullableSchema(schema: Json, where: string): Json {
  if (!isJsonObject(schema)) {
    throw new Error(`production correction: ${where} is not a schema`);
  }
  if (typeof schema.$ref === "string") {
    return {
      ...(schema.description === undefined
        ? {}
        : { description: schema.description }),
      anyOf: [{ $ref: schema.$ref }, NULL_BRANCH],
    };
  }
  if (Array.isArray(schema.anyOf)) {
    return schema.anyOf.some(isNullBranch)
      ? schema
      : { ...schema, anyOf: [...schema.anyOf, NULL_BRANCH] };
  }
  if (Array.isArray(schema.oneOf)) {
    const { oneOf, ...rest } = schema;
    return { ...rest, anyOf: [...oneOf, NULL_BRANCH] };
  }
  if (Array.isArray(schema.allOf)) {
    const { allOf, description, ...rest } = schema;
    return {
      ...(description === undefined ? {} : { description }),
      anyOf: [{ ...rest, allOf }, NULL_BRANCH],
    };
  }
  if (typeof schema.type === "string") {
    return schema.type === "null" ? schema : { ...schema, nullable: true };
  }
  throw new Error(
    `production correction: ${where} has no type, $ref or composition to make nullable`,
  );
}

function requiredList(schema: JsonObject): string[] {
  return Array.isArray(schema.required)
    ? schema.required.filter((name): name is string => typeof name === "string")
    : [];
}

function withRequired(schema: JsonObject, required: string[]): JsonObject {
  const { required: _required, ...rest } = schema;
  return required.length === 0 ? rest : { ...rest, required };
}

function propertiesOf(schema: JsonObject, where: string): JsonObject {
  if (!isJsonObject(schema.properties)) {
    throw new Error(`production correction: ${where} has no properties`);
  }
  return schema.properties;
}

function applyOne(
  schema: JsonObject,
  correction: ProductionCorrection,
): JsonObject {
  const where = correction.at;
  let next: JsonObject = schema;
  if (correction.replace !== undefined) {
    if (!isJsonObject(correction.replace)) {
      throw new Error(`production correction: ${where} replace is not a schema`);
    }
    next = correction.replace;
  }
  for (const [from, to] of Object.entries(correction.rename ?? {})) {
    const properties = propertiesOf(next, where);
    const property = properties[from];
    if (property === undefined) {
      throw new Error(`production correction: ${where} has no ${from} to rename`);
    }
    if (properties[to] !== undefined) {
      throw new Error(`production correction: ${where} already has ${to}`);
    }
    const renamed = Object.fromEntries(
      Object.entries(properties).map(([name, value]) =>
        name === from ? [to, value] : [name, value],
      ),
    );
    next = withRequired(
      { ...next, properties: renamed },
      requiredList(next).map((name) => (name === from ? to : name)),
    );
  }
  for (const name of correction.remove ?? []) {
    const { [name]: removed, ...kept } = propertiesOf(next, where);
    if (removed === undefined) {
      throw new Error(`production correction: ${where} has no ${name} to remove`);
    }
    next = withRequired(
      { ...next, properties: kept },
      requiredList(next).filter((required) => required !== name),
    );
  }
  if (correction.properties !== undefined) {
    const existing = isJsonObject(next.properties) ? next.properties : {};
    next = { ...next, properties: { ...existing, ...correction.properties } };
  }
  for (const name of correction.nullable ?? []) {
    const properties = propertiesOf(next, where);
    const property = properties[name];
    if (property === undefined) {
      throw new Error(`production correction: ${where} has no ${name} to make nullable`);
    }
    next = {
      ...next,
      properties: {
        ...properties,
        [name]: nullableSchema(property, `${where}/properties/${name}`),
      },
    };
  }
  for (const name of correction.require ?? []) {
    if (propertiesOf(next, where)[name] === undefined) {
      throw new Error(`production correction: ${where} has no ${name} to require`);
    }
    const required = requiredList(next);
    if (!required.includes(name)) next = withRequired(next, [...required, name]);
  }
  return next;
}

export function applyCorrections(
  spec: JsonObject,
  corrections: readonly ProductionCorrection[],
): JsonObject {
  let next: Json = spec;
  for (const correction of corrections) {
    next = updateAt(next, segmentsOf(correction.at), correction.at, (schema) =>
      applyOne(schema, correction),
    );
  }
  if (!isJsonObject(next)) throw new Error("production corrections lost the root");
  return next;
}
