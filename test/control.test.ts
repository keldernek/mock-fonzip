import { describe, expect, test } from "bun:test";

import { createTestClient } from "../src/testing/client";
import type { WebhookFetch } from "../src/webhooks/emitter";

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

describe("the control plane", () => {
  test("lists every credential with its scopes and plan", async () => {
    const client = createTestClient();
    const body = await readJson(await client.request("/__mock/credentials"));
    expect(body).toMatchObject({
      keys: [
        {
          org: "kelder",
          client_id: "kelder-local",
          scopes: ["read", "write"],
          plan: "active",
        },
        {
          org: "kelder",
          client_id: "kelder-readonly",
          scopes: ["read"],
          plan: "active",
        },
        { org: "ornek", client_id: "ornek-lapsed", plan: "lapsed" },
      ],
    });
  });

  test("advances the clock until a token expires", async () => {
    const client = createTestClient();
    const token = await client.token();
    const before = await client.call("getMe", { token });
    expect(before.status, "fresh token").toBe(200);
    const advanced = await client.request("/__mock/clock/advance", {
      method: "POST",
      body: JSON.stringify({ seconds: 3600 }),
    });
    expect(advanced.status).toBe(200);
    const after = await client.call("getMe", { token });
    expect(after.status, "token past its hour").toBe(401);
  });

  test("toggles an org's plan between active and lapsed", async () => {
    const client = createTestClient();
    const token = await client.token();
    const lapse = await client.request("/__mock/orgs/kelder/plan", {
      method: "PUT",
      body: JSON.stringify({ plan: "lapsed" }),
    });
    expect(lapse.status).toBe(200);
    const lapsedCall = await client.call("getTagsList", {
      token,
      query: { start_page: 1, how_many: 10 },
    });
    expect(lapsedCall.status, "API call on a lapsed plan").toBe(402);
    const lapsedToken = await client.request("/api/v2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: "kelder-local",
        client_secret: "kelder-local-secret",
      }),
    });
    expect(lapsedToken.status, "token request on a lapsed plan").toBe(402);
    await client.request("/__mock/orgs/kelder/plan", {
      method: "PUT",
      body: JSON.stringify({ plan: "active" }),
    });
    const restored = await client.call("getMe", { token });
    expect(restored.status, "plan restored").toBe(200);
  });

  test("lets the lapsed org in once its plan is activated", async () => {
    const client = createTestClient();
    client.mock.runtime.tenancy.setPlan("ornek", "active");
    const token = await client.token(client.mock.runtime.credentials.lapsed);
    const me = await client.call("getMe", { token });
    expect(me.body).toMatchObject({ name: "ornek" });
  });

  test("reset reseeds the store and restores plans", async () => {
    const client = createTestClient();
    const runtime = client.mock.runtime;
    const tags = (): number => runtime.world().store.tags.for("kelder").count();
    const seeded = tags();
    runtime
      .world()
      .store.tags.for("kelder")
      .insert({ name: "Geçici", color: "tag-1" });
    runtime.tenancy.setPlan("kelder", "lapsed");
    expect(tags()).toBe(seeded + 1);
    const response = await client.request("/__mock/reset", { method: "POST" });
    expect(response.status).toBe(200);
    expect(tags(), "tags back to the seed").toBe(seeded);
    expect(runtime.tenancy.plan("kelder")).toBe("active");
  });

  test("runs a registered simulation against the chosen org", async () => {
    const client = createTestClient();
    const listed = await readJson(await client.request("/__mock/simulations"));
    expect(listed).toMatchObject({
      simulations: expect.arrayContaining([
        expect.objectContaining({
          domain: "foundation",
          name: "incoming-transfer",
        }),
      ]),
    });
    const response = await client.request(
      "/__mock/simulations/foundation/incoming-transfer",
      {
        method: "POST",
        body: JSON.stringify({
          bank_account_id: 81,
          amount: 1250,
          counterparty_name: "AHMET YILMAZ",
        }),
      },
    );
    expect(response.status).toBe(200);
    const body = await readJson(response);
    expect(body).toEqual({ transaction_id: expect.any(Number) });
    const invalid = await client.request(
      "/__mock/simulations/foundation/incoming-transfer",
      {
        method: "POST",
        body: JSON.stringify({ amount: -1 }),
      },
    );
    expect(invalid.status, "invalid simulation input").toBe(400);
    const unknown = await client.request("/__mock/simulations/giving/nope", {
      method: "POST",
    });
    expect(unknown.status, "unknown simulation").toBe(404);
  });
});

