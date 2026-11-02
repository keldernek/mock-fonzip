import { describe, expect, test } from "bun:test";

import { orgStore } from "../src/store/store";
import type { QueryValue, TestClient } from "../src/testing/client";
import {
  ALL_TIME,
  givingClient,
  idsOf,
  keysOf,
  kelder,
  listAll,
  seeded,
  seededIds,
  type DonationResult,
  type SeededDonation,
} from "./giving-support";

const PAID = { status: "paid" } as const;

const BASE = [
  "id",
  "user_id",
  "recurring_status",
  "transaction__payment_status",
  "transaction__fonzip_framework",
  "d_type",
  "email",
  "user__email",
  "user__first_name",
  "user__last_name",
  "updated_by_id",
  "last_update_date",
];

const EXPANSIONS: Readonly<Record<string, readonly string[]>> = {
  details: ["details"],
  name_surname: ["name"],
  address: ["address", "city", "district"],
  amount: [
    "transaction__amount",
    "transaction__currency__display",
    "transaction__currency__iso_code",
  ],
  sub_donation_type: ["sub_donation_type_id", "sub_donation_type__name"],
  birthday: ["birthday"],
  email_status: [
    "sent_mail_id",
    "sent_mail__message_id",
    "sent_mail__status",
    "sent_mail_to_referring_id",
    "sent_mail_to_referring__message_id",
    "sent_mail_to_referring__status",
  ],
  complete_date: ["transaction__complete_date"],
  fundraising_campaign: [
    "fundraising_campaign_id",
    "fundraising_campaign__title",
  ],
  tckno: ["tckno"],
  tax_department: [],
  phone: ["phone"],
  donation_page: ["fundraising_page_id", "fundraising_page__title"],
  module: ["module_id", "module__title"],
  payment_method: ["transaction__payment_method"],
  added_by_id: ["added_by_id", "added_by__name"],
  f2f_group_id: ["f2f_group_id", "f2f_group__title"],
  fonzip_id: ["transaction__fonzip_id"],
  recurring_order_id: ["recurring_order_id"],
  recurring_withdraw_count: ["recurring_withdraw_count"],
  recurring_total_withdraw_count: ["recurring_total_withdraw_count"],
  recurring_total_withdraw_amount: ["recurring_total_withdraw_amount"],
  transaction_id: ["transaction__transaction_id"],
  provision_no: ["transaction__provision_no"],
  auth_code: ["transaction__auth_code"],
  reference_id: ["transaction__reference_id"],
  ip_address: ["transaction__ip_address"],
  fundraising_campaign_user: [
    "fundraising_campaign__user_id",
    "fundraising_campaign__user__title",
  ],
  api_tracking_id: ["api_tracking_id"],
  news_via_phone: ["news_via_phone"],
  news_via_sms: ["news_via_sms"],
  news_via_email: ["news_via_email"],
  application: ["application_id", "application__title"],
  card_number: ["transaction__bin_number"],
  receipt_no: ["transaction__receipt_no"],
  donor_type: ["donor_type"],
  amount_visible: ["amount_visible"],
  name_hidden: ["name_hidden"],
  message: ["message"],
  show_message: ["show_message"],
  referring_name: ["referring_name"],
  referring_email: ["referring_email"],
  referring_phone: ["referring_phone"],
  bank_account__name: ["transaction__bank_account__name"],
  payment_settings__name: ["transaction__payment_settings__name"],
  recurring_cancel_reason: ["recurring_cancel_reason"],
  recurring_cancel_date: ["recurring_cancel_date"],
  recurring_start_date: ["recurring_start_date"],
  recurring_stop_date: [],
  cancelled_by_id: ["cancelled_by_id", "cancelled_by__name"],
  marketing_channel__utm_source: ["marketing_channel__utm_source"],
  marketing_channel__utm_medium: ["marketing_channel__utm_medium"],
  marketing_channel__utm_campaign: ["marketing_channel__utm_campaign"],
  marketing_channel__utm_content: ["marketing_channel__utm_content"],
};

