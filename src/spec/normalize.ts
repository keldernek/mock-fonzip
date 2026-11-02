import { isJsonObject, mapJson, type Json, type JsonObject } from "./json";
import { applyProductionCorrections } from "./production";

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

const DEPENDENT_DEFAULT = "The default depends on";

function dropDependentDefault(node: JsonObject): JsonObject {
  if (
    typeof node.description !== "string" ||
    !node.description.includes(DEPENDENT_DEFAULT) ||
    !isJsonObject(node.schema) ||
    node.schema.default === undefined
  ) {
    return node;
  }
  const { default: _default, ...schema } = node.schema;
  return { ...node, schema };
}

const BARE_DATE_PARAMETERS: Readonly<Record<string, readonly string[]>> = {
  "/debts": ["start_date", "end_date", "create_start_date", "create_end_date"],
};

function acceptBareDates(spec: JsonObject): JsonObject {
  const paths = spec.paths;
  if (!isJsonObject(paths)) return spec;
  const rewritten: JsonObject = { ...paths };
  for (const [path, names] of Object.entries(BARE_DATE_PARAMETERS)) {
    const item = paths[path];
    if (!isJsonObject(item) || !isJsonObject(item.get)) continue;
    const parameters = item.get.parameters;
    if (!Array.isArray(parameters)) continue;
    rewritten[path] = {
      ...item,
      get: {
        ...item.get,
        parameters: parameters.map((parameter) => {
          if (
            !isJsonObject(parameter) ||
            typeof parameter.name !== "string" ||
            !names.includes(parameter.name) ||
            !isJsonObject(parameter.schema) ||
            parameter.schema.format !== "date-time"
          ) {
            return parameter;
          }
          const { format: _format, type: _type, ...schema } = parameter.schema;
          return {
            ...parameter,
            schema: {
              ...schema,
              anyOf: [
                { type: "string", format: "date-time" },
                { type: "string", format: "date" },
              ],
            },
          };
        }),
      },
    };
  }
  return { ...spec, paths: rewritten };
}

const OPEN_ENUM_PARAMETERS: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = {
  getDonationPageList: { order_by: "DonationPageListOrder" },
  getFormList: { order_by: "FormListOrder" },
  getEcardTransactionList: {
    order_by: "EcardTransactionListOrder",
    list: "EcardTransactionListField",
  },
};

function withoutEnum(schema: JsonObject): {
  readonly open: JsonObject;
  readonly known: JsonObject;
} {
  const { enum: values, ...open } = schema;
  if (Array.isArray(values)) {
    return { open, known: { type: schema.type ?? "string", enum: values } };
  }
  if (isJsonObject(schema.items)) {
    const items = withoutEnum(schema.items);
    return { open: { ...schema, items: items.open }, known: items.known };
  }
  throw new Error("an open enum parameter has no enum");
}

function openProseEnums(spec: JsonObject): JsonObject {
  const known = new Map<string, JsonObject>();
  const rewritten = mapJson(spec, (node) => {
    const names =
      typeof node.operationId === "string"
        ? OPEN_ENUM_PARAMETERS[node.operationId]
        : undefined;
    if (names === undefined || !Array.isArray(node.parameters)) return node;
    return {
      ...node,
      parameters: node.parameters.map((parameter) => {
        if (
          !isJsonObject(parameter) ||
          typeof parameter.name !== "string" ||
          !isJsonObject(parameter.schema)
        ) {
          return parameter;
        }
        const name = names[parameter.name];
        if (name === undefined) return parameter;
        const { open, known: values } = withoutEnum(parameter.schema);
        known.set(name, values);
        return { ...parameter, schema: open };
      }),
    };
  });
  if (!isJsonObject(rewritten) || !isJsonObject(rewritten.components)) {
    return spec;
  }
  const schemas = rewritten.components.schemas;
  if (!isJsonObject(schemas)) return spec;
  for (const name of known.keys()) {
    if (schemas[name] !== undefined) {
      throw new Error(`cannot hoist the ${name} enum: schema exists`);
    }
  }
  return {
    ...rewritten,
    components: {
      ...rewritten.components,
      schemas: { ...schemas, ...Object.fromEntries(known) },
    },
  };
}

function nullableEnumAllowsNull(node: JsonObject): JsonObject {
  if (node.nullable !== true || !Array.isArray(node.enum)) return node;
  return node.enum.includes(null)
    ? node
    : { ...node, enum: [...node.enum, null] };
}

function stringEnumAsStrings(node: JsonObject): JsonObject {
  if (node.type !== "string" || !Array.isArray(node.enum)) return node;
  if (!node.enum.some((value) => typeof value === "boolean")) return node;
  return {
    ...node,
    enum: node.enum.map((value) =>
      typeof value === "boolean" ? String(value) : value,
    ),
  };
}

