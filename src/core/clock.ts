export interface Clock {
  now(): Date;
  advance(milliseconds: number): void;
}

export const SEED_ANCHOR = new Date("2026-11-01T09:00:00+03:00");

export function manualClock(start: Date = SEED_ANCHOR): Clock {
  let current = start.getTime();
  return {
    now: () => new Date(current),
    advance(milliseconds) {
      current += milliseconds;
    },
  };
}

export function runningClock(
  start: Date = SEED_ANCHOR,
  realNow: () => number = Date.now,
): Clock {
  const bootedAt = realNow();
  let offset = 0;
  return {
    now: () => new Date(start.getTime() + (realNow() - bootedAt) + offset),
    advance(milliseconds) {
      offset += milliseconds;
    },
  };
}
