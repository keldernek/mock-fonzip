import type { Clock } from "../../core/clock";
import type { Rng } from "../../core/rng";
import { istanbulDateTime } from "../../seed/dates";
import type { Row } from "../../store/collection";
import { present, userName } from "../../store/joins";
import type { TransactionRecord } from "../../store/records";
import {
  currencyById,
  PAYMENT_ERRORS,
  PAYMENT_STATUS,
  PAYMENT_STATUS_DISPLAY,
} from "../../store/reference";
import type { OrgStore } from "../../store/store";

type Transaction = Row<TransactionRecord>;

export function toTransaction(store: OrgStore, transaction: Transaction) {
  const settings =
    transaction.payment_settings_id === null
      ? undefined
      : store.paymentSettings.get(transaction.payment_settings_id);
  const account =
    transaction.bank_account_id === null
      ? undefined
      : store.bankAccounts.get(transaction.bank_account_id);
  return {
    id: transaction.id,
    conversation_id: transaction.conversation_id,
    complete_date: transaction.complete_date,
    amount: transaction.amount,
    currency: currencyById(transaction.currency_id),
    installment_count: transaction.installment_count,
    installment_amount: transaction.installment_amount,
    ip_address: transaction.ip_address,
    payment_status: transaction.payment_status,
    payment_status_display: transaction.payment_status_display,
    error_code: present(transaction.error_code),
    error_text: present(transaction.error_text),
    refund_date: present(transaction.refund_date),
    fonzip_id: transaction.fonzip_id,
    fonzip_id_hashed: transaction.fonzip_id_hashed,
    transaction_id: transaction.transaction_id,
    provision_no: present(transaction.provision_no),
    receipt_no: transaction.receipt_no,
    auth_code: present(transaction.auth_code),
    reference_id: transaction.reference_id,
    order_id: transaction.order_id,
    payment_settings_id: present(transaction.payment_settings_id),
    payment_settings: settings && {
      id: settings.id,
      name: settings.name,
      provider_no: settings.provider_no,
      status: settings.status,
      business_account: settings.business_account,
    },
    bank_account_id: present(transaction.bank_account_id),
    bank_account: account && {
      id: account.id,
      name: account.name,
      currency_id: account.currency_id,
    },
    payment_method: transaction.payment_method,
    refunded_by_id: present(transaction.refunded_by_id),
    refunded_by__name: userName(store, transaction.refunded_by_id),
    refund_reason: present(transaction.refund_reason),
    fonzip_framework: transaction.fonzip_framework,
    bin_number: present(transaction.bin_number),
    last_four: present(transaction.last_four),
  };
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

export interface PaymentContext {
  readonly store: OrgStore;
  readonly rng: Rng;
  readonly clock: Clock;
}

export function recordPayment(
  { store, rng, clock }: PaymentContext,
  amount: number,
  currencyId: number,
  payment: Payment,
  outcome: PaymentOutcome,
): Transaction {
  const card = payment.method === 0;
  const error =
    outcome === PAYMENT_STATUS.failed
      ? rng.pickFrom(PAYMENT_ERRORS)
      : undefined;
  const succeeded = outcome === PAYMENT_STATUS.successful;
  return store.transactions.insert({
    conversation_id: rng.int(10_000_000, 99_999_999),
    complete_date: istanbulDateTime(clock.now()),
    amount,
    currency_id: currencyId,
    installment_count: 1,
    installment_amount: amount,
    ip_address: `85.${rng.int(96, 111)}.${rng.int(0, 255)}.${rng.int(1, 254)}`,
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
