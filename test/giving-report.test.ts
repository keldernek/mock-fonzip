import { describe, expect, test } from "bun:test";

import type { OrgStore } from "../src/store/store";
import {
  ALL_TIME,
  givingClient,
  kelder,
  seeded,
  type SeededDonation,
} from "./giving-support";

const SIX_MONTHS = {
  start_date: "2026-05-01T00:00:00+03:00",
  end_date: "2026-11-01T00:00:00+03:00",
} as const;

type Item = Record<string, string | number>;

function nameOf(db: OrgStore, userId: number | null): string | undefined {
  if (userId === null) return undefined;
  const user = db.users.get(userId);
  return user ? `${user.first_name} ${user.last_name}` : undefined;
}

function groupFields(
  db: OrgStore,
  reportType: number,
  { donation }: SeededDonation,
): Item {
  const campaign =
    donation.fundraising_campaign_id === null
      ? undefined
      : db.fundraisingCampaigns.get(donation.fundraising_campaign_id);
  const fields: Record<string, string | number | undefined> = {};
  if (reportType === 1 && donation.sub_donation_type_id !== null) {
    fields.sub_donation_type__name = db.donationCategories.get(
      donation.sub_donation_type_id,
    )?.name;
  }
  if (reportType === 2 && donation.fundraising_page_id !== null) {
    fields.fundraising_page__title = db.donationPages.get(
      donation.fundraising_page_id,
    )?.title;
  }
  if (reportType === 3) fields.fundraising_campaign__title = campaign?.title;
  if (reportType === 4 || reportType === 11) {
    fields.added_by_id = donation.added_by_id ?? undefined;
    fields.added_by__name = nameOf(db, donation.added_by_id);
  }
  if (reportType === 5 && donation.module_id !== null) {
    fields.module__title = db.donationForms.get(donation.module_id)?.title;
  }
  if (reportType === 6) {
    fields.status = donation.recurring_status;
    fields.sub_status = donation.recurring_withdrawal ? 1 : 0;
  }
  if (reportType === 7 && campaign?.association_campaign_target_id) {
    fields.fundraising_campaign__association_campaign_target__title =
      db.fundraisingEvents.get(campaign.association_campaign_target_id)?.title;
  }
  if (reportType === 8 && campaign?.team_id) {
    fields.fundraising_campaign__team__title = db.fundraisingTeams.get(
      campaign.team_id,
    )?.title;
  }
  if (reportType === 9 && campaign?.team_campaign_id) {
    fields.fundraising_campaign__team_campaign__title = db.teamCampaigns.get(
      campaign.team_campaign_id,
    )?.title;
  }
  if ((reportType === 10 || reportType === 11) && donation.f2f_group_id) {
    fields.f2f_group__name = db.f2fGroups.get(donation.f2f_group_id)?.title;
  }
  return Object.fromEntries(
    Object.entries(fields).filter(
      (entry): entry is [string, string | number] => entry[1] !== undefined,
    ),
  );
}

function inRange(row: SeededDonation, range: typeof SIX_MONTHS): boolean {
  const at = Date.parse(row.transaction.complete_date);
  return at >= Date.parse(range.start_date) && at <= Date.parse(range.end_date);
}

function expectedTotals(members: readonly SeededDonation[]) {
  let cents = 0;
  for (const member of members) {
    cents += Math.round(member.transaction.amount * 100);
  }
  return {
    ts: cents / 100,
    tc: members.length,
    tu: new Set(members.map((member) => member.donation.user_id)).size,
  };
}

function expectedReport(
  rows: readonly SeededDonation[],
  db: OrgStore,
  reportType: number,
): Item[] {
  const groups = new Map<string, { fields: Item; members: SeededDonation[] }>();
  for (const row of rows) {
    const fields = groupFields(db, reportType, row);
    const key = JSON.stringify(fields);
    const group = groups.get(key) ?? { fields, members: [] };
    group.members.push(row);
    groups.set(key, group);
  }
  return [...groups.values()].map(({ fields, members }) => ({
    ...fields,
    ...expectedTotals(members),
  }));
}

