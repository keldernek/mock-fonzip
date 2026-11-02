import { describe, expect, test } from "bun:test";

import { createTestClient, type TestClient } from "../src/testing/client";
import {
  dateOf,
  expectOrdered,
  kelder,
  notifications,
  PAGE,
} from "./campaigns-forms-ecards-support";

const SCHOLARSHIP_FORM = 701;
const VOLUNTEER_FORM = 702;
const YEARBOOK_FORM = 703;
const SURVEY_FORM = 704;
const ARCHIVED_FORM = 705;
const RANGE = {
  start_date: "2024-01-01T00:00:00+03:00",
  end_date: "2026-11-02T00:00:00+03:00",
};
type AnswerStatus =
  | "answer"
  | "waiting_approval"
  | "rejected"
  | "refund"
  | "failed";

async function answerIds(
  client: TestClient,
  status: AnswerStatus,
  extra: Record<string, string | number> = {},
): Promise<number[]> {
  const list = await client.ok("getFormAnswerList", {
    query: { ...RANGE, ...PAGE, status, ...extra },
  });
  return (list.answer_list ?? []).map((answer) => answer.id ?? 0);
}

async function answer(client: TestClient, formId: number, answerId: number) {
  const body = await client.ok("getFormAnswerDetails", {
    path: { form_id: formId, answer_id: answerId },
  });
  return body.answer;
}

describe("form list", () => {
  test("lists live forms in menu order with their answer counts", async () => {
    const client = createTestClient();
    const list = await client.ok("getFormList", { query: PAGE });
    expect(list.total).toBe(4);
    expect(list.form_list?.[0]).toEqual({
      id: SCHOLARSHIP_FORM,
      title: "Burs Başvuru Formu",
      url: "https://kelder.example/form/1",
      active: true,
      order: 1,
      listing: true,
      last_answer_date: "2026-06-18T09:00:00+03:00",
      application_limit: 200,
      waiting_approval: 5,
      response_count: 14,
      create_date: "2025-09-27T09:00:00+03:00",
      created_by_id: 1001,
      created_by__name: expect.any(String),
    });
    expect(list.form_list?.[1]).toMatchObject({
      id: VOLUNTEER_FORM,
      application_limit: null,
      update_date: "2025-12-16T09:00:00+03:00",
      updated_by_id: 1002,
      updated_by__name: expect.any(String),
    });
    expect(
      list.form_list?.find((form) => form.id === YEARBOOK_FORM)?.response_count,
      "the failed payment is not a response",
    ).toBe(8);
  });

  test("lists archived forms only when archived=true", async () => {
    const client = createTestClient();
    const archived = await client.ok("getFormList", {
      query: { ...PAGE, archived: "true" },
    });
    expect(archived.form_list).toEqual([
      expect.objectContaining({
        id: ARCHIVED_FORM,
        active: false,
        archived_by_id: 1001,
        archived_by__name: expect.any(String),
        archive_date: "2026-08-23T09:00:00+03:00",
      }),
    ]);
    expect(archived.total).toBe(1);
  });

  test("searches titles, excludes with a minus, and pages", async () => {
    const client = createTestClient();
    const found = await client.ok("getFormList", {
      query: { ...PAGE, query: "form" },
    });
    expect(found.form_list?.map((form) => form.id)).toEqual([701, 702]);
    const excluded = await client.ok("getFormList", {
      query: { ...PAGE, query: "-form" },
    });
    expect(excluded.form_list?.map((form) => form.id)).toEqual([703, 704]);
    const page = await client.ok("getFormList", {
      query: { start_page: 2, how_many: 3 },
    });
    expect(page.form_list?.map((form) => form.id)).toEqual([704]);
    expect(page.total).toBe(4);
  });

  test("an unknown order_by falls back to order", async () => {
    const client = createTestClient();
    for (const order_by of ["bogus", "-order", "-bogus"]) {
      const body = await client.ok("getFormList", {
        query: { ...PAGE, order_by },
      });
      expect(
        body.form_list?.map((form) => form.id),
        order_by,
      ).toEqual([701, 702, 703, 704]);
    }
  });

  test("orders by every order_by value, breaking ties by title", async () => {
    const client = createTestClient();
    const order = async (order_by: string) =>
      (await client.ok("getFormList", { query: { ...PAGE, order_by } }))
        .form_list ?? [];
    expect((await order("order")).map((form) => form.id)).toEqual([
      701, 702, 703, 704,
    ]);
    expectOrdered(await order("title"), (form) => form.title, false, "title");
    expectOrdered(await order("-title"), (form) => form.title, true, "-title");
    for (const field of ["response_count", "last_answer_date"] as const) {
      for (const descending of [false, true]) {
        const order_by = `${descending ? "-" : ""}${field}`;
        expectOrdered(
          await order(order_by),
          (form) =>
            field === "response_count"
              ? form.response_count
              : dateOf(form.last_answer_date ?? undefined),
          descending,
          order_by,
        );
      }
    }
    expect(
      (await order("waiting_approval")).map((form) => form.id),
      "three forms tie at 0 and sort by title",
    ).toEqual([SURVEY_FORM, VOLUNTEER_FORM, YEARBOOK_FORM, SCHOLARSHIP_FORM]);
    expect((await order("-waiting_approval")).map((form) => form.id)).toEqual([
      SCHOLARSHIP_FORM,
      SURVEY_FORM,
      VOLUNTEER_FORM,
      YEARBOOK_FORM,
    ]);
  });
});

