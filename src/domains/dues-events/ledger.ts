import type { Rng } from "../../core/rng";
import { istanbulDateTime } from "../../seed/dates";
import { unmatchBankTransfers } from "../../store/bank-transfers";
import type { Row } from "../../store/collection";
import type {
  PaymentMethod,
  SubscriptionRecord,
  TransactionRecord,
  UserRecord,
} from "../../store/records";
import {
  currencyById,
  PAYMENT_ERRORS,
  PAYMENT_STATUS_DISPLAY,
  TRY_CURRENCY_ID,
} from "../../store/reference";
import type { OrgStore } from "../../store/store";

export type Subscription = Row<SubscriptionRecord>;
export type SubscriptionStatus = SubscriptionRecord["status"];

export const STATUS_NAME: Readonly<Record<SubscriptionStatus, string>> = {
  1: "Ödenmemiş Borç",
  2: "Ödeme",
  3: "İptal",
  4: "İade",
  6: "Silinmiş Borç",
  7: "Bakiye Düzeltme",
  8: "Ödenmiş Borç",
};

export function isDebt(row: Subscription): boolean {
  return row.status === 1 || row.status === 6 || row.status === 8;
}

function paymentCounts(store: OrgStore, row: Subscription): boolean {
  if (row.transaction_id === null) return true;
  const status = store.transactions.get(row.transaction_id)?.payment_status;
  return status === 3 || status === 4;
}

const BALANCE_EFFECT: Readonly<
  Record<SubscriptionStatus, (row: Subscription, store: OrgStore) => number>
> = {
  1: (row) => -row.amount,
  2: (row, store) => (paymentCounts(store, row) ? row.amount : 0),
  3: () => 0,
  4: (row) => -row.amount,
  6: () => 0,
  7: () => 0,
  8: (row) => -row.amount,
};

export function cents(value: number): number {
  return Math.round(value * 100) / 100;
}

function chronological(a: Subscription, b: Subscription): number {
  return (
    Date.parse(a.operation_date) - Date.parse(b.operation_date) || a.id - b.id
  );
}

function memberRows(store: OrgStore, userId: number): Subscription[] {
  return store.subscriptions
    .list((row) => row.user_id === userId)
    .sort(chronological);
}

export function rebalance(store: OrgStore, userId: number): void {
  let running = 0;
  for (const row of memberRows(store, userId)) {
    running = cents(running + BALANCE_EFFECT[row.status](row, store));
    if (row.balance !== running) {
      store.subscriptions.update(row.id, { balance: running });
    }
  }
}

export function memberBalance(store: OrgStore, userId: number): number {
  return cents(
    memberRows(store, userId).reduce(
      (sum, row) => sum + BALANCE_EFFECT[row.status](row, store),
      0,
    ),
  );
}

export function hasOpenDebt(store: OrgStore, userId: number): boolean {
  return (
    store.subscriptions.find(
      (row) => row.user_id === userId && row.status === 1,
    ) !== undefined
  );
}

function settleOpenDebts(store: OrgStore, userId: number): number[] {
  const rows = memberRows(store, userId);
  let credit = 0;
  for (const row of rows) {
    if (row.status === 2 && paymentCounts(store, row)) credit += row.amount;
    if (row.status === 4 || row.status === 8) credit -= row.amount;
  }
  const settled: number[] = [];
  for (const debt of rows.filter((row) => row.status === 1)) {
    if (cents(credit - debt.amount) < 0) break;
    credit -= debt.amount;
    store.subscriptions.update(debt.id, { status: 8, assignment_status: 2 });
    settled.push(debt.id);
  }
  return settled;
}

export function adjustTotalFinancial(
  store: OrgStore,
  userId: number,
  tx: Row<TransactionRecord>,
  sign: 1 | -1,
): void {
  const user = store.users.get(userId);
  if (!user) return;
  store.users.update(userId, {
    total_financial: cents(
      user.total_financial +
        sign * tx.amount * currencyById(tx.currency_id).value,
    ),
  });
}

export type TransactionSpec =
  | {
      readonly kind: "card";
      readonly amount: number;
      readonly outcome: "successful" | "failed";
      readonly paymentSettingsId: number | null;
      readonly installments: number;
    }
  | {
      readonly kind: "manual";
      readonly status: 0 | 3;
      readonly amount: number;
      readonly method: Exclude<PaymentMethod, 0>;
      readonly bankAccountId: number | null;
      readonly transactionId: string | undefined;
      readonly receiptNo: string | undefined;
    };

