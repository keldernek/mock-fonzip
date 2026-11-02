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
import { orgStore, type Store } from "../store/store";
import type { WebhookEmitter } from "../webhooks/emitter";
import { errorBody, json } from "./errors";
import { productionValidationMessage } from "./production-messages";
import type { HandlerContext, HandlerInput, HandlerResult } from "./handler";
import type { RateLimiter } from "./rate-limit";

export interface RawRequest {
  path: Record<string, unknown>;
  query: Record<string, unknown>;
  body: unknown;
}

export type Exchange =
  | {
      readonly kind: "operation";
      readonly route: RouteEntry;
      readonly handled: boolean;
      readonly request: RawRequest;
      readonly status: number;
      readonly body: unknown;
    }
  | {
      readonly kind: "method-not-allowed";
      readonly routes: readonly RouteEntry[];
      readonly status: 405;
      readonly body: unknown;
    }
  | {
      readonly kind: "unknown-path";
      readonly status: 404;
      readonly body: unknown;
    };

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
  readonly observe?: (exchange: Exchange) => void;
}

interface Outcome {
  readonly status: number;
  readonly body: unknown;
  readonly handled: boolean;
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
  operationId: K,
  validator: RequestValidator,
  raw: RawRequest,
): { ok: true; input: HandlerInput<K> } | { ok: false; error: string } {
  const failure = validator.validate(raw);
  if (failure) {
    return {
      ok: false,
      error:
        productionValidationMessage(operationId, failure) ??
        `${errorBody(400).error}: ${failure.message}`,
    };
  }
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

const gate = (status: 401 | 402 | 403 | 429): Outcome => ({
  status,
  body: errorBody(status),
  handled: false,
});

export function mountApi(app: Hono, deps: PipelineDeps): void {
  const documents = (route: RouteEntry, status: number): boolean =>
    route.responses.has(status);

  const respond = (
    route: RouteEntry,
    request: RawRequest,
    outcome: Outcome,
  ): Response => {
    deps.observe?.({ kind: "operation", route, request, ...outcome });
    return json(outcome.body, outcome.status);
  };

  async function handlePublic(
    c: Context,
    route: PublicRoute,
  ): Promise<Response> {
    const form = await readFormBody(c);
    const raw: RawRequest = { path: {}, query: {}, body: form };
    if (!deps.world().limiter.hit(`token|${form.client_id ?? ""}`)) {
      return respond(route, raw, {
        status: 429,
        body: errorBody(429),
        handled: false,
      });
    }
    const failure = deps.validators.request(route).validate(raw);
    if (failure) {
      const rejected = tokenRequestRejected(failure);
      return respond(route, raw, { ...rejected, handled: true });
    }
    const grantType = form.grant_type;
    const result = tokenHandler(
      {
        path: {},
        query: {},
        body: {
          grant_type:
            grantType === "authorization_code" || grantType === "refresh_token"
              ? grantType
              : "client_credentials",
          client_id: form.client_id ?? "",
          client_secret: form.client_secret ?? "",
        },
      },
      { tenancy: deps.tenancy, tokens: deps.tokens },
    );
    return respond(route, raw, { ...result, handled: true });
  }

  async function bearerOutcome(
    c: Context,
    route: BearerRoute,
    raw: RawRequest,
  ): Promise<Outcome> {
    const token = bearerToken(c);
    const apiKey: ApiKey | null = token ? deps.tokens.resolve(token) : null;
    if (!apiKey) return gate(401);
    if (documents(route, 402) && deps.tenancy.plan(apiKey.org) !== "active") {
      return gate(402);
    }
    if (documents(route, 403) && !hasScope(apiKey, route.scope))
      return gate(403);
    const world = deps.world();
    if (!world.limiter.hit(`${apiKey.id}|${apiKey.org}|${route.operationId}`)) {
      return gate(429);
    }
    if (route.body) {
      const parsed = await readJsonBody(c);
      if (!parsed.ok) {
        return {
          status: 400,
          body: { error: `${errorBody(400).error}: malformed JSON` },
          handled: false,
        };
      }
      raw.body = parsed.body;
    }
    const validated = validatedInput(
      route.operationId,
      deps.validators.request(route),
      raw,
    );
    if (!validated.ok) {
      return {
        status: 400,
        body: { error: validated.error },
        handled: false,
      };
    }
    const ctx: HandlerContext = {
      org: deps.tenancy.organisation(apiKey.org),
      apiKey,
      store: orgStore(world.store, apiKey.org),
      clock: deps.clock,
      rng: world.rng,
      webhooks: world.webhooks.forOrg(apiKey.org),
    };
    const result = await invoke(route.operationId, validated.input, ctx);
    return { ...result, handled: true };
  }

  async function handleBearer(
    c: Context,
    route: BearerRoute,
  ): Promise<Response> {
    const raw: RawRequest = {
      path: readPath(c, route),
      query: readQuery(c, route),
      body: undefined,
    };
    const snapshot: RawRequest = {
      path: { ...raw.path },
      query: { ...raw.query },
      body: undefined,
    };
    const outcome = await bearerOutcome(c, route, raw);
    return respond(route, { ...snapshot, body: raw.body }, outcome);
  }

  for (const [honoPath, routes] of deps.table.byPath) {
    app.all(honoPath, async (c) => {
      const method = c.req.method.toLowerCase();
      const route = routes.find((candidate) => candidate.method === method);
      if (!route) {
        const isTokenPath = routes.some((r) => r.access === "public");
        const body = isTokenPath ? TOKEN_METHOD_NOT_ALLOWED : errorBody(405);
        deps.observe?.({
          kind: "method-not-allowed",
          routes,
          status: 405,
          body,
        });
        return json(body, 405);
      }
      return route.access === "public"
        ? handlePublic(c, route)
        : handleBearer(c, route);
    });
  }
  app.all(`${API_BASE}/*`, () => {
    const body = errorBody(404);
    deps.observe?.({ kind: "unknown-path", status: 404, body });
    return json(body, 404);
  });
}
