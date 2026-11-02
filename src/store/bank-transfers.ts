import type { BankTransactionRecord } from "./records";
import type { OrgStore } from "./store";

type MatchedObject = keyof Pick<
  BankTransactionRecord,
  | "matched_donation_id"
  | "matched_subscription_id"
  | "matched_certificate_sale_id"
>;

export function unmatchBankTransfers(
  store: OrgStore,
  matched: MatchedObject,
  id: number,
): void {
  for (const transfer of store.bankTransactions.list(
    (row) => row[matched] === id,
  )) {
    store.bankTransactions.update(transfer.id, {
      payment_status: 8,
      transaction_type: null,
      matched_user_id: null,
      matched_donation_id: null,
      matched_subscription_id: null,
      matched_certificate_sale_id: null,
    });
  }
}
