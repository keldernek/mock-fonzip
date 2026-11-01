import { notFound } from "../../api/errors";
import type { Handler } from "../../api/handler";
import {
  inDateRange,
  matchesAmount,
  matchesQuery,
  paginate,
  parseDateRange,
} from "../../api/listing";
import type { Row } from "../../store/collection";
import { present, userName } from "../../store/joins";
import type { TransactionRecord } from "../../store/records";
import { currencyById } from "../../store/reference";
import type { OrgStore } from "../../store/store";
import {
  containsUnaccented,
  inPeriod,
  matchesDate,
  sameDigits,
  sortRows,
} from "./filters";
import { isDebt, removeRecord, STATUS_NAME, type Subscription } from "./ledger";
import {
  paymentStatus,
  toDebtCategory,
  toTransaction,
  toUserReference,
  transactionOf,
} from "./projections";

export function toMembershipDueDetails(store: OrgStore, row: Subscription) {
  const user = store.users.get(row.user_id);
  const tx = transactionOf(store, row.transaction_id);
  const category =
    row.debt_category_id === null
      ? undefined
      : store.debtCategories.get(row.debt_category_id);
  return {
    id: row.id,
    user_id: row.user_id,
    user: user && toUserReference(user),
    transaction: tx && toTransaction(store, tx),
    status: row.status,
    status_name: STATUS_NAME[row.status],
    details: row.details,
    remove_note: row.remove_note,
    debt_category: category ? toDebtCategory(category) : null,
    operation_date: row.operation_date,
    period: row.period,
    balance: row.balance,
    first_name: row.first_name,
    last_name: row.last_name,
    phone: row.phone,
    email: row.email,
    tckno: row.tckno,
    amount: row.amount,
    assignment_status: row.assignment_status,
    card_info: present(row.card_info),
    bill_no: present(row.bill_no),
    due_date: row.due_date,
    recurring: row.recurring,
    recurring_amount: row.recurring_amount,
    recurring_period: row.recurring_period,
    recurring_collection_period: row.recurring_collection_period,
    recurring_withdrawal: row.recurring_withdrawal,
    recurring_next_cycle: present(row.recurring_next_cycle),
    order_id: present(row.order_id),
    added_by_id: present(row.added_by_id),
    added_by__name: userName(store, row.added_by_id),
    updated_by_id: present(row.updated_by_id),
    updated_by__name: userName(store, row.updated_by_id),
  };
}

function toMembershipDues(
  store: OrgStore,
  row: Subscription,
  tx: Row<TransactionRecord>,
) {
  const currency = currencyById(tx.currency_id);
  return {
    id: row.id,
    user_id: row.user_id,
    user__name: userName(store, row.user_id),
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    details: row.details,
    period: row.period,
    tckno: row.tckno,
    transaction__fonzip_framework: tx.fonzip_framework,
    transaction__amount: tx.amount,
    transaction__complete_date: tx.complete_date,
    transaction__payment_status: paymentStatus(tx.payment_status),
    transaction__payment_method: tx.payment_method,
    transaction__currency__display: currency.display,
    transaction__currency__iso_code: currency.iso_code,
    transaction__fonzip_id: tx.fonzip_id,
    transaction__refund_date: present(tx.refund_date),
    transaction__transaction_error__code: present(tx.error_code),
    transaction__transaction_error__text: present(tx.error_text),
    transaction__transaction_error__group: tx.error_group,
  };
}

const LISTED_AS: Readonly<
  Record<
    "paid" | "refund" | "failed",
    (row: Subscription, tx: Row<TransactionRecord>) => boolean
  >
> = {
  paid: (row, tx) => row.status === 2 && tx.payment_status === 3,
  refund: (row) => row.status === 4,
  failed: (row, tx) => row.status === 2 && tx.payment_status === 5,
};

export function hasTag(store: OrgStore, userId: number, tagId?: number) {
  return (
    tagId === undefined ||
    store.userTags.find(
      (link) => link.user_id === userId && link.tag_id === tagId,
    ) !== undefined
  );
}

