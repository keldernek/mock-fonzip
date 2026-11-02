import { describe, expect, test } from "bun:test";

import type { Row } from "../src/store/collection";
import type {
  EcardTransactionRecord,
  TransactionRecord,
} from "../src/store/records";
import { createTestClient, type TestClient } from "../src/testing/client";
import { kelder, PAGE } from "./campaigns-forms-ecards-support";

const RANGE = {
  start_date: "2025-01-01T00:00:00+03:00",
  end_date: "2026-11-02T00:00:00+03:00",
};
const BIRTHDAY = 901;
const GRADUATION = 902;
const HOLIDAY = 904;

type Query = Record<
  string,
  string | number | boolean | readonly (string | number)[]
>;

interface StoredSale {
  readonly sale: Row<EcardTransactionRecord>;
  readonly transaction: Row<TransactionRecord>;
}

function stored(client: TestClient): StoredSale[] {
  const db = kelder(client);
  return db.ecardTransactions.list().flatMap((sale) => {
    const transaction = db.transactions.get(sale.transaction_id);
    return transaction ? [{ sale, transaction }] : [];
  });
}

async function saleIds(
  client: TestClient,
  query: Query = {},
): Promise<number[]> {
  const list = await client.ok("getEcardTransactionList", {
    query: { ...RANGE, ...PAGE, ...query },
  });
  return (list.sale_list ?? [])
    .map((sale) => sale.id ?? 0)
    .sort((a, b) => a - b);
}

function paidWhere(
  client: TestClient,
  keep: (row: StoredSale) => boolean,
): number[] {
  return stored(client)
    .filter((row) => row.transaction.payment_status === 3 && keep(row))
    .map((row) => row.sale.id)
    .sort((a, b) => a - b);
}

async function expectNarrowed(
  client: TestClient,
  query: Query,
  keep: (row: StoredSale) => boolean,
): Promise<void> {
  const expected = paidWhere(client, keep);
  const all = paidWhere(client, () => true);
  expect(
    expected.length,
    `${JSON.stringify(query)} keeps some sales`,
  ).toBeGreaterThan(0);
  expect(
    expected.length,
    `${JSON.stringify(query)} drops some sales`,
  ).toBeLessThan(all.length);
  expect(await saleIds(client, query), JSON.stringify(query)).toEqual(expected);
}

describe("e-card categories", () => {
  test("list one category per page, as the schema's single object, with the total", async () => {
    const client = createTestClient();
    const first = await client.ok("getEcardCategoryList", {
      query: { start_page: 1, how_many: 10 },
    });
    expect(first).toEqual({
      category_list: {
        id: BIRTHDAY,
        name: "Doğum Günü",
        order: "1",
        create_date: "2025-06-19T09:00:00+03:00",
        created_by_id: 1001,
        created_by__name: expect.any(String),
        update_date: "2025-07-19T09:00:00+03:00",
        updated_by_id: 1001,
        updated_by__name: expect.any(String),
      },
      total: 4,
    });
    const third = await client.ok("getEcardCategoryList", {
      query: { start_page: 3, how_many: 1 },
    });
    expect(third.category_list).toMatchObject({
      id: 903,
      name: "Anma",
      order: "3",
    });
    expect(third.category_list?.update_date, "never updated").toBeUndefined();
    const beyond = await client.ok("getEcardCategoryList", {
      query: { start_page: 5, how_many: 1 },
    });
    expect(beyond).toEqual({ total: 4 });
  });

  test("search by name and exclude with a minus", async () => {
    const client = createTestClient();
    const found = await client.ok("getEcardCategoryList", {
      query: { start_page: 1, how_many: 10, query: "bayram" },
    });
    expect(found.category_list?.id).toBe(HOLIDAY);
    expect(found.total).toBe(1);
    const excluded = await client.ok("getEcardCategoryList", {
      query: { start_page: 1, how_many: 10, query: "-bayram" },
    });
    expect(excluded.total).toBe(3);
  });

  test("create, update and delete a category, detaching it from its e-cards", async () => {
    const client = createTestClient();
    const created = await client.ok("createEcardCategory", {
      body: { name: "Yeni Yıl" },
    });
    expect(created).toEqual({ result: "ok", category_id: 905 });
    const listed = await client.ok("getEcardCategoryList", {
      query: { start_page: 5, how_many: 1 },
    });
    expect(listed.category_list).toEqual({
      id: 905,
      name: "Yeni Yıl",
      order: "5",
      create_date: "2026-11-01T09:00:00+03:00",
    });
    await client.ok("updateEcardCategory", {
      path: { category_id: GRADUATION },
      body: { name: "Mezuniyet ve Diploma" },
    });
    const updated = await client.ok("getEcardCategoryList", {
      query: { start_page: 1, how_many: 1, query: "Diploma" },
    });
    expect(updated.category_list).toMatchObject({
      id: GRADUATION,
      name: "Mezuniyet ve Diploma",
      update_date: "2026-11-01T09:00:00+03:00",
      created_by_id: 1001,
    });
    expect(
      updated.category_list?.updated_by_id,
      "updated through the API",
    ).toBeUndefined();
    const cards = await client.ok("getEcardList", { query: PAGE });
    expect(
      cards.ecard_list?.find((card) => card.id === 955)?.categories,
    ).toEqual(["Mezuniyet ve Diploma", "Bayram"]);
    expect(
      await client.ok("deleteEcardCategory", {
        path: { category_id: GRADUATION },
      }),
    ).toEqual({ result: "ok" });
    const after = await client.ok("getEcardCategoryList", {
      query: { start_page: 1, how_many: 10 },
    });
    expect(after.total).toBe(4);
    const detail = await client.ok("getEcardDetails", {
      path: { ecard_id: 955 },
    });
    expect(detail.ecard?.categories).toEqual([HOLIDAY]);
    expect(
      await client.ok("getEcardList", {
        query: { ...PAGE, category_id: GRADUATION },
      }),
    ).toEqual({ ecard_list: [], total: 0 });
  });

  test("refuse a blank name with 400 and an unknown category with 404", async () => {
    const client = createTestClient();
    expect(
      (await client.call("createEcardCategory", { body: {} })).status,
    ).toBe(400);
    expect(
      (await client.call("createEcardCategory", { body: { name: "  " } }))
        .status,
    ).toBe(400);
    expect(
      (
        await client.call("updateEcardCategory", {
          path: { category_id: BIRTHDAY },
          body: { name: "" },
        })
      ).status,
    ).toBe(400);
    for (const operationId of [
      "updateEcardCategory",
      "deleteEcardCategory",
    ] as const) {
      const response = await client.call(operationId, {
        path: { category_id: 999 },
        body: { name: "x" },
      });
      expect(response.status, operationId).toBe(404);
    }
  });
});

