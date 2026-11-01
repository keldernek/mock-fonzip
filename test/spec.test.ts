import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { generateTypes } from "../scripts/generate-types";
import { GENERATED_TYPES_PATH } from "../src/spec/source";

test("the committed types match the pinned spec", async () => {
  const committed = readFileSync(GENERATED_TYPES_PATH, "utf8");
  expect(
    committed === (await generateTypes()),
    "src/generated/openapi.d.ts is stale: run `bun run generate`",
  ).toBe(true);
});
