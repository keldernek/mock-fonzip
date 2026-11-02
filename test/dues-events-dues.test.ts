import { describe, expect, test } from "bun:test";

import { createTestClient, type TestClient } from "../src/testing/client";
import {
  collect,
  EVER,
  expectOrdered,
  expectSplit,
  ids,
  kelder,
  sortedIds,
  PAGE,
  type Query,
} from "./dues-events-support";

function duesList(client: TestClient, query: Query) {
  return collect(async (start) => {
    const body = await client.ok("getMembershipDuesList", {
      query: {
        ...EVER,
        status: "paid",
        ...query,
        start_page: start,
        how_many: 100,
      },
    });
    return { rows: body.payment_list, total: body.total };
  });
}

function transactionOf(client: TestClient, subscriptionId: number | undefined) {
  const db = kelder(client);
  const row = db.subscriptions.get(subscriptionId ?? 0);
  return row?.transaction_id == null
    ? undefined
    : db.transactions.get(row.transaction_id);
}

describe("getMembershipDuesList", () => {
  test("lists successful payments, refunds and failed payments apart", async () => {
    const client = createTestClient();
    const db = kelder(client);
    const paid = await duesList(client, {});
    const successfulPayments = db.subscriptions.list(
      (row) =>
        row.status === 2 &&
        db.transactions.get(row.transaction_id ?? 0)?.payment_status === 3,
    );
    expect(sortedIds(paid)).toEqual(sortedIds(successfulPayments));
    expect(paid.every((row) => row.transaction__payment_status === 3)).toBe(
      true,
    );
    const refunded = db.subscriptions.list(
      (row) =>
        row.status === 2 &&
        db.transactions.get(row.transaction_id ?? 0)?.payment_status === 4,
    );
    expect(refunded.length, "seeded refunded payments").toBeGreaterThan(0);
    expect(
      ids(paid).some((id) => ids(refunded).includes(id)),
      "a refunded payment is not listed as paid",
    ).toBe(false);
    const refunds = await duesList(client, { status: "refund" });
    expect(sortedIds(refunds)).toEqual(
      sortedIds(db.subscriptions.list((row) => row.status === 4)),
    );
    expect(
      refunds.every(
        (row) =>
          row.transaction__payment_status === 4 &&
          row.transaction__refund_date !== undefined,
      ),
    ).toBe(true);
    expect(
      await duesList(client, { status: "failed" }),
      "no seeded failure",
    ).toEqual([]);
    const debt = db.subscriptions.find((row) => row.status === 1);
    expect(ids(paid)).not.toContain(debt?.id);
  });

  test("keeps payments whose transaction completed inside the date range", async () => {
    const client = createTestClient();
    const all = await duesList(client, {});
    const range = {
      start_date: "2026-01-01T00:00:00+03:00",
      end_date: "2026-03-01T00:00:00+03:00",
    };
    expectSplit(
      all,
      await duesList(client, range),
      (row) => {
        const at = Date.parse(row.transaction__complete_date ?? "");
        return (
          at >= Date.parse(range.start_date) && at <= Date.parse(range.end_date)
        );
      },
      "start_date and end_date",
    );
    const reversed = await client.call("getMembershipDuesList", {
      query: {
        ...PAGE,
        status: "paid",
        start_date: range.end_date,
        end_date: range.start_date,
      },
    });
    expect(reversed.status).toBe(400);
    expect(reversed.body).toEqual({
      error: "start_date must be before end_date",
    });
    const missing = await client.call("getMembershipDuesList", {
      query: { ...PAGE, status: "paid" },
    });
    expect(missing.status, "the date range is required").toBe(400);
  });

  test("lists the paid payments when status is left out", async () => {
    const client = createTestClient();
    const paid = await client.ok("getMembershipDuesList", {
      query: { ...PAGE, ...EVER, status: "paid" },
    });
    const noStatus = await client.call("getMembershipDuesList", {
      query: { ...PAGE, ...EVER },
    });
    expect(noStatus.status, "status is optional").toBe(200);
    expect(noStatus.body, "production answers exactly the paid rows").toEqual(
      paid,
    );
    expect(
      paid.payment_list?.length,
      "there are paid rows to compare",
    ).toBeGreaterThan(0);
    expect(Object.keys(paid).sort(), "the list is payment_list").toEqual([
      "payment_list",
      "total",
    ]);
    const unknown = await client.call("getMembershipDuesList", {
      query: { ...PAGE, ...EVER, status: "other" },
    });
    expect(unknown.status, "an unknown status is still refused").toBe(400);
  });

  test("filters by period, amount and card details", async () => {
    const client = createTestClient();
    await client.ok("createDebt", {
      body: {
        user_id: 1010,
        amount: 640,
        period: "2026-06-01",
        add_payment: true,
        custom_amount: "custom",
        payment_method: 1,
      },
    });
    const all = await duesList(client, {});
    expectSplit(
      all,
      await duesList(client, { period_year: 2025 }),
      (row) => row.period?.startsWith("2025-") === true,
      "period_year",
    );
    expectSplit(
      all,
      await duesList(client, { period_month: 6 }),
      (row) => row.period?.slice(5, 7) === "06",
      "period_month",
    );
    const conditions = {
      "=": (amount: number) => amount === 1200,
      "!=": (amount: number) => amount !== 1200,
      "<": (amount: number) => amount < 1200,
      "<=": (amount: number) => amount <= 1200,
      ">": (amount: number) => amount > 1200,
      ">=": (amount: number) => amount >= 1200,
    } as const;
    for (const [condition, keep] of Object.entries(conditions)) {
      expectSplit(
        all,
        await duesList(
          client,
          condition === "="
            ? { amount: 1200 }
            : { amount: 1200, amt_cnd: condition },
        ),
        (row) => keep(row.transaction__amount ?? 0),
        `amount ${condition}`,
      );
    }
    const card = all.find((row) => row.transaction__payment_method === 0);
    const cardTx = transactionOf(client, card?.id);
    expectSplit(
      all,
      await duesList(client, { bin_number: Number(cardTx?.bin_number) }),
      (row) => transactionOf(client, row.id)?.bin_number === cardTx?.bin_number,
      "bin_number",
    );
    expectSplit(
      all,
      await duesList(client, { last_four: Number(cardTx?.last_four) }),
      (row) =>
        Number(transactionOf(client, row.id)?.last_four) ===
        Number(cardTx?.last_four),
      "last_four",
    );
    expect(
      ids(await duesList(client, { installment_count: 1 })),
      "every dues payment is one installment",
    ).toEqual(ids(all));
    expect(await duesList(client, { installment_count: 3 })).toEqual([]);
    expectSplit(
      all,
      await duesList(client, { payment_method: 2 }),
      (row) => row.transaction__payment_method === 2,
      "payment_method",
    );
  });

  test("filters by the member, the admin who added it, creation date and text", async () => {
    const client = createTestClient();
    const db = kelder(client);
    const all = await duesList(client, {});
    expectSplit(
      all,
      await duesList(client, { tag_id: 108 }),
      (row) =>
        db.userTags.find(
          (link) => link.user_id === row.user_id && link.tag_id === 108,
        ) !== undefined,
      "tag_id",
    );
    const member = db.users.get(all[0]?.user_id ?? 0);
    expectSplit(
      all,
      await duesList(client, { membership_no: member?.membership_no ?? 0 }),
      (row) => row.user_id === member?.id,
      "membership_no",
    );
    const addedBy = (id: number | undefined) =>
      db.subscriptions.get(id ?? 0)?.added_by_id ?? null;
    expectSplit(
      all,
      await duesList(client, { added_by_id: 1001 }),
      (row) => addedBy(row.id) === 1001,
      "added_by_id",
    );
    expectSplit(
      all,
      await duesList(client, { added_by__name: "ümüt KORKMAZ" }),
      (row) => addedBy(row.id) === 1001,
      "added_by__name ignores case and accents",
    );
    const pivot = "2026-03-01T00:00:00+03:00";
    const created = (id: number | undefined) =>
      Date.parse(db.subscriptions.get(id ?? 0)?.create_date ?? "");
    expectSplit(
      all,
      await duesList(client, { create_date: pivot, create_date_cnd: "<" }),
      (row) => created(row.id) < Date.parse(pivot),
      "create_date <",
    );
    expectSplit(
      all,
      await duesList(client, { create_date: pivot, create_date_cnd: ">" }),
      (row) => created(row.id) > Date.parse(pivot),
      "create_date >",
    );
    const sameDay = db.subscriptions.get(all[0]?.id ?? 0)?.create_date ?? "";
    expectSplit(
      all,
      await duesList(client, { create_date: sameDay }),
      (row) =>
        db.subscriptions.get(row.id ?? 0)?.create_date.slice(0, 10) ===
        sameDay.slice(0, 10),
      "create_date on the same day",
    );
    const name = all[0]?.user__name ?? "";
    expectSplit(
      all,
      await duesList(client, { query: name }),
      (row) => row.user__name === name,
      "query",
    );
    expectSplit(
      all,
      await duesList(client, { query: `-${name}` }),
      (row) => row.user__name !== name,
      "query with a leading minus",
    );
  });

  test("orders by every documented order_by value in both directions", async () => {
    const client = createTestClient();
    const keys = {
      id: (row: { id?: number }) => row.id ?? 0,
      user__name: (row: { user__name?: string }) => row.user__name ?? "",
      transaction__amount: (row: { transaction__amount?: number }) =>
        row.transaction__amount ?? 0,
      transaction__complete_date: (row: {
        transaction__complete_date?: string;
      }) => Date.parse(row.transaction__complete_date ?? ""),
    } as const;
    const fallback = await duesList(client, {});
    expectOrdered(
      fallback,
      keys.transaction__complete_date,
      "desc",
      "default order",
    );
    for (const [field, key] of Object.entries(keys)) {
      expectOrdered(
        await duesList(client, { order_by: field }),
        key,
        "asc",
        field,
      );
      expectOrdered(
        await duesList(client, { order_by: `-${field}` }),
        key,
        "desc",
        field,
      );
    }
  });

  test("pages through the payments with a stable total", async () => {
    const client = createTestClient();
    const all = await duesList(client, {});
    const page = await client.ok("getMembershipDuesList", {
      query: { ...EVER, status: "paid", start_page: 3, how_many: 7 },
    });
    expect(ids(page.payment_list ?? [])).toEqual(ids(all.slice(14, 21)));
    expect(page.total).toBe(all.length);
  });
});

