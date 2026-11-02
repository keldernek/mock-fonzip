import { describe, expect, test } from "bun:test";

import type { DonationRecord } from "../src/store/records";
import { orgStore, type OrgStore } from "../src/store/store";
import type { TestClient } from "../src/testing/client";
import { givingClient, kelder, listAll, PAGE } from "./giving-support";

function unmatchedFilters(
  client: TestClient,
): readonly Readonly<Record<string, number>>[] {
  const ornek = orgStore(client.mock.runtime.world().store, "ornek");
  return [
    { category_id: 9 },
    { payment_settings_id: 9 },
    { payment_settings_id: ornek.paymentSettings.list()[0]?.id ?? 0 },
  ];
}

function latestPaid(
  db: OrgStore,
  matches: (donation: DonationRecord) => boolean,
): string | undefined {
  const dates = [
    ...db.donations.list(matches),
    ...db.microDonations.list(matches),
  ]
    .map((donation) => db.transactions.get(donation.transaction_id))
    .filter((transaction) => transaction?.payment_status === 3)
    .map((transaction) => transaction?.complete_date ?? "")
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  return dates[0];
}

describe("donation categories", () => {
  test("lists one category per page, as the schema types category_list as one object", async () => {
    const client = givingClient();
    const db = kelder(client);
    const seen = [];
    for (let page = 1; page <= 9; page += 1) {
      const body = await client.ok("getDonationCategoryList", {
        query: { start_page: page, how_many: 1 },
      });
      expect(body.total).toBe(8);
      if (body.category_list) seen.push(body.category_list);
    }
    expect(seen.map((category) => category.id)).toEqual([
      201, 202, 203, 204, 205, 206, 207, 208,
    ]);
    const empty = await client.ok("getDonationCategoryList", {
      query: { start_page: 9, how_many: 1 },
    });
    expect(empty, "past the end there is no category").toEqual({ total: 8 });
    const first = seen[0];
    expect(first).toEqual({
      id: 201,
      name: "Genel Bağış",
      active: true,
      create_date: expect.any(String),
      created_by_id: 1001,
      created_by__name: expect.any(String),
      update_date: expect.any(String),
      updated_by_id: expect.any(Number),
      updated_by__name: expect.any(String),
      last_donation_date: latestPaid(
        db,
        (row) => row.sub_donation_type_id === 201,
      ),
    });
    const second = await client.ok("getDonationCategoryList", {
      query: { start_page: 2, how_many: 3 },
    });
    expect(second.category_list?.id, "the first row of page 2 of 3").toBe(204);
    expect(seen.find((category) => category.id === 202)).not.toHaveProperty(
      "update_date",
    );
  });

  test("searches by name, and a leading minus excludes matches", async () => {
    const client = givingClient();
    const found = await client.ok("getDonationCategoryList", {
      query: { ...PAGE, query: "burs" },
    });
    expect(found).toMatchObject({ total: 1, category_list: { id: 202 } });
    const excluded = await client.ok("getDonationCategoryList", {
      query: { ...PAGE, query: "-burs" },
    });
    expect(excluded).toMatchObject({ total: 7, category_list: { id: 201 } });
  });

  test("creates, renames, deactivates and deletes a category", async () => {
    const client = givingClient();
    const created = await client.ok("createDonationCategory", {
      body: { name: "  Su Kuyusu  " },
    });
    expect(created).toEqual({ result: "ok", category_id: expect.any(Number) });
    const categoryId = created.category_id ?? 0;
    const listed = await client.ok("getDonationCategoryList", {
      query: { ...PAGE, query: "kuyusu" },
    });
    expect(listed).toEqual({
      total: 1,
      category_list: {
        id: categoryId,
        name: "Su Kuyusu",
        active: true,
        create_date: "2026-11-01T09:00:00+03:00",
      },
    });
    client.mock.runtime.clock.advance(60_000);
    await client.ok("updateDonationCategory", {
      path: { category_id: categoryId },
      body: { name: "Su Kuyusu Projesi" },
    });
    await client.ok("updateDonationCategoryStatus", {
      path: { category_id: categoryId },
      body: { active: false },
    });
    const updated = await client.ok("getDonationCategoryList", {
      query: { ...PAGE, query: "projesi" },
    });
    expect(updated.category_list).toMatchObject({
      id: categoryId,
      name: "Su Kuyusu Projesi",
      active: false,
      update_date: "2026-11-01T09:01:00+03:00",
    });
    await client.ok("updateDonationCategoryStatus", {
      path: { category_id: categoryId },
      body: { active: true },
    });
    const reactivated = await client.ok("getDonationCategoryList", {
      query: { ...PAGE, query: "projesi" },
    });
    expect(reactivated.category_list?.active).toBe(true);
    await client.ok("deleteDonationCategory", {
      path: { category_id: categoryId },
    });
    const after = await client.ok("getDonationCategoryList", {
      query: { ...PAGE, query: "kuyusu" },
    });
    expect(after).toEqual({ total: 0 });
    const gone = await client.call("updateDonationCategory", {
      path: { category_id: categoryId },
      body: { name: "x" },
    });
    expect(gone.status).toBe(404);
  });

  test("deleting a category leaves its donations without a category", async () => {
    const client = givingClient();
    const before = await listAll(client, "getDonationList", {
      status: "paid",
      category_id: 205,
    });
    const uncategorized = await listAll(client, "getDonationList", {
      status: "paid",
      no_category: true,
    });
    expect(before.total).toBeGreaterThan(0);
    await client.ok("deleteDonationCategory", { path: { category_id: 205 } });
    const filtered = await client.ok("getDonationList", {
      query: {
        status: "paid",
        category_id: 205,
        ...PAGE,
        start_date: "2024-01-01T00:00:00+03:00",
        end_date: "2027-01-01T00:00:00+03:00",
      },
    });
    expect(filtered, "the category is gone").toEqual({
      donation_list: [],
      total: 0,
    });
    const after = await listAll(client, "getDonationList", {
      status: "paid",
      no_category: true,
    });
    expect(after.total).toBe(uncategorized.total + before.total);
    const pages = await client.ok("getDonationPageList", {
      query: { ...PAGE, category_id: 204 },
    });
    expect(pages.total, "other categories keep their pages").toBe(1);
  });

  test("refuses a missing name with 400 and an unknown category with 404", async () => {
    const client = givingClient();
    const blank = await client.call("createDonationCategory", {
      body: { name: "   " },
    });
    expect(blank).toMatchObject({
      status: 400,
      body: { error: "name is required" },
    });
    const nameless = await client.call("updateDonationCategory", {
      path: { category_id: 201 },
      body: {},
    });
    expect(nameless.status).toBe(400);
    for (const call of [
      client.call("updateDonationCategory", {
        path: { category_id: 9 },
        body: { name: "x" },
      }),
      client.call("updateDonationCategoryStatus", {
        path: { category_id: 9 },
        body: { active: true },
      }),
      client.call("deleteDonationCategory", { path: { category_id: 9 } }),
    ]) {
      expect(await call).toMatchObject({
        status: 404,
        body: { error: "Donation category not found" },
      });
    }
  });
});

