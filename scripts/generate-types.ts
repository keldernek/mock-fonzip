import openapiTS, { astToString } from "openapi-typescript";

import { readPinnedSpec } from "../src/spec/document";

export async function generateTypes(): Promise<string> {
  const ast = await openapiTS(JSON.stringify(readPinnedSpec()));
  return astToString(ast);
}
