import { describe, expect, test } from "bun:test";

import { createTestClient, type TestClient } from "../src/testing/client";
import { ids, kelder, PAGE } from "./dues-events-support";

async function categories(client: TestClient, query?: string) {
  const body = await client.ok("getDebtCategoryList", {
    query: query === undefined ? PAGE : { ...PAGE, query },
  });
  return body.category_list ?? [];
}

function debtsIn(client: TestClient, categoryId: number | null) {
  return kelder(client).subscriptions.list(
    (row) =>
      [1, 6, 8].includes(row.status) && row.debt_category_id === categoryId,
  );
}

describe("getDebtCategoryList", () => {
  test("lists the live categories by name with how their debts stand", async () => {
    const client = createTestClient();
    const listed = await categories(client);
    expect(listed.map((row) => row.name)).toEqual([
      "Gala Katılım Bedeli",
      "Giriş Ücreti",
      "Yıllık Aidat 2025",
      "Yıllık Aidat 2026",
    ]);
    expect(ids(listed), "the deleted category is not listed").not.toContain(
      505,
    );
    for (const row of listed) {
      const debts = debtsIn(client, row.id ?? 0);
      const open = debts.filter((debt) => debt.status === 1);
      const closed = debts.filter((debt) => debt.status === 8);
      const sum = (rows: typeof debts) =>
        rows.reduce((total, debt) => total + debt.amount, 0);
      expect(row, row.name).toMatchObject({
        debt_count: open.length + closed.length,
        open_count: open.length,
        open_amount: sum(open),
        closed_count: closed.length,
        closed_amount: sum(closed),
        removed_count: debts.filter((debt) => debt.status === 6).length,
        total_amount: sum(open) + sum(closed),
        open_member_count: new Set(open.map((debt) => debt.user_id)).size,
        listed_count: debts.length,
      });
    }
    expect(listed.find((row) => row.id === 501)).toMatchObject({
      created_by_id: 1001,
      created_by__name: "Umut Korkmaz",
      update_date: null,
      updated_by_id: null,
      updated_by__name: null,
    });
    expect(listed.find((row) => row.id === 501)?.removed_count).toBeGreaterThan(
      0,
    );
    expect(listed.find((row) => row.id === 502)?.open_count).toBeGreaterThan(0);
  });

  test("searches the name ignoring case and Turkish accents", async () => {
    const client = createTestClient();
    expect((await categories(client, "YILLIK")).map((row) => row.id)).toEqual([
      501, 502,
    ]);
    expect((await categories(client, "giris")).map((row) => row.id)).toEqual([
      503,
    ]);
    expect(
      (await categories(client, "aidat 2026")).map((row) => row.id),
    ).toEqual([502]);
    expect(
      await categories(client, "kullanılmıyor"),
      "deleted stays hidden",
    ).toEqual([]);
  });

  test("pages with a stable total", async () => {
    const client = createTestClient();
    const page = await client.ok("getDebtCategoryList", {
      query: { start_page: 2, how_many: 3 },
    });
    expect(page.category_list?.map((row) => row.id)).toEqual([502]);
    expect(page.total).toBe(4);
  });
});

describe("createDebtCategory", () => {
  test("creates a trimmed category that the list and new debts accept", async () => {
    const client = createTestClient();
    const created = await client.ok("createDebtCategory", {
      body: { name: "  Bağış Gecesi  " },
    });
    expect(created).toEqual({
      result: "ok",
      category: {
        id: expect.any(Number),
        name: "Bağış Gecesi",
        deleted: false,
      },
    });
    const listed = (await categories(client)).find(
      (row) => row.id === created.category?.id,
    );
    expect(listed).toMatchObject({
      name: "Bağış Gecesi",
      create_date: "2026-11-01T09:00:00+03:00",
      created_by_id: null,
      created_by__name: null,
      debt_count: 0,
      listed_count: 0,
    });
    const debt = await client.ok("createDebt", {
      body: {
        user_id: 1004,
        amount: 10,
        debt_category_id: created.category?.id,
      },
    });
    expect(debt.result).toBe("ok");
  });

  test("refuses a name already in use ignoring case, but reuses a deleted one", async () => {
    const client = createTestClient();
    const taken = await client.call("createDebtCategory", {
      body: { name: "yıllık aidat 2025" },
    });
    expect(taken.status).toBe(400);
    expect(taken.body).toEqual({
      error: "A debt category named yıllık aidat 2025 already exists",
    });
    const reused = await client.ok("createDebtCategory", {
      body: { name: "Eski Aidat (kullanılmıyor)" },
    });
    expect(reused.category?.deleted).toBe(false);
    const blank = await client.call("createDebtCategory", {
      body: { name: "   " },
    });
    expect(blank.status).toBe(400);
    const long = await client.call("createDebtCategory", {
      body: { name: "x".repeat(61) },
    });
    expect(long.status, "maxLength 60").toBe(400);
    const missing = await client.call("createDebtCategory", { body: {} });
    expect(missing.status).toBe(400);
  });
});