export const getMembershipDuesList: Handler<"getMembershipDuesList"> = (
  { query },
  { store },
) => {
  const range = parseDateRange(query.start_date, query.end_date);
  if ("error" in range) return { status: 400, body: { error: range.error } };
  const listed = LISTED_AS[query.status];
  const matching = store.subscriptions.list().flatMap((row) => {
    const tx = transactionOf(store, row.transaction_id);
    if (!tx || !listed(row, tx)) return [];
    const user = store.users.get(row.user_id);
    const name = userName(store, row.user_id);
    const keep =
      inDateRange(tx.complete_date, range) &&
      inPeriod(row.period, query.period_year, query.period_month) &&
      matchesAmount(tx.amount, query.amount, query.amt_cnd) &&
      sameDigits(tx.bin_number, query.bin_number) &&
      sameDigits(tx.last_four, query.last_four) &&
      (query.installment_count === undefined ||
        tx.installment_count === query.installment_count) &&
      hasTag(store, row.user_id, query.tag_id) &&
      (query.membership_no === undefined ||
        user?.membership_no === query.membership_no) &&
      (query.added_by_id === undefined ||
        row.added_by_id === query.added_by_id) &&
      (query.added_by__name === undefined ||
        containsUnaccented(
          query.added_by__name,
          userName(store, row.added_by_id),
        )) &&
      matchesDate(row.create_date, query.create_date, query.create_date_cnd) &&
      (query.payment_method === undefined ||
        tx.payment_method === query.payment_method) &&
      matchesQuery(query.query, [
        name,
        row.first_name,
        row.last_name,
        row.email,
        row.phone,
        row.tckno,
        row.details,
      ]);
    return keep ? [{ id: row.id, row, tx, name: name ?? "" }] : [];
  });
  const sorted = sortRows(
    matching,
    query.order_by ?? "-transaction__complete_date",
    {
      id: (item) => item.id,
      user__name: (item) => item.name,
      transaction__amount: (item) => item.tx.amount,
      transaction__complete_date: (item) => Date.parse(item.tx.complete_date),
    },
  );
  return {
    status: 200,
    body: {
      subscription_list: paginate(sorted, query).map((item) =>
        toMembershipDues(store, item.row, item.tx),
      ),
      total: sorted.length,
    },
  };
};

export const getMembershipDueDetails: Handler<"getMembershipDueDetails"> = (
  { path },
  { store },
) => {
  const row = store.subscriptions.get(path.subscription_id);
  if (!row) return notFound("Membership due");
  return {
    status: 200,
    body: { subscription: toMembershipDueDetails(store, row) },
  };
};

export const deleteMembershipDue: Handler<"deleteMembershipDue"> = (
  { path },
  { store },
) => {
  const row = store.subscriptions.get(path.subscription_id);
  if (!row) return notFound("Membership due");
  removeRecord(store, row);
  return { status: 200, body: { result: "ok" } };
};

const LISTING: Readonly<
  Record<"a" | "p" | "d" | "r", (row: Subscription) => boolean>
> = {
  a: () => true,
  p: (row) => row.status === 2,
  d: isDebt,
  r: (row) => row.status === 4,
};

export const getUsersMembershipDueList: Handler<"getUsersMembershipDueList"> = (
  { path, query },
  { store },
) => {
  if (!store.users.get(path.user_id)) return notFound("User");
  const listed = LISTING[query.listing ?? "a"];
  const rows = sortRows(
    store.subscriptions.list(
      (row) => row.user_id === path.user_id && listed(row),
    ),
    "-operation_date",
    { operation_date: (row) => Date.parse(row.operation_date) },
  );
  return {
    status: 200,
    body: {
      subscription_list: paginate(rows, query).map((row) => {
        const tx = transactionOf(store, row.transaction_id);
        const currency = tx && currencyById(tx.currency_id);
        return {
          id: row.id,
          status: row.status,
          recurring: row.recurring,
          recurring_amount: row.recurring_amount,
          transaction__fonzip_framework: tx?.fonzip_framework,
          details: row.details,
          bill_no: present(row.bill_no),
          period: row.period,
          due_date: row.due_date.slice(0, 10),
          amount: row.amount,
          operation_date: row.operation_date,
          balance: row.balance,
          transaction__currency__display: currency?.display,
          transaction__currency__iso_code: currency?.iso_code,
          transaction__fonzip_id: tx?.fonzip_id,
        };
      }),
      total: rows.length,
    },
  };
};
