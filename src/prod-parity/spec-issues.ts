import type { ErrorObject } from "ajv";

import type { RouteEntry } from "../spec/routes";
import { specRuntime } from "../spec/runtime";
import {
  displayPath,
  isRecord,
  kindOf,
  locate,
  revealEnumMiss,
  safeKey,
} from "./shape";

// Turns ajv's errors for a production body into lines that name paths, JSON
// kinds and spec values, never the body's own values.

const ALTERNATIVES = new Set(["type", "anyOf", "oneOf"]);

const LIMIT_PARAMS: Readonly<Record<string, readonly string[]>> = {
  minimum: ["comparison", "limit"],
  maximum: ["comparison", "limit"],
  exclusiveMinimum: ["comparison", "limit"],
  exclusiveMaximum: ["comparison", "limit"],
  minLength: ["limit"],
  maxLength: ["limit"],
  minItems: ["limit"],
  maxItems: ["limit"],
  minProperties: ["limit"],
  maxProperties: ["limit"],
  multipleOf: ["multipleOf"],
  pattern: ["pattern"],
};

function param(error: ErrorObject, name: string): unknown {
  const params: unknown = error.params;
  return isRecord(params) ? params[name] : undefined;
}

function join(path: string, key: string): string {
  return path === "" ? key : `${path}.${key}`;
}

function expectedTypes(errors: readonly ErrorObject[]): string {
  const types = new Set<string>();
  for (const error of errors) {
    const type = param(error, "type");
    const list = Array.isArray(type) ? type : String(type).split(",");
    for (const item of list) types.add(String(item));
  }
  return [...types].sort().join("|");
}

function describe(body: unknown, error: ErrorObject): string {
  const at = locate(body, error.instancePath);
  const here = displayPath(at.path);
  switch (error.keyword) {
    case "additionalProperties": {
      const key = String(param(error, "additionalProperty"));
      const value = isRecord(at.value) ? at.value[key] : undefined;
      return `${join(at.path, safeKey(key, at.insideMap))}: undocumented property (prod sent ${kindOf(value)})`;
    }
    case "required":
      return `${join(at.path, String(param(error, "missingProperty")))}: missing, the spec requires it`;
    case "enum":
      return `${here}: outside the spec enum ${JSON.stringify(param(error, "allowedValues"))}, prod sent ${revealEnumMiss(at.value)}`;
    case "const":
      return `${here}: the spec requires ${JSON.stringify(param(error, "allowedValue"))}, prod sent ${revealEnumMiss(at.value)}`;
    case "format":
      return `${here}: not a valid ${String(param(error, "format"))} (prod sent a ${kindOf(at.value)} in another format)`;
    default: {
      const names = LIMIT_PARAMS[error.keyword];
      const detail = names
        ? ` ${names.map((name) => `${name}=${JSON.stringify(param(error, name))}`).join(" ")}`
        : "";
      return `${here}: breaks the spec's ${error.keyword}${detail}`;
    }
  }
}

// Ajv reports every failed branch of an anyOf. When a value matched a
// branch's type but broke something inside it, the other branches' type
// errors are noise, so they are dropped.
export function describeErrors(
  body: unknown,
  errors: readonly ErrorObject[],
): string[] {
  const byPath = new Map<string, ErrorObject[]>();
  for (const error of errors) {
    const list = byPath.get(error.instancePath) ?? [];
    list.push(error);
    byPath.set(error.instancePath, list);
  }
  const lines: string[] = [];
  for (const [pointer, group] of byPath) {
    const deeper = errors.some((error) =>
      error.instancePath.startsWith(`${pointer}/`),
    );
    const others = group.filter((error) => !ALTERNATIVES.has(error.keyword));
    const types = group.filter((error) => error.keyword === "type");
    if (others.length === 0 && !deeper) {
      const at = locate(body, pointer);
      const here = displayPath(at.path);
      if (types.length > 0) {
        lines.push(
          `${here}: the spec allows ${expectedTypes(types)}, prod sent ${kindOf(at.value)}`,
        );
      } else if (group.some((error) => error.keyword === "oneOf")) {
        lines.push(`${here}: matches no single oneOf branch of the spec`);
      } else if (group.some((error) => error.keyword === "anyOf")) {
        lines.push(`${here}: matches no anyOf branch of the spec`);
      }
    }
    for (const error of others) lines.push(describe(body, error));
  }
  return lines;
}

export function countLines(lines: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const line of lines) counts.set(line, (counts.get(line) ?? 0) + 1);
  return [...counts]
    .map(([line, count]) => (count > 1 ? `${line} (×${count})` : line))
    .sort();
}

// Checks a production response against the operation's documented response
// for that status, using the same strict validator the mock's tests use.
export function specIssues(
  route: RouteEntry,
  status: number,
  body: unknown,
): string[] {
  if (!route.responses.has(status)) {
    return [
      `status ${status} is not documented for ${route.operationId} (documented: ${[...route.responses.keys()].join(", ")})`,
    ];
  }
  const validate = specRuntime().validators.response(route, status);
  if (!validate || validate(body)) return [];
  return countLines(describeErrors(body, validate.errors ?? []));
}