describe("getMembershipDueDetails", () => {
  test("returns a payment with its member, transaction and no category", async () => {
    const client = createTestClient();
    const db = kelder(client);
    const payment = db.subscriptions.find(
      (row) =>
        row.status === 2 &&
        db.transactions.get(row.transaction_id ?? 0)?.payment_method === 0,
    );
    const body = await client.ok("getMembershipDueDetails", {
      path: { subscription_id: payment?.id ?? 0 },
    });
    const tx = db.transactions.get(payment?.transaction_id ?? 0);
    expect(body.subscription).toMatchObject({
      id: payment?.id,
      user_id: payment?.user_id,
      status: 2,
      status_name: "Ödeme",
      debt_category: null,
      remove_note: null,
      balance: payment?.balance,
      user: { id: payment?.user_id, membership_no: expect.any(Number) },
      transaction: {
        id: tx?.id,
        amount: tx?.amount,
        payment_status: 3,
        currency: { iso_code: "TRY" },
        payment_settings: { id: tx?.payment_settings_id ?? 0 },
      },
    });
    expect(body.subscription?.card_info).toMatch(/^\*{4} \d{4}$/);
  });

  test("names the refund, cancellation and balance fix records", async () => {
    const client = createTestClient();
    for (const [id, status, name] of [
      [20045, 4, "İade"],
      [20039, 3, "İptal"],
      [20024, 7, "Bakiye Düzeltme"],
    ] as const) {
      const body = await client.ok("getMembershipDueDetails", {
        path: { subscription_id: id },
      });
      expect(body.subscription).toMatchObject({
        id,
        status,
        status_name: name,
      });
    }
  });

  test("returns a debt from the member's statement, with its category", async () => {
    const client = createTestClient();
    const body = await client.ok("getMembershipDueDetails", {
      path: { subscription_id: 20003 },
    });
    expect(body.subscription).toMatchObject({
      id: 20003,
      status: 1,
      status_name: "Ödenmemiş Borç",
      debt_category: { id: 502, name: "Yıllık Aidat 2026", deleted: false },
      user: {
        id: 1004,
        name: "Mustafa Aksoy",
        profile_pic: "https://kelder.example/media/profil/4.jpg",
      },
    });
    const debt = await client.ok("getDebtDetails", {
      path: { debt_id: 20003 },
    });
    expect(body.subscription, "the same record as /debt/{debt_id}").toEqual(
      debt.subscription,
    );
  });

  test("answers 404 for an unknown id and another org's record", async () => {
    const client = createTestClient();
    const unknown = await client.call("getMembershipDueDetails", {
      path: { subscription_id: 1 },
    });
    expect(unknown.status).toBe(404);
    client.mock.runtime.tenancy.setPlan("ornek", "active");
    const token = await client.token(client.mock.runtime.credentials.lapsed);
    const cross = await client.call("getMembershipDueDetails", {
      token,
      path: { subscription_id: 20005 },
    });
    expect(cross.status, "kelder's payment is invisible to ornek").toBe(404);
  });
});

