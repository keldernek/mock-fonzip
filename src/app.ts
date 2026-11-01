import { Hono } from "hono";

import { errorBody, json } from "./api/errors";
import { mountApi } from "./api/pipeline";
import {
  createRateLimiter,
  DEFAULT_RATE_LIMIT,
  type RateLimit,
  type RateLimiter,
} from "./api/rate-limit";
import {
  createTenancy,
  credentialsFromEnv,
  type Credentials,
  type Tenancy,
} from "./auth/tenancy";
import { createTokenService, type TokenService } from "./auth/tokens";
import { manualClock, type Clock } from "./core/clock";
import { createRng, DEFAULT_SEED, type Rng } from "./core/rng";
import { mountControl } from "./control/router";
import { specRuntime } from "./spec/runtime";

export interface MockOptions {
  readonly clock?: Clock;
  readonly credentials?: Credentials;
  readonly rateLimit?: RateLimit;
  readonly seed?: number;
}

interface World {
  readonly rng: Rng;
  readonly limiter: RateLimiter;
}

export interface MockRuntime {
  readonly clock: Clock;
  readonly tenancy: Tenancy;
  readonly tokens: TokenService;
  readonly rateLimit: RateLimit;
  readonly credentials: Credentials;
  world(): World;
  reset(): void;
}

export interface MockFonzip {
  readonly app: Hono;
  readonly runtime: MockRuntime;
}

export function createMockFonzip(options: MockOptions = {}): MockFonzip {
  const clock = options.clock ?? manualClock();
  const credentials = options.credentials ?? credentialsFromEnv();
  const rateLimit = options.rateLimit ?? DEFAULT_RATE_LIMIT;
  const seed = options.seed ?? DEFAULT_SEED;
  const tenancy = createTenancy(credentials);
  const tokens = createTokenService(clock, createRng(seed ^ 0x5eed));
  const buildWorld = (): World => ({
    rng: createRng(seed + 1),
    limiter: createRateLimiter(clock, rateLimit),
  });
  let world = buildWorld();
  const runtime: MockRuntime = {
    clock,
    tenancy,
    tokens,
    rateLimit,
    credentials,
    world: () => world,
    reset() {
      world = buildWorld();
      tenancy.resetPlans();
    },
  };

  const { table, validators } = specRuntime();
  const app = new Hono();
  mountControl(app, runtime);
  mountApi(app, {
    table,
    validators,
    tenancy,
    tokens,
    clock,
    rng: () => world.rng,
    limiter: () => world.limiter,
  });
  app.notFound(() => json(errorBody(404), 404));
  return { app, runtime };
}
