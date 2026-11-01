import type { components } from "../../generated/openapi";
import type { Row } from "../../store/collection";
import type { UserRecord } from "../../store/records";
import type { OrgStore } from "../../store/store";
import { addDays, anniversaryIn, dayOf, monthDay, type Day } from "./calendar";
import type { Facts } from "./facts";

type Filter = components["schemas"]["UserSearchFilters"];
type Condition = Filter["condition"];
export type FilterValue = Filter["value"];
export type Id = number | string;
type Reader<T> = (user: Row<UserRecord>, facts: Facts) => T;
type DuplicateKey = "email" | "phone" | "tckno" | "membership_no";

export interface IdDomain {
  readonly what: string;
  resolve(store: OrgStore, raw: string): Resolved;
}

type Resolved =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly status: 400 | 404; readonly error: string };

export type Field =
  | {
      readonly kind: "text";
      readonly read: Reader<string | null>;
      readonly duplicate?: DuplicateKey;
    }
  | { readonly kind: "texts"; readonly read: Reader<readonly string[]> }
  | {
      readonly kind: "number";
      readonly read: Reader<number | null>;
      readonly duplicate?: DuplicateKey;
      readonly idList?: true;
    }
  | { readonly kind: "numbers"; readonly read: Reader<readonly number[]> }
  | { readonly kind: "total"; readonly read: Reader<number> }
  | { readonly kind: "date"; readonly read: Reader<string | null> }
  | { readonly kind: "dates"; readonly read: Reader<readonly string[]> }
  | { readonly kind: "anniversary"; readonly read: Reader<string | null> }
  | { readonly kind: "flag"; readonly read: Reader<boolean> }
  | {
      readonly kind: "ids";
      readonly read: Reader<readonly Id[]>;
      readonly domain?: IdDomain;
    };

export type Test = (user: Row<UserRecord>, facts: Facts) => boolean;

export type Compiled =
  | { readonly ok: true; readonly test: Test }
  | { readonly ok: false; readonly status: 400 | 404; readonly error: string };

export function invalid(error: string): Compiled & { ok: false } {
  return { ok: false, status: 400, error: `Invalid values: ${error}` };
}

function compiled(test: Test): Compiled {
  return { ok: true, test };
}

function fold(text: string): string {
  return text.toLocaleLowerCase("tr-TR").replaceAll("ı", "i").trim();
}

function asText(value: FilterValue): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
}

function asNumber(value: FilterValue): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asDayCount(value: FilterValue): number | null {
  const count = asNumber(value);
  return count !== null && Number.isInteger(count) && count >= 0 ? count : null;
}

function asDay(value: FilterValue): Day | null {
  return typeof value === "string" ? dayOf(value) : null;
}

function asFlag(value: FilterValue): boolean | null {
  if (value === "true" || value === 1 || value === "1") {
    return true;
  }
  if (value === "false" || value === 0 || value === "0") {
    return false;
  }
  return null;
}

function asRange<T>(
  value: FilterValue,
  parse: (bound: FilterValue) => T | null,
): { readonly start: T; readonly end: T } | null {
  if (typeof value !== "object" || value === null) return null;
  const start = parse(toFilterValue(value.start));
  const end = parse(toFilterValue(value.end));
  return start === null || end === null ? null : { start, end };
}

function toFilterValue(raw: unknown): FilterValue {
  return typeof raw === "string" || typeof raw === "number" ? raw : null;
}

function splitList(value: FilterValue): string[] | null {
  const text = asText(value);
  if (text === null) return null;
  const items = text
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item !== "");
  return items.length > 0 ? items : null;
}

interface Leaf {
  readonly parameter: string;
  readonly condition: Condition;
  readonly value: FilterValue;
}

function needs(leaf: Leaf, what: string): Compiled {
  return invalid(`${leaf.parameter} ${leaf.condition} needs ${what}`);
}

function unsupported(leaf: Leaf): Compiled {
  return invalid(
    `the ${leaf.condition} condition does not apply to ${leaf.parameter}`,
  );
}

function ordered<T>(
  leaf: Leaf,
  values: Reader<readonly T[]>,
  parse: (value: FilterValue) => T | null,
  what: string,
  compare: (a: T, b: T) => number,
): Compiled | null {
  const any =
    (accept: (x: T) => boolean): Test =>
    (user, facts) =>
      values(user, facts).some(accept);
  const none =
    (accept: (x: T) => boolean): Test =>
    (user, facts) =>
      !values(user, facts).some(accept);
  if (leaf.condition === "()") {
    const range = asRange(leaf.value, parse);
    if (!range) return needs(leaf, `a {start, end} range of ${what}s`);
    return compiled(
      any((x) => compare(x, range.start) >= 0 && compare(x, range.end) <= 0),
    );
  }
  const relations: Partial<
    Record<
      Condition,
      { readonly accept: (order: number) => boolean; readonly negate: boolean }
    >
  > = {
    eq: { accept: (order) => order === 0, negate: false },
    neq: { accept: (order) => order === 0, negate: true },
    lt: { accept: (order) => order < 0, negate: false },
    lte: { accept: (order) => order <= 0, negate: false },
    gt: { accept: (order) => order > 0, negate: false },
    gte: { accept: (order) => order >= 0, negate: false },
  };
  const relation = relations[leaf.condition];
  if (!relation) return null;
  const operand = parse(leaf.value);
  if (operand === null) return needs(leaf, `a ${what}`);
  const accept = (x: T) => relation.accept(compare(x, operand));
  return compiled(relation.negate ? none(accept) : any(accept));
}

