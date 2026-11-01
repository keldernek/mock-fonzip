import { notFound } from "../../api/errors";
import type { Handler, HandlerInput } from "../../api/handler";
import { addDays, istanbulDate } from "../../seed/dates";
import type { Row } from "../../store/collection";
import type {
  DonationRecord,
  MonthlyDonationRequestRecord,
  TemplateRecord,
} from "../../store/records";
import type { OrgStore } from "../../store/store";
import {
  now,
  recordDonation,
  singleDonation,
  today,
  transactionOf,
  type GivingContext,
} from "./payments";
import { lookup } from "./rows";

const OK = { status: 200, body: { result: "ok" } } as const;

function rejected(error: string) {
  return { status: 400, body: { error } } as const;
}

export function isMonthlyParent(donation: DonationRecord): boolean {
  return (
    donation.recurring_order_id !== null &&
    donation.monthly_donation_id === null
  );
}

function monthlyParent(
  store: OrgStore,
  donationId: number,
): Row<DonationRecord> | undefined {
  const donation = store.donations.get(donationId);
  return donation && isMonthlyParent(donation) ? donation : undefined;
}

export function monthlyRequestOf(
  store: OrgStore,
  donationId: number,
): Row<MonthlyDonationRequestRecord> | undefined {
  return store.monthlyDonationRequests
    .list((request) => request.donation_id === donationId)
    .reduce<Row<MonthlyDonationRequestRecord> | undefined>(
      (latest, request) =>
        latest === undefined || request.id > latest.id ? request : latest,
      undefined,
    );
}

function pendingRequests(
  store: OrgStore,
  donationId: number,
): Row<MonthlyDonationRequestRecord>[] {
  return store.monthlyDonationRequests.list(
    (request) => request.donation_id === donationId && request.status === 0,
  );
}

function setSeriesStatus(
  store: OrgStore,
  parent: DonationRecord,
  status: DonationRecord["recurring_status"],
): void {
  for (const donation of store.donations.list(
    (row) => row.recurring_order_id === parent.recurring_order_id,
  )) {
    store.donations.update(donation.id, { recurring_status: status });
  }
}

