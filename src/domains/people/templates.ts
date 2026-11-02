import { notFound } from "../../api/errors";
import { userName } from "../../store/joins";
import type { Handler, HandlerInput } from "../../api/handler";
import { matchesQuery, paginate } from "../../api/listing";
import type { components } from "../../generated/openapi";
import type { Row } from "../../store/collection";
import type { TemplateRecord, TemplateTranslations } from "../../store/records";
import { TEMPLATE_CATEGORIES } from "../../store/reference";
import type { OrgStore } from "../../store/store";

type TemplateBody = NonNullable<
  components["requestBodies"]["Template"]["content"]["application/json"]
>;
type TemplateDetail = components["schemas"]["Template"];
type TemplateListItem = components["schemas"]["TemplateList"];
type Template = Row<TemplateRecord>;
// What a request can set. The audit trail is stamped by the handlers.
type Content = Omit<
  TemplateRecord,
  "id" | "create_date" | "update_date" | "created_by_id" | "updated_by_id"
>;

const DEFAULT_CATEGORY_ID = 4;
const HEX = /^#[0-9a-fA-F]{6}$/;
const BUTTON_KEYWORDS: readonly string[] = [
  "login",
  "cc",
  "donation",
  "dues",
  "member_card",
];

function categoryName(categoryId: number | null): string | null {
  return (
    TEMPLATE_CATEGORIES.find((category) => category.id === categoryId)?.name ??
    null
  );
}

// Production sends null where a template has no subject or button text. The
// areas that save a template write "" instead.
function blankAsNull(text: string | null): string | null {
  return text === null || text === "" ? null : text;
}

// `Object.fromEntries` keeps a language called `__proto__` as an own key.
function translationsOf(
  translations: TemplateTranslations,
): NonNullable<TemplateDetail["translations"]> {
  return Object.fromEntries(
    Object.entries(translations).flatMap(([language, fields]) =>
      fields === undefined
        ? []
        : [
            [
              language,
              Object.fromEntries(
                Object.entries(fields).map(([field, text]) => [
                  field,
                  text ?? null,
                ]),
              ),
            ],
          ],
    ),
  );
}

// Production's list rows say who created and last updated a template. An
// area that inserts a template without stamping it leaves the dates blank,
// and the template then reads as created now.
function toListItem(
  row: Template,
  store: OrgStore,
  fallbackCreateDate: string,
): TemplateListItem {
  const createdBy = row.created_by_id ?? null;
  const updatedBy = row.updated_by_id ?? null;
  return {
    id: row.id,
    title: row.title,
    subject: blankAsNull(row.subject),
    message: row.message,
    category_id: row.category_id,
    category__name: categoryName(row.category_id),
    type_sms: row.type_sms,
    create_date: row.create_date ?? fallbackCreateDate,
    update_date: row.update_date ?? null,
    created_by__name: userName(store, createdBy) ?? null,
    created_by_id: createdBy,
    updated_by__name: userName(store, updatedBy) ?? null,
    updated_by_id: updatedBy,
  };
}

// Production sent badge_icon, design, heading and preheader as null, and
// references as an empty object, on every template it has.
function toTemplate(row: Template): TemplateDetail {
  return {
    id: row.id,
    title: row.title,
    subject: blankAsNull(row.subject),
    message: row.message,
    has_association_logo: row.has_association_logo,
    type_sms: row.type_sms,
    background_color: row.background_color,
    body_color: row.body_color,
    footer_text_color: row.footer_text_color,
    footer_icon_color: row.footer_icon_color,
    has_button: row.has_button,
    btn_text: blankAsNull(row.btn_text),
    btn_color: row.btn_color,
    btn_text_color: row.btn_text_color,
    btn_operation: row.btn_operation,
    btn_operation_detail: row.btn_operation_detail,
    category_id: row.category_id,
    translations: translationsOf(row.translations),
    badge_icon: null,
    design: null,
    heading: null,
    preheader: null,
    references: {},
  };
}

const BLANK: Content = {
  title: "",
  subject: null,
  message: "",
  has_association_logo: true,
  type_sms: false,
  background_color: "#ffffff",
  body_color: "#1f2933",
  footer_text_color: "#5b5b5b",
  footer_icon_color: 2,
  has_button: false,
  btn_text: null,
  btn_color: "#1f2933",
  btn_text_color: "#ffffff",
  btn_operation: 2,
  btn_operation_detail: null,
  category_id: DEFAULT_CATEGORY_ID,
  translations: {},
};

