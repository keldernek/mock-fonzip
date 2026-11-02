import type { ClientCredentials } from "../auth/tenancy";
import type { ServedOperationId } from "../operations";
import { SCOPES } from "../spec/scopes";
import {
  buildUrl,
  createTestClient,
  routeOf,
  type CallInput,
} from "../testing/client";
import { isRecord } from "./shape";

export interface Exchange {
  readonly status: number;
  readonly body: unknown;
  // Set when the response was not JSON; holds its content type.
  readonly nonJson?: string;
}

export interface Target {
  call(operationId: ServedOperationId, input: CallInput): Promise<Exchange>;
  now(): Date;
}

// The only operations that may leave GET: the token exchange and the
// read-scoped user search. Everything else must be a GET.
const READING_POSTS = new Set<ServedOperationId>([
  "getAccessToken",
  "getUserList",
]);

// GETs that still change something on production.
export const NEVER_CALLED = new Set<ServedOperationId>([
  // Creates a working login link for a member.
  "generateLoginLinkForUser",
]);

export class RefusedRequestError extends Error {}

// Throws for any request that could write to production. The prod target
// runs this before every request, so a plan change cannot slip a write
// through.
export function assertReadOnly(
  operationId: ServedOperationId,
  method?: string,
): void {
  const route = routeOf(operationId);
  const verb = (method ?? route.method).toUpperCase();
  const refuse = (why: string): never => {
    throw new RefusedRequestError(
      `refusing ${verb} ${operationId}: ${why}; the prod parity runner only reads`,
    );
  };
  if (NEVER_CALLED.has(operationId)) refuse("it changes production state");
  if (route.access === "bearer" && SCOPES[route.operationId] !== "read") {
    refuse("it needs the write scope");
  }
  if (verb === "GET") return;
  if (
    verb === "POST" &&
    route.method === "post" &&
    READING_POSTS.has(operationId)
  ) {
    return;
  }
  refuse(`${verb} is not allowed for it`);
}

export type ProdAuth =
  | { readonly kind: "token"; readonly token: string }
  | { readonly kind: "credentials"; readonly credentials: ClientCredentials };

export interface ProdOptions {
  readonly origin: string;
  readonly auth: ProdAuth;
  readonly fetch?: (request: Request) => Promise<Response>;
  readonly now?: () => Date;
  readonly pauseMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly log?: (line: string) => void;
}

export interface ProdConnection {
  readonly target: Target;
  // The token response, when this run minted the token.
  readonly minted: Exchange | null;
}

export class ProdUnavailableError extends Error {}

const MAX_RETRY_WAIT_S = 65;

function encodeBody(
  operationId: ServedOperationId,
  body: unknown,
): { contentType: string; text: string } | null {
  if (body === undefined) return null;
  const route = routeOf(operationId);
  if (route.body?.contentType === "application/x-www-form-urlencoded") {
    const pairs = Object.entries(isRecord(body) ? body : {}).map(
      ([key, value]): [string, string] => [
        key,
        typeof value === "string" ? value : JSON.stringify(value),
      ],
    );
    return {
      contentType: "application/x-www-form-urlencoded",
      text: new URLSearchParams(pairs).toString(),
    };
  }
  return { contentType: "application/json", text: JSON.stringify(body) };
}

async function readExchange(response: Response): Promise<Exchange> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  if (text === "") return { status: response.status, body: undefined };
  try {
    const body: unknown = JSON.parse(text);
    return { status: response.status, body };
  } catch {
    return {
      status: response.status,
      body: undefined,
      nonJson: contentType === "" ? "no content type" : contentType,
    };
  }
}

// Network errors can carry the URL, and a URL can carry an email address, so
// only the error's name and code are kept.
function networkFailure(operationId: string, error: unknown): Error {
  const name = error instanceof Error ? error.name : "unknown error";
  const code =
    isRecord(error) && typeof error.code === "string" ? ` ${error.code}` : "";
  return new ProdUnavailableError(
    `could not reach production for ${operationId} (${name}${code})`,
  );
}

export async function connectProd(
  options: ProdOptions,
): Promise<ProdConnection> {
  const send = options.fetch ?? ((request: Request) => fetch(request));
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const pauseMs = options.pauseMs ?? 350;
  const log = options.log ?? (() => {});
  const origin = options.origin.replace(/\/+$/, "");
  let lastSent = 0;
  let token = options.auth.kind === "token" ? options.auth.token : "";

  const request = async (
    operationId: ServedOperationId,
    input: CallInput,
  ): Promise<Exchange> => {
    const route = routeOf(operationId);
    assertReadOnly(operationId, input.method);
    const headers = new Headers({ accept: "application/json" });
    let bearer = input.token;
    if (bearer === undefined && route.access === "bearer") bearer = token;
    if (bearer) headers.set("authorization", `Bearer ${bearer}`);
    const encoded = encodeBody(operationId, input.body);
    if (encoded) headers.set("content-type", encoded.contentType);
    const method = (input.method ?? route.method).toUpperCase();
    for (let attempt = 0; ; attempt += 1) {
      const wait = lastSent + pauseMs - Date.now();
      if (wait > 0) await sleep(wait);
      lastSent = Date.now();
      let response: Response;
      try {
        response = await send(
          new Request(`${origin}${buildUrl(route, input)}`, {
            method,
            headers,
            body: encoded?.text,
            // A followed redirect would re-send the token request's form
            // body, client secret included, to wherever Location points. A
            // 3xx comes back as an ordinary status instead.
            redirect: "manual",
          }),
        );
      } catch (error) {
        throw networkFailure(operationId, error);
      }
      if (response.status !== 429 || attempt > 0) {
        return readExchange(response);
      }
      await response.body?.cancel();
      const retryAfter = Number(response.headers.get("retry-after"));
      const seconds =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter, MAX_RETRY_WAIT_S)
          : MAX_RETRY_WAIT_S;
      log(
        `rate limited on ${operationId}; waiting ${seconds}s, then retrying once`,
      );
      await sleep(seconds * 1000);
    }
  };

  let minted: Exchange | null = null;
  if (options.auth.kind === "credentials") {
    minted = await request("getAccessToken", {
      body: {
        grant_type: "client_credentials",
        client_id: options.auth.credentials.clientId,
        client_secret: options.auth.credentials.clientSecret,
      },
    });
    const accessToken = isRecord(minted.body)
      ? minted.body.access_token
      : undefined;
    if (minted.status !== 200 || typeof accessToken !== "string") {
      throw new ProdUnavailableError(
        `production refused the token request with status ${minted.status}`,
      );
    }
    token = accessToken;
  }

  return {
    minted,
    target: {
      call: request,
      now: options.now ?? (() => new Date()),
    },
  };
}

export interface MockTarget extends Target {
  readonly credentials: ClientCredentials;
}

// The in-process mock, seeded exactly as `bun run dev` seeds it. Its calls
// throw when the mock breaks its own contract.
export function mockTarget(): MockTarget {
  const client = createTestClient();
  return {
    async call(operationId, input) {
      const response = await client.call(operationId, input);
      return { status: response.status, body: response.body };
    },
    now: () => client.mock.runtime.clock.now(),
    credentials: client.mock.runtime.credentials.readWrite,
  };
}
