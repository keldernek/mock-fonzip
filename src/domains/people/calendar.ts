const DAY_MS = 86_400_000;
const ISTANBUL_OFFSET_MS = 3 * 3_600_000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export type Day = number & { readonly __day: unique symbol };

function asDay(value: number): Day {
  return value as Day;
}

export function dayOf(text: string): Day | null {
  const dateOnly = DATE_ONLY.exec(text);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return asDay(
      Date.UTC(Number(year), Number(month) - 1, Number(day)) / DAY_MS,
    );
  }
  const at = Date.parse(text);
  return Number.isNaN(at)
    ? null
    : asDay(Math.floor((at + ISTANBUL_OFFSET_MS) / DAY_MS));
}

export function dayOfInstant(at: Date): Day {
  return asDay(Math.floor((at.getTime() + ISTANBUL_OFFSET_MS) / DAY_MS));
}

export function addDays(day: Day, days: number): Day {
  return asDay(day + days);
}

export function monthDay(day: Day): number {
  const date = new Date(day * DAY_MS);
  return (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
}

export function anniversaryIn(day: Day, reference: Day): Day {
  const birth = new Date(day * DAY_MS);
  const year = new Date(reference * DAY_MS).getUTCFullYear();
  const month = birth.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return asDay(
    Date.UTC(year, month, Math.min(birth.getUTCDate(), lastDay)) / DAY_MS,
  );
}

export function wholeYearsBetween(from: Day, to: Day): number {
  const start = new Date(from * DAY_MS);
  const end = new Date(to * DAY_MS);
  const years = end.getUTCFullYear() - start.getUTCFullYear();
  const beforeAnniversary =
    end.getUTCMonth() < start.getUTCMonth() ||
    (end.getUTCMonth() === start.getUTCMonth() &&
      end.getUTCDate() < start.getUTCDate());
  return beforeAnniversary ? years - 1 : years;
}
