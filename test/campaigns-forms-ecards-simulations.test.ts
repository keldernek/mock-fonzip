import { describe, expect, test } from "bun:test";

import { createTestClient, type TestClient } from "../src/testing/client";
import {
  kelder,
  notifications,
  PAGE,
  simulate,
} from "./campaigns-forms-ecards-support";

const RANGE = {
  start_date: "2025-01-01T00:00:00+03:00",
  end_date: "2026-11-02T00:00:00+03:00",
};

function idOf(body: unknown, key: string): number {
  const value: unknown =
    typeof body === "object" && body !== null
      ? Reflect.get(body, key)
      : undefined;
  if (typeof value !== "number")
    throw new Error(`no ${key} in ${JSON.stringify(body)}`);
  return value;
}

async function saleIds(
  client: TestClient,
  query: Record<string, string | number>,
) {
  const list = await client.ok("getEcardTransactionList", {
    query: { ...RANGE, ...PAGE, ...query },
  });
  return (list.sale_list ?? []).map((sale) => sale.id);
}

describe("the campaigns-forms-ecards simulations", () => {
  test("are listed on the control plane with their inputs", async () => {
    const client = createTestClient();
    const response = await client.request("/__mock/simulations");
    const body: unknown = await response.json();
    expect(body).toMatchObject({
      simulations: expect.arrayContaining(
        ["form-answer", "ecard-sale", "ecard-refund"].map((name) =>
          expect.objectContaining({
            domain: "campaigns-forms-ecards",
            name,
            description: expect.any(String),
            input: expect.any(Object),
          }),
        ),
      ),
    });
  });
});