const DEFAULT_LIST = [
  "name_surname",
  "amount",
  "sub_donation_type",
  "complete_date",
  "payment_method",
  "email_status",
];

function expectedKeys(
  values: readonly string[],
  extra: readonly string[] = [],
) {
  return [
    ...new Set([
      ...BASE,
      ...extra,
      ...values.flatMap((value) => EXPANSIONS[value] ?? []),
    ]),
  ].sort();
}

const paid = (row: SeededDonation): boolean =>
  row.transaction.payment_status === 3;

describe("getDonationList statuses", () => {
  test.each([
    ["paid", 3],
    ["refund", 4],
    ["failed", 5],
  ] as const)(
    "status=%s lists exactly the donations whose payment status is %d",
    async (status, code) => {
      const client = givingClient();
      const expected = seeded(kelder(client)).filter(
        (row) => row.transaction.payment_status === code,
      );
      const { rows, total } = await listAll(client, "getDonationList", {
        status,
      });
      expect(expected.length, "the seed has such donations").toBeGreaterThan(0);
      expect(total).toBe(expected.length);
      expect(idsOf(rows)).toEqual(seededIds(expected));
      expect(
        new Set(rows.map((row) => row.transaction__payment_status)),
      ).toEqual(new Set([code]));
    },
  );

  test("refund rows carry the refund, failed rows carry the payment error", async () => {
    const client = givingClient();
    const refunds = await listAll(client, "getDonationList", {
      status: "refund",
    });
    for (const row of refunds.rows) {
      expect(row.transaction__refund_date, `refund date of ${row.id}`).toEqual(
        expect.any(String),
      );
      expect(row.transaction__refunded_by_id).toEqual(expect.any(Number));
    }
    const failures = await listAll(client, "getDonationList", {
      status: "failed",
    });
    for (const row of failures.rows) {
      expect(row.transaction__transaction_error__code).toEqual(
        expect.any(String),
      );
      expect(row.transaction__transaction_error__text).toEqual(
        expect.any(String),
      );
      expect(row.transaction__transaction_error__group).toEqual(
        expect.any(Number),
      );
    }
    const paidRows = await listAll(client, "getDonationList", PAID);
    expect(keysOf(paidRows.rows)).not.toContain("transaction__refund_date");
    expect(keysOf(paidRows.rows)).not.toContain(
      "transaction__transaction_error__code",
    );
  });
});