const ENUM_PLACEHOLDERS: Readonly<Record<string, JsonObject>> = {
  "Any URL for operation 1": { type: "string", format: "uri" },
  user_defined_values__KEY: {
    type: "string",
    pattern: "^user_defined_values__.+$",
  },
};

function enumPlaceholderAsPattern(node: JsonObject): JsonObject {
  if (!Array.isArray(node.enum)) return node;
  const placeholders = node.enum.filter(
    (value): value is string =>
      typeof value === "string" && ENUM_PLACEHOLDERS[value] !== undefined,
  );
  if (placeholders.length === 0) return node;
  const { enum: values, description, ...rest } = node;
  return {
    ...(description === undefined ? {} : { description }),
    anyOf: [
      {
        ...rest,
        enum: values.filter(
          (value) => typeof value !== "string" || !placeholders.includes(value),
        ),
      },
      ...placeholders.flatMap((value) => {
        const schema = ENUM_PLACEHOLDERS[value];
        return schema ? [schema] : [];
      }),
    ],
  };
}

const PLACEHOLDER_KEYED_MAPS: Readonly<Record<string, string>> = {
  UserDefinedValuesReference: "key",
};

function placeholderKeyedMaps(spec: JsonObject): JsonObject {
  const components = spec.components;
  const schemas = isJsonObject(components) ? components.schemas : undefined;
  if (!isJsonObject(components) || !isJsonObject(schemas)) return spec;
  const rewritten: JsonObject = {};
  for (const [name, placeholder] of Object.entries(PLACEHOLDER_KEYED_MAPS)) {
    const schema = schemas[name];
    if (!isJsonObject(schema) || !isJsonObject(schema.properties)) continue;
    const values = schema.properties[placeholder];
    if (values === undefined) continue;
    const { properties: _properties, ...rest } = schema;
    rewritten[name] = { ...rest, additionalProperties: values };
  }
  return {
    ...spec,
    components: { ...components, schemas: { ...schemas, ...rewritten } },
  };
}

function searchFilterGroups(spec: JsonObject): JsonObject {
  const components = spec.components;
  const schemas = isJsonObject(components) ? components.schemas : undefined;
  if (!isJsonObject(components) || !isJsonObject(schemas)) return spec;
  const main = schemas.MainSearchFilter;
  const filters = schemas.UserSearchFilters;
  if (!isJsonObject(main) || !isJsonObject(filters)) return spec;
  if (!isJsonObject(main.properties) || !isJsonObject(filters.properties)) {
    return spec;
  }
  const value = filters.properties.value;
  const attributes = main.properties.attributes;
  if (!isJsonObject(value) || !isJsonObject(attributes)) return spec;
  if (!Array.isArray(value.oneOf)) return spec;
  const { oneOf: branches, ...valueRest } = value;
  return {
    ...spec,
    components: {
      ...components,
      schemas: {
        ...schemas,
        MainSearchFilter: {
          ...main,
          properties: {
            ...main.properties,
            attributes: {
              ...attributes,
              items: {
                anyOf: [
                  { $ref: "#/components/schemas/UserSearchFilters" },
                  { $ref: "#/components/schemas/MainSearchFilter" },
                ],
              },
            },
          },
        },
        UserSearchFilters: {
          ...filters,
          properties: {
            ...filters.properties,
            value: { ...valueRest, anyOf: [...branches, { type: "null" }] },
          },
        },
      },
    },
  };
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

function objectOf(node: Json): JsonObject {
  if (!isJsonObject(node)) throw new Error("normalization lost the root");
  return node;
}

export function normalizeSpec(spec: Json): JsonObject {
  if (!isJsonObject(spec)) throw new Error("the spec is not a JSON object");
  const corrected = mapJson(
    placeholderKeyedMaps(
      searchFilterGroups(
        openProseEnums(acceptBareDates(hoistRequestBodySchemas(spec))),
      ),
    ),
    (node) =>
      enumPlaceholderAsPattern(
        dropDependentDefault(correctDuesListingEnum(node)),
      ),
  );
  // Production corrections run before the generic passes, so a property they
  // make nullable still gains null in its enum.
  const normalized = mapJson(applyProductionCorrections(objectOf(corrected)), (node, key) =>
    key === "requestBody"
      ? node
      : nullableEnumAllowsNull(
          uniqueEnum(
            stringEnumAsStrings(oneOfAsAnyOf(nullableWithoutType(node))),
          ),
        ),
  );
  if (!isJsonObject(normalized)) throw new Error("normalization lost the root");
  return normalized;
}