describe("a form answered on the public site", () => {
  test("creates the answer, a new contact and a wire payment, and fires the FORM webhook with status 3", async () => {
    const client = createTestClient();
    const before = await client.ok("getFormList", { query: PAGE });
    const result = await simulate(client, "form-answer", {
      form_id: 703,
      first_name: "Deniz",
      last_name: "Ergin",
      email: "deniz.ergin@eposta.example",
      phone: "+905550001122",
      payment_method: 2,
      bank_account_id: 82,
    });
    expect(result.status).toBe(200);
    const answerId = idOf(result.body, "answer_id");
    const userId = idOf(result.body, "user_id");
    expect(result.body).toMatchObject({ merge_candidate_id: null });
    expect(notifications(client)).toEqual([
      { id: answerId, webhook_id: 22, operation: 4, status: 3 },
    ]);
    const { answer } = await client.ok("getFormAnswerDetails", {
      path: { form_id: 703, answer_id: answerId },
    });
    expect(answer).toMatchObject({
      id: answerId,
      approval_status: 1,
      email_verification: false,
      complete_date: "2026-11-01T09:00:00+03:00",
      user: { id: userId, name: "Deniz Ergin", membership_no: 0 },
      transaction: {
        amount: 450,
        payment_status: 3,
        payment_method: 2,
        fonzip_framework: false,
        bank_account_id: 82,
        bank_account: { id: 82, name: "Burs Fonu Hesabı", currency_id: 1 },
      },
    });
    expect(
      answer?.transaction?.bin_number,
      "no card on a wire transfer",
    ).toBeUndefined();
    expect(answer?.form_answer_list?.[0]).toMatchObject({
      question: { title: "Telefon" },
      answer: "+905550001122",
    });
    const after = await client.ok("getFormList", { query: PAGE });
    const count = (list: typeof before) =>
      list.form_list?.find((form) => form.id === 703)?.response_count ?? 0;
    expect(count(after)).toBe(count(before) + 1);
    expect(
      after.form_list?.find((form) => form.id === 703)?.last_answer_date,
    ).toBe("2026-11-01T09:00:00+03:00");
    const mine = await client.ok("getUserAnswerList", {
      path: { user_id: userId },
      query: PAGE,
    });
    expect(mine.answer_list?.map((row) => row.id)).toEqual([answerId]);
  });

  test("links an existing email to its contact and waits for approval on an approval form", async () => {
    const client = createTestClient();
    const existing = kelder(client).users.get(1100);
    const result = await simulate(client, "form-answer", {
      form_id: 701,
      first_name: existing?.first_name,
      last_name: existing?.last_name,
      email: existing?.email.toUpperCase(),
    });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      user_id: 1100,
      merge_candidate_id: null,
    });
    const waiting = await client.ok("getFormAnswerList", {
      query: { ...RANGE, ...PAGE, status: "waiting_approval" },
    });
    expect(waiting.answer_list?.[0]?.id).toBe(idOf(result.body, "answer_id"));
  });

  test("queues a new contact whose phone matches an existing one, and the response merges them", async () => {
    const client = createTestClient();
    const db = kelder(client);
    const phone = db.users.get(1100)?.phone;
    const result = await simulate(client, "form-answer", {
      form_id: 701,
      first_name: "Yeni",
      last_name: "Kayıt",
      email: "yeni.kayit@eposta.example",
      phone,
    });
    const answerId = idOf(result.body, "answer_id");
    const newContact = idOf(result.body, "user_id");
    expect(
      db.mergeCandidates.get(idOf(result.body, "merge_candidate_id")),
    ).toMatchObject({
      first_user_id: 1100,
      second_user_id: newContact,
    });
    const response = await client.ok("respondFormAnswer", {
      path: { form_id: 701, answer_id: answerId },
      body: { response_type: "approve", answer: {} },
    });
    expect(response.merge).toEqual({
      status: "merged",
      user_id: 1100,
      merged_user_id: newContact,
    });
    const { answer } = await client.ok("getFormAnswerDetails", {
      path: { form_id: 701, answer_id: answerId },
    });
    expect(answer?.user?.id).toBe(1100);
    expect(answer?.approval_status).toBe(1);
  });

  test("records a failed card payment with its error and fires the FORM webhook with status 5", async () => {
    const client = createTestClient();
    const result = await simulate(client, "form-answer", {
      form_id: 703,
      first_name: "Hata",
      email: "hata@eposta.example",
      bin_number: "540667",
      payment_status: 5,
    });
    const answerId = idOf(result.body, "answer_id");
    expect(notifications(client)).toEqual([
      { id: answerId, webhook_id: 22, operation: 4, status: 5 },
    ]);
    const failed = await client.ok("getFormAnswerList", {
      query: { ...RANGE, ...PAGE, status: "failed" },
    });
    expect(failed.answer_list?.[0]).toMatchObject({
      id: answerId,
      transaction__transaction_error__code: expect.any(String),
    });
    const { answer } = await client.ok("getFormAnswerDetails", {
      path: { form_id: 703, answer_id: answerId },
    });
    expect(answer?.transaction).toMatchObject({
      payment_status: 5,
      bin_number: "540667",
    });
  });

  test("pages a contact's answers newest first", async () => {
    const client = createTestClient();
    const db = kelder(client);
    const email = db.users.get(1100)?.email;
    const seeded = db.formAnswers.count((answer) => answer.user_id === 1100);
    expect(seeded, "1100 answered the survey once").toBe(1);
    for (const formId of [702, 704, 702]) {
      await simulate(client, "form-answer", {
        form_id: formId,
        first_name: "Aynı",
        email,
      });
      await client.request("/__mock/clock/advance", {
        method: "POST",
        body: JSON.stringify({ seconds: 3600 }),
      });
    }
    const all = await client.ok("getUserAnswerList", {
      path: { user_id: 1100 },
      query: PAGE,
    });
    expect(all.total).toBe(4);
    expect(all.answer_list?.map((row) => row.custom_form_id)).toEqual([
      702, 704, 702, 704,
    ]);
    const second = await client.ok("getUserAnswerList", {
      path: { user_id: 1100 },
      query: { start_page: 2, how_many: 2 },
    });
    expect(second.answer_list?.map((row) => row.id)).toEqual(
      all.answer_list?.slice(2).map((row) => row.id),
    );
    expect(second.total).toBe(4);
  });

  test("refuses bad input (400), unknown objects (404), and closed forms (409)", async () => {
    const client = createTestClient();
    const person = { first_name: "Test", email: "test@eposta.example" };
    const cases: [Record<string, unknown>, number][] = [
      [{ ...person }, 400],
      [{ form_id: 702, email: "x@eposta.example" }, 400],
      [{ form_id: 703, ...person, payment_method: 2 }, 400],
      [{ form_id: 703, ...person, payment_method: 5 }, 400],
      [{ form_id: 703, ...person, payment_status: 4 }, 400],
      [{ form_id: 703, ...person, bin_number: "12" }, 400],
      [{ form_id: 799, ...person }, 404],
      [
        { form_id: 703, ...person, payment_method: 2, bank_account_id: 89 },
        404,
      ],
      [{ form_id: 705, ...person }, 409],
    ];
    for (const [input, status] of cases) {
      const result = await simulate(client, "form-answer", input);
      expect(result.status, JSON.stringify(input)).toBe(status);
    }
    kelder(client).forms.update(703, { application_limit: 8 });
    const full = await simulate(client, "form-answer", {
      form_id: 703,
      ...person,
    });
    expect(full.status, "the form's eight answers fill a limit of eight").toBe(
      409,
    );
    expect(notifications(client), "a refused answer fires nothing").toEqual([]);
  });
});

