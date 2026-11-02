import { describe, expect, test } from "bun:test";

import { PRODUCTION_CORRECTIONS } from "../src/spec/production";
import { isJsonObject, type Json } from "../src/spec/json";
import { specRuntime } from "../src/spec/runtime";
import { createTestClient, type TestClient } from "../src/testing/client";
import { kelder } from "./dues-events-support";

// What `bun run parity:prod --live` showed for the dues area, as the runner
// asks for it: the last 365 days, status paid, page 1 of 20 rows. Probes P11
// to P15 in the evidence name the shapes below.
const PAGE = { start_page: 1, how_many: 20 } as const;

function istanbul(date: Date): string {
  return new Date(date.getTime() + 3 * 3_600_000)
    .toISOString()
    .replace(/\.\d+Z$/, "+03:00");
}

async function firstPage(client: TestClient) {
  const now = client.mock.runtime.clock.now();
  const body = await client.ok("getMembershipDuesList", {
    query: {
      status: "paid",
      start_date: istanbul(new Date(now.getTime() - 365 * 86_400_000)),
      end_date: istanbul(now),
      ...PAGE,
    },
  });
  return body.payment_list ?? [];
}

async function firstPayment(client: TestClient) {
  const row = (await firstPage(client))[0];
  if (row?.id === undefined || row.user_id === undefined) {
    throw new Error("there is no paid payment in the last 365 days");
  }
  return { id: row.id, userId: row.user_id };
}

// Production's payment_list rows (P11) had these keys and no others.
const PAID_ROW_KEYS = [
  "details",
  "email",
  "first_name",
  "id",
  "last_name",
  "period",
  "phone",
  "tckno",
  "transaction__amount",
  "transaction__complete_date",
  "transaction__currency__display",
  "transaction__currency__iso_code",
  "transaction__fonzip_framework",
  "transaction__fonzip_id",
  "transaction__payment_method",
  "transaction__payment_status",
  "user__name",
  "user_id",
];

// The keys production sent as null on some rows and as a string on others.
const SPARSE_PAID_KEYS = ["email", "phone", "tckno", "details", "period"];

describe("getMembershipDuesList as production answers it", () => {
  test("sends payment_list with production's keys, five of them null on some rows", async () => {
    const client = createTestClient();
    const rows = await firstPage(client);
    expect(rows.length, "a full first page").toBe(20);
    for (const row of rows) {
      expect(Object.keys(row).sort(), `row ${row.id}`).toEqual(PAID_ROW_KEYS);
    }
    const read = (row: object, key: string): unknown =>
      Object.entries(row).find(([name]) => name === key)?.[1];
    for (const key of PAID_ROW_KEYS) {
      const values = rows.map((row) => read(row, key));
      if (SPARSE_PAID_KEYS.includes(key)) {
        expect(values, `${key} is null on some rows`).toContain(null);
        expect(
          values.some((value) => typeof value === "string"),
          `${key} is a string on others`,
        ).toBe(true);
      } else {
        expect(values, `${key} is never null`).not.toContain(null);
      }
    }
    expect(rows[0]?.transaction__currency__iso_code).toBe("TRY");
  });
});

describe("getMembershipDueDetails as production answered for its first payment", () => {
  test("is null where production was null and filled where it was not", async () => {
    const client = createTestClient();
    const { id, userId } = await firstPayment(client);
    const body = await client.ok("getMembershipDueDetails", {
      path: { subscription_id: id },
    });
    expect(body.subscription).toMatchObject({
      id,
      user_id: userId,
      status: 2,
      status_name: "Ödeme",
      bill_no: null,
      card_info: null,
      debt_category: null,
      details: null,
      due_date: null,
      order_id: null,
      recurring_next_cycle: null,
      remove_note: null,
      create_date: expect.any(String),
      added_by_id: expect.any(Number),
      added_by__name: expect.any(String),
      email: expect.any(String),
      phone: expect.any(String),
      user: {
        id: userId,
        email: expect.any(String),
        phone: expect.any(String),
        profile_pic: expect.any(String),
        tax_department: null,
        total_financial: expect.any(Number),
      },
      transaction: {
        auth_code: null,
        bin_number: null,
        cardholder_name: null,
        last_four: null,
        order_id: null,
        payment_settings: null,
        payment_settings_id: null,
        provision_no: null,
        reference_id: null,
        refund_date: null,
        refund_reason: null,
        refunded_by_id: null,
        city: expect.any(String),
        country: expect.any(String),
        ip_address: expect.any(String),
        transaction_type: 2,
        payment_status: 3,
        // Not a card: the first payment was keyed in as a transfer or a POS slip.
        payment_method: expect.any(Number),
      },
    });
    expect(body.subscription?.transaction?.payment_method).not.toBe(0);
  });

  test("keeps a card payment's card, order and gateway ids", async () => {
    const client = createTestClient();
    const db = kelder(client);
    const card = db.subscriptions.find(
      (row) =>
        row.status === 2 &&
        db.transactions.get(row.transaction_id ?? 0)?.payment_method === 0,
    );
    const body = await client.ok("getMembershipDueDetails", {
      path: { subscription_id: card?.id ?? 0 },
    });
    expect(body.subscription?.transaction).toMatchObject({
      payment_method: 0,
      tds: true,
      bin_number: expect.any(String),
      last_four: expect.any(String),
      reference_id: expect.any(String),
      order_id: expect.any(String),
      auth_code: expect.any(String),
    });
  });
});

