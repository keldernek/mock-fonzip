import type { JsonObject } from "../json";
import { AUTH_CORRECTIONS } from "./auth";
import { applyCorrections, type ProductionCorrection } from "./correct";
import { DUES_CORRECTIONS } from "./dues";
import { FORMS_CORRECTIONS } from "./forms";
import { PEOPLE_CORRECTIONS } from "./people";
import { TEMPLATES_CORRECTIONS } from "./templates";

// Each area owns one file, named after its `parity:prod --area`, so work on
// one area never edits another's corrections.
export const PRODUCTION_CORRECTIONS: Readonly<
  Record<string, readonly ProductionCorrection[]>
> = {
  auth: AUTH_CORRECTIONS,
  people: PEOPLE_CORRECTIONS,
  templates: TEMPLATES_CORRECTIONS,
  dues: DUES_CORRECTIONS,
  forms: FORMS_CORRECTIONS,
};

export function applyProductionCorrections(spec: JsonObject): JsonObject {
  return applyCorrections(spec, Object.values(PRODUCTION_CORRECTIONS).flat());
}
