import { describe, expect, test } from "bun:test";

import { createTestClient } from "../src/testing/client";

const PAGE = { start_page: 1, how_many: 100 };
const YEAR = {
  start_date: "2025-11-01T00:00:00+03:00",
  end_date: "2026-11-02T00:00:00+03:00",
};

describe("getMe", () => {
  test("returns the authenticated association", async () => {
    const client = createTestClient();
    const me = await client.ok("getMe");
    expect(me).toMatchObject({
      id: 1,
      name: "kelder",
      display_name: "Kabataş Erkek Liseliler Derneği",
      result: "ok",
    });
  });
});

describe("tags", () => {
  test("lists the seeded tags with a total, one page at a time", async () => {
    const client = createTestClient();
    const all = await client.ok("getTagsList", { query: PAGE });
    expect(all.total).toBe(8);
    expect(all.tag_list?.[0]).toEqual({
      id: 101,
      name: "Burs Bağışçısı",
      color: "tag-1",
    });
    const second = await client.ok("getTagsList", {
      query: { start_page: 2, how_many: 3 },
    });
    expect(
      second.tag_list?.map((tag) => tag.id),
      "page 2 of 3",
    ).toEqual([104, 105, 106]);
    expect(second.total, "total ignores paging").toBe(8);
  });

  test("searches by name, and excludes matches when the query starts with a minus", async () => {
    const client = createTestClient();
    const found = await client.ok("getTagsList", {
      query: { ...PAGE, query: "mezun" },
    });
    expect(found.tag_list?.map((tag) => tag.name)).toEqual([
      "1990'lar Mezunu",
      "2000'ler Mezunu",
    ]);
    const excluded = await client.ok("getTagsList", {
      query: { ...PAGE, query: "-mezun" },
    });
    expect(excluded.total).toBe(6);
  });

  test("creates, updates and deletes a tag", async () => {
    const client = createTestClient();
    const created = await client.ok("createTag", {
      body: { name: "Burs Komitesi", color: "tag-3" },
    });
    expect(created).toEqual({ result: "ok", tag_id: expect.any(Number) });
    const tagId = created.tag_id ?? 0;
    const updated = await client.ok("updateTag", {
      path: { tag_id: tagId },
      body: { name: "Burs Kurulu", color: "tag-4" },
    });
    expect(updated).toEqual({ result: "ok" });
    const listed = await client.ok("getTagsList", {
      query: { ...PAGE, query: "Burs Kurulu" },
    });
    expect(listed.tag_list).toEqual([
      { id: tagId, name: "Burs Kurulu", color: "tag-4" },
    ]);
    const deleted = await client.ok("deleteTag", { path: { tag_id: tagId } });
    expect(deleted).toEqual({ result: "ok" });
    const after = await client.ok("getTagsList", { query: PAGE });
    expect(after.total, "back to the seeded tags").toBe(8);
  });

  test("detaches a deleted tag from users, timelines and ticket rules", async () => {
    const client = createTestClient();
    const db = client.mock.runtime.world().store;
    const linked = (): number =>
      db.userTags.for("kelder").count((link) => link.tag_id === 103);
    expect(linked(), "seeded links to tag 103").toBeGreaterThan(0);
    await client.ok("deleteTag", { path: { tag_id: 103 } });
    expect(linked()).toBe(0);
    expect(
      db.timeline.for("kelder").count((entry) => entry.tag_id === 103),
    ).toBe(0);
    expect(
      db.tickets
        .for("kelder")
        .count((ticket) => ticket.tags_to_control.includes(103)),
    ).toBe(0);
  });

  test("answers 404 for an unknown tag and 400 for an undocumented color", async () => {
    const client = createTestClient();
    const missing = await client.call("updateTag", {
      path: { tag_id: 99 },
      body: { name: "x", color: "tag-1" },
    });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: "Tag not found" });
    const gone = await client.call("deleteTag", { path: { tag_id: 99 } });
    expect(gone.status).toBe(404);
    const badColor = await client.call("createTag", {
      body: { name: "x", color: "kırmızı" },
    });
    expect(badColor.status).toBe(400);
    const noName = await client.call("createTag", { body: { color: "tag-1" } });
    expect(noName.status).toBe(400);
  });

  test("keeps each org's tags apart", async () => {
    const client = createTestClient();
    client.mock.runtime.tenancy.setPlan("ornek", "active");
    const token = await client.token(client.mock.runtime.credentials.lapsed);
    const ornek = await client.ok("getTagsList", { token, query: PAGE });
    expect(ornek.tag_list?.map((tag) => tag.name)).toEqual(["Üye", "Bağışçı"]);
    const cross = await client.call("deleteTag", {
      token,
      path: { tag_id: 101 },
    });
    expect(cross.status, "a kelder tag is invisible to ornek").toBe(404);
  });
});