describe("getMembershipDueDebtsList and getDebtDetails as production answered", () => {
  test("lists debts without a category or a note on page 1, and a remove_note on every row", async () => {
    const client = createTestClient();
    const body = await client.ok("getMembershipDueDebtsList", { query: PAGE });
    const rows = body.debt_list ?? [];
    expect(rows.length).toBe(20);
    expect(
      rows.map((row) => row.remove_note),
      "remove_note is null on every seeded page-1 row",
    ).toEqual(rows.map(() => null));
    const plain = rows.filter((row) => row.debt_category_id === null);
    expect(plain.length, "some page-1 debts have no category").toBeGreaterThan(
      0,
    );
    for (const row of plain) {
      expect(row, `debt ${row.id}`).toMatchObject({
        debt_category__name: null,
        details: null,
      });
    }
    expect(
      rows.some((row) => row.debt_category_id !== null),
      "and some keep theirs",
    ).toBe(true);
    for (const row of rows) {
      expect(typeof row.user__total_financial, `debt ${row.id}`).toBe("number");
    }
  });

  test("details the newest debt as production's first debt: nothing paid, no id number", async () => {
    const client = createTestClient();
    const list = await client.ok("getMembershipDueDebtsList", { query: PAGE });
    const first = list.debt_list?.[0];
    const body = await client.ok("getDebtDetails", {
      path: { debt_id: first?.id ?? 0 },
    });
    expect(body.subscription).toMatchObject({
      status: 8,
      bill_no: null,
      card_info: null,
      debt_category: null,
      details: null,
      due_date: null,
      recurring_next_cycle: null,
      remove_note: null,
      updated_by_id: null,
      last_update_date: null,
      tckno: null,
      // The email and the phone of the debt's member are on file.
      email: expect.any(String),
      phone: expect.any(String),
      order_id: expect.any(String),
      create_date: expect.any(String),
      user: {
        tckno: null,
        email: expect.any(String),
        phone: expect.any(String),
        profile_pic: expect.any(String),
        tax_department: null,
        total_financial: expect.any(Number),
      },
      transaction: {
        payment_status: 0,
        transaction_type: 2,
        payment_method: null,
        bank_account: null,
        bank_account_id: null,
        ip_address: null,
        city: null,
        country: null,
        receipt_no: null,
        transaction_id: null,
        reference_id: null,
        order_id: null,
        conversation_id: expect.stringMatching(/^\d{15}$/),
      },
    });
  });
});

describe("getUsersMembershipDueList as production answered for a paying user", () => {
  test("sends null where production did, and a string where it did too", async () => {
    const client = createTestClient();
    const { userId } = await firstPayment(client);
    const body = await client.ok("getUsersMembershipDueList", {
      path: { user_id: userId },
      query: { listing: "a", ...PAGE },
    });
    const rows = body.subscription_list ?? [];
    expect(rows.length).toBeGreaterThan(2);
    expect(body.total).toBe(rows.length);
    const read = (row: object, key: string): unknown =>
      Object.entries(row).find(([name]) => name === key)?.[1];
    for (const key of ["details", "period"]) {
      const values = rows.map((row) => read(row, key));
      expect(values, `${key} is null on a payment`).toContain(null);
      expect(
        values.some((value) => typeof value === "string"),
        `${key} is a string on a debt`,
      ).toBe(true);
    }
    for (const row of rows) {
      expect(row, `row ${row.id}`).toMatchObject({
        remove_note: null,
        transaction__converted: false,
        transaction__conversion_rate: null,
        transaction__converted_amount: null,
        transaction__converted_currency__display: null,
      });
      expect(
        row,
        "production never sends the fonzip id here",
      ).not.toHaveProperty("transaction__fonzip_id");
    }
    expect(
      rows.map((row) => row.bill_no),
      "bill_no is null on the seeded rows",
    ).toContain(null);
    expect(rows.map((row) => row.due_date)).toContain(null);
  });
});

function schemaAt(pointer: string): Json {
  let node: Json = specRuntime().spec;
  for (const raw of pointer.slice(2).split("/")) {
    const segment = raw.replaceAll("~1", "/").replaceAll("~0", "~");
    node = Array.isArray(node)
      ? (node[Number(segment)] ?? null)
      : isJsonObject(node)
        ? (node[segment] ?? null)
        : null;
  }
  return node;
}

describe("the dues corrections", () => {
  test("each says what production showed, and points at a schema or a parameter", () => {
    const corrections = PRODUCTION_CORRECTIONS.dues ?? [];
    expect(corrections.length).toBeGreaterThan(0);
    for (const correction of corrections) {
      expect(correction.evidence.length, correction.at).toBeGreaterThan(40);
      expect(isJsonObject(schemaAt(correction.at)), correction.at).toBe(true);
    }
  });

  test("make the corrected spec say what production answers", () => {
    const { table } = specRuntime();
    const status = table.byOperationId
      .get("getMembershipDuesList")
      ?.parameters.find((parameter) => parameter.name === "status");
    expect(status?.required, "status is optional").toBe(false);
    expect(status?.schema.default, "and defaults to paid").toBe("paid");
    const response = schemaAt(
      "#/components/responses/MembershipDuesListResponse/content/application~1json/schema",
    );
    expect(
      isJsonObject(response) && isJsonObject(response.properties)
        ? Object.keys(response.properties)
        : [],
    ).toEqual(["payment_list", "total"]);
    const transaction = schemaAt("#/components/schemas/Transaction");
    const properties =
      isJsonObject(transaction) && isJsonObject(transaction.properties)
        ? transaction.properties
        : {};
    expect(properties.conversation_id).toMatchObject({ type: "string" });
    for (const name of [
      "association_id",
      "cardholder_name",
      "city",
      "country",
      "tds",
      "transaction_type",
    ]) {
      expect(properties[name], name).toBeDefined();
    }
  });
});