describe("getDebtCategoryUsage", () => {
  test("reports the debts by state and the automations that use the category", async () => {
    const client = createTestClient();
    const usage = await client.ok("getDebtCategoryUsage", {
      path: { category_id: 502 },
    });
    const listed = (await categories(client)).find((row) => row.id === 502);
    const {
      id: _id,
      name: _name,
      create_date: _created,
      created_by_id: _by,
      created_by__name: _byName,
      update_date: _updated,
      updated_by_id: _updatedBy,
      updated_by__name: _updatedByName,
      ...stats
    } = listed ?? {};
    expect(usage).toEqual({
      category: { id: 502, name: "Yıllık Aidat 2026" },
      ...stats,
      automation_list: [{ id: 551, title: "Yıllık aidat otomasyonu" }],
      in_use: true,
    });
    const unused = await client.ok("getDebtCategoryUsage", {
      path: { category_id: 504 },
    });
    expect(unused).toMatchObject({
      debt_count: 0,
      automation_list: [],
      in_use: false,
    });
  });

  test("answers 404 for a deleted or unknown category", async () => {
    const client = createTestClient();
    for (const id of [505, 9]) {
      const response = await client.call("getDebtCategoryUsage", {
        path: { category_id: id },
      });
      expect(response.status, `category ${id}`).toBe(404);
      expect(response.body).toEqual({ error: "Borç kategorisi bulunamadı." });
    }
  });
});

describe("updateDebtCategory", () => {
  test("renames a category and records when", async () => {
    const client = createTestClient();
    client.mock.runtime.clock.advance(60_000);
    const renamed = await client.ok("updateDebtCategory", {
      path: { category_id: 503 },
      body: { name: " Üyelik Giriş Ücreti " },
    });
    expect(renamed).toEqual({
      result: "ok",
      category: { id: 503, name: "Üyelik Giriş Ücreti", deleted: false },
    });
    expect(
      (await categories(client)).find((row) => row.id === 503),
    ).toMatchObject({
      name: "Üyelik Giriş Ücreti",
      update_date: "2026-11-01T09:01:00+03:00",
      updated_by_id: null,
      updated_by__name: null,
    });
    const debt = await client.ok("getDebtDetails", {
      path: { debt_id: debtsIn(client, 503)[0]?.id ?? 0 },
    });
    expect(debt.subscription?.debt_category?.name).toBe("Üyelik Giriş Ücreti");
    const recased = await client.ok("updateDebtCategory", {
      path: { category_id: 503 },
      body: { name: "ÜYELİK GİRİŞ ÜCRETİ" },
    });
    expect(recased.category?.name, "its own name in another case").toBe(
      "ÜYELİK GİRİŞ ÜCRETİ",
    );
  });

  test("refuses another category's name and answers 404 for a deleted one", async () => {
    const client = createTestClient();
    const taken = await client.call("updateDebtCategory", {
      path: { category_id: 503 },
      body: { name: "GALA KATILIM BEDELİ" },
    });
    expect(taken.status).toBe(400);
    const deleted = await client.call("updateDebtCategory", {
      path: { category_id: 505 },
      body: { name: "Yeni" },
    });
    expect(deleted.status).toBe(404);
  });
});

