import { describe, expect, test } from "bun:test";

import type { ServedOperationId } from "../src/operations";
import {
  createTestClient,
  type CallInput,
  type TestClient,
} from "../src/testing/client";
import {
  dateOf,
  expectOrdered,
  kelder,
  notifications,
  PAGE,
} from "./campaigns-forms-ecards-support";

const SCHOLARSHIP = 202;
const LIBRARY = 206;
const IYZICO = 71;
const IS_BANK = 72;
const TRY_ACCOUNT = 81;
const USD_ACCOUNT = 83;
const SCHOLARSHIP_EVENT = 851;
const MARATHON_EVENT = 852;
const ALUMNI_NIGHT = 853;

async function campaignIds(
  client: TestClient,
  query: Record<string, string | number | readonly number[]> = {},
): Promise<number[]> {
  const list = await client.ok("getFundraisingCampaignList", {
    query: { ...PAGE, ...query },
  });
  return (list.campaign_list ?? []).map((campaign) => campaign.id ?? 0);
}

function successfulTotal(client: TestClient, campaignId: number): number {
  const db = kelder(client);
  return db.donations
    .list((donation) => donation.fundraising_campaign_id === campaignId)
    .reduce((sum, donation) => {
      const transaction = db.transactions.get(donation.transaction_id);
      return transaction?.payment_status === 3 ? sum + transaction.amount : sum;
    }, 0);
}

