import { describe, expect, test } from "bun:test";

import {
  deliveries,
  givingClient,
  idsOf,
  kelder,
  listAll,
  PAGE,
} from "./giving-support";
import type { TestClient } from "../src/testing/client";

async function monthlyOf(
  client: TestClient,
  userId: number,
  donationId: number,
) {
  const body = await client.ok("getUsersMonthlyDonationList", {
    path: { user_id: userId },
  });
  const found = body.recurring?.find((row) => row.id === donationId);
  if (!found) throw new Error(`monthly donation ${donationId} not listed`);
  return found;
}

async function detailOf(client: TestClient, donationId: number) {
  const body = await client.ok("getDonationDetails", {
    path: { donation_id: donationId },
  });
  if (!body.donation) throw new Error(`donation ${donationId} has no detail`);
  return body.donation;
}

describe("getUsersMonthlyDonationList", () => {
  test("lists a donor's monthly donations with their card and latest request", async () => {
    const client = givingClient();
    const db = kelder(client);
    const body = await client.ok("getUsersMonthlyDonationList", {
      path: { user_id: 1054 },
    });
    const card = db.cardInfos.find((row) => row.user_id === 1054);
    expect(body.recurring).toEqual([
      {
        id: 50_001,
        sub_donation_type_id: expect.any(Number),
        sub_donation_type__name: expect.any(String),
        transaction__payment_method: 0,
        transaction__complete_date: expect.any(String),
        transaction__amount: 1000,
        transaction__currency__display: "TRY",
        fundraising_page_id: expect.any(Number),
        fundraising_page__title: expect.any(String),
        recurring_next_amount: 1000,
        card_info_id: card?.id,
        recurring_order_id: "RO-75751845",
        user_id: 1054,
        card_info__last_four: card?.last_four,
        recurring_status: 1,
        recurring_next_cycle: expect.stringMatching(/^2026-1[12]-\d\d$/),
        recurringcancelrequest__status: 0,
        recurringcancelrequest__request_type: 0,
      },
    ]);
  });

  test("lists every series of a donor, and none for a single-gift donor", async () => {
    const client = givingClient();
    const db = kelder(client);
    const twoSeries = await client.ok("getUsersMonthlyDonationList", {
      path: { user_id: 1137 },
    });
    expect(
      twoSeries.recurring?.map((row) => row.id ?? 0).sort((a, b) => a - b),
    ).toEqual([50_043, 50_061]);
    expect(
      twoSeries.recurring?.find((row) => row.id === 50_061),
      "no request, so no request fields",
    ).not.toHaveProperty("recurringcancelrequest__status");
    const single = db.donations.find(
      (row) =>
        row.recurring_order_id === null &&
        !db.donations.find(
          (other) =>
            other.user_id === row.user_id && other.recurring_order_id !== null,
        ),
    );
    const none = await client.ok("getUsersMonthlyDonationList", {
      path: { user_id: single?.user_id ?? 0 },
    });
    expect(none).toEqual({ recurring: [] });
  });

  test("lists a campaign-linked series with its application", async () => {
    const client = givingClient();
    const db = kelder(client);
    db.donations.update(50_023, {
      fundraising_campaign_id: 801,
      application_id: 3,
    });
    const row = await monthlyOf(client, 1100, 50_023);
    expect(row).toMatchObject({
      fundraising_campaign_id: 801,
      fundraising_campaign__title: expect.any(String),
      application_id: 3,
      application__title: "Kelder Entegrasyonu",
    });
  });

  test("answers 404 for an unknown user", async () => {
    const client = givingClient();
    const response = await client.call("getUsersMonthlyDonationList", {
      path: { user_id: 9 },
    });
    expect(response).toMatchObject({
      status: 404,
      body: { error: "User not found" },
    });
  });
});