function presence(
  leaf: Leaf,
  present: (user: Row<UserRecord>, facts: Facts) => boolean,
): Compiled | null {
  if (leaf.condition === "exist") return compiled(present);
  if (leaf.condition === "isnull") {
    return compiled((user, facts) => !present(user, facts));
  }
  return null;
}

function duplicate(leaf: Leaf, key: DuplicateKey | undefined): Compiled | null {
  if (leaf.condition !== "duplicate") return null;
  if (!key) return unsupported(leaf);
  return compiled((user, facts) => facts.sharedValue(key, user));
}

function textCondition(
  leaf: Leaf,
  values: Reader<readonly string[]>,
  key: DuplicateKey | undefined,
): Compiled {
  const found =
    presence(leaf, (user, facts) => values(user, facts).length > 0) ??
    duplicate(leaf, key);
  if (found) return found;
  const matchers: Partial<
    Record<
      Condition,
      {
        readonly match: (field: string, needle: string) => boolean;
        readonly negate: boolean;
      }
    >
  > = {
    eq: { match: (field, needle) => field === needle, negate: false },
    neq: { match: (field, needle) => field === needle, negate: true },
    contains: {
      match: (field, needle) => field.includes(needle),
      negate: false,
    },
    exclude: { match: (field, needle) => field.includes(needle), negate: true },
  };
  const matcher = matchers[leaf.condition];
  if (!matcher) return unsupported(leaf);
  const text = asText(leaf.value);
  if (text === null || fold(text) === "") return needs(leaf, "a text value");
  const needle = fold(text);
  return compiled((user, facts) => {
    const hit = values(user, facts).some((field) =>
      matcher.match(fold(field), needle),
    );
    return matcher.negate ? !hit : hit;
  });
}

function numberCondition(
  leaf: Leaf,
  values: Reader<readonly number[]>,
  options: { readonly duplicate?: DuplicateKey; readonly idList?: true },
): Compiled {
  const found =
    presence(leaf, (user, facts) => values(user, facts).length > 0) ??
    duplicate(leaf, options.duplicate);
  if (found) return found;
  if (leaf.condition === "contains") {
    if (!options.idList) return unsupported(leaf);
    const items = splitList(leaf.value)?.map(Number);
    if (!items || items.some((item) => !Number.isFinite(item))) {
      return needs(leaf, "a ;-separated list of numbers");
    }
    const wanted = new Set(items);
    return compiled((user, facts) =>
      values(user, facts).some((x) => wanted.has(x)),
    );
  }
  return (
    ordered(leaf, values, asNumber, "number", (a, b) => a - b) ??
    unsupported(leaf)
  );
}

function totalCondition(leaf: Leaf, read: Reader<number>): Compiled {
  const found = presence(leaf, (user, facts) => read(user, facts) !== 0);
  if (found) return found;
  return (
    ordered(
      leaf,
      (user, facts) => [read(user, facts)],
      asNumber,
      "number",
      (a, b) => a - b,
    ) ?? unsupported(leaf)
  );
}

function relativeDays(
  leaf: Leaf,
  values: Reader<readonly Day[]>,
): Compiled | null {
  const any =
    (accept: (day: Day, today: Day) => boolean): Test =>
    (user, facts) =>
      values(user, facts).some((day) => accept(day, facts.today));
  if (leaf.condition === ".")
    return compiled(any((day, today) => day === today));
  const relations: Partial<
    Record<Condition, (day: Day, today: Day, count: number) => boolean>
  > = {
    "=": (day, today, count) => day === addDays(today, -count),
    "+=": (day, today, count) => day === addDays(today, count),
    "<": (day, today, count) => day > addDays(today, -count) && day <= today,
    ">": (day, today, count) => day < addDays(today, -count),
  };
  const relation = relations[leaf.condition];
  if (!relation) return null;
  const count = asDayCount(leaf.value);
  if (count === null) return needs(leaf, "a whole number of days");
  return compiled(any((day, today) => relation(day, today, count)));
}

function notBeforeOrAfter(
  leaf: Leaf,
  values: Reader<readonly number[]>,
  parse: (value: FilterValue) => number | null,
): Compiled | null {
  if (leaf.condition !== "!lt" && leaf.condition !== "!gt") return null;
  const operand = parse(leaf.value);
  if (operand === null) return needs(leaf, "a date");
  const before = leaf.condition === "!lt";
  return compiled(
    (user, facts) =>
      !values(user, facts).some((x) => (before ? x < operand : x > operand)),
  );
}

