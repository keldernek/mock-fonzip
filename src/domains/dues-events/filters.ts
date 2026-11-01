import type { DateRange } from "../../api/listing";
import { istanbulDate } from "../../seed/dates";

export function unaccented(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replaceAll(/\p{M}/gu, "")
    .replaceAll("ı", "i");
}

export function containsUnaccented(
  needle: string | undefined,
  haystack: string | undefined,
): boolean {
  if (needle === undefined || needle.trim() === "") return true;
  return (
    haystack !== undefined &&
    unaccented(haystack).includes(unaccented(needle.trim()))
  );
}

const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

function instant(value: string, edge: "start" | "end"): number {
  if (!BARE_DATE.test(value)) return Date.parse(value);
  const start = Date.parse(`${value}T00:00:00+03:00`);
  return edge === "start" ? start : start + DAY_MS - 1;
}

export type OptionalRange =
  | { readonly kind: "none" }
  | { readonly kind: "range"; readonly range: DateRange }
  | { readonly kind: "error"; readonly error: string };

export function optionalRange(
  names: readonly [string, string],
  start: string | undefined,
  end: string | undefined,
): OptionalRange {
  if (start === undefined && end === undefined) return { kind: "none" };
  const [startName, endName] = names;
  if (start === undefined || end === undefined) {
    return {
      kind: "error",
      error: `${startName} and ${endName} must be sent together`,
    };
  }
  const range = { start: instant(start, "start"), end: instant(end, "end") };
  if (!(range.start < range.end)) {
    return { kind: "error", error: `${startName} must be before ${endName}` };
  }
  return { kind: "range", range };
}

export function inOptionalRange(value: string, range: OptionalRange): boolean {
  if (range.kind !== "range") return true;
  const at = Date.parse(value);
  return at >= range.range.start && at <= range.range.end;
}

export function sameDay(value: string, filter: string | undefined): boolean {
  return (
    filter === undefined ||
    istanbulDate(new Date(value)) === istanbulDate(new Date(filter))
  );
}

export function matchesDate(
  value: string,
  filter: string | undefined,
  condition: "<" | ">" | null | undefined,
): boolean {
  if (filter === undefined) return true;
  switch (condition) {
    case "<":
      return Date.parse(value) < Date.parse(filter);
    case ">":
      return Date.parse(value) > Date.parse(filter);
    default:
      return sameDay(value, filter);
  }
}

export function inPeriod(
  period: string,
  year: number | undefined,
  month: number | undefined,
): boolean {
  return (
    (year === undefined || Number(period.slice(0, 4)) === year) &&
    (month === undefined || Number(period.slice(5, 7)) === month)
  );
}

export function sameDigits(
  stored: string | null,
  filter: number | undefined,
): boolean {
  return filter === undefined || (stored !== null && Number(stored) === filter);
}

type SortKey = number | string;

function compareKeys(a: SortKey, b: SortKey): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "tr");
}

export function sortRows<T extends { readonly id: number }, F extends string>(
  rows: readonly T[],
  order: NoInfer<F> | `-${NoInfer<F>}`,
  keys: Readonly<Record<F, (row: T) => SortKey>>,
): T[] {
  const descending = order.startsWith("-");
  const name = descending ? order.slice(1) : order;
  const key = Object.entries<(row: T) => SortKey>(keys).find(
    ([field]) => field === name,
  )?.[1];
  if (!key) throw new Error(`no sort key for ${order}`);
  const direction = descending ? -1 : 1;
  return [...rows].sort(
    (a, b) => direction * (compareKeys(key(a), key(b)) || a.id - b.id),
  );
}