describe("form answer list", () => {
  test("splits answers by status, newest first", async () => {
    const client = createTestClient();
    expect(await answerIds(client, "waiting_approval")).toEqual([
      71004, 71007, 71013, 71001, 71010,
    ]);
    expect(await answerIds(client, "rejected")).toEqual([
      71012, 71006, 71009, 71003,
    ]);
    expect(await answerIds(client, "refund")).toEqual([71028]);
    expect(await answerIds(client, "failed")).toEqual([71031]);
    const answered = await answerIds(client, "answer");
    expect(answered).toHaveLength(31);
    expect(answered.slice(0, 3)).toEqual([71037, 71033, 71025]);
  });

  test("returns the documented fields, and the payment error only for failed answers", async () => {
    const client = createTestClient();
    const refunds = await client.ok("getFormAnswerList", {
      query: { ...RANGE, ...PAGE, status: "refund" },
    });
    expect(refunds.answer_list).toEqual([
      {
        id: 71028,
        first_name: expect.any(String),
        last_name: expect.any(String),
        email: expect.stringContaining("@"),
        complete_date: "2026-07-27T09:00:00+03:00",
        user_id: 1086,
        transaction_id: expect.any(Number),
        transaction__amount: 450,
        custom_form_id: YEARBOOK_FORM,
        custom_form__title: "Mezuniyet Yıllığı Siparişi",
      },
    ]);
    const failed = await client.ok("getFormAnswerList", {
      query: { ...RANGE, ...PAGE, status: "failed" },
    });
    expect(failed.answer_list?.[0]).toMatchObject({
      id: 71031,
      transaction__transaction_error__code: "91",
      transaction__transaction_error__text: "Banka sistemine ulaşılamadı",
      transaction__transaction_error__group: 50,
    });
    expect(
      failed.answer_list?.[0]?.user_id,
      "an anonymous answer",
    ).toBeUndefined();
  });

  test("filters by the date range, searches, and pages", async () => {
    const client = createTestClient();
    expect(
      await answerIds(client, "rejected", {
        start_date: "2026-01-01T00:00:00+03:00",
        end_date: "2026-06-16T09:00:00+03:00",
      }),
      "the end of the range is inclusive",
    ).toEqual([71012, 71006]);
    const surname = kelder(client).formAnswers.get(71006)?.last_name ?? "";
    expect(await answerIds(client, "rejected", { query: surname })).toContain(
      71006,
    );
    expect(
      await answerIds(client, "answer", { query: "Yıllığı" }),
      "the form title is searched too",
    ).toEqual([71033, 71025, 71030, 71027, 71026, 71029, 71032]);
    expect(
      await answerIds(client, "answer", { query: "-Yıllığı" }),
    ).toHaveLength(24);
    const page = await client.ok("getFormAnswerList", {
      query: { ...RANGE, status: "rejected", start_page: 2, how_many: 3 },
    });
    expect(page.answer_list?.map((row) => row.id)).toEqual([71003]);
    expect(page.total).toBe(4);
  });

  test("refuses a start date that is not before the end date", async () => {
    const client = createTestClient();
    const response = await client.call("getFormAnswerList", {
      query: {
        ...PAGE,
        status: "answer",
        start_date: RANGE.end_date,
        end_date: RANGE.start_date,
      },
    });
    expect(response.status).toBe(400);
  });
});

