import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { relative } from "node:path";

import { generatedFiles } from "../scripts/generate";
import { deref, isJsonObject } from "../src/spec/json";
import { specRuntime } from "../src/spec/runtime";

test("the committed generated files match the specs", async () => {
  for (const [path, generated] of await generatedFiles()) {
    expect(
      readFileSync(path, "utf8") === generated,
      `${relative(process.cwd(), path)} is stale: run \`bun run generate\``,
    ).toBe(true);
  }
});

function responseExamples(): {
  operationId: string;
  status: number;
  example: unknown;
}[] {
  const { spec, table } = specRuntime();
  const found: { operationId: string; status: number; example: unknown }[] = [];
  for (const route of table.routes) {
    const paths = spec.paths;
    const item = isJsonObject(paths) ? paths[route.specPath] : undefined;
    const operation = isJsonObject(item) ? item[route.method] : undefined;
    const responses = isJsonObject(operation) ? operation.responses : undefined;
    if (!isJsonObject(responses)) continue;
    for (const [status, raw] of Object.entries(responses)) {
      const response = deref(spec, raw);
      const content = isJsonObject(response) ? response.content : undefined;
      const media = isJsonObject(content)
        ? content["application/json"]
        : undefined;
      if (!isJsonObject(media)) continue;
      const named = isJsonObject(media.examples)
        ? Object.values(media.examples)
        : [];
      const schema = media.schema;
      const candidates = [
        media.example,
        ...named.map((entry) =>
          isJsonObject(entry) ? entry.value : undefined,
        ),
        isJsonObject(schema) ? schema.example : undefined,
      ];
      for (const example of candidates) {
        if (example !== undefined)
          found.push({
            operationId: route.operationId,
            status: Number(status),
            example,
          });
      }
    }
  }
  return found;
}

test("the spec's own response examples pass strict validation, except the getUserList example", () => {
  const { table, validators } = specRuntime();
  const failures = responseExamples().flatMap(
    ({ operationId, status, example }) => {
      const route = table.byOperationId.get(operationId);
      const validate = route ? validators.response(route, status) : null;
      if (!validate || validate(example)) return [];
      return (validate.errors ?? []).map(
        (error) =>
          `${operationId} ${status} ${error.instancePath} ${error.keyword}`,
      );
    },
  );
  expect(responseExamples().length, "examples found").toBe(62);
  expect(failures).toEqual([
    "getUserList 200 /user_list/0 additionalProperties",
    "getUserList 200 /user_list/1 additionalProperties",
  ]);
});

test("the route table serves every documented operation except the authorize endpoint", () => {
  const { spec, table } = specRuntime();
  const paths = isJsonObject(spec.paths) ? spec.paths : {};
  const documented: { operationId: string; secured: boolean }[] = [];
  for (const item of Object.values(paths)) {
    if (!isJsonObject(item)) continue;
    for (const [method, operation] of Object.entries(item)) {
      if (
        !["get", "post", "put", "patch", "delete"].includes(method) ||
        !isJsonObject(operation)
      )
        continue;
      if (typeof operation.operationId !== "string") continue;
      documented.push({
        operationId: operation.operationId,
        secured: Array.isArray(operation.security),
      });
    }
  }
  expect(documented).toHaveLength(121);
  expect(
    documented
      .filter((op) => !op.secured)
      .map((op) => op.operationId)
      .sort(),
    "operations without bearer security",
  ).toEqual(["getAccessToken", "oauthAuthorizeGet"]);
  expect(table.routes.map((route): string => route.operationId).sort()).toEqual(
    documented
      .map((op) => op.operationId)
      .filter((id) => id !== "oauthAuthorizeGet")
      .sort(),
  );
  expect(
    table.routes.every((route) => route.honoPath.startsWith("/api/v2/")),
  ).toBe(true);
  const getUserList = table.byOperationId.get("getUserList");
  expect(
    getUserList?.access === "bearer" && getUserList.scope,
    "POST /users is a search",
  ).toBe("read");
});
