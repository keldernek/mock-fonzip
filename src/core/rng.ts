export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly [T, ...T[]]): T;
  pickFrom<T>(items: readonly T[]): T | undefined;
  hex(length: number): string;
  digits(length: number): string;
}

export const DEFAULT_SEED = 20261101;

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number): number =>
    min + Math.floor(next() * (max - min + 1));
  return {
    next,
    int,
    chance: (probability) => next() < probability,
    pick: (items) => items[int(0, items.length - 1)] ?? items[0],
    pickFrom: (items) => items[int(0, items.length - 1)],
    hex: (length) =>
      Array.from({ length }, () => int(0, 15).toString(16)).join(""),
    digits: (length) =>
      Array.from({ length }, () => String(int(0, 9))).join(""),
  };
}