describe("e-cards", () => {
  test("list cards in display order with category names", async () => {
    const client = createTestClient();
    const list = await client.ok("getEcardList", { query: PAGE });
    expect(list.total).toBe(6);
    expect(list.ecard_list?.[4]).toEqual({
      id: 955,
      title: "Basılı Teşekkür Kartı",
      active: true,
      order: 5,
      listing: 1,
      starred: false,
      categories: ["Mezuniyet", "Bayram"],
    });
    expect(list.ecard_list?.[5]?.active, "the retired design").toBe(false);
  });

  test("filter by category, listing and title, and page", async () => {
    const client = createTestClient();
    const ids = async (query: Query) =>
      (
        await client.ok("getEcardList", { query: { ...PAGE, ...query } })
      ).ecard_list?.map((card) => card.id);
    expect(await ids({ category_id: BIRTHDAY })).toEqual([951, 956]);
    expect(await ids({ category_id: HOLIDAY })).toEqual([954, 955]);
    expect(await ids({ listing: 1 })).toHaveLength(6);
    expect(await ids({ listing: 0 }), "no private cards are seeded").toEqual(
      [],
    );
    expect(await ids({ listing: 2 })).toEqual([]);
    expect(await ids({ query: "kart" })).toHaveLength(6);
    expect(await ids({ query: "anma" })).toEqual([953]);
    expect(await ids({ query: "-anma" })).toEqual([951, 952, 954, 955, 956]);
    const page = await client.ok("getEcardList", {
      query: { start_page: 2, how_many: 4 },
    });
    expect(page.ecard_list?.map((card) => card.id)).toEqual([955, 956]);
    expect(page.total).toBe(6);
  });

  test("details return every design field and category ids", async () => {
    const client = createTestClient();
    const { ecard } = await client.ok("getEcardDetails", {
      path: { ecard_id: 953 },
    });
    expect(ecard).toMatchObject({
      id: 953,
      title: "Anma Kartı",
      ecard_type: 4,
      categories: [903],
      has_cargo: true,
      ask_billing_info: true,
      first_amount: 500,
      minimum_amount: 100,
      payment_settings_id: 71,
      font_family: "Playfair Display",
      custom_message_text_align: 0,
      background: {
        type: 1,
        value: "https://kelder.example/media/ecards/zemin.jpg",
      },
    });
    const plain = await client.ok("getEcardDetails", {
      path: { ecard_id: 951 },
    });
    expect(plain.ecard?.background).toEqual({ type: 0, value: "#ffffff" });
    expect(
      (await client.call("getEcardDetails", { path: { ecard_id: 999 } }))
        .status,
    ).toBe(404);
  });
});

