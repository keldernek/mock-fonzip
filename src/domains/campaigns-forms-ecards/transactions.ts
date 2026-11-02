import type { Organisation } from "../../auth/tenancy";
import type { Clock } from "../../core/clock";
import type { Rng } from "../../core/rng";
import { istanbulDateTime } from "../../seed/dates";
import type { Row } from "../../store/collection";
import { transactionDetail } from "../../store/joins";
import type { TransactionRecord } from "../../store/records";
import {
  PAYMENT_ERRORS,
  PAYMENT_STATUS,
  PAYMENT_STATUS_DISPLAY,
} from "../../store/reference";
import type { OrgStore } from "../../store/store";
import { conversationId, originOf } from "../../store/transactions";

type Transaction = Row<TransactionRecord>;

export function toTransaction(store: OrgStore, transaction: Transaction) {
  return transactionDetail(store, transaction);
}

export type PaymentOutcome =
  | typeof PAYMENT_STATUS.successful
  | typeof PAYMENT_STATUS.failed;

export type Payment =
  | {
      readonly method: 0;
      readonly paymentSettingsId: number;
      readonly binNumber: string;
    }
  | { readonly method: 2; readonly bankAccountId: number };

interface PaymentContext {
  readonly org: Organisation;
  readonly store: OrgStore;
  readonly rng: Rng;
  readonly clock: Clock;
}

// `type` is what the transaction pays for, one of `TRANSACTION_TYPE`.
export function recordPayment(
  { org, store, rng, clock }: PaymentContext,
  amount: number,
  currencyId: number,
  payment: Payment,
  outcome: PaymentOutcome,
  type: number,
): Transaction {
  const card = payment.method === 0;
  const error =
    outcome === PAYMENT_STATUS.failed
      ? rng.pickFrom(PAYMENT_ERRORS)
      : undefined;
  const succeeded = outcome === PAYMENT_STATUS.successful;
  const conversation = rng.int(10_000_000, 99_999_999);
  const ip = `85.${rng.int(96, 111)}.${rng.int(0, 255)}.${rng.int(1, 254)}`;
  return store.transactions.insert({
    conversation_id: conversationId(conversation),
    association_id: org.info.id,
    complete_date: istanbulDateTime(clock.now()),
    amount,
    currency_id: currencyId,
    installment_count: 1,
    installment_amount: amount,
    ip_address: ip,
    ...originOf(ip),
    payment_status: outcome,
    payment_status_display: PAYMENT_STATUS_DISPLAY[outcome],
    error_code: error?.code ?? null,
    error_text: error?.text ?? null,
    error_group: error?.group ?? null,
    refund_date: null,
    refunded_by_id: null,
    refund_reason: null,
    fonzip_id: `FZ${rng.digits(10)}`,
    fonzip_id_hashed: rng.hex(32),
    transaction_id: card ? rng.digits(12) : "",
    provision_no: card && succeeded ? rng.digits(6) : null,
    receipt_no: `MKB-${rng.digits(8)}`,
    auth_code: card && succeeded ? rng.digits(6) : null,
    reference_id: rng.hex(16),
    order_id: `ORD-${rng.digits(9)}`,
    payment_settings_id: card ? payment.paymentSettingsId : null,
    bank_account_id: card ? null : payment.bankAccountId,
    payment_method: payment.method,
    fonzip_framework: card,
    bin_number: card ? payment.binNumber : null,
    last_four: card ? rng.digits(4) : null,
    cardholder_name: null,
    tds: card,
    transaction_type: type,
  });
}

export function refund(
  store: OrgStore,
  transaction: Transaction,
  at: string,
  reason: string,
  refundedBy: number | null,
): Transaction | undefined {
  if (transaction.payment_status !== PAYMENT_STATUS.successful)
    return undefined;
  return store.transactions.update(transaction.id, {
    payment_status: PAYMENT_STATUS.refunded,
    payment_status_display: PAYMENT_STATUS_DISPLAY[PAYMENT_STATUS.refunded],
    refund_date: at,
    refund_reason: reason,
    refunded_by_id: refundedBy,
  });
}
