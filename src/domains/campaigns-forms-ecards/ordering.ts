export type SortValue = string | number | boolean | null | undefined;

export type OrderField<O extends string> = O extends `-${infer F}` ? F : O;

export interface SortKey<T> {
  readonly value: (row: T) => SortValue;
  readonly descending?: boolean;
}

export function orderKey<T>(
  orderBy: string,
  values: Readonly<Record<string, (row: T) => SortValue>>,
): SortKey<T>[] {
  const descending = orderBy.startsWith("-");
  const value = new Map(Object.entries(values)).get(
    descending ? orderBy.slice(1) : orderBy,
  );
  return value ? [{ value, descending }] : [];
}

function compareValues(a: string | number | boolean, b: typeof a): number {
  if (typeof a === "string" && typeof b === "string") {
    return a.localeCompare(b, "tr", { sensitivity: "accent" });
  }
  return Number(a) - Number(b);
}

function isBlank(value: SortValue): value is null | undefined {
  return value === null || value === undefined;
}

export function compareBy<T extends { readonly id: number }>(
  keys: readonly SortKey<T>[],
): (a: T, b: T) => number {
  return (a, b) => {
    for (const key of keys) {
      const left = key.value(a);
      const right = key.value(b);
      if (isBlank(left) || isBlank(right)) {
        if (isBlank(left) && isBlank(right)) continue;
        return isBlank(left) ? 1 : -1;
      }
      const order = compareValues(left, right);
      if (order !== 0) return key.descending ? -order : order;
    }
    return a.id - b.id;
  };
}

export function dateValue(value: string | null): number | null {
  return value === null ? null : Date.parse(value);
}