export function newTransaction(
  store: OrgStore,
  rng: Rng,
  at: Date,
  spec: TransactionSpec,
): Row<TransactionRecord> {
  const card = spec.kind === "card";
  const failed = card && spec.outcome === "failed";
  const status = card ? (failed ? 5 : 3) : spec.status;
  const error = failed ? rng.pickFrom(PAYMENT_ERRORS) : undefined;
  const installments = card ? spec.installments : 1;
  return store.transactions.insert({
    conversation_id: rng.int(10_000_000, 99_999_999),
    complete_date: istanbulDateTime(at),
    amount: spec.amount,
    currency_id: TRY_CURRENCY_ID,
    installment_count: installments,
    installment_amount: cents(spec.amount / installments),
    ip_address: card
      ? `85.${rng.int(96, 111)}.${rng.int(0, 255)}.${rng.int(1, 254)}`
      : "",
    payment_status: status,
    payment_status_display: PAYMENT_STATUS_DISPLAY[status],
    error_code: error?.code ?? null,
    error_text: error?.text ?? null,
    error_group: error?.group ?? null,
    refund_date: null,
    refunded_by_id: null,
    refund_reason: null,
    fonzip_id: `FZ${rng.digits(10)}`,
    fonzip_id_hashed: rng.hex(32),
    transaction_id: card ? rng.digits(12) : (spec.transactionId ?? ""),
    provision_no: card && !failed ? rng.digits(6) : null,
    receipt_no: card
      ? `MKB-${rng.digits(8)}`
      : (spec.receiptNo ?? `MKB-${rng.digits(8)}`),
    auth_code: card && !failed ? rng.digits(6) : null,
    reference_id: rng.hex(16),
    order_id: `ORD-${rng.digits(9)}`,
    payment_settings_id: card ? spec.paymentSettingsId : null,
    bank_account_id: card ? null : spec.bankAccountId,
    payment_method: card ? 0 : spec.method,
    fonzip_framework: card,
    bin_number: card
      ? rng.pick(["454360", "540667", "979203", "402277"])
      : null,
    last_four: card ? rng.digits(4) : null,
  });
}

export function refundTransaction(
  store: OrgStore,
  tx: Row<TransactionRecord>,
  at: Date,
  reason: string,
): void {
  store.transactions.update(tx.id, {
    payment_status: 4,
    payment_status_display: PAYMENT_STATUS_DISPLAY[4],
    refund_date: istanbulDateTime(at),
    refund_reason: reason,
    refunded_by_id: null,
  });
}

export function removeRecord(store: OrgStore, row: Subscription): void {
  store.subscriptions.remove(row.id);
  const tx =
    row.transaction_id === null
      ? undefined
      : store.transactions.get(row.transaction_id);
  if (tx && isDebt(row)) store.transactions.remove(tx.id);
  if (tx && row.status === 2) {
    for (const refund of store.subscriptions.list(
      (other) => other.status === 4 && other.transaction_id === tx.id,
    )) {
      store.subscriptions.remove(refund.id);
    }
    if (tx.payment_status === 3)
      adjustTotalFinancial(store, row.user_id, tx, -1);
  }
  unmatchBankTransfers(store, "matched_subscription_id", row.id);
  rebalance(store, row.user_id);
}

export function memberSnapshot(user: Row<UserRecord>) {
  return {
    user_id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    phone: user.phone,
    email: user.email,
    tckno: user.tckno,
  };
}

export interface PaymentRecord {
  readonly user: Row<UserRecord>;
  readonly tx: Row<TransactionRecord>;
  readonly at: Date;
  readonly details: string;
  readonly period: string;
  readonly billNo: string | null;
}

export function recordPayment(
  store: OrgStore,
  payment: PaymentRecord,
): { readonly payment: Subscription; readonly settled: readonly number[] } {
  const { user, tx, at } = payment;
  const successful = tx.payment_status === 3;
  const row = store.subscriptions.insert({
    ...memberSnapshot(user),
    status: 2,
    details: payment.details,
    remove_note: null,
    operation_date: istanbulDateTime(at),
    period: payment.period,
    balance: 0,
    amount: tx.amount,
    assignment_status: successful ? 1 : 0,
    card_info: tx.last_four === null ? "" : `**** ${tx.last_four}`,
    bill_no: payment.billNo,
    due_date: istanbulDateTime(at),
    recurring: false,
    recurring_amount: 0,
    recurring_period: 0,
    recurring_collection_period: 0,
    recurring_withdrawal: false,
    recurring_next_cycle: null,
    order_id: null,
    added_by_id: null,
    updated_by_id: null,
    create_date: istanbulDateTime(at),
    debt_category_id: null,
    transaction_id: tx.id,
  });
  const settled = successful ? settleOpenDebts(store, user.id) : [];
  if (settled.length > 0) {
    store.subscriptions.update(row.id, { assignment_status: 2 });
  }
  if (successful) adjustTotalFinancial(store, user.id, tx, 1);
  rebalance(store, user.id);
  return { payment: store.subscriptions.get(row.id) ?? row, settled };
}
