import type { HandlerContext } from "../../api/handler";
import { istanbulDate, istanbulDateTime } from "../../seed/dates";
import type { Row } from "../../store/collection";
import type {
  DonationRecord,
  PaymentMethod,
  TransactionRecord,
  UserRecord,
} from "../../store/records";
import {
  currencyById,
  PAYMENT_ERRORS,
  PAYMENT_STATUS,
  PAYMENT_STATUS_DISPLAY,
  type PaymentStatus,
} from "../../store/reference";
import type { OrgStore } from "../../store/store";
import {
  conversationId,
  originOf,
  TRANSACTION_TYPE,
} from "../../store/transactions";

export type GivingContext = Pick<
  HandlerContext,
  "org" | "store" | "rng" | "clock" | "webhooks"
>;

export type PaymentError = (typeof PAYMENT_ERRORS)[number];

interface CardUsed {
  readonly bin: string;
  readonly lastFour: string;
}

interface PaymentDraft {
  readonly amount: number;
  readonly currencyId: number;
  readonly completeDate: string;
  readonly status: PaymentStatus;
  readonly method: PaymentMethod;
  readonly paymentSettingsId: number | null;
  readonly bankAccountId: number | null;
  readonly card: CardUsed | null;
  readonly error: PaymentError | null;
  readonly bankTransactionId: string;
  readonly receiptNo: string;
  readonly ipAddress: string;
}

const PAYMENT_STATUSES: readonly PaymentStatus[] =
  Object.values(PAYMENT_STATUS);

export function paymentStatusOf(transaction: TransactionRecord): PaymentStatus {
  const status = PAYMENT_STATUSES.find(
    (candidate) => candidate === transaction.payment_status,
  );
  if (status === undefined) {
    throw new Error(`unknown payment status ${transaction.payment_status}`);
  }
  return status;
}