describe("form answer details", () => {
  test("returns the payment, contact, sent mail and every answered question", async () => {
    const client = createTestClient();
    const details = await answer(client, YEARBOOK_FORM, 71025);
    expect(details).toMatchObject({
      id: 71025,
      complete_date: "2026-10-12T09:00:00+03:00",
      user: { id: 1077, name: expect.any(String), membership_no: 77 },
      email_verification: true,
      approval_status: 1,
      sent_mail: { id: 600_253, message_id: expect.any(Number), status: 1 },
      transaction: {
        amount: 450,
        payment_status: 3,
        payment_method: 0,
        currency: { id: 1, display: "TRY", iso_code: "TRY", value: 1 },
        payment_settings: { id: 71, provider_no: "iyzico" },
        bin_number: expect.stringMatching(/^\d{6}$/),
        last_four: expect.stringMatching(/^\d{4}$/),
        auth_code: expect.any(String),
        provision_no: expect.any(String),
      },
    });
    const questions = details?.form_answer_list?.map(
      (item) => item.question?.title,
    );
    expect(questions).toEqual([
      "Telefon",
      "Şehir",
      "Meslek",
      "Tercihiniz",
      "Eklemek istedikleriniz",
    ]);
    const profession = details?.form_answer_list?.[2];
    expect(profession?.question?.udv_question).toMatchObject({
      id: "C12",
      udv_id: 12,
      value: "meslek",
      key_type: 0,
      boolean_false_text: 0,
      select_text: 0,
    });
    const choice = details?.form_answer_list?.[3];
    expect(choice?.question?.custom_question).toEqual({
      id: choice?.question?.id,
      name: "Tercihiniz",
      short: "select",
    });
    expect(choice?.selected_option_list).toEqual([
      { id: 1, text: "Evet", order: 0 },
    ]);
    expect(choice?.answer).toBe("Evet");
  });

  test("gives a select field's question its options", async () => {
    const client = createTestClient();
    const details = await answer(client, ARCHIVED_FORM, 71041);
    const branch = details?.form_answer_list?.find(
      (item) => item.question?.title === "Şube",
    );
    const udv = kelder(client).userDefinedValues.find(
      (row) => row.value === "sube",
    );
    expect(branch?.question?.udv_question).toMatchObject({
      udv_id: udv?.id,
      key_type: 7,
      for: "select",
      options: udv?.options,
    });
    expect(udv?.options.length).toBeGreaterThan(1);
    expect(udv?.options.map((option) => option.text)).toContain(branch?.answer);
  });

  test("shows who refunded a refunded payment, and the error of a failed one", async () => {
    const client = createTestClient();
    const refunded = await answer(client, YEARBOOK_FORM, 71028);
    expect(refunded?.transaction).toMatchObject({
      payment_status: 4,
      payment_status_display: "İade Edildi",
      refund_date: expect.any(String),
      refunded_by_id: 1001,
      refunded_by__name: expect.any(String),
      refund_reason: expect.any(String),
    });
    const failed = await answer(client, YEARBOOK_FORM, 71031);
    expect(failed?.transaction).toMatchObject({
      payment_status: 5,
      error_code: "91",
      error_text: "Banka sistemine ulaşılamadı",
    });
    expect(
      failed?.transaction?.auth_code,
      "a failed card has no auth code, and production answers null",
    ).toBeNull();
    expect(failed?.user, "an anonymous answer has no contact").toBeUndefined();
    const free = await answer(client, VOLUNTEER_FORM, 71016);
    expect(free?.transaction, "a free form has no payment").toBeUndefined();
    expect(free?.sent_mail).toBeUndefined();
  });

  test("answers 404 for an answer of another form, or an unknown one", async () => {
    const client = createTestClient();
    const foreign = await client.call("getFormAnswerDetails", {
      path: { form_id: VOLUNTEER_FORM, answer_id: 71004 },
    });
    expect(foreign.status).toBe(404);
    const unknown = await client.call("getFormAnswerDetails", {
      path: { form_id: SCHOLARSHIP_FORM, answer_id: 79_999 },
    });
    expect(unknown.status).toBe(404);
  });
});

