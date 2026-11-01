import { readPinnedSpec } from "./document";
import type { JsonObject } from "./json";
import { buildRouteTable, type RouteTable } from "./routes";
import { createValidators, type Validators } from "./validation";

export interface SpecRuntime {
  readonly spec: JsonObject;
  readonly table: RouteTable;
  readonly validators: Validators;
}

let cached: SpecRuntime | undefined;

export function specRuntime(): SpecRuntime {
  if (!cached) {
    const spec = readPinnedSpec();
    const table = buildRouteTable(spec);
    cached = { spec, table, validators: createValidators(spec, table) };
  }
  return cached;
}