export function transactionOf(
  store: OrgStore,
  donation: DonationRecord,
): Row<TransactionRecord> {
  const transaction = store.transactions.get(donation.transaction_id);
  if (!transaction) {
    throw new Error(`transaction ${donation.transaction_id} is missing`);
  }
  return transaction;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function recordPayment(
  { org, store, rng }: GivingContext,
  draft: PaymentDraft,
): Row<TransactionRecord> {
  const charged = draft.card !== null && draft.status !== 5;
  return store.transactions.insert({
    conversation_id: conversationId(rng.int(10_000_000, 99_999_999)),
    association_id: org.info.id,
    complete_date: draft.completeDate,
    amount: draft.amount,
    currency_id: draft.currencyId,
    installment_count: 1,
    installment_amount: draft.amount,
    ip_address: draft.ipAddress,
    ...originOf(draft.ipAddress),
    payment_status: draft.status,
    payment_status_display: PAYMENT_STATUS_DISPLAY[draft.status],
    error_code: draft.error?.code ?? null,
    error_text: draft.error?.text ?? null,
    error_group: draft.error?.group ?? null,
    refund_date: null,
    refunded_by_id: null,
    refund_reason: null,
    fonzip_id: `FZ${rng.digits(10)}`,
    fonzip_id_hashed: rng.hex(32),
    transaction_id: draft.bankTransactionId,
    provision_no: charged ? rng.digits(6) : null,
    receipt_no: draft.receiptNo,
    auth_code: charged ? rng.digits(6) : null,
    reference_id: rng.hex(16),
    order_id: `ORD-${rng.digits(9)}`,
    payment_settings_id: draft.paymentSettingsId,
    bank_account_id: draft.bankAccountId,
    payment_method: draft.method,
    fonzip_framework: draft.card !== null,
    bin_number: draft.card?.bin ?? null,
    last_four: draft.card?.lastFour ?? null,
    cardholder_name: null,
    tds: draft.card !== null,
    transaction_type: TRANSACTION_TYPE.donation,
  });
}

function adjustTotal(
  store: OrgStore,
  userId: number,
  transaction: TransactionRecord,
  sign: 1 | -1,
): void {
  const user = store.users.get(userId);
  if (!user) return;
  const value =
    transaction.amount * currencyById(transaction.currency_id).value * sign;
  store.users.update(userId, {
    total_financial: roundMoney(user.total_financial + value),
  });
}

export function debitDonor(
  store: OrgStore,
  donation: DonationRecord,
  transaction: TransactionRecord,
): void {
  adjustTotal(store, donation.user_id, transaction, -1);
}

type DonationFields = Omit<DonationRecord, "id" | "user_id" | "transaction_id">;

export function singleDonation(
  donor: UserRecord,
  updatedAt: string,
): DonationFields {
  return {
    recurring_status: 0,
    d_type: 0,
    email: donor.email,
    details: "",
    name: `${donor.first_name} ${donor.last_name}`.trim(),
    address: donor.address,
    city: donor.city_text,
    district: donor.district_text,
    sub_donation_type_id: null,
    birthday: donor.birthday,
    sent_mail_id: null,
    sent_mail_to_referring_id: null,
    fundraising_campaign_id: null,
    tckno: donor.tckno,
    phone: donor.phone,
    fundraising_page_id: null,
    module_id: null,
    added_by_id: null,
    f2f_group_id: null,
    recurring_order_id: null,
    recurring_withdraw_count: 0,
    recurring_total_withdraw_count: 0,
    recurring_total_withdraw_amount: 0,
    api_tracking_id: null,
    news_via_phone: false,
    news_via_sms: false,
    news_via_email: false,
    application_id: null,
    donor_type: donor.corporate_type ? "corporate" : "personal",
    amount_visible: true,
    name_hidden: false,
    message: null,
    show_message: false,
    referring_name: "",
    referring_email: "",
    referring_phone: "",
    updated_by_id: null,
    last_update_date: updatedAt,
    recurring_cancel_reason: null,
    recurring_cancel_date: null,
    recurring_start_date: null,
    cancelled_by_id: null,
    recurring_limit: null,
    recurring_withdrawal: false,
    recurring_next_amount: null,
    recurring_error: null,
    recurring_next_cycle: null,
    recurring_last_success_withdrawal_date: null,
    referring: false,
    referring_address: "",
    referring_city: "",
    referring_district: "",
    custom_parameters: {},
    thanks_mail_id: null,
    marketing_channel_id: null,
    card_info_id: null,
    monthly_donation_id: null,
  };
}

interface RecordedDonation {
  readonly donation: Row<DonationRecord>;
  readonly transaction: Row<TransactionRecord>;
}

function emitOutcome(
  ctx: GivingContext,
  status: PaymentStatus,
  donationId: number,
): void {
  if (status === 3 || status === 4 || status === 5) {
    ctx.webhooks.emit({ operation: 1, status }, donationId);
  }
}

export function recordDonation(
  ctx: GivingContext,
  donor: Row<UserRecord>,
  payment: PaymentDraft,
  fields: DonationFields,
): RecordedDonation {
  const { store } = ctx;
  const transaction = recordPayment(ctx, payment);
  const donation = store.donations.insert({
    ...fields,
    user_id: donor.id,
    transaction_id: transaction.id,
  });
  if (payment.status === 3) {
    adjustTotal(store, donor.id, transaction, 1);
    store.timeline.insert({
      user_id: donor.id,
      details: "Bağış yaptı",
      event_time: transaction.complete_date,
      event_type: donation.monthly_donation_id === null ? 5 : 6,
      tag_id: null,
      custom_date: false,
      lead_type: null,
      outcome: null,
      sequence_no: null,
      is_first_touch: null,
      amount: transaction.amount,
      issuer_id: null,
      currency_id: transaction.currency_id,
      added_by_id: donation.added_by_id,
      calendar_event: null,
    });
  }
  emitOutcome(ctx, payment.status, donation.id);
  return { donation, transaction };
}

export function refundDonation(
  ctx: GivingContext,
  donation: Row<DonationRecord>,
  reason: string,
  refundedById: number | null,
): void {
  const transaction = transactionOf(ctx.store, donation);
  ctx.store.transactions.update(transaction.id, {
    payment_status: 4,
    payment_status_display: PAYMENT_STATUS_DISPLAY[4],
    refund_date: istanbulDateTime(ctx.clock.now()),
    refund_reason: reason,
    refunded_by_id: refundedById,
  });
  debitDonor(ctx.store, donation, transaction);
  emitOutcome(ctx, 4, donation.id);
}

export function today(ctx: Pick<GivingContext, "clock">): string {
  return istanbulDate(ctx.clock.now());
}

export function now(ctx: Pick<GivingContext, "clock">): string {
  return istanbulDateTime(ctx.clock.now());
}
