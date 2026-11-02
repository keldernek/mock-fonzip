import { fileURLToPath } from "node:url";

import { readPinnedSpec } from "../src/spec/document";
import { GENERATED_TYPES_PATH } from "../src/spec/source";
import { generateTypes } from "./generate-types";

const clientFile = (name: string): string =>
  fileURLToPath(new URL(`../client/src/generated/${name}`, import.meta.url));

export async function generatedFiles(): Promise<ReadonlyMap<string, string>> {
  const spec = readPinnedSpec();
  return new Map([
    [GENERATED_TYPES_PATH, await generateTypes({ spec })],
    [clientFile("api.ts"), await generateTypes({ spec, rootTypes: true })],
  ]);
}

if (import.meta.main) {
  for (const [path, content] of await generatedFiles()) {
    await Bun.write(path, content);
    console.log(`wrote ${path}`);
  }
}