describe("responding to a form answer", () => {
  test("approving moves the answer out of waiting approval and assigns the next membership number", async () => {
    const client = createTestClient();
    const result = await client.ok("respondFormAnswer", {
      path: { form_id: SCHOLARSHIP_FORM, answer_id: 71013 },
      body: {
        response_type: "approve",
        answer: { send_mail: false, membership_no_decision: "auto" },
      },
    });
    expect(result).toEqual({ result: "ok", merge: { status: "none" } });
    const details = await answer(client, SCHOLARSHIP_FORM, 71013);
    expect(details?.approval_status).toBe(1);
    expect(details?.user).toMatchObject({ id: 1067, membership_no: 151 });
    expect(await answerIds(client, "waiting_approval")).not.toContain(71013);
    expect(await answerIds(client, "answer")).toContain(71013);
    const list = await client.ok("getFormList", { query: PAGE });
    expect(list.form_list?.[0]?.waiting_approval).toBe(4);
  });

  test("sets a custom membership number, and requires one for a custom decision", async () => {
    const client = createTestClient();
    const missing = await client.call("respondFormAnswer", {
      path: { form_id: SCHOLARSHIP_FORM, answer_id: 71010 },
      body: {
        response_type: "approve",
        answer: { membership_no_decision: "custom" },
      },
    });
    expect(missing.status).toBe(400);
    expect(
      (await answer(client, SCHOLARSHIP_FORM, 71010))?.approval_status,
    ).toBe(0);
    await client.ok("respondFormAnswer", {
      path: { form_id: SCHOLARSHIP_FORM, answer_id: 71010 },
      body: {
        response_type: "approve",
        answer: { membership_no_decision: "custom", membership_no: 9000 },
      },
    });
    expect(
      (await answer(client, SCHOLARSHIP_FORM, 71010))?.user?.membership_no,
    ).toBe(9000);
    await client.ok("respondFormAnswer", {
      path: { form_id: SCHOLARSHIP_FORM, answer_id: 71007 },
      body: {
        response_type: "approve",
        answer: { membership_no_decision: "no", membership_no: 1 },
      },
    });
    expect(
      (await answer(client, SCHOLARSHIP_FORM, 71007))?.approval_status,
      "an anonymous answer is approved without a contact",
    ).toBe(1);
  });

  test("rejecting with a mail records the sent mail, and rejecting leaves membership alone", async () => {
    const client = createTestClient();
    await client.ok("respondFormAnswer", {
      path: { form_id: SCHOLARSHIP_FORM, answer_id: 71013 },
      body: {
        response_type: "reject",
        answer: {
          send_mail: true,
          subject: "Başvurunuz hakkında",
          message: "<p><img src='https://kelder.example/logo.png'></p>",
          membership_no_decision: "auto",
        },
      },
    });
    const details = await answer(client, SCHOLARSHIP_FORM, 71013);
    expect(details?.approval_status).toBe(2);
    expect(details?.sent_mail).toEqual({
      id: expect.any(Number),
      message_id: expect.any(Number),
      status: 0,
    });
    expect(details?.user?.membership_no, "rejection assigns nothing").toBe(67);
    expect(await answerIds(client, "rejected")).toContain(71013);
  });

  test("refuses a mail without a subject or visible message, changing nothing", async () => {
    const client = createTestClient();
    const cases = [
      { send_mail: true, message: "<p>Merhaba</p>" },
      { send_mail: true, subject: "Konu", message: "<p>&nbsp;</p>" },
      { send_mail: true, send_from_template: true, template_id: 301 },
    ];
    for (const details of cases) {
      const response = await client.call("respondFormAnswer", {
        path: { form_id: YEARBOOK_FORM, answer_id: 71025 },
        body: {
          response_type: "reject",
          answer: { ...details, make_refund: true },
        },
      });
      expect(response.status, JSON.stringify(details)).toBe(400);
    }
    const untouched = await answer(client, YEARBOOK_FORM, 71025);
    expect(untouched?.approval_status).toBe(1);
    expect(untouched?.transaction?.payment_status, "not refunded").toBe(3);
    expect(notifications(client)).toEqual([]);
  });

  test("refunds the payment with make_refund and fires the FORM webhook with status 4", async () => {
    const client = createTestClient();
    await client.ok("respondFormAnswer", {
      path: { form_id: YEARBOOK_FORM, answer_id: 71025 },
      body: { response_type: "reject", answer: { make_refund: true } },
    });
    const details = await answer(client, YEARBOOK_FORM, 71025);
    expect(details?.transaction).toMatchObject({
      payment_status: 4,
      refund_date: "2026-11-01T09:00:00+03:00",
      refund_reason: expect.any(String),
    });
    expect(
      details?.transaction?.refunded_by_id,
      "refunded through the API, and production answers null",
    ).toBeNull();
    expect(await answerIds(client, "refund")).toEqual([71025, 71028]);
    expect(notifications(client)).toEqual([
      { id: 71025, webhook_id: 22, operation: 4, status: 4 },
    ]);
    await client.ok("respondFormAnswer", {
      path: { form_id: YEARBOOK_FORM, answer_id: 71025 },
      body: { response_type: "reject", answer: { make_refund: true } },
    });
    expect(notifications(client), "a second refund does nothing").toHaveLength(
      1,
    );
  });

  test("saves the mail as a template with every design field, or overwrites a saved one", async () => {
    const client = createTestClient();
    const before = kelder(client).templates.count();
    await client.ok("respondFormAnswer", {
      path: { form_id: SCHOLARSHIP_FORM, answer_id: 71013 },
      body: {
        response_type: "approve",
        answer: {
          send_mail: true,
          membership_no_decision: "no",
          send_from_template: false,
          has_association_logo: false,
          title: "Burs Onayı",
          subject: "Burs başvurunuz onaylandı",
          message: "<p>Tebrikler!</p>",
          update_template: false,
          save_as_template: true,
          has_button: true,
          background_color: "#000000",
          body_color: "#111111",
          footer_text_color: "#222222",
          footer_icon_color: 2,
          btn_text: "Giriş",
          btn_color: "#333333",
          btn_text_color: "#444444",
          btn_operation: 1,
          btn_operation_detail: "https://kelder.example/burs",
          make_refund: false,
        },
      },
    });
    const templates = kelder(client).templates;
    expect(templates.count()).toBe(before + 1);
    expect(templates.list().at(-1)).toEqual({
      id: expect.any(Number),
      title: "Burs Onayı",
      subject: "Burs başvurunuz onaylandı",
      message: "<p>Tebrikler!</p>",
      has_association_logo: false,
      type_sms: false,
      background_color: "#000000",
      body_color: "#111111",
      footer_text_color: "#222222",
      footer_icon_color: 2,
      has_button: true,
      btn_text: "Giriş",
      btn_color: "#333333",
      btn_text_color: "#444444",
      btn_operation: 1,
      btn_operation_detail: "https://kelder.example/burs",
      category_id: 4,
      translations: {},
    });
    await client.ok("respondFormAnswer", {
      path: { form_id: SCHOLARSHIP_FORM, answer_id: 71010 },
      body: {
        response_type: "approve",
        answer: {
          send_mail: true,
          send_from_template: true,
          template_id: 301,
          update_template: true,
          subject: "Yeni konu",
          message: "<p>Yeni metin</p>",
        },
      },
    });
    expect(templates.get(301)).toMatchObject({
      title: "Bağış Teşekkür",
      subject: "Yeni konu",
      message: "<p>Yeni metin</p>",
    });
  });

  test("refuses a broken template request with 400, and an unknown template with 404", async () => {
    const client = createTestClient();
    const respond = (details: Record<string, unknown>) =>
      client.call("respondFormAnswer", {
        path: { form_id: SCHOLARSHIP_FORM, answer_id: 71013 },
        body: { response_type: "approve", answer: details },
      });
    const content = { subject: "Konu", message: "<p>Metin</p>" };
    expect(
      (await respond({ send_from_template: true, ...content })).status,
    ).toBe(400);
    expect(
      (await respond({ update_template: true, template_id: 301 })).status,
    ).toBe(400);
    expect((await respond({ save_as_template: true, ...content })).status).toBe(
      400,
    );
    expect(
      (
        await respond({
          save_as_template: true,
          title: "T",
          footer_icon_color: 7,
          ...content,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await respond({
          send_from_template: true,
          template_id: 399,
          ...content,
        })
      ).status,
    ).toBe(404);
    expect(
      (await answer(client, SCHOLARSHIP_FORM, 71013))?.approval_status,
    ).toBe(0);
  });

  test("merges the answer's contact into its pending duplicate", async () => {
    const client = createTestClient();
    const db = kelder(client);
    const retiredTotal = db.users.get(1040)?.total_financial ?? 0;
    const survivorTotal = db.users.get(1070)?.total_financial ?? 0;
    const retiredDonations = db.donations.count((row) => row.user_id === 1040);
    const result = await client.ok("respondFormAnswer", {
      path: { form_id: SCHOLARSHIP_FORM, answer_id: 71004 },
      body: { response_type: "approve", answer: {} },
    });
    expect(result).toEqual({
      result: "ok",
      merge: { status: "merged", user_id: 1070, merged_user_id: 1040 },
    });
    const details = await answer(client, SCHOLARSHIP_FORM, 71004);
    expect(details?.user?.id, "the answer now points at the survivor").toBe(
      1070,
    );
    expect(db.users.get(1040), "the merged contact is gone").toBeUndefined();
    expect(db.users.get(1070)?.total_financial).toBeCloseTo(
      survivorTotal + retiredTotal,
      2,
    );
    expect(db.donations.count((row) => row.user_id === 1040)).toBe(0);
    expect(
      db.donations.count((row) => row.user_id === 1070),
    ).toBeGreaterThanOrEqual(retiredDonations);
    const survivorAnswers = await client.ok("getUserAnswerList", {
      path: { user_id: 1070 },
      query: PAGE,
    });
    expect(survivorAnswers.answer_list?.map((row) => row.id)).toContain(71004);
    const gone = await client.call("getUserAnswerList", {
      path: { user_id: 1040 },
      query: PAGE,
    });
    expect(gone.status).toBe(404);
    const again = await client.ok("respondFormAnswer", {
      path: { form_id: SCHOLARSHIP_FORM, answer_id: 71004 },
      body: { response_type: "approve", answer: {} },
    });
    expect(again.merge, "the pair is settled").toEqual({ status: "none" });
  });

  test("skips a pair with an admin profile, every time", async () => {
    const client = createTestClient();
    for (const response_type of ["reject", "approve"] as const) {
      const result = await client.ok("respondFormAnswer", {
        path: { form_id: SCHOLARSHIP_FORM, answer_id: 71001 },
        body: { response_type, answer: {} },
      });
      expect(result.merge, response_type).toEqual({
        status: "skipped",
        reason: "not_mergeable",
        message: expect.any(String),
        first_user_id: 1003,
        second_user_id: 1031,
      });
    }
    expect(
      (await answer(client, SCHOLARSHIP_FORM, 71001))?.approval_status,
    ).toBe(1);
    expect(kelder(client).users.get(1031), "nobody was merged").toBeDefined();
  });

  test("reports a failed merge when a contact of the pair no longer exists, and keeps the pair", async () => {
    const client = createTestClient();
    const db = kelder(client);
    db.users.remove(1070);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await client.ok("respondFormAnswer", {
        path: { form_id: SCHOLARSHIP_FORM, answer_id: 71004 },
        body: { response_type: "approve", answer: {} },
      });
      expect(result.merge).toEqual({
        status: "failed",
        reason: "error",
        message: expect.any(String),
        first_user_id: 1070,
        second_user_id: 1040,
      });
    }
    expect(db.users.get(1040), "the answer's contact stays").toBeDefined();
  });

  test("answers 404 for an answer of another form, leaving it unchanged", async () => {
    const client = createTestClient();
    const foreign = await client.call("respondFormAnswer", {
      path: { form_id: VOLUNTEER_FORM, answer_id: 71013 },
      body: { response_type: "approve", answer: {} },
    });
    expect(foreign.status).toBe(404);
    expect(
      (await answer(client, SCHOLARSHIP_FORM, 71013))?.approval_status,
    ).toBe(0);
    const unknown = await client.call("respondFormAnswer", {
      path: { form_id: SCHOLARSHIP_FORM, answer_id: 79_999 },
      body: { response_type: "approve", answer: {} },
    });
    expect(unknown.status).toBe(404);
  });
});

describe("a contact's form answers", () => {
  test("lists the contact's answers with the payment amount", async () => {
    const client = createTestClient();
    const list = await client.ok("getUserAnswerList", {
      path: { user_id: 1077 },
      query: PAGE,
    });
    expect(list).toEqual({
      answer_list: [
        {
          id: 71025,
          complete_date: "2026-10-12T09:00:00+03:00",
          transaction_id: expect.any(Number),
          transaction__amount: 450,
          custom_form_id: YEARBOOK_FORM,
          custom_form__title: "Mezuniyet Yıllığı Siparişi",
        },
      ],
      total: 1,
    });
    const free = await client.ok("getUserAnswerList", {
      path: { user_id: 1054 },
      query: PAGE,
    });
    expect(free.answer_list?.map((row) => row.id)).toEqual([71015]);
    expect(free.answer_list?.[0]?.transaction_id).toBeUndefined();
    const none = await client.ok("getUserAnswerList", {
      path: { user_id: 1001 },
      query: PAGE,
    });
    expect(none).toEqual({ answer_list: [], total: 0 });
  });

  test("answers 404 for an unknown contact", async () => {
    const client = createTestClient();
    const response = await client.call("getUserAnswerList", {
      path: { user_id: 99_999 },
      query: PAGE,
    });
    expect(response.status).toBe(404);
  });
});
