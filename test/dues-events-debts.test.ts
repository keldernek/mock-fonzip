import { describe, expect, test } from "bun:test";

import { orgStore } from "../src/store/store";
import { createTestClient, type TestClient } from "../src/testing/client";
import {
  collect,
  expectOrdered,
  expectSplit,
  ids,
  kelder,
  sortedIds,
  PAGE,
  type Query,
} from "./dues-events-support";

function debtList(client: TestClient, query: Query = {}) {
  return collect(async (start) => {
    const body = await client.ok("getMembershipDueDebtsList", {
      query: { ...query, start_page: start, how_many: 100 },
    });
    return { rows: body.debt_list, total: body.total };
  });
}

function statement(client: TestClient, userId: number) {
  return client.ok("getUsersMembershipDueList", {
    path: { user_id: userId },
    query: PAGE,
  });
}

async function currentBalance(client: TestClient, userId: number) {
  const body = await statement(client, userId);
  return body.subscription_list?.[0]?.balance ?? 0;
}

describe("getMembershipDueDebtsList", () => {
  test("lists every debt of an existing member, newest operation first", async () => {
    const client = createTestClient();
    const db = kelder(client);
    const all = await debtList(client);
    const debts = db.subscriptions.list((row) =>
      [1, 6, 8].includes(row.status),
    );
    expect(sortedIds(all)).toEqual(sortedIds(debts));
    expectOrdered(
      all,
      (row) => Date.parse(row.operation_date ?? ""),
      "desc",
      "default order",
    );
    const payment = db.subscriptions.find((row) => row.status === 2);
    expect(ids(all)).not.toContain(payment?.id);
    expect(all.find((row) => row.id === 20003)).toEqual({
      id: 20003,
      user_id: 1004,
      details: "2026 yılı aidatı",
      period: "2026-01-01",
      status: 1,
      amount: 1500,
      operation_date: "2026-01-15T10:00:00+03:00",
      user__name: "Mustafa Aksoy",
      user__total_financial: 2700,
      user__membership_no: 4,
      create_date: "2026-01-15T10:00:00+03:00",
      added_by_id: 1001,
      added_by__name: "Umut Korkmaz",
      debt_category_id: 502,
      debt_category__name: "Yıllık Aidat 2026",
    });
  });

  test("leaves out the debts of a member who no longer exists", async () => {
    const client = createTestClient();
    const db = kelder(client);
    const before = await debtList(client);
    db.users.remove(1004);
    const after = await debtList(client);
    expect(ids(after)).toEqual(
      ids(before.filter((row) => row.user_id !== 1004)),
    );
    const usage = await client.ok("getDebtCategoryUsage", {
      path: { category_id: 502 },
    });
    expect(usage.listed_count, "listed_count follows /debts").toBe(
      (usage.debt_count ?? 0) + (usage.removed_count ?? 0) - 1,
    );
  });

  test("filters by status, period, amount and operation date", async () => {
    const client = createTestClient();
    await client.ok("createDebt", {
      body: { user_id: 1020, amount: 75, period: "2026-07-01" },
    });
    const all = await debtList(client);
    for (const status of [1, 6, 8] as const) {
      expectSplit(
        all,
        await debtList(client, { status }),
        (row) => row.status === status,
        `status ${status}`,
      );
    }
    expectSplit(
      all,
      await debtList(client, { period_year: 2026 }),
      (row) => row.period?.startsWith("2026") === true,
      "period_year",
    );
    expectSplit(
      all,
      await debtList(client, { period_month: 7 }),
      (row) => row.period === "2026-07-01",
      "period_month",
    );
    expectSplit(
      all,
      await debtList(client, { amount: 1200, amt_cnd: ">" }),
      (row) => (row.amount ?? 0) > 1200,
      "amount >",
    );
    expectSplit(
      all,
      await debtList(client, { amount: 1500 }),
      (row) => row.amount === 1500,
      "amount =",
    );
    expectSplit(
      all,
      await debtList(client, { operation_date: "2026-01-15T00:00:00+03:00" }),
      (row) => row.operation_date?.startsWith("2026-01-15") === true,
      "operation_date",
    );
  });

  test("filters by an operation date range given as instants or bare days", async () => {
    const client = createTestClient();
    const all = await debtList(client);
    const within =
      (start: string, end: string) => (row: { operation_date?: string }) => {
        const at = Date.parse(row.operation_date ?? "");
        return at >= Date.parse(start) && at <= Date.parse(end);
      };
    expectSplit(
      all,
      await debtList(client, {
        start_date: "2025-01-01T00:00:00+03:00",
        end_date: "2025-12-31T23:59:59+03:00",
      }),
      within("2025-01-01T00:00:00+03:00", "2025-12-31T23:59:59+03:00"),
      "start_date and end_date",
    );
    expectSplit(
      all,
      await debtList(client, {
        start_date: "2026-01-15",
        end_date: "2026-01-15",
      }),
      within("2026-01-15T00:00:00+03:00", "2026-01-15T23:59:59.999+03:00"),
      "a bare day covers the whole day",
    );
    const lone = await client.call("getMembershipDueDebtsList", {
      query: { ...PAGE, start_date: "2026-01-01" },
    });
    expect(lone.status).toBe(400);
    expect(lone.body).toEqual({
      error: "start_date and end_date must be sent together",
    });
    const reversed = await client.call("getMembershipDueDebtsList", {
      query: { ...PAGE, start_date: "2026-02-01", end_date: "2026-01-01" },
    });
    expect(reversed.status).toBe(400);
    const notADate = await client.call("getMembershipDueDebtsList", {
      query: { ...PAGE, start_date: "dün", end_date: "2026-01-01" },
    });
    expect(notADate.status).toBe(400);
  });

  test("filters by member, admin, creation date and text", async () => {
    const client = createTestClient();
    const db = kelder(client);
    await client.ok("createDebt", { body: { user_id: 1030, amount: 90 } });
    const all = await debtList(client);
    expectSplit(
      all,
      await debtList(client, { membership_no: 4 }),
      (row) => row.user__membership_no === 4,
      "membership_no",
    );
    expectSplit(
      all,
      await debtList(client, { tag_id: 104 }),
      (row) =>
        db.userTags.find(
          (link) => link.user_id === row.user_id && link.tag_id === 104,
        ) !== undefined,
      "tag_id",
    );
    expectSplit(
      all,
      await debtList(client, { added_by_id: 1001 }),
      (row) => row.added_by_id === 1001,
      "added_by_id",
    );
    expectSplit(
      all,
      await debtList(client, { added_by__name: "umüt" }),
      (row) => row.added_by_id === 1001,
      "added_by__name",
    );
    const today = "2026-11-01T00:00:00+03:00";
    expectSplit(
      all,
      await debtList(client, { create_date: today }),
      (row) => row.create_date?.startsWith("2026-11-01") === true,
      "create_date on the same day",
    );
    expectSplit(
      all,
      await debtList(client, {
        create_date: "2026-01-01T00:00:00+03:00",
        create_date_cnd: "<",
      }),
      (row) =>
        Date.parse(row.create_date ?? "") <
        Date.parse("2026-01-01T00:00:00+03:00"),
      "create_date <",
    );
    expectSplit(
      all,
      await debtList(client, {
        create_date: "2026-01-01T00:00:00+03:00",
        create_date_cnd: ">",
      }),
      (row) =>
        Date.parse(row.create_date ?? "") >
        Date.parse("2026-01-01T00:00:00+03:00"),
      "create_date >",
    );
    expectSplit(
      all,
      await debtList(client, {
        create_start_date: "2026-01-01",
        create_end_date: "2026-06-30",
      }),
      (row) => {
        const at = Date.parse(row.create_date ?? "");
        return (
          at >= Date.parse("2026-01-01T00:00:00+03:00") &&
          at < Date.parse("2026-07-01T00:00:00+03:00")
        );
      },
      "create_start_date and create_end_date",
    );
    const lone = await client.call("getMembershipDueDebtsList", {
      query: { ...PAGE, create_end_date: "2026-06-30" },
    });
    expect(lone.status).toBe(400);
    expect(lone.body).toEqual({
      error: "create_start_date and create_end_date must be sent together",
    });
    expectSplit(
      all,
      await debtList(client, { query: "Mustafa Aksoy" }),
      (row) => row.user__name === "Mustafa Aksoy",
      "query",
    );
    expectSplit(
      all,
      await debtList(client, { query: "-2025" }),
      (row) => !(row.details ?? "").includes("2025"),
      "query with a leading minus",
    );
  });

  test("finds possible duplicates by member, period, amount and category", async () => {
    const client = createTestClient();
    const twice = {
      user_id: 1040,
      amount: 333,
      period: "2026-05-01",
      debt_category_id: 504,
    };
    await client.ok("createDebt", { body: twice });
    const all = await debtList(client);
    expect(
      await debtList(client, { possible_duplicate: true }),
      "no seeded duplicate",
    ).toEqual([]);
    const second = await client.ok("createDebt", { body: twice });
    await client.ok("createDebt", {
      body: { ...twice, debt_category_id: 503 },
    });
    const withDuplicate = await debtList(client);
    expectSplit(
      withDuplicate,
      await debtList(client, { possible_duplicate: true }),
      (row) => row.amount === 333 && row.debt_category_id === 504,
      "possible_duplicate",
    );
    expect(ids(await debtList(client, { possible_duplicate: false }))).toEqual(
      ids(withDuplicate),
    );
    expect(withDuplicate.length).toBe(all.length + 2);
    expect(ids(withDuplicate)).toContain(second.debt_id ?? 0);
  });

  test("filters by debt categories, by no category, or by either", async () => {
    const client = createTestClient();
    await client.ok("createDebt", { body: { user_id: 1050, amount: 40 } });
    const all = await debtList(client);
    expectSplit(
      all,
      await debtList(client, { debt_category_id: 501 }),
      (row) => row.debt_category_id === 501,
      "one category",
    );
    expectSplit(
      all,
      await debtList(client, { debt_category_id: [501, 503] }),
      (row) => row.debt_category_id === 501 || row.debt_category_id === 503,
      "several categories",
    );
    expectSplit(
      all,
      await debtList(client, { no_debt_category: true }),
      (row) => row.debt_category_id === null,
      "no_debt_category",
    );
    expectSplit(
      all,
      await debtList(client, { no_debt_category: true, debt_category_id: 503 }),
      (row) => row.debt_category_id === null || row.debt_category_id === 503,
      "a category or none",
    );
    expect(
      await debtList(client, { debt_category_id: 505 }),
      "the deleted category is empty",
    ).toEqual([]);
    expect(ids(await debtList(client, { no_debt_category: false }))).toEqual(
      ids(all),
    );
  });

  test("orders by every documented order_by value in both directions", async () => {
    const client = createTestClient();
    const keys = {
      id: (row: { id?: number }) => row.id ?? 0,
      period: (row: { period?: string }) => Date.parse(row.period ?? ""),
      amount: (row: { amount?: number }) => row.amount ?? 0,
      operation_date: (row: { operation_date?: string }) =>
        Date.parse(row.operation_date ?? ""),
      create_date: (row: { create_date?: string }) =>
        Date.parse(row.create_date ?? ""),
    } as const;
    for (const [field, key] of Object.entries(keys)) {
      expectOrdered(
        await debtList(client, { order_by: field }),
        key,
        "asc",
        field,
      );
      expectOrdered(
        await debtList(client, { order_by: `-${field}` }),
        key,
        "desc",
        field,
      );
    }
  });

  test("pages with a stable total", async () => {
    const client = createTestClient();
    const all = await debtList(client);
    const page = await client.ok("getMembershipDueDebtsList", {
      query: { start_page: 4, how_many: 9 },
    });
    expect(ids(page.debt_list ?? [])).toEqual(ids(all.slice(27, 36)));
    expect(page.total).toBe(all.length);
  });
});

