import { describe, expect, test } from "bun:test";

import {
  TOKEN_LIFETIME_SECONDS,
  TOKENS_KEPT_PER_KEY,
} from "../src/auth/tokens";
import { specRuntime } from "../src/spec/runtime";
import type { BearerRoute, RouteEntry } from "../src/spec/routes";
import {
  createTestClient,
  sampleRequest,
  type CallInput,
} from "../src/testing/client";

const UNLIMITED = { limit: 1_000_000, windowMs: 60_000 };
const bearerRoutes = specRuntime().table.routes.filter(
  (route): route is BearerRoute => route.access === "bearer",
);

function validInput(route: RouteEntry): CallInput {
  const sample = sampleRequest(route);
  return { path: sample.path, query: sample.query, body: sample.body };
}

describe("the token endpoint", () => {
  const form = (fields: Record<string, string>): RequestInit => ({
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });

  test("issues a bearer token for client credentials", async () => {
    const client = createTestClient();
    const { clientId, clientSecret } =
      client.mock.runtime.credentials.readWrite;
    const response = await client.request(
      "/api/v2/token",
      form({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    );
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(body).toEqual({
      access_token: expect.any(String),
      token_type: "Bearer",
      expires_in: 3600,
    });
  });

  test("answers each documented failure with its documented body", async () => {
    const client = createTestClient();
    const { clientId, clientSecret } =
      client.mock.runtime.credentials.readWrite;
    const lapsed = client.mock.runtime.credentials.lapsed;
    const cases: [string, RequestInit, number, unknown][] = [
      [
        "wrong secret",
        form({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: "nope",
        }),
        401,
        { error: "invalid_client", error_description: "Unauthorized Access" },
      ],
      [
        "unknown client",
        form({
          grant_type: "client_credentials",
          client_id: "nobody",
          client_secret: "x",
        }),
        401,
        { error: "invalid_client", error_description: "Unauthorized Access" },
      ],
      [
        "missing client_secret",
        form({ grant_type: "client_credentials", client_id: clientId }),
        401,
        { error: "invalid_client", error_description: "Unauthorized Access" },
      ],
      [
        "unsupported grant_type",
        form({
          grant_type: "password",
          client_id: clientId,
          client_secret: clientSecret,
        }),
        406,
        {
          error: "unsupported_grant_type",
          error_description: "Invalid grant_type parameter",
        },
      ],
      [
        "missing grant_type",
        form({ client_id: clientId, client_secret: clientSecret }),
        406,
        {
          error: "unsupported_grant_type",
          error_description: "Invalid grant_type parameter",
        },
      ],
      [
        "authorization_code grant",
        form({
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          code: "c",
        }),
        400,
        {
          error: "invalid_grant",
          error_description: "Invalid authorization code",
        },
      ],
      [
        "refresh_token grant",
        form({
          grant_type: "refresh_token",
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: "r",
        }),
        400,
        { error: "invalid_grant", error_description: "Invalid refresh token" },
      ],
      [
        "org without a valid plan",
        form({
          grant_type: "client_credentials",
          client_id: lapsed.clientId,
          client_secret: lapsed.clientSecret,
        }),
        402,
        {
          error: "invalid_grant",
          error_description:
            "Your account is not authorized to use the fonzip API",
        },
      ],
      [
        "GET instead of POST",
        { method: "GET" },
        405,
        { error: "invalid_request", error_description: "Invalid Request" },
      ],
    ];
    for (const [label, init, status, body] of cases) {
      const response = await client.request("/api/v2/token", init);
      expect(response.status, label).toBe(status);
      expect(await response.json(), label).toEqual(body);
    }
  });

  test("rate limits token requests per client", async () => {
    const client = createTestClient({
      rateLimit: { limit: 2, windowMs: 60_000 },
    });
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await client.request(
        "/api/v2/token",
        form({
          grant_type: "client_credentials",
          client_id: "nobody",
          client_secret: "x",
        }),
      );
      statuses.push(response.status);
    }
    expect(statuses).toEqual([401, 401, 429]);
  });
});

describe("the bearer pipeline, for every operation", () => {
  test("rejects a request without a token with 401", async () => {
    const client = createTestClient({ rateLimit: UNLIMITED });
    for (const route of bearerRoutes) {
      const response = await client.call(route.operationId, {
        ...validInput(route),
        token: null,
      });
      expect(response.status, `${route.operationId} without a token`).toBe(401);
      expect(response.body).toEqual({ error: "Unauthorized Access" });
    }
  });

  test("rejects an expired token with 401", async () => {
    const client = createTestClient({ rateLimit: UNLIMITED });
    const token = await client.token();
    client.mock.runtime.clock.advance(TOKEN_LIFETIME_SECONDS * 1000 - 1);
    const stillValid = await client.call("getMe", { token });
    expect(stillValid.status, "a token one millisecond before expiry").toBe(
      200,
    );
    client.mock.runtime.clock.advance(1);
    for (const route of bearerRoutes) {
      const response = await client.call(route.operationId, {
        ...validInput(route),
        token,
      });
      expect(
        response.status,
        `${route.operationId} with an expired token`,
      ).toBe(401);
    }
  });

  test("retires the sixth-oldest token of a key", async () => {
    const client = createTestClient({ rateLimit: UNLIMITED });
    const issued: string[] = [];
    for (let index = 0; index <= TOKENS_KEPT_PER_KEY; index += 1) {
      issued.push(await client.token());
    }
    const [oldest, ...kept] = issued;
    for (const token of kept) {
      const response = await client.call("getMe", { token });
      expect(response.status, "one of the five newest tokens").toBe(200);
    }
    for (const route of bearerRoutes) {
      const response = await client.call(route.operationId, {
        ...validInput(route),
        token: oldest ?? "",
      });
      expect(response.status, `${route.operationId} with a retired token`).toBe(
        401,
      );
    }
  });

  test("answers 402 once the org's plan lapses, except getMe", async () => {
    const client = createTestClient({ rateLimit: UNLIMITED });
    const token = await client.token();
    client.mock.runtime.tenancy.setPlan("kelder", "lapsed");
    for (const route of bearerRoutes) {
      const response = await client.call(route.operationId, {
        ...validInput(route),
        token,
      });
      if (route.operationId === "getMe") {
        expect(response.status, "getMe documents no 402").toBe(200);
        continue;
      }
      expect(response.status, `${route.operationId} on a lapsed plan`).toBe(
        402,
      );
      expect(response.body).toEqual({ error: "No Valid Plan" });
    }
  });

  test("answers 403 to a read-only key on every write operation", async () => {
    const client = createTestClient({ rateLimit: UNLIMITED });
    const token = await client.token(client.mock.runtime.credentials.readOnly);
    for (const route of bearerRoutes) {
      const response = await client.call(route.operationId, {
        ...validInput(route),
        token,
      });
      if (route.scope === "write") {
        expect(response.status, `${route.operationId} is a write`).toBe(403);
        expect(response.body).toEqual({ error: "No Permission" });
      } else {
        expect(response.status, `${route.operationId} is a read`).not.toBe(403);
      }
    }
  });

  test("answers 405 to an undocumented method on every path", async () => {
    const client = createTestClient({ rateLimit: UNLIMITED });
    const token = await client.token();
    for (const [, routes] of specRuntime().table.byPath) {
      const documented = new Set<string>(routes.map((route) => route.method));
      const method = ["get", "post", "put", "patch", "delete"].find(
        (m) => !documented.has(m),
      );
      const [route] = routes;
      if (!method || !route) continue;
      const response = await client.call(route.operationId, {
        ...validInput(route),
        token,
        method,
      });
      expect(response.status, `${method} ${route.specPath}`).toBe(405);
    }
  });

  test("answers 429 after the configured limit, per operation", async () => {
    const client = createTestClient({
      rateLimit: { limit: 2, windowMs: 60_000 },
    });
    const token = await client.token();
    for (const route of bearerRoutes) {
      const input = { ...validInput(route), token };
      const first = await client.call(route.operationId, input);
      const second = await client.call(route.operationId, input);
      const third = await client.call(route.operationId, input);
      expect(
        [first.status, second.status].includes(429),
        `${route.operationId} within the limit`,
      ).toBe(false);
      expect(third.status, `${route.operationId} past the limit`).toBe(429);
    }
    client.mock.runtime.clock.advance(60_000);
    const afterWindow = await client.call("getMe", { token });
    expect(afterWindow.status, "a new window admits requests again").toBe(200);
  });

  test("answers 400 when a required parameter or body is missing", async () => {
    const client = createTestClient({ rateLimit: UNLIMITED });
    const token = await client.token();
    for (const route of bearerRoutes) {
      const sample = sampleRequest(route);
      const requiredQuery = route.parameters.find(
        (p) => p.in === "query" && p.required,
      );
      const typedPath = route.parameters.find(
        (p) => p.in === "path" && p.schema.type === "integer",
      );
      const variants: [string, CallInput][] = [];
      if (requiredQuery) {
        const { [requiredQuery.name]: _omitted, ...query } = sample.query;
        variants.push([
          `without query ${requiredQuery.name}`,
          { path: sample.path, query, body: sample.body, token },
        ]);
      }
      if (typedPath) {
        variants.push([
          `with a non-integer ${typedPath.name}`,
          {
            path: { ...sample.path, [typedPath.name]: "abc" },
            query: sample.query,
            body: sample.body,
            token,
          },
        ]);
      }
      if (route.body?.required) {
        variants.push([
          "without its body",
          { path: sample.path, query: sample.query, token },
        ]);
      }
      for (const [label, input] of variants) {
        const response = await client.call(route.operationId, input);
        expect(response.status, `${route.operationId} ${label}`).toBe(400);
      }
    }
  });
});

test("answers 404 for an unknown path", async () => {
  const client = createTestClient();
  const response = await client.request("/api/v2/no-such-thing");
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: "Object Not Found" });
});
