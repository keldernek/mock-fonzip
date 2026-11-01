import type { Handler } from "../../api/handler";
import { paginate } from "../../api/listing";
import type { components } from "../../generated/openapi";
import type { Row } from "../../store/collection";
import { fullName } from "../../store/joins";
import type { UserDefinedValueRecord, UserRecord } from "../../store/records";
import type { OrgStore } from "../../store/store";
import { createFacts, type Facts } from "./facts";
import {
  compileLeaf,
  invalid,
  type Compiled,
  type Field,
  type FilterValue,
  type Test,
} from "./search-conditions";
import { lastUpdateDate, SEARCH_FIELDS } from "./search-fields";
import { userDefinedValues } from "./user-fields";

type Schemas = components["schemas"];
type FilterNode = Schemas["UserSearchFilters"] | Schemas["MainSearchFilter"];
type OrderBy = Schemas["UserSearch"]["order_by"];
type User = Row<UserRecord>;
type Ascending<T> = T extends `-${infer F}` ? F : T;

function udvField(udv: Row<UserDefinedValueRecord>): Field {
  const raw = (user: User) => user.user_defined_values[udv.value] ?? null;
  switch (udv.key_type) {
    case 2:
    case 4:
      return {
        kind: "number",
        read: (user) => {
          const value = raw(user);
          return typeof value === "number" ? value : null;
        },
      };
    case 3:
    case 5:
      return {
        kind: "date",
        read: (user) => {
          const value = raw(user);
          return typeof value === "string" ? value : null;
        },
      };
    case 6:
      return { kind: "flag", read: (user) => raw(user) === true };
    case 8:
      return {
        kind: "texts",
        read: (user) => {
          const value = raw(user);
          return Array.isArray(value)
            ? value.filter((item) => typeof item === "string")
            : [];
        },
      };
    default:
      return {
        kind: "text",
        read: (user) => {
          const value = raw(user);
          return typeof value === "string" || typeof value === "number"
            ? String(value)
            : null;
        },
      };
  }
}

function customLeaf(
  filter: Schemas["UserSearchFilters"],
  store: OrgStore,
): Compiled {
  const value = filter.value;
  const udvId =
    typeof value === "object" && value !== null ? value.udv_id : undefined;
  if (typeof udvId !== "number" || !Number.isInteger(udvId)) {
    return invalid(
      "a custom filter's value is an object with the field's udv_id and the value to compare",
    );
  }
  const udv = store.userDefinedValues.get(udvId);
  if (!udv) {
    return { ok: false, status: 404, error: "User defined value not found" };
  }
  if (filter.key_type !== undefined && filter.key_type !== udv.key_type) {
    return invalid(
      `user defined value ${udvId} has key_type ${udv.key_type}, not ${filter.key_type}`,
    );
  }
  const inner: unknown =
    typeof value === "object" && value !== null ? value.value : undefined;
  return compileLeaf(
    udvField(udv),
    {
      parameter: udv.value,
      condition: filter.condition,
      value: filterValue(inner),
    },
    store,
  );
}

function filterValue(raw: unknown): FilterValue {
  if (typeof raw === "string" || typeof raw === "number") return raw;
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    return Object.fromEntries(Object.entries(raw));
  }
  return null;
}

function compileFilter(node: FilterNode, store: OrgStore): Compiled {
  if (node.attributes !== undefined) {
    if (node.condition !== "and" && node.condition !== "or") {
      return invalid(
        `a filter with attributes groups them with and or or, not ${node.condition}`,
      );
    }
    const tests: Test[] = [];
    for (const child of node.attributes) {
      const compiled = compileFilter(child, store);
      if (!compiled.ok) return compiled;
      tests.push(compiled.test);
    }
    const all = node.condition === "and";
    return {
      ok: true,
      test: (user, facts) =>
        all
          ? tests.every((test) => test(user, facts))
          : tests.length === 0 || tests.some((test) => test(user, facts)),
    };
  }
  if (!("parameter" in node)) {
    return invalid("a filter needs a parameter or attributes");
  }
  if (node.condition === "and" || node.condition === "or") {
    return invalid(`the ${node.condition} condition needs attributes`);
  }
  if (node.type === "custom") return customLeaf(node, store);
  return compileLeaf(
    SEARCH_FIELDS[node.parameter],
    { parameter: node.parameter, condition: node.condition, value: node.value },
    store,
  );
}

type SortKey = string | number | null;

const ORDER_KEYS: Readonly<
  Record<Ascending<OrderBy>, (user: User, facts: Facts) => SortKey>
