import type { Clock } from "../core/clock";

export interface RateLimit {
  readonly limit: number;
  readonly windowMs: number;
}

export const DEFAULT_RATE_LIMIT: RateLimit = { limit: 60, windowMs: 60_000 };

export interface RateLimiter {
  hit(key: string): boolean;
}

export function createRateLimiter(
  clock: Clock,
  { limit, windowMs }: RateLimit,
): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    hit(key) {
      const now = clock.now().getTime();
      const recent = (hits.get(key) ?? []).filter((at) => now - at < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      hits.set(key, [...recent, now]);
      return true;
    },
  };
}
