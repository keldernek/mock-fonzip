import type { ServedOperationId } from "../operations";
import { routeOf, type CallInput } from "../testing/client";
import {
  AREAS,
  methodOf,
  PROBES,
  STEPS,
  type Area,
  type Ids,
  type Probe,
  type ShapeStep,
  type Side,
} from "./plan";
import { diffShapes, errorTextOf, sanitizeErrorText, shapeOf } from "./shape";
import { specIssues } from "./spec-issues";
import type { Exchange, MockTarget, ProdConnection } from "./targets";

// Runs the plan against production and the in-process mock and reports only
// what is safe to print: property paths, JSON kinds, status codes, values
// from the spec, numeric and boolean enum misses, and masked error texts. A
// production value never reaches `out`.
//
// ProdUnavailableError and RefusedRequestError come from the production
// target and are not caught here: they abort the run.

export const CHECKS = ["spec", "mock", "errors"] as const;
export type Check = (typeof CHECKS)[number];

export interface ParityOptions {
  // Printed in the header. Only its origin is shown.
  readonly origin: string;
  readonly areas: readonly Area[];
  readonly checks: readonly Check[];
  readonly prod: ProdConnection;
  readonly mock: MockTarget;
  readonly out: (line: string) => void;
}

export interface ParitySummary {
  readonly shape: {
    readonly ran: number;
    readonly ok: number;
    readonly differ: number;
    readonly skipped: number;
  };
  readonly probes: {
    readonly ran: number;
    readonly ok: number;
    readonly differ: number;
  };
  readonly findings: number;
  readonly notes: number;
  // 0 when nothing differs, 1 otherwise. Notes alone do not count.
  readonly exitCode: 0 | 1;
}

type Tag = "spec" | "diff" | "prod" | "mock";

interface Outcome {
  readonly findings: { readonly tag: Tag; readonly text: string }[];
  readonly notes: string[];
}

const HEADLINE =
  "Production values are never printed: only paths, JSON kinds, status codes, spec values, numeric/boolean enum misses and masked error texts.";
const MAX_PROBLEM = 400;

function newOutcome(): Outcome {
  return { findings: [], notes: [] };
}

function originOf(origin: string): string {
  try {
    return new URL(origin).origin;
  } catch {
    return "(an origin that is not a URL)";
  }
}

// Messages from the mock's own contract check describe synthetic data.
function problemText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const flat = message.replaceAll(/\s+/g, " ").trim();
  return flat.length > MAX_PROBLEM ? `${flat.slice(0, MAX_PROBLEM)}…` : flat;
}

function quoted(text: string | null): string {
  return text === null ? "(none)" : `"${text}"`;
}

// What a non-2xx answer says. Error text is read only from error statuses.
function answered(exchange: Exchange): string {
  const text = exchange.status >= 400 ? errorTextOf(exchange.body) : null;
  return `answered ${exchange.status}${text === null ? "" : `: ${quoted(text)}`}`;
}

function nonJsonText(exchange: Exchange): string {
  return `answered ${exchange.status} with ${sanitizeErrorText(exchange.nonJson ?? "no content type")} instead of JSON`;
}

function compare(prod: Exchange, mock: Exchange, outcome: Outcome): void {
  const diff = diffShapes(shapeOf(prod.body), shapeOf(mock.body));
  for (const path of diff.prodOnly) {
    outcome.findings.push({ tag: "diff", text: `only in prod: ${path}` });
  }
  for (const line of diff.prodKinds) {
    outcome.findings.push({ tag: "diff", text: `kind differs: ${line}` });
  }
  for (const path of diff.mockOnly) {
    outcome.notes.push(`only in mock: ${path}`);
  }
  for (const line of diff.mockKinds) {
    outcome.notes.push(`kind in mock only: ${line}`);
  }
}

function isJson200(exchange: Exchange): boolean {
  return exchange.status === 200 && exchange.nonJson === undefined;
}

async function callMock(
  mock: MockTarget,
  operationId: ServedOperationId,
  input: CallInput,
  outcome: Outcome,
): Promise<Exchange | undefined> {
  try {
    return await mock.call(operationId, input);
  } catch (error) {
    outcome.findings.push({
      tag: "mock",
      text: `breaks its own contract: ${problemText(error)}`,
    });
    return undefined;
  }
}