describe("getUsersDonationList and getUsersMicroDonationList", () => {
  test("list a user's donations newest first, in pages", async () => {
    const client = givingClient();
    const db = kelder(client);
    const mine = db.donations
      .list((row) => row.user_id === 1054)
      .map((row) => ({
        id: row.id,
        at: Date.parse(
          db.transactions.get(row.transaction_id)?.complete_date ?? "",
        ),
      }))
      .sort((a, b) => b.at - a.at);
    expect(mine.length).toBeGreaterThan(3);
    const all = await client.ok("getUsersDonationList", {
      path: { user_id: 1054 },
      query: PAGE,
    });
    expect(all.total).toBe(mine.length);
    expect(all.donation_list?.map((row) => row.id)).toEqual(
      mine.map((row) => row.id),
    );
    const second = await client.ok("getUsersDonationList", {
      path: { user_id: 1054 },
      query: { start_page: 2, how_many: 2 },
    });
    expect(second.donation_list?.map((row) => row.id)).toEqual(
      mine.slice(2, 4).map((row) => row.id),
    );
    expect(second.total).toBe(mine.length);
    expect(all.donation_list?.[0]).toMatchObject({
      sub_donation_type__name: expect.any(String),
      transaction__payment_status: expect.any(Number),
      d_type: 0,
    });
  });

  test("list a user's micro donations, whatever their state", async () => {
    const client = givingClient();
    const db = kelder(client);
    const micro = db.microDonations.list();
    const donor = micro[0]?.user_id ?? 0;
    const expected = micro.filter((row) => row.user_id === donor);
    const body = await client.ok("getUsersMicroDonationList", {
      path: { user_id: donor },
      query: PAGE,
    });
    expect(body.total).toBe(expected.length);
    expect(idsOf(body.donation_list ?? [])).toEqual(idsOf(expected));
    const states = new Set(
      micro.map(
        (row) => db.transactions.get(row.transaction_id)?.payment_status,
      ),
    );
    expect(states.size, "refunded and failed micro donations exist").toBe(3);
    const failed = micro.find(
      (row) => db.transactions.get(row.transaction_id)?.payment_status === 5,
    );
    const failedList = await client.ok("getUsersMicroDonationList", {
      path: { user_id: failed?.user_id ?? 0 },
      query: PAGE,
    });
    expect(failedList.donation_list).toContainEqual(
      expect.objectContaining({
        id: failed?.id,
        transaction__payment_status: 5,
      }),
    );
  });

  test("answer 404 for an unknown user", async () => {
    const client = givingClient();
    for (const operationId of [
      "getUsersDonationList",
      "getUsersMicroDonationList",
    ] as const) {
      const response = await client.call(operationId, {
        path: { user_id: 9 },
        query: PAGE,
      });
      expect(response.status, operationId).toBe(404);
    }
  });
});

