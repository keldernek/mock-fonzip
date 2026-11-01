export interface PageRequest {
  readonly start_page: number;
  readonly how_many: number;
}

export function paginate<T>(rows: readonly T[], request: PageRequest): T[] {
  const start = (request.start_page - 1) * request.how_many;
  return rows.slice(start, start + request.how_many);
}

function fold(text: string): string {
  return text.toLocaleLowerCase("tr-TR");
}

export function matchesQuery(
  query: string | undefined,
  fields: readonly (string | null | undefined)[],
): boolean {
  if (query === undefined || query.trim() === "") return true;
  const exclude = query.startsWith("-");
  const needle = fold(exclude ? query.slice(1) : query).trim();
  if (needle === "") return true;
  const found = fields.some(
    (field) =>
      field !== null && field !== undefined && fold(field).includes(needle),
  );
  return exclude ? !found : found;
}

export type AmountCondition = "!=" | "<" | "<=" | ">" | ">=";

export function matchesAmount(
  amount: number,
  value: number | undefined,
  condition: AmountCondition | null | undefined,
): boolean {
  if (value === undefined) return true;
  switch (condition) {
    case "!=":
      return amount !== value;
    case "<":
      return amount < value;
    case "<=":
      return amount <= value;
    case ">":
      return amount > value;
    case ">=":
      return amount >= value;
    default:
      return amount === value;
  }
}

export interface DateRange {
  readonly start: number;
  readonly end: number;
}

export function parseDateRange(
  start: string,
  end: string,
): DateRange | { readonly error: string } {
  const range = { start: Date.parse(start), end: Date.parse(end) };
  if (!(range.start < range.end)) {
    return { error: "start_date must be before end_date" };
  }
  return range;
}

export function inDateRange(value: string, range: DateRange): boolean {
  const at = Date.parse(value);
  return at >= range.start && at <= range.end;
}

export function inList<T>(value: T, list: readonly T[] | undefined): boolean {
  return list === undefined || list.length === 0 || list.includes(value);
}

export function newestFirst<T>(
  key: (row: T) => string,
): (a: T, b: T) => number {
  return (a, b) => Date.parse(key(b)) - Date.parse(key(a));
}
