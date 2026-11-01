import { readFileSync } from "node:fs";

import { DOMAINS, type Domain } from "../operations";
import { isJsonObject, toJson, type Json } from "../spec/json";
import { documentedPaths } from "../spec/properties";
import type { RouteEntry, RouteTable } from "../spec/routes";
import type { JsonObject } from "../spec/json";
import type { CoverageSnapshot } from "./coverage";

export type OperationSelector =
  | "all"
  | readonly string[]
  | { readonly scope?: "read" | "write"; readonly requestInput?: boolean };

export interface StatusWaiver {
  readonly status: number;
  readonly operations: OperationSelector;
  readonly reason: string;
}

export interface InputWaiver {
  readonly operationId: string;
  readonly input: string;
  readonly reason: string;
}

export interface PropertyWaiver {
  readonly operationId: string;
  readonly path: string;
  readonly reason: string;
}

export interface Waivers {
  readonly statuses: readonly StatusWaiver[];
  readonly inputs: readonly InputWaiver[];
  readonly properties: readonly PropertyWaiver[];
}

export interface OperationParity {
  readonly operationId: string;
  readonly owner: Domain;
  readonly real200: boolean;
  readonly statuses: ReadonlyMap<number, "observed" | "waived" | "missing">;
  readonly missingInputs: readonly string[];
  readonly waivedInputs: number;
  readonly missingProperties: readonly string[];
  readonly waivedProperties: number;
}

function text(node: Json | undefined): string | undefined {
  return typeof node === "string" && node.trim() !== "" ? node : undefined;
}

function selector(node: Json | undefined): OperationSelector | undefined {
  if (node === "all") return "all";
  if (Array.isArray(node) && node.every((item) => typeof item === "string")) {
    return node.filter((item): item is string => typeof item === "string");
  }
  if (isJsonObject(node)) {
    const scope =
      node.scope === "read" || node.scope === "write" ? node.scope : undefined;
    const requestInput =
      typeof node.requestInput === "boolean" ? node.requestInput : undefined;
    return {
      ...(scope ? { scope } : {}),
      ...(requestInput === undefined ? {} : { requestInput }),
    };
  }
  return undefined;
}

export function parseWaivers(
  raw: Json,
  table: RouteTable,
  domain?: Domain,
): Waivers {
  if (!isJsonObject(raw)) throw new Error("waivers must be a JSON object");
  const list = (key: string): JsonObject[] => {
    const value = raw[key];
    if (!Array.isArray(value))
      throw new Error(`waivers.${key} must be an array`);
    return value.map((item, index) => {
      if (!isJsonObject(item))
        throw new Error(`waivers.${key}[${index}] must be an object`);
      if (!text(item.reason))
        throw new Error(`waivers.${key}[${index}] needs a reason`);
      return item;
    });
  };
  const known = (operationId: Json | undefined, where: string): string => {
    const route =
      typeof operationId === "string"
        ? table.byOperationId.get(operationId)
        : undefined;
    if (typeof operationId !== "string" || !route) {
      throw new Error(
        `${where}: unknown operationId ${JSON.stringify(operationId)}`,
      );
    }
    if (domain !== undefined && route.owner !== domain) {
      throw new Error(
        `${where}: ${operationId} belongs to ${route.owner}, not ${domain}`,
      );
    }
    return operationId;
  };
  return {
    statuses: list("statuses").map((item, index) => {
      const operations = selector(item.operations);
      if (typeof item.status !== "number" || !operations) {
        throw new Error(
          `waivers.statuses[${index}] needs a status and operations`,
        );
      }
      if (domain !== undefined && !Array.isArray(operations)) {
        throw new Error(
          `waivers.statuses[${index}]: a domain waiver must list its operations`,
        );
      }
      if (Array.isArray(operations)) {
        for (const id of operations) known(id, `waivers.statuses[${index}]`);
      }
      return {
        status: item.status,
        operations,
        reason: text(item.reason) ?? "",
      };
    }),
    inputs: list("inputs").map((item, index) => ({
      operationId: known(item.operationId, `waivers.inputs[${index}]`),
      input: text(item.input) ?? "",
      reason: text(item.reason) ?? "",
    })),
    properties: list("properties").map((item, index) => ({
      operationId: known(item.operationId, `waivers.properties[${index}]`),
      path: text(item.path) ?? "",
      reason: text(item.reason) ?? "",
    })),
  };
}