describe("createMonthlyDonationUpdateRequest and respondMonthlyDonationAmountChangeRequest", () => {
  test("an approved amount request changes the next withdrawal amount", async () => {
    const client = givingClient();
    const created = await client.ok("createMonthlyDonationUpdateRequest", {
      path: { user_id: 1100, donation_id: 50_023 },
      body: { type: "amount", value: "650" },
    });
    expect(created).toEqual({ result: "ok" });
    expect(await monthlyOf(client, 1100, 50_023)).toMatchObject({
      recurringcancelrequest__status: 0,
      recurringcancelrequest__request_type: 1,
    });
    const pending = await client.call("createMonthlyDonationUpdateRequest", {
      path: { user_id: 1100, donation_id: 50_023 },
      body: { type: "cancel", value: "Taşınıyorum" },
    });
    expect(pending).toMatchObject({
      status: 400,
      body: { error: "The monthly donation already has a pending request" },
    });
    await client.ok("respondMonthlyDonationAmountChangeRequest", {
      path: { donation_id: 50_023 },
      body: { approval: true },
    });
    expect(await monthlyOf(client, 1100, 50_023)).toMatchObject({
      recurringcancelrequest__status: 3,
      recurring_next_amount: 650,
    });
    expect((await detailOf(client, 50_023)).recurring_next_amount).toBe(650);
    const answered = await client.call(
      "respondMonthlyDonationAmountChangeRequest",
      { path: { donation_id: 50_023 }, body: { approval: true } },
    );
    expect(answered).toMatchObject({
      status: 404,
      body: { error: "Amount change request not found" },
    });
  });

  test("a rejected amount request leaves the amount alone", async () => {
    const client = givingClient();
    const before = await monthlyOf(client, 1130, 50_005);
    expect(before.recurringcancelrequest__status, "seeded as pending").toBe(0);
    await client.ok("respondMonthlyDonationAmountChangeRequest", {
      path: { donation_id: 50_005 },
      body: { approval: false },
    });
    const after = await monthlyOf(client, 1130, 50_005);
    expect(after).toMatchObject({
      recurringcancelrequest__status: 4,
      recurring_next_amount: before.recurring_next_amount,
    });
  });

  test("a cancel request is answered when the donation is cancelled", async () => {
    const client = givingClient();
    await client.ok("createMonthlyDonationUpdateRequest", {
      path: { user_id: 1093, donation_id: 50_037 },
      body: { type: "cancel", value: "Bütçemi küçültüyorum" },
    });
    const notAmount = await client.call(
      "respondMonthlyDonationAmountChangeRequest",
      { path: { donation_id: 50_037 }, body: { approval: true } },
    );
    expect(notAmount.status, "a cancel request is not an amount request").toBe(
      404,
    );
    await client.ok("cancelMonthlyDonation", {
      path: { donation_id: 50_037 },
      body: { action: "cancel", reason: "Bağışçının talebi" },
    });
    expect(await monthlyOf(client, 1093, 50_037)).toMatchObject({
      recurring_status: 3,
      recurringcancelrequest__status: 1,
      recurringcancelrequest__request_type: 0,
    });
  });

  test("refuses bad requests with 400 and unknown objects with 404", async () => {
    const client = givingClient();
    const cases = [
      [{ user_id: 1100, donation_id: 50_023 }, {}, 400, "type is required"],
      [
        { user_id: 1100, donation_id: 50_023 },
        { type: "cancel" },
        400,
        "value is required",
      ],
      [
        { user_id: 1100, donation_id: 50_023 },
        { type: "amount", value: "çok" },
        400,
        "value must be the new monthly amount",
      ],
      [
        { user_id: 1035, donation_id: 50_069 },
        { type: "cancel", value: "x" },
        400,
        "The monthly donation is cancelled",
      ],
      [
        { user_id: 9, donation_id: 50_023 },
        { type: "cancel", value: "x" },
        404,
        "User not found",
      ],
      [
        { user_id: 1054, donation_id: 50_023 },
        { type: "cancel", value: "x" },
        404,
        "Monthly donation not found",
      ],
      [
        { user_id: 1047, donation_id: 50_253 },
        { type: "cancel", value: "x" },
        404,
        "Monthly donation not found",
      ],
    ] as const;
    for (const [path, body, status, error] of cases) {
      const response = await client.call("createMonthlyDonationUpdateRequest", {
        path,
        body,
      });
      expect(response, JSON.stringify(body)).toMatchObject({
        status,
        body: { error },
      });
    }
    const unknown = await client.call(
      "respondMonthlyDonationAmountChangeRequest",
      {
        path: { donation_id: 49_999 },
        body: { approval: true },
      },
    );
    expect(unknown).toMatchObject({
      status: 404,
      body: { error: "Monthly donation not found" },
    });
  });
});

