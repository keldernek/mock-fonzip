import { describe, expect, test } from "bun:test";

import type { TestClient } from "../src/testing/client";
import { campaign, client, donation, kelder, person } from "./people-fixtures";

const PAGE = { start_page: 1, how_many: 100 };

const EMAIL_TEMPLATE = {
  category_id: 2,
  category__name: "ignored",
  title: "Aidat Teşekkür",
  subject: "Aidatınız için teşekkürler",
  message: "Sevgili {{name}}, aidat ödemeniz ulaştı.",
  has_association_logo: false,
  type_sms: false,
  background_color: "#fafafa",
  body_color: "#222222",
  footer_text_color: "#666666",
  footer_icon_color: 0,
  has_button: true,
  btn_text: "Ödemelerim",
  btn_color: "#004488",
  btn_text_color: "#ffffff",
  btn_operation: 1,
  btn_operation_detail: "https://kelder.example/profil/aidat",
  translations: {
    language_code: {
      subject: "Thank you for your dues",
      message: "Dear {{name}}, your payment arrived.",
      btn_text: "My payments",
    },
  },
} as const;

async function createTemplate(
  test: TestClient,
  body: Record<string, unknown>,
): Promise<number> {
  const created = await test.ok("createTemplate", { body });
  expect(created).toEqual({ result: "ok", template_id: expect.any(Number) });
  return created.template_id ?? 0;
}

async function titles(
  test: TestClient,
  query: Record<string, string | number>,
) {
  const body = await test.ok("listTemplates", { query: { ...PAGE, ...query } });
  return {
    total: body.total,
    titles: body.template_list?.map((row) => row.title),
  };
}

describe("listTemplates", () => {
  test("lists newest first by default with category names and a total", async () => {
    const shared = client();
    const body = await shared.ok("listTemplates", { query: PAGE });
    expect(body.total).toBe(6);
    expect(body.template_list?.map((row) => row.id)).toEqual([
      306, 305, 304, 303, 302, 301,
    ]);
    expect(body.template_list?.at(-1)).toEqual({
      id: 301,
      title: "Bağış Teşekkür",
      subject: "Bağışınız için teşekkür ederiz",
      message: "Sevgili {{name}}, {{amount}} tutarındaki bağışınız ulaştı.",
      category_id: 1,
      category__name: "Bağış",
      type_sms: false,
    });
    const second = await shared.ok("listTemplates", {
      query: { start_page: 2, how_many: 4 },
    });
    expect(second.template_list?.map((row) => row.id)).toEqual([302, 301]);
    expect(second.total).toBe(6);
  });

  test("filters by query, type and category, and orders by title and create date both ways", async () => {
    const shared = client();
    expect(await titles(shared, { query: "teşekkür" })).toEqual({
      total: 3,
      titles: ["Kampanya Teşekkür", "SMS Teşekkür", "Bağış Teşekkür"],
    });
    expect((await titles(shared, { query: "-teşekkür" })).total).toBe(3);
    expect(await titles(shared, { template_type: "s" })).toEqual({
      total: 1,
      titles: ["SMS Teşekkür"],
    });
    expect((await titles(shared, { template_type: "e" })).total).toBe(5);
    expect(await titles(shared, { category_id: 2 })).toEqual({
      total: 1,
      titles: ["Aidat Hatırlatma"],
    });
    const byTitle = (await titles(shared, { order_by: "title" })).titles;
    expect(byTitle).toEqual(
      [...(byTitle ?? [])].sort((a, b) =>
        (a ?? "").localeCompare(b ?? "", "tr"),
      ),
    );
    expect((await titles(shared, { order_by: "-title" })).titles).toEqual(
      [...(byTitle ?? [])].reverse(),
    );
    const oldest = await shared.ok("listTemplates", {
      query: { ...PAGE, order_by: "create_date" },
    });
    expect(oldest.template_list?.map((row) => row.id)).toEqual([
      301, 302, 303, 304, 305, 306,
    ]);
    const newest = await shared.ok("listTemplates", {
      query: { ...PAGE, order_by: "-create_date" },
    });
    expect(newest.template_list?.map((row) => row.id)).toEqual([
      306, 305, 304, 303, 302, 301,
    ]);
    const unknown = await shared.ok("listTemplates", {
      query: { ...PAGE, category_id: 9 },
    });
    expect(unknown, "an unknown category matches nothing").toEqual({
      total: 0,
      template_list: [],
    });
  });
});