describe("deleteDebtCategory", () => {
  test("deletes an unused category at once", async () => {
    const client = createTestClient();
    const deleted = await client.ok("deleteDebtCategory", {
      path: { category_id: 504 },
    });
    expect(deleted).toEqual({
      result: "ok",
      debt_count: 0,
      automation_count: 0,
      replacement_name: null,
    });
    expect(ids(await categories(client))).not.toContain(504);
    const usage = await client.call("getDebtCategoryUsage", {
      path: { category_id: 504 },
    });
    expect(usage.status).toBe(404);
    const reused = await client.call("createDebt", {
      body: { user_id: 1004, amount: 10, debt_category_id: 504 },
    });
    expect(reused.status, "a deleted category takes no new debts").toBe(404);
  });

  test("answers 409 with the usage and changes nothing while the category is in use", async () => {
    const client = createTestClient();
    const before = debtsIn(client, 502).length;
    const response = await client.call("deleteDebtCategory", {
      path: { category_id: 502 },
    });
    expect(response.status).toBe(409);
    const usage = await client.ok("getDebtCategoryUsage", {
      path: { category_id: 502 },
    });
    expect(response.body).toEqual({
      error:
        "Yıllık Aidat 2026 is in use: send replacement_id to move its debts and automations",
      usage,
    });
    expect(debtsIn(client, 502).length).toBe(before);
    const empty = await client.call("deleteDebtCategory", {
      path: { category_id: 502 },
      body: {},
    });
    expect(empty.status, "a body without replacement_id").toBe(409);
  });

  test("moves debts of every state and automations to the replacement", async () => {
    const client = createTestClient();
    const moving = debtsIn(client, 501);
    const staying = debtsIn(client, 502).length;
    const deleted = await client.ok("deleteDebtCategory", {
      path: { category_id: 501 },
      body: { replacement_id: 502 },
    });
    expect(deleted).toEqual({
      result: "ok",
      debt_count: moving.length,
      automation_count: 0,
      replacement_name: "Yıllık Aidat 2026",
    });
    expect(
      moving.some((row) => row.status === 6),
      "removed debts move too",
    ).toBe(true);
    expect(debtsIn(client, 501)).toEqual([]);
    expect(debtsIn(client, 502).length).toBe(staying + moving.length);
    const debt = await client.ok("getDebtDetails", {
      path: { debt_id: moving[0]?.id ?? 0 },
    });
    expect(debt.subscription?.debt_category).toEqual({
      id: 502,
      name: "Yıllık Aidat 2026",
      deleted: false,
    });
    const automations = await client.ok("deleteDebtCategory", {
      path: { category_id: 503 },
      body: { replacement_id: 502 },
    });
    expect(automations.automation_count).toBe(1);
    const usage = await client.ok("getDebtCategoryUsage", {
      path: { category_id: 502 },
    });
    expect(usage.automation_list?.map((row) => row.id)).toEqual([551, 552]);
  });

  test("leaves debts without a category for a null or empty replacement", async () => {
    const client = createTestClient();
    const moving = debtsIn(client, 503);
    const uncategorised = debtsIn(client, null).length;
    const viaBody = await client.ok("deleteDebtCategory", {
      path: { category_id: 503 },
      body: { replacement_id: null },
    });
    expect(viaBody).toMatchObject({
      debt_count: moving.length,
      automation_count: 1,
      replacement_name: null,
    });
    expect(debtsIn(client, null).length).toBe(uncategorised + moving.length);
    expect(
      kelder(client).debtAutomations.get(552)?.debt_category_id,
    ).toBeNull();
    const viaQuery = await client.ok("deleteDebtCategory", {
      path: { category_id: 501 },
      query: { replacement_id: "" },
    });
    expect(viaQuery.replacement_name).toBeNull();
    expect(debtsIn(client, 501)).toEqual([]);
  });

  test("takes the replacement from the query when no body is sent, and the body over the query", async () => {
    const client = createTestClient();
    const viaQuery = await client.ok("deleteDebtCategory", {
      path: { category_id: 501 },
      query: { replacement_id: "503" },
    });
    expect(viaQuery.replacement_name).toBe("Giriş Ücreti");
    const bodyWins = await client.ok("deleteDebtCategory", {
      path: { category_id: 502 },
      query: { replacement_id: "999" },
      body: { replacement_id: 503 },
    });
    expect(bodyWins.replacement_name).toBe("Giriş Ücreti");
  });

  test("refuses an unknown, deleted or same replacement and a malformed query value", async () => {
    const client = createTestClient();
    const cases = [
      [
        { body: { replacement_id: 999 } },
        404,
        "Replacement debt category not found",
      ],
      [
        { body: { replacement_id: 505 } },
        404,
        "Replacement debt category not found",
      ],
      [
        { body: { replacement_id: 501 } },
        400,
        "replacement_id must be another category",
      ],
      [
        { query: { replacement_id: "abc" } },
        400,
        "replacement_id must be a category id or empty",
      ],
    ] as const;
    for (const [input, status, error] of cases) {
      const response = await client.call("deleteDebtCategory", {
        path: { category_id: 501 },
        ...input,
      });
      expect(response.status, JSON.stringify(input)).toBe(status);
      expect(response.body).toEqual({ error });
    }
    expect(debtsIn(client, 501).length, "nothing moved").toBeGreaterThan(0);
    const missing = await client.call("deleteDebtCategory", {
      path: { category_id: 505 },
      body: { replacement_id: 502 },
    });
    expect(missing.status, "already deleted").toBe(404);
  });
});
