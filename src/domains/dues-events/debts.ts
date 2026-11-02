import { notFound } from "../../api/errors";
import type { Handler, HandlerInput } from "../../api/handler";
import { matchesAmount, matchesQuery, paginate } from "../../api/listing";
import { addDays, istanbulDate, apiDateTime } from "../../seed/dates";
import type { Row } from "../../store/collection";
import { userName } from "../../store/joins";
import type { UserRecord } from "../../store/records";
import { TRY_CURRENCY_ID, currencyById } from "../../store/reference";
import type { OrgStore } from "../../store/store";
import { TRANSACTION_TYPE } from "../../store/transactions";
import { OUTCOME_STATUS, WEBHOOK_OPERATIONS } from "../../webhooks/emitter";
import { liveCategory } from "./debt-categories";
import { hasTag, toMembershipDueDetails } from "./dues";
import {
  containsUnaccented,
  inOptionalRange,
  inPeriod,
  matchesDate,
  optionalRange,
  sameDay,
  sortRows,
} from "./filters";
import { transactionOf } from "./projections";
import {
  debtOrderId,
  isDebt,
  memberBalance,
  memberSnapshot,
  newTransaction,
  rebalance,
  recordPayment,
  removeRecord,
  type Subscription,
} from "./ledger";
import { type Failure, invalid } from "./results";

function duplicateKey(row: Subscription): string {
  return `${row.user_id}|${row.period}|${row.amount}|${row.debt_category_id ?? ""}`;
}

function toDebtListItem(
  store: OrgStore,
  row: Subscription,
  user: Row<UserRecord>,
) {
  const category =
    row.debt_category_id === null
      ? undefined
      : store.debtCategories.get(row.debt_category_id);
  return {
    id: row.id,
    user_id: row.user_id,
    details: row.details,
    // A debt always has a period. Only a payment can lack one.
    period: row.period ?? istanbulDate(new Date(row.operation_date)),
    status: row.status,
    amount: row.amount,
    operation_date: row.operation_date,
    user__name: userName(store, row.user_id),
    user__total_financial: user.total_financial,
    user__membership_no: user.membership_no,
    create_date: row.create_date,
    added_by_id: row.added_by_id,
    added_by__name: userName(store, row.added_by_id) ?? null,
    debt_category_id: row.debt_category_id,
    debt_category__name: category?.name ?? null,
    remove_note: row.remove_note,
  };
}

export const getMembershipDueDebtsList: Handler<"getMembershipDueDebtsList"> = (
  { query },
  { store },
) => {
  const operated = optionalRange(
    ["start_date", "end_date"],
    query.start_date,
    query.end_date,
  );
  if (operated.kind === "error") return invalid(operated.error);
  const created = optionalRange(
    ["create_start_date", "create_end_date"],
    query.create_start_date,
    query.create_end_date,
  );
  if (created.kind === "error") return invalid(created.error);
  const debts = store.subscriptions.list(isDebt);
  const occurrences = new Map<string, number>();
  for (const row of debts) {
    const key = duplicateKey(row);
    occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
  }
  const categories = query.debt_category_id ?? [];
  const categoryFilter =
    categories.length > 0 || query.no_debt_category === true;
  const matching = debts.flatMap((row) => {
    const user = store.users.get(row.user_id);
    if (!user) return [];
    const keep =
      (query.status === undefined ||
        query.status === null ||
        row.status === query.status) &&
      inPeriod(row.period, query.period_year, query.period_month) &&
      matchesAmount(row.amount, query.amount, query.amt_cnd) &&
      sameDay(row.operation_date, query.operation_date) &&
      inOptionalRange(row.operation_date, operated) &&
      (query.membership_no === undefined ||
        user.membership_no === query.membership_no) &&
      hasTag(store, row.user_id, query.tag_id) &&
      (query.added_by_id === undefined ||
        row.added_by_id === query.added_by_id) &&
      (query.added_by__name === undefined ||
        containsUnaccented(
          query.added_by__name,
          userName(store, row.added_by_id),
        )) &&
      matchesDate(row.create_date, query.create_date, query.create_date_cnd) &&
      inOptionalRange(row.create_date, created) &&
      (query.possible_duplicate !== true ||
        (occurrences.get(duplicateKey(row)) ?? 0) > 1) &&
      (!categoryFilter ||
        (row.debt_category_id === null
          ? query.no_debt_category === true
          : categories.includes(row.debt_category_id))) &&
      matchesQuery(query.query, [
        userName(store, row.user_id),
        row.details,
        row.email,
        row.phone,
        row.tckno,
      ]);
    return keep ? [{ id: row.id, row, user }] : [];
  });
  const sorted = sortRows(matching, query.order_by ?? "-operation_date", {
    id: (item) => item.id,
    period: (item) => Date.parse(item.row.period ?? "") || 0,
    amount: (item) => item.row.amount,
    operation_date: (item) => Date.parse(item.row.operation_date),
    create_date: (item) => Date.parse(item.row.create_date),
  });
  return {
    status: 200,
    body: {
      debt_list: paginate(sorted, query).map((item) =>
        toDebtListItem(store, item.row, item.user),
      ),
      total: sorted.length,
    },
  };
};

