import { fileURLToPath } from "node:url";

export const SPEC_URL = "https://fonzip.com/api/v2/documentation-json";
export const SPEC_PATH = fileURLToPath(
  new URL("../../spec/fonzip-openapi.yaml", import.meta.url),
);
export const GENERATED_TYPES_PATH = fileURLToPath(
  new URL("../generated/openapi.d.ts", import.meta.url),
);