describe("getDonationList filters", () => {
  const client = givingClient();
  const db = kelder(client);
  const all = seeded(db).filter(paid);
  const campaignTarget = (row: SeededDonation) =>
    row.donation.fundraising_campaign_id === null
      ? null
      : (db.fundraisingCampaigns.get(row.donation.fundraising_campaign_id)
          ?.association_campaign_target_id ?? null);
  const tracked = all.find((row) => row.donation.api_tracking_id !== null);
  const leadingZero = all.find((row) =>
    row.transaction.last_four?.startsWith("0"),
  );
  const named = all[17]?.donation.name.split(" ")[0] ?? "";

  const cases: readonly (readonly [
    string,
    Readonly<Record<string, QueryValue>>,
    (row: SeededDonation) => boolean,
  ])[] = [
    [
      "category_id",
      { category_id: 202 },
      (row) => row.donation.sub_donation_type_id === 202,
    ],
    [
      "no_category",
      { no_category: true },
      (row) => row.donation.sub_donation_type_id === null,
    ],
    [
      "category_id wins over no_category",
      { category_id: 204, no_category: true },
      (row) => row.donation.sub_donation_type_id === 204,
    ],
    [
      "donation_page",
      { donation_page: 31 },
      (row) => row.donation.fundraising_page_id === 31,
    ],
    [
      "fundraising_campaign",
      { fundraising_campaign: 801 },
      (row) => row.donation.fundraising_campaign_id === 801,
    ],
    [
      "association_campaign_target",
      { association_campaign_target: 851 },
      (row) => campaignTarget(row) === 851,
    ],
    [
      "payment_settings_id",
      { payment_settings_id: 72 },
      (row) => row.transaction.payment_settings_id === 72,
    ],
    [
      "bank_account_id",
      { bank_account_id: 82 },
      (row) => row.transaction.bank_account_id === 82,
    ],
    [
      "utm_source repeated as an IN-list",
      { utm_source: ["google", "instagram"] },
      (row) =>
        row.channel?.utm_source === "google" ||
        row.channel?.utm_source === "instagram",
    ],
    [
      "utm_medium",
      { utm_medium: ["email"] },
      (row) => row.channel?.utm_medium === "email",
    ],
    [
      "utm_campaign",
      { utm_campaign: ["burs-2026", "ekim-bulteni"] },
      (row) =>
        row.channel?.utm_campaign === "burs-2026" ||
        row.channel?.utm_campaign === "ekim-bulteni",
    ],
    [
      "utm_content",
      { utm_content: ["arama-metni"] },
      (row) => row.channel?.utm_content === "arama-metni",
    ],
    [
      "UTM filters combine with AND",
      { utm_source: ["google"], utm_campaign: ["kurban-2026"] },
      (row) =>
        row.channel?.utm_source === "google" &&
        row.channel.utm_campaign === "kurban-2026",
    ],
    [
      "marketing_channel_null overrides the UTM filters",
      { marketing_channel_null: true, utm_source: ["google"] },
      (row) => row.channel === undefined,
    ],
    [
      "api_tracking_id",
      { api_tracking_id: tracked?.donation.api_tracking_id ?? "" },
      (row) =>
        row.donation.api_tracking_id === tracked?.donation.api_tracking_id,
    ],
    [
      "recurring=1",
      { recurring: 1 },
      (row) => row.donation.recurring_order_id !== null,
    ],
    [
      "recurring=0",
      { recurring: 0 },
      (row) => row.donation.recurring_order_id === null,
    ],
    [
      "donor_type=corporate",
      { donor_type: "corporate" },
      (row) => row.donation.donor_type === "corporate",
    ],
    [
      "donor_type=personal",
      { donor_type: "personal" },
      (row) => row.donation.donor_type === "personal",
    ],
    [
      "amount alone means equal",
      { amount: 500 },
      (row) => row.transaction.amount === 500,
    ],
    [
      "amt_cnd !=",
      { amount: 500, amt_cnd: "!=" },
      (row) => row.transaction.amount !== 500,
    ],
    [
      "amt_cnd <",
      { amount: 500, amt_cnd: "<" },
      (row) => row.transaction.amount < 500,
    ],
    [
      "amt_cnd <=",
      { amount: 500, amt_cnd: "<=" },
      (row) => row.transaction.amount <= 500,
    ],
    [
      "amt_cnd >",
      { amount: 500, amt_cnd: ">" },
      (row) => row.transaction.amount > 500,
    ],
    [
      "amt_cnd >=",
      { amount: 500, amt_cnd: ">=" },
      (row) => row.transaction.amount >= 500,
    ],
    [
      "payment_method",
      { payment_method: 2 },
      (row) => row.transaction.payment_method === 2,
    ],
    [
      "bin_number",
      { bin_number: 454360 },
      (row) => row.transaction.bin_number === "454360",
    ],
    [
      "last_four, whose leading zero an integer cannot carry",
      { last_four: Number(leadingZero?.transaction.last_four) },
      (row) => row.transaction.last_four === leadingZero?.transaction.last_four,
    ],
    [
      "query matches the donor name",
      { query: named.toLocaleLowerCase("tr-TR") },
      (row) =>
        row.donation.name
          .toLocaleLowerCase("tr-TR")
          .includes(named.toLocaleLowerCase("tr-TR")),
    ],
    [
      "a leading minus excludes query matches",
      { query: `-${named}` },
      (row) =>
        !row.donation.name
          .toLocaleLowerCase("tr-TR")
          .includes(named.toLocaleLowerCase("tr-TR")),
    ],
    [
      "start_date and end_date bound the complete date",
      {
        start_date: "2026-06-01T00:00:00+03:00",
        end_date: "2026-07-01T00:00:00+03:00",
      },
      (row) =>
        Date.parse(row.transaction.complete_date) >=
          Date.parse("2026-06-01T00:00:00+03:00") &&
        Date.parse(row.transaction.complete_date) <=
          Date.parse("2026-07-01T00:00:00+03:00"),
    ],
  ];

  test.each(cases)("%s", async (_name, query, matches) => {
    const expected = all.filter(matches);
    expect(
      expected.length,
      "the filter matches seeded donations",
    ).toBeGreaterThan(0);
    expect(
      expected.length,
      "the filter excludes seeded donations",
    ).toBeLessThan(all.length);
    const { rows, total } = await listAll(client, "getDonationList", {
      ...PAID,
      ...query,
    });
    expect(total).toBe(expected.length);
    expect(idsOf(rows)).toEqual(seededIds(expected));
  });

  test("recurring=-1, no_category=false and marketing_channel_null=false filter nothing", async () => {
    const queries: readonly Readonly<Record<string, QueryValue>>[] = [
      { recurring: -1 },
      { no_category: false },
      { marketing_channel_null: false },
    ];
    for (const query of queries) {
      const { total } = await listAll(client, "getDonationList", {
        ...PAID,
        ...query,
      });
      expect(total, JSON.stringify(query)).toBe(all.length);
    }
  });

  test("filters combine", async () => {
    const expected = all.filter(
      (row) =>
        row.transaction.payment_method === 0 &&
        row.donation.sub_donation_type_id === 202 &&
        row.transaction.amount >= 250,
    );
    const { rows } = await listAll(client, "getDonationList", {
      ...PAID,
      payment_method: 0,
      category_id: 202,
      amount: 250,
      amt_cnd: ">=",
    });
    expect(idsOf(rows)).toEqual(seededIds(expected));
  });
});