describe("cancelMonthlyDonation", () => {
  test("cancels the whole series and records the reason", async () => {
    const client = givingClient();
    const db = kelder(client);
    await client.ok("cancelMonthlyDonation", {
      path: { donation_id: 50_001 },
      body: {
        action: "cancel",
        reason: "Bağışçı taşındı",
        send_cancellation_mail: false,
      },
    });
    expect(await detailOf(client, 50_001)).toMatchObject({
      recurring_status: 3,
      recurring_cancel_reason: "Bağışçı taşındı",
      recurring_cancel_date: "2026-11-01",
    });
    const detail = await detailOf(client, 50_001);
    expect(detail).not.toHaveProperty("recurring_next_cycle");
    expect(detail).not.toHaveProperty("recurring_next_amount");
    const series = await listAll(client, "getDonationList", {
      status: "paid",
      recurring: 1,
      list: ["recurring_order_id"],
    });
    const statuses = new Set(
      series.rows
        .filter((row) => row.recurring_order_id === "RO-75751845")
        .map((row) => row.recurring_status),
    );
    expect(statuses, "every withdrawal shows the cancelled series").toEqual(
      new Set([3]),
    );
    expect(
      db.monthlyDonationRequests.get(7001),
      "the seeded cancel request is answered",
    ).toMatchObject({ status: 1, response_date: "2026-11-01T09:00:00+03:00" });
    const again = await client.call("cancelMonthlyDonation", {
      path: { donation_id: 50_001 },
      body: { action: "cancel", reason: "tekrar" },
    });
    expect(again).toMatchObject({
      status: 400,
      body: { error: "The monthly donation is already cancelled" },
    });
  });

  test("closes a pending amount request as rejected", async () => {
    const client = givingClient();
    await client.ok("cancelMonthlyDonation", {
      path: { donation_id: 50_005 },
      body: { action: "cancel", reason: "Kart iptal edildi" },
    });
    expect(kelder(client).monthlyDonationRequests.get(7002)?.status).toBe(4);
  });

  test("sends a cancellation mail only with a subject and visible message", async () => {
    const client = givingClient();
    const cases = [
      { subject: "", message: "<p>İptal edildi</p>" },
      { subject: "Bağışınız iptal edildi", message: "<p> &nbsp; </p>" },
      { subject: "Bağışınız iptal edildi" },
    ];
    for (const mail of cases) {
      const response = await client.call("cancelMonthlyDonation", {
        path: { donation_id: 50_013 },
        body: {
          action: "cancel",
          reason: "x",
          send_cancellation_mail: true,
          ...mail,
        },
      });
      expect(response, JSON.stringify(mail)).toMatchObject({
        status: 400,
        body: {
          error: "subject and message are required to send a cancellation mail",
        },
      });
    }
    expect(
      (await detailOf(client, 50_013)).recurring_status,
      "a refused request cancels nothing",
    ).toBe(1);
    await client.ok("cancelMonthlyDonation", {
      path: { donation_id: 50_013 },
      body: {
        action: "cancel",
        reason: "x",
        send_cancellation_mail: true,
        subject: "Bağışınız iptal edildi",
        message: '<p><img src="https://kelder.example/tesekkurler.png"></p>',
      },
    });
    expect((await detailOf(client, 50_013)).recurring_status).toBe(3);
  });

  test("saves the message as a new template", async () => {
    const client = givingClient();
    const db = kelder(client);
    const before = db.templates.count();
    await client.ok("cancelMonthlyDonation", {
      path: { donation_id: 50_017 },
      body: {
        action: "cancel",
        reason: "x",
        send_cancellation_mail: true,
        save_as_template: true,
        title: "Düzenli Bağış İptali",
        subject: "Düzenli bağışınız durduruldu",
        message: "<p>Talebiniz üzerine düzenli bağışınızı durdurduk.</p>",
        has_association_logo: false,
        type_sms: false,
        background_color: "#001122",
        body_color: "#ffffff",
        footer_text_color: "#334455",
        footer_icon_color: 0,
        has_button: true,
        btn_text: "Yeniden Başlat",
        btn_color: "#8b1d2c",
        btn_text_color: "#ffffff",
        btn_operation: 2,
        btn_operation_detail: "donation",
        translations: {
          language_code: {
            subject: "Your monthly donation stopped",
            message: "<p>We stopped your monthly donation.</p>",
            btn_text: "Restart",
          },
        },
      },
    });
    expect(db.templates.count()).toBe(before + 1);
    expect(db.templates.list().at(-1)).toMatchObject({
      title: "Düzenli Bağış İptali",
      subject: "Düzenli bağışınız durduruldu",
      has_association_logo: false,
      background_color: "#001122",
      footer_icon_color: 0,
      has_button: true,
      btn_text: "Yeniden Başlat",
      btn_operation_detail: "donation",
      translations: { language_code: { btn_text: "Restart" } },
    });
  });

  test("overwrites the template it sends from", async () => {
    const client = givingClient();
    const db = kelder(client);
    await client.ok("cancelMonthlyDonation", {
      path: { donation_id: 50_023 },
      body: {
        action: "cancel",
        reason: "x",
        send_cancellation_mail: true,
        send_from_template: true,
        update_template: true,
        template_id: 304,
        subject: "Düzenli bağışınız iptal edildi",
        message: "<p>Görüşmek üzere.</p>",
      },
    });
    expect(db.templates.get(304)).toMatchObject({
      title: "Kart Güncelleme",
      subject: "Düzenli bağışınız iptal edildi",
      message: "<p>Görüşmek üzere.</p>",
    });
  });

  test("refuses bad requests with 400 and unknown objects with 404", async () => {
    const client = givingClient();
    const cases = [
      [50_029, { action: "stop", reason: "x" }, 400, 'action must be "cancel"'],
      [50_029, { action: "cancel", reason: "  " }, 400, "reason is required"],
      [
        50_029,
        { action: "cancel", reason: "x", send_from_template: true },
        400,
        "template_id is required to use a saved template",
      ],
      [
        50_029,
        {
          action: "cancel",
          reason: "x",
          update_template: true,
          template_id: 9,
        },
        404,
        "Template not found",
      ],
      [
        50_029,
        { action: "cancel", reason: "x", save_as_template: true },
        400,
        "title is required to save the message as a template",
      ],
      [
        49_999,
        { action: "cancel", reason: "x" },
        404,
        "Monthly donation not found",
      ],
      [
        50_253,
        { action: "cancel", reason: "x" },
        404,
        "Monthly donation not found",
      ],
    ] as const;
    for (const [donationId, body, status, error] of cases) {
      const response = await client.call("cancelMonthlyDonation", {
        path: { donation_id: donationId },
        body,
      });
      expect(response, JSON.stringify(body)).toMatchObject({
        status,
        body: { error },
      });
    }
    expect((await detailOf(client, 50_029)).recurring_status).toBe(1);
  });
});

