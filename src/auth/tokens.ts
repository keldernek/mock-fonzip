import type { Clock } from "../core/clock";
import type { Rng } from "../core/rng";
import type { ApiKey } from "./tenancy";

export const TOKEN_LIFETIME_SECONDS = 3600;
export const TOKENS_KEPT_PER_KEY = 5;

interface IssuedToken {
  readonly key: ApiKey;
  readonly expiresAt: number;
}

export interface TokenService {
  issue(key: ApiKey): { accessToken: string; expiresIn: number };
  resolve(accessToken: string): ApiKey | null;
}

export function createTokenService(clock: Clock, rng: Rng): TokenService {
  const tokens = new Map<string, IssuedToken>();
  const newestByKey = new Map<string, string[]>();
  return {
    issue(key) {
      const accessToken = `fz_${rng.hex(40)}`;
      tokens.set(accessToken, {
        key,
        expiresAt: clock.now().getTime() + TOKEN_LIFETIME_SECONDS * 1000,
      });
      const kept = [...(newestByKey.get(key.id) ?? []), accessToken];
      for (const retired of kept.splice(0, kept.length - TOKENS_KEPT_PER_KEY)) {
        tokens.delete(retired);
      }
      newestByKey.set(key.id, kept);
      return { accessToken, expiresIn: TOKEN_LIFETIME_SECONDS };
    },
    resolve(accessToken) {
      const token = tokens.get(accessToken);
      if (!token || clock.now().getTime() >= token.expiresAt) return null;
      return token.key;
    },
  };
}
