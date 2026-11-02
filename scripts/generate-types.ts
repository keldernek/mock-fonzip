import openapiTS, { astToString } from "openapi-typescript";

import { readPinnedSpec } from "../src/spec/document";
import type { JsonObject } from "../src/spec/json";

export interface GenerateTypesOptions {
  readonly spec?: JsonObject;
  readonly rootTypes?: boolean;
}

export async function generateTypes({
  spec = readPinnedSpec(),
  rootTypes = false,
}: GenerateTypesOptions = {}): Promise<string> {
  const ast = await openapiTS(JSON.stringify(spec), {
    emptyObjectsUnknown: true,
    rootTypes,
    rootTypesNoSchemaPrefix: rootTypes,
  });
  return astToString(ast);
}