describe("deleteMembershipDue", () => {
  test("deletes a payment, moves the member's later balances and frees its bank transfer", async () => {
    const client = createTestClient();
    const db = kelder(client);
    const transfer = db.bankTransactions.find(
      (row) => row.matched_subscription_id !== null,
    );
    const payment = db.subscriptions.get(
      transfer?.matched_subscription_id ?? 0,
    );
    const userId = payment?.user_id ?? 0;
    const before = db.users.get(userId)?.total_financial ?? 0;
    const later = db.subscriptions.list(
      (row) =>
        row.user_id === userId &&
        Date.parse(row.operation_date) >
          Date.parse(payment?.operation_date ?? ""),
    );
    const deleted = await client.ok("deleteMembershipDue", {
      path: { subscription_id: payment?.id ?? 0 },
    });
    expect(deleted).toEqual({ result: "ok" });
    const gone = await client.call("getMembershipDueDetails", {
      path: { subscription_id: payment?.id ?? 0 },
    });
    expect(gone.status).toBe(404);
    expect(ids(await duesList(client, {}))).not.toContain(payment?.id);
    expect(db.users.get(userId)?.total_financial).toBe(
      before - (payment?.amount ?? 0),
    );
    for (const row of later) {
      expect(db.subscriptions.get(row.id)?.balance, `row ${row.id}`).toBe(
        row.balance - (payment?.amount ?? 0),
      );
    }
    expect(db.bankTransactions.get(transfer?.id ?? 0)).toMatchObject({
      payment_status: 8,
      matched_subscription_id: null,
      matched_user_id: null,
      transaction_type: null,
    });
  });

  test("deletes a refunded payment together with its refund record", async () => {
    const client = createTestClient();
    const db = kelder(client);
    const refund = db.subscriptions.get(20045);
    const payment = db.subscriptions.find(
      (row) =>
        row.status === 2 && row.transaction_id === refund?.transaction_id,
    );
    await client.ok("deleteMembershipDue", {
      path: { subscription_id: payment?.id ?? 0 },
    });
    const refundGone = await client.call("getMembershipDueDetails", {
      path: { subscription_id: 20045 },
    });
    expect(refundGone.status).toBe(404);
    expect(ids(await duesList(client, { status: "refund" }))).not.toContain(
      20045,
    );
  });

  test("deletes a debt from the member's statement too, and answers 404 for an unknown id", async () => {
    const client = createTestClient();
    await client.ok("deleteMembershipDue", {
      path: { subscription_id: 20003 },
    });
    const gone = await client.call("getDebtDetails", {
      path: { debt_id: 20003 },
    });
    expect(gone.status).toBe(404);
    const unknown = await client.call("deleteMembershipDue", {
      path: { subscription_id: 1 },
    });
    expect(unknown.status).toBe(404);
  });
});

