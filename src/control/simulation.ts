import type { Organisation } from "../auth/tenancy";
import type { Clock } from "../core/clock";
import type { Rng } from "../core/rng";
import type { OrgStore } from "../store/store";
import type { OrgWebhooks } from "../webhooks/emitter";

export interface SimulationContext {
  readonly org: Organisation;
  readonly store: OrgStore;
  readonly clock: Clock;
  readonly rng: Rng;
  readonly webhooks: OrgWebhooks;
}

export type SimulationResult =
  | { readonly ok: true; readonly body: Readonly<Record<string, unknown>> }
  | {
      readonly ok: false;
      readonly status: 400 | 404 | 409;
      readonly error: string;
    };

export interface Simulation {
  readonly description: string;
  readonly input: Readonly<Record<string, string>>;
  run(input: SimulationInput, ctx: SimulationContext): SimulationResult;
}

export type SimulationFragment = Readonly<Record<string, Simulation>>;

export class SimulationInput {
  constructor(private readonly raw: Readonly<Record<string, unknown>>) {}

  number(name: string): number | undefined {
    const value = this.raw[name];
    return typeof value === "number" && Number.isFinite(value)
      ? value
      : undefined;
  }

  string(name: string): string | undefined {
    const value = this.raw[name];
    return typeof value === "string" ? value : undefined;
  }

  boolean(name: string): boolean | undefined {
    const value = this.raw[name];
    return typeof value === "boolean" ? value : undefined;
  }
}

export function invalid(error: string): SimulationResult {
  return { ok: false, status: 400, error };
}

export function missing(error: string): SimulationResult {
  return { ok: false, status: 404, error };
}