describe("e-card transaction list", () => {
  test("splits sales into paid, refunded and failed", async () => {
    const client = createTestClient();
    expect(await saleIds(client)).toEqual(paidWhere(client, () => true));
    expect(await saleIds(client, { status: "paid" })).toHaveLength(24);
    expect(await saleIds(client, { status: "refund" })).toEqual([
      95008, 95018, 95028,
    ]);
    expect(await saleIds(client, { status: "failed" })).toEqual([
      95010, 95020, 95030,
    ]);
  });

  test("returns the base and default fields when list is omitted", async () => {
    const client = createTestClient();
    const list = await client.ok("getEcardTransactionList", {
      query: { ...RANGE, ...PAGE },
    });
    const sale = list.sale_list?.find((row) => row.id === 95013);
    expect(sale).toEqual({
      id: 95013,
      user_id: 1015,
      first_name: expect.any(String),
      last_name: expect.any(String),
      email: expect.stringContaining("@"),
      phone: expect.any(String),
      certificate_id: 953,
      certificate_file: "https://kelder.example/media/sertifika/13.pdf",
      zip_file: "https://kelder.example/media/sertifika/13.zip",
      cargo_status: 1,
      cargo_company: "Yurtiçi Kargo",
      cargo_number: expect.stringMatching(/^YK\d{10}$/),
      recipient_count: 3,
      transaction__payment_status: 3,
      transaction__fonzip_framework: true,
      certificate__title: "Anma Kartı",
      transaction__amount: 1500,
      transaction__currency__display: "TRY",
      transaction__currency__iso_code: "TRY",
      transaction__payment_method: 0,
      transaction__complete_date: expect.stringMatching(/^2026-01-30T/),
      delivery_time_mode: 1,
      delivery_date: "2026-02-09",
      sent_mail_id: expect.any(Number),
      sent_mail__message_id: expect.any(Number),
      sent_mail__status: expect.any(Number),
    });
  });

  test("returns exactly the requested list fields on top of the base set", async () => {
    const client = createTestClient();
    const base = [
      "id",
      "user_id",
      "first_name",
      "last_name",
      "email",
      "phone",
      "certificate_id",
      "certificate_file",
      "cargo_status",
      "cargo_company",
      "cargo_number",
      "recipient_count",
      "transaction__payment_status",
      "transaction__fonzip_framework",
    ];
    const cases: [string[], string[]][] = [
      [
        ["ecard", "amount"],
        [
          "certificate__title",
          "transaction__amount",
          "transaction__currency__display",
          "transaction__currency__iso_code",
        ],
      ],
      [
        ["card_number", "delivery_date", "category"],
        [
          "transaction__bin_number",
          "transaction__last_four",
          "delivery_time_mode",
          "certificate__categories__name",
        ],
      ],
      [
        [
          "complete_date",
          "fonzip_id",
          "ip_address",
          "receipt_no",
          "transaction_id",
          "provision_no",
          "payment_method",
          "payment_settings_id",
          "payment_settings__name",
        ],
        [
          "transaction__complete_date",
          "transaction__fonzip_id",
          "transaction__ip_address",
          "transaction__receipt_no",
          "transaction__transaction_id",
          "transaction__provision_no",
          "transaction__payment_method",
          "transaction__payment_settings_id",
          "transaction__payment_settings__name",
        ],
      ],
      [
        ["news_via_email", "language", "referring", "bill_type"],
        ["news_via_email", "language", "referring", "bill_type"],
      ],
    ];
    for (const [list, added] of cases) {
      const response = await client.ok("getEcardTransactionList", {
        query: { ...RANGE, ...PAGE, list },
      });
      const sale = response.sale_list?.find((row) => row.id === 95004);
      expect(Object.keys(sale ?? {}).sort(), list.join(",")).toEqual(
        [...base, ...added].sort(),
      );
    }
    const wire = await client.ok("getEcardTransactionList", {
      query: {
        ...RANGE,
        ...PAGE,
        list: [
          "bank_account_id",
          "bank_account__name",
          "added_by_id",
          "email_status",
        ],
      },
    });
    expect(wire.sale_list?.find((row) => row.id === 95005)).toMatchObject({
      transaction__bank_account_id: 81,
      transaction__bank_account__name: "Genel Bağış Hesabı",
      added_by_id: 1001,
      added_by__name: expect.any(String),
      sent_mail_id: expect.any(Number),
    });
    const honoree = await client.ok("getEcardTransactionList", {
      query: {
        ...RANGE,
        ...PAGE,
        list: [
          "referring_name",
          "referring_email",
          "referring_phone",
          "email_status",
        ],
      },
    });
    expect(honoree.sale_list?.find((row) => row.id === 95002)).toMatchObject({
      referring_name: "Deniz Arslan",
      referring_email: "deniz.arslan@eposta.example",
      referring_phone: "+905324445566",
      sent_mail_to_referring_id: expect.any(Number),
      sent_mail_to_referring__message_id: expect.any(Number),
      sent_mail_to_referring__status: 2,
    });
  });

  test("ignores unknown list values", async () => {
    const client = createTestClient();
    const fields = async (list: string[]) =>
      (
        await client.ok("getEcardTransactionList", {
          query: { ...RANGE, ...PAGE, list },
        })
      ).sale_list ?? [];
    const known = await fields(["ecard"]);
    expect(known[0]?.certificate__title).toEqual(expect.any(String));
    expect(await fields(["ecard", "bogus"])).toEqual(known);
    expect(await fields(["bogus"]), "only the base set").toEqual(
      known.map(({ certificate__title: _title, ...base }) => base),
    );
  });

  test("returns every other list value under its own name or its marketing channel", async () => {
    const client = createTestClient();
    const db = kelder(client);
    const own = [
      "news_via_phone",
      "news_via_sms",
      "recipient_list",
      "billing_name",
      "tax_info",
      "billing_address",
      "billing_district",
      "billing_city",
      "address",
      "city",
      "district",
      "third_name",
      "donor_type",
      "delivery_to",
      "delivery_to_name",
      "custom_message",
      "has_cargo",
      "deliver_as_mail",
      "deliver_as_cargo",
      "ecard_date",
    ];
    const utm = [
      "marketing_channel__utm_source",
      "marketing_channel__utm_medium",
      "marketing_channel__utm_campaign",
      "marketing_channel__utm_content",
    ];
    const response = await client.ok("getEcardTransactionList", {
      query: { ...RANGE, ...PAGE, list: [...own, ...utm] },
    });
    const corporate = response.sale_list?.find((row) => row.id === 95004);
    const sale = db.ecardTransactions.get(95004);
    expect(corporate).toMatchObject({
      billing_name: "Boğaziçi Lojistik A.Ş.",
      tax_info: sale?.tax_info,
      delivery_to_name: sale?.delivery_to_name,
      ecard_date: sale?.ecard_date,
      deliver_as_mail: true,
    });
    expect(
      corporate?.marketing_channel__utm_source,
      "organic traffic",
    ).toBeUndefined();
    const tracked = response.sale_list?.find((row) => row.id === 95002);
    const channel = db.marketingChannels.get(404);
    expect(tracked).toMatchObject({
      marketing_channel__utm_source: channel?.utm_source,
      marketing_channel__utm_medium: channel?.utm_medium,
      marketing_channel__utm_campaign: channel?.utm_campaign,
      marketing_channel__utm_content: channel?.utm_content,
    });
    const group = response.sale_list?.find((row) => row.id === 95001);
    expect(group?.recipient_list).toHaveLength(3);
    expect(
      group?.recipient_list?.[0]?.delivery_date,
      "recipients carry their own date only in mode 2",
    ).toBeUndefined();
  });

  test("narrows paid sales by each paid filter", async () => {
    const client = createTestClient();
    const db = kelder(client);
    const channel = (row: StoredSale) =>
      row.sale.marketing_channel_id === null
        ? undefined
        : db.marketingChannels.get(row.sale.marketing_channel_id);
    const someChannel = db.marketingChannels.get(401);
    await expectNarrowed(
      client,
      { payment_method: 2 },
      (row) => row.transaction.payment_method === 2,
    );
    await expectNarrowed(
      client,
      { amount: 300 },
      (row) => row.transaction.amount === 300,
    );
    await expectNarrowed(
      client,
      { amount: 300, amt_cnd: "!=" },
      (row) => row.transaction.amount !== 300,
    );
    await expectNarrowed(
      client,
      { amount: 300, amt_cnd: "<" },
      (row) => row.transaction.amount < 300,
    );
    await expectNarrowed(
      client,
      { amount: 300, amt_cnd: "<=" },
      (row) => row.transaction.amount <= 300,
    );
    await expectNarrowed(
      client,
      { amount: 300, amt_cnd: ">" },
      (row) => row.transaction.amount > 300,
    );
    await expectNarrowed(
      client,
      { amount: 300, amt_cnd: ">=" },
      (row) => row.transaction.amount >= 300,
    );
    await expectNarrowed(
      client,
      { bin_number: 540667 },
      (row) => row.transaction.bin_number === "540667",
    );
    const lastFour =
      db.transactions.get(db.ecardTransactions.get(95004)?.transaction_id ?? 0)
        ?.last_four ?? "";
    await expectNarrowed(
      client,
      { last_four: Number(lastFour) },
      (row) => row.transaction.last_four === lastFour,
    );
    await expectNarrowed(
      client,
      { cargo_status: 3 },
      (row) => row.sale.cargo_status === 3,
    );
    await expectNarrowed(
      client,
      { cargo_status: 4 },
      (row) => row.sale.cargo_status === 1 || row.sale.cargo_status === 2,
    );
    await expectNarrowed(
      client,
      { cargo_status: 0 },
      (row) => row.sale.cargo_status === 0,
    );
    await expectNarrowed(
      client,
      { ecard_id: 952 },
      (row) => row.sale.certificate_id === 952,
    );
    await expectNarrowed(
      client,
      { payment_settings_id: 71 },
      (row) => row.transaction.payment_settings_id === 71,
    );
    await expectNarrowed(
      client,
      { bank_account_id: 81 },
      (row) => row.transaction.bank_account_id === 81,
    );
    await expectNarrowed(
      client,
      { bill_type: 2 },
      (row) => row.sale.bill_type === 2,
    );
    await expectNarrowed(client, { card_country: 1 }, (row) =>
      ["454360", "540667", "979203"].includes(row.transaction.bin_number ?? ""),
    );
    await expectNarrowed(
      client,
      { card_country: 2 },
      (row) => row.transaction.bin_number === "402277",
    );
    await expectNarrowed(client, { card_type: 1 }, (row) =>
      ["454360", "402277"].includes(row.transaction.bin_number ?? ""),
    );
    await expectNarrowed(
      client,
      { card_type: 2 },
      (row) => row.transaction.bin_number === "540667",
    );
    await expectNarrowed(
      client,
      { card_type: 3 },
      (row) => row.transaction.bin_number === "979203",
    );
    expect(
      await saleIds(client, { card_country: 3 }),
      "every seeded BIN is known",
    ).toEqual([]);
    expect(await saleIds(client, { card_type: 4 })).toEqual([]);
    await expectNarrowed(
      client,
      { delivery_date: "2026-06-03T10:00:00+03:00" },
      (row) => row.sale.delivery_date === "2026-06-03",
    );
    await expectNarrowed(
      client,
      { marketing_channel_null: true },
      (row) => row.sale.marketing_channel_id === null,
    );
    await expectNarrowed(
      client,
      { utm_source: [someChannel?.utm_source ?? ""] },
      (row) => channel(row)?.utm_source === someChannel?.utm_source,
    );
    await expectNarrowed(
      client,
      { utm_medium: [someChannel?.utm_medium ?? ""] },
      (row) => channel(row)?.utm_medium === someChannel?.utm_medium,
    );
    await expectNarrowed(
      client,
      { utm_campaign: [someChannel?.utm_campaign ?? ""] },
      (row) => channel(row)?.utm_campaign === someChannel?.utm_campaign,
    );
    await expectNarrowed(
      client,
      { utm_content: [someChannel?.utm_content ?? ""] },
      (row) => channel(row)?.utm_content === someChannel?.utm_content,
    );
    await expectNarrowed(
      client,
      {
        marketing_channel_null: true,
        utm_source: [someChannel?.utm_source ?? ""],
      },
      (row) => row.sale.marketing_channel_id === null,
    );
    expect(
      await saleIds(client, { currency_id: 2 }),
      "every sale is in TRY",
    ).toEqual([]);
    expect(await saleIds(client, { currency_id: 1 })).toHaveLength(24);
  });

  test("ignores paid-only filters for refunds and failures", async () => {
    const client = createTestClient();
    expect(
      await saleIds(client, {
        status: "refund",
        ecard_id: 951,
        payment_method: 2,
        card_country: 2,
      }),
    ).toEqual([95008, 95018, 95028]);
    expect(
      await saleIds(client, {
        status: "failed",
        list: ["ecard"],
        bill_type: 2,
      }),
    ).toEqual([95010, 95020, 95030]);
  });

  test("lists refunds by refund date and failures with their error, ignoring list", async () => {
    const client = createTestClient();
    const refunds = await client.ok("getEcardTransactionList", {
      query: { ...RANGE, ...PAGE, status: "refund", list: ["ecard"] },
    });
    expect(refunds.sale_list?.[0]).toMatchObject({
      id: 95028,
      transaction__refund_date: expect.any(String),
      transaction__refund_reason: expect.any(String),
      transaction__refunded_by_id: 1001,
      transaction__refunded_by__name: expect.any(String),
      transaction__amount: 500,
    });
    expect(
      refunds.sale_list?.[0]?.sent_mail_id,
      "no mail for a refunded sale",
    ).toBeUndefined();
    const failed = await client.ok("getEcardTransactionList", {
      query: { ...RANGE, ...PAGE, status: "failed" },
    });
    expect(failed.sale_list?.find((row) => row.id === 95010)).toMatchObject({
      transaction__payment_status: 5,
      transaction__transaction_error__code: expect.any(String),
      transaction__transaction_error__text: expect.any(String),
      transaction__transaction_error__group: expect.any(Number),
    });
    const window = await saleIds(client, {
      status: "refund",
      start_date: "2026-07-15T00:00:00+03:00",
      end_date: "2026-11-02T00:00:00+03:00",
    });
    expect(window, "the refund date decides the range").toEqual([95008, 95028]);
  });

  test("searches buyers, pages, and refuses a reversed date range", async () => {
    const client = createTestClient();
    const db = kelder(client);
    const surname = db.ecardTransactions.get(95012)?.last_name ?? "";
    const matching = paidWhere(
      client,
      (row) =>
        row.sale.last_name
          .toLocaleLowerCase("tr")
          .includes(surname.toLocaleLowerCase("tr")) ||
        row.sale.first_name
          .toLocaleLowerCase("tr")
          .includes(surname.toLocaleLowerCase("tr")) ||
        row.sale.referring_name
          .toLocaleLowerCase("tr")
          .includes(surname.toLocaleLowerCase("tr")) ||
        row.sale.delivery_to_name
          .toLocaleLowerCase("tr")
          .includes(surname.toLocaleLowerCase("tr")),
    );
    expect(await saleIds(client, { query: surname })).toEqual(matching);
    expect(
      await saleIds(client, { query: "deniz.arslan" }),
      "the honoree's email is not searched",
    ).toEqual([]);
    const page = await client.ok("getEcardTransactionList", {
      query: { ...RANGE, start_page: 3, how_many: 10 },
    });
    expect(page.sale_list).toHaveLength(4);
    expect(page.total).toBe(24);
    const reversed = await client.call("getEcardTransactionList", {
      query: {
        ...PAGE,
        start_date: RANGE.end_date,
        end_date: RANGE.start_date,
      },
    });
    expect(reversed.status).toBe(400);
  });

  test("refuses an order_by outside its list with 403", async () => {
    const client = createTestClient();
    for (const status of ["paid", "refund", "failed"]) {
      for (const order_by of [
        "bogus",
        "-bogus",
        "certificate__title",
        "-transaction__currency__display",
      ]) {
        const response = await client.call("getEcardTransactionList", {
          query: { ...RANGE, ...PAGE, status, order_by },
        });
        expect(response.status, `${status} ${order_by}`).toBe(403);
        expect(response.body).toEqual({
          error: `No Permission: order_by ${order_by} is not a sortable field`,
        });
      }
    }
  });

  test("orders by every order_by value in both directions, tie-breaking by id", async () => {
    const client = createTestClient({
      rateLimit: { limit: 1_000, windowMs: 60_000 },
    });
    const db = kelder(client);
    const fields = [
      "transaction__complete_date",
      "transaction__amount",
      "transaction__refund_date",
      "id",
      "first_name",
      "last_name",
      "email",
      "phone",
      "birthday",
      "city",
      "district",
      "address",
      "donor_type",
      "language",
      "cargo_status",
      "cargo_number",
      "cargo_company",
      "has_cargo",
      "deliver_as_mail",
      "deliver_as_cargo",
      "delivery_to",
      "delivery_to_name",
      "delivery_date",
      "delivery_time_mode",
      "ecard_date",
      "recipient_count",
      "recipient_list",
      "custom_message",
      "referring",
      "third_name",
      "referring_name",
      "referring_email",
      "referring_phone",
      "bill_type",
      "billing_name",
      "tax_info",
      "billing_address",
      "billing_district",
      "billing_city",
      "news_via_phone",
      "news_via_sms",
      "news_via_email",
      "last_update_date",
      "certificate_id",
      "transaction_id",
      "user_id",
      "association_id",
      "added_by_id",
      "updated_by_id",
      "sent_mail_id",
      "sent_mail_to_referring_id",
      "marketing_channel_id",
      "agreements",
    ];
    const dates = new Set(["delivery_date", "ecard_date", "last_update_date"]);
    const valueOf = (id: number, field: string): string | number | null => {
      const sale = db.ecardTransactions.get(id);
      const transaction = db.transactions.get(sale?.transaction_id ?? 0);
      if (!sale || !transaction) return null;
      if (field.startsWith("transaction__")) {
        const raw: unknown = Reflect.get(
          transaction,
          field.slice("transaction__".length),
        );
        return typeof raw === "string"
          ? Date.parse(raw)
          : typeof raw === "number"
            ? raw
            : null;
      }
      const raw: unknown = Reflect.get(sale, field);
      if (raw === undefined || raw === null) return null;
      if (dates.has(field) && typeof raw === "string") return Date.parse(raw);
      if (typeof raw === "boolean") return Number(raw);
      if (typeof raw === "string" || typeof raw === "number") return raw;
      return JSON.stringify(raw);
    };
    const compare = (a: string | number, b: string | number) =>
      typeof a === "string" && typeof b === "string"
        ? a.localeCompare(b, "tr", { sensitivity: "accent" })
        : Number(a) - Number(b);
    for (const field of fields) {
      for (const descending of [false, true]) {
        const order_by = `${descending ? "-" : ""}${field}`;
        const status = field === "transaction__refund_date" ? "refund" : "paid";
        const list = await client.ok("getEcardTransactionList", {
          query: { ...RANGE, ...PAGE, status, order_by },
        });
        const ids = (list.sale_list ?? []).map((sale) => sale.id ?? 0);
        const values = ids.map((id) => valueOf(id, field));
        for (let index = 1; index < ids.length; index += 1) {
          const before = values[index - 1] ?? null;
          const after = values[index] ?? null;
          const label = `${order_by} at ${index}`;
          if (before === null) {
            expect(after, `${label}: blanks come last`).toBeNull();
            expect(
              (ids[index - 1] ?? 0) < (ids[index] ?? 0),
              `${label}: blanks by id`,
            ).toBe(true);
            continue;
          }
          if (after === null) continue;
          const order = compare(before, after);
          if (order === 0) {
            if (field === "first_name") {
              const lastBefore = String(
                valueOf(ids[index - 1] ?? 0, "last_name"),
              );
              const lastAfter = String(valueOf(ids[index] ?? 0, "last_name"));
              const tie = compare(lastBefore, lastAfter);
              expect(
                descending ? tie >= 0 : tie <= 0,
                `${label}: then last_name`,
              ).toBe(true);
              if (tie !== 0) continue;
            }
            expect(
              (ids[index - 1] ?? 0) < (ids[index] ?? 0),
              `${label}: ties by id`,
            ).toBe(true);
          } else {
            expect(descending ? order > 0 : order < 0, label).toBe(true);
          }
        }
      }
    }
  });
});

