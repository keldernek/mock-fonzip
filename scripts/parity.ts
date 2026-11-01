import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { DOMAINS, NOT_SERVED, type Domain } from "../src/operations";
import { specRuntime } from "../src/spec/runtime";
import {
  COVERAGE_FILE_ENV,
  type CoverageSnapshot,
} from "../src/testing/coverage";
import {
  computeParity,
  hasGap,
  loadWaivers,
  type OperationParity,
} from "../src/testing/parity";

const APP_DIR = fileURLToPath(new URL("..", import.meta.url));

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const domainArgument = argument("--domain");
const domain: Domain | undefined = DOMAINS.find(
  (candidate) => candidate === domainArgument,
);
if (domainArgument !== undefined && domain === undefined) {
  console.error(
    `unknown domain ${domainArgument}; pick one of ${DOMAINS.join(", ")}`,
  );
  process.exit(2);
}

const coverageFile = join(
  mkdtempSync(join(tmpdir(), "mock-fonzip-parity-")),
  "coverage.json",
);
const run = Bun.spawnSync(["bun", "test"], {
  cwd: APP_DIR,
  env: { ...process.env, [COVERAGE_FILE_ENV]: coverageFile },
  stdout: "pipe",
  stderr: "pipe",
});
const testOutput = `${run.stdout.toString()}${run.stderr.toString()}`;
const summary = testOutput
  .split("\n")
  .filter((line) => /^\s*\d+ (pass|fail)|^Ran /.test(line));
console.log(`test suite: ${summary.map((line) => line.trim()).join(", ")}`);
if (run.exitCode !== 0) {
  console.log(testOutput);
  console.error("the test suite failed, so parity was not computed");
  process.exit(1);
}

function isCoverageSnapshot(value: unknown): value is CoverageSnapshot {
  return typeof value === "object" && value !== null && "operations" in value;
}
const parsedCoverage: unknown = JSON.parse(readFileSync(coverageFile, "utf8"));
if (!isCoverageSnapshot(parsedCoverage))
  throw new Error("coverage file is malformed");

const { spec, table } = specRuntime();
const waivers = loadWaivers(table);
const rows = computeParity(spec, table, parsedCoverage, waivers).filter(
  (row) => domain === undefined || row.owner === domain,
);

const pad = (value: string, width: number): string => value.padEnd(width);
const ownerWidth = Math.max(...rows.map((row) => row.owner.length), 5) + 2;
const opWidth = Math.max(...rows.map((row) => row.operationId.length), 9) + 2;
const label = (row: OperationParity): string =>
  `${pad(row.owner, ownerWidth)}${pad(row.operationId, opWidth)}`;

console.log(
  `\n1. Operations returning a real 200 (not the 501 stub)${domain ? `, domain ${domain}` : ""}`,
);
console.log(`${pad("owner", ownerWidth)}${pad("operation", opWidth)}200`);
for (const row of rows)
  console.log(`${label(row)}${row.real200 ? "yes" : "NO"}`);

const allStatuses = [
  ...new Set(table.routes.flatMap((route) => [...route.responses.keys()])),
].sort((a, b) => a - b);
console.log(
  "\n2. Documented statuses observed per operation (+ observed, w waived, X missing, . undocumented)",
);
console.log(
  `${pad("owner", ownerWidth)}${pad("operation", opWidth)}${allStatuses.map((status) => pad(String(status), 4)).join("")}`,
);
const mark = { observed: "+", waived: "w", missing: "X" } as const;
for (const row of rows) {
  const cells = allStatuses.map((status) => {
    const state = row.statuses.get(status);
    return pad(state ? mark[state] : ".", 4);
  });
  console.log(`${label(row)}${cells.join("")}`);
}

console.log("\n3. Documented parameters and body fields never exercised");
const inputGaps = rows.filter((row) => row.missingInputs.length > 0);
if (inputGaps.length === 0) console.log("none");
for (const row of inputGaps)
  console.log(`${label(row)}${row.missingInputs.join(", ")}`);

console.log("\n4. Documented 200 response properties never emitted");
const propertyGaps = rows.filter((row) => row.missingProperties.length > 0);
if (propertyGaps.length === 0) console.log("none");
for (const row of propertyGaps)
  console.log(`${label(row)}${row.missingProperties.join(", ")}`);

console.log("\nSummary by domain");
console.log(
  `${pad("domain", ownerWidth)}${pad("ops", 6)}${pad("real 200", 10)}${pad("status gaps", 13)}${pad("input gaps", 12)}${pad("property gaps", 15)}waived`,
);
for (const owner of DOMAINS) {
  const own = rows.filter((row) => row.owner === owner);
  if (own.length === 0) continue;
  const statusGaps = own.reduce(
    (sum, row) =>
      sum +
      [...row.statuses.values()].filter((state) => state === "missing").length,
    0,
  );
  const waivedStatuses = own.reduce(
    (sum, row) =>
      sum +
      [...row.statuses.values()].filter((state) => state === "waived").length,
    0,
  );
  const inputs = own.reduce((sum, row) => sum + row.missingInputs.length, 0);
  const properties = own.reduce(
    (sum, row) => sum + row.missingProperties.length,
    0,
  );
  const waived =
    waivedStatuses +
    own.reduce((sum, row) => sum + row.waivedInputs + row.waivedProperties, 0);
  console.log(
    `${pad(owner, ownerWidth)}${pad(String(own.length), 6)}${pad(`${own.filter((row) => row.real200).length}/${own.length}`, 10)}${pad(String(statusGaps), 13)}${pad(String(inputs), 12)}${pad(String(properties), 15)}${waived}`,
  );
}
if (domain === undefined) {
  console.log(`not served by decision: ${NOT_SERVED.join(", ")}`);
}

const gaps = rows.filter(hasGap);
if (gaps.length > 0) {
  console.log(
    `\n${gaps.length} operation(s) with unwaived gaps: ${gaps.map((row) => row.operationId).join(", ")}`,
  );
  process.exit(1);
}
console.log("\nno unwaived gaps");
