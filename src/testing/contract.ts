import type { Exchange, RawRequest } from "../api/pipeline";
import { presentPaths } from "../spec/properties";
import type { RouteEntry } from "../spec/routes";
import { specRuntime } from "../spec/runtime";
import { coverageFor } from "./coverage";

function inputPaths(request: RawRequest): string[] {
  return [
    ...Object.keys(request.path).map((name) => `path.${name}`),
    ...Object.keys(request.query).map((name) => `query.${name}`),
    ...[...presentPaths(request.body)].map((path) => `body.${path}`),
  ];
}

function check(
  route: RouteEntry,
  status: number,
  body: unknown,
): string | null {
  const response = route.responses.get(status);
  if (!response) {
    return `${route.operationId} answered ${status}, which it does not document`;
  }
  const validate = specRuntime().validators.response(route, status);
  if (validate && !validate(body)) {
    return `${route.operationId} ${status} body breaks its schema: ${JSON.stringify(validate.errors)} body=${JSON.stringify(body).slice(0, 400)}`;
  }
  return null;
}

export interface ContractObserver {
  observe(exchange: Exchange): void;
  takeViolations(): string[];
}

export function createContractObserver(): ContractObserver {
  let violations: string[] = [];
  const unknownPath = specRuntime().validators.component("ObjectNotFound");
  return {
    observe(exchange) {
      if (exchange.kind === "unknown-path") {
        if (!unknownPath(exchange.body))
          violations.push("unknown-path 404 body breaks ObjectNotFound");
        return;
      }
      if (exchange.kind === "method-not-allowed") {
        for (const route of exchange.routes) {
          if (!route.responses.has(405)) continue;
          coverageFor(route.operationId).statuses.add(405);
          const problem = check(route, 405, exchange.body);
          if (problem) violations.push(problem);
        }
        return;
      }
      const { route, status, body, handled, request } = exchange;
      const problem = check(route, status, body);
      if (problem) violations.push(problem);
      const coverage = coverageFor(route.operationId);
      coverage.statuses.add(status);
      if (!handled || status === 501) return;
      coverage.handledStatuses.add(status);
      for (const path of inputPaths(request)) coverage.inputs.add(path);
      const properties = coverage.properties.get(status) ?? new Set<string>();
      for (const path of presentPaths(body)) properties.add(path);
      coverage.properties.set(status, properties);
    },
    takeViolations() {
      const taken = violations;
      violations = [];
      return taken;
    },
  };
}