export async function runParity(
  options: ParityOptions,
): Promise<ParitySummary> {
  const { prod, mock, out } = options;
  const checks = new Set<Check>(options.checks);
  const areas = AREAS.filter((area) => options.areas.includes(area));
  const prodSide: Side = { now: () => prod.target.now(), ids: new Map() };
  const mockSide: Side = {
    now: () => mock.now(),
    ids: new Map(),
    credentials: mock.credentials,
  };
  const shape = { ran: 0, ok: 0, differ: 0, skipped: 0 };
  const probes = { ran: 0, ok: 0, differ: 0 };
  let findings = 0;
  let notes = 0;

  const report = (
    head: string,
    outcome: Outcome,
    sent: string | null,
  ): boolean => {
    const differs = outcome.findings.length > 0;
    out(`${differs ? "DIFF" : "ok"}`.padEnd(5) + head);
    if (differs && sent !== null) out(`     sent ${sent}`);
    for (const finding of outcome.findings) {
      out(`     ${finding.tag} ${finding.text}`);
    }
    for (const note of outcome.notes) out(`     note ${note}`);
    findings += outcome.findings.length;
    notes += outcome.notes.length;
    return differs;
  };

  const remember = (step: ShapeStep, body: unknown, ids: Ids): void =>
    step.remember?.(body, ids);

  const runStep = async (step: ShapeStep): Promise<void> => {
    const route = routeOf(step.operationId);
    const head = `${step.operationId}  ${methodOf(step.operationId)} ${route.specPath}`;
    const skip = (reason: string): void => {
      shape.skipped += 1;
      out(`skip ${head} — ${reason}`);
    };
    let answer: Exchange;
    if (step.usesMintedToken) {
      if (prod.minted === null) {
        skip("a token was supplied, so nothing was minted to compare");
        return;
      }
      answer = prod.minted;
    } else {
      const built = step.build(prodSide);
      if ("missing" in built) {
        skip(built.missing);
        return;
      }
      answer = await prod.target.call(step.operationId, built.input);
    }
    const outcome = newOutcome();
    if (answer.nonJson !== undefined) {
      outcome.findings.push({ tag: "prod", text: nonJsonText(answer) });
    } else {
      if (answer.status !== 200) {
        outcome.findings.push({ tag: "prod", text: answered(answer) });
      } else {
        remember(step, answer.body, prodSide.ids);
      }
      if (checks.has("spec")) {
        for (const line of specIssues(route, answer.status, answer.body)) {
          outcome.findings.push({ tag: "spec", text: line });
        }
      }
    }
    if (checks.has("mock")) {
      const built = step.build(mockSide);
      if ("missing" in built) {
        outcome.notes.push(`mock side skipped: ${built.missing}`);
      } else {
        const twin = await callMock(
          mock,
          step.operationId,
          built.input,
          outcome,
        );
        if (twin) {
          if (twin.status === 200) {
            remember(step, twin.body, mockSide.ids);
          } else {
            outcome.findings.push({ tag: "mock", text: answered(twin) });
          }
          if (isJson200(answer) && isJson200(twin)) {
            compare(answer, twin, outcome);
          }
        }
      }
    }
    shape.ran += 1;
    if (report(head, outcome, step.sends)) shape.differ += 1;
    else shape.ok += 1;
  };

  const runProbe = async (probe: Probe): Promise<void> => {
    const route = routeOf(probe.operationId);
    const head = `${probe.operationId}  ${methodOf(probe.operationId, probe.input)} ${route.specPath}  [${probe.sends}]`;
    const outcome = newOutcome();
    const answer = await prod.target.call(probe.operationId, probe.input);
    const twin = await callMock(mock, probe.operationId, probe.input, outcome);
    if (answer.nonJson !== undefined) {
      outcome.findings.push({ tag: "prod", text: nonJsonText(answer) });
    } else {
      for (const line of specIssues(route, answer.status, answer.body)) {
        outcome.findings.push({ tag: "spec", text: line });
      }
    }
    if (twin) {
      if (twin.status !== answer.status) {
        outcome.findings.push({
          tag: "diff",
          text: `status differs: prod ${answer.status}, mock ${twin.status}`,
        });
      } else if (answer.nonJson === undefined) {
        compare(answer, twin, outcome);
      }
      if (answer.status >= 400 && twin.status >= 400) {
        const prodText = errorTextOf(answer.body);
        const mockText = errorTextOf(twin.body);
        if (prodText !== mockText) {
          outcome.notes.push(
            `error text differs: prod ${quoted(prodText)}, mock ${quoted(mockText)}`,
          );
        }
      }
    }
    probes.ran += 1;
    if (report(head, outcome, null)) probes.differ += 1;
    else probes.ok += 1;
  };

  out("Fonzip production parity (read-only)");
  out(`Origin: ${originOf(options.origin)}`);
  out(
    prod.minted === null
      ? "Token: supplied, so nothing was minted"
      : "Token: minted from the client id and secret",
  );
  out(`Areas: ${areas.join(", ")}`);
  out(`Checks: ${CHECKS.filter((check) => checks.has(check)).join(", ")}`);
  out(HEADLINE);

  const runShape = checks.has("spec") || checks.has("mock");
  for (const area of areas) {
    out("");
    out(`== ${area} ==`);
    if (runShape) {
      for (const step of STEPS.filter((candidate) => candidate.area === area)) {
        await runStep(step);
      }
    }
    if (checks.has("errors")) {
      for (const probe of PROBES.filter(
        (candidate) => candidate.area === area,
      )) {
        await runProbe(probe);
      }
    }
  }

  out("");
  out(
    `Summary: shape ${shape.ran} ran (${shape.ok} ok, ${shape.differ} differ), ${shape.skipped} skipped; error probes ${probes.ran} ran (${probes.ok} ok, ${probes.differ} differ); ${findings} findings, ${notes} notes.`,
  );
  return {
    shape,
    probes,
    findings,
    notes,
    exitCode: findings === 0 ? 0 : 1,
  };
}