describe("system lists", () => {
  test("lists payment systems", async () => {
    const client = createTestClient();
    const body = await client.ok("getPaymentSystemsList", { query: PAGE });
    expect(body.total).toBe(3);
    expect(body.payment_settings_list?.map((row) => row.provider_no)).toEqual([
      "iyzico",
      "vpos",
      "paypal",
    ]);
  });

  test("lists bank accounts with their currency and the admins who touched them", async () => {
    const client = createTestClient();
    const body = await client.ok("getBankAccountList", { query: PAGE });
    expect(body.total).toBe(3);
    expect(body.account_list?.[2]).toMatchObject({
      name: "Döviz Hesabı (USD)",
      currency_id: 2,
      currency__display: "USD",
    });
    expect(body.account_list?.[0]?.created_by__name, "an admin name").toEqual(
      expect.any(String),
    );
    expect(
      body.account_list?.[0]?.updated_by__name,
      "the account was edited",
    ).toEqual(expect.any(String));
    expect(body.account_list?.[2]).not.toHaveProperty("updated_by_id");
  });

  test("lists marketing channels with their successful donation and e-card counts", async () => {
    const client = createTestClient();
    const db = client.mock.runtime.world().store;
    const body = await client.ok("getMarketingChannelList", { query: PAGE });
    expect(body.total).toBe(6);
    const first = body.channel_list?.[0];
    const successful = db.donations
      .for("kelder")
      .count(
        (row) =>
          row.marketing_channel_id === first?.id &&
          db.transactions.for("kelder").get(row.transaction_id)
            ?.payment_status === 3,
      );
    expect(first?.donations).toBe(successful);
    expect(
      body.channel_list?.reduce((sum, row) => sum + (row.ecards ?? 0), 0),
      "some e-card sales carry a channel",
    ).toBeGreaterThan(0);
  });

  test("returns the distinct UTM values", async () => {
    const client = createTestClient();
    const body = await client.ok("getMarketingChannelFilterValues");
    expect(body).toEqual({
      sources: ["facebook", "google", "instagram", "linkedin", "newsletter"],
      mediums: ["cpc", "email", "social"],
      campaigns: [
        "burs-2026",
        "ekim-bulteni",
        "kurban-2026",
        "kurumsal-destek",
        "mezunlar-gecesi",
      ],
      contents: [
        "arama-metni",
        "etkinlik-gonderisi",
        "hikaye",
        "sponsorlu-icerik",
        "ust-banner",
      ],
    });
  });
});

