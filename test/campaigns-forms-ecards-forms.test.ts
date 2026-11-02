import { describe, expect, test } from "bun:test";

import { isJsonObject, type Json } from "../src/spec/json";
import { specRuntime } from "../src/spec/runtime";
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
const SUMMER_FORM = 706;
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

function inSpec(...path: (string | number)[]): Json | undefined {
  let node: Json | undefined = specRuntime().spec;
  for (const key of path) {
    if (Array.isArray(node)) node = node[Number(key)];
    else node = isJsonObject(node) ? node[String(key)] : undefined;
  }
  return node;
}

describe("the corrected spec", () => {
  test("says what production sent about forms", () => {
    expect(
      inSpec("paths", "/form-answers", "get", "parameters", 5),
      "status is optional, with its default",
    ).toMatchObject({
      name: "status",
      required: false,
      schema: { default: "answer" },
    });
    expect(
      JSON.stringify(
        inSpec(
          "components",
          "schemas",
          "FormQuestion",
          "properties",
          "udv_question",
        ),
      ),
      "a question's custom field is its own schema, which may be null",
    ).not.toContain("UserDefinedValues");
    expect(
      inSpec("components", "schemas", "SentEmail", "properties", "message_id"),
    ).toMatchObject({ type: "string" });
    expect(
      inSpec(
        "components",
        "schemas",
        "FormAnswerDetails",
        "properties",
        "transaction",
      ),
      "the payment of an answer may be null",
    ).toMatchObject({
      anyOf: [{ $ref: "#/components/schemas/Transaction" }, { type: "null" }],
    });
    expect(
      inSpec(
        "components",
        "schemas",
        "FormQuestion",
        "properties",
        "static_question",
        "enum",
      ),
    ).toContain(0);
  });
});

