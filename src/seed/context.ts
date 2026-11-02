import { ORGANISATIONS } from "../auth/tenancy";
import type { Rng } from "../core/rng";
import type { Row } from "../store/collection";
import type { PaymentMethod, TransactionRecord } from "../store/records";
import {
  PAYMENT_ERRORS,
  PAYMENT_STATUS_DISPLAY,
  TRY_CURRENCY_ID,
  type PaymentStatus,
} from "../store/reference";
import type { OrgStore } from "../store/store";
import { conversationId, originOf } from "../store/transactions";
import { istanbulDateTime } from "./dates";

export interface SeedContext {
  readonly db: OrgStore;
  readonly rng: Rng;
  readonly selfOrigin: string;
  readonly adminIds: readonly [number, ...number[]];
}

export interface PaymentSpec {
  readonly amount: number;
  readonly at: Date;
  readonly status: PaymentStatus;
  // Null for a debt nobody has paid yet: it has no method, no paying address
  // and no receipt.
  readonly method: PaymentMethod | null;
  readonly currencyId?: number;
  readonly paymentSettingsId: number | null;
  readonly bankAccountId: number | null;
  readonly installments?: number;
  // What the transaction pays for, one of `TRANSACTION_TYPE`.
  readonly type: number;
  // A payment an admin recorded by hand outside the card gateway: it has no
  // gateway order or reference, and a transfer or POS slip carries the bank's
  // transaction id.
  readonly byHand?: boolean;
}

// Every seeded organisation is `kelder`.
const ASSOCIATION_ID = ORGANISATIONS.kelder.info.id;

export function createTransaction(
  ctx: SeedContext,
  spec: PaymentSpec,
): Row<TransactionRecord> {
  const { rng } = ctx;
  const card = spec.method === 0;
  const pending = spec.method === null;
  const byHand = pending || spec.byHand === true;
  const error = spec.status === 5 ? rng.pickFrom(PAYMENT_ERRORS) : undefined;
  const refunded = spec.status === 4;
  const installments = spec.installments ?? 1;
  // The draws run in the order the record was always built in, and every one
  // of them runs whatever the record keeps, so no other seeded value moves.
  const conversation = rng.int(10_000_000, 99_999_999);
  const ip = `85.${rng.int(96, 111)}.${rng.int(0, 255)}.${rng.int(1, 254)}`;
  const fonzipDigits = rng.digits(10);
  const fonzipHash = rng.hex(32);
  const cardTransactionId = card ? `${rng.digits(12)}` : "";
  const provision = card && spec.status !== 5 ? rng.digits(6) : null;
  const receipt = `MKB-${rng.digits(8)}`;
  const authCode = card && spec.status !== 5 ? rng.digits(6) : null;
  const reference = rng.hex(16);
  const order = `ORD-${rng.digits(9)}`;
  const bin = card ? rng.pick(["454360", "540667", "979203", "402277"]) : null;
  const lastFour = card ? rng.digits(4) : null;
  const bankSlip = spec.method === 2 || spec.method === 3;
  return ctx.db.transactions.insert({
    conversation_id: conversationId(conversation),
    association_id: ASSOCIATION_ID,
    complete_date: istanbulDateTime(spec.at),
    amount: spec.amount,
    currency_id: spec.currencyId ?? TRY_CURRENCY_ID,
    installment_count: installments,
    installment_amount: Math.round((spec.amount / installments) * 100) / 100,
    ip_address: pending ? null : ip,
    ...originOf(pending ? null : ip),
    payment_status: spec.status,
    payment_status_display: PAYMENT_STATUS_DISPLAY[spec.status],
    error_code: error?.code ?? null,
    error_text: error?.text ?? null,
    error_group: error?.group ?? null,
    refund_date: refunded
      ? istanbulDateTime(new Date(spec.at.getTime() + 3 * 86_400_000))
      : null,
    refunded_by_id: refunded ? ctx.adminIds[0] : null,
    refund_reason: refunded ? "Bağışçının talebi üzerine iade edildi" : null,
    fonzip_id: `FZ${fonzipDigits}`,
    fonzip_id_hashed: fonzipHash,
    transaction_id: !byHand
      ? cardTransactionId
      : bankSlip
        ? fonzipDigits
        : null,
    provision_no: provision,
    receipt_no: pending ? null : receipt,
    auth_code: authCode,
    reference_id: byHand ? null : reference,
    order_id: byHand ? null : order,
    payment_settings_id: spec.paymentSettingsId,
    bank_account_id: spec.bankAccountId,
    payment_method: spec.method,
    fonzip_framework: card,
    bin_number: bin,
    last_four: lastFour,
    cardholder_name: null,
    tds: card,
    transaction_type: spec.type,
  });
}

export function weightedStatus(
  rng: Rng,
  refundRate = 0.08,
  failRate = 0.07,
): PaymentStatus {
  const roll = rng.next();
  if (roll < failRate) return 5;
  if (roll < failRate + refundRate) return 4;
  return 3;
}

export function tryAmount(rng: Rng): number {
  return rng.pick([
    50, 100, 150, 200, 250, 300, 500, 750, 1000, 1500, 2500, 5000,
  ]);
}
