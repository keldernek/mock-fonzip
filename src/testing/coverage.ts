import { writeFileSync } from "node:fs";

export const COVERAGE_FILE_ENV = "MOCK_FONZIP_COVERAGE_FILE";

export interface OperationCoverage {
  statuses: Set<number>;
  handledStatuses: Set<number>;
  inputs: Set<string>;
  properties: Map<number, Set<string>>;
}

export interface CoverageSnapshot {
  readonly operations: Record<
    string,
    {
      readonly statuses: number[];
      readonly handledStatuses: number[];
      readonly inputs: string[];
      readonly properties: Record<string, string[]>;
    }
  >;
}

const recorded = new Map<string, OperationCoverage>();

export function coverageFor(operationId: string): OperationCoverage {
  let entry = recorded.get(operationId);
  if (!entry) {
    entry = {
      statuses: new Set(),
      handledStatuses: new Set(),
      inputs: new Set(),
      properties: new Map(),
    };
    recorded.set(operationId, entry);
  }
  return entry;
}

export function snapshotCoverage(): CoverageSnapshot {
  return {
    operations: Object.fromEntries(
      [...recorded].map(([operationId, entry]) => [
        operationId,
        {
          statuses: [...entry.statuses].sort((a, b) => a - b),
          handledStatuses: [...entry.handledStatuses].sort((a, b) => a - b),
          inputs: [...entry.inputs].sort(),
          properties: Object.fromEntries(
            [...entry.properties].map(([status, paths]) => [
              String(status),
              [...paths].sort(),
            ]),
          ),
        },
      ]),
    ),
  };
}

export function writeCoverage(): void {
  const target = process.env[COVERAGE_FILE_ENV];
  if (target) writeFileSync(target, JSON.stringify(snapshotCoverage()));
}
