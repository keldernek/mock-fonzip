import createClient, {
  type Client,
  type ClientOptions,
  type MergedOptions,
  type Middleware,
} from "openapi-fetch";

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

function bearer(request: Request, token: string): void {
  request.headers.set("Authorization", `Bearer ${token}`);
}

async function requestToken(
  { fetch, baseUrl }: MergedOptions,
  { clientId, clientSecret }: ClientCredentialsAuth,
): Promise<string> {
  const response = await fetch(
    new Request(`${baseUrl}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    }),
  );
  const body: unknown = await response.json().catch(() => null);
  const token =
    typeof body === "object" && body !== null && "access_token" in body
      ? body.access_token
      : undefined;
  if (!response.ok || typeof token !== "string") {
    throw new Error(`Fonzip token request failed with HTTP ${response.status}`);
  }
  return token;
}

function clientCredentials(auth: ClientCredentialsAuth): Middleware {
  let current: Promise<string> | undefined;
  const token = (options: MergedOptions): Promise<string> => {
    if (current) return current;
    const issued = requestToken(options, auth);
    current = issued;
    issued.catch(() => {
      if (current === issued) current = undefined;
    });
    return issued;
  };
  // Sending a request consumes its body, so a retry needs a copy made first.
  const sent = new Map<
    string,
    { readonly issued: Promise<string>; readonly retry: Request }
  >();
  return {
    async onRequest({ request, options, id }) {
      const issued = token(options);
      bearer(request, await issued);
      sent.set(id, { issued, retry: request.clone() });
    },
    async onResponse({ response, options, id }) {
      const attempt = sent.get(id);
      sent.delete(id);
      if (response.status !== 401 || attempt === undefined) return undefined;
      await response.body?.cancel();
      if (current === attempt.issued) current = undefined;
      bearer(attempt.retry, await token(options));
      return options.fetch(attempt.retry);
    },
    onError({ id }) {
      sent.delete(id);
    },
  };
}

/**
 * With client credentials the client requests a token on first use, reuses
 * it, and on a 401 requests a new one and retries the call once.
 */
export function createFonzipClient({
  auth,
  baseUrl = FONZIP_BASE_URL,
  ...options
}: FonzipClientOptions): FonzipClient {
  const client = createClient<paths>({ ...options, baseUrl });
  client.use(
    auth.token === undefined
      ? clientCredentials(auth)
      : { onRequest: ({ request }) => bearer(request, auth.token) },
  );
  return client;
}