describe("getDebtDetails", () => {
  test("returns a debt with its category and the transaction that holds its amount", async () => {
    const client = createTestClient();
    const body = await client.ok("getDebtDetails", {
      path: { debt_id: 20003 },
    });
    expect(body.subscription).toMatchObject({
      id: 20003,
      status: 1,
      status_name: "Ödenmemiş Borç",
      debt_category: { id: 502, name: "Yıllık Aidat 2026", deleted: false },
      amount: 1500,
      added_by_id: 1001,
      added_by__name: "Umut Korkmaz",
      user: { id: 1004, name: "Mustafa Aksoy" },
      transaction: {
        amount: 1500,
        complete_date: "2026-01-15T10:00:00+03:00",
        payment_status: 0,
        payment_status_display: "Başlatıldı",
        payment_method: 1,
        currency: { iso_code: "TRY" },
        fonzip_framework: false,
      },
    });
    const removed = await client.ok("getDebtDetails", {
      path: { debt_id: 20070 },
    });
    expect(removed.subscription).toMatchObject({
      status: 6,
      status_name: "Silinmiş Borç",
      remove_note: "Onursal üye, aidattan muaf",
      updated_by_id: 1002,
      updated_by__name: "Hüseyin Korkmaz",
    });
  });

  test("answers 404 for a payment and an unknown id", async () => {
    const client = createTestClient();
    const payment = await client.call("getDebtDetails", {
      path: { debt_id: 20005 },
    });
    expect(payment.status).toBe(404);
    expect(payment.body).toEqual({ error: "Debt not found" });
    const unknown = await client.call("getDebtDetails", {
      path: { debt_id: 7 },
    });
    expect(unknown.status).toBe(404);
  });
});

