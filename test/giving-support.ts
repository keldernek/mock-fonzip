import { expect } from "bun:test";

import type { components } from "../src/generated/openapi";
import type { Row } from "../src/store/collection";
import type {
  DonationRecord,
  MarketingChannelRecord,
  TransactionRecord,
} from "../src/store/records";
import { orgStore, type OrgStore } from "../src/store/store";
import {
  createTestClient,
  type QueryValue,
  type TestClient,
} from "../src/testing/client";
import type { Delivery, WebhookFetch } from "../src/webhooks/emitter";

export type DonationResult = components["schemas"]["DonationResult"];

export const ALL_TIME = {
  start_date: "2024-01-01T00:00:00+03:00",
  end_date: "2027-01-01T00:00:00+03:00",
} as const;

export const PAGE = { start_page: 1, how_many: 100 } as const;

const UNLIMITED = { limit: 1_000_000, windowMs: 60_000 };

const accept: WebhookFetch = async () => new Response(null, { status: 204 });

export function givingClient(): TestClient {
  return createTestClient({ rateLimit: UNLIMITED, fetch: accept });
}

export function kelder(client: TestClient): OrgStore {
  return orgStore(client.mock.runtime.world().store, "kelder");
}

export function deliveries(client: TestClient): readonly Delivery[] {
  return client.mock.runtime.world().webhooks.deliveries();
}

export interface SeededDonation {
  readonly donation: Row<DonationRecord>;
  readonly transaction: Row<TransactionRecord>;
  readonly channel: Row<MarketingChannelRecord> | undefined;
}

export function seeded(
  db: OrgStore,
  source: "donations" | "microDonations" = "donations",
): SeededDonation[] {
  return db[source].list().map((donation) => {
    const transaction = db.transactions.get(donation.transaction_id);
    if (!transaction)
      throw new Error(`donation ${donation.id} lost its payment`);
    const channel =
      donation.marketing_channel_id === null
        ? undefined
        : db.marketingChannels.get(donation.marketing_channel_id);
    return { donation, transaction, channel };
  });
}

export function idsOf(rows: readonly { readonly id?: number }[]): number[] {
  return rows.map((row) => row.id ?? 0).sort((a, b) => a - b);
}

export function seededIds(rows: readonly SeededDonation[]): number[] {
  return rows.map((row) => row.donation.id).sort((a, b) => a - b);
}

export async function listAll(
  client: TestClient,
  operationId: "getDonationList" | "getMicroDonationList",
  query: Readonly<Record<string, QueryValue>>,
): Promise<{ rows: DonationResult[]; total: number }> {
  const rows: DonationResult[] = [];
  let total = 0;
  for (let page = 1; page < 100; page += 1) {
    const body = await client.ok(operationId, {
      query: { ...ALL_TIME, ...query, start_page: page, how_many: 100 },
    });
    total = body.total ?? 0;
    rows.push(...(body.donation_list ?? []));
    if ((body.donation_list ?? []).length < 100) break;
  }
  expect(rows.length, "every page together holds the total").toBe(total);
  return { rows, total };
}

export function keysOf(rows: readonly object[]): string[] {
  return [...new Set(rows.flatMap((row) => Object.keys(row)))].sort();
}
