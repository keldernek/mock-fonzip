import { notFound } from "../../api/errors";
import type { Handler } from "../../api/handler";
import { paginate } from "../../api/listing";
import { istanbulDateTime } from "../../seed/dates";
import type { Row } from "../../store/collection";
import { userName } from "../../store/joins";
import type { DebtCategoryRecord } from "../../store/records";
import type { OrgStore } from "../../store/store";
import { containsUnaccented } from "./filters";
import { cents, isDebt } from "./ledger";
import { toDebtCategory } from "./projections";

function debtStats(store: OrgStore, categoryId: number) {
  const debts = store.subscriptions.list(
    (row) => isDebt(row) && row.debt_category_id === categoryId,
  );
  const open = debts.filter((row) => row.status === 1);
  const closed = debts.filter((row) => row.status === 8);
  const sum = (rows: typeof debts) =>
    cents(rows.reduce((total, row) => total + row.amount, 0));
  return {
    debt_count: open.length + closed.length,
    open_count: open.length,
    open_amount: sum(open),
    closed_count: closed.length,
    closed_amount: sum(closed),
    removed_count: debts.filter((row) => row.status === 6).length,
    total_amount: sum([...open, ...closed]),
    open_member_count: new Set(open.map((row) => row.user_id)).size,
    listed_count: debts.filter((row) => store.users.get(row.user_id)).length,
  };
}

function usageOf(store: OrgStore, category: Row<DebtCategoryRecord>) {
  const stats = debtStats(store, category.id);
  const automations = store.debtAutomations.list(
    (row) => row.debt_category_id === category.id,
  );
  return {
    category: { id: category.id, name: category.name },
    ...stats,
    automation_list: automations.map((row) => ({
      id: row.id,
      title: row.title,
    })),
    in_use:
      stats.debt_count + stats.removed_count > 0 || automations.length > 0,
  };
}

export function liveCategory(
  store: OrgStore,
  id: number,
): Row<DebtCategoryRecord> | undefined {
  const category = store.debtCategories.get(id);
  return category && !category.deleted ? category : undefined;
}

export const getDebtCategoryList: Handler<"getDebtCategoryList"> = (
  { query },
  { store },
) => {
  const categories = store.debtCategories
    .list(
      (category) =>
        !category.deleted && containsUnaccented(query.query, category.name),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "tr") || a.id - b.id);
  return {
    status: 200,
    body: {
      category_list: paginate(categories, query).map((category) => ({
        id: category.id,
        name: category.name,
        create_date: category.create_date,
        created_by_id: category.created_by_id,
        created_by__name: userName(store, category.created_by_id) ?? null,
        update_date: category.update_date,
        updated_by_id: category.updated_by_id,
        updated_by__name: userName(store, category.updated_by_id) ?? null,
        ...debtStats(store, category.id),
      })),
      total: categories.length,
    },
  };
};

function nameTaken(store: OrgStore, name: string, exceptId?: number): boolean {
  const folded = name.toLocaleLowerCase("tr-TR");
  return (
    store.debtCategories.find(
      (category) =>
        !category.deleted &&
        category.id !== exceptId &&
        category.name.toLocaleLowerCase("tr-TR") === folded,
    ) !== undefined
  );
}

function checkedName(
  store: OrgStore,
  raw: string,
  exceptId?: number,
): string | { readonly error: string } {
  const name = raw.trim();
  if (name === "") return { error: "name must not be empty" };
  if (nameTaken(store, name, exceptId)) {
    return { error: `A debt category named ${name} already exists` };
  }
  return name;
}

export const createDebtCategory: Handler<"createDebtCategory"> = (
  { body },
  { store, clock },
) => {
  const name = checkedName(store, body.name);
  if (typeof name !== "string") return { status: 400, body: name };
  const category = store.debtCategories.insert({
    name,
    create_date: istanbulDateTime(clock.now()),
    created_by_id: null,
    update_date: null,
    updated_by_id: null,
    deleted: false,
  });
  return {
    status: 200,
    body: { result: "ok", category: toDebtCategory(category) },
  };
};

export const getDebtCategoryUsage: Handler<"getDebtCategoryUsage"> = (
  { path },
  { store },
) => {
  const category = liveCategory(store, path.category_id);
  if (!category) return notFound("Debt category");
  return { status: 200, body: usageOf(store, category) };
};

export const updateDebtCategory: Handler<"updateDebtCategory"> = (
  { path, body },
  { store, clock },
) => {
  const category = liveCategory(store, path.category_id);
  if (!category) return notFound("Debt category");
  const name = checkedName(store, body.name, category.id);
  if (typeof name !== "string") return { status: 400, body: name };
  const renamed = store.debtCategories.update(category.id, {
    name,
    update_date: istanbulDateTime(clock.now()),
    updated_by_id: null,
  });
  return {
    status: 200,
    body: { result: "ok", category: toDebtCategory(renamed ?? category) },
  };
};

type Replacement =
  | { readonly kind: "absent" }
  | { readonly kind: "none" }
  | { readonly kind: "category"; readonly id: number }
  | { readonly kind: "invalid" };

function replacementOf(
  body: { replacement_id?: number | null } | undefined,
  query: string | undefined,
): Replacement {
  if (body !== undefined) {
    if (body.replacement_id === undefined) return { kind: "absent" };
    return body.replacement_id === null
      ? { kind: "none" }
      : { kind: "category", id: body.replacement_id };
  }
  if (query === undefined) return { kind: "absent" };
  if (query.trim() === "") return { kind: "none" };
  return /^\d+$/.test(query.trim())
    ? { kind: "category", id: Number(query.trim()) }
    : { kind: "invalid" };
}

export const deleteDebtCategory: Handler<"deleteDebtCategory"> = (
  { path, query, body },
  { store },
) => {
  const category = liveCategory(store, path.category_id);
  if (!category) return notFound("Debt category");
  const replacement = replacementOf(body, query.replacement_id);
  if (replacement.kind === "invalid") {
    return {
      status: 400,
      body: { error: "replacement_id must be a category id or empty" },
    };
  }
  const usage = usageOf(store, category);
  if (replacement.kind === "absent" && usage.in_use) {
    return {
      status: 409,
      body: {
        error: `${category.name} is in use: send replacement_id to move its debts and automations`,
        usage,
      },
    };
  }
  let target: Row<DebtCategoryRecord> | undefined;
  if (replacement.kind === "category") {
    if (replacement.id === category.id) {
      return {
        status: 400,
        body: { error: "replacement_id must be another category" },
      };
    }
    target = liveCategory(store, replacement.id);
    if (!target) return notFound("Replacement debt category");
  }
  const targetId = target?.id ?? null;
  const debts = store.subscriptions.list(
    (row) => isDebt(row) && row.debt_category_id === category.id,
  );
  for (const row of debts) {
    store.subscriptions.update(row.id, { debt_category_id: targetId });
  }
  const automations = store.debtAutomations.list(
    (row) => row.debt_category_id === category.id,
  );
  for (const row of automations) {
    store.debtAutomations.update(row.id, { debt_category_id: targetId });
  }
  store.debtCategories.update(category.id, { deleted: true });
  return {
    status: 200,
    body: {
      result: "ok",
      debt_count: debts.length,
      automation_count: automations.length,
      replacement_name: target?.name ?? null,
    },
  };
};