describe("getDonationList ordering and paging", () => {
  const compareName = (a: DonationResult, b: DonationResult) =>
    (a.name ?? "").localeCompare(b.name ?? "", "tr", { sensitivity: "base" });
  const orderings: readonly (readonly [
    string,
    (a: DonationResult, b: DonationResult) => number,
  ])[] = [
    ["name", compareName],
    ["-name", (a, b) => compareName(b, a)],
    [
      "transaction__amount",
      (a, b) => (a.transaction__amount ?? 0) - (b.transaction__amount ?? 0),
    ],
    [
      "-transaction__amount",
      (a, b) => (b.transaction__amount ?? 0) - (a.transaction__amount ?? 0),
    ],
    [
      "transaction__complete_date",
      (a, b) =>
        Date.parse(a.transaction__complete_date ?? "") -
        Date.parse(b.transaction__complete_date ?? ""),
    ],
    [
      "-transaction__complete_date",
      (a, b) =>
        Date.parse(b.transaction__complete_date ?? "") -
        Date.parse(a.transaction__complete_date ?? ""),
    ],
  ];

  test.each(orderings)(
    "order_by=%s, ties broken by id",
    async (orderBy, compare) => {
      const client = givingClient();
      const { rows } = await listAll(client, "getDonationList", {
        ...PAID,
        order_by: orderBy,
        list: ["name_surname", "amount", "complete_date"],
      });
      const sorted = [...rows].sort(
        (a, b) => compare(a, b) || (a.id ?? 0) - (b.id ?? 0),
      );
      expect(rows.map((row) => row.id)).toEqual(sorted.map((row) => row.id));
      expect(
        new Set(rows.map((row) => row.transaction__amount)).size,
        "amount ties exist, so the id tie-break is exercised",
      ).toBeLessThan(rows.length);
    },
  );

  test("the default order is newest first", async () => {
    const client = givingClient();
    const { rows } = await listAll(client, "getDonationList", PAID);
    const dates = rows.map((row) =>
      Date.parse(row.transaction__complete_date ?? ""),
    );
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  test("pages slice the ordered list and keep the full total", async () => {
    const client = givingClient();
    const { rows } = await listAll(client, "getDonationList", PAID);
    const third = await client.ok("getDonationList", {
      query: { ...ALL_TIME, ...PAID, start_page: 3, how_many: 7 },
    });
    expect(third.total).toBe(rows.length);
    expect(idsOf(third.donation_list ?? [])).toEqual(idsOf(rows.slice(14, 21)));
    expect(third.donation_list?.map((row) => row.id)).toEqual(
      rows.slice(14, 21).map((row) => row.id),
    );
    const lastPage = Math.ceil(rows.length / 50);
    const last = await client.ok("getDonationList", {
      query: { ...ALL_TIME, ...PAID, start_page: lastPage, how_many: 50 },
    });
    expect(last.donation_list?.length, "the last page is partial").toBe(
      rows.length - (lastPage - 1) * 50,
    );
    const beyond = await client.ok("getDonationList", {
      query: { ...ALL_TIME, ...PAID, start_page: lastPage + 1, how_many: 50 },
    });
    expect(beyond).toEqual({ donation_list: [], total: rows.length });
  });
});

describe("getDonationList field projection", () => {
  test("without list, rows carry the base set and the default fields", async () => {
    const client = givingClient();
    const { rows } = await listAll(client, "getDonationList", PAID);
    expect(keysOf(rows)).toEqual(expectedKeys(DEFAULT_LIST));
  });

  test.each(Object.keys(EXPANSIONS))(
    "list=%s adds exactly its documented fields",
    async (value) => {
      const client = givingClient();
      const { rows } = await listAll(client, "getDonationList", {
        ...PAID,
        list: [value],
      });
      expect(keysOf(rows)).toEqual(expectedKeys([value]));
    },
  );

  test("repeated list values add up, and status adds its own fields", async () => {
    const client = givingClient();
    const { rows } = await listAll(client, "getDonationList", {
      status: "refund",
      list: ["amount", "card_number", "fonzip_id"],
    });
    expect(keysOf(rows)).toEqual(
      expectedKeys(
        ["amount", "card_number", "fonzip_id"],
        ["transaction__refund_date", "transaction__refunded_by_id"],
      ),
    );
    const failed = await listAll(client, "getDonationList", {
      status: "failed",
      list: ["phone"],
    });
    expect(
      keysOf(failed.rows),
      "failed card payments were never edited, so no updated_by_id",
    ).toEqual(
      expectedKeys(
        ["phone"],
        [
          "transaction__transaction_error__code",
          "transaction__transaction_error__text",
          "transaction__transaction_error__group",
        ],
      ).filter((key) => key !== "updated_by_id"),
    );
  });

  test("projected values come from the donation and its joins", async () => {
    const client = givingClient();
    const db = kelder(client);
    const { rows } = await listAll(client, "getDonationList", {
      ...PAID,
      list: Object.keys(EXPANSIONS),
    });
    for (const row of rows) {
      const donation = db.donations.get(row.id ?? 0);
      const transaction = db.transactions.get(donation?.transaction_id ?? 0);
      if (!donation || !transaction) throw new Error(`row ${row.id} unknown`);
      const channel =
        donation.marketing_channel_id === null
          ? undefined
          : db.marketingChannels.get(donation.marketing_channel_id);
      const campaign =
        donation.fundraising_campaign_id === null
          ? undefined
          : db.fundraisingCampaigns.get(donation.fundraising_campaign_id);
      expect(row).toMatchObject({
        user_id: donation.user_id,
        name: donation.name,
        transaction__amount: transaction.amount,
        transaction__fonzip_id: transaction.fonzip_id,
        transaction__receipt_no: transaction.receipt_no,
        donor_type: donation.donor_type,
        message: donation.message,
      });
      expect(row.sub_donation_type__name).toBe(
        donation.sub_donation_type_id === null
          ? undefined
          : db.donationCategories.get(donation.sub_donation_type_id)?.name,
      );
      expect(row.marketing_channel__utm_source).toBe(channel?.utm_source);
      expect(row.fundraising_campaign__title).toBe(campaign?.title);
      expect(row.transaction__bin_number).toBe(
        transaction.bin_number ?? undefined,
      );
      if (donation.recurring_cancel_date !== null) {
        // Istanbul midnight of the stored day, as the same instant in UTC.
        expect(row.recurring_cancel_date).toBe(
          new Date(
            `${donation.recurring_cancel_date}T00:00:00+03:00`,
          ).toISOString(),
        );
      }
    }
  });
});

describe("getDonationList refusals", () => {
  test("refuses a date range that does not move forward", async () => {
    const client = givingClient();
    const response = await client.call("getDonationList", {
      query: {
        ...PAID,
        start_page: 1,
        how_many: 10,
        start_date: "2026-06-01T00:00:00+03:00",
        end_date: "2026-06-01T00:00:00+03:00",
      },
    });
    expect(response).toMatchObject({
      status: 400,
      body: { error: "start_date must be before end_date" },
    });
  });
});

const FILTER_IDS: readonly string[] = [
  "category_id",
  "donation_page",
  "fundraising_campaign",
  "association_campaign_target",
  "payment_settings_id",
  "bank_account_id",
];

function ornekFilterIds(client: TestClient): Readonly<Record<string, number>> {
  const ornek = orgStore(client.mock.runtime.world().store, "ornek");
  return {
    payment_settings_id: ornek.paymentSettings.list()[0]?.id ?? 0,
    bank_account_id: ornek.bankAccounts.list()[0]?.id ?? 0,
  };
}

describe("getDonationList filter ids that name no object", () => {
  test.each([...FILTER_IDS])(
    "an unknown %s matches nothing",
    async (parameter) => {
      const client = givingClient();
      const body = await client.ok("getDonationList", {
        query: {
          ...ALL_TIME,
          ...PAID,
          start_page: 1,
          how_many: 10,
          [parameter]: 9,
        },
      });
      expect(body).toEqual({ donation_list: [], total: 0 });
    },
  );

  test("another organisation's payment settings and bank account match nothing", async () => {
    const client = givingClient();
    for (const [parameter, id] of Object.entries(ornekFilterIds(client))) {
      expect(id, parameter).toBeGreaterThan(0);
      const body = await client.ok("getDonationList", {
        query: {
          ...ALL_TIME,
          ...PAID,
          start_page: 1,
          how_many: 10,
          [parameter]: id,
        },
      });
      expect(body, parameter).toEqual({ donation_list: [], total: 0 });
    }
  });
});

const MICRO_LIST = Object.keys(EXPANSIONS).filter(
  (value) => !value.startsWith("marketing_channel__"),
);

describe("getMicroDonationList", () => {
  test.each([
    ["paid", 3],
    ["refund", 4],
    ["failed", 5],
  ] as const)(
    "status=%s lists the micro donations in that state",
    async (status, code) => {
      const client = givingClient();
      const expected = seeded(kelder(client), "microDonations").filter(
        (row) => row.transaction.payment_status === code,
      );
      const { rows } = await listAll(client, "getMicroDonationList", {
        status,
      });
      expect(expected.length).toBeGreaterThan(0);
      expect(idsOf(rows)).toEqual(seededIds(expected));
    },
  );

  test("applies the donation filters to micro donations", async () => {
    const client = givingClient();
    const db = kelder(client);
    const all = seeded(db, "microDonations").filter(paid);
    const target = (row: SeededDonation) =>
      row.donation.fundraising_campaign_id === null
        ? null
        : (db.fundraisingCampaigns.get(row.donation.fundraising_campaign_id)
            ?.association_campaign_target_id ?? null);
    const first = all[0];
    if (!first) throw new Error("no paid micro donation");
    const cases: readonly (readonly [
      Readonly<Record<string, QueryValue>>,
      (row: SeededDonation) => boolean,
    ])[] = [
      [{ amount: 20, amt_cnd: ">" }, (row) => row.transaction.amount > 20],
      [
        { category_id: 201 },
        (row) => row.donation.sub_donation_type_id === 201,
      ],
      [{ donation_page: 31 }, (row) => row.donation.fundraising_page_id === 31],
      [
        { fundraising_campaign: 801 },
        (row) => row.donation.fundraising_campaign_id === 801,
      ],
      [{ association_campaign_target: 851 }, (row) => target(row) === 851],
      [
        { payment_settings_id: 71 },
        (row) => row.transaction.payment_settings_id === 71,
      ],
      [
        { bank_account_id: 81 },
        (row) => row.transaction.bank_account_id === 81,
      ],
      [{ payment_method: 3 }, (row) => row.transaction.payment_method === 3],
      [{ recurring: 1 }, (row) => row.donation.recurring_order_id !== null],
      [{ recurring: 0 }, (row) => row.donation.recurring_order_id === null],
      [
        { api_tracking_id: "trk-mikro-000001" },
        (row) => row.donation.api_tracking_id === "trk-mikro-000001",
      ],
      [
        { donor_type: "personal" },
        (row) => row.donation.donor_type === "personal",
      ],
      [
        { bin_number: Number(first.transaction.bin_number) },
        (row) => row.transaction.bin_number === first.transaction.bin_number,
      ],
      [
        { last_four: Number(first.transaction.last_four) },
        (row) => row.transaction.last_four === first.transaction.last_four,
      ],
      [
        { query: first.donation.name },
        (row) => row.donation.name.includes(first.donation.name),
      ],
    ];
    for (const [query, matches] of cases) {
      const expected = all.filter(matches);
      expect(expected.length, JSON.stringify(query)).toBeGreaterThan(0);
      const { rows } = await listAll(client, "getMicroDonationList", {
        ...PAID,
        ...query,
      });
      expect(idsOf(rows), JSON.stringify(query)).toEqual(seededIds(expected));
    }
    const uncategorized = await listAll(client, "getMicroDonationList", {
      ...PAID,
      no_category: true,
    });
    expect(uncategorized.total, "every micro donation has a category").toBe(0);
  });

  test("orders micro donations and projects the requested fields", async () => {
    const client = givingClient();
    const { rows } = await listAll(client, "getMicroDonationList", {
      ...PAID,
      order_by: "transaction__amount",
      list: ["amount", "module"],
    });
    const amounts = rows.map((row) => row.transaction__amount ?? 0);
    expect(amounts).toEqual([...amounts].sort((a, b) => a - b));
    expect(keysOf(rows)).toEqual(expectedKeys(["amount", "module"]));
    const everything = await listAll(client, "getMicroDonationList", {
      ...PAID,
      list: MICRO_LIST,
    });
    expect(keysOf(everything.rows)).toEqual(expectedKeys(MICRO_LIST));
  });

  test("filter ids that name no object match nothing, and a reversed range gets 400", async () => {
    const client = givingClient();
    const base = { ...PAID, start_page: 1, how_many: 10 };
    const unmatched = [
      ...FILTER_IDS.map((parameter) => [parameter, 9] as const),
      ...Object.entries(ornekFilterIds(client)),
    ];
    for (const [parameter, id] of unmatched) {
      const body = await client.ok("getMicroDonationList", {
        query: { ...ALL_TIME, ...base, [parameter]: id },
      });
      expect(body, `${parameter}=${id}`).toEqual({
        donation_list: [],
        total: 0,
      });
    }
    const reversed = await client.call("getMicroDonationList", {
      query: {
        ...base,
        start_date: ALL_TIME.end_date,
        end_date: ALL_TIME.start_date,
      },
    });
    expect(reversed.status).toBe(400);
  });
});
