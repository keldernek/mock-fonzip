import type { ValidateFunction } from "ajv";

import type { HandlerResult } from "../api/handler";
import { createMockFonzip, type MockFonzip, type MockOptions } from "../app";
import type { ClientCredentials } from "../auth/tenancy";
import { manualClock } from "../core/clock";
import type { ServedOperationId } from "../operations";
import type { Json } from "../spec/json";
import { API_BASE, type RouteEntry } from "../spec/routes";
import { specRuntime } from "../spec/runtime";
import { createContractObserver } from "./contract";
import { sampleValue } from "./sample";

export type QueryValue =
  | string
  | number
  | boolean
  | readonly (string | number)[];

export interface CallInput {
  readonly path?: Readonly<Record<string, string | number>>;
  readonly query?: Readonly<Record<string, QueryValue>>;
  readonly body?: unknown;
  readonly token?: string | null;
  readonly method?: string;
}

export interface CallResponse {
  readonly route: RouteEntry;
  readonly status: number;
  readonly body: unknown;
}

export interface SampleRequest {
  path: Record<string, string | number>;
  query: Record<string, QueryValue>;
  body: Json | undefined;
}

export function routeOf(operationId: ServedOperationId): RouteEntry {
  const route = specRuntime().table.byOperationId.get(operationId);
  if (!route) throw new Error(`no route for ${operationId}`);
  return route;
}

function scalarText(value: Json): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function asQueryValue(value: Json): QueryValue {
  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === "number" ? item : scalarText(item),
    );
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  return scalarText(value);
}

export function sampleRequest(route: RouteEntry): SampleRequest {
  const request: SampleRequest = { path: {}, query: {}, body: undefined };
  for (const parameter of route.parameters) {
    if (!parameter.required) continue;
    const value = sampleValue(parameter.schema);
    if (parameter.in === "path") {
      request.path[parameter.name] =
        typeof value === "number" ? value : scalarText(value);
    } else {
      request.query[parameter.name] = asQueryValue(value);
    }
  }
  if (route.body?.required) request.body = sampleValue(route.body.schema);
  return request;
}

export function buildUrl(route: RouteEntry, input: CallInput): string {
  const path = route.specPath.replaceAll(/\{([^}]+)\}/g, (whole, name) => {
    const value = typeof name === "string" ? input.path?.[name] : undefined;
    return value === undefined ? whole : encodeURIComponent(String(value));
  });
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(input.query ?? {})) {
    for (const item of Array.isArray(value) ? value : [value]) {
      search.append(name, String(item));
    }
  }
  const query = search.size > 0 ? `?${search.toString()}` : "";
  return `${API_BASE}${path}${query}`;
}

export type OkBody<K extends ServedOperationId> = Extract<
  HandlerResult<K>,
  { status: 200 }
>["body"];

function conforms<K extends ServedOperationId>(
  validate: ValidateFunction,
  _operationId: K,
  body: unknown,
): body is OkBody<K> {
  return validate(body);
}

export interface TestClient {
  readonly mock: MockFonzip;
  request(path: string, init?: RequestInit): Promise<Response>;
  token(credentials?: ClientCredentials): Promise<string>;
  call(
    operationId: ServedOperationId,
    input?: CallInput,
  ): Promise<CallResponse>;
  ok<K extends ServedOperationId>(
    operationId: K,
    input?: CallInput,
  ): Promise<OkBody<K>>;
}

export function createTestClient(options: MockOptions = {}): TestClient {
  const contract = createContractObserver();
  const mock = createMockFonzip({
    clock: manualClock(),
    ...options,
    observe: (exchange) => contract.observe(exchange),
  });
  const request = async (
    path: string,
    init?: RequestInit,
  ): Promise<Response> => {
    const response = await mock.app.request(path, init);
    const violations = contract.takeViolations();
    if (violations.length > 0) {
      throw new Error(`contract violation:\n${violations.join("\n")}`);
    }
    return response;
  };
  let defaultToken: string | undefined;

  const token = async (
    credentials: ClientCredentials = mock.runtime.credentials.readWrite,
  ): Promise<string> => {
    const response = await request(`${API_BASE}/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
      }),
    });
    const body: unknown = await response.json();
    const accessToken = readField(body, "access_token");
    if (response.status !== 200 || typeof accessToken !== "string") {
      throw new Error(`token request failed: ${response.status}`);
    }
    return accessToken;
  };

  const call = async (
    operationId: ServedOperationId,
    input: CallInput = {},
  ): Promise<CallResponse> => {
    const route = routeOf(operationId);
    const headers = new Headers();
    let bearer = input.token;
    if (bearer === undefined && route.access === "bearer") {
      defaultToken ??= await token();
      bearer = defaultToken;
    }
    if (bearer) headers.set("authorization", `Bearer ${bearer}`);
    let body: string | URLSearchParams | undefined;
    if (input.body !== undefined) {
      if (route.body?.contentType === "application/x-www-form-urlencoded") {
        headers.set("content-type", "application/x-www-form-urlencoded");
        body = new URLSearchParams(
          Object.entries(isRecord(input.body) ? input.body : {}).map(
            ([key, value]): [string, string] => [
              key,
              typeof value === "string" ? value : JSON.stringify(value),
            ],
          ),
        );
      } else {
        headers.set("content-type", "application/json");
        body = JSON.stringify(input.body);
      }
    }
    const response = await request(buildUrl(route, input), {
      method: (input.method ?? route.method).toUpperCase(),
      headers,
      body,
    });
    const text = await response.text();
    const parsed: unknown = text === "" ? undefined : JSON.parse(text);
    return { route, status: response.status, body: parsed };
  };

  const ok = async <K extends ServedOperationId>(
    operationId: K,
    input: CallInput = {},
  ): Promise<OkBody<K>> => {
    const response = await call(operationId, input);
    if (response.status !== 200) {
      throw new Error(
        `${operationId} answered ${response.status}: ${JSON.stringify(response.body)}`,
      );
    }
    const validate = specRuntime().validators.response(response.route, 200);
    if (!validate) throw new Error(`${operationId} documents no 200 body`);
    if (!conforms(validate, operationId, response.body)) {
      throw new Error(
        `${operationId} 200 body breaks its schema: ${JSON.stringify(validate.errors)}`,
      );
    }
    return response.body;
  };

  return { mock, request, token, call, ok };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readField(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}
