import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";

import { isJsonObject, mapJson, type Json, type JsonObject } from "./json";
import type {
  ParameterLocation,
  ParameterSpec,
  RouteEntry,
  RouteTable,
} from "./routes";

const SPEC_ID = "fonzip";

function objectOf(node: Json): JsonObject {
  if (!isJsonObject(node)) throw new Error("expected a schema object");
  return node;
}

function pointAtSpec(schema: JsonObject): JsonObject {
  return objectOf(
    mapJson(schema, (node) =>
      typeof node.$ref === "string" && node.$ref.startsWith("#/")
        ? { ...node, $ref: `${SPEC_ID}${node.$ref}` }
        : node,
    ),
  );
}

function forbidUndocumentedProperties(schema: JsonObject): JsonObject {
  return objectOf(
    mapJson(schema, (node, key) =>
      key !== "properties" &&
      isJsonObject(node.properties) &&
      node.additionalProperties === undefined
        ? { ...node, additionalProperties: false }
        : node,
    ),
  );
}

function createAjv(
  spec: JsonObject,
  options: { coerce: boolean; strict: boolean },
): Ajv {
  const ajv = new Ajv({
    strict: false,
    allErrors: true,
    coerceTypes: options.coerce ? "array" : false,
    useDefaults: options.coerce,
  });
  addFormats(ajv);
  const raw = objectOf(spec.components ?? {});
  const components = options.strict ? forbidUndocumentedProperties(raw) : raw;
  ajv.addSchema({ $id: SPEC_ID, components: pointAtSpec(components) }, SPEC_ID);
  return ajv;
}

function parameterSchema(parameter: ParameterSpec): JsonObject {
  if (!parameter.required && parameter.schema.default !== null) {
    return parameter.schema;
  }
  const { default: _default, ...rest } = parameter.schema;
  return rest;
}

function parametersObject(
  route: RouteEntry,
  location: ParameterLocation,
): JsonObject {
  const parameters = route.parameters.filter((p) => p.in === location);
  return {
    type: "object",
    properties: Object.fromEntries(
      parameters.map((p) => [p.name, pointAtSpec(parameterSchema(p))]),
    ),
    required: parameters.filter((p) => p.required).map((p) => p.name),
  };
}

export interface ValidationFailure {
  readonly location: "path" | "query" | "body";
  readonly errors: readonly ErrorObject[];
  readonly message: string;
}

export interface RequestValidator {
  validate(request: {
    path: Record<string, unknown>;
    query: Record<string, unknown>;
    body: unknown;
  }): ValidationFailure | null;
}

export interface Validators {
  request(route: RouteEntry): RequestValidator;
  response(route: RouteEntry, status: number): ValidateFunction | null;
  component(name: string): ValidateFunction;
}

export function createValidators(
  spec: JsonObject,
  table: RouteTable,
): Validators {
  const paramsAjv = createAjv(spec, { coerce: true, strict: false });
  const bodyAjv = createAjv(spec, { coerce: false, strict: false });
  const strictAjv = createAjv(spec, { coerce: false, strict: true });

  const requestValidators = new Map<string, RequestValidator>();
  for (const route of table.routes) {
    const path = paramsAjv.compile(parametersObject(route, "path"));
    const query = paramsAjv.compile(parametersObject(route, "query"));
    const body = route.body
      ? bodyAjv.compile(pointAtSpec(route.body.schema))
      : null;
    const fail = (
      location: ValidationFailure["location"],
      check: ValidateFunction,
    ): ValidationFailure => {
      const errors = check.errors ?? [];
      return {
        location,
        errors,
        message: paramsAjv.errorsText(errors, { dataVar: location }),
      };
    };
    requestValidators.set(route.operationId, {
      validate(request) {
        if (!path(request.path)) return fail("path", path);
        if (!query(request.query)) return fail("query", query);
        if (body === null) return null;
        if (request.body === undefined) {
          if (!route.body?.required) return null;
          return {
            location: "body",
            errors: [],
            message: "body is required",
          };
        }
        return body(request.body) ? null : fail("body", body);
      },
    });
  }

  const responseValidators = new Map<string, ValidateFunction | null>();
  return {
    request(route) {
      const validator = requestValidators.get(route.operationId);
      if (!validator) throw new Error(`no validator for ${route.operationId}`);
      return validator;
    },
    response(route, status) {
      const key = `${route.operationId}:${status}`;
      if (!responseValidators.has(key)) {
        const schema = route.responses.get(status)?.schema ?? null;
        responseValidators.set(
          key,
          schema === null
            ? null
            : strictAjv.compile(
                pointAtSpec(forbidUndocumentedProperties(schema)),
              ),
        );
      }
      return responseValidators.get(key) ?? null;
    },
    component(name) {
      return strictAjv.compile({
        $ref: `${SPEC_ID}#/components/responses/${name}/content/application~1json/schema`,
      });
    },
  };
}