function hasVisibleContent(html: string): boolean {
  if (/<img\b/i.test(html)) return true;
  return (
    html
      .replaceAll(/<[^>]*>/g, "")
      .replaceAll(/&nbsp;|&#160;/gi, " ")
      .trim() !== ""
  );
}

type CancelBody = HandlerInput<"cancelMonthlyDonation">["body"];

const DEFAULT_TEMPLATE: Omit<TemplateRecord, "id" | "title"> = {
  subject: "",
  message: "",
  has_association_logo: true,
  type_sms: false,
  background_color: "#ffffff",
  body_color: "#ffffff",
  footer_text_color: "#5b5b5b",
  footer_icon_color: 2,
  has_button: false,
  btn_text: "",
  btn_color: "#000000",
  btn_text_color: "#ffffff",
  btn_operation: 2,
  btn_operation_detail: "login",
  category_id: 1,
  translations: {},
};

function templateFrom(
  body: CancelBody,
  base: Omit<TemplateRecord, "id">,
): Omit<TemplateRecord, "id"> {
  return {
    ...base,
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
    translations: body.translations ?? base.translations,
  };
}

export const cancelMonthlyDonation: Handler<"cancelMonthlyDonation"> = (
  { path, body },
  ctx,
) => {
  const { store } = ctx;
  const parent = monthlyParent(store, path.donation_id);
  if (!parent) return notFound("Monthly donation");
  if (body.action !== "cancel") return rejected('action must be "cancel"');
  const reason = body.reason.trim();
  if (reason === "") return rejected("reason is required");
  if (parent.recurring_status === 3) {
    return rejected("The monthly donation is already cancelled");
  }
  if (
    body.send_cancellation_mail === true &&
    ((body.subject ?? "").trim() === "" ||
      !hasVisibleContent(body.message ?? ""))
  ) {
    return rejected(
      "subject and message are required to send a cancellation mail",
    );
  }
  const usesTemplate =
    body.send_from_template === true || body.update_template === true;
  if (usesTemplate && body.template_id === undefined) {
    return rejected("template_id is required to use a saved template");
  }
  const template =
    body.template_id === undefined
      ? undefined
      : store.templates.get(body.template_id);
  if (body.template_id !== undefined && !template) return notFound("Template");
  const title = (body.title ?? "").trim();
  if (body.save_as_template === true && title === "") {
    return rejected("title is required to save the message as a template");
  }

  if (body.update_template === true && template) {
    store.templates.update(template.id, templateFrom(body, template));
  }
  if (body.save_as_template === true) {
    store.templates.insert(templateFrom(body, { ...DEFAULT_TEMPLATE, title }));
  }
  const at = now(ctx);
  setSeriesStatus(store, parent, 3);
  store.donations.update(parent.id, {
    recurring_cancel_reason: reason,
    recurring_cancel_date: today(ctx),
    cancelled_by_id: null,
    recurring_next_cycle: null,
    recurring_next_amount: null,
    last_update_date: at,
  });
  for (const request of pendingRequests(store, parent.id)) {
    store.monthlyDonationRequests.update(request.id, {
      status: request.request_type === 0 ? 1 : 4,
      response_date: at,
    });
  }
  return OK;
};

export const createMonthlyDonationUpdateRequest: Handler<
  "createMonthlyDonationUpdateRequest"
> = ({ path, body }, ctx) => {
  const { store } = ctx;
  if (!store.users.get(path.user_id)) return notFound("User");
  const parent = monthlyParent(store, path.donation_id);
  if (!parent || parent.user_id !== path.user_id) {
    return notFound("Monthly donation");
  }
  if (body.type === undefined) return rejected("type is required");
  const value = (body.value ?? "").trim();
  if (value === "") return rejected("value is required");
  if (body.type === "amount" && !(Number(value) > 0)) {
    return rejected("value must be the new monthly amount");
  }
  if (parent.recurring_status === 3) {
    return rejected("The monthly donation is cancelled");
  }
  if (pendingRequests(store, parent.id).length > 0) {
    return rejected("The monthly donation already has a pending request");
  }
  store.monthlyDonationRequests.insert({
    donation_id: parent.id,
    user_id: parent.user_id,
    request_type: body.type === "cancel" ? 0 : 1,
    status: 0,
    value,
    create_date: now(ctx),
    response_date: null,
  });
  return OK;
};

export const respondMonthlyDonationAmountChangeRequest: Handler<
  "respondMonthlyDonationAmountChangeRequest"
> = ({ path, body }, ctx) => {
  const { store } = ctx;
  const parent = monthlyParent(store, path.donation_id);
  if (!parent) return notFound("Monthly donation");
  const request = pendingRequests(store, parent.id).find(
    (row) => row.request_type === 1,
  );
  if (!request) return notFound("Amount change request");
  const at = now(ctx);
  store.monthlyDonationRequests.update(request.id, {
    status: body.approval ? 3 : 4,
    response_date: at,
  });
  if (body.approval) {
    store.donations.update(parent.id, {
      recurring_next_amount: Number(request.value),
      last_update_date: at,
    });
  }
  return OK;
};

function retryWithdrawal(ctx: GivingContext, parent: Row<DonationRecord>) {
  const { store, rng } = ctx;
  if (parent.recurring_status !== 2) {
    return rejected(
      "Only a monthly donation whose last withdrawal failed can be retried",
    );
  }
  const donor = store.users.get(parent.user_id);
  if (!donor) return notFound("User");
  const card = lookup(store.cardInfos, parent.card_info_id);
  const first = transactionOf(store, parent);
  const amount = parent.recurring_next_amount ?? first.amount;
  const at = now(ctx);
  setSeriesStatus(store, parent, 1);
  recordDonation(
    ctx,
    donor,
    {
      amount,
      currencyId: first.currency_id,
      completeDate: at,
      status: 3,
      method: 0,
      paymentSettingsId: first.payment_settings_id,
      bankAccountId: null,
      card: card ? { bin: card.bin_number, lastFour: card.last_four } : null,
      error: null,
      bankTransactionId: rng.digits(12),
      receiptNo: `MKB-${rng.digits(8)}`,
      ipAddress: "",
    },
    {
      ...singleDonation(donor, at),
      recurring_status: 1,
      sub_donation_type_id: parent.sub_donation_type_id,
      fundraising_page_id: parent.fundraising_page_id,
      module_id: parent.module_id,
      application_id: parent.application_id,
      recurring_order_id: parent.recurring_order_id,
      recurring_withdrawal: true,
      donor_type: parent.donor_type,
      thanks_mail_id: parent.thanks_mail_id,
      card_info_id: parent.card_info_id,
      monthly_donation_id: parent.id,
    },
  );
  store.donations.update(parent.id, {
    recurring_error: null,
    recurring_withdraw_count: parent.recurring_withdraw_count + 1,
    recurring_total_withdraw_count: parent.recurring_total_withdraw_count + 1,
    recurring_total_withdraw_amount:
      parent.recurring_total_withdraw_amount + amount,
    recurring_last_success_withdrawal_date: today(ctx),
    recurring_next_cycle: istanbulDate(addDays(ctx.clock.now(), 30)),
    recurring_next_amount: amount,
    last_update_date: at,
  });
  return OK;
}

export const changeMonthlyDonationValues: Handler<
  "changeMonthlyDonationValues"
> = ({ path, body }, ctx) => {
  const { store } = ctx;
  const parent = monthlyParent(store, body.donation_id);
  if (!parent || parent.recurring_order_id !== path.monthly_donation_order_id) {
    return notFound("Monthly donation");
  }
  if (parent.recurring_status === 3) {
    return rejected("The monthly donation is cancelled");
  }
  const at = now(ctx);
  switch (body.mode) {
    case "date": {
      const next = body.recurring_next_cycle;
      if (next === undefined)
        return rejected("recurring_next_cycle is required");
      if (next <= today(ctx)) {
        return rejected("recurring_next_cycle must be a future date");
      }
      store.donations.update(parent.id, {
        recurring_next_cycle: next,
        last_update_date: at,
      });
      return OK;
    }
    case "category": {
      if (body.category_id === undefined) {
        return rejected("category_id is required");
      }
      if (!store.donationCategories.get(body.category_id)) {
        return notFound("Donation category");
      }
      store.donations.update(parent.id, {
        sub_donation_type_id: body.category_id,
        last_update_date: at,
      });
      return OK;
    }
    case "amount": {
      if (body.amount === undefined || !(body.amount > 0)) {
        return rejected("amount must be greater than zero");
      }
      store.donations.update(parent.id, {
        recurring_next_amount: body.amount,
        last_update_date: at,
      });
      return OK;
    }
    case "retry":
      return retryWithdrawal(ctx, parent);
  }
};

export const sendCardUpdateRequestForMonthlyDonation: Handler<
  "sendCardUpdateRequestForMonthlyDonation"
> = ({ path, body }, { store }) => {
  const user = store.users.get(path.user_id);
  if (!user) return notFound("User");
  const parent = monthlyParent(store, path.donation_id);
  if (!parent || parent.user_id !== user.id) {
    return notFound("Monthly donation");
  }
  if (body.mode === undefined) return rejected("mode is required");
  if (parent.recurring_status === 3) {
    return rejected("The monthly donation is cancelled");
  }
  if (body.mode === "email" && user.email === "") {
    return rejected("The donor has no email address");
  }
  if (body.mode === "sms" && user.phone === "") {
    return rejected("The donor has no mobile phone number");
  }
  return OK;
};
