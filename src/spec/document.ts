import { readFileSync } from "node:fs";
import { parse } from "yaml";

import { isJsonObject, toJson, type JsonObject } from "./json";
import { normalizeSpec } from "./normalize";
import { CONTROL_SPEC_PATH, SPEC_PATH } from "./source";

export function readPinnedSpec(): JsonObject {
  return normalizeSpec(toJson(parse(readFileSync(SPEC_PATH, "utf8"))));
}

export function readControlSpec(): JsonObject {
  const spec = toJson(parse(readFileSync(CONTROL_SPEC_PATH, "utf8")));
  if (!isJsonObject(spec)) throw new Error("the control spec is not an object");
  return spec;
}