function merge(base: Content, body: TemplateBody): Content {
  return {
    title: body.title ?? base.title,
    subject: body.subject ?? base.subject,
    message: body.message ?? base.message,
    has_association_logo:
      body.has_association_logo ?? base.has_association_logo,
    type_sms: body.type_sms ?? base.type_sms,
    background_color: body.background_color ?? base.background_color,
    body_color: body.body_color ?? base.body_color,
    footer_text_color: body.footer_text_color ?? base.footer_text_color,
    footer_icon_color: body.footer_icon_color ?? base.footer_icon_color,
    has_button: body.has_button ?? base.has_button,
    btn_text: body.btn_text ?? base.btn_text,
    btn_color: body.btn_color ?? base.btn_color,
    btn_text_color: body.btn_text_color ?? base.btn_text_color,
    btn_operation: body.btn_operation ?? base.btn_operation,
    btn_operation_detail:
      body.btn_operation_detail ?? base.btn_operation_detail,
    category_id: body.category_id ?? base.category_id,
    translations: body.translations ?? base.translations,
  };
}

type Checked =
  | { readonly ok: true; readonly draft: Content }
  | { readonly ok: false; readonly status: 400 | 404; readonly error: string };

function check(draft: Content): Checked {
  const problem = (error: string): Checked => ({
    ok: false,
    status: 400,
    error: `Invalid values: ${error}`,
  });
  if (draft.title.trim() === "") return problem("title cannot be empty");
  if (draft.message.trim() === "") return problem("message cannot be empty");
  if (!draft.type_sms && (draft.subject ?? "").trim() === "") {
    return problem("an email template needs a subject");
  }
  if (draft.category_id !== null && categoryName(draft.category_id) === null) {
    return { ok: false, status: 404, error: "Template category not found" };
  }
  const colors = [
    "background_color",
    "body_color",
    "footer_text_color",
    "btn_color",
    "btn_text_color",
  ] as const;
  const badColor = colors.find((field) => !HEX.test(draft[field]));
  if (badColor) return problem(`${badColor} is not a #RRGGBB color`);
  if (draft.has_button) {
    if ((draft.btn_text ?? "").trim() === "") {
      return problem("a button needs btn_text");
    }
    const detail = draft.btn_operation_detail;
    const keyword = detail !== null && BUTTON_KEYWORDS.includes(detail);
    if (draft.btn_operation === 1 && (detail === null || keyword)) {
      return problem("btn_operation 1 opens a URL in btn_operation_detail");
    }
    if (draft.btn_operation === 2 && !keyword) {
      return problem(
        `btn_operation 2 takes one of ${BUTTON_KEYWORDS.join(", ")}`,
      );
    }
  }
  return { ok: true, draft };
}

type OrderBy = HandlerInput<"listTemplates">["query"]["order_by"];

const ORDER: Readonly<
  Record<NonNullable<OrderBy>, (a: Template, b: Template) => number>
> = {
  title: (a, b) => a.title.localeCompare(b.title, "tr") || a.id - b.id,
  "-title": (a, b) => b.title.localeCompare(a.title, "tr") || b.id - a.id,
  create_date: (a, b) => a.id - b.id,
  "-create_date": (a, b) => b.id - a.id,
};

// Production writes its template dates in UTC with milliseconds, unlike the
// +03:00 date-times of the rest of the API.
function stamp(clock: { now(): Date }): string {
  return clock.now().toISOString();
}

export const listTemplates: Handler<"listTemplates"> = (
  { query },
  { store, clock },
) => {
  const matching = store.templates
    .list(
      (row) =>
        matchesQuery(query.query, [row.title, row.subject, row.message]) &&
        (query.template_type === undefined ||
          row.type_sms === (query.template_type === "s")) &&
        (query.category_id === undefined ||
          row.category_id === query.category_id),
    )
    .sort(ORDER[query.order_by ?? "-create_date"]);
  const now = stamp(clock);
  return {
    status: 200,
    body: {
      result: "ok",
      total: matching.length,
      template_list: paginate(matching, query).map((row) =>
        toListItem(row, store, now),
      ),
    },
  };
};