describe("e-card transaction details", () => {
  test("return the sale with its payment, mails and editors", async () => {
    const client = createTestClient();
    const { ecard_transaction: sale } = await client.ok(
      "getEcardTransactionDetails",
      {
        path: { sale_id: 95002 },
      },
    );
    expect(sale).toMatchObject({
      id: 95002,
      user_id: 1024,
      certificate_id: 952,
      certificate__title: "Mezuniyet Tebrik Kartı",
      certificate__has_cargo: false,
      referring: true,
      referring_name: "Deniz Arslan",
      sent_mail__status: expect.any(Number),
      sent_mail_to_referring__message_id: expect.any(Number),
      transaction__payment_settings__name: "iyzico Sanal POS",
      transaction__currency__display: "TRY",
      transaction__amount: 300,
      transaction__payment_status: 3,
      transaction__bin_number: "540667",
      transaction__provision_no: expect.any(String),
      transaction__fonzip_framework: true,
      transaction__payment_method: 0,
      updated_by_id: 1001,
      updated_by__name: expect.any(String),
      last_update_date: expect.any(String),
    });
    const wire = await client.ok("getEcardTransactionDetails", {
      path: { sale_id: 95005 },
    });
    expect(wire.ecard_transaction).toMatchObject({
      added_by__name: expect.any(String),
      transaction__payment_method: 2,
      deliver_as_cargo: true,
      cargo_status: 3,
    });
    expect(wire.ecard_transaction?.transaction__bin_number).toBeUndefined();
    const refunded = await client.ok("getEcardTransactionDetails", {
      path: { sale_id: 95018 },
    });
    expect(refunded.ecard_transaction).toMatchObject({
      transaction__payment_status: 4,
      transaction__refund_date: expect.any(String),
      transaction__refunded_by_id: 1001,
      transaction__refunded_by__name: expect.any(String),
    });
    const failed = await client.ok("getEcardTransactionDetails", {
      path: { sale_id: 95010 },
    });
    expect(
      failed.ecard_transaction?.transaction__transaction_error__text,
    ).toEqual(expect.any(String));
    expect(
      failed.ecard_transaction?.sent_mail__status,
      "no mail for a failed sale",
    ).toBeUndefined();
    const anonymous = await client.ok("getEcardTransactionDetails", {
      path: { sale_id: 95016 },
    });
    expect(anonymous.ecard_transaction?.user_id).toBeUndefined();
  });

  test("answer 404 for an unknown sale", async () => {
    const client = createTestClient();
    expect(
      (
        await client.call("getEcardTransactionDetails", {
          path: { sale_id: 99_999 },
        })
      ).status,
    ).toBe(404);
  });
});

