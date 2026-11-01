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
  readonly method: PaymentMethod;
  readonly currencyId?: number;
  readonly paymentSettingsId: number | null;
  readonly bankAccountId: number | null;
  readonly installments?: number;
}

export function createTransaction(
  ctx: SeedContext,
  spec: PaymentSpec,
): Row<TransactionRecord> {
  const { rng } = ctx;
  const card = spec.method === 0;
  const error = spec.status === 5 ? rng.pickFrom(PAYMENT_ERRORS) : undefined;
  const refunded = spec.status === 4;
  const installments = spec.installments ?? 1;
  return ctx.db.transactions.insert({
    conversation_id: rng.int(10_000_000, 99_999_999),
    complete_date: istanbulDateTime(spec.at),
    amount: spec.amount,
    currency_id: spec.currencyId ?? TRY_CURRENCY_ID,
    installment_count: installments,
    installment_amount: Math.round((spec.amount / installments) * 100) / 100,
    ip_address: `85.${rng.int(96, 111)}.${rng.int(0, 255)}.${rng.int(1, 254)}`,
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
    fonzip_id: `FZ${rng.digits(10)}`,
    fonzip_id_hashed: rng.hex(32),
    transaction_id: card ? `${rng.digits(12)}` : "",
    provision_no: card && spec.status !== 5 ? rng.digits(6) : null,
    receipt_no: `MKB-${rng.digits(8)}`,
    auth_code: card && spec.status !== 5 ? rng.digits(6) : null,
    reference_id: rng.hex(16),
    order_id: `ORD-${rng.digits(9)}`,
    payment_settings_id: spec.paymentSettingsId,
    bank_account_id: spec.bankAccountId,
    payment_method: spec.method,
    fonzip_framework: card,
    bin_number: card
      ? rng.pick(["454360", "540667", "979203", "402277"])
      : null,
    last_four: card ? rng.digits(4) : null,
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
