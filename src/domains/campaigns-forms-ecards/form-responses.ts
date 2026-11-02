import { notFound } from "../../api/errors";
import type { HandlerContext, HandlerInput } from "../../api/handler";
import type { Row } from "../../store/collection";
import type { FormAnswerRecord, TemplateRecord } from "../../store/records";
import { APPROVAL_STATUS } from "../../store/reference";
import type { OrgStore } from "../../store/store";
import { OUTCOME_STATUS, WEBHOOK_OPERATIONS } from "../../webhooks/emitter";
import { badRequest, failed, parsed, type Parsed } from "./failures";
import { refund } from "./transactions";

type Details = HandlerInput<"respondFormAnswer">["body"]["answer"];
type Design = Omit<
  TemplateRecord,
  "id" | "title" | "category_id" | "type_sms" | "translations"
>;

const GENERAL_TEMPLATE_CATEGORY = 4;
const REFUND_REASON = "Form yanıtı yanıtlanırken iade edildi";

type Membership =
  | { readonly kind: "keep" }
  | { readonly kind: "auto" }
  | { readonly kind: "custom"; readonly number: number };

type TemplateChange =
  | { readonly kind: "none" }
  | { readonly kind: "save"; readonly title: string; readonly design: Design }
  | { readonly kind: "update"; readonly id: number; readonly design: Design };

interface FormResponse {
  readonly approvalStatus: FormAnswerRecord["approval_status"];
  readonly membership: Membership;
  readonly mail: boolean;
  readonly refund: boolean;
  readonly template: TemplateChange;
}

function visible(html: string): boolean {
  if (/<img\b/i.test(html)) return true;
  return (
    html
      .replaceAll(/<[^>]*>/g, "")
      .replaceAll(/&nbsp;/gi, " ")
      .trim() !== ""
  );
}

function hasContent(details: Details): boolean {
  return (
    (details.subject?.trim() ?? "") !== "" && visible(details.message ?? "")
  );
}

function footerIcon(
  value: number | undefined,
): Design["footer_icon_color"] | null {
  switch (value) {
    case undefined:
    case 1:
      return 1;
    case 0:
    case 2:
      return value;
    default:
      return null;
  }
}

function designOf(details: Details, base: Design | undefined): Parsed<Design> {
  const icon = footerIcon(details.footer_icon_color ?? base?.footer_icon_color);
  if (icon === null) {
    return failed(badRequest("footer_icon_color must be 0, 1 or 2"));
  }
  return parsed({
    subject: details.subject ?? "",
    message: details.message ?? "",
    has_association_logo:
      details.has_association_logo ?? base?.has_association_logo ?? true,
    background_color:
      details.background_color ?? base?.background_color ?? "#f4f1ea",
    body_color: details.body_color ?? base?.body_color ?? "#ffffff",
    footer_text_color:
      details.footer_text_color ?? base?.footer_text_color ?? "#5b5b5b",
    footer_icon_color: icon,
    has_button: details.has_button ?? base?.has_button ?? false,
    btn_text: details.btn_text ?? base?.btn_text ?? "",
    btn_color: details.btn_color ?? base?.btn_color ?? "#8b1d2c",
    btn_text_color: details.btn_text_color ?? base?.btn_text_color ?? "#ffffff",
    btn_operation: details.btn_operation ?? base?.btn_operation ?? 2,
    btn_operation_detail:
      details.btn_operation_detail ?? base?.btn_operation_detail ?? "login",
  });
}