describe("template lifecycle", () => {
  test("creates a template with every documented field, returns it, updates it and deletes it", async () => {
    const shared = client();
    const templateId = await createTemplate(shared, { ...EMAIL_TEMPLATE });
    const { category__name: _ignored, ...stored } = EMAIL_TEMPLATE;
    expect(
      await shared.ok("getTemplateDetails", {
        path: { template_id: templateId },
      }),
    ).toEqual({
      template: {
        id: templateId,
        ...stored,
        category__name: "Aidat",
      },
    });
    const listed = await shared.ok("listTemplates", {
      query: { ...PAGE, query: "Aidat Teşekkür" },
    });
    expect(listed.template_list?.map((row) => row.id)).toEqual([templateId]);
    await shared.ok("updateTemplate", {
      path: { template_id: templateId },
      body: {
        title: "Aidat Teşekkürü",
        has_button: true,
        btn_operation: 2,
        btn_operation_detail: "dues",
        category_id: 4,
      },
    });
    const partial = await shared.ok("getTemplateDetails", {
      path: { template_id: templateId },
    });
    expect(partial.template, "fields left out keep their values").toMatchObject(
      { background_color: "#fafafa", btn_text: "Ödemelerim" },
    );
    const updated = await shared.ok("getTemplateDetails", {
      path: { template_id: templateId },
    });
    expect(updated.template).toMatchObject({
      title: "Aidat Teşekkürü",
      subject: "Aidatınız için teşekkürler",
      btn_operation: 2,
      btn_operation_detail: "dues",
      category_id: 4,
      category__name: "Genel",
    });
    const replacement = {
      ...EMAIL_TEMPLATE,
      category_id: 3,
      category__name: "ignored too",
      title: "Etkinlik Teşekkür",
      subject: "Katıldığınız için teşekkürler",
      message: "Sevgili {{name}}, etkinliğimize katıldığınız için teşekkürler.",
      has_association_logo: true,
      type_sms: false,
      background_color: "#ffffff",
      body_color: "#101010",
      footer_text_color: "#777777",
      footer_icon_color: 1,
      has_button: true,
      btn_text: "Fotoğraflar",
      btn_color: "#aa0000",
      btn_text_color: "#000000",
      btn_operation: 1,
      btn_operation_detail: "https://kelder.example/galeri",
      translations: {
        language_code: {
          subject: "Thanks for coming",
          message: "Dear {{name}}, thanks for joining us.",
          btn_text: "Photos",
        },
      },
    } as const;
    await shared.ok("updateTemplate", {
      path: { template_id: templateId },
      body: replacement,
    });
    const { category__name: _replaced, ...replaced } = replacement;
    expect(
      await shared.ok("getTemplateDetails", {
        path: { template_id: templateId },
      }),
    ).toEqual({
      template: { id: templateId, ...replaced, category__name: "Etkinlik" },
    });
    await shared.ok("deleteTemplate", { path: { template_id: templateId } });
    const gone = await shared.call("getTemplateDetails", {
      path: { template_id: templateId },
    });
    expect(gone.status).toBe(404);
    expect(gone.body).toEqual({ error: "Template not found" });
    expect((await titles(shared, {})).total).toBe(6);
  });

  test("an SMS template needs no subject and defaults the rest", async () => {
    const shared = client();
    const templateId = await createTemplate(shared, {
      title: "SMS Hatırlatma",
      message: "KELDER: aidat hatırlatması.",
      type_sms: true,
    });
    const body = await shared.ok("getTemplateDetails", {
      path: { template_id: templateId },
    });
    expect(body.template).toMatchObject({
      type_sms: true,
      category_id: 4,
      footer_icon_color: 2,
      has_button: false,
      translations: {},
    });
    expect(body.template?.subject).toBeUndefined();
  });

  test("answers 400 for missing or invalid fields and 404 for an unknown category or template", async () => {
    const shared = client();
    const refuse = async (
      body: Record<string, unknown> | undefined,
      error: string,
    ) => {
      const response = await shared.call(
        "createTemplate",
        body === undefined ? {} : { body },
      );
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(response.body).toEqual({ error });
    };
    await refuse(undefined, "Invalid values: a template body is required");
    await refuse(
      { message: "x", subject: "y" },
      "Invalid values: title cannot be empty",
    );
    await refuse(
      { title: "x", subject: "y" },
      "Invalid values: message cannot be empty",
    );
    await refuse(
      { title: "x", message: "y" },
      "Invalid values: an email template needs a subject",
    );
    await refuse(
      { ...EMAIL_TEMPLATE, btn_color: "blue" },
      "Invalid values: btn_color is not a #RRGGBB color",
    );
    await refuse(
      { ...EMAIL_TEMPLATE, btn_text: "" },
      "Invalid values: a button needs btn_text",
    );
    await refuse(
      { ...EMAIL_TEMPLATE, btn_operation: 1, btn_operation_detail: "login" },
      "Invalid values: btn_operation 1 opens a URL in btn_operation_detail",
    );
    await refuse(
      {
        ...EMAIL_TEMPLATE,
        btn_operation: 2,
        btn_operation_detail: "https://kelder.example",
      },
      "Invalid values: btn_operation 2 takes one of login, cc, donation, dues, member_card",
    );
    const placeholder = await shared.call("createTemplate", {
      body: { ...EMAIL_TEMPLATE, btn_operation_detail: "not a url" },
    });
    expect(
      placeholder.status,
      "btn_operation_detail is a keyword or a URL",
    ).toBe(400);
    const category = await shared.call("createTemplate", {
      body: { ...EMAIL_TEMPLATE, category_id: 9 },
    });
    expect(category.status).toBe(404);
    expect(category.body).toEqual({ error: "Template category not found" });
    const update = await shared.call("updateTemplate", {
      path: { template_id: 301 },
      body: { message: " " },
    });
    expect(update.status).toBe(400);
    const noBody = await shared.call("updateTemplate", {
      path: { template_id: 301 },
    });
    expect(noBody.status).toBe(400);
    for (const operation of ["updateTemplate", "deleteTemplate"] as const) {
      const missing = await shared.call(operation, {
        path: { template_id: 99 },
        ...(operation === "updateTemplate" ? { body: { title: "x" } } : {}),
      });
      expect(missing.status, operation).toBe(404);
    }
  });
});