function dateCondition(leaf: Leaf, read: Reader<readonly string[]>): Compiled {
  const days: Reader<readonly Day[]> = (user, facts) =>
    read(user, facts).flatMap((text) => {
      const day = dayOf(text);
      return day === null ? [] : [day];
    });
  return (
    presence(leaf, (user, facts) => days(user, facts).length > 0) ??
    relativeDays(leaf, days) ??
    notBeforeOrAfter(leaf, days, asDay) ??
    ordered(leaf, days, asDay, "date", (a, b) => a - b) ??
    unsupported(leaf)
  );
}

function anniversaryCondition(
  leaf: Leaf,
  read: Reader<string | null>,
): Compiled {
  const birth = (user: Row<UserRecord>, facts: Facts): Day | null => {
    const text = read(user, facts);
    return text === null ? null : dayOf(text);
  };
  const thisYear: Reader<readonly Day[]> = (user, facts) => {
    const day = birth(user, facts);
    return day === null ? [] : [anniversaryIn(day, facts.today)];
  };
  const monthDays: Reader<readonly number[]> = (user, facts) => {
    const day = birth(user, facts);
    return day === null ? [] : [monthDay(day)];
  };
  const parseMonthDay = (value: FilterValue): number | null => {
    const day = asDay(value);
    return day === null ? null : monthDay(day);
  };
  return (
    presence(leaf, (user, facts) => birth(user, facts) !== null) ??
    relativeDays(leaf, thisYear) ??
    notBeforeOrAfter(leaf, monthDays, parseMonthDay) ??
    ordered(leaf, monthDays, parseMonthDay, "date", (a, b) => a - b) ??
    unsupported(leaf)
  );
}

function flagCondition(leaf: Leaf, read: Reader<boolean>): Compiled {
  const found = presence(leaf, read);
  if (found) return found;
  if (leaf.condition !== "eq" && leaf.condition !== "neq") {
    return unsupported(leaf);
  }
  const wanted = asFlag(leaf.value);
  if (wanted === null) return needs(leaf, "true or false");
  const equal = leaf.condition === "eq";
  return compiled((user, facts) => (read(user, facts) === wanted) === equal);
}

function idsCondition(
  leaf: Leaf,
  read: Reader<readonly Id[]>,
  domain: IdDomain | undefined,
  store: OrgStore,
): Compiled {
  const keys: Reader<readonly string[]> = (user, facts) =>
    read(user, facts).map(String);
  const found = presence(leaf, (user, facts) => keys(user, facts).length > 0);
  if (found) return found;
  const raws =
    leaf.condition === "contains"
      ? splitList(leaf.value)
      : leaf.condition === "eq" ||
          leaf.condition === "neq" ||
          leaf.condition === "exclude"
        ? [asText(leaf.value)].filter((item) => item !== null)
        : undefined;
  if (raws === undefined) return unsupported(leaf);
  if (raws === null || raws.length === 0) return needs(leaf, "an id");
  const wanted = new Set<string>();
  for (const raw of raws) {
    const resolved = domain ? domain.resolve(store, raw.trim()) : undefined;
    if (resolved && !resolved.ok) {
      return { ok: false, status: resolved.status, error: resolved.error };
    }
    wanted.add(resolved ? resolved.id : raw.trim());
  }
  const has: Test = (user, facts) =>
    keys(user, facts).some((key) => wanted.has(key));
  return leaf.condition === "eq" || leaf.condition === "contains"
    ? compiled(has)
    : compiled((user, facts) => !has(user, facts));
}

export function compileLeaf(
  field: Field,
  leaf: Leaf,
  store: OrgStore,
): Compiled {
  switch (field.kind) {
    case "text":
      return textCondition(
        leaf,
        (user, facts) => {
          const value = field.read(user, facts);
          return value === null || value === "" ? [] : [value];
        },
        field.duplicate,
      );
    case "texts":
      return textCondition(
        leaf,
        (user, facts) =>
          field.read(user, facts).filter((value) => value !== ""),
        undefined,
      );
    case "number":
      return numberCondition(
        leaf,
        (user, facts) => {
          const value = field.read(user, facts);
          return value === null ? [] : [value];
        },
        field,
      );
    case "numbers":
      return numberCondition(leaf, field.read, {});
    case "total":
      return totalCondition(leaf, field.read);
    case "date":
      return dateCondition(leaf, (user, facts) => {
        const value = field.read(user, facts);
        return value === null || value === "" ? [] : [value];
      });
    case "dates":
      return dateCondition(leaf, field.read);
    case "anniversary":
      return anniversaryCondition(leaf, (user, facts) => {
        const value = field.read(user, facts);
        return value === "" ? null : value;
      });
    case "flag":
      return flagCondition(leaf, field.read);
    case "ids":
      return idsCondition(leaf, field.read, field.domain, store);
    default: {
      const unreachable: never = field;
      return unreachable;
    }
  }
}
