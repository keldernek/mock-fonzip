import { readFileSync } from "node:fs";
import { parse } from "yaml";

import { toJson, type JsonObject } from "./json";
import { normalizeSpec } from "./normalize";
import { SPEC_PATH } from "./source";

export function readPinnedSpec(): JsonObject {
  return normalizeSpec(toJson(parse(readFileSync(SPEC_PATH, "utf8"))));
}