function debtOf(store: OrgStore, debtId: number): Subscription | undefined {
  const row = store.subscriptions.get(debtId);
  return row && isDebt(row) ? row : undefined;
}

export const getDebtDetails: Handler<"getDebtDetails"> = (
  { path },
  { store },
) => {
  const row = debtOf(store, path.debt_id);
  if (!row) return notFound("Debt");
  return {
    status: 200,
    body: { subscription: toMembershipDueDetails(store, row) },
  };
};

type CreateDebtBody = HandlerInput<"createDebt">["body"];

function debtAmount(
  store: OrgStore,
  body: CreateDebtBody,
  user: Row<UserRecord>,
): number | Failure {
  if ((body.amount_type ?? "custom") === "custom") {
    return body.amount !== undefined && body.amount > 0
      ? body.amount
      : invalid("amount must be above 0");
  }
  const key = body.amount_udv_key;
  if (key === undefined) {
    return invalid("amount_udv_key is required for amount_type udv");
  }
  if (!store.userDefinedValues.find((field) => field.value === key)) {
    return notFound("User defined value");
  }
  const value = user.user_defined_values[key];
  return typeof value === "number" && value > 0
    ? value
    : invalid(`The member has no amount above 0 in ${key}`);
}

type PaymentPlan =
  | { readonly add: false }
  | {
      readonly add: true;
      readonly method: Exclude<CreateDebtBody["payment_method"], 0 | undefined>;
      readonly amount: "total_debt" | number;
      readonly bankAccountId: number | null;
    };

function paymentPlan(
  store: OrgStore,
  body: CreateDebtBody,
): PaymentPlan | Failure {
  if (body.add_payment !== true) return { add: false };
  if (body.payment_method_select === "card" || body.payment_method === 0) {
    return invalid("Card payments cannot be taken through the API");
  }
  const method = body.payment_method;
  if (method === undefined) {
    return invalid("payment_method is required with add_payment");
  }
  if (body.custom_amount === undefined) {
    return invalid("custom_amount is required with add_payment");
  }
  if (
    body.custom_amount === "custom" &&
    (body.amount === undefined || body.amount <= 0)
  ) {
    return invalid("amount must be above 0 for custom_amount custom");
  }
  const bankAccountId = body.bank_account_id ?? null;
  if (bankAccountId !== null && !store.bankAccounts.get(bankAccountId)) {
    return notFound("Bank account");
  }
  return {
    add: true,
    method,
    amount: body.custom_amount === "custom" ? (body.amount ?? 0) : "total_debt",
    bankAccountId,
  };
}

export const createDebt: Handler<"createDebt"> = (
  { body },
  { org, store, clock, rng, webhooks },
) => {
  if (body.user_id === undefined) return invalid("user_id is required");
  const user = store.users.get(body.user_id);
  if (!user) return notFound("User");
  const amount = debtAmount(store, body, user);
  if (typeof amount !== "number") return amount;
  const payment = paymentPlan(store, body);
  if ("status" in payment) return payment;
  if (body.send_mail === true && body.thanks_mail_id === undefined) {
    return invalid("thanks_mail_id is required with send_mail");
  }
  if (
    body.thanks_mail_id !== undefined &&
    !store.templates.get(body.thanks_mail_id)
  ) {
    return notFound("Template");
  }
  const categoryId = body.debt_category_id ?? null;
  if (categoryId !== null && !liveCategory(store, categoryId)) {
    return notFound("Debt category");
  }
  const now = clock.now();
  const at =
    body.operation_date === undefined ? now : new Date(body.operation_date);
  const period = body.period ?? istanbulDate(at);
  const recurring = body.recurring ?? false;
  const recurringPeriod = body.recurring_period ?? 0;
  // Nobody has paid the debt yet, so its transaction has no method.
  const debtTransaction = newTransaction(store, rng, at, {
    kind: "manual",
    status: 0,
    amount,
    method: null,
    bankAccountId: null,
    transactionId: undefined,
    receiptNo: undefined,
    associationId: org.info.id,
    type: TRANSACTION_TYPE.dues,
  });
  const debt = store.subscriptions.insert({
    ...memberSnapshot(user),
    status: 1,
    details: body.details ?? null,
    remove_note: null,
    operation_date: apiDateTime(at),
    period,
    balance: 0,
    amount,
    assignment_status: 0,
    card_info: null,
    bill_no: body.bill_no ?? null,
    due_date:
      body.due_date === undefined ? null : apiDateTime(new Date(body.due_date)),
    recurring,
    recurring_amount: recurring ? amount : 0,
    recurring_period: recurringPeriod,
    recurring_collection_period: 0,
    recurring_withdrawal: false,
    recurring_next_cycle:
      recurring && recurringPeriod > 0
        ? istanbulDate(addDays(at, recurringPeriod))
        : null,
    order_id: null,
    added_by_id: null,
    updated_by_id: null,
    create_date: apiDateTime(now),
    last_update_date: null,
    debt_category_id: categoryId,
    transaction_id: debtTransaction.id,
  });
  store.subscriptions.update(debt.id, {
    order_id: debtOrderId(user.id, debt.id),
  });
  rebalance(store, user.id);
  if (!payment.add) {
    return { status: 200, body: { result: "ok", debt_id: debt.id } };
  }
  const paid =
    payment.amount === "total_debt"
      ? -memberBalance(store, user.id)
      : payment.amount;
  if (paid <= 0) {
    return {
      status: 400,
      body: {
        error: "The member's balance already covers the debt, nothing to pay",
        debt_id: debt.id,
      },
    };
  }
  const tx = newTransaction(store, rng, at, {
    kind: "manual",
    status: 3,
    amount: paid,
    method: payment.method,
    bankAccountId: payment.bankAccountId,
    transactionId: body.transaction_id,
    receiptNo: body.receipt_no,
    associationId: org.info.id,
    type: TRANSACTION_TYPE.dues,
  });
  const recorded = recordPayment(store, {
    user,
    tx,
    at,
    details: body.details ?? null,
    period,
    billNo: body.bill_no ?? null,
  });
  webhooks.emit(
    {
      operation: WEBHOOK_OPERATIONS.subscription,
      status: OUTCOME_STATUS.successful,
    },
    recorded.payment.id,
  );
  return {
    status: 200,
    body: {
      result: "ok",
      debt_id: debt.id,
      subscription_id: recorded.payment.id,
      amount: tx.amount,
      currency: currencyById(TRY_CURRENCY_ID).iso_code,
    },
  };
};

