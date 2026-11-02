import { describe, expect, test } from "bun:test";

import { apiDateTime } from "../src/seed/dates";
import { fullName } from "../src/store/joins";
import type { TestClient } from "../src/testing/client";
import { campaign, client, donation, kelder, person } from "./people-fixtures";

const PAGE = { start_page: 1, how_many: 100 };
const UTC_MILLIS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

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

// What production sent on every template it has.
const ALWAYS_NULL = {
  badge_icon: null,
  design: null,
  heading: null,
  preheader: null,
  references: {},
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

async function detail(test: TestClient, templateId: number) {
  const body = await test.ok("getTemplateDetails", {
    path: { template_id: templateId },
  });
  if (body.template === undefined) throw new Error("no template in the body");
  return body.template;
}

async function row(test: TestClient, templateId: number) {
  const body = await test.ok("listTemplates", { query: PAGE });
  const found = body.template_list?.find((item) => item.id === templateId);
  if (found === undefined) throw new Error(`template ${templateId} not listed`);
  return found;
}

// The user a seeded template names, read from the store rather than the API.
function seededUser(
  test: TestClient,
  templateId: number,
  field: "created_by_id" | "updated_by_id",
): { readonly id: number; readonly name: string } {
  const id = kelder(test).templates.get(templateId)?.[field];
  const user = typeof id === "number" ? kelder(test).users.get(id) : undefined;
  if (id === undefined || id === null || user === undefined) {
    throw new Error(`template ${templateId} has no ${field}`);
  }
  return { id, name: fullName(user) };
}

describe("listTemplates", () => {
  test("lists newest first by default with category names, audit fields and a total", async () => {
    const shared = client();
    const body = await shared.ok("listTemplates", { query: PAGE });
    expect(body.result).toBe("ok");
    expect(body.total).toBe(7);
    expect(body.template_list?.map((item) => item.id)).toEqual([
      307, 306, 305, 304, 303, 302, 301,
    ]);
    const creator = seededUser(shared, 301, "created_by_id");
    const updater = seededUser(shared, 301, "updated_by_id");
    expect(body.template_list?.at(-1)).toEqual({
      id: 301,
      title: "Bağış Teşekkür",
      subject: "Bağışınız için teşekkür ederiz",
      message: "Sevgili {{name}}, {{amount}} tutarındaki bağışınız ulaştı.",
      category_id: 1,
      category__name: "Bağış",
      type_sms: false,
      create_date: "2025-09-27T06:00:00.000Z",
      update_date: "2026-08-03T06:00:00.000Z",
      created_by_id: creator.id,
      created_by__name: creator.name,
      updated_by_id: updater.id,
      updated_by__name: updater.name,
    });
    const second = await shared.ok("listTemplates", {
      query: { start_page: 2, how_many: 4 },
    });
    expect(second.template_list?.map((item) => item.id)).toEqual([
      303, 302, 301,
    ]);
    expect(second.total).toBe(7);
    expect(second.result).toBe("ok");
  });

  test("the first row is an SMS with no subject, category or author, like production's", async () => {
    const shared = client();
    const body = await shared.ok("listTemplates", { query: PAGE });
    expect(body.template_list?.[0]).toEqual({
      id: 307,
      title: "SMS Hatırlatma",
      subject: null,
      message: "KELDER: {{period}} dönemi aidatınız için hatırlatma.",
      category_id: null,
      category__name: null,
      type_sms: true,
      create_date: "2026-10-27T06:00:00.000Z",
      update_date: null,
      created_by_id: null,
      created_by__name: null,
      updated_by_id: null,
      updated_by__name: null,
    });
    expect(await detail(shared, 307)).toEqual({
      id: 307,
      title: "SMS Hatırlatma",
      subject: null,
      message: "KELDER: {{period}} dönemi aidatınız için hatırlatma.",
      has_association_logo: false,
      type_sms: true,
      background_color: "#f4f1ea",
      body_color: "#ffffff",
      footer_text_color: "#5b5b5b",
      footer_icon_color: 1,
      has_button: false,
      btn_text: null,
      btn_color: "#8b1d2c",
      btn_text_color: "#ffffff",
      btn_operation: 2,
      btn_operation_detail: null,
      category_id: null,
      translations: {
        tr: {
          subject: null,
          message: "KELDER: {{period}} dönemi aidatınız için hatırlatma.",
          btn_text: null,
        },
      },
      ...ALWAYS_NULL,
    });
  });

  test("mixes null and non-null on one page, like production's sparse rows", async () => {
    const shared = client();
    const rows = (await shared.ok("listTemplates", { query: PAGE }))
      .template_list;
    expect(rows).toHaveLength(7);
    const nulls = (pick: (item: NonNullable<typeof rows>[number]) => unknown) =>
      new Set((rows ?? []).map((item) => pick(item) === null));
    const both = new Set([true, false]);
    expect(
      nulls((item) => item.category_id),
      "category_id",
    ).toEqual(both);
    expect(
      nulls((item) => item.category__name),
      "category__name",
    ).toEqual(both);
    expect(
      nulls((item) => item.subject),
      "subject",
    ).toEqual(both);
    expect(
      nulls((item) => item.created_by_id),
      "created_by_id",
    ).toEqual(both);
    expect(
      nulls((item) => item.created_by__name),
      "created_by__name",
    ).toEqual(both);
    expect(
      nulls((item) => item.updated_by_id),
      "updated_by_id",
    ).toEqual(both);
    expect(
      nulls((item) => item.updated_by__name),
      "updated_by__name",
    ).toEqual(both);
    expect(
      nulls((item) => item.update_date),
      "update_date",
    ).toEqual(both);
    for (const item of rows ?? []) {
      expect(item.create_date, `template ${item.id}`).toMatch(UTC_MILLIS);
      expect(item.created_by__name === null, `creator of ${item.id}`).toBe(
        item.created_by_id === null,
      );
      expect(item.updated_by__name === null, `updater of ${item.id}`).toBe(
        item.updated_by_id === null,
      );
      expect(item.category__name === null, `category of ${item.id}`).toBe(
        item.category_id === null,
      );
      expect(item.subject === null, `subject of ${item.id}`).toBe(
        item.type_sms === true,
      );
    }
    const dates = [...(rows ?? [])]
      .sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
      .map((item) => item.create_date ?? "");
    expect(dates, "newer templates are created later").toEqual(
      [...dates].sort((a, b) => a.localeCompare(b)),
    );
  });

  test("filters by query, type and category, and orders by title and create date both ways", async () => {
    const shared = client();
    expect(await titles(shared, { query: "teşekkür" })).toEqual({
      total: 3,
      titles: ["Kampanya Teşekkür", "SMS Teşekkür", "Bağış Teşekkür"],
    });
    expect((await titles(shared, { query: "-teşekkür" })).total).toBe(4);
    expect(await titles(shared, { template_type: "s" })).toEqual({
      total: 2,
      titles: ["SMS Hatırlatma", "SMS Teşekkür"],
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
    expect(oldest.template_list?.map((item) => item.id)).toEqual([
      301, 302, 303, 304, 305, 306, 307,
    ]);
    const newest = await shared.ok("listTemplates", {
      query: { ...PAGE, order_by: "-create_date" },
    });
    expect(newest.template_list?.map((item) => item.id)).toEqual([
      307, 306, 305, 304, 303, 302, 301,
    ]);
    const unknown = await shared.ok("listTemplates", {
      query: { ...PAGE, category_id: 9 },
    });
    expect(unknown, "an unknown category matches nothing").toEqual({
      result: "ok",
      total: 0,
      template_list: [],
    });
  });
});

describe("getTemplateDetails", () => {
  test("sends the fields production sends as null, and no category name", async () => {
    const shared = client();
    for (const templateId of [301, 303, 305, 307]) {
      const template = await detail(shared, templateId);
      expect(template, `template ${templateId}`).toMatchObject(ALWAYS_NULL);
      expect(
        "category__name" in template,
        `template ${templateId} has no category__name`,
      ).toBe(false);
    }
    const email = await detail(shared, 303);
    expect(email, "no button, so no button text or action").toMatchObject({
      has_button: false,
      btn_text: null,
      btn_operation_detail: null,
      btn_operation: 2,
      category_id: 3,
    });
    expect(await detail(shared, 301)).toMatchObject({
      has_button: true,
      btn_text: "Bağış Geçmişim",
      btn_operation_detail: "donation",
    });
    const sms = await detail(shared, 305);
    expect(sms).toMatchObject({ subject: null, category_id: 1 });
    expect(sms.type_sms).toBe(true);
  });

  test("translations map a language code to texts, with null where a language has none", async () => {
    const shared = client();
    expect((await detail(shared, 301)).translations).toEqual({
      en: {
        subject: "Thank you for your donation",
        message: "Dear {{name}}, your donation of {{amount}} has arrived.",
        btn_text: "My donations",
      },
      de: {
        subject: "Vielen Dank für Ihre Spende",
        message:
          "Liebe/r {{name}}, Ihre Spende über {{amount}} ist angekommen.",
        btn_text: "Meine Spenden",
      },
      fr: {
        subject: "Merci pour votre don",
        message: "Cher/Chère {{name}}, votre don de {{amount}} est arrivé.",
        btn_text: "Mes dons",
      },
    });
    const languages = new Set<string>();
    for (const templateId of [301, 302, 303, 304, 305, 306, 307]) {
      for (const language of Object.keys(
        (await detail(shared, templateId)).translations ?? {},
      )) {
        languages.add(language);
      }
    }
    expect([...languages].sort()).toEqual([
      "de",
      "en",
      "es",
      "fr",
      "it",
      "nl",
      "pt",
      "ru",
      "tr",
    ]);
    expect((await detail(shared, 305)).translations).toEqual({
      en: {
        subject: null,
        message: "KELDER: Thank you for your donation.",
        btn_text: null,
      },
    });
  });
});

describe("template lifecycle", () => {
  test("creates a template with every documented field, returns it, updates it and deletes it", async () => {
    const shared = client();
    const templateId = await createTemplate(shared, { ...EMAIL_TEMPLATE });
    const { category__name: _ignored, ...stored } = EMAIL_TEMPLATE;
    expect(await detail(shared, templateId)).toEqual({
      id: templateId,
      ...stored,
      ...ALWAYS_NULL,
    });
    expect((await row(shared, templateId)).category__name).toBe("Aidat");
    const listed = await shared.ok("listTemplates", {
      query: { ...PAGE, query: "Aidat Teşekkür" },
    });
    expect(listed.template_list?.map((item) => item.id)).toEqual([templateId]);
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
    expect(
      await detail(shared, templateId),
      "fields left out keep their values",
    ).toMatchObject({ background_color: "#fafafa", btn_text: "Ödemelerim" });
    expect(await detail(shared, templateId)).toMatchObject({
      title: "Aidat Teşekkürü",
      subject: "Aidatınız için teşekkürler",
      btn_operation: 2,
      btn_operation_detail: "dues",
      category_id: 4,
    });
    expect((await row(shared, templateId)).category__name).toBe("Genel");
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
    expect(await detail(shared, templateId)).toEqual({
      id: templateId,
      ...replaced,
      ...ALWAYS_NULL,
    });
    expect((await row(shared, templateId)).category__name).toBe("Etkinlik");
    await shared.ok("deleteTemplate", { path: { template_id: templateId } });
    const gone = await shared.call("getTemplateDetails", {
      path: { template_id: templateId },
    });
    expect(gone.status).toBe(404);
    expect(gone.body).toEqual({ error: "Şablon bulunamadı." });
    expect((await titles(shared, {})).total).toBe(7);
  });

  test("an SMS template needs no subject and defaults the rest", async () => {
    const shared = client();
    const templateId = await createTemplate(shared, {
      title: "SMS Hatırlatma",
      message: "KELDER: aidat hatırlatması.",
      type_sms: true,
    });
    expect(await detail(shared, templateId)).toMatchObject({
      type_sms: true,
      subject: null,
      btn_text: null,
      btn_operation_detail: null,
      category_id: 4,
      footer_icon_color: 2,
      has_button: false,
      translations: {},
    });
    expect((await row(shared, templateId)).subject).toBeNull();
  });

  test("keeps any language code a request sends, and answers it as a map", async () => {
    const shared = client();
    const templateId = await createTemplate(shared, {
      ...EMAIL_TEMPLATE,
      translations: Object.fromEntries([
        ["de", { subject: "Danke", message: "Hallo", btn_text: "Weiter" }],
        ["tr", { subject: "Teşekkürler" }],
        ["__proto__", { message: "hidden" }],
      ]),
    });
    const { translations } = await detail(shared, templateId);
    expect(Object.keys(translations ?? {})).toEqual(["de", "tr", "__proto__"]);
    expect(translations?.de).toEqual({
      subject: "Danke",
      message: "Hallo",
      btn_text: "Weiter",
    });
    expect(translations?.tr).toEqual({ subject: "Teşekkürler" });
    expect(Object.getPrototypeOf(translations)).toBe(Object.prototype);
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
    const noAction = { ...EMAIL_TEMPLATE, btn_operation_detail: undefined };
    await refuse(
      { ...noAction, btn_operation: 1 },
      "Invalid values: btn_operation 1 opens a URL in btn_operation_detail",
    );
    await refuse(
      { ...noAction, btn_operation: 2 },
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

  test("updating a template without a category keeps it uncategorized", async () => {
    const shared = client();
    const update = await shared.call("updateTemplate", {
      path: { template_id: 307 },
      body: { message: "KELDER: yeni metin." },
    });
    expect(update.status).toBe(200);
    expect(await detail(shared, 307)).toMatchObject({
      message: "KELDER: yeni metin.",
      category_id: null,
      subject: null,
    });
  });
});

describe("the audit trail", () => {
  test("stamps create_date at creation and update_date at each update, in UTC with milliseconds", async () => {
    const shared = client();
    const clock = shared.mock.runtime.clock;
    const created = apiDateTime(clock.now());
    expect(created).toMatch(UTC_MILLIS);
    const templateId = await createTemplate(shared, { ...EMAIL_TEMPLATE });
    expect(await row(shared, templateId)).toMatchObject({
      create_date: created,
      update_date: null,
      created_by_id: null,
      created_by__name: null,
      updated_by_id: null,
      updated_by__name: null,
    });
    // Less than the token's hour, so the cached token stays valid.
    clock.advance(45 * 60_000 + 1234);
    const updated = apiDateTime(clock.now());
    await shared.ok("updateTemplate", {
      path: { template_id: templateId },
      body: { title: "Aidat Teşekkürü" },
    });
    expect(await row(shared, templateId)).toMatchObject({
      create_date: created,
      update_date: updated,
      updated_by_id: null,
    });
    expect(updated).not.toBe(created);
  });

  test("an update keeps who created and last updated a seeded template", async () => {
    const shared = client();
    const before = await row(shared, 301);
    shared.mock.runtime.clock.advance(60_000);
    await shared.ok("updateTemplate", {
      path: { template_id: 301 },
      body: { title: "Bağış Teşekkürü" },
    });
    const after = await row(shared, 301);
    expect(after.create_date).toBe(before.create_date);
    expect(after.created_by_id).toBe(before.created_by_id);
    expect(after.created_by__name).toBe(before.created_by__name);
    expect(after.updated_by_id).toBe(before.updated_by_id);
    expect(after.update_date).toBe(
      apiDateTime(shared.mock.runtime.clock.now()),
    );
    expect(after.update_date).not.toBe(before.update_date);
  });

  test("a template another area saved reads as created now, with blank texts as null", async () => {
    const shared = client();
    shared.mock.runtime.clock.advance(3 * 86_400_000);
    const saved = kelder(shared).templates.insert({
      title: "Kaydedilen Taslak",
      subject: "",
      message: "<p>Merhaba</p>",
      has_association_logo: true,
      type_sms: false,
      background_color: "#000000",
      body_color: "#111111",
      footer_text_color: "#222222",
      footer_icon_color: 2,
      has_button: false,
      btn_text: "",
      btn_color: "#333333",
      btn_text_color: "#444444",
      btn_operation: 1,
      btn_operation_detail: "login",
      category_id: 4,
      translations: {},
    });
    expect(await row(shared, saved.id)).toEqual({
      id: saved.id,
      title: "Kaydedilen Taslak",
      subject: null,
      message: "<p>Merhaba</p>",
      category_id: 4,
      category__name: "Genel",
      type_sms: false,
      create_date: apiDateTime(shared.mock.runtime.clock.now()),
      update_date: null,
      created_by_id: null,
      created_by__name: null,
      updated_by_id: null,
      updated_by__name: null,
    });
    expect(await detail(shared, saved.id)).toMatchObject({
      subject: null,
      btn_text: null,
      btn_operation_detail: "login",
      ...ALWAYS_NULL,
    });
  });
});

describe("what a request can set", () => {
  test("still refuses null, because only the responses are nullable", async () => {
    const shared = client();
    for (const field of [
      "subject",
      "btn_text",
      "btn_operation_detail",
      "category_id",
      "translations",
    ]) {
      const response = await shared.call("createTemplate", {
        body: { ...EMAIL_TEMPLATE, [field]: null },
      });
      expect(response.status, `create with ${field} null`).toBe(400);
      const update = await shared.call("updateTemplate", {
        path: { template_id: 301 },
        body: { [field]: null },
      });
      expect(update.status, `update with ${field} null`).toBe(400);
    }
  });

  test("ignores the fields only a response carries", async () => {
    const shared = client();
    shared.mock.runtime.clock.advance(60_000);
    const templateId = await createTemplate(shared, {
      ...EMAIL_TEMPLATE,
      badge_icon: "star",
      design: { blocks: [] },
      heading: "Başlık",
      preheader: "Önizleme",
      references: { donation_page: 1 },
      create_date: "2001-01-01T00:00:00.000Z",
      update_date: "2002-02-02T00:00:00.000Z",
      created_by_id: 1001,
      updated_by_id: 1001,
    });
    expect(await detail(shared, templateId)).toMatchObject(ALWAYS_NULL);
    expect(await row(shared, templateId)).toMatchObject({
      create_date: apiDateTime(shared.mock.runtime.clock.now()),
      update_date: null,
      created_by_id: null,
      updated_by_id: null,
    });
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
    for (const unused of [302, 303, 304, 307]) {
      expect(
        await shared.ok("deleteTemplate", { path: { template_id: unused } }),
        `seeded template ${unused} is unused`,
      ).toEqual({ result: "ok" });
    }
    expect((await titles(shared, {})).total).toBe(3);
  });
});