describe("changeMonthlyDonationValues", () => {
  test("changes the next withdrawal date, category and amount", async () => {
    const client = givingClient();
    const path = { monthly_donation_order_id: "RO-24728384" };
    await client.ok("changeMonthlyDonationValues", {
      path,
      body: {
        mode: "date",
        donation_id: 50_047,
        recurring_next_cycle: "2027-01-15",
      },
    });
    await client.ok("changeMonthlyDonationValues", {
      path,
      body: { mode: "category", donation_id: 50_047, category_id: 206 },
    });
    await client.ok("changeMonthlyDonationValues", {
      path,
      body: { mode: "amount", donation_id: 50_047, amount: 425.5 },
    });
    expect(await detailOf(client, 50_047)).toMatchObject({
      recurring_next_cycle: "2027-01-15",
      sub_donation_type_id: 206,
      recurring_next_amount: 425.5,
    });
    expect(await monthlyOf(client, 1072, 50_047)).toMatchObject({
      sub_donation_type__name: "Kütüphane",
      recurring_next_amount: 425.5,
      recurring_next_cycle: "2027-01-15",
    });
  });

  test("retries a failed withdrawal, records it and fires the webhook", async () => {
    const client = givingClient();
    const db = kelder(client);
    const before = await detailOf(client, 50_056);
    expect(before).toMatchObject({
      recurring_status: 2,
      recurring_error: "Yetersiz bakiye",
    });
    await client.ok("changeMonthlyDonationValues", {
      path: { monthly_donation_order_id: "RO-88256644" },
      body: { mode: "retry", donation_id: 50_056 },
    });
    const withdrawal = db.donations
      .list((row) => row.monthly_donation_id === 50_056)
      .at(-1);
    const amount = before.transaction?.amount ?? 0;
    expect(await detailOf(client, withdrawal?.id ?? 0)).toMatchObject({
      recurring_withdrawal: true,
      recurring_status: 1,
      recurring_order_id: "RO-88256644",
      card_info: before.card_info,
      transaction: {
        amount,
        payment_status: 3,
        payment_method: 0,
        complete_date: "2026-11-01T09:00:00+03:00",
        fonzip_framework: true,
      },
    });
    const after = await detailOf(client, 50_056);
    expect(after).toMatchObject({
      recurring_status: 1,
      recurring_withdraw_count: (before.recurring_withdraw_count ?? 0) + 1,
      recurring_total_withdraw_count:
        (before.recurring_total_withdraw_count ?? 0) + 1,
      recurring_total_withdraw_amount:
        (before.recurring_total_withdraw_amount ?? 0) + amount,
      recurring_last_success_withdrawal_date: "2026-11-01",
      recurring_next_cycle: "2026-12-01",
    });
    expect(after).not.toHaveProperty("recurring_error");
    expect(deliveries(client).map((delivery) => delivery.body)).toContainEqual({
      id: withdrawal?.id ?? 0,
      webhook_id: 21,
      operation: 1,
      status: 3,
    });
    const twice = await client.call("changeMonthlyDonationValues", {
      path: { monthly_donation_order_id: "RO-88256644" },
      body: { mode: "retry", donation_id: 50_056 },
    });
    expect(twice).toMatchObject({
      status: 400,
      body: {
        error:
          "Only a monthly donation whose last withdrawal failed can be retried",
      },
    });
  });

  test("refuses bad changes with 400 and unknown objects with 404", async () => {
    const client = givingClient();
    const active = { monthly_donation_order_id: "RO-70610581" };
    const cases = [
      [
        active,
        { mode: "date", donation_id: 50_053 },
        400,
        "recurring_next_cycle is required",
      ],
      [
        active,
        {
          mode: "date",
          donation_id: 50_053,
          recurring_next_cycle: "2026-11-01",
        },
        400,
        "recurring_next_cycle must be a future date",
      ],
      [
        active,
        { mode: "category", donation_id: 50_053 },
        400,
        "category_id is required",
      ],
      [
        active,
        { mode: "category", donation_id: 50_053, category_id: 9 },
        404,
        "Donation category not found",
      ],
      [
        active,
        { mode: "amount", donation_id: 50_053, amount: 0 },
        400,
        "amount must be greater than zero",
      ],
      [
        active,
        { mode: "amount", donation_id: 50_001, amount: 5 },
        404,
        "Monthly donation not found",
      ],
      [
        { monthly_donation_order_id: "RO-39404297" },
        { mode: "amount", donation_id: 50_064, amount: 5 },
        400,
        "The monthly donation is cancelled",
      ],
      [
        active,
        { mode: "amount", donation_id: 49_999, amount: 5 },
        404,
        "Monthly donation not found",
      ],
    ] as const;
    for (const [path, body, status, error] of cases) {
      const response = await client.call("changeMonthlyDonationValues", {
        path,
        body,
      });
      expect(response, JSON.stringify(body)).toMatchObject({
        status,
        body: { error },
      });
    }
  });
});

