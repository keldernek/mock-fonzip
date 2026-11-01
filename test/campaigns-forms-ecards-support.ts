import { expect } from "bun:test";

import { orgStore, type OrgStore } from "../src/store/store";
import type { TestClient } from "../src/testing/client";
import type { WebhookNotification } from "../src/webhooks/emitter";

export const PAGE = { start_page: 1, how_many: 100 } as const;

export function kelder(client: TestClient): OrgStore {
  return orgStore(client.mock.runtime.world().store, "kelder");
}

export function notifications(client: TestClient): WebhookNotification[] {
  return client.mock.runtime
    .world()
    .webhooks.deliveries()
    .map((delivery) => delivery.body);
}

export async function simulate(
  client: TestClient,
  name: string,
  input: Record<string, unknown>,
): Promise<{ status: number; body: unknown }> {
  const response = await client.request(
    `/__mock/simulations/campaigns-forms-ecards/${name}?org=kelder`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return { status: response.status, body: await response.json() };
}

type Sortable = string | number | boolean | null | undefined;

function compare(a: Sortable, b: Sortable): number {
  if (typeof a === "string" && typeof b === "string") {
    return a.localeCompare(b, "tr", { sensitivity: "accent" });
  }
  return Number(a) - Number(b);
}

export function expectOrdered<T>(
  rows: readonly T[],
  value: (row: T) => Sortable,
  descending: boolean,
  label: string,
): void {
  const values = rows.map(value);
  const blanks = values.filter((item) => item === null || item === undefined);
  const present = values.filter((item) => item !== null && item !== undefined);
  expect(values.slice(present.length), `${label}: blanks come last`).toEqual(
    blanks,
  );
  const sorted = [...present].sort((a, b) =>
    descending ? compare(b, a) : compare(a, b),
  );
  expect(present, label).toEqual(sorted);
  expect(
    new Set(present.map(String)).size,
    `${label}: the order is not trivially flat`,
  ).toBeGreaterThan(1);
}

export function dateOf(value: string | undefined): number | undefined {
  return value === undefined ? undefined : Date.parse(value);
}