describe("getUsersMembershipDueList", () => {
  test("keeps every seeded balance when a write recomputes the member's ledger", async () => {
    const client = createTestClient();
    const db = kelder(client);
    const before = new Map(
      db.subscriptions.list().map((row) => [row.id, row.balance]),
    );
    const members = [
      ...new Set(db.subscriptions.list().map((row) => row.user_id)),
    ];
    expect(members.length).toBe(120);
    for (const [index, userId] of members.entries()) {
      if (index > 0 && index % 50 === 0)
        client.mock.runtime.clock.advance(60_000);
      const debt = db.subscriptions.find(
        (row) =>
          row.user_id === userId && (row.status === 1 || row.status === 8),
      );
      await client.ok("updateDebtStatus", {
        path: { debt_id: debt?.id ?? 0 },
        body: { action: "activate" },
      });
    }
    const changed = db.subscriptions
      .list()
      .filter((row) => before.get(row.id) !== row.balance)
      .map((row) => row.id);
    expect(changed).toEqual([]);
    expect(before.size).toBe(426);
  });
  test("lists a member's statement newest first, split by listing", async () => {
    const client = createTestClient();
    const db = kelder(client);
    const userId = 1015;
    const statement = async (listing?: string) =>
      (
        await client.ok("getUsersMembershipDueList", {
          path: { user_id: userId },
          query: listing === undefined ? PAGE : { ...PAGE, listing },
        })
      ).subscription_list ?? [];
    const all = await statement("a");
    expect(sortedIds(all)).toEqual(
      sortedIds(db.subscriptions.list((row) => row.user_id === userId)),
    );
    expect(ids(await statement()), "listing defaults to all").toEqual(ids(all));
    expectOrdered(
      all,
      (row) => Date.parse(row.operation_date ?? ""),
      "desc",
      "statement",
    );
    expectSplit(
      all,
      await statement("p"),
      (row) => row.status === 2,
      "listing p",
    );
    expectSplit(
      all,
      await statement("d"),
      (row) => row.status === 1 || row.status === 6 || row.status === 8,
      "listing d",
    );
    expectSplit(
      all,
      await statement("r"),
      (row) => row.status === 4,
      "listing r",
    );
    const latest = all[0];
    const balance = db.subscriptions.get(latest?.id ?? 0)?.balance;
    expect(latest?.balance, "the newest row carries the current balance").toBe(
      balance,
    );
    const payment = all.find((row) => row.status === 2);
    expect(payment).toMatchObject({
      transaction__currency__iso_code: "TRY",
      transaction__converted: false,
      transaction__conversion_rate: null,
      transaction__converted_amount: null,
      transaction__converted_currency__display: null,
      remove_note: null,
      due_date: null,
    });
    expect(
      payment,
      "production never sends the fonzip id here",
    ).not.toHaveProperty("transaction__fonzip_id");
    const dated = all.find((row) => row.due_date !== null);
    expect(dated?.due_date, "a due date is a plain date").toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });

  test("pages the statement and answers 200 with an empty list for an unknown user", async () => {
    const client = createTestClient();
    const page = await client.ok("getUsersMembershipDueList", {
      path: { user_id: 1015 },
      query: { start_page: 2, how_many: 2 },
    });
    const all = await client.ok("getUsersMembershipDueList", {
      path: { user_id: 1015 },
      query: PAGE,
    });
    expect(ids(page.subscription_list ?? [])).toEqual(
      ids((all.subscription_list ?? []).slice(2, 4)),
    );
    expect(page.total).toBe(all.total);
    const missing = await client.call("getUsersMembershipDueList", {
      path: { user_id: 99 },
      query: PAGE,
    });
    expect(
      missing.status,
      "production does not know the user, and says 200",
    ).toBe(200);
    expect(missing.body).toEqual({ subscription_list: [], total: 0 });
    client.mock.runtime.tenancy.setPlan("ornek", "active");
    const token = await client.token(client.mock.runtime.credentials.lapsed);
    const cross = await client.call("getUsersMembershipDueList", {
      token,
      path: { user_id: 1015 },
      query: PAGE,
    });
    expect(cross.body, "another organisation's user has no rows here").toEqual({
      subscription_list: [],
      total: 0,
    });
    const badListing = await client.call("getUsersMembershipDueList", {
      path: { user_id: 1015 },
      query: { ...PAGE, listing: "x" },
    });
    expect(badListing.status).toBe(400);
  });
});