describe("createDebt", () => {
  test("creates an unpaid debt that the list, the detail and the statement show", async () => {
    const client = createTestClient();
    const before = await currentBalance(client, 1004);
    const created = await client.ok("createDebt", {
      body: {
        user_id: 1004,
        amount: 450,
        details: "Gala katılım bedeli",
        period: "2026-11-01",
        operation_date: "2026-10-30T12:00:00+03:00",
        due_date: "2026-11-30T12:00:00+03:00",
        bill_no: "GALA-1",
        debt_category_id: 504,
      },
    });
    expect(created).toEqual({ result: "ok", debt_id: expect.any(Number) });
    const detail = await client.ok("getDebtDetails", {
      path: { debt_id: created.debt_id ?? 0 },
    });
    expect(detail.subscription).toMatchObject({
      status: 1,
      amount: 450,
      details: "Gala katılım bedeli",
      period: "2026-11-01",
      operation_date: "2026-10-30T12:00:00+03:00",
      due_date: "2026-11-30T12:00:00+03:00",
      bill_no: "GALA-1",
      assignment_status: 0,
      debt_category: { id: 504, name: "Gala Katılım Bedeli", deleted: false },
      transaction: { amount: 450, payment_status: 0, payment_method: 1 },
      balance: before - 450,
      first_name: "Mustafa",
      last_name: "Aksoy",
    });
    expect(detail.subscription, "created through the API").not.toHaveProperty(
      "added_by_id",
    );
    expect(ids(await debtList(client, { debt_category_id: 504 }))).toEqual([
      created.debt_id ?? 0,
    ]);
    expect(await currentBalance(client, 1004)).toBe(before - 450);
  });

  test("defaults the dates to now and takes the amount from a user defined value", async () => {
    const client = createTestClient();
    const created = await client.ok("createDebt", {
      body: {
        user_id: 1004,
        amount_type: "udv",
        amount_udv_key: "mezuniyet_yili",
      },
    });
    const detail = await client.ok("getDebtDetails", {
      path: { debt_id: created.debt_id ?? 0 },
    });
    expect(detail.subscription).toMatchObject({
      amount: 2013,
      operation_date: "2026-11-01T09:00:00+03:00",
      due_date: "2026-11-01T09:00:00+03:00",
      period: "2026-11-01",
      details: "",
      debt_category: null,
      recurring: false,
    });
    const recurring = await client.ok("createDebt", {
      body: {
        user_id: 1004,
        amount: 100,
        recurring: true,
        recurring_period: 30,
      },
    });
    const recurringDetail = await client.ok("getDebtDetails", {
      path: { debt_id: recurring.debt_id ?? 0 },
    });
    expect(recurringDetail.subscription).toMatchObject({
      recurring: true,
      recurring_amount: 100,
      recurring_period: 30,
      recurring_next_cycle: "2026-12-01",
    });
  });

  test("records a payment of the whole debt and settles the member's open debts", async () => {
    const client = createTestClient();
    const db = kelder(client);
    const open = db.subscriptions.list(
      (row) => row.user_id === 1004 && row.status === 1,
    );
    expect(open.length, "the member has an open debt").toBeGreaterThan(0);
    const created = await client.ok("createDebt", {
      body: {
        user_id: 1004,
        amount: 250,
        add_payment: true,
        custom_amount: "total_debt",
        payment_method: 2,
        bank_account_id: 81,
        transaction_id: "HVL-2026-1",
        receipt_no: "MKB-1",
      },
    });
    const owed = open.reduce((sum, row) => sum + row.amount, 0) + 250;
    expect(created).toEqual({
      result: "ok",
      debt_id: expect.any(Number),
      subscription_id: expect.any(Number),
      amount: owed,
      currency: "TRY",
    });
    const payment = await client.ok("getMembershipDueDetails", {
      path: { subscription_id: created.subscription_id ?? 0 },
    });
    expect(payment.subscription).toMatchObject({
      status: 2,
      amount: owed,
      balance: 0,
      assignment_status: 2,
      transaction: {
        amount: owed,
        payment_method: 2,
        payment_status: 3,
        bank_account_id: 81,
        bank_account: { id: 81 },
        transaction_id: "HVL-2026-1",
        receipt_no: "MKB-1",
        fonzip_framework: false,
      },
    });
    const debts = await debtList(client, { membership_no: 4, status: 1 });
    expect(debts, "every open debt is paid").toEqual([]);
    const paid = await client.ok("getDebtDetails", {
      path: { debt_id: created.debt_id ?? 0 },
    });
    expect(paid.subscription).toMatchObject({
      status: 8,
      assignment_status: 2,
    });
    const listed = await client.ok("getMembershipDuesList", {
      query: {
        ...PAGE,
        status: "paid",
        start_date: "2026-11-01T00:00:00+03:00",
        end_date: "2026-11-02T00:00:00+03:00",
      },
    });
    expect(ids(listed.subscription_list ?? [])).toEqual([
      created.subscription_id ?? 0,
    ]);
  });

  test("records a partial custom payment without settling the debt", async () => {
    const client = createTestClient();
    const created = await client.ok("createDebt", {
      body: {
        user_id: 1020,
        amount: 800,
        add_payment: true,
        custom_amount: "custom",
        payment_method: 1,
      },
    });
    const debt = await client.ok("getDebtDetails", {
      path: { debt_id: created.debt_id ?? 0 },
    });
    expect(debt.subscription?.status).toBe(1);
    const payment = await client.ok("getMembershipDueDetails", {
      path: { subscription_id: created.subscription_id ?? 0 },
    });
    expect(payment.subscription).toMatchObject({
      amount: 800,
      assignment_status: 1,
    });
  });

  test("keeps the debt and answers 400 with its id when the balance already covers it", async () => {
    const client = createTestClient();
    await client.ok("createDebt", {
      body: {
        user_id: 1004,
        amount_type: "udv",
        amount_udv_key: "mezuniyet_yili",
        amount: 10_000,
        add_payment: true,
        custom_amount: "custom",
        payment_method: 1,
      },
    });
    expect(
      await currentBalance(client, 1004),
      "the member is in credit",
    ).toBeGreaterThan(0);
    const response = await client.call("createDebt", {
      body: {
        user_id: 1004,
        amount: 10,
        add_payment: true,
        custom_amount: "total_debt",
        payment_method: 1,
      },
    });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "The member's balance already covers the debt, nothing to pay",
      debt_id: expect.any(Number),
    });
    const debtId =
      typeof response.body === "object" &&
      response.body !== null &&
      "debt_id" in response.body
        ? Number(response.body.debt_id)
        : 0;
    const kept = await client.ok("getDebtDetails", {
      path: { debt_id: debtId },
    });
    expect(kept.subscription).toMatchObject({ status: 1, amount: 10 });
  });

  test("checks the member, amount, category, payment and template before writing", async () => {
    const client = createTestClient();
    const db = kelder(client);
    const before = db.subscriptions.count();
    const cases = [
      [{ amount: 10 }, 400, "user_id is required"],
      [{ user_id: 99, amount: 10 }, 404, "User not found"],
      [{ user_id: 1004 }, 400, "amount must be above 0"],
      [{ user_id: 1004, amount: 0 }, 400, "amount must be above 0"],
      [
        { user_id: 1004, amount_type: "udv" },
        400,
        "amount_udv_key is required for amount_type udv",
      ],
      [
        { user_id: 1004, amount_type: "udv", amount_udv_key: "boy" },
        404,
        "User defined value not found",
      ],
      [
        { user_id: 1004, amount_type: "udv", amount_udv_key: "meslek" },
        400,
        "The member has no amount above 0 in meslek",
      ],
      [
        { user_id: 1004, amount: 10, debt_category_id: 999 },
        404,
        "Debt category not found",
      ],
      [
        { user_id: 1004, amount: 10, debt_category_id: 505 },
        404,
        "Debt category not found",
      ],
      [
        {
          user_id: 1004,
          amount: 10,
          add_payment: true,
          payment_method_select: "card",
          custom_amount: "custom",
        },
        400,
        "Card payments cannot be taken through the API",
      ],
      [
        {
          user_id: 1004,
          amount: 10,
          add_payment: true,
          payment_method: 0,
          custom_amount: "custom",
        },
        400,
        "Card payments cannot be taken through the API",
      ],
      [
        {
          user_id: 1004,
          amount: 10,
          add_payment: true,
          custom_amount: "custom",
        },
        400,
        "payment_method is required with add_payment",
      ],
      [
        { user_id: 1004, amount: 10, add_payment: true, payment_method: 1 },
        400,
        "custom_amount is required with add_payment",
      ],
      [
        {
          user_id: 1004,
          amount_type: "udv",
          amount_udv_key: "mezuniyet_yili",
          add_payment: true,
          payment_method: 1,
          custom_amount: "custom",
        },
        400,
        "amount must be above 0 for custom_amount custom",
      ],
      [
        {
          user_id: 1004,
          amount: 10,
          add_payment: true,
          payment_method: 2,
          custom_amount: "custom",
          bank_account_id: 5,
        },
        404,
        "Bank account not found",
      ],
      [
        { user_id: 1004, amount: 10, send_mail: true },
        400,
        "thanks_mail_id is required with send_mail",
      ],
      [
        { user_id: 1004, amount: 10, send_mail: true, thanks_mail_id: 9 },
        404,
        "Template not found",
      ],
    ] as const;
    for (const [body, status, error] of cases) {
      const response = await client.call("createDebt", { body });
      expect(response.status, JSON.stringify(body)).toBe(status);
      expect(response.body, JSON.stringify(body)).toEqual({ error });
    }
    const ornekAccount = orgStore(
      client.mock.runtime.world().store,
      "ornek",
    ).bankAccounts.list()[0];
    const crossAccount = await client.call("createDebt", {
      body: {
        user_id: 1004,
        amount: 10,
        add_payment: true,
        payment_method: 2,
        custom_amount: "custom",
        bank_account_id: ornekAccount?.id ?? 0,
      },
    });
    expect(crossAccount.status, "another org's bank account").toBe(404);
    expect(crossAccount.body).toEqual({ error: "Bank account not found" });
    expect(db.subscriptions.count(), "nothing was written").toBe(before);
    const sent = await client.ok("createDebt", {
      body: { user_id: 1004, amount: 10, send_mail: true, thanks_mail_id: 302 },
    });
    expect(sent.result).toBe("ok");
  });
});