describe("fundraising campaign list", () => {
  test("lists every live campaign, totalling only the successful donations that point at it", async () => {
    const client = createTestClient();
    const list = await client.ok("getFundraisingCampaignList", { query: PAGE });
    expect(list.total).toBe(10);
    const db = kelder(client);
    const refunded = db.donations.list(
      (donation) =>
        donation.fundraising_campaign_id === 801 &&
        db.transactions.get(donation.transaction_id)?.payment_status === 4,
    );
    expect(refunded.length, "campaign 801 has a refunded donation").toBe(1);
    for (const campaign of list.campaign_list ?? []) {
      expect(campaign.donation_total, `campaign ${campaign.id} total`).toBe(
        successfulTotal(client, campaign.id ?? 0),
      );
    }
    expect(list.campaign_list?.[0]).toEqual({
      id: 801,
      user_id: 1011,
      user__first_name: expect.any(String),
      user__last_name: expect.any(String),
      create_date: "2026-02-14T09:00:00+03:00",
      activation_date: "2026-02-15T09:00:00+03:00",
      title: expect.stringContaining("Burs Fonu"),
      url: expect.stringMatching(/^https:\/\/kelder\.example\/kampanya\//),
      status: 1,
      donation_total: 9300,
      team_id: 871,
      team_campaign__title: "1995 Mezunları Takımı - Burs",
      target_currency_id: 1,
      featured: true,
    });
    const finalized = list.campaign_list?.find((row) => row.id === 807);
    expect(
      finalized?.finish_date,
      "a finalized campaign has a finish date",
    ).toBe("2026-09-24T09:00:00+03:00");
  });

  test("pages through campaigns in id order", async () => {
    const client = createTestClient();
    const page = await client.ok("getFundraisingCampaignList", {
      query: { start_page: 2, how_many: 3 },
    });
    expect(page.campaign_list?.map((row) => row.id)).toEqual([804, 805, 806]);
    expect(page.total, "total ignores paging").toBe(10);
    const beyond = await client.ok("getFundraisingCampaignList", {
      query: { start_page: 5, how_many: 3 },
    });
    expect(beyond.campaign_list).toEqual([]);
  });

  test("filters by status, donation category, team campaign, payment settings and fundraising event", async () => {
    const client = createTestClient();
    expect(await campaignIds(client, { status: [1] })).toEqual([
      801, 802, 803, 804, 806,
    ]);
    expect(await campaignIds(client, { status: [0, 5, 7] })).toEqual([
      805, 809, 810,
    ]);
    const created = await client.ok("createFundraisingCampaign", {
      body: {
        user_id: 1050,
        title: "Kütüphane için",
        sub_donation_type_id: LIBRARY,
        payment_settings_id: IS_BANK,
        association_campaign_target_id: ALUMNI_NIGHT,
      },
    });
    const newId = created.campaign_id ?? 0;
    expect(await campaignIds(client, { category_id: LIBRARY })).toEqual([
      newId,
    ]);
    expect(
      (await campaignIds(client, { category_id: SCHOLARSHIP })).length,
    ).toBe(10);
    expect(await campaignIds(client, { team_campaign_id: 8703 })).toEqual([
      802,
    ]);
    expect(await campaignIds(client, { payment_settings_id: IS_BANK })).toEqual(
      [newId],
    );
    expect(
      await campaignIds(client, { association_campaign_target_id: 851 }),
    ).toEqual([801, 803, 805]);
    expect(
      await campaignIds(client, { association_campaign_target_id: 853 }),
    ).toEqual([newId]);
  });

  test("filters by creation date before, after, and on the day", async () => {
    const client = createTestClient();
    const at = "2026-04-21T12:00:00+03:00";
    expect(
      await campaignIds(client, { create_date: at, create_date_cnd: "<" }),
    ).toEqual([801, 802, 803, 804]);
    expect(
      await campaignIds(client, { create_date: at, create_date_cnd: ">" }),
    ).toEqual([805, 806, 807, 808, 809, 810]);
    expect(await campaignIds(client, { create_date: at })).toEqual([804]);
  });

  test("searches titles and owner names, and excludes them with a leading minus", async () => {
    const client = createTestClient();
    const marathon = await campaignIds(client, { query: "maraton" });
    expect(marathon).toEqual([802, 807]);
    const owner = kelder(client).users.get(1011);
    expect(
      await campaignIds(client, { query: owner?.first_name ?? "" }),
    ).toContain(801);
    const excluded = await campaignIds(client, { query: "-maraton" });
    expect(excluded).toHaveLength(8);
    expect(excluded).not.toContain(802);
  });

  test("orders by every order_by value in both directions", async () => {
    const client = createTestClient();
    const db = kelder(client);
    const cases = {
      user__name: (row: { user_id?: number }) => {
        const user = db.users.get(row.user_id ?? 0);
        return user ? `${user.first_name} ${user.last_name}`.trim() : null;
      },
      title: (row: { title?: string }) => row.title,
      create_date: (row: { create_date?: string }) => dateOf(row.create_date),
      activation_date: (row: { activation_date?: string }) =>
        dateOf(row.activation_date),
      donation_total: (row: { donation_total?: number }) => row.donation_total,
    };
    for (const [field, value] of Object.entries(cases)) {
      for (const descending of [false, true]) {
        const order_by = `${descending ? "-" : ""}${field}`;
        const list = await client.ok("getFundraisingCampaignList", {
          query: { ...PAGE, order_by },
        });
        expectOrdered(list.campaign_list ?? [], value, descending, order_by);
      }
    }
  });
});

describe("fundraising campaign detail", () => {
  test("returns the full campaign, its bank accounts and the owner's pending edits", async () => {
    const client = createTestClient();
    const { campaign } = await client.ok("getFundraisingCampaignDetails", {
      path: { campaign_id: 804 },
    });
    expect(campaign).toMatchObject({
      id: 804,
      user_id: 1032,
      status: 1,
      donation_total: successfulTotal(client, 804),
      update_title: expect.stringContaining("2026"),
      update_image: "https://kelder.example/media/campaigns/4-yeni.jpg",
      update_personal_message: expect.any(String),
      association_campaign_target_id: MARATHON_EVENT,
      payment_settings_id: IYZICO,
      sub_donation_type_id: SCHOLARSHIP,
      message_show: true,
      bank_account_list: [
        expect.objectContaining({
          id: TRY_ACCOUNT,
          currency_id: 1,
          currency__display: "TRY",
          created_by__name: expect.any(String),
        }),
      ],
    });
    const special = await client.ok("getFundraisingCampaignDetails", {
      path: { campaign_id: 803 },
    });
    expect(special.campaign).toMatchObject({
      has_special_date: true,
      event_date: "2026-04-29",
      certificate_id: 951,
      thanks_sms_id: 305,
      referral_thanks_mail_id: 301,
      thanks_mail_id: 306,
    });
    const waiting = await client.ok("getFundraisingCampaignDetails", {
      path: { campaign_id: 805 },
    });
    expect(
      waiting.campaign?.activation_date,
      "not activated yet",
    ).toBeUndefined();
  });

  test("answers 404 for an unknown campaign", async () => {
    const client = createTestClient();
    const response = await client.call("getFundraisingCampaignDetails", {
      path: { campaign_id: 9999 },
    });
    expect(response.status).toBe(404);
  });
});

describe("creating a fundraising campaign", () => {
  test("stores every documented field, ignores the body id, and fires the FUNDRAISING_CAMPAIGN webhook with status 0", async () => {
    const client = createTestClient();
    const created = await client.ok("createFundraisingCampaign", {
      body: {
        id: 1,
        user_id: 1100,
        title: "Mezuniyet Hediyesi",
        url: "https://kelder.example/kampanya/mezuniyet-hediyesi",
        image: "https://kelder.example/media/campaigns/yeni.jpg",
        personal_message: "Mezuniyetimde hediye yerine bağış istiyorum.",
        user_note: "Makbuz gerekmez.",
        has_target: true,
        hide_total_donation: true,
        hide_donor_list: true,
        target: 20_000,
        target_currency_id: 2,
        status: 1,
        has_special_date: true,
        event_date: "2026-12-20",
        bank_account_list: [
          {
            id: USD_ACCOUNT,
            name: "ignored",
            bank_name: "ignored",
            iban: "TR00",
            details: "",
            currency_id: 2,
            currency__display: "USD",
            business_account: true,
            create_date: "2026-01-01T00:00:00+03:00",
            created_by_id: 1001,
            created_by__name: "ignored",
            update_date: "2026-01-01T00:00:00+03:00",
            updated_by_id: 1001,
            updated_by__name: "ignored",
          },
        ],
        phone_show: true,
        phone_required: true,
        birthday_show: true,
        birthday_required: false,
        address_show: true,
        address_required: false,
        tckno_show: true,
        tckno_required: true,
        message_show: false,
        sub_donation_type_id: SCHOLARSHIP,
        thanks_mail_id: 306,
        payment_settings_id: IS_BANK,
        currencies: [1, 2],
        certificate_id: 952,
        thanks_sms_id: 305,
        referral_certificate_id: 953,
        referral_thanks_mail_id: 301,
        association_campaign_target_id: SCHOLARSHIP_EVENT,
      },
    });
    expect(created).toEqual({ result: "ok", campaign_id: 811 });
    expect(
      notifications(client).filter((note) => note.operation === 6),
      "one FUNDRAISING_CAMPAIGN event, to the CRM webhook only",
    ).toEqual([{ id: 811, webhook_id: 22, operation: 6, status: 0 }]);
    const { campaign } = await client.ok("getFundraisingCampaignDetails", {
      path: { campaign_id: 811 },
    });
    expect(campaign).toMatchObject({
      id: 811,
      user_id: 1100,
      title: "Mezuniyet Hediyesi",
      url: "https://kelder.example/kampanya/mezuniyet-hediyesi",
      status: 1,
      activation_date: "2026-11-01T09:00:00+03:00",
      create_date: "2026-11-01T09:00:00+03:00",
      donation_total: 0,
      featured: false,
      target: 20_000,
      hide_total_donation: true,
      event_date: "2026-12-20",
      message_show: false,
      tckno_required: true,
      certificate_id: 952,
      referral_certificate_id: 953,
      bank_account_list: [
        expect.objectContaining({
          id: USD_ACCOUNT,
          name: "Döviz Hesabı (USD)",
        }),
      ],
    });
    expect(campaign?.update_title, "no pending edits").toBeUndefined();
    const listed = await client.ok("getFundraisingCampaignList", {
      query: { ...PAGE, query: "Mezuniyet Hediyesi" },
    });
    expect(listed.campaign_list).toEqual([
      expect.objectContaining({ id: 811, target_currency_id: 2 }),
    ]);
  });

  test("fills documented defaults: approved, message_show on, a URL from the title", async () => {
    const client = createTestClient();
    const first = await client.ok("createFundraisingCampaign", {
      body: { user_id: 1100, title: "Burs Fonu" },
    });
    const second = await client.ok("createFundraisingCampaign", {
      body: { user_id: 1101, title: "Burs Fonu", status: 0 },
    });
    const one = await client.ok("getFundraisingCampaignDetails", {
      path: { campaign_id: first.campaign_id ?? 0 },
    });
    const two = await client.ok("getFundraisingCampaignDetails", {
      path: { campaign_id: second.campaign_id ?? 0 },
    });
    expect(one.campaign).toMatchObject({
      status: 1,
      message_show: true,
      phone_show: false,
      has_target: false,
      payment_settings_id: IYZICO,
      url: "https://kelder.example/kampanya/burs-fonu",
      bank_account_list: [],
    });
    expect(two.campaign?.url, "a second campaign gets its own URL").toBe(
      "https://kelder.example/kampanya/burs-fonu-2",
    );
    expect(two.campaign?.status).toBe(0);
    expect(two.campaign?.activation_date).toBeUndefined();
  });

  test("refuses a campaign with no owner, no title or a deleted status (400)", async () => {
    const client = createTestClient();
    const cases = [
      { title: "Sahipsiz" },
      { user_id: 1100 },
      { user_id: 1100, title: "Silinmiş", status: 4 },
      { user_id: 1100, title: "Tarih", event_date: "yarın" },
    ];
    for (const body of cases) {
      const response = await client.call("createFundraisingCampaign", { body });
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
    const nothing = await client.call("createFundraisingCampaign", {});
    expect(nothing.status, "no body at all").toBe(400);
    expect(notifications(client), "no webhook for a refused create").toEqual(
      [],
    );
  });

  test("answers 404 when the owner or a referenced object does not exist", async () => {
    const client = createTestClient();
    const cases = [
      { user_id: 99_999 },
      { sub_donation_type_id: 299 },
      { payment_settings_id: 79 },
      { thanks_mail_id: 399 },
      { certificate_id: 999 },
      { association_campaign_target_id: 869 },
      { bank_account_list: [{ id: 89 }] },
    ];
    for (const extra of cases) {
      const response = await client.call("createFundraisingCampaign", {
        body: { user_id: 1100, title: "Eksik", ...extra },
      });
      expect(response.status, JSON.stringify(extra)).toBe(404);
    }
  });
});

describe("updating a fundraising campaign", () => {
  test("updates one field, or several with multiple and data", async () => {
    const client = createTestClient();
    const single = await client.ok("updateFundraisingCampaign", {
      path: { campaign_id: 806 },
      body: { multiple: false, field: "title", value: "Yeni Başlık" },
    });
    expect(single).toEqual({ result: "ok" });
    const many = await client.ok("updateFundraisingCampaign", {
      path: { campaign_id: 806 },
      body: {
        multiple: true,
        data: {
          phone_show: true,
          phone_required: true,
          target: 123_456,
          event_date: "2027-01-15T10:00:00+03:00",
          bank_account_list: [TRY_ACCOUNT, { id: USD_ACCOUNT }],
          association_campaign_target_id: ALUMNI_NIGHT,
          phone_asked: true,
        },
      },
    });
    expect(many).toEqual({ result: "ok" });
    const { campaign } = await client.ok("getFundraisingCampaignDetails", {
      path: { campaign_id: 806 },
    });
    expect(campaign).toMatchObject({
      title: "Yeni Başlık",
      phone_show: true,
      phone_required: true,
      target: 123_456,
      event_date: "2027-01-15",
      association_campaign_target_id: ALUMNI_NIGHT,
    });
    expect(campaign?.bank_account_list?.map((account) => account.id)).toEqual([
      TRY_ACCOUNT,
      USD_ACCOUNT,
    ]);
  });

  test("updates every documented field one at a time", async () => {
    const client = createTestClient();
    const values = {
      title: "Tek Tek",
      image: "https://kelder.example/media/campaigns/x.jpg",
      bank_account_list: [82],
      personal_message: "Mesaj",
      has_target: false,
      hide_donor_list: true,
      hide_total_donation: true,
      has_special_date: true,
      phone_show: true,
      phone_required: true,
      birthday_show: true,
      birthday_required: true,
      address_show: true,
      address_required: true,
      tckno_show: false,
      tckno_required: false,
      message_show: false,
      target: 1,
      event_date: "2027-03-01",
      sub_donation_type_id: LIBRARY,
      payment_settings_id: IS_BANK,
      thanks_mail_id: 301,
      referral_thanks_mail_id: 306,
      thanks_sms_id: 305,
      certificate_id: 953,
      referral_certificate_id: 954,
      association_campaign_target_id: SCHOLARSHIP_EVENT,
    } as const;
    for (const [field, value] of Object.entries(values)) {
      await client.ok("updateFundraisingCampaign", {
        path: { campaign_id: 804 },
        body: { field, value },
      });
    }
    const { campaign } = await client.ok("getFundraisingCampaignDetails", {
      path: { campaign_id: 804 },
    });
    const { bank_account_list: accounts, ...rest } = values;
    expect(campaign).toMatchObject(rest);
    expect(campaign?.bank_account_list?.map((account) => account.id)).toEqual([
      ...accounts,
    ]);
  });

  test("refuses malformed updates with 400 and missing objects with 404", async () => {
    const client = createTestClient();
    const bad = [
      { field: "title" },
      { field: "title", value: "" },
      { field: "has_target", value: "yes" },
      { field: "target", value: -5 },
      { field: "event_date", value: "someday" },
      { field: "certificate_id", value: "951" },
      { field: "bank_account_list", value: "81" },
      { multiple: true },
      { multiple: true, data: { phone_asked: true } },
    ];
    for (const body of bad) {
      const response = await client.call("updateFundraisingCampaign", {
        path: { campaign_id: 801 },
        body,
      });
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
    const missing = await client.call("updateFundraisingCampaign", {
      path: { campaign_id: 801 },
      body: { field: "payment_settings_id", value: 79 },
    });
    expect(missing.status, "unknown payment settings").toBe(404);
    const noCampaign = await client.call("updateFundraisingCampaign", {
      path: { campaign_id: 9999 },
      body: { field: "title", value: "x" },
    });
    expect(noCampaign.status).toBe(404);
    const { campaign } = await client.ok("getFundraisingCampaignDetails", {
      path: { campaign_id: 801 },
    });
    expect(
      campaign?.payment_settings_id,
      "a refused update changes nothing",
    ).toBe(IYZICO);
  });
});

describe("campaign status actions", () => {
  test("finalizes an active campaign and reactivates a finalized one", async () => {
    const client = createTestClient();
    await client.ok("updateFundraisingCampaignStatus", {
      path: { campaign_id: 801 },
      body: { action: "finalize" },
    });
    const finalized = await client.ok("getFundraisingCampaignDetails", {
      path: { campaign_id: 801 },
    });
    expect(finalized.campaign).toMatchObject({
      status: 3,
      finish_date: "2026-11-01T09:00:00+03:00",
      featured: false,
    });
    await client.ok("updateFundraisingCampaignStatus", {
      path: { campaign_id: 801 },
      body: { action: "reactivate" },
    });
    const active = await client.ok("getFundraisingCampaignDetails", {
      path: { campaign_id: 801 },
    });
    expect(active.campaign?.status).toBe(1);
    expect(active.campaign?.finish_date).toBeUndefined();
    const notFinal = await client.call("updateFundraisingCampaignStatus", {
      path: { campaign_id: 802 },
      body: { action: "reactivate" },
    });
    expect(notFinal.status, "only finalized campaigns reactivate").toBe(400);
    const notActive = await client.call("updateFundraisingCampaignStatus", {
      path: { campaign_id: 805 },
      body: { action: "finalize" },
    });
    expect(notActive.status, "only active campaigns finalize").toBe(400);
  });

  test("features active campaigns up to six, and unfeatures them", async () => {
    const client = createTestClient();
    const feature = (campaign_id: number, featured?: boolean) =>
      client.call("updateFundraisingCampaignStatus", {
        path: { campaign_id },
        body:
          featured === undefined
            ? { action: "featured" }
            : { action: "featured", featured },
      });
    expect((await feature(802)).status, "featured is required").toBe(400);
    expect((await feature(805, true)).status, "a waiting campaign").toBe(400);
    for (const id of [802, 803, 804, 806]) {
      expect((await feature(id, true)).status).toBe(200);
    }
    const extra = await client.ok("createFundraisingCampaign", {
      body: { user_id: 1100, title: "Altıncı" },
    });
    expect((await feature(extra.campaign_id ?? 0, true)).status).toBe(200);
    const seventh = await client.ok("createFundraisingCampaign", {
      body: { user_id: 1101, title: "Yedinci" },
    });
    const capped = await feature(seventh.campaign_id ?? 0, true);
    expect(capped.status, "a seventh featured campaign").toBe(400);
    expect(
      (await feature(801, true)).status,
      "re-featuring is idempotent",
    ).toBe(200);
    expect((await feature(801, false)).status).toBe(200);
    expect((await feature(seventh.campaign_id ?? 0, true)).status).toBe(200);
    const list = await client.ok("getFundraisingCampaignList", { query: PAGE });
    expect(
      list.campaign_list?.filter((row) => row.featured).map((row) => row.id),
    ).toEqual([802, 803, 804, 806, extra.campaign_id, seventh.campaign_id]);
  });

  test("refuses a missing action, and answers 404 for an unknown campaign", async () => {
    const client = createTestClient();
    const noAction = await client.call("updateFundraisingCampaignStatus", {
      path: { campaign_id: 801 },
      body: {},
    });
    expect(noAction.status).toBe(400);
    const unknown = await client.call("updateFundraisingCampaignStatus", {
      path: { campaign_id: 9999 },
      body: { action: "finalize" },
    });
    expect(unknown.status).toBe(404);
  });
});

describe("deleting a fundraising campaign", () => {
  test("hides it from the detail and the default list, and keeps it under status 4", async () => {
    const client = createTestClient();
    const deleted = await client.ok("deleteFundraisingCampaign", {
      path: { campaign_id: 801 },
    });
    expect(deleted).toEqual({ result: "ok" });
    const detail = await client.call("getFundraisingCampaignDetails", {
      path: { campaign_id: 801 },
    });
    expect(detail.status).toBe(404);
    expect(await campaignIds(client)).not.toContain(801);
    const archived = await client.ok("getFundraisingCampaignList", {
      query: { ...PAGE, status: [4] },
    });
    expect(archived.campaign_list).toEqual([
      expect.objectContaining({ id: 801, status: 4, featured: false }),
    ]);
    const again = await client.call("deleteFundraisingCampaign", {
      path: { campaign_id: 801 },
    });
    expect(again.status, "already deleted").toBe(404);
    const update = await client.call("updateFundraisingCampaign", {
      path: { campaign_id: 801 },
      body: { field: "title", value: "x" },
    });
    expect(update.status).toBe(404);
  });
});

describe("fundraising events", () => {
  test("list each event with its live campaigns and their successful donations", async () => {
    const client = createTestClient();
    const { event_list: events } = await client.ok("getFundraisingEvents");
    expect(events?.map((event) => event.id)).toEqual([851, 852, 853]);
    const expected = (ids: number[]) => ({
      donation_sum: ids.reduce(
        (sum, id) => sum + successfulTotal(client, id),
        0,
      ),
      campaign_count: ids.length,
    });
    expect(events?.[0]).toMatchObject({
      title: "Burs Seferberliği 2026",
      target: 2_500_000,
      ...expected([801, 803, 805]),
      donation_count: 25,
    });
    expect(events?.[1]).toMatchObject(expected([802, 804, 806]));
    expect(events?.[2]).toEqual({
      id: 853,
      title: "Mezunlar Gecesi",
      target: 0,
      donation_sum: 0,
      donation_count: 0,
      campaign_count: 0,
    });
    await client.ok("deleteFundraisingCampaign", {
      path: { campaign_id: 801 },
    });
    const after = await client.ok("getFundraisingEvents");
    expect(
      after.event_list?.[0],
      "a deleted campaign leaves the event",
    ).toMatchObject(expected([803, 805]));
  });

  test("creates, updates and deletes an event", async () => {
    const client = createTestClient();
    const created = await client.ok("createFundraisingEvent", {
      body: {
        id: 1,
        title: "Kış Kampı",
        has_target: true,
        target: 60_000,
        target_currency_id: 3,
        image: "https://kelder.example/media/events/kamp.jpg",
      },
    });
    expect(created).toEqual({ result: "ok" });
    const listed = await client.ok("getFundraisingEvents");
    const event = listed.event_list?.at(-1);
    expect(event).toMatchObject({
      id: 854,
      title: "Kış Kampı",
      target: 60_000,
    });
    await client.ok("updateFundraisingEvent", {
      path: { event_id: 854 },
      body: { id: 999, title: "Kış Kampı 2027", has_target: false },
    });
    const stored = kelder(client).fundraisingEvents.get(854);
    expect(
      stored,
      "has_target off falls back to TRY and keeps the image",
    ).toEqual({
      id: 854,
      title: "Kış Kampı 2027",
      has_target: false,
      target: 0,
      target_currency_id: 1,
      image: "https://kelder.example/media/events/kamp.jpg",
    });
    await client.ok("updateFundraisingEvent", {
      path: { event_id: 854 },
      body: {
        title: "Kış Kampı 2027",
        has_target: true,
        target: 75_000,
        target_currency_id: 1,
        image: "http://kelder.example/media/events/kamp2.jpg",
      },
    });
    expect(kelder(client).fundraisingEvents.get(854)).toMatchObject({
      has_target: true,
      target: 75_000,
      image: "http://kelder.example/media/events/kamp2.jpg",
    });
    await client.ok("deleteFundraisingEvent", { path: { event_id: 854 } });
    const gone = await client.ok("getFundraisingEvents");
    expect(gone.event_list?.map((row) => row.id)).toEqual([851, 852, 853]);
  });

  test("detaches the campaigns of a deleted event", async () => {
    const client = createTestClient();
    await client.ok("deleteFundraisingEvent", {
      path: { event_id: SCHOLARSHIP_EVENT },
    });
    expect(
      await campaignIds(client, {
        association_campaign_target_id: SCHOLARSHIP_EVENT,
      }),
    ).toEqual([]);
    const { campaign } = await client.ok("getFundraisingCampaignDetails", {
      path: { campaign_id: 801 },
    });
    expect(campaign?.association_campaign_target_id).toBeUndefined();
  });

  test("refuses an event without a title, a currency for its target, or an http image", async () => {
    const client = createTestClient();
    const cases = [
      { title: "  " },
      { title: "Hedefli", has_target: true, target: 10 },
      { title: "Resim", image: "kamp.jpg" },
      { title: "x".repeat(61) },
    ];
    for (const body of cases) {
      const created = await client.call("createFundraisingEvent", { body });
      expect(created.status, `create ${JSON.stringify(body)}`).toBe(400);
      const updated = await client.call("updateFundraisingEvent", {
        path: { event_id: 851 },
        body,
      });
      expect(updated.status, `update ${JSON.stringify(body)}`).toBe(400);
    }
    const noBody = await client.call("createFundraisingEvent", {});
    expect(noBody.status).toBe(400);
    for (const operationId of [
      "updateFundraisingEvent",
      "deleteFundraisingEvent",
    ] as const) {
      const response = await client.call(operationId, {
        path: { event_id: 9999 },
        body: { title: "x" },
      });
      expect(response.status, operationId).toBe(404);
    }
  });
});

describe("fundraising teams", () => {
  test("list live teams by title, with their campaigns' successful donations", async () => {
    const client = createTestClient();
    const list = await client.ok("getFundraisingTeams", { query: PAGE });
    expect(list.total).toBe(3);
    expect(list.team_list?.map((team) => team.title)).toEqual([
      "1995 Mezunları Takımı",
      "Kabataş Koşucuları",
      "Kürek Takımı Dayanışması",
    ]);
    expect(list.team_list?.[1]).toEqual({
      id: 872,
      user_id: 1007,
      user__name: expect.any(String),
      title: "Kabataş Koşucuları",
      image: "https://kelder.example/media/teams/kabatas-kosuculari.jpg",
      slug: "kabatas-kosuculari",
      currency_id: 1,
      currency__value: 1,
      currency__display: "TRY",
      create_date: "2026-05-15T09:00:00+03:00",
      status: 1,
      donation_sum: successfulTotal(client, 802),
      donation_count: 8,
    });
  });

  test("filter by status and query, page, and order by every value both ways", async () => {
    const client = createTestClient();
    const waiting = await client.ok("getFundraisingTeams", {
      query: { ...PAGE, status: 0 },
    });
    expect(waiting.team_list?.map((team) => team.id)).toEqual([873]);
    const found = await client.ok("getFundraisingTeams", {
      query: { ...PAGE, query: "kürek" },
    });
    expect(found.team_list?.map((team) => team.id)).toEqual([873]);
    const notFound = await client.ok("getFundraisingTeams", {
      query: { ...PAGE, query: "-kürek" },
    });
    expect(notFound.team_list?.map((team) => team.id)).toEqual([871, 872]);
    const paged = await client.ok("getFundraisingTeams", {
      query: { start_page: 2, how_many: 2 },
    });
    expect(paged.team_list?.map((team) => team.id)).toEqual([873]);
    expect(paged.total).toBe(3);
    const cases = {
      title: (team: { title?: string }) => team.title,
      create_date: (team: { create_date?: string }) => dateOf(team.create_date),
      user__name: (team: { user__name?: string }) => team.user__name,
      id: (team: { id?: number }) => team.id,
    };
    for (const [field, value] of Object.entries(cases)) {
      for (const descending of [false, true]) {
        const order_by = `${descending ? "-" : ""}${field}`;
        const list = await client.ok("getFundraisingTeams", {
          query: { ...PAGE, order_by },
        });
        expectOrdered(list.team_list ?? [], value, descending, order_by);
      }
    }
  });

  test("detail gives currency_id and currency__value as strings, the pending edits, and the team's campaigns", async () => {
    const client = createTestClient();
    const { team } = await client.ok("getFundraisingTeamDetail", {
      path: { team_id: 872 },
    });
    expect(team).toEqual({
      id: 872,
      user_id: 1007,
      user__name: expect.any(String),
      title: "Kabataş Koşucuları",
      image: "https://kelder.example/media/teams/kabatas-kosuculari.jpg",
      details: "Kabataş Koşucuları burs fonu için birlikte bağış topluyor.",
      slug: "kabatas-kosuculari",
      currency_id: "1",
      currency__value: "1",
      currency__display: "TRY",
      status: 1,
      update_title: "Kabataş Koşucuları 2026",
      update_details: "Güncellenmiş takım açıklaması onay bekliyor.",
      update_image:
        "https://kelder.example/media/teams/kabatas-kosuculari-yeni.jpg",
      donation_sum: successfulTotal(client, 802),
      donation_count: 8,
      campaign_list: [
        {
          id: 8703,
          title: "Kabataş Koşucuları - Burs",
          has_target: true,
          target: 150_000,
          target_currency_id: 1,
          default: true,
        },
        {
          id: 8704,
          title: "Kabataş Koşucuları - Maraton",
          has_target: true,
          target: 40_000,
          target_currency_id: 1,
          default: false,
        },
      ],
    });
    const campaigns = await client.ok("getFundraisingTeamsCampaigns", {
      path: { team_id: 872 },
    });
    expect(campaigns.team_campaign_list).toEqual([
      { id: 8703, title: "Kabataş Koşucuları - Burs", default: true },
      { id: 8704, title: "Kabataş Koşucuları - Maraton", default: false },
    ]);
  });

  test("creates a team with its default campaign", async () => {
    const client = createTestClient();
    const created = await client.ok("createFundraisingTeam", {
      body: {
        user_id: 1120,
        image: "https://kelder.example/media/teams/yeni.jpg",
        currency_id: 3,
        title: "Kabataş Koşucuları",
        details: "Avrupa'daki mezunlar.",
        campaign: {
          title: "Berlin Maratonu",
          has_target: true,
          target: 5000,
          target_currency_id: 3,
        },
      },
    });
    expect(created).toEqual({ team_id: 874 });
    const { team } = await client.ok("getFundraisingTeamDetail", {
      path: { team_id: 874 },
    });
    expect(team).toMatchObject({
      user_id: 1120,
      slug: "kabatas-kosuculari-2",
      currency_id: "3",
      currency__value: "48.65",
      currency__display: "EUR",
      status: 1,
      donation_sum: 0,
      donation_count: 0,
      campaign_list: [
        {
          id: 8707,
          title: "Berlin Maratonu",
          has_target: true,
          target: 5000,
          target_currency_id: 3,
          default: true,
        },
      ],
    });
    expect(team?.update_title).toBeUndefined();
    const plain = await client.ok("createFundraisingTeam", {
      body: {
        user_id: 1121,
        title: "Sade Takım",
        details: "",
        campaign: { title: "Genel" },
      },
    });
    const sade = await client.ok("getFundraisingTeamDetail", {
      path: { team_id: plain.team_id ?? 0 },
    });
    expect(sade.team).toMatchObject({
      currency_id: "1",
      image: "",
      campaign_list: [
        expect.objectContaining({
          has_target: false,
          target: 0,
          target_currency_id: 1,
          default: true,
        }),
      ],
    });
  });

  test("refuses a team whose campaign target lacks an amount or currency (400), or whose owner is unknown (404)", async () => {
    const client = createTestClient();
    const base = { user_id: 1120, title: "Takım", details: "" };
    const bad = [
      {
        ...base,
        campaign: { title: "Hedef", has_target: true, target_currency_id: 1 },
      },
      { ...base, campaign: { title: "Hedef", has_target: true, target: 10 } },
      { ...base, title: " ", campaign: { title: "Boş" } },
      { ...base, campaign: { title: " " } },
    ];
    for (const body of bad) {
      const response = await client.call("createFundraisingTeam", { body });
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
    const unknown = await client.call("createFundraisingTeam", {
      body: { ...base, user_id: 99_999, campaign: { title: "Kimsesiz" } },
    });
    expect(unknown.status).toBe(404);
  });

  test("updates a team and moves its default campaign", async () => {
    const client = createTestClient();
    const updated = await client.ok("updateFundraisingTeam", {
      path: { team_id: 871 },
      body: {
        user_id: 1009,
        image: "https://kelder.example/media/teams/1995-yeni.jpg",
        currency_id: 2,
        title: "1995 Mezunları",
        details: "Yeni açıklama",
        status: 5,
        campaign_list: [
          { id: 8701, default: false },
          { id: 8702, default: true },
        ],
      },
    });
    expect(updated).toEqual({});
    const { team } = await client.ok("getFundraisingTeamDetail", {
      path: { team_id: 871 },
    });
    expect(team).toMatchObject({
      user_id: 1009,
      title: "1995 Mezunları",
      details: "Yeni açıklama",
      image: "https://kelder.example/media/teams/1995-yeni.jpg",
      currency_id: "2",
      currency__display: "USD",
      status: 5,
      slug: "1995-mezunlari-takimi",
    });
    expect(
      team?.campaign_list?.map((campaign) => [campaign.id, campaign.default]),
    ).toEqual([
      [8701, false],
      [8702, true],
    ]);
    const usd = successfulTotal(client, 801) / 41.92;
    expect(team?.donation_sum, "totals follow the team currency").toBeCloseTo(
      usd,
      2,
    );
  });

  test("refuses team updates with two defaults (400), and foreign campaigns or owners (404)", async () => {
    const client = createTestClient();
    const base = {
      user_id: 1006,
      title: "1995",
      details: "",
      currency_id: 1,
      campaign_list: [],
    };
    const twoDefaults = await client.call("updateFundraisingTeam", {
      path: { team_id: 871 },
      body: {
        ...base,
        campaign_list: [
          { id: 8701, default: true },
          { id: 8702, default: true },
        ],
      },
    });
    expect(twoDefaults.status).toBe(400);
    const foreign = await client.call("updateFundraisingTeam", {
      path: { team_id: 871 },
      body: { ...base, campaign_list: [{ id: 8703, default: true }] },
    });
    expect(foreign.status, "a campaign of another team").toBe(404);
    const owner = await client.call("updateFundraisingTeam", {
      path: { team_id: 871 },
      body: { ...base, user_id: 99_999 },
    });
    expect(owner.status).toBe(404);
    const missing = await client.call("updateFundraisingTeam", {
      path: { team_id: 9999 },
      body: base,
    });
    expect(missing.status).toBe(404);
  });

  test("deletes a team: detail 404, gone from the default list, kept under status 4", async () => {
    const client = createTestClient();
    expect(
      await client.ok("deleteFundraisingTeam", { path: { team_id: 873 } }),
    ).toEqual({});
    for (const operationId of [
      "getFundraisingTeamDetail",
      "getFundraisingTeamsCampaigns",
      "deleteFundraisingTeam",
    ] as const) {
      const response = await client.call(operationId, {
        path: { team_id: 873 },
      });
      expect(response.status, operationId).toBe(404);
    }
    const list = await client.ok("getFundraisingTeams", { query: PAGE });
    expect(list.team_list?.map((team) => team.id)).toEqual([871, 872]);
    const deleted = await client.ok("getFundraisingTeams", {
      query: { ...PAGE, status: 4 },
    });
    expect(deleted.team_list?.map((team) => team.id)).toEqual([873]);
  });
});

describe("fundraising team campaigns", () => {
  test("create a campaign, make it the default, update and delete it", async () => {
    const client = createTestClient();
    const created = await client.ok("createFundraisingTeamCampaign", {
      path: { team_id: 872 },
      body: {
        default: true,
        title: "Yarı Maraton",
        has_target: true,
        target: 25_000,
        target_currency_id: 2,
      },
    });
    expect(created).toEqual({
      result: "ok",
      campaign: {
        id: 8707,
        title: "Yarı Maraton",
        has_target: true,
        target: 25_000,
        target_currency_id: 2,
        target_currency__display: "USD",
        default: true,
      },
    });
    const listed = await client.ok("getFundraisingTeamsCampaigns", {
      path: { team_id: 872 },
    });
    expect(
      listed.team_campaign_list?.map((campaign) => [
        campaign.id,
        campaign.default,
      ]),
    ).toEqual([
      [8703, false],
      [8704, false],
      [8707, true],
    ]);
    const updated = await client.ok("updateFundraisingTeamCampaign", {
      path: { team_id: 872, campaign_id: 8707 },
      body: { title: "Yarı Maraton 2027", has_target: false },
    });
    expect(updated.campaign).toEqual({
      id: 8707,
      title: "Yarı Maraton 2027",
      has_target: false,
      target: 0,
      target_currency_id: 1,
      target_currency__display: "TRY",
      default: true,
    });
    await client.ok("updateFundraisingTeamCampaign", {
      path: { team_id: 872, campaign_id: 8703 },
      body: {
        default: true,
        title: "Kabataş Koşucuları - Burs",
        has_target: true,
        target: 175_000,
        target_currency_id: 1,
      },
    });
    const { team } = await client.ok("getFundraisingTeamDetail", {
      path: { team_id: 872 },
    });
    expect(
      team?.campaign_list?.map((campaign) => [
        campaign.id,
        campaign.default,
        campaign.target,
      ]),
    ).toEqual([
      [8703, true, 175_000],
      [8704, false, 40_000],
      [8707, false, 0],
    ]);
    expect(
      await client.ok("deleteFundraisingTeamCampaign", {
        path: { team_id: 872, campaign_id: 8703 },
      }),
    ).toEqual({});
    const after = await client.ok("getFundraisingTeamsCampaigns", {
      path: { team_id: 872 },
    });
    expect(after.team_campaign_list?.map((campaign) => campaign.id)).toEqual([
      8704, 8707,
    ]);
    const detached = await client.ok("getFundraisingCampaignDetails", {
      path: { campaign_id: 802 },
    });
    expect(detached.campaign?.id).toBe(802);
    expect(
      await campaignIds(client, { team_campaign_id: 8703 }),
      "campaigns no longer point at the deleted team campaign",
    ).toEqual([]);
  });

  test("refuses a target without an amount or currency (400), and answers 404 for a campaign of another team", async () => {
    const client = createTestClient();
    const bad = [
      { title: "Hedef", has_target: true, target_currency_id: 1 },
      { title: "Hedef", has_target: true, target: 10 },
      { title: " " },
    ];
    for (const body of bad) {
      const created = await client.call("createFundraisingTeamCampaign", {
        path: { team_id: 871 },
        body,
      });
      expect(created.status, `create ${JSON.stringify(body)}`).toBe(400);
      const updated = await client.call("updateFundraisingTeamCampaign", {
        path: { team_id: 871, campaign_id: 8701 },
        body,
      });
      expect(updated.status, `update ${JSON.stringify(body)}`).toBe(400);
    }
    const unknownTeam = await client.call("createFundraisingTeamCampaign", {
      path: { team_id: 9999 },
      body: { title: "x" },
    });
    expect(unknownTeam.status).toBe(404);
    for (const operationId of [
      "updateFundraisingTeamCampaign",
      "deleteFundraisingTeamCampaign",
    ] as const) {
      const foreign = await client.call(operationId, {
        path: { team_id: 871, campaign_id: 8703 },
        body: { title: "x" },
      });
      expect(foreign.status, `${operationId} on another team's campaign`).toBe(
        404,
      );
      const noTeam = await client.call(operationId, {
        path: { team_id: 9999, campaign_id: 8701 },
        body: { title: "x" },
      });
      expect(noTeam.status, `${operationId} on an unknown team`).toBe(404);
    }
  });
});

describe("unknown currencies", () => {
  test("every write that names a currency answers 404 for an unknown one", async () => {
    const client = createTestClient();
    const team = { user_id: 1120, title: "Takım", details: "" };
    const target = { has_target: true, target: 10 };
    const cases: readonly (readonly [ServedOperationId, CallInput])[] = [
      [
        "createFundraisingCampaign",
        { body: { user_id: 1100, title: "Döviz", target_currency_id: 99 } },
      ],
      [
        "createFundraisingCampaign",
        { body: { user_id: 1100, title: "Döviz", currencies: [1, 42] } },
      ],
      [
        "createFundraisingEvent",
        { body: { title: "Döviz", ...target, target_currency_id: 77 } },
      ],
      [
        "updateFundraisingEvent",
        {
          path: { event_id: SCHOLARSHIP_EVENT },
          body: { title: "Döviz", ...target, target_currency_id: 77 },
        },
      ],
      [
        "createFundraisingTeam",
        { body: { ...team, currency_id: 9, campaign: { title: "Döviz" } } },
      ],
      [
        "createFundraisingTeam",
        {
          body: {
            ...team,
            campaign: { title: "Döviz", ...target, target_currency_id: 50 },
          },
        },
      ],
      [
        "updateFundraisingTeam",
        {
          path: { team_id: 871 },
          body: {
            user_id: 1006,
            title: "1995",
            details: "",
            currency_id: 99,
            campaign_list: [],
          },
        },
      ],
      [
        "createFundraisingTeamCampaign",
        {
          path: { team_id: 871 },
          body: { title: "Döviz", ...target, target_currency_id: 50 },
        },
      ],
      [
        "updateFundraisingTeamCampaign",
        {
          path: { team_id: 871, campaign_id: 8701 },
          body: { title: "Döviz", ...target, target_currency_id: 50 },
        },
      ],
    ];
    for (const [operationId, input] of cases) {
      const response = await client.call(operationId, input);
      expect(
        { status: response.status, body: response.body },
        `${operationId} ${JSON.stringify(input.body)}`,
      ).toEqual({ status: 404, body: { error: "Currency not found" } });
    }
  });
});
