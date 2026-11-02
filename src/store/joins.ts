import type { components } from "../generated/openapi";
import type { Row } from "./collection";
import type { TransactionRecord, UserRecord } from "./records";
import { currencyById } from "./reference";
import type { OrgStore } from "./store";

export function nonEmpty(text: string): string | undefined {
  return text === "" ? undefined : text;
}

export function fullName(
  user: Pick<UserRecord, "first_name" | "last_name">,
): string {
  return `${user.first_name} ${user.last_name}`.trim();
}

export function userReference(
  user: Row<UserRecord>,
): components["schemas"]["UserReference"] {
  return {
    id: user.id,
    email: user.email === "" ? undefined : user.email,
    phone: user.phone,
    name: fullName(user),
    first_name: user.first_name,
    last_name: user.last_name,
    tckno: user.tckno,
    profile_pic: present(user.profile_pic),
    corporate_type: user.corporate_type,
    membership_no: user.membership_no,
  };
}

export function userName(
  db: OrgStore,
  userId: number | null,
): string | undefined {
  const user = userId === null ? undefined : db.users.get(userId);
  return user ? fullName(user) : undefined;
}

export function present<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

export function transactionJoin(
  db: OrgStore,
  transaction: Row<TransactionRecord>,
) {
  const currency = currencyById(transaction.currency_id);
  const settings =
    transaction.payment_settings_id === null
      ? undefined
      : db.paymentSettings.get(transaction.payment_settings_id);
  const account =
    transaction.bank_account_id === null
      ? undefined
      : db.bankAccounts.get(transaction.bank_account_id);
  return {
    transaction__amount: transaction.amount,
    transaction__complete_date: transaction.complete_date,
    transaction__currency__display: currency.display,
    transaction__currency__iso_code: currency.iso_code,
    transaction__payment_status: transaction.payment_status,
    transaction__payment_method: transaction.payment_method,
    transaction__fonzip_framework: transaction.fonzip_framework,
    transaction__fonzip_id: transaction.fonzip_id,
    transaction__fonzip_id_hashed: transaction.fonzip_id_hashed,
    transaction__transaction_id: transaction.transaction_id,
    transaction__provision_no: present(transaction.provision_no),
    transaction__auth_code: present(transaction.auth_code),
    transaction__reference_id: transaction.reference_id,
    transaction__ip_address: transaction.ip_address,
    transaction__receipt_no: transaction.receipt_no,
    transaction__bin_number: present(transaction.bin_number),
    transaction__last_four: present(transaction.last_four),
    transaction__refund_date: present(transaction.refund_date),
    transaction__refund_reason: present(transaction.refund_reason),
    transaction__refunded_by_id: present(transaction.refunded_by_id),
    transaction__refunded_by__name: userName(db, transaction.refunded_by_id),
    transaction__payment_settings_id: present(transaction.payment_settings_id),
    transaction__payment_settings__name: settings?.name,
    transaction__bank_account_id: present(transaction.bank_account_id),
    transaction__bank_account__name: account?.name,
    transaction__transaction_error__code: present(transaction.error_code),
    transaction__transaction_error__text: present(transaction.error_text),
    transaction__transaction_error__group: transaction.error_group,
  };
}