describe("sendCardUpdateRequestForMonthlyDonation", () => {
  test("accepts an email or SMS request for a donor's monthly donation", async () => {
    const client = givingClient();
    for (const mode of ["email", "sms"] as const) {
      const response = await client.ok(
        "sendCardUpdateRequestForMonthlyDonation",
        {
          path: { user_id: 1010, donation_id: 50_056 },
          body: { mode },
        },
      );
      expect(response).toEqual({ result: "ok" });
    }
  });

  test("refuses a channel the donor cannot be reached on", async () => {
    const client = givingClient();
    kelder(client).users.update(1010, { email: "", phone: "" });
    const email = await client.call("sendCardUpdateRequestForMonthlyDonation", {
      path: { user_id: 1010, donation_id: 50_056 },
      body: { mode: "email" },
    });
    expect(email).toMatchObject({
      status: 400,
      body: { error: "The donor has no email address" },
    });
    const sms = await client.call("sendCardUpdateRequestForMonthlyDonation", {
      path: { user_id: 1010, donation_id: 50_056 },
      body: { mode: "sms" },
    });
    expect(sms).toMatchObject({
      status: 400,
      body: { error: "The donor has no mobile phone number" },
    });
  });

  test("refuses bad requests with 400 and unknown objects with 404", async () => {
    const client = givingClient();
    const cases = [
      [{ user_id: 1010, donation_id: 50_056 }, {}, 400, "mode is required"],
      [
        { user_id: 1035, donation_id: 50_069 },
        { mode: "email" },
        400,
        "The monthly donation is cancelled",
      ],
      [
        { user_id: 9, donation_id: 50_056 },
        { mode: "email" },
        404,
        "User not found",
      ],
      [
        { user_id: 1054, donation_id: 50_056 },
        { mode: "email" },
        404,
        "Monthly donation not found",
      ],
    ] as const;
    for (const [path, body, status, error] of cases) {
      const response = await client.call(
        "sendCardUpdateRequestForMonthlyDonation",
        {
          path,
          body,
        },
      );
      expect(response, JSON.stringify(path)).toMatchObject({
        status,
        body: { error },
      });
    }
  });
});
