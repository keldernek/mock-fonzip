import type { Row } from "./collection";
import type { UserDefinedValueRecord, UserRecord } from "./records";
import type { OrgStore } from "./store";

// The store keeps "" for an absent text. Production sends null.
export function textOrNull(text: string): string | null {
  return text === "" ? null : text;
}

// The store keeps `apply_date` and `join_date` as date-times in Istanbul
// time. Production sends the calendar day.
export function dayOf(dateTime: string): string | undefined {
  return dateTime === "" ? undefined : dateTime.slice(0, 10);
}

// When the contact's profile last changed. A contact without a profile
// falls back to the day it applied, as the search's `last_update_date` does.
// A user with no application date has none.
export function lastUpdateOf(
  store: OrgStore,
  user: Pick<Row<UserRecord>, "id" | "apply_date">,
): string | undefined {
  const profile = store.contactProfiles.find((row) => row.user_id === user.id);
  const at =
    profile?.last_update_date ?? profile?.create_date ?? user.apply_date;
  return at === "" ? undefined : at;
}

export interface UdvOption {
  readonly id: number;
  readonly order: number;
  readonly text: string;
}

// A user-defined value as production sends it: an integer, a string, or for
// a select field the chosen option.
export type UdvOutput = number | string | UdvOption;

function optionAt(udv: UserDefinedValueRecord, position: number) {
  const option = udv.options[position];
  return option === undefined
    ? undefined
    : {
        id: option.id ?? position + 1,
        order: option.order ?? position,
        text: option.text ?? "",
      };
}

// The store holds a select as its option text, a yes/no field as a boolean
// and a multiple select as a list of texts. Production never sent an array
// or a boolean, so a boolean field reports the "yes" or "no" option, and a
// multiple select reports its texts joined by ", ".
export function udvOutput(
  udv: UserDefinedValueRecord | undefined,
  value: NonNullable<UserRecord["user_defined_values"][string]>,
): UdvOutput {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const position = udv?.options.findIndex((option) => option.text === value);
    const option =
      udv && position !== undefined && position >= 0
        ? optionAt(udv, position)
        : undefined;
    return udv?.key_type === 7 && option ? option : value;
  }
  if (typeof value === "boolean") {
    const option = udv ? optionAt(udv, value ? 0 : 1) : undefined;
    return option ?? (value ? 1 : 0);
  }
  return value.join(", ");
}

export function userDefinedValues(
  store: OrgStore,
  user: Pick<Row<UserRecord>, "user_defined_values">,
  only?: readonly string[],
): Record<string, UdvOutput> {
  const fields = new Map(
    store.userDefinedValues.list().map((udv) => [udv.value, udv]),
  );
  const values: Record<string, UdvOutput> = {};
  for (const [key, value] of Object.entries(user.user_defined_values)) {
    if (value === null || (only !== undefined && !only.includes(key))) continue;
    values[key] = udvOutput(fields.get(key), value);
  }
  return values;
}
