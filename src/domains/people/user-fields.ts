import type { components } from "../../generated/openapi";
import { istanbulDateTime } from "../../seed/dates";
import type { Row } from "../../store/collection";
import type {
  UdvValue,
  UserDefinedValueRecord,
  UserRecord,
} from "../../store/records";

export type UpdatableField = NonNullable<
  components["schemas"]["UserSingleFieldUpdate"]["field"]
>;
type Patch = Partial<Omit<UserRecord, "id">>;
type Parsed<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function ok<T>(value: T): Parsed<T> {
  return { ok: true, value };
}

function fail<T>(error: string): Parsed<T> {
  return { ok: false, error: `Invalid values: ${error}` };
}

function isCalendarDate(text: string): boolean {
  if (!DATE_ONLY.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text);
}

type TextKey = {
  [K in keyof UserRecord]: UserRecord[K] extends string ? K : never;
}[UpdatableField & keyof UserRecord];

type FlagKey = "private" | "corporate_type";

function textRule(
  key: TextKey,
  check: (text: string) => string | null = () => null,
): (value: unknown) => Parsed<Patch> {
  return (value) => {
    if (typeof value !== "string" && typeof value !== "number") {
      return fail(`${key} takes a text value`);
    }
    const text = String(value).trim();
    const problem = text === "" ? null : check(text);
    if (problem) return fail(`${key} ${problem}`);
    const patch: Patch = {};
    patch[key] = text;
    return ok(patch);
  };
}

function dateTimeRule(
  key: "apply_date" | "join_date",
): (value: unknown) => Parsed<Patch> {
  return (value) => {
    const at = typeof value === "string" ? Date.parse(value) : Number.NaN;
    if (Number.isNaN(at)) return fail(`${key} takes a date-time`);
    const patch: Patch = {};
    patch[key] = istanbulDateTime(new Date(at));
    return ok(patch);
  };
}

function flagRule(key: FlagKey): (value: unknown) => Parsed<Patch> {
  return (value) => {
    const flag =
      value === true || value === "true"
        ? true
        : value === false || value === "false"
          ? false
          : null;
    if (flag === null) return fail(`${key} takes true or false`);
    const patch: Patch = {};
    patch[key] = flag;
    return ok(patch);
  };
}

const email = (text: string) =>
  EMAIL.test(text) ? null : "is not an email address";
const digits = (text: string) =>
  /^\d+$/.test(text) ? null : "takes digits only";

const FIELD_RULES: {
  readonly [F in UpdatableField]: (value: unknown) => Parsed<Patch>;
} = {
  first_name: (value) =>
    typeof value === "string" && value.trim() !== ""
      ? ok({ first_name: value.trim() })
      : fail("first_name cannot be empty"),
  last_name: textRule("last_name"),
  nationality_text: textRule("nationality_text"),
  tckno: textRule("tckno", digits),
  birthday: textRule("birthday", (text) =>
    isCalendarDate(text) ? null : "takes a YYYY-MM-DD date",
  ),
  email: textRule("email", email),
  email_second: textRule("email_second", email),
  phone: textRule("phone"),
  home_phone_first: textRule("home_phone_first"),
  address: textRule("address"),
  post_code: textRule("post_code"),
  district_text: textRule("district_text"),
  city_text: textRule("city_text"),
  country_text: textRule("country_text"),
  work_phone: textRule("work_phone"),
  work_address: textRule("work_address"),
  work_post_code: textRule("work_post_code"),
  work_district_text: textRule("work_district_text"),
  work_city_text: textRule("work_city_text"),
  work_country_text: textRule("work_country_text"),
  apply_date: dateTimeRule("apply_date"),
  join_date: dateTimeRule("join_date"),
  private: flagRule("private"),
  corporate_type: flagRule("corporate_type"),
};

export function isUpdatableField(name: string): name is UpdatableField {
  return Object.hasOwn(FIELD_RULES, name);
}

export function applyFields(
  entries: readonly (readonly [UpdatableField, unknown])[],
): Parsed<Patch> {
  let patch: Patch = {};
  for (const [field, value] of entries) {
    const parsed = FIELD_RULES[field](value);
    if (!parsed.ok) return parsed;
    patch = { ...patch, ...parsed.value };
  }
  return ok(patch);
}

function optionTexts(udv: Row<UserDefinedValueRecord>): string[] {
  return udv.options.flatMap((option) =>
    option.text === undefined ? [] : [option.text],
  );
}

export function parseUdvValue(
  udv: Row<UserDefinedValueRecord>,
  value: unknown,
): Parsed<UdvValue> {
  const label = `${udv.value} (${udv.name})`;
  if (value === null) return ok(null);
  switch (udv.key_type) {
    case 0:
    case 1:
      return typeof value === "string"
        ? ok(value)
        : fail(`${label} takes a text`);
    case 2: {
      const number = typeof value === "string" ? Number(value) : value;
      return typeof number === "number" && Number.isFinite(number)
        ? ok(number)
        : fail(`${label} takes a number`);
    }
    case 3:
      return typeof value === "string" && isCalendarDate(value)
        ? ok(value)
        : fail(`${label} takes a YYYY-MM-DD date`);
    case 4:
      return typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 1900 &&
        value <= 2100
        ? ok(value)
        : fail(`${label} takes a year`);
    case 5: {
      const at = typeof value === "string" ? Date.parse(value) : Number.NaN;
      return Number.isNaN(at)
        ? fail(`${label} takes a date-time`)
        : ok(istanbulDateTime(new Date(at)));
    }
    case 6:
      return typeof value === "boolean"
        ? ok(value)
        : fail(`${label} takes true or false`);
    case 7:
      return typeof value === "string" && optionTexts(udv).includes(value)
        ? ok(value)
        : fail(`${label} takes one of ${optionTexts(udv).join(", ")}`);
    case 8: {
      const options = optionTexts(udv);
      if (!Array.isArray(value)) {
        return fail(`${label} takes a list of ${options.join(", ")}`);
      }
      const picked = value.filter(
        (item): item is string =>
          typeof item === "string" && options.includes(item),
      );
      return picked.length === value.length
        ? ok(picked)
        : fail(`${label} takes a list of ${options.join(", ")}`);
    }
    default:
      return fail(`${label} has an unknown key_type`);
  }
}