describe("bank account transactions", () => {
  test("lists an account's transfers inside the date range, newest first", async () => {
    const client = createTestClient();
    const body = await client.ok("getBankAccountTransactionList", {
      path: { account_id: 81 },
      query: { ...YEAR, ...PAGE },
    });
    expect(body.total).toBeGreaterThan(0);
    const dates =
      body.transaction_list?.map((row) =>
        Date.parse(row.complete_date ?? ""),
      ) ?? [];
    expect(
      [...dates].sort((a, b) => b - a),
      "newest first",
    ).toEqual(dates);
    const matched = body.transaction_list?.find(
      (row) => row.payment_status === 3,
    );
    expect(
      matched?.matched_user_name,
      "a matched transfer names its contact",
    ).toEqual(expect.any(String));
    const waiting = body.transaction_list?.find(
      (row) => row.payment_status === 8,
    );
    expect(waiting).toMatchObject({
      transaction_type: null,
      matched_user_id: null,
      matched_user_name: null,
    });
  });

  test("filters by reconciliation state, matched type and text", async () => {
    const client = createTestClient();
    const path = { account_id: 81 };
    const query = { ...YEAR, ...PAGE };
    const dues = await client.ok("getBankAccountTransactionList", {
      path,
      query: { ...query, payment_status: 3, transaction_type: 2 },
    });
    expect(dues.total).toBeGreaterThan(0);
    expect(
      dues.transaction_list?.every(
        (row) =>
          row.transaction_type === 2 && row.matched_subscription_id !== null,
      ),
    ).toBe(true);
    const unmatched = await client.ok("getBankAccountTransactionList", {
      path,
      query: { ...query, payment_status: 9 },
    });
    expect(
      unmatched.transaction_list?.every((row) => row.payment_status === 9),
    ).toBe(true);
    const all = await client.ok("getBankAccountTransactionList", {
      path,
      query,
    });
    const aidat = await client.ok("getBankAccountTransactionList", {
      path,
      query: { ...query, query: "aidat" },
    });
    const notAidat = await client.ok("getBankAccountTransactionList", {
      path,
      query: { ...query, query: "-aidat" },
    });
    expect(
      (aidat.total ?? 0) + (notAidat.total ?? 0),
      "a query and its exclusion split the list",
    ).toBe(all.total ?? -1);
  });

  test("pages through the matching transfers", async () => {
    const client = createTestClient();
    const path = { account_id: 81 };
    const first = await client.ok("getBankAccountTransactionList", {
      path,
      query: { ...YEAR, start_page: 1, how_many: 5 },
    });
    const second = await client.ok("getBankAccountTransactionList", {
      path,
      query: { ...YEAR, start_page: 2, how_many: 5 },
    });
    expect(first.transaction_list).toHaveLength(5);
    expect(second.transaction_list?.[0]?.id).not.toBe(
      first.transaction_list?.[0]?.id,
    );
    expect(second.total).toBe(first.total);
  });

  test("shows a simulated incoming transfer as waiting to be matched", async () => {
    const client = createTestClient();
    await client.request("/__mock/simulations/foundation/incoming-transfer", {
      method: "POST",
      body: JSON.stringify({
        bank_account_id: 82,
        amount: 4321,
        counterparty_name: "ZEYNEP KAYA",
        description: "burs bagisi",
      }),
    });
    const body = await client.ok("getBankAccountTransactionList", {
      path: { account_id: 82 },
      query: { ...YEAR, ...PAGE, payment_status: 8, query: "ZEYNEP KAYA" },
    });
    expect(body.transaction_list?.[0]).toMatchObject({
      amount: 4321,
      payment_status: 8,
      currency_code: "TRY",
      description: "burs bagisi",
    });
  });

  test("answers 404 for an unknown account and 400 for a reversed date range", async () => {
    const client = createTestClient();
    const missing = await client.call("getBankAccountTransactionList", {
      path: { account_id: 1 },
      query: { ...YEAR, ...PAGE },
    });
    expect(missing.status).toBe(404);
    const reversed = await client.call("getBankAccountTransactionList", {
      path: { account_id: 81 },
      query: { start_date: YEAR.end_date, end_date: YEAR.start_date, ...PAGE },
    });
    expect(reversed.status).toBe(400);
    expect(reversed.body).toEqual({
      error: "start_date must be before end_date",
    });
    const noRange = await client.call("getBankAccountTransactionList", {
      path: { account_id: 81 },
      query: PAGE,
    });
    expect(noRange.status, "start_date and end_date are required").toBe(400);
  });
});
