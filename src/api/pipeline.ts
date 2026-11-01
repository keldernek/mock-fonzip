import type { Context, Hono } from "hono";

import { hasScope, type ApiKey, type Tenancy } from "../auth/tenancy";
import type { TokenService } from "../auth/tokens";
import type { Clock } from "../core/clock";
import type { Rng } from "../core/rng";
import {
  TOKEN_METHOD_NOT_ALLOWED,
  tokenRequestRejected,
} from "../domains/foundation/token";
import { bearerHandlers, tokenHandler } from "../handlers";
import type { BearerOperationId } from "../operations";
import {
  API_BASE,
  type BearerRoute,
  type PublicRoute,
  type RouteEntry,
  type RouteTable,
} from "../spec/routes";
import type { RequestValidator, Validators } from "../spec/validation";
import type { HandlerContext, HandlerInput, HandlerResult } from "./handler";
import { errorBody, json } from "./errors";
import type { RateLimiter } from "./rate-limit";
import { orgStore, type Store } from "../store/store";
import type { WebhookEmitter } from "../webhooks/emitter";

export interface PipelineDeps {
  readonly table: RouteTable;
  readonly validators: Validators;
  readonly tenancy: Tenancy;
  readonly tokens: TokenService;
  readonly clock: Clock;
  world(): {
    readonly store: Store;
    readonly rng: Rng;
    readonly limiter: RateLimiter;
    readonly webhooks: WebhookEmitter;
  };
}

interface RawRequest {
  path: Record<string, unknown>;
  query: Record<string, unknown>;
  body: unknown;
}

type ParsedBody = { ok: true; body: unknown } | { ok: false };

async function readJsonBody(c: Context): Promise<ParsedBody> {
  const text = await c.req.text();
  if (text.trim() === "") return { ok: true, body: undefined };
  try {
    const body: unknown = JSON.parse(text);
    return { ok: true, body };
  } catch {
    return { ok: false };
  }
}

async function readFormBody(c: Context): Promise<Record<string, string>> {
  const form = new URLSearchParams(await c.req.text());
  return Object.fromEntries(form.entries());
}

function readQuery(c: Context, route: RouteEntry): Record<string, unknown> {
  const all = c.req.queries();
  const query: Record<string, unknown> = {};
  for (const parameter of route.parameters) {
    if (parameter.in !== "query") continue;
    const values = all[parameter.name];
    if (values === undefined || values.length === 0) continue;
    query[parameter.name] =
      parameter.schema.type === "array" || values.length > 1
        ? values
        : values[0];
  }
  return query;
}

function readPath(c: Context, route: RouteEntry): Record<string, unknown> {
  const params = c.req.param();
  const path: Record<string, unknown> = {};
  for (const parameter of route.parameters) {
    if (parameter.in !== "path") continue;
    const value = params[parameter.name];
    if (value !== undefined) path[parameter.name] = decodeURIComponent(value);
  }
  return path;
}

function bearerToken(c: Context): string | null {
  const header = c.req.header("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1] ?? null;
}

function validatedInput<K extends BearerOperationId>(
  _operationId: K,
  validator: RequestValidator,
  raw: RawRequest,
): { ok: true; input: HandlerInput<K> } | { ok: false; message: string } {
  const failure = validator.validate(raw);
  if (failure) return { ok: false, message: failure.message };
  // The validator checked raw against operation K's parameter and body schemas.
  const input = raw as unknown as HandlerInput<K>;
  return { ok: true, input };
}

async function invoke<K extends BearerOperationId>(
  operationId: K,
  input: HandlerInput<K>,
  ctx: HandlerContext,
): Promise<HandlerResult<K>> {
  const handler = bearerHandlers[operationId];
  return handler(input, ctx);
}

export function mountApi(app: Hono, deps: PipelineDeps): void {
  const documents = (route: RouteEntry, status: number): boolean =>
    route.responses.has(status);

  async function handlePublic(
    c: Context,
    route: PublicRoute,
  ): Promise<Response> {
    const form = await readFormBody(c);
    if (!deps.world().limiter.hit(`token|${form.client_id ?? ""}`)) {
      return json(errorBody(429), 429);
    }
    const raw: RawRequest = { path: {}, query: {}, body: form };
    const failure = deps.validators.request(route).validate(raw);
    if (failure) {
      const rejected = tokenRequestRejected(failure);
      return json(rejected.body, rejected.status);
    }
    const result = tokenHandler(
      {
        path: {},
        query: {},
        body: {
          grant_type:
            form.grant_type === "authorization_code" ||
            form.grant_type === "refresh_token"
              ? form.grant_type
              : "client_credentials",
          client_id: form.client_id ?? "",
          client_secret: form.client_secret ?? "",
        },
      },
      { tenancy: deps.tenancy, tokens: deps.tokens },
    );
    return json(result.body, result.status);
  }

  async function handleBearer(
    c: Context,
    route: BearerRoute,
  ): Promise<Response> {
    const token = bearerToken(c);
    const apiKey: ApiKey | null = token ? deps.tokens.resolve(token) : null;
    if (!apiKey) return json(errorBody(401), 401);
    if (documents(route, 402) && deps.tenancy.plan(apiKey.org) !== "active") {
      return json(errorBody(402), 402);
    }
    if (documents(route, 403) && !hasScope(apiKey, route.scope)) {
      return json(errorBody(403), 403);
    }
    const limitKey = `${apiKey.id}|${apiKey.org}|${route.operationId}`;
    if (!deps.world().limiter.hit(limitKey)) return json(errorBody(429), 429);

    let body: unknown;
    if (route.body) {
      const parsed = await readJsonBody(c);
      if (!parsed.ok) {
        return json({ error: `${errorBody(400).error}: malformed JSON` }, 400);
      }
      body = parsed.body;
    }
    const raw: RawRequest = {
      path: readPath(c, route),
      query: readQuery(c, route),
      body,
    };
    const validated = validatedInput(
      route.operationId,
      deps.validators.request(route),
      raw,
    );
    if (!validated.ok) {
      return json(
        { error: `${errorBody(400).error}: ${validated.message}` },
        400,
      );
    }
    const world = deps.world();
    const ctx: HandlerContext = {
      org: deps.tenancy.organisation(apiKey.org),
      apiKey,
      store: orgStore(world.store, apiKey.org),
      clock: deps.clock,
      rng: world.rng,
      webhooks: world.webhooks.forOrg(apiKey.org),
    };
    const result = await invoke(route.operationId, validated.input, ctx);
    return json(result.body, result.status);
  }

  for (const [honoPath, routes] of deps.table.byPath) {
    app.all(honoPath, async (c) => {
      const method = c.req.method.toLowerCase();
      const route = routes.find((candidate) => candidate.method === method);
      if (!route) {
        const isTokenPath = routes.some((r) => r.access === "public");
        return json(
          isTokenPath ? TOKEN_METHOD_NOT_ALLOWED : errorBody(405),
          405,
        );
      }
      return route.access === "public"
        ? handlePublic(c, route)
        : handleBearer(c, route);
    });
  }
  app.all(`${API_BASE}/*`, () => json(errorBody(404), 404));
}