describe("getDonationPageList", () => {
  test("lists pages in their manual order with their last donation", async () => {
    const client = givingClient();
    const db = kelder(client);
    const body = await client.ok("getDonationPageList", { query: PAGE });
    expect(body.result).toBe("ok");
    expect(body.total).toBe(4);
    expect(body.page_list?.map((page) => page.title)).toEqual([
      "Burs Fonuna Bağış",
      "Okulumuz İçin",
      "Kurban Bağışı",
      "Zekat",
    ]);
    for (const page of body.page_list ?? []) {
      expect(page.last_donation_date).toBe(
        latestPaid(db, (row) => row.fundraising_page_id === page.id),
      );
    }
    expect(body.page_list?.[0]).toMatchObject({
      id: 31,
      order: 1,
      url: "https://kelder.example/bagis/burs-fonu",
      active: true,
      listing: true,
      created_by_id: 1001,
      updated_by__name: expect.any(String),
    });
    expect(body.page_list?.[3]).toMatchObject({
      active: false,
      listing: false,
    });
  });

  test("filters by text, category and payment system", async () => {
    const client = givingClient();
    const cases = [
      [{ query: "bağış" }, [31, 33]],
      [{ query: "-bağış" }, [32, 34]],
      [{ category_id: 202 }, [31]],
      [{ payment_settings_id: 71 }, [31, 33]],
      [{ payment_settings_id: 72, category_id: 205 }, [32]],
      [{ category_id: 201 }, []],
    ] as const;
    for (const [query, ids] of cases) {
      const body = await client.ok("getDonationPageList", {
        query: { ...PAGE, ...query },
      });
      expect(
        body.page_list?.map((page) => page.id),
        JSON.stringify(query),
      ).toEqual([...ids]);
      expect(body.total).toBe(ids.length);
    }
  });

  test("orders by title and by last donation in both directions", async () => {
    const client = givingClient();
    const db = kelder(client);
    const order = async (orderBy: string) =>
      (
        await client.ok("getDonationPageList", {
          query: { ...PAGE, order_by: orderBy },
        })
      ).page_list?.map((page) => page.id);
    expect(await order("order")).toEqual([31, 32, 33, 34]);
    expect(await order("title")).toEqual([31, 33, 32, 34]);
    expect(await order("-title")).toEqual([34, 32, 33, 31]);
    const dated = [31, 32, 33, 34].map((id) => ({
      id,
      at: Date.parse(
        latestPaid(db, (row) => row.fundraising_page_id === id) ?? "",
      ),
    }));
    expect(await order("last_donation_date")).toEqual(
      [...dated].sort((a, b) => a.at - b.at).map((page) => page.id),
    );
    expect(await order("-last_donation_date")).toEqual(
      [...dated].sort((a, b) => b.at - a.at).map((page) => page.id),
    );
  });

  test("an unknown order_by falls back to order", async () => {
    const client = givingClient();
    for (const orderBy of ["bogus", "-order", "-bogus"]) {
      const body = await client.ok("getDonationPageList", {
        query: { ...PAGE, order_by: orderBy },
      });
      expect(
        body.page_list?.map((page) => page.id),
        orderBy,
      ).toEqual([31, 32, 33, 34]);
    }
  });

  test("lists pages that never received a donation last in both directions", async () => {
    const client = givingClient();
    const db = kelder(client);
    for (const donation of db.donations.list(
      (row) => row.fundraising_page_id === 32,
    )) {
      db.donations.update(donation.id, { fundraising_page_id: null });
    }
    for (const orderBy of ["last_donation_date", "-last_donation_date"]) {
      const body = await client.ok("getDonationPageList", {
        query: { ...PAGE, order_by: orderBy },
      });
      expect(body.page_list?.at(-1), orderBy).toMatchObject({ id: 32 });
      expect(body.page_list?.at(-1)).not.toHaveProperty("last_donation_date");
    }
  });

  test("an unknown category or payment system matches nothing", async () => {
    const client = givingClient();
    for (const query of unmatchedFilters(client)) {
      const body = await client.ok("getDonationPageList", {
        query: { ...PAGE, ...query },
      });
      expect(body, JSON.stringify(query)).toEqual({
        result: "ok",
        page_list: [],
        total: 0,
      });
    }
  });
});