function canonical(item: object): string {
  return JSON.stringify(
    Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
  );
}

function byGroup<T extends object>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => canonical(a).localeCompare(canonical(b)));
}

describe("getDonationReport", () => {
  test("aggregate=true totals the successful donations in the range", async () => {
    const client = givingClient();
    const db = kelder(client);
    const rows = seeded(db).filter(
      (row) => row.transaction.payment_status === 3 && inRange(row, SIX_MONTHS),
    );
    const report = await client.ok("getDonationReport", {
      query: { ...SIX_MONTHS, aggregate: "true" },
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(report).toEqual(expectedTotals(rows));
  });

  test.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const)(
    "report_type=%d groups match an independent computation",
    async (reportType) => {
      const client = givingClient();
      const db = kelder(client);
      const rows = seeded(db).filter(
        (row) =>
          row.transaction.payment_status === 3 && inRange(row, SIX_MONTHS),
      );
      const report = await client.ok("getDonationReport", {
        query: { ...SIX_MONTHS, report_type: reportType, aggregate: "false" },
      });
      const expected = expectedReport(rows, db, reportType);
      expect(expected.length, "more than one group").toBeGreaterThan(1);
      expect(JSON.stringify(byGroup(report.list ?? []).map(canonical))).toBe(
        JSON.stringify(byGroup(expected).map(canonical)),
      );
      const counted = (report.list ?? []).reduce(
        (sum, item) => sum + (item.tc ?? 0),
        0,
      );
      expect(counted, "the groups partition the donations").toBe(rows.length);
      const sizes = report.list?.map((item) => item.ts ?? 0) ?? [];
      expect(sizes, "largest group first").toEqual(
        [...sizes].sort((a, b) => b - a),
      );
    },
  );

  test("without report_type or aggregate, it groups by donation category", async () => {
    const client = givingClient();
    const plain = await client.ok("getDonationReport", { query: SIX_MONTHS });
    const byCategory = await client.ok("getDonationReport", {
      query: { ...SIX_MONTHS, report_type: 1 },
    });
    expect(plain).toEqual(byCategory);
    expect(plain.list?.[0]).toHaveProperty("sub_donation_type__name");
  });

  test("counts only the requested currency, TRY by default", async () => {
    const client = givingClient();
    const created = await client.ok("createDonation", {
      body: {
        payment_method_select: "other",
        payment_method: 1,
        amount: 40,
        currency: "USD",
        member_id: 1054,
        complete_date: "2026-08-01T12:00:00+03:00",
      },
    });
    expect(created.result).toBe("ok");
    const usd = await client.ok("getDonationReport", {
      query: { ...SIX_MONTHS, currency_id: 2, aggregate: "true" },
    });
    expect(usd).toEqual({ ts: 40, tc: 1, tu: 1 });
    const tryDefault = await client.ok("getDonationReport", {
      query: { ...SIX_MONTHS, aggregate: "true" },
    });
    const tryExplicit = await client.ok("getDonationReport", {
      query: { ...SIX_MONTHS, currency_id: 1, aggregate: "true" },
    });
    expect(tryDefault).toEqual(tryExplicit);
    const euro = await client.ok("getDonationReport", {
      query: { ...ALL_TIME, currency_id: 3, aggregate: "true" },
    });
    expect(euro).toEqual({ ts: 0, tc: 0, tu: 0 });
  });

  test("answers 404 for an unknown currency and 400 for a reversed range", async () => {
    const client = givingClient();
    const unknown = await client.call("getDonationReport", {
      query: { ...SIX_MONTHS, currency_id: 99 },
    });
    expect(unknown).toMatchObject({
      status: 404,
      body: { error: "Currency not found" },
    });
    const reversed = await client.call("getDonationReport", {
      query: {
        start_date: SIX_MONTHS.end_date,
        end_date: SIX_MONTHS.start_date,
      },
    });
    expect(reversed.status).toBe(400);
  });
});
