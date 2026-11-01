import {
  type SimulationContext,
  type SimulationFragment,
  type SimulationInput,
  type SimulationResult,
} from "../../control/simulation";
import { addDays, istanbulDate, istanbulDateTime } from "../../seed/dates";
import type { Row } from "../../store/collection";
import type { FormRecord, UserRecord } from "../../store/records";
import { PAYMENT_STATUS, TRY_CURRENCY_ID } from "../../store/reference";
import type { OrgStore } from "../../store/store";
import { OUTCOME_STATUS, WEBHOOK_OPERATIONS } from "../../webhooks/emitter";
import { CARD_BINS } from "./ecard-sales";
import { answerStatus } from "./forms";
import {
  recordPayment,
  refund,
  type Payment,
  type PaymentOutcome,
} from "./transactions";

type Refusal = Extract<SimulationResult, { ok: false }>;
type Parsed<T> = { readonly ok: true; readonly value: T } | Refusal;

function invalid(error: string): Refusal {
  return { ok: false, status: 400, error };
}

function missing(error: string): Refusal {
  return { ok: false, status: 404, error };
}

function conflict(error: string): Refusal {
  return { ok: false, status: 409, error };
}

function sameEmail(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function paymentOf(
  input: SimulationInput,
  store: OrgStore,
  cardSettingsId: number | undefined,
): Parsed<Payment> {
  const method = input.number("payment_method") ?? 0;
  if (method === 2) {
    const accountId = input.number("bank_account_id");
    if (accountId === undefined) {
      return invalid("bank_account_id is required for a wire transfer");
    }
    if (!store.bankAccounts.get(accountId)) {
      return missing(`bank account ${accountId} not found`);
    }
    return { ok: true, value: { method: 2, bankAccountId: accountId } };
  }
  if (method !== 0)
    return invalid("payment_method must be 0 (card) or 2 (wire)");
  if (cardSettingsId === undefined) {
    return invalid("the association has no card payment settings");
  }
  const binNumber = input.string("bin_number") ?? CARD_BINS[0] ?? "454360";
  if (!/^\d{6}$/.test(binNumber)) return invalid("bin_number must be 6 digits");
  return {
    ok: true,
    value: { method: 0, paymentSettingsId: cardSettingsId, binNumber },
  };
}

function outcomeOf(input: SimulationInput): PaymentOutcome | null {
  switch (input.number("payment_status") ?? PAYMENT_STATUS.successful) {
    case PAYMENT_STATUS.successful:
      return PAYMENT_STATUS.successful;
    case PAYMENT_STATUS.failed:
      return PAYMENT_STATUS.failed;
    default:
      return null;
  }
}

interface Person {
  readonly first_name: string;
  readonly last_name: string;
  readonly email: string;
  readonly phone: string;
}

function personOf(input: SimulationInput): Parsed<Person> {
  const email = input.string("email")?.trim() ?? "";
  const first = input.string("first_name")?.trim() ?? "";
  if (email === "" || first === "") {
    return invalid("first_name and email are required");
  }
  return {
    ok: true,
    value: {
      first_name: first,
      last_name: input.string("last_name")?.trim() ?? "",
      email,
      phone: input.string("phone")?.trim() ?? "",
    },
  };
}

function newContact(ctx: SimulationContext, person: Person): Row<UserRecord> {
  const now = istanbulDateTime(ctx.clock.now());
  return ctx.store.users.insert({
    corporate_type: false,
    first_name: person.first_name,
    last_name: person.last_name,
    address: "",
    birthday: "",
    total_financial: 0,
    email: person.email,
    phone: person.phone,
    membership_no: 0,
    tckno: "",
    apply_date: now,
    join_date: now,
    user_defined_values: {},
    nationality_text: "",
    home_phone_first: "",
    post_code: "",
    district_text: "",
    city_text: "",
    country_text: "",
    work_phone: "",
    work_address: "",
    work_post_code: "",
    private: false,
    work_district_text: "",
    work_city_text: "",
    work_country_text: "",
    email_second: "",
    admin: false,
  });
}

interface Contact {
  readonly userId: number;
  readonly mergeCandidateId: number | null;
}

function contactFor(ctx: SimulationContext, person: Person): Contact {
  const { store } = ctx;
  const byEmail = store.users.find((user) =>
    sameEmail(user.email, person.email),
  );
  if (byEmail) return { userId: byEmail.id, mergeCandidateId: null };
  const byPhone =
    person.phone === ""
      ? undefined
      : store.users.find((user) => user.phone === person.phone);
  const created = newContact(ctx, person);
  if (!byPhone) return { userId: created.id, mergeCandidateId: null };
  const pair = store.mergeCandidates.insert({
    first_user_id: byPhone.id,
    second_user_id: created.id,
    create_date: created.apply_date,
  });
  return { userId: created.id, mergeCandidateId: pair.id };
}

function openFor(store: OrgStore, form: Row<FormRecord>): string | null {
  if (form.archive_date !== null || !form.active) {
    return `form ${form.id} is not accepting answers`;
  }
  const taken = store.formAnswers.count(
    (answer) =>
      answer.form_id === form.id && answerStatus(store, answer) !== "failed",
  );
  return form.application_limit !== null && taken >= form.application_limit
    ? `form ${form.id} reached its application limit`
    : null;
}

function answerQuestions(
  store: OrgStore,
  formId: number,
  answerId: number,
  phone: string,
): void {
  for (const question of store.formQuestions.list(
    (row) => row.form_id === formId && !row.deleted && row.question_type !== 3,
  )) {
    const [option] = question.options;
    const value =
      question.question_type === 0 && question.static_question === 1
        ? phone
        : (option?.text ?? "");
    store.formAnswerItems.insert({
      answer_id: answerId,
      question_id: question.id,
      answer: value,
      db_answer: value,
      selected_option_ids: option ? [option.id] : [],
    });
  }
}

function submitForm(
  input: SimulationInput,
  ctx: SimulationContext,
): SimulationResult {
  const { store } = ctx;
  const formId = input.number("form_id");
  if (formId === undefined) return invalid("form_id is required");
  const person = personOf(input);
  if (!person.ok) return person;
  const outcome = outcomeOf(input);
  if (outcome === null) return invalid("payment_status must be 3 or 5");
  const form = store.forms.get(formId);
  if (!form) return missing(`form ${formId} not found`);
  const closed = openFor(store, form);
  if (closed !== null) return conflict(closed);
  const payment =
    form.price === null
      ? null
      : paymentOf(input, store, store.paymentSettings.list()[0]?.id);
  if (payment !== null && !payment.ok) return payment;
  const contact = contactFor(ctx, person.value);
  const transaction =
    form.price === null || payment === null
      ? null
      : recordPayment(ctx, form.price, TRY_CURRENCY_ID, payment.value, outcome);
  const answer = store.formAnswers.insert({
    form_id: form.id,
    user_id: contact.userId,
    first_name: person.value.first_name,
    last_name: person.value.last_name,
    email: person.value.email,
    email_verification: false,
    complete_date: istanbulDateTime(ctx.clock.now()),
    transaction_id: transaction?.id ?? null,
    approval_status: form.requires_approval ? 0 : 1,
    sent_mail_id: null,
  });
  answerQuestions(store, form.id, answer.id, person.value.phone);
  ctx.webhooks.emit(
    {
      operation: WEBHOOK_OPERATIONS.form,
      status:
        transaction?.payment_status === PAYMENT_STATUS.failed
          ? OUTCOME_STATUS.error
          : OUTCOME_STATUS.successful,
    },
    answer.id,
  );
  return {
    ok: true,
    body: {
      answer_id: answer.id,
      user_id: contact.userId,
      transaction_id: transaction?.id ?? null,
      merge_candidate_id: contact.mergeCandidateId,
    },
  };
}

interface Delivery {
  readonly mode: 0 | 1 | 2;
  readonly dates: readonly string[];
}

function deliveryOf(
  input: SimulationInput,
  recipients: number,
  today: Date,
): Parsed<Delivery> {
  const mode = input.number("delivery_time_mode") ?? 0;
  if (mode === 0) {
    return {
      ok: true,
      value: {
        mode,
        dates: Array.from({ length: recipients }, () => istanbulDate(today)),
      },
    };
  }
  if (mode !== 1 && mode !== 2) {
    return invalid("delivery_time_mode must be 0, 1 or 2");
  }
  const raw = input.string("delivery_date") ?? "";
  const first = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T12:00:00+03:00`)
    : null;
  if (first === null || Number.isNaN(first.getTime())) {
    return invalid(
      "delivery_date (YYYY-MM-DD) is required for a scheduled card",
    );
  }
  return {
    ok: true,
    value: {
      mode,
      dates: Array.from({ length: recipients }, (_, index) =>
        istanbulDate(addDays(first, mode === 2 ? index : 0)),
      ),
    },
  };
}

function sellEcard(
  input: SimulationInput,
  ctx: SimulationContext,
): SimulationResult {
  const { store } = ctx;
  const ecardId = input.number("ecard_id");
  if (ecardId === undefined) return invalid("ecard_id is required");
  const person = personOf(input);
  if (!person.ok) return person;
  const outcome = outcomeOf(input);
  if (outcome === null) return invalid("payment_status must be 3 or 5");
  const recipients = input.number("recipient_count") ?? 1;
  if (!Number.isInteger(recipients) || recipients < 1) {
    return invalid("recipient_count must be a positive integer");
  }
  const now = ctx.clock.now();
  const delivery = deliveryOf(input, recipients, now);
  if (!delivery.ok) return delivery;
  const ecard = store.ecards.get(ecardId);
  if (!ecard) return missing(`e-card ${ecardId} not found`);
  if (!ecard.active) return conflict(`e-card ${ecardId} is not on sale`);
  const amount = input.number("amount") ?? ecard.first_amount * recipients;
  if (amount < ecard.minimum_amount * recipients) {
    return invalid(
      `amount is below the minimum of ${ecard.minimum_amount} per recipient`,
    );
  }
  const channelId = input.number("marketing_channel_id") ?? null;
  if (channelId !== null && !store.marketingChannels.get(channelId)) {
    return missing(`marketing channel ${channelId} not found`);
  }
  const payment = paymentOf(input, store, ecard.payment_settings_id);
  if (!payment.ok) return payment;
  const transaction = recordPayment(
    ctx,
    amount,
    TRY_CURRENCY_ID,
    payment.value,
    outcome,
  );
  const succeeded = outcome === PAYMENT_STATUS.successful;
  const mail = succeeded
    ? store.sentEmails.insert({
        message_id: ctx.rng.int(1_000_000, 9_999_999),
        status: 0,
      })
    : null;
  const buyer = store.users.find((user) =>
    sameEmail(user.email, person.value.email),
  );
  const honoree =
    input.string("delivery_to_name") ??
    `${person.value.first_name} ${person.value.last_name}`.trim();
  const message =
    input.string("custom_message") ?? "Adınıza burs fonuna bağış yapıldı.";
  const base = `${ctx.org.info.url}/media/sertifika/${transaction.id}`;
  const sale = store.ecardTransactions.insert({
    user_id: buyer?.id ?? null,
    first_name: person.value.first_name,
    last_name: person.value.last_name,
    email: person.value.email,
    phone: person.value.phone,
    cargo_status: ecard.has_cargo && succeeded ? 1 : 0,
    cargo_number: "",
    cargo_company: "",
    recipient_count: recipients,
    certificate_file: `${base}.pdf`,
    zip_file: recipients > 1 ? `${base}.zip` : "",
    certificate_id: ecard.id,
    sent_mail_id: mail?.id ?? null,
    sent_mail_to_referring_id: null,
    added_by_id: null,
    delivery_time_mode: delivery.value.mode,
    delivery_date:
      delivery.value.mode === 0 ? null : (delivery.value.dates[0] ?? null),
    news_via_phone: false,
    news_via_sms: false,
    news_via_email: true,
    recipient_list: delivery.value.dates.map((date, index) => ({
      index,
      name: index === 0 ? honoree : `Alıcı ${index + 1}`,
      email: `alici${transaction.id}-${index}@eposta.example`,
      phone: "",
      address: "",
      city: "",
      district: "",
      custom_message: message,
      ecard_date: istanbulDate(now),
      delivery_date: date,
      cargo_number: "",
      cargo_company: "",
      cargo_status: 0,
      file: `${base}-${index}.pdf`,
      mail_message_id: mail?.message_id ?? 0,
      sent_mail_id: mail?.id ?? 0,
      mail_status: 0,
    })),
    bill_type: 0,
    billing_name: "",
    tax_info: "",
    billing_address: "",
    billing_district: "",
    billing_city: "",
    address: "",
    city: "",
    district: "",
    referring: false,
    third_name: "",
    referring_name: "",
    referring_phone: "",
    referring_email: "",
    language: "tr",
    donor_type: 1,
    delivery_to: 0,
    delivery_to_name: honoree,
    custom_message: message,
    has_cargo: ecard.has_cargo,
    deliver_as_mail: true,
    deliver_as_cargo: ecard.has_cargo,
    ecard_date: istanbulDate(now),
    updated_by_id: null,
    last_update_date: istanbulDateTime(now),
    transaction_id: transaction.id,
    marketing_channel_id: channelId,
  });
  ctx.webhooks.emit(
    {
      operation: WEBHOOK_OPERATIONS.ecardSale,
      status: succeeded ? OUTCOME_STATUS.successful : OUTCOME_STATUS.error,
    },
    sale.id,
  );
  return {
    ok: true,
    body: { sale_id: sale.id, transaction_id: transaction.id },
  };
}

function refundEcard(
  input: SimulationInput,
  ctx: SimulationContext,
): SimulationResult {
  const { store } = ctx;
  const saleId = input.number("sale_id");
  if (saleId === undefined) return invalid("sale_id is required");
  const refundedBy = input.number("refunded_by_id") ?? null;
  const sale = store.ecardTransactions.get(saleId);
  if (!sale) return missing(`e-card transaction ${saleId} not found`);
  if (refundedBy !== null && !store.users.get(refundedBy)) {
    return missing(`user ${refundedBy} not found`);
  }
  const transaction = store.transactions.get(sale.transaction_id);
  const refunded =
    transaction &&
    refund(
      store,
      transaction,
      istanbulDateTime(ctx.clock.now()),
      input.string("reason") ?? "Bağışçının talebi üzerine iade edildi",
      refundedBy,
    );
  if (!refunded) {
    return conflict(
      `e-card transaction ${saleId} has no successful payment to refund`,
    );
  }
  ctx.webhooks.emit(
    {
      operation: WEBHOOK_OPERATIONS.ecardSale,
      status: OUTCOME_STATUS.refunded,
    },
    sale.id,
  );
  return { ok: true, body: { sale_id: sale.id, transaction_id: refunded.id } };
}

export const simulations: SimulationFragment = {
  "form-answer": {
    description:
      "Someone answers a form on the public site (FORM webhook, status 3, or 5 when its payment fails). A new email becomes a new contact; a new contact whose phone matches an existing one is queued as its pending duplicate.",
    input: {
      form_id: "integer, required",
      first_name: "string, required",
      last_name: "string",
      email: "string, required",
      phone: "string",
      payment_method: "0 (card, default) or 2 (wire transfer), for a paid form",
      bank_account_id: "integer, required with payment_method 2",
      bin_number: "string of 6 digits, for a card payment",
      payment_status: "3 (default) or 5 (the payment fails)",
    },
    run: submitForm,
  },
  "ecard-sale": {
    description:
      "Someone buys an e-card on the public site (CERTIFICATE_SALE webhook, status 3, or 5 when the payment fails).",
    input: {
      ecard_id: "integer, required",
      first_name: "string, required",
      last_name: "string",
      email: "string, required",
      phone: "string",
      recipient_count: "integer, default 1",
      amount: "number, default the card's first amount per recipient",
      payment_method: "0 (card, default) or 2 (wire transfer)",
      bank_account_id: "integer, required with payment_method 2",
      bin_number: "string of 6 digits, for a card payment",
      payment_status: "3 (default) or 5 (the payment fails)",
      delivery_time_mode:
        "0 (now, default), 1 (one date) or 2 (a date per recipient)",
      delivery_date: "YYYY-MM-DD, required with delivery_time_mode 1 or 2",
      delivery_to_name: "string",
      custom_message: "string",
      marketing_channel_id: "integer",
    },
    run: sellEcard,
  },
  "ecard-refund": {
    description:
      "An e-card sale is refunded outside the API, in the console or by the payment provider (CERTIFICATE_SALE webhook, status 4).",
    input: {
      sale_id: "integer, required",
      reason: "string",
      refunded_by_id: "integer, the console user who refunded",
    },
    run: refundEcard,
  },
};
