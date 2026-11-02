import createClient, { type Client, type ClientOptions } from "openapi-fetch";

import type { paths } from "./generated/api.js";

export * from "./generated/api.js";
export * from "./generated/operations.js";

export const FONZIP_BASE_URL = "https://fonzip.com/api/v2";

export interface TokenAuth {
  readonly token: string;
  readonly clientId?: never;
  readonly clientSecret?: never;
}

export interface ClientCredentialsAuth {
  readonly token?: never;
  readonly clientId: string;
  readonly clientSecret: string;
}

export type FonzipAuth = TokenAuth | ClientCredentialsAuth;

export interface FonzipClientOptions extends ClientOptions {
  readonly auth: FonzipAuth;
}

export type FonzipClient = Client<paths>;

type Fetch = (
  request: Request,
  init?: Record<string, unknown>,
) => Promise<Response>;

type Issued =
  | { readonly token: string; readonly refused?: never }
  | { readonly token?: never; readonly refused: Response };

function bearer(request: Request, token: string): void {
  request.headers.set("Authorization", `Bearer ${token}`);
}

async function requestToken(
  send: Fetch,
  init: Record<string, unknown> | undefined,
  baseUrl: string,
  { clientId, clientSecret }: ClientCredentialsAuth,
): Promise<Issued> {
  const response = await send(
    new Request(`${baseUrl}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    }),
    init,
  );
  if (!response.ok) return { refused: response };
  const body: unknown = await response
    .clone()
    .json()
    .catch(() => null);
  const token =
    typeof body === "object" && body !== null && "access_token" in body
      ? body.access_token
      : undefined;
  return typeof token === "string" ? { token } : { refused: response };
}

function clientCredentials(
  send: Fetch,
  baseUrl: string,
  auth: ClientCredentialsAuth,
): Fetch {
  let current: Promise<Issued> | undefined;
  const issue = (init: Record<string, unknown> | undefined) => {
    if (current) return current;
    const issued = requestToken(send, init, baseUrl, auth);
    current = issued;
    issued.then(
      (result) => {
        if (result.refused && current === issued) current = undefined;
      },
      () => {
        if (current === issued) current = undefined;
      },
    );
    return issued;
  };
  return async (request, init) => {
    // Sending a request consumes its body, so the retry is copied first.
    const retry = request.clone();
    const issued = issue(init);
    const first = await issued;
    if (first.refused) return first.refused;
    bearer(request, first.token);
    const response = await send(request, init);
    if (response.status !== 401) return response;
    await response.body?.cancel();
    if (current === issued) current = undefined;
    const second = await issue(init);
    if (second.refused) return second.refused;
    bearer(retry, second.token);
    return send(retry, init);
  };
}

function fixedToken(send: Fetch, token: string): Fetch {
  return (request, init) => {
    bearer(request, token);
    return send(request, init);
  };
}

/**
 * Auth wraps `fetch` rather than using middleware, so a consumer's own
 * middleware sees every attempt as one authenticated exchange. With client
 * credentials the client requests a token on first use, reuses it, and on a
 * 401 requests a new one and retries the call once. A refused token request
 * is returned as the call's response, so it surfaces as `{ error, response }`.
 */
export function createFonzipClient({
  auth,
  baseUrl = FONZIP_BASE_URL,
  fetch: send = globalThis.fetch,
  ...options
}: FonzipClientOptions): FonzipClient {
  // openapi-fetch types `fetch` with one parameter but calls it with
  // `requestInitExt` as a second, so the wrapper passes it on the same way.
  const inner = send as Fetch;
  return createClient<paths>({
    ...options,
    baseUrl,
    fetch:
      auth.token === undefined
        ? clientCredentials(inner, baseUrl, auth)
        : fixedToken(inner, auth.token),
  });
}