function templateChange(
  store: OrgStore,
  details: Details,
): Parsed<TemplateChange> {
  const template =
    details.template_id === undefined
      ? undefined
      : store.templates.get(details.template_id);
  if (details.send_from_template === true || details.update_template === true) {
    if (details.template_id === undefined) {
      return failed(badRequest("template_id is required for a saved template"));
    }
    if (!template) return failed(notFound("Template"));
  }
  if (details.update_template === true && template) {
    if (!hasContent(details)) {
      return failed(
        badRequest("subject and message are required to update a template"),
      );
    }
    const design = designOf(details, template);
    return design.ok
      ? parsed({ kind: "update", id: template.id, design: design.value })
      : design;
  }
  if (details.save_as_template === true) {
    const title = details.title?.trim() ?? "";
    if (title === "" || !hasContent(details)) {
      return failed(
        badRequest(
          "title, subject and message are required to save a template",
        ),
      );
    }
    const design = designOf(details, undefined);
    return design.ok
      ? parsed({ kind: "save", title, design: design.value })
      : design;
  }
  return parsed({ kind: "none" });
}

function membershipOf(approve: boolean, details: Details): Parsed<Membership> {
  if (!approve) return parsed({ kind: "keep" });
  switch (details.membership_no_decision) {
    case undefined:
    case "no":
      return parsed({ kind: "keep" });
    case "auto":
      return parsed({ kind: "auto" });
    case "custom":
      return details.membership_no === undefined
        ? failed(
            badRequest(
              "membership_no is required when membership_no_decision is custom",
            ),
          )
        : parsed({ kind: "custom", number: details.membership_no });
  }
}

export function parseResponse(
  store: OrgStore,
  body: HandlerInput<"respondFormAnswer">["body"],
): Parsed<FormResponse> {
  const details = body.answer;
  const approve = body.response_type === "approve";
  if (details.send_mail === true && !hasContent(details)) {
    return failed(
      badRequest("subject and message are required when send_mail is true"),
    );
  }
  const membership = membershipOf(approve, details);
  if (!membership.ok) return membership;
  const template = templateChange(store, details);
  if (!template.ok) return template;
  return parsed({
    approvalStatus: approve
      ? APPROVAL_STATUS.approved
      : APPROVAL_STATUS.rejected,
    membership: membership.value,
    mail: details.send_mail === true,
    refund: details.make_refund === true,
    template: template.value,
  });
}

function assignMembership(
  store: OrgStore,
  userId: number | null,
  membership: Membership,
): void {
  const user = userId === null ? undefined : store.users.get(userId);
  if (!user || membership.kind === "keep") return;
  const next =
    membership.kind === "custom"
      ? membership.number
      : Math.max(0, ...store.users.list().map((row) => row.membership_no)) + 1;
  store.users.update(user.id, { membership_no: next });
}

function saveTemplate(store: OrgStore, change: TemplateChange): void {
  switch (change.kind) {
    case "none":
      return;
    case "update":
      store.templates.update(change.id, change.design);
      return;
    case "save":
      store.templates.insert({
        ...change.design,
        title: change.title,
        type_sms: false,
        category_id: GENERAL_TEMPLATE_CATEGORY,
        translations: {},
      });
  }
}

export function applyResponse(
  { store, rng, webhooks }: HandlerContext,
  answer: Row<FormAnswerRecord>,
  response: FormResponse,
  now: string,
): void {
  // An API key is not a contact, so nobody is named as the responder, as
  // nobody is named for a refund made through the API.
  store.formAnswers.update(answer.id, {
    approval_status: response.approvalStatus,
    respond_date: now,
    responded_by_id: null,
  });
  assignMembership(store, answer.user_id, response.membership);
  const payment =
    answer.transaction_id === null
      ? undefined
      : store.transactions.get(answer.transaction_id);
  if (
    response.refund &&
    payment &&
    refund(store, payment, now, REFUND_REASON, null)
  ) {
    webhooks.emit(
      { operation: WEBHOOK_OPERATIONS.form, status: OUTCOME_STATUS.refunded },
      answer.id,
    );
  }
  if (response.mail) {
    const mail = store.sentEmails.insert({
      message_id: rng.int(1_000_000, 9_999_999),
      status: 0,
    });
    store.formAnswers.update(answer.id, { sent_mail_id: mail.id });
  }
  saveTemplate(store, response.template);
}
