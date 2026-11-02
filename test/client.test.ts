import { expect, expectTypeOf, test } from "bun:test";

import {
  createFonzipClient,
  OPERATIONS,
  type AssociationInfo,
  type CreateWebhookBody,
  type FundraisingTeamCampaignList,
  type GetMeResponse,
  type GetTagsListQuery,
} from "../client/src/index";
import { createMockControl, type Clock } from "../client/src/mock";
import { createMockFonzip } from "../src/app";
import type { ClientCredentials } from "../src/auth/tenancy";
import { manualClock } from "../src/core/clock";
import { NOT_SERVED } from "../src/operations";
import { specRuntime } from "../src/spec/runtime";

interface ServedMock extends Disposable {
  readonly origin: string;
  readonly api: string;
  readonly credentials: ClientCredentials;
  issueToken(): string;
}

function serveMock(): ServedMock {
  const { app, runtime } = createMockFonzip({ clock: manualClock() });
  const server = Bun.serve({ port: 0, fetch: app.fetch });
  const origin = `http://localhost:${server.port}`;
  return {
    origin,
    api: `${origin}/api/v2`,
    credentials: runtime.credentials.readWrite,
    issueToken() {
      const key = runtime.tenancy.findKey(
        runtime.credentials.readWrite.clientId,
      );
      if (!key) throw new Error("the mock has no read-write key");
      return runtime.tokens.issue(key).accessToken;
    },
    [Symbol.dispose]: () => void server.stop(true),
  };
}

function recordingFetch(): {
  readonly calls: string[];
  readonly fetch: (request: Request) => Promise<Response>;
} {
  const calls: string[] = [];
  return {
    calls,
    fetch: (request) => {
      calls.push(`${request.method} ${new URL(request.url).pathname}`);
      return fetch(request);
    },
  };
}

test("GET /me with client credentials answers the organisation, typed as GetMeResponse", async () => {
  using mock = serveMock();
  const client = createFonzipClient({
    baseUrl: mock.api,
    auth: mock.credentials,
  });
  const { data, response } = await client.GET("/me");
  expect(response.status).toBe(200);
  expectTypeOf(data).toEqualTypeOf<GetMeResponse | undefined>();
  expect(data).toMatchObject({ name: "kelder" });
});

test("a list call sends its typed query parameters", async () => {
  using mock = serveMock();
  const client = createFonzipClient({
    baseUrl: mock.api,
    auth: mock.credentials,
  });
  const query: GetTagsListQuery = { start_page: 1, how_many: 2 };
  expectTypeOf<GetTagsListQuery["how_many"]>().toEqualTypeOf<number>();
  const { data, response } = await client.GET("/tags", { params: { query } });
  expect(response.status).toBe(200);
  expect(data?.tag_list).toHaveLength(2);
  expect(data?.total).toBeGreaterThan(2);
});

test("requests a new token and retries once when the mock clock expires the cached one", async () => {
  using mock = serveMock();
  const recorder = recordingFetch();
  const client = createFonzipClient({
    baseUrl: mock.api,
    auth: mock.credentials,
    fetch: recorder.fetch,
  });
  const control = createMockControl({ baseUrl: mock.origin });
  expect((await client.GET("/me")).response.status).toBe(200);
  expect((await client.GET("/me")).response.status).toBe(200);
  const advanced = await control.POST("/clock/advance", {
    body: { seconds: 3600 },
  });
  expect(advanced.response.status).toBe(200);
  const { data, response } = await client.GET("/me");
  expect(response.status).toBe(200);
  expect(data).toMatchObject({ name: "kelder" });
  expect(recorder.calls).toEqual([
    "POST /api/v2/token",
    "GET /api/v2/me",
    "GET /api/v2/me",
    "GET /api/v2/me",
    "POST /api/v2/token",
    "GET /api/v2/me",
  ]);
});

test("a fixed token is sent as is, and its 401 is answered without a retry", async () => {
  using mock = serveMock();
  const recorder = recordingFetch();
  const client = createFonzipClient({
    baseUrl: mock.api,
    auth: { token: mock.issueToken() },
    fetch: recorder.fetch,
  });
  expect((await client.GET("/me")).response.status).toBe(200);
  await createMockControl({ baseUrl: mock.origin }).POST("/clock/advance", {
    body: { seconds: 3600 },
  });
  const expired = await client.GET("/me");
  expect(expired.response.status).toBe(401);
  expect(expired.error).toEqual({ error: "Unauthorized access" });
  expect(recorder.calls).toEqual(["GET /api/v2/me", "GET /api/v2/me"]);
});

test("createMockControl reads and advances the clock and resets the world", async () => {
  using mock = serveMock();
  const control = createMockControl({ baseUrl: mock.origin });
  const before = await control.GET("/clock");
  expectTypeOf(before.data).toEqualTypeOf<Clock | undefined>();
  await control.POST("/clock/advance", { body: { seconds: 60 } });
  const after = await control.GET("/clock");
  expect(
    Date.parse(after.data?.now ?? "") - Date.parse(before.data?.now ?? ""),
  ).toBe(60_000);

  await control.PUT("/orgs/{org}/plan", {
    params: { path: { org: "kelder" } },
    body: { plan: "lapsed" },
  });
  const reset = await control.POST("/reset");
  expect(reset.data).toEqual({ result: "ok", now: after.data?.now ?? "" });
  const { data: orgs } = await control.GET("/orgs");
  expect(orgs?.orgs.find((org) => org.slug === "kelder")?.plan).toBe("active");
});

test("OPERATIONS maps every operationId to the route the mock serves", () => {
  const { table } = specRuntime();
  for (const route of table.routes) {
    const { method, path } = OPERATIONS[route.operationId];
    expect(`${method} ${path}`).toBe(
      `${route.method.toUpperCase()} ${route.specPath}`,
    );
  }
  expect(Object.keys(OPERATIONS)).toHaveLength(
    table.routes.length + NOT_SERVED.length,
  );
});

type IsObject<T> = unknown extends T
  ? false
  : [T] extends [never]
    ? false
    : T extends object
      ? true
      : false;

test("the named types resolve to object types", () => {
  expectTypeOf<IsObject<GetMeResponse>>().toEqualTypeOf<true>();
  expectTypeOf<IsObject<CreateWebhookBody>>().toEqualTypeOf<true>();
  expectTypeOf<IsObject<FundraisingTeamCampaignList>>().toEqualTypeOf<true>();
  expectTypeOf<IsObject<AssociationInfo>>().toEqualTypeOf<true>();
  expectTypeOf<IsObject<Clock>>().toEqualTypeOf<true>();
});
