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
  ORG_SLUGS,
  type Credentials,
  type OrgSlug,
  type Tenancy,
} from "./auth/tenancy";
import { createTokenService, type TokenService } from "./auth/tokens";
import { mountControl, type ReceivedNotification } from "./control/router";
import { manualClock, type Clock } from "./core/clock";
import { createRng, DEFAULT_SEED, type Rng } from "./core/rng";
import { seedWorld } from "./seed/world";
import { specRuntime } from "./spec/runtime";
import type { Store } from "./store/store";
import {
  createWebhookEmitter,
  type WebhookEmitter,
  type WebhookFetch,
} from "./webhooks/emitter";

export const DEFAULT_PORT = 8790;

export interface MockOptions {
  readonly clock?: Clock;
  readonly credentials?: Credentials;
  readonly rateLimit?: RateLimit;
  readonly seed?: number;
  readonly selfOrigin?: string;
  readonly fetch?: WebhookFetch;
}

export interface World {
  readonly store: Store;
  readonly rng: Rng;
  readonly limiter: RateLimiter;
  readonly webhooks: WebhookEmitter;
  readonly received: ReceivedNotification[];
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
  const selfOrigin = options.selfOrigin ?? `http://localhost:${DEFAULT_PORT}`;
  const fetcher: WebhookFetch = options.fetch ?? ((request) => fetch(request));
  const tenancy = createTenancy(credentials);
  const tokens = createTokenService(clock, createRng(seed ^ 0x5eed));
  const apiKeyIds = Object.fromEntries(
    ORG_SLUGS.map((slug): [OrgSlug, string[]] => [
      slug,
      tenancy.keys.filter((key) => key.org === slug).map((key) => key.id),
    ]),
  );
  const buildWorld = (): World => {
    const store = seedWorld({
      seed,
      selfOrigin,
      apiKeyIds: {
        kelder: apiKeyIds.kelder ?? [],
        ornek: apiKeyIds.ornek ?? [],
      },
    });
    return {
      store,
      rng: createRng(seed + 1),
      limiter: createRateLimiter(clock, rateLimit),
      webhooks: createWebhookEmitter(store, clock, fetcher),
      received: [],
    };
  };
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
    world: () => world,
  });
  app.notFound(() => json(errorBody(404), 404));
  return { app, runtime };
}
