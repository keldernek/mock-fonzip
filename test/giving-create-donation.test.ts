import { describe, expect, test } from "bun:test";

import {
  ALL_TIME,
  deliveries,
  givingClient,
  kelder,
  listAll,
  PAGE,
} from "./giving-support";

const CASH = {
  payment_method_select: "other",
  payment_method: 1,
  amount: 750,
} as const;

describe("createDonation", () => {
  test("records a donation for an existing member, with every documented field", async () => {
    const client = givingClient();
    const db = kelder(client);
    const member = db.users.get(1054);
    const before = member?.total_financial ?? 0;
    const created = await client.ok("createDonation", {
      body: {
        d_type: 1,
        amount: 1250.5,
        currency: "try",
        complete_date: "2026-10-30T07:30:00Z",
        details: "Gala gecesinde elden teslim alındı",
        member_id: 1054,
        first_name: "Mustafa",
        last_name: "Kara",
        email: "mustafa.kara@kurum.example",
        phone: "+905321234567",
        tckno: "10000000146",
        tax_department: "Beşiktaş",
        donor_type: "corporate",
        birthday: "1980-04-23",
        district: "Kadıköy",
        city: "İstanbul",
        address: "Moda Cad. No:1",
        post_code: "34710",
        payment_method: 2,
        transaction_id: "EFT-2026-001",
        payment_method_select: "other",
        receipt_no: "MKB-2026-77",
        section: "page",
        category_id: 202,
        fundraising_page_id: 31,
        module_id: 41,
        fundraising_campaign_id: 801,
        name_hidden: true,
        amount_visible: false,
        bank_account_id: 82,
        send_thanks_mail: true,
        thanks_mail_id: 301,
        ecard_id: 951,
        send_thanks_sms: true,
        thanks_sms_id: 305,
        referring: true,
        referring_name: "Selin Aydın",
        referring_email: "selin@eposta.example",
        referring_phone: "+905329998877",
        referring_district: "Beşiktaş",
        referring_city: "İstanbul",
        referring_address: "Nispetiye Cad. No:12",
        referring_thanks_mail_id: 301,
        referring_ecard_id: 952,
      },
    });
    expect(created).toEqual({
      result: "ok",
      result_code: "200",
      donation_id: expect.any(Number),
      member_id: 1054,
      fundraising_campaign_id: 801,
    });
    const detail = await client.ok("getDonationDetails", {
      path: { donation_id: created.donation_id ?? 0 },
    });
    expect(detail.donation).toMatchObject({
      d_type: 1,
      name: "Mustafa Kara",
      email: "mustafa.kara@kurum.example",
      phone: "+905321234567",
      tckno: "10000000146",
      donor_type: "corporate",
      birthday: "1980-04-23",
      address: "Moda Cad. No:1",
      city: "İstanbul",
      district: "Kadıköy",
      details: "Gala gecesinde elden teslim alındı",
      sub_donation_type_id: 202,
      fundraising_page_id: 31,
      fundraising_campaign_id: 801,
      module_id: 41,
      name_hidden: true,
      amount_visible: false,
      thanks_mail_id: 301,
      application_id: 3,
      application__name: "Kelder Entegrasyonu",
      referring: true,
      referring_name: "Selin Aydın",
      referring_email: "selin@eposta.example",
      referring_phone: "+905329998877",
      referring_address: "Nispetiye Cad. No:12",
      referring_city: "İstanbul",
      referring_district: "Beşiktaş",
      recurring_status: 0,
      recurring_withdrawal: false,
      sent_mail: { status: 0 },
      sent_mail_to_referring: { status: 0 },
      user: { id: 1054 },
      transaction: {
        amount: 1250.5,
        complete_date: "2026-10-30T10:30:00+03:00",
        currency: { iso_code: "TRY" },
        payment_status: 3,
        payment_method: 2,
        transaction_id: "EFT-2026-001",
        receipt_no: "MKB-2026-77",
        bank_account_id: 82,
        bank_account: { name: "Burs Fonu Hesabı" },
        fonzip_framework: false,
      },
    });
    expect(db.users.get(1054)?.total_financial).toBe(
      Math.round((before + 1250.5) * 100) / 100,
    );
    const listed = await listAll(client, "getDonationList", {
      status: "paid",
      bank_account_id: 82,
      list: ["amount", "donation_page"],
    });
    expect(listed.rows).toContainEqual(
      expect.objectContaining({
        id: created.donation_id,
        transaction__amount: 1250.5,
        fundraising_page__title: "Burs Fonuna Bağış",
      }),
    );
  });

  test("creates a new user when member_id is absent", async () => {
    const client = givingClient();
    const db = kelder(client);
    const users = db.users.count();
    const created = await client.ok("createDonation", {
      body: {
        ...CASH,
        first_name: "Zeynep",
        last_name: "Arslan",
        email: "zeynep.arslan@eposta.example",
        phone: "+905301112233",
        city: "İzmir",
      },
    });
    expect(db.users.count(), "one new user").toBe(users + 1);
    expect(created.member_id).toBeGreaterThan(1150);
    expect(db.users.get(created.member_id ?? 0)).toMatchObject({
      first_name: "Zeynep",
      last_name: "Arslan",
      email: "zeynep.arslan@eposta.example",
      city_text: "İzmir",
      total_financial: 750,
      corporate_type: false,
    });
    expect(created).not.toHaveProperty("fundraising_campaign_id");
    const theirs = await client.ok("getUsersDonationList", {
      path: { user_id: created.member_id ?? 0 },
      query: PAGE,
    });
    expect(theirs).toEqual({
      donation_list: [
        {
          id: created.donation_id,
          d_type: 0,
          transaction__payment_method: 1,
          transaction__complete_date: "2026-11-01T09:00:00+03:00",
          transaction__amount: 750,
          transaction__currency__display: "TRY",
          transaction__payment_status: 3,
        },
      ],
      total: 1,
    });
  });

  test("fires the DONATION webhook with status 3", async () => {
    const client = givingClient();
    const created = await client.ok("createDonation", {
      body: { ...CASH, member_id: 1054 },
    });
    const donationId = created.donation_id ?? 0;
    expect(deliveries(client).map((delivery) => delivery.body)).toEqual([
      { id: donationId, webhook_id: 21, operation: 1, status: 3 },
      { id: donationId, webhook_id: 22, operation: 1, status: 3 },
    ]);
  });

  test("records a donation in another currency in that currency", async () => {
    const client = givingClient();
    const created = await client.ok("createDonation", {
      body: { ...CASH, member_id: 1054, currency: "USD", amount: 100 },
    });
    const detail = await client.ok("getDonationDetails", {
      path: { donation_id: created.donation_id ?? 0 },
    });
    expect(detail.donation?.transaction?.currency).toMatchObject({
      id: 2,
      iso_code: "USD",
    });
  });

  test("marks a thanks mail to a donor without an address as invalid", async () => {
    const client = givingClient();
    const created = await client.ok("createDonation", {
      body: {
        ...CASH,
        first_name: "Adsız",
        send_thanks_mail: true,
        thanks_mail_id: 301,
      },
    });
    const detail = await client.ok("getDonationDetails", {
      path: { donation_id: created.donation_id ?? 0 },
    });
    expect(detail.donation?.sent_mail?.status, "5 is Invalid").toBe(5);
    expect(detail.donation).not.toHaveProperty("email");
  });

  test.each([
    [
      "card through payment_method_select",
      { ...CASH, member_id: 1054, payment_method_select: "card" },
      "Card payments are not available in the API",
    ],
    [
      "card through payment_method",
      { ...CASH, member_id: 1054, payment_method: 0 },
      "Card payments are not available in the API",
    ],
    [
      "no payment_method_select",
      { payment_method: 1, amount: 10, member_id: 1054 },
      "payment_method_select must be other",
    ],
    [
      "no payment_method",
      { payment_method_select: "other", amount: 10, member_id: 1054 },
      "payment_method is required",
    ],
    [
      "a zero amount",
      { ...CASH, member_id: 1054, amount: 0 },
      "amount must be greater than zero",
    ],
    [
      "an unknown currency",
      { ...CASH, member_id: 1054, currency: "XYZ" },
      "Unknown currency XYZ",
    ],
    [
      "section page without a page",
      { ...CASH, member_id: 1054, section: "page" },
      "fundraising_page_id is required for section page",
    ],
    [
      "section fundraising without a campaign",
      { ...CASH, member_id: 1054, section: "fundraising" },
      "fundraising_campaign_id is required for section fundraising",
    ],
    [
      "section form without a form",
      { ...CASH, member_id: 1054, section: "form" },
      "module_id is required for section form",
    ],
    [
      "a thanks mail without a template",
      { ...CASH, member_id: 1054, send_thanks_mail: true },
      "thanks_mail_id is required when send_thanks_mail is true",
    ],
    [
      "a thanks SMS without a template",
      { ...CASH, member_id: 1054, send_thanks_sms: true },
      "thanks_sms_id is required when send_thanks_sms is true",
    ],
    [
      "a new user without a first name",
      { ...CASH, last_name: "Kara" },
      "first_name is required to create a new user when member_id is absent",
    ],
  ])("refuses %s with 400", async (_name, body, error) => {
    const client = givingClient();
    const donations = kelder(client).donations.count();
    const response = await client.call("createDonation", { body });
    expect(response).toMatchObject({ status: 400, body: { error } });
    expect(kelder(client).donations.count(), "nothing recorded").toBe(
      donations,
    );
  });

  test.each([
    ["member_id", { member_id: 9 }, "User not found"],
    ["category_id", { category_id: 9 }, "Donation category not found"],
    [
      "fundraising_page_id",
      { fundraising_page_id: 9 },
      "Donation page not found",
    ],
    ["module_id", { module_id: 9 }, "Donation form not found"],
    [
      "fundraising_campaign_id",
      { fundraising_campaign_id: 9 },
      "Fundraising campaign not found",
    ],
    ["bank_account_id", { bank_account_id: 9 }, "Bank account not found"],
    ["thanks_mail_id", { thanks_mail_id: 9 }, "Template not found"],
    ["thanks_sms_id", { thanks_sms_id: 9 }, "Template not found"],
    [
      "referring_thanks_mail_id",
      { referring_thanks_mail_id: 9 },
      "Template not found",
    ],
    ["ecard_id", { ecard_id: 9 }, "E-card not found"],
    ["referring_ecard_id", { referring_ecard_id: 9 }, "E-card not found"],
  ])("answers 404 for an unknown %s", async (_name, reference, error) => {
    const client = givingClient();
    const response = await client.call("createDonation", {
      body: { ...CASH, first_name: "Deneme", ...reference },
    });
    expect(response).toMatchObject({ status: 404, body: { error } });
    expect(deliveries(client), "no webhook for a refused donation").toEqual([]);
  });

  test("a created donation lands in the paid list for its date range", async () => {
    const client = givingClient();
    const created = await client.ok("createDonation", {
      body: {
        ...CASH,
        member_id: 1054,
        complete_date: "2025-01-15T12:00:00+03:00",
      },
    });
    const january = await client.ok("getDonationList", {
      query: {
        status: "paid",
        ...PAGE,
        start_date: "2025-01-01T00:00:00+03:00",
        end_date: "2025-02-01T00:00:00+03:00",
      },
    });
    expect(january.donation_list?.map((row) => row.id)).toEqual([
      created.donation_id,
    ]);
    const refunds = await client.ok("getDonationList", {
      query: { status: "refund", ...PAGE, ...ALL_TIME },
    });
    expect(refunds.donation_list?.map((row) => row.id)).not.toContain(
      created.donation_id,
    );
  });
});