describe("an e-card sold on the public site", () => {
  test("creates the sale and its payment, and fires the CERTIFICATE_SALE webhook with status 3", async () => {
    const client = createTestClient();
    const buyer = kelder(client).users.get(1100);
    const result = await simulate(client, "ecard-sale", {
      ecard_id: 953,
      first_name: buyer?.first_name,
      last_name: buyer?.last_name,
      email: buyer?.email,
      phone: buyer?.phone,
      recipient_count: 2,
      bin_number: "650082",
      delivery_time_mode: 2,
      delivery_date: "2026-11-20",
      delivery_to_name: "Ayşe Kaya",
      custom_message: "İyi ki doğdun!",
      marketing_channel_id: 403,
    });
    expect(result.status).toBe(200);
    const saleId = idOf(result.body, "sale_id");
    expect(notifications(client)).toEqual([
      { id: saleId, webhook_id: 21, operation: 5, status: 3 },
      { id: saleId, webhook_id: 22, operation: 5, status: 3 },
    ]);
    const list = await client.ok("getEcardTransactionList", {
      query: {
        ...RANGE,
        ...PAGE,
        list: ["recipient_list", "amount", "card_number", "delivery_date"],
      },
    });
    const sale = list.sale_list?.[0];
    expect(sale).toMatchObject({
      id: saleId,
      user_id: 1100,
      certificate_id: 953,
      recipient_count: 2,
      zip_file: expect.stringMatching(/\.zip$/),
      cargo_status: 1,
      transaction__amount: 1000,
      transaction__bin_number: "650082",
      delivery_time_mode: 2,
      delivery_date: "2026-11-20",
    });
    expect(
      sale?.recipient_list?.map((recipient) => [
        recipient.name,
        recipient.delivery_date,
      ]),
    ).toEqual([
      ["Ayşe Kaya", "2026-11-20"],
      ["Alıcı 2", "2026-11-21"],
    ]);
    expect(
      await saleIds(client, { card_country: 3 }),
      "an unrecognised BIN",
    ).toEqual([saleId]);
    expect(await saleIds(client, { card_type: 4 })).toEqual([saleId]);
    expect(
      await saleIds(client, { delivery_date: "2026-11-21T08:00:00+03:00" }),
      "a recipient's own delivery date matches",
    ).toEqual([saleId]);
    const theirs = await client.ok("getUserEcardTransactionList", {
      path: { user_id: 1100 },
      query: PAGE,
    });
    expect(theirs.sale_list?.map((row) => row.id)).toContain(saleId);
    const { ecard_transaction: detail } = await client.ok(
      "getEcardTransactionDetails",
      {
        path: { sale_id: saleId },
      },
    );
    expect(detail).toMatchObject({
      delivery_to_name: "Ayşe Kaya",
      sent_mail__status: 0,
      certificate__has_cargo: true,
    });
  });

  test("records a failed payment as a failed sale with the CERTIFICATE_SALE webhook status 5", async () => {
    const client = createTestClient();
    const result = await simulate(client, "ecard-sale", {
      ecard_id: 951,
      first_name: "Kart",
      email: "kart@eposta.example",
      payment_status: 5,
    });
    const saleId = idOf(result.body, "sale_id");
    expect(notifications(client).map((note) => note.status)).toEqual([5, 5]);
    expect(await saleIds(client, { status: "failed" })).toContain(saleId);
    expect(await saleIds(client, {}), "not a paid sale").not.toContain(saleId);
  });

  test("takes a wire transfer and an anonymous buyer", async () => {
    const client = createTestClient();
    const result = await simulate(client, "ecard-sale", {
      ecard_id: 954,
      first_name: "Havale",
      email: "havale@eposta.example",
      payment_method: 2,
      bank_account_id: 81,
      delivery_time_mode: 1,
      delivery_date: "2026-12-01",
    });
    const saleId = idOf(result.body, "sale_id");
    const list = await client.ok("getEcardTransactionList", {
      query: {
        ...RANGE,
        ...PAGE,
        payment_method: 2,
        list: ["bank_account_id", "delivery_date"],
      },
    });
    expect(list.sale_list?.[0]).toMatchObject({
      id: saleId,
      transaction__bank_account_id: 81,
      delivery_date: "2026-12-01",
    });
    expect(
      list.sale_list?.[0]?.user_id,
      "an unknown email stays anonymous",
    ).toBeUndefined();
  });

  test("refuses bad input (400), unknown objects (404), and a card off sale (409)", async () => {
    const client = createTestClient();
    const person = { first_name: "Test", email: "test@eposta.example" };
    const cases: [Record<string, unknown>, number][] = [
      [{ ...person }, 400],
      [{ ecard_id: 951, email: "x@eposta.example" }, 400],
      [{ ecard_id: 951, ...person, amount: 50 }, 400],
      [{ ecard_id: 951, ...person, recipient_count: 0 }, 400],
      [{ ecard_id: 951, ...person, delivery_time_mode: 1 }, 400],
      [{ ecard_id: 951, ...person, delivery_time_mode: 3 }, 400],
      [{ ecard_id: 951, ...person, payment_method: 2 }, 400],
      [{ ecard_id: 951, ...person, payment_status: 4 }, 400],
      [{ ecard_id: 999, ...person }, 404],
      [{ ecard_id: 951, ...person, marketing_channel_id: 499 }, 404],
      [
        { ecard_id: 951, ...person, payment_method: 2, bank_account_id: 89 },
        404,
      ],
      [{ ecard_id: 956, ...person }, 409],
    ];
    for (const [input, status] of cases) {
      const result = await simulate(client, "ecard-sale", input);
      expect(result.status, JSON.stringify(input)).toBe(status);
    }
    expect(notifications(client)).toEqual([]);
  });
});