describe("updateDebt", () => {
  const replacement = {
    period: "2026-02-01",
    details: "Düzeltilmiş aidat",
    operation_date: "2026-02-10T10:00:00+03:00",
    due_date: "2026-03-10T10:00:00+03:00",
    bill_no: "AID-9",
    recurring_period: 0,
    transaction: { amount: 1000, transaction_id: "HVL-77", payment_method: 2 },
  };

  test("replaces the editable fields and keeps the category when it is left out", async () => {
    const client = createTestClient();
    const before = await currentBalance(client, 1004);
    const updated = await client.ok("updateDebt", {
      path: { debt_id: 20003 },
      body: replacement,
    });
    expect(updated).toEqual({ result: "ok" });
    const detail = await client.ok("getDebtDetails", {
      path: { debt_id: 20003 },
    });
    expect(detail.subscription).toMatchObject({
      period: "2026-02-01",
      details: "Düzeltilmiş aidat",
      operation_date: "2026-02-10T10:00:00+03:00",
      due_date: "2026-03-10T10:00:00+03:00",
      bill_no: "AID-9",
      amount: 1000,
      remove_note: null,
      debt_category: { id: 502 },
      transaction: {
        amount: 1000,
        transaction_id: "HVL-77",
        payment_method: 2,
        complete_date: "2026-02-10T10:00:00+03:00",
      },
    });
    expect(detail.subscription).not.toHaveProperty("updated_by_id");
    expect(
      await currentBalance(client, 1004),
      "the balance follows the amount",
    ).toBe(before + 500);
    const { bill_no: _billNo, details: _details, ...rest } = replacement;
    await client.ok("updateDebt", {
      path: { debt_id: 20003 },
      body: { ...rest, transaction: { amount: 1000 } },
    });
    const cleared = await client.ok("getDebtDetails", {
      path: { debt_id: 20003 },
    });
    expect(cleared.subscription?.details, "a left-out field is replaced").toBe(
      "",
    );
    expect(cleared.subscription).not.toHaveProperty("bill_no");
    expect(cleared.subscription?.transaction).toMatchObject({
      transaction_id: "",
      payment_method: 2,
    });
  });

  test("clears the category with null and refuses a deleted or unknown one", async () => {
    const client = createTestClient();
    await client.ok("updateDebt", {
      path: { debt_id: 20003 },
      body: { ...replacement, debt_category_id: null },
    });
    const cleared = await client.ok("getDebtDetails", {
      path: { debt_id: 20003 },
    });
    expect(cleared.subscription?.debt_category).toBeNull();
    for (const id of [505, 999]) {
      const refused = await client.call("updateDebt", {
        path: { debt_id: 20003 },
        body: { ...replacement, debt_category_id: id },
      });
      expect(refused.status, `category ${id}`).toBe(404);
    }
    await client.ok("updateDebt", {
      path: { debt_id: 20003 },
      body: { ...replacement, debt_category_id: 501 },
    });
    await client.ok("deleteDebtCategory", {
      path: { category_id: 504 },
    });
    kelder(client).subscriptions.update(20003, { debt_category_id: 504 });
    const kept = await client.call("updateDebt", {
      path: { debt_id: 20003 },
      body: { ...replacement, debt_category_id: 504 },
    });
    expect(
      kept.status,
      "the debt's current category is accepted though deleted",
    ).toBe(200);
  });

  test("keeps a remove note only on a removed debt", async () => {
    const client = createTestClient();
    await client.ok("updateDebt", {
      path: { debt_id: 20070 },
      body: { ...replacement, remove_note: "Vefat nedeniyle" },
    });
    const removed = await client.ok("getDebtDetails", {
      path: { debt_id: 20070 },
    });
    expect(removed.subscription?.remove_note).toBe("Vefat nedeniyle");
    await client.ok("updateDebt", {
      path: { debt_id: 20003 },
      body: { ...replacement, remove_note: "yok" },
    });
    const open = await client.ok("getDebtDetails", {
      path: { debt_id: 20003 },
    });
    expect(open.subscription?.remove_note).toBeNull();
  });

  test("answers 400 for a partial body and 404 for a payment or unknown id", async () => {
    const client = createTestClient();
    const partial = await client.call("updateDebt", {
      path: { debt_id: 20003 },
      body: { details: "x" },
    });
    expect(partial.status).toBe(400);
    const zero = await client.call("updateDebt", {
      path: { debt_id: 20003 },
      body: { ...replacement, transaction: { amount: 0 } },
    });
    expect(zero.status).toBe(400);
    const payment = await client.call("updateDebt", {
      path: { debt_id: 20005 },
      body: replacement,
    });
    expect(payment.status).toBe(404);
    const unknown = await client.call("updateDebt", {
      path: { debt_id: 3 },
      body: replacement,
    });
    expect(unknown.status).toBe(404);
  });
});