export const updateDebt: Handler<"updateDebt"> = (
  { path, body },
  { org, store, clock, rng },
) => {
  const row = debtOf(store, path.debt_id);
  if (!row) return notFound("Debt");
  const amount = body.transaction?.amount;
  if (
    body.period === undefined ||
    body.operation_date === undefined ||
    body.due_date === undefined ||
    amount === undefined
  ) {
    return invalid(
      "period, operation_date, due_date and transaction.amount are required: the request replaces the debt",
    );
  }
  if (amount <= 0) return invalid("transaction.amount must be above 0");
  const categoryId =
    body.debt_category_id === undefined
      ? row.debt_category_id
      : body.debt_category_id;
  if (
    categoryId !== null &&
    categoryId !== row.debt_category_id &&
    !liveCategory(store, categoryId)
  ) {
    return notFound("Debt category");
  }
  const at = new Date(body.operation_date);
  const current = transactionOf(store, row.transaction_id);
  const tx =
    current ??
    newTransaction(store, rng, at, {
      kind: "manual",
      status: 0,
      amount,
      method: null,
      bankAccountId: null,
      transactionId: undefined,
      receiptNo: undefined,
      associationId: org.info.id,
      type: TRANSACTION_TYPE.dues,
    });
  store.transactions.update(tx.id, {
    amount,
    installment_amount: amount,
    complete_date: apiDateTime(at),
    transaction_id: body.transaction?.transaction_id ?? null,
    payment_method: body.transaction?.payment_method ?? tx.payment_method,
  });
  store.subscriptions.update(row.id, {
    period: body.period,
    details: body.details ?? null,
    remove_note: row.status === 6 ? (body.remove_note ?? null) : null,
    debt_category_id: categoryId,
    operation_date: apiDateTime(at),
    bill_no: body.bill_no ?? null,
    due_date: apiDateTime(new Date(body.due_date)),
    recurring_period: body.recurring_period ?? 0,
    amount,
    recurring_amount: row.recurring ? amount : 0,
    updated_by_id: null,
    last_update_date: apiDateTime(clock.now()),
    transaction_id: tx.id,
  });
  rebalance(store, row.user_id);
  return { status: 200, body: { result: "ok" } };
};

export const updateDebtStatus: Handler<"updateDebtStatus"> = (
  { path, body },
  { store, clock },
) => {
  const row = debtOf(store, path.debt_id);
  if (!row) return notFound("Debt");
  if (body.action === "remove") {
    if (row.status === 8) {
      return invalid("A paid debt cannot be removed; delete it instead");
    }
    if (row.status === 1) {
      store.subscriptions.update(row.id, {
        status: 6,
        updated_by_id: null,
        last_update_date: apiDateTime(clock.now()),
      });
    }
  } else if (row.status === 6) {
    store.subscriptions.update(row.id, {
      status: 1,
      remove_note: null,
      updated_by_id: null,
      last_update_date: apiDateTime(clock.now()),
    });
  }
  rebalance(store, row.user_id);
  return { status: 200, body: { result: "ok" } };
};

export const deleteDebt: Handler<"deleteDebt"> = ({ path }, { store }) => {
  const row = debtOf(store, path.debt_id);
  if (!row) return notFound("Debt");
  removeRecord(store, row);
  return { status: 200, body: { result: "ok" } };
};
