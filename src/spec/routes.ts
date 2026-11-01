import {
  isNotServedOperationId,
  isServedOperationId,
  ownerOf,
  type BearerOperationId,
  type Domain,
  type PublicOperationId,
} from "../operations";
import { deref, isJsonObject, type Json, type JsonObject } from "./json";
import { SCOPES, type Scope } from "./scopes";

export const API_BASE = "/api/v2";

const METHODS = ["get", "post", "put", "patch", "delete"] as const;
export type HttpMethod = (typeof METHODS)[number];

export type ParameterLocation = "path" | "query";

export interface ParameterSpec {
  readonly name: string;
  readonly in: ParameterLocation;
  readonly required: boolean;
  readonly schema: JsonObject;
}

export interface BodySpec {
  readonly required: boolean;
  readonly contentType:
    | "application/json"
    | "application/x-www-form-urlencoded";
  readonly schema: JsonObject;
}

export interface ResponseSpec {
  readonly status: number;
  readonly component: string | null;
  readonly schema: JsonObject | null;
}

interface RouteBase {
  readonly method: HttpMethod;
  readonly specPath: string;
  readonly honoPath: string;
  readonly owner: Domain;
  readonly parameters: readonly ParameterSpec[];
  readonly body: BodySpec | null;
  readonly responses: ReadonlyMap<number, ResponseSpec>;
}

export interface PublicRoute extends RouteBase {
  readonly access: "public";
  readonly operationId: PublicOperationId;
}

export interface BearerRoute extends RouteBase {
  readonly access: "bearer";
  readonly operationId: BearerOperationId;
  readonly scope: Scope;
}

export type RouteEntry = PublicRoute | BearerRoute;

export interface RouteTable {
  readonly routes: readonly RouteEntry[];
  readonly byOperationId: ReadonlyMap<string, RouteEntry>;
  readonly byPath: ReadonlyMap<string, readonly RouteEntry[]>;
}

function isMethod(key: string): key is HttpMethod {
  return METHODS.some((method) => method === key);
}

function toHonoPath(specPath: string): string {
  return API_BASE + specPath.replaceAll(/\{([^}]+)\}/g, ":$1");
}

function readParameters(
  spec: JsonObject,
  pathLevel: Json | undefined,
  operationLevel: Json | undefined,
): ParameterSpec[] {
  const merged = new Map<string, ParameterSpec>();
  for (const list of [pathLevel, operationLevel]) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const parameter = deref(spec, item);
      if (!isJsonObject(parameter)) continue;
      const location = parameter.in;
      if (location !== "path" && location !== "query") continue;
      if (typeof parameter.name !== "string") continue;
      const schema = deref(spec, parameter.schema);
      merged.set(`${location}:${parameter.name}`, {
        name: parameter.name,
        in: location,
        required: parameter.required === true,
        schema: isJsonObject(schema) ? schema : {},
      });
    }
  }
  return [...merged.values()];
}

function readBody(spec: JsonObject, raw: Json | undefined): BodySpec | null {
  const body = deref(spec, raw);
  if (!isJsonObject(body) || !isJsonObject(body.content)) return null;
  for (const contentType of [
    "application/json",
    "application/x-www-form-urlencoded",
  ] as const) {
    const media = body.content[contentType];
    if (!isJsonObject(media)) continue;
    const schema = deref(spec, media.schema);
    return {
      required: body.required === true,
      contentType,
      schema: isJsonObject(schema) ? schema : {},
    };
  }
  throw new Error(
    `unsupported request content ${Object.keys(body.content).join(", ")}`,
  );
}

function readResponses(
  spec: JsonObject,
  raw: Json | undefined,
): Map<number, ResponseSpec> {
  const responses = new Map<number, ResponseSpec>();
  if (!isJsonObject(raw)) return responses;
  for (const [statusText, item] of Object.entries(raw)) {
    const status = Number(statusText);
    const component =
      isJsonObject(item) && typeof item.$ref === "string"
        ? (item.$ref.split("/").at(-1) ?? null)
        : null;
    const response = deref(spec, item);
    const media =
      isJsonObject(response) && isJsonObject(response.content)
        ? response.content["application/json"]
        : undefined;
    const schema = isJsonObject(media) ? media.schema : undefined;
    responses.set(status, {
      status,
      component,
      schema: isJsonObject(schema) ? schema : null,
    });
  }
  return responses;
}

export function buildRouteTable(spec: JsonObject): RouteTable {
  const routes: RouteEntry[] = [];
  const paths = spec.paths;
  if (!isJsonObject(paths)) throw new Error("the spec has no paths");
  for (const [specPath, item] of Object.entries(paths)) {
    if (!isJsonObject(item)) continue;
    for (const [key, operation] of Object.entries(item)) {
      if (!isMethod(key) || !isJsonObject(operation)) continue;
      const operationId = operation.operationId;
      if (typeof operationId !== "string") {
        throw new Error(`${key} ${specPath} has no operationId`);
      }
      if (isNotServedOperationId(operationId)) continue;
      const owner = ownerOf(operationId);
      if (owner === undefined || !isServedOperationId(operationId)) {
        throw new Error(`${operationId} has no owning domain`);
      }
      const base: RouteBase = {
        method: key,
        specPath,
        honoPath: toHonoPath(specPath),
        owner,
        parameters: readParameters(spec, item.parameters, operation.parameters),
        body: readBody(spec, operation.requestBody),
        responses: readResponses(spec, operation.responses),
      };
      routes.push(
        operationId === "getAccessToken"
          ? { ...base, access: "public", operationId }
          : {
              ...base,
              access: "bearer",
              operationId,
              scope: SCOPES[operationId],
            },
      );
    }
  }
  const byPath = new Map<string, RouteEntry[]>();
  for (const route of routes) {
    byPath.set(route.honoPath, [...(byPath.get(route.honoPath) ?? []), route]);
  }
  return {
    routes,
    byOperationId: new Map(routes.map((route) => [route.operationId, route])),
    byPath,
  };
}
