import { expect } from "bun:test";

import type { QueryValue, TestClient } from "../src/testing/client";
import { orgStore, type OrgStore } from "../src/store/store";

export const PAGE = { start_page: 1, how_many: 100 } as const;

export const EVER = {
  start_date: "2020-01-01T00:00:00+03:00",
  end_date: "2027-12-31T23:59:59+03:00",
} as const;

export type Query = Readonly<Record<string, QueryValue>>;

export function kelder(client: TestClient): OrgStore {
  return orgStore(client.mock.runtime.world().store, "kelder");
}

export async function collect<T>(
  page: (
    startPage: number,
  ) => Promise<{ rows: readonly T[] | undefined; total: number | undefined }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 1; ; start += 1) {
    const body = await page(start);
    rows.push(...(body.rows ?? []));
    if (rows.length >= (body.total ?? 0) || (body.rows ?? []).length === 0) {
      expect(rows.length, "paged rows add up to the total").toBe(
        body.total ?? 0,
      );
      return rows;
    }
  }
}

export function ids(rows: readonly { readonly id?: number }[]): number[] {
  return rows.map((row) => row.id ?? -1);
}

export function sortedIds(rows: readonly { readonly id?: number }[]): number[] {
  return ids(rows).sort((a, b) => a - b);
}

export function expectSplit<T extends { readonly id?: number }>(
  all: readonly T[],
  subset: readonly T[],
  keep: (row: T) => boolean,
  label: string,
): void {
  const expected = all.filter(keep);
  expect(ids(subset), `${label} returns exactly the matching rows`).toEqual(
    ids(expected),
  );
  expect(expected.length, `${label} keeps some rows`).toBeGreaterThan(0);
  expect(expected.length, `${label} drops some rows`).toBeLessThan(all.length);
}

export function expectOrdered<T>(
  rows: readonly T[],
  key: (row: T) => number | string,
  direction: "asc" | "desc",
  label: string,
): void {
  const keys = rows.map(key);
  const sorted = [...keys].sort((a, b) =>
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b), "tr"),
  );
  if (direction === "desc") sorted.reverse();
  expect(keys, `${label} ${direction}`).toEqual(sorted);
  expect(new Set(keys).size, `${label} has distinct keys`).toBeGreaterThan(1);
}

export async function simulate(
  client: TestClient,
  name: string,
  input: Readonly<Record<string, unknown>>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await client.request(
    `/__mock/simulations/dues-events/${name}?org=kelder`,
    { method: "POST", body: JSON.stringify(input) },
  );
  const body: unknown = await response.json();
  return {
    status: response.status,
    body:
      typeof body === "object" && body !== null && !Array.isArray(body)
        ? Object.fromEntries(Object.entries(body))
        : {},
  };
}