describe("form list", () => {
  test("lists live forms in menu order with their answer counts", async () => {
    const client = createTestClient();
    const list = await client.ok("getFormList", { query: PAGE });
    expect(list.total).toBe(5);
    expect(list.form_list?.[0]).toEqual({
      id: SCHOLARSHIP_FORM,
      title: "Burs Başvuru Formu",
      url: "https://kelder.example/form/1",
      active: true,
      order: 1,
      listing: true,
      last_answer_date: "2026-06-18T06:00:00.000Z",
      application_limit: 200,
      waiting_approval: 5,
      response_count: 14,
      create_date: "2025-09-27T06:00:00.000Z",
      created_by_id: 1001,
      created_by__name: expect.any(String),
      update_date: null,
      updated_by_id: null,
      updated_by__name: null,
    });
    expect(list.form_list?.[1]).toMatchObject({
      id: VOLUNTEER_FORM,
      application_limit: null,
      update_date: "2025-12-16T06:00:00.000Z",
      updated_by_id: 1002,
      updated_by__name: expect.any(String),
    });
    expect(
      list.form_list?.find((form) => form.id === YEARBOOK_FORM)?.response_count,
      "the failed payment is not a response",
    ).toBe(8);
  });

  test("sends null, not a missing property, for what a form lacks", async () => {
    const client = createTestClient();
    const list = await client.ok("getFormList", { query: PAGE });
    const imported = list.form_list?.find((form) => form.id === YEARBOOK_FORM);
    expect(imported).toMatchObject({
      created_by_id: null,
      created_by__name: null,
      update_date: null,
      updated_by_id: null,
      updated_by__name: null,
    });
    const summer = list.form_list?.find((form) => form.id === SUMMER_FORM);
    expect(summer, "nobody has answered it").toMatchObject({
      last_answer_date: null,
      response_count: 0,
      waiting_approval: 0,
      created_by_id: null,
    });
    const survey = list.form_list?.find((form) => form.id === SURVEY_FORM);
    expect(survey?.last_answer_date).toEqual(expect.any(String));
    expect(survey?.updated_by_id).toBe(1002);
    for (const form of list.form_list ?? []) {
      expect(
        form,
        `live form ${form.id} has no archive properties`,
      ).not.toHaveProperty("archived_by_id");
    }
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
        archive_date: "2026-08-23T06:00:00.000Z",
      }),
    ]);
    expect(archived.total).toBe(1);
  });

  test("searches titles, excludes with a minus, and pages", async () => {
    const client = createTestClient();
    const found = await client.ok("getFormList", {
      query: { ...PAGE, query: "form" },
    });
    expect(found.form_list?.map((form) => form.id)).toEqual([701, 702, 706]);
    const excluded = await client.ok("getFormList", {
      query: { ...PAGE, query: "-form" },
    });
    expect(excluded.form_list?.map((form) => form.id)).toEqual([703, 704]);
    const page = await client.ok("getFormList", {
      query: { start_page: 2, how_many: 3 },
    });
    expect(page.form_list?.map((form) => form.id)).toEqual([704, 706]);
    expect(page.total).toBe(5);
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
      ).toEqual([701, 702, 703, 704, 706]);
    }
  });

  test("orders by every order_by value, breaking ties by title", async () => {
    const client = createTestClient();
    const order = async (order_by: string) =>
      (await client.ok("getFormList", { query: { ...PAGE, order_by } }))
        .form_list ?? [];
    expect((await order("order")).map((form) => form.id)).toEqual([
      701, 702, 703, 704, 706,
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
      "four forms tie at 0 and sort by title",
    ).toEqual([
      SURVEY_FORM,
      VOLUNTEER_FORM,
      YEARBOOK_FORM,
      SUMMER_FORM,
      SCHOLARSHIP_FORM,
    ]);
    expect((await order("-waiting_approval")).map((form) => form.id)).toEqual([
      SCHOLARSHIP_FORM,
      SURVEY_FORM,
      VOLUNTEER_FORM,
      YEARBOOK_FORM,
      SUMMER_FORM,
    ]);
    for (const order_by of ["last_answer_date", "-last_answer_date"]) {
      expect(
        (await order(order_by)).at(-1)?.id,
        `${order_by}: the form nobody answered comes last`,
      ).toBe(SUMMER_FORM);
    }
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
        complete_date: "2026-07-27T06:00:00.000Z",
        user_id: 1086,
        transaction_id: expect.any(Number),
        transaction__amount: 450,
        transaction__currency__display: "TRY",
        transaction__currency__iso_code: "TRY",
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

  test("sends null, not a missing property, for the payment of a free answer", async () => {
    const client = createTestClient();
    const list = await client.ok("getFormAnswerList", {
      query: { ...RANGE, ...PAGE, status: "answer" },
    });
    const rows = list.answer_list ?? [];
    const free = rows.find((row) => row.custom_form_id === SURVEY_FORM);
    expect(free).toMatchObject({
      transaction_id: null,
      transaction__amount: null,
      transaction__currency__display: null,
      transaction__currency__iso_code: null,
    });
    const paid = rows.find((row) => row.custom_form_id === YEARBOOK_FORM);
    expect(paid).toMatchObject({
      transaction_id: expect.any(Number),
      transaction__amount: 450,
      transaction__currency__display: "TRY",
      transaction__currency__iso_code: "TRY",
    });
    for (const row of rows) {
      expect(Object.keys(row), `answer ${row.id} names its payment`).toEqual(
        expect.arrayContaining([
          "transaction_id",
          "transaction__amount",
          "transaction__currency__display",
          "transaction__currency__iso_code",
        ]),
      );
    }
  });

  test("lists the answers of status=answer when status is left out", async () => {
    const client = createTestClient();
    const query = { ...RANGE, ...PAGE };
    const plain = await client.ok("getFormAnswerList", { query });
    const answered = await client.ok("getFormAnswerList", {
      query: { ...query, status: "answer" },
    });
    expect(plain).toEqual(answered);
    expect(plain.total).toBe(31);
    const waiting = await answerIds(client, "waiting_approval");
    for (const row of plain.answer_list ?? []) {
      expect(waiting, `answer ${row.id} is not waiting`).not.toContain(row.id);
    }
    const unknown = await client.call("getFormAnswerList", {
      query: { ...query, status: "pending" },
    });
    expect(unknown.status, "a status outside the enum is still refused").toBe(
      400,
    );
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
      complete_date: "2026-10-12T06:00:00.000Z",
      user: { id: 1077, name: expect.any(String), membership_no: 77 },
      email_verification: true,
      approval_status: 1,
      sent_mail: { id: 600_253, message_id: expect.any(String), status: 1 },
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
      id: 12,
      key: "meslek",
      slug: "meslek",
      key_type: 0,
      boolean_true_text: null,
      boolean_false_text: null,
      select_text: null,
      options: [],
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
      id: udv?.id,
      key: "sube",
      key_type: 7,
      select_text: expect.any(String),
      options: udv?.options,
    });
    expect(udv?.options.length).toBeGreaterThan(1);
    expect(udv?.options.map((option) => option.text)).toContain(branch?.answer);
  });

  test("the newest answered form answer has the shape production sent", async () => {
    const client = createTestClient();
    const list = await client.ok("getFormAnswerList", {
      query: { ...RANGE, ...PAGE },
    });
    const first = list.answer_list?.[0];
    expect(first?.id, "the answer the comparison reads").toBe(71037);
    const details = await answer(
      client,
      first?.custom_form_id ?? 0,
      first?.id ?? 0,
    );
    expect(details).toMatchObject({
      transaction: null,
      email_verification: null,
      city: expect.any(String),
      country: expect.any(String),
      ip_address: expect.stringMatching(/^\d{1,3}(\.\d{1,3}){3}$/),
      respond_date: "2026-10-24T06:00:00.000Z",
      responded_by: {
        id: expect.any(Number),
        name: expect.any(String),
        membership_no: expect.any(Number),
      },
      sent_mail: {
        id: expect.any(Number),
        message_id: expect.any(String),
        status: 1,
      },
      source: 0,
    });
    const questions = (details?.form_answer_list ?? []).map(
      (item) => item.question,
    );
    expect(questions.length).toBeGreaterThan(5);
    for (const question of questions) {
      expect(question, question?.title).toMatchObject({
        custom_question: null,
        another_question: null,
        dependent_question_option_ids: [],
        depends_on_another_question_answer: false,
        show_other_for_multiple: false,
        section_id: expect.any(Number),
        additional_info_for_question: expect.any(Boolean),
      });
      expect(
        question?.udv_question === null,
        `${question?.title}: only a static question has no custom field`,
      ).toBe(question?.question_type === 0);
      expect(
        question?.static_question === 0,
        `${question?.title}: only a custom field has static code 0`,
      ).toBe(question?.question_type !== 0);
    }
    expect(
      questions.filter((question) => question?.udv_question !== null).length,
      "most questions are custom fields",
    ).toBeGreaterThan(
      questions.filter((question) => question?.udv_question === null).length,
    );
    expect(
      questions.map((question) => question?.information === null),
      "some questions carry information, most do not",
    ).toEqual(expect.arrayContaining([true, false]));
  });

  test("a custom field question has production's properties and no others", async () => {
    const client = createTestClient();
    const details = await answer(client, SURVEY_FORM, 71037);
    const fields = new Map(
      (details?.form_answer_list ?? []).flatMap((item) => {
        const field = item.question?.udv_question;
        return field ? [[field.key ?? "", field] as const] : [];
      }),
    );
    expect([...fields.keys()]).toEqual([
      "meslek",
      "mezuniyet_yili",
      "sube",
      "burs_gonullusu",
      "ilgi_alanlari",
      "ozgecmis_notu",
    ]);
    for (const [key, field] of fields) {
      expect(Object.keys(field).sort(), key).toEqual([
        "boolean_false_text",
        "boolean_true_text",
        "file_constraints",
        "folder_id",
        "folder_name",
        "id",
        "key",
        "key_type",
        "oauth_credentials__application",
        "oauth_credentials__status",
        "oauth_credentials_id",
        "options",
        "select_text",
        "show_at_profile",
        "slug",
        "translations",
        "validation",
      ]);
      expect(field, key).toMatchObject({
        id: expect.any(Number),
        slug: key.replaceAll("_", "-"),
        show_at_profile: true,
        folder_id: null,
        folder_name: null,
        oauth_credentials__application: null,
        oauth_credentials__status: null,
        oauth_credentials_id: null,
        translations: { tr: { name: expect.any(String) } },
        file_constraints: {
          allowed_extensions: [
            "doc",
            "docx",
            "gif",
            "heic",
            "jpeg",
            "jpg",
            "pdf",
            "png",
            "xls",
            "xlsx",
          ],
          max_file_size_mb: 10,
        },
      });
    }
    expect(fields.get("meslek")).toMatchObject({
      select_text: null,
      boolean_true_text: null,
      options: [],
      validation: {},
    });
    expect(fields.get("sube")?.select_text, "a select asks to choose").toBe(
      "Seçiniz",
    );
    expect(
      fields.get("sube")?.options?.map((option) => option.id),
      "stored options keep their ids",
    ).toEqual([1, 2, 3, 4, 5]);
    expect(fields.get("burs_gonullusu")).toMatchObject({
      boolean_true_text: "Evet",
      boolean_false_text: "Hayır",
      options: [
        { id: null, order: 0, text: "Evet" },
        { id: null, order: 1, text: "Hayır" },
      ],
    });
    expect(fields.get("ozgecmis_notu")?.validation).toEqual({
      limit: true,
      limit_value: 1000,
    });
    expect(fields.get("mezuniyet_yili")?.validation).toEqual({
      max: true,
      max_value: 2100,
    });
  });

  test("an answer nobody has responded to has no response date or responder", async () => {
    const client = createTestClient();
    const waiting = await answer(client, SCHOLARSHIP_FORM, 71004);
    expect(waiting).toMatchObject({
      approval_status: 0,
      respond_date: null,
      responded_by: null,
      source: 0,
    });
    const anonymous = await answer(client, SCHOLARSHIP_FORM, 71007);
    expect(anonymous, "no contact, so no location").toMatchObject({
      city: null,
      country: null,
      ip_address: expect.any(String),
    });
    expect(anonymous?.user).toBeUndefined();
    const decided = await answer(client, SCHOLARSHIP_FORM, 71002);
    expect(decided?.respond_date).toEqual(expect.any(String));
    expect(decided?.responded_by).toEqual({
      id: expect.any(Number),
      name: expect.any(String),
      membership_no: expect.any(Number),
    });
    expect(
      Date.parse(decided?.respond_date ?? "") -
        Date.parse(decided?.complete_date ?? ""),
      "the response comes after the answer",
    ).toBeGreaterThan(0);
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
    expect(free?.transaction, "a free form has no payment").toBeNull();
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

describe("sent mail message ids", () => {
  test("every SentEmail object sends the message id as a string", async () => {
    const client = createTestClient();
    const db = kelder(client);
    const messageId = (id: number | null | undefined) =>
      String(db.sentEmails.get(id ?? 0)?.message_id);

    const donation = db.donations.find((row) => row.sent_mail_id !== null);
    const donationBody = await client.ok("getDonationDetails", {
      path: { donation_id: donation?.id ?? 0 },
    });
    expect(donationBody.donation?.sent_mail).toMatchObject({
      id: donation?.sent_mail_id,
      message_id: messageId(donation?.sent_mail_id),
      status: expect.any(Number),
    });

    const micro = db.microDonations.find(
      (row) => row.sent_mail_to_referring_id !== null,
    );
    const microBody = await client.ok("getMicroDonationDetails", {
      path: { donation_id: micro?.id ?? 0 },
    });
    expect(microBody.donation?.sent_mail_to_referring).toMatchObject({
      id: micro?.sent_mail_to_referring_id,
      message_id: messageId(micro?.sent_mail_to_referring_id),
      status: expect.any(Number),
    });

    const sale = db.ticketSales.find((row) => row.sent_mail_id !== null);
    const saleBody = await client.ok("getTicketSaleDetails", {
      path: { ticket_sale_id: sale?.id ?? 0 },
    });
    expect(saleBody.ticket_sale?.sent_mail).toMatchObject({
      id: sale?.sent_mail_id,
      message_id: messageId(sale?.sent_mail_id),
      status: expect.any(Number),
    });

    const details = await answer(client, YEARBOOK_FORM, 71025);
    expect(details?.sent_mail?.message_id).toBe(
      messageId(details?.sent_mail?.id),
    );
  });

  test("the flat sent_mail__message_id columns of a sale list stay integers", async () => {
    const client = createTestClient();
    const sales = await client.ok("getEcardTransactionList", {
      query: { ...RANGE, ...PAGE },
    });
    const ids = (sales.sale_list ?? []).flatMap((row) =>
      row.sent_mail__message_id === undefined
        ? []
        : [row.sent_mail__message_id],
    );
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(typeof id).toBe("number");
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
      message_id: expect.any(String),
      status: 0,
    });
    expect(details?.respond_date, "answered now").toBe(
      "2026-11-01T06:00:00.000Z",
    );
    expect(
      details?.responded_by,
      "an API key is not a contact, so nobody responded",
    ).toBeNull();
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
      refund_date: "2026-11-01T06:00:00.000Z",
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
    const gone = await client.ok("getUserAnswerList", {
      path: { user_id: 1040 },
      query: PAGE,
    });
    expect(gone, "the merged contact has no answers").toEqual({
      answer_list: [],
      total: 0,
    });
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
          complete_date: "2026-10-12T06:00:00.000Z",
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
    expect(free.answer_list?.[0]).toMatchObject({
      transaction_id: null,
      transaction__amount: null,
    });
    const none = await client.ok("getUserAnswerList", {
      path: { user_id: 1001 },
      query: PAGE,
    });
    expect(none).toEqual({ answer_list: [], total: 0 });
  });

  test("answers an empty list for an unknown contact, as production does", async () => {
    const client = createTestClient();
    for (const user_id of [99_999, 2_147_483_647]) {
      const response = await client.call("getUserAnswerList", {
        path: { user_id },
        query: PAGE,
      });
      expect(response.status, String(user_id)).toBe(200);
      expect(response.body).toEqual({ answer_list: [], total: 0 });
    }
  });
});