function hasRequestInput(route: RouteEntry): boolean {
  return route.parameters.length > 0 || route.body !== null;
}

function selects(selection: OperationSelector, route: RouteEntry): boolean {
  if (selection === "all") return true;
  if (Array.isArray(selection)) return selection.includes(route.operationId);
  const rule = selection;
  if ("scope" in rule && rule.scope !== undefined) {
    if (route.access !== "bearer" || route.scope !== rule.scope) return false;
  }
  if ("requestInput" in rule && rule.requestInput !== undefined) {
    if (hasRequestInput(route) !== rule.requestInput) return false;
  }
  return true;
}

function covered(path: string, waived: readonly string[]): boolean {
  return waived.some(
    (root) =>
      path === root ||
      path.startsWith(`${root}.`) ||
      path.startsWith(`${root}[]`),
  );
}

export function documentedInputs(
  spec: JsonObject,
  route: RouteEntry,
): string[] {
  return [
    ...route.parameters.map((parameter) => `${parameter.in}.${parameter.name}`),
    ...(route.body
      ? [...documentedPaths(spec, route.body.schema)].map(
          (path) => `body.${path}`,
        )
      : []),
  ];
}

export function computeParity(
  spec: JsonObject,
  table: RouteTable,
  coverage: CoverageSnapshot,
  waivers: Waivers,
): OperationParity[] {
  return table.routes.map((route) => {
    const seen = coverage.operations[route.operationId];
    const observed = new Set(seen?.statuses ?? []);
    const statuses = new Map<number, "observed" | "waived" | "missing">();
    for (const status of [...route.responses.keys()].sort((a, b) => a - b)) {
      const waived = waivers.statuses.some(
        (w) => w.status === status && selects(w.operations, route),
      );
      statuses.set(
        status,
        observed.has(status) ? "observed" : waived ? "waived" : "missing",
      );
    }
    const exercised = new Set(seen?.inputs ?? []);
    const inputWaivers = waivers.inputs
      .filter((w) => w.operationId === route.operationId)
      .map((w) => w.input);
    const unexercised = documentedInputs(spec, route).filter(
      (input) => !exercised.has(input),
    );
    const missingInputs = unexercised.filter(
      (input) => !covered(input, inputWaivers),
    );
    const success = route.responses.get(200)?.schema;
    const emitted = new Set(seen?.properties["200"] ?? []);
    const propertyWaivers = waivers.properties
      .filter((w) => w.operationId === route.operationId)
      .map((w) => w.path);
    const unemitted = success
      ? [...documentedPaths(spec, success)].filter((path) => !emitted.has(path))
      : [];
    const missingProperties = unemitted.filter(
      (path) => !covered(path, propertyWaivers),
    );
    return {
      operationId: route.operationId,
      owner: route.owner,
      real200: (seen?.handledStatuses ?? []).includes(200),
      statuses,
      missingInputs,
      waivedInputs: unexercised.length - missingInputs.length,
      missingProperties,
      waivedProperties: unemitted.length - missingProperties.length,
    };
  });
}

export function hasGap(row: OperationParity): boolean {
  return (
    !row.real200 ||
    [...row.statuses.values()].includes("missing") ||
    row.missingInputs.length > 0 ||
    row.missingProperties.length > 0
  );
}

export function mergeWaivers(all: readonly Waivers[]): Waivers {
  return {
    statuses: all.flatMap((waivers) => waivers.statuses),
    inputs: all.flatMap((waivers) => waivers.inputs),
    properties: all.flatMap((waivers) => waivers.properties),
  };
}

const GLOBAL_WAIVERS = new URL("../../parity-waivers.json", import.meta.url);

function domainWaivers(domain: Domain): URL {
  return new URL(`../domains/${domain}/parity-waivers.json`, import.meta.url);
}

function readJsonFile(url: URL): Json {
  return toJson(JSON.parse(readFileSync(url, "utf8")));
}

export function loadWaivers(table: RouteTable): Waivers {
  return mergeWaivers([
    parseWaivers(readJsonFile(GLOBAL_WAIVERS), table),
    ...DOMAINS.filter((domain) => domain !== "foundation").map((domain) =>
      parseWaivers(readJsonFile(domainWaivers(domain)), table, domain),
    ),
  ]);
}
