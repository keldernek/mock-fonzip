import { SEED_ANCHOR } from "../core/clock";

const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

export function istanbulDateTime(date: Date): string {
  const local = new Date(date.getTime() + ISTANBUL_OFFSET_MS);
  return (
    `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}` +
    `T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}+03:00`
  );
}

export function istanbulDate(date: Date): string {
  return istanbulDateTime(date).slice(0, 10);
}

export function daysBeforeAnchor(days: number, minutes = 0): Date {
  return new Date(SEED_ANCHOR.getTime() - days * DAY_MS + minutes * 60_000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function monthStart(year: number, month: number): string {
  return `${year}-${pad(month)}-01`;
}
