import { describe, expect, test } from "bun:test";

import { createTestClient } from "../src/testing/client";

const EVENTS_OFF = {
  DONATION: false,
  SUBSCRIPTION: false,
  TICKET: false,
  FORM: false,
  CERTIFICATE_SALE: false,
  FUNDRAISING_CAMPAIGN: false,
};

describe("webhooks", () => {
  test("lists the seeded webhooks and returns one's details", async () => {
    const client = createTestClient();
    expect(await client.ok("listWebhooks")).toEqual({
      webhook_list: [
        {
          id: 21,
          name: "Muhasebe Entegrasyonu",
          url: "http://localhost:8790/__mock/webhooks/sink?receiver=muhasebe",
        },
        {
          id: 22,
          name: "CRM Senkronizasyonu",
          url: "http://localhost:8790/__mock/webhooks/sink?receiver=crm",
        },
      ],
    });
    expect(
      await client.ok("getWebhookDetails", { path: { webhook_id: 21 } }),
    ).toEqual({
      webhook: {
        id: 21,
        name: "Muhasebe Entegrasyonu",
        url: "http://localhost:8790/__mock/webhooks/sink?receiver=muhasebe",
        authentication: true,
        auth_token: "kelder-muhasebe-token",
        events: {
          DONATION: true,
          SUBSCRIPTION: true,
          TICKET: false,
          FORM: false,
          CERTIFICATE_SALE: true,
          FUNDRAISING_CAMPAIGN: false,
        },
      },
    });
  });

  test("creates, updates and deletes a webhook", async () => {
    const client = createTestClient();
    const created = await client.ok("createWebhook", {
      body: {
        id: 5,
        name: "Yeni Entegrasyon",
        url: "https://hooks.example/fonzip",
        authentication: true,
        auth_token: "gizli",
        events: {
          DONATION: false,
          SUBSCRIPTION: false,
          TICKET: true,
          FORM: true,
          CERTIFICATE_SALE: false,
          FUNDRAISING_CAMPAIGN: false,
        },
      },
    });
    expect(created).toEqual({ result: "ok" });
    const listed = await client.ok("listWebhooks");
    const row = listed.webhook_list?.at(-1);
    expect(row).toEqual({
      id: 23,
      name: "Yeni Entegrasyon",
      url: "https://hooks.example/fonzip",
    });
    const webhookId = row?.id ?? 0;
    expect(
      await client.ok("getWebhookDetails", { path: { webhook_id: webhookId } }),
    ).toEqual({
      webhook: {
        id: webhookId,
        name: "Yeni Entegrasyon",
        url: "https://hooks.example/fonzip",
        authentication: true,
        auth_token: "gizli",
        events: { ...EVENTS_OFF, TICKET: true, FORM: true },
      },
    });
    await client.ok("updateWebhook", {
      path: { webhook_id: webhookId },
      body: {
        id: webhookId,
        name: "Yeniden Adlandırıldı",
        url: "https://hooks.example/v2",
        authentication: false,
        auth_token: "artık-yok",
        events: {
          DONATION: true,
          SUBSCRIPTION: false,
          TICKET: false,
          FORM: false,
          CERTIFICATE_SALE: false,
          FUNDRAISING_CAMPAIGN: true,
        },
      },
    });
    expect(
      await client.ok("getWebhookDetails", { path: { webhook_id: webhookId } }),
    ).toEqual({
      webhook: {
        id: webhookId,
        name: "Yeniden Adlandırıldı",
        url: "https://hooks.example/v2",
        authentication: false,
        events: { ...EVENTS_OFF, DONATION: true, FUNDRAISING_CAMPAIGN: true },
      },
    });
    await client.ok("deleteWebhook", { path: { webhook_id: webhookId } });
    const gone = await client.call("getWebhookDetails", {
      path: { webhook_id: webhookId },
    });
    expect(gone.status).toBe(404);
    expect(gone.body).toEqual({ error: "Webhook not found" });
    expect(
      (await client.ok("listWebhooks")).webhook_list?.map((hook) => hook.id),
    ).toEqual([21, 22]);
  });

  test("answers 400 for a missing body, authentication without a token, a bad URL or a mismatched id, and 404 for an unknown webhook", async () => {
    const client = createTestClient();
    const body = {
      name: "X",
      url: "https://hooks.example/x",
      events: { DONATION: true },
    };
    const noBody = await client.call("createWebhook", {});
    expect(noBody.status).toBe(400);
    expect(noBody.body).toEqual({
      error: "Invalid values: a webhook body is required",
    });
    const noToken = await client.call("createWebhook", {
      body: { ...body, authentication: true },
    });
    expect(noToken.body).toEqual({
      error: "Invalid values: authentication needs an auth_token",
    });
    const badUrl = await client.call("createWebhook", {
      body: { ...body, url: "not a url" },
    });
    expect(badUrl.status).toBe(400);
    const mismatch = await client.call("updateWebhook", {
      path: { webhook_id: 21 },
      body: { ...body, id: 22 },
    });
    expect(mismatch.body).toEqual({
      error: "Invalid values: body id 22 does not match webhook 21",
    });
    for (const operation of [
      "getWebhookDetails",
      "deleteWebhook",
      "sendWebhookTestNotification",
    ] as const) {
      const missing = await client.call(operation, {
        path: { webhook_id: 99 },
      });
      expect(missing.status, operation).toBe(404);
    }
    const missingUpdate = await client.call("updateWebhook", {
      path: { webhook_id: 99 },
      body,
    });
    expect(missingUpdate.status).toBe(404);
  });

  test("sends a test notification for the first subscribed event through the emitter to the webhook's URL", async () => {
    let app:
      | { request(input: Request): Response | Promise<Response> }
      | undefined;
    const client = createTestClient({
      fetch: async (request) =>
        app ? app.request(request) : new Response(null, { status: 503 }),
    });
    app = client.mock.app;
    const world = client.mock.runtime.world();
    const latestDonation = Math.max(
      ...world.store.donations
        .for("kelder")
        .list()
        .map((row) => row.id),
    );
    expect(
      await client.ok("sendWebhookTestNotification", {
        path: { webhook_id: 21 },
      }),
    ).toEqual({ result: "ok" });
    await world.webhooks.settle();
    const deliveries = world.webhooks.deliveries();
    expect(deliveries.map((delivery) => delivery.body)).toEqual([
      { id: latestDonation, webhook_id: 21, operation: 1, status: 3 },
    ]);
    expect(deliveries[0]?.outcome).toEqual({ state: "delivered", status: 200 });
    const received: unknown = await (
      await client.request("/__mock/webhooks/received")
    ).json();
    expect(received).toMatchObject({
      received: [
        {
          receiver: "muhasebe",
          auth_token: "kelder-muhasebe-token",
          body: { id: latestDonation, webhook_id: 21, operation: 1, status: 3 },
        },
      ],
    });
  });

  test("a campaign-only webhook gets a campaign-created test, and one with no events gets 400", async () => {
    const client = createTestClient({
      fetch: async () => new Response(null, { status: 204 }),
    });
    await client.ok("createWebhook", {
      body: {
        name: "Kampanya",
        url: "https://hooks.example/kampanya",
        events: { FUNDRAISING_CAMPAIGN: true },
      },
    });
    await client.ok("createWebhook", {
      body: { name: "Sessiz", url: "https://hooks.example/sessiz", events: {} },
    });
    await client.ok("sendWebhookTestNotification", {
      path: { webhook_id: 23 },
    });
    const world = client.mock.runtime.world();
    await world.webhooks.settle();
    expect(
      world.webhooks.deliveries().map((delivery) => delivery.body),
    ).toEqual([{ id: 810, webhook_id: 23, operation: 6, status: 0 }]);
    const silent = await client.call("sendWebhookTestNotification", {
      path: { webhook_id: 24 },
    });
    expect(silent.status).toBe(400);
    expect(silent.body).toEqual({
      error: "Invalid values: webhook 24 subscribes to no events",
    });
  });
});