describe("deleting a template that is in use", () => {
  test("names an active fundraising campaign first", async () => {
    const shared = client();
    const response = await shared.call("deleteTemplate", {
      path: { template_id: 306 },
    });
    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: `This template is connected to a fundraising campaign: ${kelder(shared).fundraisingCampaigns.get(801)?.title}`,
    });
    const sms = await shared.call("deleteTemplate", {
      path: { template_id: 305 },
    });
    expect(sms.status, "campaign 801 sends it as its thanks SMS").toBe(409);
  });

  test("names an active campaign's referral thanks mail before the donations it thanked", async () => {
    const shared = client();
    const response = await shared.call("deleteTemplate", {
      path: { template_id: 301 },
    });
    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: `This template is connected to a fundraising campaign: ${kelder(shared).fundraisingCampaigns.get(803)?.title}`,
    });
  });

  test("names the donation page whose donations it thanked", async () => {
    const shared = client();
    const db = kelder(shared);
    const pageThanks = await createTemplate(shared, {
      title: "Sayfa Teşekkür",
      subject: "Teşekkürler",
      message: "Teşekkürler",
    });
    donation(
      db,
      person(db, "page-donor"),
      {},
      {
        fundraising_page_id: 32,
        module_id: 41,
        thanks_mail_id: pageThanks,
      },
    );
    const response = await shared.call("deleteTemplate", {
      path: { template_id: pageThanks },
    });
    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: "This template is connected to a donation page: Okulumuz İçin",
    });
  });

  test("names a donation form, then an e-card, for templates only they use", async () => {
    const shared = client();
    const db = kelder(shared);
    const formThanks = await createTemplate(shared, {
      title: "Form Teşekkür",
      subject: "Teşekkürler",
      message: "Teşekkürler",
    });
    donation(
      db,
      person(db, "form-donor"),
      {},
      {
        module_id: 42,
        thanks_mail_id: formThanks,
      },
    );
    const viaForm = await shared.call("deleteTemplate", {
      path: { template_id: formThanks },
    });
    expect(viaForm.status).toBe(409);
    expect(viaForm.body).toEqual({
      error:
        "This template is connected to a donation form: Mobil Uygulama Formu",
    });
    const ecardThanks = await createTemplate(shared, {
      title: "E-kart SMS",
      message: "Kartınız iletildi.",
      type_sms: true,
    });
    db.ecards.update(953, { referring_thanks_sms_id: ecardThanks });
    const viaEcard = await shared.call("deleteTemplate", {
      path: { template_id: ecardThanks },
    });
    expect(viaEcard.status).toBe(409);
    expect(viaEcard.body).toEqual({
      error: "This template is connected to an e-card: Anma Kartı",
    });
  });

  test("allows deleting a template only an inactive campaign references, and clears that reference", async () => {
    const shared = client();
    const db = kelder(shared);
    const templateId = await createTemplate(shared, {
      title: "Eski Kampanya",
      subject: "Teşekkürler",
      message: "Teşekkürler",
    });
    const finished = campaign(db, person(db, "eski-kampanya"), {
      status: 3,
      thanks_mail_id: templateId,
    });
    await shared.ok("deleteTemplate", { path: { template_id: templateId } });
    expect(db.fundraisingCampaigns.get(finished.id)?.thanks_mail_id).toBeNull();
    for (const unused of [302, 303, 304]) {
      expect(
        await shared.ok("deleteTemplate", { path: { template_id: unused } }),
        `seeded template ${unused} is unused`,
      ).toEqual({ result: "ok" });
    }
    expect((await titles(shared, {})).total).toBe(3);
  });
});