describe("the webhook emitter", () => {
  test("posts a notification to every subscribed webhook, with the token when authentication is on", async () => {
    const seen: { token: string | null; body: unknown }[] = [];
    const fetcher: WebhookFetch = async (request) => {
      seen.push({
        token: request.headers.get("X-FZ-Auth-Token"),
        body: await request.json(),
      });
      return new Response("ok", { status: 200 });
    };
    const client = createTestClient({ fetch: fetcher });
    const world = client.mock.runtime.world();
    const deliveries = world.webhooks
      .forOrg("kelder")
      .emit({ operation: 1, status: 3 }, 50_001);
    await world.webhooks.settle();
    expect(deliveries.map((delivery) => delivery.body.webhook_id)).toEqual([
      21, 22,
    ]);
    const [authenticated, open] = seen;
    expect(authenticated?.token).toBe("kelder-muhasebe-token");
    expect(open?.token).toBeNull();
    expect(authenticated?.body).toEqual({
      id: 50_001,
      webhook_id: 21,
      operation: 1,
      status: 3,
    });
    expect(
      world.webhooks.deliveries().map((delivery) => delivery.outcome),
    ).toEqual([
      { state: "delivered", status: 200 },
      { state: "delivered", status: 200 },
    ]);
  });

  test("skips webhooks that did not subscribe to the event", async () => {
    const client = createTestClient({
      fetch: async () => new Response(null, { status: 204 }),
    });
    const world = client.mock.runtime.world();
    const deliveries = world.webhooks
      .forOrg("kelder")
      .emit({ operation: 3, status: 3 }, 61_001);
    expect(
      deliveries.map((delivery) => delivery.body.webhook_id),
      "only the CRM webhook takes tickets",
    ).toEqual([22]);
  });

  test("records a failed delivery and exposes the log on the control plane", async () => {
    const client = createTestClient({
      fetch: async () => {
        throw new Error("connection refused");
      },
    });
    const world = client.mock.runtime.world();
    world.webhooks.forOrg("kelder").emit({ operation: 6, status: 0 }, 801);
    await world.webhooks.settle();
    const log = await readJson(
      await client.request("/__mock/webhooks/deliveries"),
    );
    expect(log).toMatchObject({
      deliveries: [
        {
          url: expect.stringContaining("receiver=crm"),
          outcome: { state: "failed", error: "connection refused" },
        },
      ],
    });
    await client.request("/__mock/webhooks/deliveries", { method: "DELETE" });
    expect(world.webhooks.deliveries()).toEqual([]);
  });

  test("delivers to the built-in sink when routed back into the mock", async () => {
    let app:
      | { request(input: Request): Response | Promise<Response> }
      | undefined;
    const client = createTestClient({
      fetch: async (request) =>
        app ? app.request(request) : new Response(null, { status: 503 }),
    });
    app = client.mock.app;
    const world = client.mock.runtime.world();
    world.webhooks.forOrg("kelder").emit({ operation: 2, status: 4 }, 20_001);
    await world.webhooks.settle();
    const received = await readJson(
      await client.request("/__mock/webhooks/received"),
    );
    expect(received).toMatchObject({
      received: [
        {
          receiver: "muhasebe",
          auth_token: "kelder-muhasebe-token",
          body: { id: 20_001, webhook_id: 21, operation: 2, status: 4 },
        },
        {
          receiver: "crm",
          auth_token: null,
          body: { id: 20_001, webhook_id: 22, operation: 2, status: 4 },
        },
      ],
    });
  });
});