> = {
  id: (user) => user.id,
  name: (user) => fullName(user) || null,
  first_name: (user) => user.first_name || null,
  last_name: (user) => user.last_name || null,
  membership_no: (user) =>
    user.membership_no === 0 ? null : user.membership_no,
  email: (user) => user.email || null,
  phone: (user) => user.phone || null,
  tckno: (user) => user.tckno || null,
  total_financial: (user) => user.total_financial,
  birthday: (user) => (user.birthday === "" ? null : user.birthday),
  apply_date: (user) =>
    user.apply_date === "" ? null : Date.parse(user.apply_date),
  join_date: (user) =>
    user.join_date === "" ? null : Date.parse(user.join_date),
  last_update_date: (user, facts) => Date.parse(lastUpdateDate(user, facts)),
};

function compareKeys(a: SortKey, b: SortKey): number {
  if (a === null || b === null) {
    return a === b ? 0 : a === null ? 1 : -1;
  }
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "tr");
}

function byOrder(orderBy: OrderBy, facts: Facts): (a: User, b: User) => number {
  const descending = orderBy.startsWith("-");
  const field = descending ? orderBy.slice(1) : orderBy;
  const key =
    Object.entries(ORDER_KEYS).find(([name]) => name === field)?.[1] ??
    ORDER_KEYS.id;
  return (a, b) => {
    const order = compareKeys(key(a, facts), key(b, facts));
    return (descending ? -order : order) || a.id - b.id;
  };
}

const LIST_FIELDS = [
  "id",
  "corporate_type",
  "first_name",
  "last_name",
  "address",
  "birthday",
  "total_financial",
  "email",
  "tags_as_text",
  "phone",
  "membership_no",
  "tckno",
  "apply_date",
  "join_date",
  "user_defined_values",
] as const;

type ListField = (typeof LIST_FIELDS)[number];
const UDV_VALUE = "user_defined_values__";

function tagsAsText(user: User, facts: Facts): string | undefined {
  const names = [...facts.tagIds(user.id)]
    .sort((a, b) => a - b)
    .flatMap((id) => {
      const tag = facts.store.tags.get(id);
      return tag ? [tag.name] : [];
    });
  return names.length > 0 ? names.join(", ") : undefined;
}

function nonEmpty(value: string): string | undefined {
  return value === "" ? undefined : value;
}

function listItem(
  user: User,
  facts: Facts,
  values: readonly string[] | undefined,
) {
  const wanted = (field: ListField): boolean =>
    values === undefined || values.includes(field);
  const udvKeys = values
    ?.filter((value) => value.startsWith(UDV_VALUE))
    .map((value) => value.slice(UDV_VALUE.length));
  const allUdvs = userDefinedValues(user);
  const udvs =
    values === undefined || values.includes("user_defined_values")
      ? allUdvs
      : udvKeys && udvKeys.length > 0
        ? Object.fromEntries(
            Object.entries(allUdvs).filter(([key]) => udvKeys.includes(key)),
          )
        : undefined;
  return {
    id: wanted("id") ? user.id : undefined,
    corporate_type: wanted("corporate_type") ? user.corporate_type : undefined,
    first_name: wanted("first_name") ? nonEmpty(user.first_name) : undefined,
    last_name: wanted("last_name") ? nonEmpty(user.last_name) : undefined,
    address: wanted("address") ? nonEmpty(user.address) : undefined,
    birthday: wanted("birthday") ? nonEmpty(user.birthday) : undefined,
    total_financial: wanted("total_financial")
      ? user.total_financial
      : undefined,
    email: wanted("email") ? nonEmpty(user.email) : undefined,
    tags_as_text: wanted("tags_as_text") ? tagsAsText(user, facts) : undefined,
    phone: wanted("phone") ? nonEmpty(user.phone) : undefined,
    membership_no:
      wanted("membership_no") && user.membership_no !== 0
        ? user.membership_no
        : undefined,
    tckno: wanted("tckno") ? nonEmpty(user.tckno) : undefined,
    apply_date: wanted("apply_date") ? nonEmpty(user.apply_date) : undefined,
    join_date: wanted("join_date") ? nonEmpty(user.join_date) : undefined,
    user_defined_values: udvs,
  };
}

export const getUserList: Handler<"getUserList"> = (
  { body },
  { store, clock },
) => {
  const filter = compileFilter(body.search.filter, store);
  if (!filter.ok) {
    return { status: filter.status, body: { error: filter.error } };
  }
  const facts = createFacts(store, clock);
  const matching = store.users
    .list((user) => filter.test(user, facts))
    .sort(byOrder(body.search.order_by, facts));
  return {
    status: 200,
    body: {
      user_list: paginate(matching, body.search).map((user) =>
        listItem(user, facts, body.values_list),
      ),
      total: matching.length,
    },
  };
};