describe("updateDebtStatus", () => {
  test("removes an unpaid debt and activates it again", async () => {
    const client = createTestClient();
    const before = await currentBalance(client, 1004);
    await client.ok("updateDebtStatus", {
      path: { debt_id: 20003 },
      body: { action: "remove" },
    });
    const removed = await client.ok("getDebtDetails", {
      path: { debt_id: 20003 },
    });
    expect(removed.subscription).toMatchObject({
      status: 6,
      status_name: "Silinmiş Borç",
    });
    expect(
      await currentBalance(client, 1004),
      "a removed debt is not owed",
    ).toBe(before + 1500);
    expect(ids(await debtList(client, { status: 6 }))).toContain(20003);
    await client.ok("updateDebtStatus", {
      path: { debt_id: 20003 },
      body: { action: "remove" },
    });
    expect(
      (await client.ok("getDebtDetails", { path: { debt_id: 20003 } }))
        .subscription?.status,
      "removing twice converges",
    ).toBe(6);
    await client.ok("updateDebtStatus", {
      path: { debt_id: 20003 },
      body: { action: "activate" },
    });
    const active = await client.ok("getDebtDetails", {
      path: { debt_id: 20003 },
    });
    expect(active.subscription).toMatchObject({ status: 1, remove_note: null });
    expect(await currentBalance(client, 1004)).toBe(before);
    const seededRemoved = await client.ok("updateDebtStatus", {
      path: { debt_id: 20070 },
      body: { action: "activate" },
    });
    expect(seededRemoved.result).toBe("ok");
    const reactivated = await client.ok("getDebtDetails", {
      path: { debt_id: 20070 },
    });
    expect(reactivated.subscription).toMatchObject({
      status: 1,
      remove_note: null,
    });
  });

  test("keeps a paid debt paid and refuses to remove it", async () => {
    const client = createTestClient();
    const paid = kelder(client).subscriptions.find((row) => row.status === 8);
    await client.ok("updateDebtStatus", {
      path: { debt_id: paid?.id ?? 0 },
      body: { action: "activate" },
    });
    expect(
      (await client.ok("getDebtDetails", { path: { debt_id: paid?.id ?? 0 } }))
        .subscription?.status,
    ).toBe(8);
    const refused = await client.call("updateDebtStatus", {
      path: { debt_id: paid?.id ?? 0 },
      body: { action: "remove" },
    });
    expect(refused.status).toBe(400);
    expect(refused.body).toEqual({
      error: "A paid debt cannot be removed; delete it instead",
    });
  });

  test("answers 400 for an undocumented action and 404 for a payment", async () => {
    const client = createTestClient();
    const bad = await client.call("updateDebtStatus", {
      path: { debt_id: 20003 },
      body: { action: "pay" },
    });
    expect(bad.status).toBe(400);
    const payment = await client.call("updateDebtStatus", {
      path: { debt_id: 20005 },
      body: { action: "remove" },
    });
    expect(payment.status).toBe(404);
  });
});

describe("deleteDebt", () => {
  test("deletes a debt from the detail, the list and the balance", async () => {
    const client = createTestClient();
    const before = await currentBalance(client, 1004);
    const transactionId =
      kelder(client).subscriptions.get(20003)?.transaction_id ?? 0;
    const deleted = await client.ok("deleteDebt", { path: { debt_id: 20003 } });
    expect(deleted).toEqual({ result: "ok" });
    expect(
      kelder(client).transactions.get(transactionId),
      "its transaction goes too",
    ).toBeUndefined();
    const gone = await client.call("getDebtDetails", {
      path: { debt_id: 20003 },
    });
    expect(gone.status).toBe(404);
    expect(ids(await debtList(client))).not.toContain(20003);
    expect(await currentBalance(client, 1004)).toBe(before + 1500);
    const again = await client.call("deleteDebt", { path: { debt_id: 20003 } });
    expect(again.status).toBe(404);
    const payment = await client.call("deleteDebt", {
      path: { debt_id: 20005 },
    });
    expect(payment.status, "payments are deleted under /subscription").toBe(
      404,
    );
  });
});
