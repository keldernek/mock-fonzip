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

// The store keeps an empty string for "none". Production answers null.
export function blankAsNull(value: string | null | undefined): string | null {
  return value === undefined || value === null || value === "" ? null : value;
}

// Production sends every key of a user reference and answers null for a
// contact detail the user does not have. The mock stores no tax department.
export function userReference(
  user: Row<UserRecord>,
): components["schemas"]["UserReference"] {
  return {
    id: user.id,
    email: blankAsNull(user.email),
    phone: blankAsNull(user.phone),
    name: fullName(user),
    first_name: user.first_name,
    last_name: user.last_name,
    tckno: blankAsNull(user.tckno),
    profile_pic: user.profile_pic,
    corporate_type: user.corporate_type,
    membership_no: user.membership_no,
    tax_department: null,
    total_financial: user.total_financial,
  };
}

export function userName(
  db: OrgStore,
  userId: number | null,
): string | undefined {
  const user = userId === null ? undefined : db.users.get(userId);
  return user ? fullName(user) : undefined;
}

export function userDefinedValues(
  user: Pick<UserRecord, "user_defined_values">,
): Record<string, string | number | boolean | string[]> {
  const values: Record<string, string | number | boolean | string[]> = {};
  for (const [key, value] of Object.entries(user.user_defined_values)) {
    if (value === null) continue;
    values[key] = typeof value === "object" ? [...value] : value;
  }
  return values;
}

export function present<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

// The `Transaction` object that donation, micro donation, dues, debt, ticket
// sale and form answer details embed. Production sends every key of it and
// answers null for the ones a payment does not have, so the nullable keys are
// never left out.
export function transactionDetail(
  db: OrgStore,
  transaction: Row<TransactionRecord>,
): components["schemas"]["Transaction"] {
  const settings =
    transaction.payment_settings_id === null
      ? undefined
      : db.paymentSettings.get(transaction.payment_settings_id);
  const account =
    transaction.bank_account_id === null
      ? undefined
      : db.bankAccounts.get(transaction.bank_account_id);
  return {
    id: transaction.id,
    conversation_id: transaction.conversation_id,
    association_id: transaction.association_id,
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
    refund_date: transaction.refund_date,
    fonzip_id: transaction.fonzip_id,
    fonzip_id_hashed: transaction.fonzip_id_hashed,
    transaction_id: transaction.transaction_id,
    provision_no: transaction.provision_no,
    receipt_no: transaction.receipt_no,
    auth_code: transaction.auth_code,
    reference_id: transaction.reference_id,
    order_id: transaction.order_id,
    payment_settings_id: transaction.payment_settings_id,
    payment_settings: settings
      ? {
          id: settings.id,
          name: settings.name,
          provider_no: settings.provider_no,
          status: settings.status,
          business_account: settings.business_account,
        }
      : null,
    bank_account_id: transaction.bank_account_id,
    bank_account: account
      ? {
          id: account.id,
          name: account.name,
          currency_id: account.currency_id,
        }
      : null,
    payment_method: transaction.payment_method,
    refunded_by_id: transaction.refunded_by_id,
    refunded_by__name: userName(db, transaction.refunded_by_id),
    refund_reason: transaction.refund_reason,
    fonzip_framework: transaction.fonzip_framework,
    bin_number: transaction.bin_number,
    last_four: transaction.last_four,
    cardholder_name: transaction.cardholder_name,
    city: transaction.city,
    country: transaction.country,
    tds: transaction.tds,
    transaction_type: transaction.transaction_type,
  };
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
    transaction__payment_method: present(transaction.payment_method),
    transaction__fonzip_framework: transaction.fonzip_framework,
    transaction__fonzip_id: transaction.fonzip_id,
    transaction__fonzip_id_hashed: transaction.fonzip_id_hashed,
    transaction__transaction_id: present(transaction.transaction_id),
    transaction__provision_no: present(transaction.provision_no),
    transaction__auth_code: present(transaction.auth_code),
    transaction__reference_id: present(transaction.reference_id),
    transaction__ip_address: present(transaction.ip_address),
    transaction__receipt_no: present(transaction.receipt_no),
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
