import { describe, expect, test } from "bun:test";

import { deliveries, givingClient, kelder, listAll } from "./giving-support";
import type { TestClient } from "../src/testing/client";

async function simulate(
  client: TestClient,
  name: string,
  input: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await client.request(`/__mock/simulations/giving/${name}`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new Error(`simulation ${name} answered ${JSON.stringify(body)}`);
  }
  return {
    status: response.status,
    body: Object.fromEntries(Object.entries(body)),
  };
}

function donationIdOf(result: { body: Record<string, unknown> }): number {
  const id = result.body.donation_id;
  if (typeof id !== "number") throw new Error("no donation_id");
  return id;
}

describe("giving simulations", () => {
  test("are listed on the control plane", async () => {
    const client = givingClient();
    const response = await client.request("/__mock/simulations");
    const body: unknown = await response.json();
    expect(body).toMatchObject({
      simulations: expect.arrayContaining([
        expect.objectContaining({ domain: "giving", name: "public-donation" }),
        expect.objectContaining({ domain: "giving", name: "failed-donation" }),
        expect.objectContaining({ domain: "giving", name: "refund-donation" }),
      ]),
    });
  });

  test("public-donation records a paid card donation and fires DONATION status 3", async () => {
    const client = givingClient();
    const result = await simulate(client, "public-donation", {
      user_id: 1054,
      amount: 300,
      category_id: 202,
      fundraising_campaign_id: 801,
      marketing_channel_id: 401,
      message: "Okulumuz için!",
    });
    expect(result.status).toBe(200);
    const donationId = donationIdOf(result);
    expect(result.body).toEqual({
      donation_id: donationId,
      member_id: 1054,
      transaction_id: expect.any(Number),
      payment_status: 3,
    });
    expect(deliveries(client).map((delivery) => delivery.body)).toEqual([
      { id: donationId, webhook_id: 21, operation: 1, status: 3 },
      { id: donationId, webhook_id: 22, operation: 1, status: 3 },
    ]);
    const paid = await listAll(client, "getDonationList", {
      status: "paid",
      utm_source: ["google"],
      list: ["amount", "fundraising_campaign", "card_number", "message"],
    });
    expect(paid.rows).toContainEqual(
      expect.objectContaining({
        id: donationId,
        transaction__amount: 300,
        transaction__fonzip_framework: true,
        transaction__bin_number: expect.stringMatching(/^\d{6}$/),
        fundraising_campaign_id: 801,
        message: "Okulumuz için!",
      }),
    );
  });

  test("public-donation creates a donor when no user_id is given", async () => {
    const client = givingClient();
    const result = await simulate(client, "public-donation", {
      first_name: "Ece",
      last_name: "Tan",
      email: "ece.tan@eposta.example",
      amount: 50,
      currency: "EUR",
      fundraising_page_id: 32,
      module_id: 41,
    });
    const memberId = result.body.member_id;
    expect(kelder(client).users.get(Number(memberId))).toMatchObject({
      first_name: "Ece",
      email: "ece.tan@eposta.example",
    });
    const detail = await client.ok("getDonationDetails", {
      path: { donation_id: donationIdOf(result) },
    });
    expect(detail.donation).toMatchObject({
      fundraising_page_id: 32,
      module_id: 41,
      transaction: { currency: { iso_code: "EUR" }, payment_method: 0 },
    });
  });

  test("failed-donation records a declined payment and fires DONATION status 5", async () => {
    const client = givingClient();
    const result = await simulate(client, "failed-donation", {
      user_id: 1054,
      amount: 2500,
      error_code: "54",
    });
    const donationId = donationIdOf(result);
    expect(result.body.payment_status).toBe(5);
    expect(deliveries(client).map((delivery) => delivery.body.status)).toEqual([
      5, 5,
    ]);
    const failed = await listAll(client, "getDonationList", {
      status: "failed",
    });
    expect(failed.rows).toContainEqual(
      expect.objectContaining({
        id: donationId,
        transaction__payment_status: 5,
        transaction__transaction_error__code: "54",
        transaction__transaction_error__group: 21,
      }),
    );
    const detail = await client.ok("getDonationDetails", {
      path: { donation_id: donationId },
    });
    expect(detail.donation?.transaction?.provision_no).toBeNull();
    const total = kelder(client).users.get(1054)?.total_financial;
    const seeded = givingClient();
    expect(total, "a failed payment adds nothing").toBe(
      kelder(seeded).users.get(1054)?.total_financial,
    );
  });

  test("refund-donation refunds a paid donation and fires DONATION status 4", async () => {
    const client = givingClient();
    const db = kelder(client);
    const paid = db.donations.find(
      (row) => db.transactions.get(row.transaction_id)?.payment_status === 3,
    );
    const donationId = paid?.id ?? 0;
    const before = db.users.get(paid?.user_id ?? 0)?.total_financial ?? 0;
    const amount = db.transactions.get(paid?.transaction_id ?? 0)?.amount ?? 0;
    const result = await simulate(client, "refund-donation", {
      donation_id: donationId,
      reason: "Mükerrer ödeme",
      refunded_by_id: 1002,
    });
    expect(result).toEqual({
      status: 200,
      body: {
        donation_id: donationId,
        payment_status: 4,
        refund_date: "2026-11-01T09:00:00+03:00",
      },
    });
    expect(deliveries(client).map((delivery) => delivery.body)).toEqual([
      { id: donationId, webhook_id: 21, operation: 1, status: 4 },
      { id: donationId, webhook_id: 22, operation: 1, status: 4 },
    ]);
    const refunds = await listAll(client, "getDonationList", {
      status: "refund",
    });
    expect(refunds.rows).toContainEqual(
      expect.objectContaining({
        id: donationId,
        transaction__refund_date: "2026-11-01T09:00:00+03:00",
        transaction__refunded_by_id: 1002,
      }),
    );
    const detail = await client.ok("getDonationDetails", {
      path: { donation_id: donationId },
    });
    expect(detail.donation?.transaction).toMatchObject({
      refund_reason: "Mükerrer ödeme",
      refunded_by__name: expect.any(String),
    });
    expect(db.users.get(paid?.user_id ?? 0)?.total_financial).toBe(
      Math.round((before - amount) * 100) / 100,
    );
    const again = await simulate(client, "refund-donation", {
      donation_id: donationId,
    });
    expect(again).toEqual({
      status: 409,
      body: { error: "only a successful donation can be refunded" },
    });
  });

  test("refuse bad input with 400 and unknown objects with 404", async () => {
    const client = givingClient();
    const cases = [
      ["public-donation", { user_id: 1054 }, 400],
      ["public-donation", { amount: 10 }, 400],
      ["public-donation", { amount: 10, user_id: 1054, currency: "XYZ" }, 400],
      ["public-donation", { amount: 10, user_id: 9 }, 404],
      ["public-donation", { amount: 10, user_id: 1054, category_id: 9 }, 404],
      ["failed-donation", { amount: 10, user_id: 1054, error_code: "00" }, 400],
      ["refund-donation", {}, 400],
      ["refund-donation", { donation_id: 49_999 }, 404],
      ["refund-donation", { donation_id: 50_001, refunded_by_id: 9 }, 404],
    ] as const;
    for (const [name, input, status] of cases) {
      const result = await simulate(client, name, input);
      expect(result.status, `${name} ${JSON.stringify(input)}`).toBe(status);
    }
    expect(deliveries(client), "nothing fired").toEqual([]);
  });
});