describe("getDonationFormList", () => {
  test("lists forms in order with their last donation, micro donations included", async () => {
    const client = givingClient();
    const db = kelder(client);
    const body = await client.ok("getDonationFormList", { query: PAGE });
    expect(body.total).toBe(3);
    expect(body.form_list?.map((form) => form.title)).toEqual([
      "Web Sitesi Bağış Formu",
      "Mobil Uygulama Formu",
      "Gala Gecesi Formu",
    ]);
    for (const form of body.form_list ?? []) {
      expect(form.last_donation_date).toBe(
        latestPaid(db, (row) => row.module_id === form.id),
      );
    }
    expect(body.form_list?.[0]).toMatchObject({
      id: 41,
      order: 1,
      api_url: "https://fonzip.com/api/v2/form/kelder-1",
      live: true,
      version: 3,
      update_date: expect.any(String),
    });
    expect(body.form_list?.[1]).not.toHaveProperty("updated_by_id");
  });

  test("filters by text, category and payment system, and pages the result", async () => {
    const client = givingClient();
    const cases = [
      [{ query: "mobil" }, [42]],
      [{ query: "-form" }, []],
      [{ category_id: 201 }, [42, 43]],
      [{ payment_settings_id: 71 }, [41, 43]],
      [{ category_id: 201, payment_settings_id: 72 }, [42]],
    ] as const;
    for (const [query, ids] of cases) {
      const body = await client.ok("getDonationFormList", {
        query: { ...PAGE, ...query },
      });
      expect(
        body.form_list?.map((form) => form.id),
        JSON.stringify(query),
      ).toEqual([...ids]);
    }
    const second = await client.ok("getDonationFormList", {
      query: { start_page: 2, how_many: 2 },
    });
    expect(second).toMatchObject({ total: 3, form_list: [{ id: 43 }] });
  });

  test("an unknown category or payment system matches nothing", async () => {
    const client = givingClient();
    for (const query of unmatchedFilters(client)) {
      const body = await client.ok("getDonationFormList", {
        query: { ...PAGE, ...query },
      });
      expect(body, JSON.stringify(query)).toEqual({ form_list: [], total: 0 });
    }
  });
});