export const getTemplateDetails: Handler<"getTemplateDetails"> = (
  { path },
  { store },
) => {
  const row = store.templates.get(path.template_id);
  if (!row) return notFound("Template");
  return { status: 200, body: { template: toTemplate(row) } };
};

export const createTemplate: Handler<"createTemplate"> = (
  { body },
  { store, clock },
) => {
  if (body === undefined) {
    return {
      status: 400,
      body: { error: "Invalid values: a template body is required" },
    };
  }
  const checked = check(merge(BLANK, body));
  if (!checked.ok) {
    return { status: checked.status, body: { error: checked.error } };
  }
  // An API key is no user, so nobody is named as the creator.
  const row = store.templates.insert({
    ...checked.draft,
    create_date: stamp(clock),
    update_date: null,
    created_by_id: null,
    updated_by_id: null,
  });
  return { status: 200, body: { result: "ok", template_id: row.id } };
};

export const updateTemplate: Handler<"updateTemplate"> = (
  { path, body },
  { store, clock },
) => {
  const row = store.templates.get(path.template_id);
  if (!row) return notFound("Template");
  if (body === undefined) {
    return {
      status: 400,
      body: { error: "Invalid values: a template body is required" },
    };
  }
  const { id: _id, ...current } = row;
  const checked = check(merge(current, body));
  if (!checked.ok) {
    return { status: checked.status, body: { error: checked.error } };
  }
  store.templates.update(row.id, {
    ...checked.draft,
    update_date: stamp(clock),
  });
  return { status: 200, body: { result: "ok" } };
};

function templateUse(store: OrgStore, templateId: number): string | null {
  const uses = (ids: readonly (number | null)[]) => ids.includes(templateId);
  const campaign = store.fundraisingCampaigns.find(
    (row) =>
      row.status === 1 &&
      uses([
        row.thanks_mail_id,
        row.thanks_sms_id,
        row.referral_thanks_mail_id,
      ]),
  );
  if (campaign) {
    return `This template is connected to a fundraising campaign: ${campaign.title}`;
  }
  const thanked = [
    ...store.donations.list((row) => row.thanks_mail_id === templateId),
    ...store.microDonations.list((row) => row.thanks_mail_id === templateId),
  ];
  for (const donation of thanked) {
    const page =
      donation.fundraising_page_id === null
        ? undefined
        : store.donationPages.get(donation.fundraising_page_id);
    if (page)
      return `This template is connected to a donation page: ${page.title}`;
  }
  for (const donation of thanked) {
    const form =
      donation.module_id === null
        ? undefined
        : store.donationForms.get(donation.module_id);
    if (form)
      return `This template is connected to a donation form: ${form.title}`;
  }
  const ecard = store.ecards.find((row) =>
    uses([
      row.thanks_mail_id,
      row.referring_thanks_mail_id,
      row.thanks_sms_id,
      row.referring_thanks_sms_id,
    ]),
  );
  if (ecard) return `This template is connected to an e-card: ${ecard.title}`;
  return null;
}

function releaseTemplate(store: OrgStore, templateId: number): void {
  const clear = (id: number | null) => (id === templateId ? null : id);
  for (const row of store.fundraisingCampaigns.list(
    (campaign) =>
      campaign.thanks_mail_id === templateId ||
      campaign.thanks_sms_id === templateId ||
      campaign.referral_thanks_mail_id === templateId,
  )) {
    store.fundraisingCampaigns.update(row.id, {
      thanks_mail_id: clear(row.thanks_mail_id),
      thanks_sms_id: clear(row.thanks_sms_id),
      referral_thanks_mail_id: clear(row.referral_thanks_mail_id),
    });
  }
  for (const collection of [store.donations, store.microDonations]) {
    for (const row of collection.list(
      (donation) => donation.thanks_mail_id === templateId,
    )) {
      collection.update(row.id, { thanks_mail_id: null });
    }
  }
}

export const deleteTemplate: Handler<"deleteTemplate"> = (
  { path },
  { store },
) => {
  if (!store.templates.get(path.template_id)) return notFound("Template");
  const use = templateUse(store, path.template_id);
  if (use !== null) return { status: 409, body: { error: use } };
  releaseTemplate(store, path.template_id);
  store.templates.remove(path.template_id);
  return { status: 200, body: { result: "ok" } };
};
