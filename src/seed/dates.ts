import { SEED_ANCHOR } from "../core/clock";

const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

// Every `format: date-time` the API emits: UTC with milliseconds, such as
// `2026-11-01T06:00:00.000Z`, the way production writes them (see PARITY.md).
export function apiDateTime(date: Date): string {
  return date.toISOString();
}

// Every `format: date` the API emits: the calendar day in Istanbul, which is
// UTC+3 all year. Never slice an `apiDateTime` for this: between 21:00Z and
// midnight the UTC day is the day before the Istanbul one.
export function istanbulDate(date: Date): string {
  return new Date(date.getTime() + ISTANBUL_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

// The Istanbul calendar day of a stored value: a date passes through, and a
// date-time (in any offset) gives the day it falls on in Istanbul.
export function istanbulDayOf(text: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : istanbulDate(new Date(text));
}

// The instant a calendar day begins in Istanbul, as a date-time. Istanbul
// midnight is 21:00:00.000Z on the day before.
export function istanbulMidnight(day: string): string {
  return new Date(`${day}T00:00:00+03:00`).toISOString();
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