describe("deleting an e-card transaction", () => {
  test("drops the sale and its payment, and unmatches bank transfers", async () => {
    const client = createTestClient();
    const db = kelder(client);
    const transactionId = db.ecardTransactions.get(95005)?.transaction_id ?? 0;
    const transfer = db.bankTransactions.list()[0];
    if (!transfer) throw new Error("no bank transfer seeded");
    db.bankTransactions.update(transfer.id, {
      matched_certificate_sale_id: 95005,
    });
    expect(
      await client.ok("deleteEcardTransaction", { path: { sale_id: 95005 } }),
    ).toEqual({ result: "ok" });
    expect(
      (
        await client.call("getEcardTransactionDetails", {
          path: { sale_id: 95005 },
        })
      ).status,
    ).toBe(404);
    expect(await saleIds(client)).not.toContain(95005);
    expect(db.transactions.get(transactionId)).toBeUndefined();
    expect(
      db.bankTransactions.get(transfer.id)?.matched_certificate_sale_id,
    ).toBeNull();
    const user = await client.ok("getUserEcardTransactionList", {
      path: { user_id: 1057 },
      query: PAGE,
    });
    expect(user).toEqual({ sale_list: [], total: 0 });
    expect(
      (
        await client.call("deleteEcardTransaction", {
          path: { sale_id: 95005 },
        })
      ).status,
    ).toBe(404);
  });

  test("returns the sale's bank transfer to the unmatched transfers", async () => {
    const client = createTestClient();
    const transfers = async (query: Query = {}) =>
      (
        await client.ok("getBankAccountTransactionList", {
          path: { account_id: 81 },
          query: { ...RANGE, ...PAGE, ...query },
        })
      ).transaction_list?.find((row) => row.id === 30091);
    expect(await transfers()).toMatchObject({
      payment_status: 3,
      transaction_type: 4,
      matched_certificate_sale_id: 95005,
    });
    await client.ok("deleteEcardTransaction", { path: { sale_id: 95005 } });
    const unmatched = {
      payment_status: 8,
      transaction_type: null,
      matched_user_id: null,
      matched_donation_id: null,
      matched_subscription_id: null,
      matched_certificate_sale_id: null,
    };
    expect(await transfers()).toMatchObject(unmatched);
    expect(await transfers({ payment_status: 8 })).toMatchObject(unmatched);
  });
});

describe("a contact's e-card transactions", () => {
  test("list the contact's successful sales", async () => {
    const client = createTestClient();
    const list = await client.ok("getUserEcardTransactionList", {
      path: { user_id: 1013 },
      query: PAGE,
    });
    expect(list).toEqual({
      sale_list: [
        {
          id: 95001,
          certificate_id: 951,
          certificate__title: "Doğum Günü Burs Kartı",
          transaction__amount: 750,
          transaction__currency__display: "TRY",
          transaction__currency__iso_code: "TRY",
          transaction__complete_date: expect.stringMatching(/^2026-02-05T/),
        },
      ],
      total: 1,
    });
    const refunded = await client.ok("getUserEcardTransactionList", {
      path: { user_id: 1070 },
      query: PAGE,
    });
    expect(refunded, "a refunded sale is not listed").toEqual({
      sale_list: [],
      total: 0,
    });
    expect(
      (
        await client.call("getUserEcardTransactionList", {
          path: { user_id: 99_999 },
          query: PAGE,
        })
      ).status,
    ).toBe(404);
  });
});