describe("an e-card refund", () => {
  test("refunds the payment, fires the CERTIFICATE_SALE webhook with status 4, and leads the refund list", async () => {
    const client = createTestClient();
    const result = await simulate(client, "ecard-refund", {
      sale_id: 95003,
      reason: "Alıcıya ulaşılamadı",
      refunded_by_id: 1002,
    });
    expect(result).toEqual({
      status: 200,
      body: { sale_id: 95003, transaction_id: expect.any(Number) },
    });
    expect(notifications(client)).toEqual([
      { id: 95003, webhook_id: 21, operation: 5, status: 4 },
      { id: 95003, webhook_id: 22, operation: 5, status: 4 },
    ]);
    const refunds = await client.ok("getEcardTransactionList", {
      query: { ...RANGE, ...PAGE, status: "refund" },
    });
    expect(
      refunds.sale_list?.map((sale) => sale.id),
      "the newest refund comes first, though its sale is older",
    ).toEqual([95003, 95028, 95008, 95018]);
    expect(refunds.sale_list?.[0]).toMatchObject({
      transaction__refund_date: "2026-11-01T09:00:00+03:00",
      transaction__refund_reason: "Alıcıya ulaşılamadı",
      transaction__refunded_by_id: 1002,
      transaction__refunded_by__name: expect.any(String),
    });
    const byComplete = await client.ok("getEcardTransactionList", {
      query: {
        ...RANGE,
        ...PAGE,
        status: "refund",
        order_by: "-transaction__complete_date",
      },
    });
    expect(byComplete.sale_list?.map((sale) => sale.id)).toEqual([
      95028, 95008, 95003, 95018,
    ]);
    expect(await saleIds(client, {}), "no longer a paid sale").not.toContain(
      95003,
    );
    const user = await client.ok("getUserEcardTransactionList", {
      path: { user_id: 1035 },
      query: PAGE,
    });
    expect(user.total).toBe(0);
  });

  test("refuses a sale with no successful payment (409), and unknown objects (404)", async () => {
    const client = createTestClient();
    expect(
      (await simulate(client, "ecard-refund", { sale_id: 95010 })).status,
    ).toBe(409);
    expect(
      (await simulate(client, "ecard-refund", { sale_id: 95008 })).status,
    ).toBe(409);
    expect((await simulate(client, "ecard-refund", {})).status).toBe(400);
    expect(
      (await simulate(client, "ecard-refund", { sale_id: 99_999 })).status,
    ).toBe(404);
    expect(
      (
        await simulate(client, "ecard-refund", {
          sale_id: 95003,
          refunded_by_id: 99_999,
        })
      ).status,
    ).toBe(404);
    expect(notifications(client)).toEqual([]);
  });
});
