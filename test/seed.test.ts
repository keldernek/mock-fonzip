import { describe, expect, test } from "bun:test";

import { ORG_SLUGS } from "../src/auth/tenancy";
import { DEFAULT_SEED } from "../src/core/rng";
import { isValidTcKimlikNo } from "../src/seed/identity";
import { NEWEST_PAGE } from "../src/seed/people";
import { seedWorld, type SeedOptions } from "../src/seed/world";
import { TEMPLATE_CATEGORIES } from "../src/store/reference";
import { RELATIONS } from "../src/store/relations";
import { orgStore, type OrgStore, type Records } from "../src/store/store";

const OPTIONS: SeedOptions = {
  seed: DEFAULT_SEED,
  selfOrigin: "http://localhost:8790",
  apiKeyIds: {
    kelder: ["kelder-read-write", "kelder-read-only"],
    ornek: ["ornek-read-write"],
  },
};

function snapshot(db: OrgStore): string {
  return JSON.stringify(
    Object.entries(db).map(([name, collection]) => [name, collection.list()]),
  );
}

function fieldValues(row: object, field: string): number[] {
  const value: unknown = Object.entries(row).find(
    ([key]) => key === field,
  )?.[1];
  if (typeof value === "number") return [value];
  if (Array.isArray(value))
    return value.filter((item): item is number => typeof item === "number");
  return [];
}

describe("the seeded world", () => {
  const store = seedWorld(OPTIONS);
  const kelder = orgStore(store, "kelder");

  test("is identical on every boot", () => {
    for (const org of ORG_SLUGS) {
      expect(
        snapshot(orgStore(seedWorld(OPTIONS), org)),
        `${org} seeds the same data twice`,
      ).toBe(snapshot(orgStore(store, org)));
    }
  });

  test("has enough users and donations to page past how_many=100", () => {
    expect(kelder.users.count()).toBeGreaterThan(100);
    expect(kelder.donations.count()).toBeGreaterThan(200);
  });

  test("seeds every kelder collection", () => {
    for (const [name, collection] of Object.entries(kelder)) {
      expect(collection.count(), `kelder.${name} is seeded`).toBeGreaterThan(0);
    }
  });

  test("keeps every foreign key pointing at an existing row of the same org", () => {
    for (const org of ORG_SLUGS) {
      const db = orgStore(store, org);
      for (const relation of RELATIONS) {
        const target: OrgStore[keyof Records] = db[relation.to];
        for (const row of db[relation.from].list()) {
          for (const id of fieldValues(row, relation.field)) {
            expect(
              target.get(id),
              `${org} ${relation.from}#${row.id}.${relation.field} -> ${relation.to}#${id}`,
            ).toBeDefined();
          }
        }
      }
    }
  });

  test("points templates at known categories", () => {
    for (const template of kelder.templates.list()) {
      expect(
        TEMPLATE_CATEGORIES.some(
          (category) => category.id === template.category_id,
        ),
      ).toBe(true);
    }
  });

  test("gives every person a checksum-valid TC kimlik number, except where the newest page leaves it empty", () => {
    const newestPage = new Set(
      kelder.users
        .list()
        .slice(-NEWEST_PAGE)
        .map((user) => user.id),
    );
    for (const user of [
      ...kelder.users.list(),
      ...orgStore(store, "ornek").users.list(),
    ]) {
      if (user.corporate_type) {
        expect(user.tckno, `corporate user ${user.id} has no TC kimlik`).toBe(
          "",
        );
        continue;
      }
      // The newest page leaves some TC kimlik numbers empty, as production's
      // first page does. No one else does.
      if (user.tckno === "") {
        expect(
          newestPage.has(user.id),
          `user ${user.id} lacks a TC kimlik`,
        ).toBe(true);
        continue;
      }
      expect(
        isValidTcKimlikNo(user.tckno),
        `user ${user.id} tckno ${user.tckno}`,
      ).toBe(true);
    }
    expect(isValidTcKimlikNo("10000000146"), "a known-valid number").toBe(true);
    expect(isValidTcKimlikNo("10000000147"), "a wrong last digit").toBe(false);
  });

  test("includes the states the domains need to exercise", () => {
    const statuses = new Set(
      kelder.donations
        .list()
        .map(
          (donation) =>
            kelder.transactions.get(donation.transaction_id)?.payment_status,
        ),
    );
    expect(
      [...statuses].sort((a, b) => (a ?? 0) - (b ?? 0)),
      "paid, refunded and failed donations",
    ).toEqual(expect.arrayContaining([3, 4, 5]));
    const recurring = new Set(
      kelder.donations
        .list(
          (row) =>
            row.recurring_order_id !== null && row.monthly_donation_id === null,
        )
        .map((row) => row.recurring_status),
    );
    expect(
      [...recurring].sort((a, b) => a - b),
      "active, failing, cancelled and pending monthly donations",
    ).toEqual([1, 2, 3, 4]);
    expect(
      kelder.subscriptions.list().map((row) => row.status),
      "every dues status",
    ).toEqual(expect.arrayContaining([1, 2, 3, 4, 6, 7, 8]));
    expect(
      kelder.events
        .list()
        .filter(
          (event) =>
            kelder.ticketSales.count((sale) => sale.event_id === event.id) > 0,
        ).length,
    ).toBeGreaterThan(2);
    expect(
      kelder.forms
        .list()
        .filter(
          (form) =>
            kelder.formAnswers.count((answer) => answer.form_id === form.id) >
            0,
        ).length,
    ).toBeGreaterThan(2);
    expect(
      kelder.fundraisingCampaigns.count(
        (campaign) => campaign.team_id !== null,
      ),
    ).toBeGreaterThan(0);
    expect(
      new Set(kelder.bankTransactions.list().map((row) => row.payment_status)),
    ).toEqual(new Set([3, 8, 9]));
    expect(
      kelder.ecardTransactions
        .list()
        .map(
          (row) => kelder.transactions.get(row.transaction_id)?.payment_status,
        ),
    ).toEqual(expect.arrayContaining([3, 4, 5]));
  });

  test("keeps the lapsed org's data apart from kelder", () => {
    const ornek = orgStore(store, "ornek");
    expect(ornek.users.count()).toBe(3);
    const kelderIds = new Set(kelder.users.list().map((user) => user.id));
    expect(ornek.users.list().some((user) => kelderIds.has(user.id))).toBe(
      false,
    );
    expect(ornek.donations.count()).toBe(0);
  });
});
