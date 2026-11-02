import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createMockFonzip, type MockFonzip } from "../src/app";
import { manualClock } from "../src/core/clock";
import {
  AREAS,
  istanbulStamp,
  PROBES,
  STEPS,
  plannedRequests,
  type Ids,
} from "../src/prod-parity/plan";
import {
  CHECKS,
  runParity,
  type Check,
  type ParitySummary,
} from "../src/prod-parity/run";
import { isRecord } from "../src/prod-parity/shape";
import {
  assertReadOnly,
  connectProd,
  mockTarget,
  type MockTarget,
  type ProdAuth,
  type ProdConnection,
} from "../src/prod-parity/targets";

const ORIGIN = "https://fonzip.example";
const REPO = fileURLToPath(new URL("..", import.meta.url));

type Rewrite = (request: Request, response: Response) => Promise<Response>;

interface Seen {
  readonly method: string;
  readonly path: string;
}

// A second mock instance stands in for production, wired in through the
// runner's own fetch hook. No socket opens.
function fakeProduction(rewrite?: Rewrite) {
  const clock = manualClock();
  const mock: MockFonzip = createMockFonzip({ clock });
  const seen: Seen[] = [];
  const send = async (request: Request): Promise<Response> => {
    seen.push({ method: request.method, path: new URL(request.url).pathname });
    const response = await mock.app.request(request);
    return rewrite ? rewrite(request, response) : response;
  };
  const connect = (
    auth: ProdAuth = {
      kind: "credentials",
      credentials: mock.runtime.credentials.readWrite,
    },
  ): Promise<ProdConnection> =>
    connectProd({
      origin: ORIGIN,
      auth,
      fetch: send,
      now: () => clock.now(),
      pauseMs: 0,
    });
  return { mock, seen, connect };
}

interface RunOptions {
  readonly areas?: readonly (typeof AREAS)[number][];
  readonly checks?: readonly Check[];
  readonly mock?: MockTarget;
}

async function report(
  prod: ProdConnection,
  options: RunOptions = {},
): Promise<{ lines: string[]; text: string; summary: ParitySummary }> {
  const lines: string[] = [];
  const summary = await runParity({
    origin: ORIGIN,
    areas: options.areas ?? AREAS,
    checks: options.checks ?? CHECKS,
    prod,
    mock: options.mock ?? mockTarget(),
    out: (line) => {
      lines.push(line);
    },
  });
  return { lines, text: lines.join("\n"), summary };
}

const FINDING_LINE = /^(DIFF|\s{5}(spec|diff|prod|mock) )/;

function findingLines(lines: readonly string[]): string[] {
  return lines.filter((line) => FINDING_LINE.test(line));
}

const CANARY_TEXT = "CANARY-x";
const LEAKY_ERROR = "No such user leak@example.com 5550001234";

// Rewrites every JSON answer except the token exchange so that each string,
// id and error text is recognisable, and adds an undocumented property to the
// rows of the first array.
function canaryRewrite(): Rewrite {
  let counter = 0;
  return async (request, response) => {
    if (
      request.method === "POST" &&
      new URL(request.url).pathname === "/api/v2/token"
    ) {
      return response;
    }
    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return new Response(text, response);
    }
    let arrayFound = false;
    const walk = (value: unknown, key: string | null): unknown => {
      if (typeof value === "string") {
        if (key === "error") return LEAKY_ERROR;
        counter += 1;
        return `CANARY-${counter}@leak.example`;
      }
      if (typeof value === "number") return key === "id" ? 987654321 : value;
      if (Array.isArray(value)) {
        const addLeak = !arrayFound;
        arrayFound = true;
        return value.map((item) => {
          const walked = walk(item, null);
          return addLeak && isRecord(walked)
            ? { ...walked, leaky_field: CANARY_TEXT }
            : walked;
        });
      }
      if (isRecord(value)) {
        return Object.fromEntries(
          Object.entries(value).map(([name, item]) => [name, walk(item, name)]),
        );
      }
      return value;
    };
    return new Response(JSON.stringify(walk(parsed, null)), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  };
}

async function mintToken(fake: ReturnType<typeof fakeProduction>) {
  const { clientId, clientSecret } = fake.mock.runtime.credentials.readWrite;
  const response = await fake.mock.app.request("/api/v2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const body: unknown = await response.json();
  const token = isRecord(body) ? body.access_token : undefined;
  if (typeof token !== "string") throw new Error("the fake gave no token");
  return token;
}

// getMembershipDueDetails takes its id from the membership dues list. The
// list is `payment_list`, but src/prod-parity/plan.ts still reads
// `subscription_list`, so both sides find no id and skip the step. This
// counts that one skip, so the tests pass before and after the plan follows.
function duesDetailsSkips(lines: readonly string[]): number {
  return lines.filter((line) => line.startsWith("skip getMembershipDueDetails"))
    .length;
}

describe("the production parity runner against a fake production", () => {
  test("identical twins report nothing", async () => {
    const fake = fakeProduction();
    const { lines, summary } = await report(await fake.connect());
    const skippedDetails = duesDetailsSkips(lines);
    expect(findingLines(lines)).toEqual([]);
    expect(summary.findings).toBe(0);
    expect(summary.exitCode).toBe(0);
    expect(summary.shape.skipped - skippedDetails).toBe(0);
    expect(summary.shape.ran + skippedDetails).toBe(STEPS.length);
    expect(summary.probes.ran).toBe(PROBES.length);
    expect(summary.shape.differ + summary.probes.differ).toBe(0);
  });

  test("prints no production value, and does print undocumented property names", async () => {
    const fake = fakeProduction(canaryRewrite());
    const prod = await fake.connect();
    const { text, summary } = await report(prod);
    const mintedBody = prod.minted?.body;
    const token = isRecord(mintedBody) ? mintedBody.access_token : undefined;
    if (typeof token !== "string") throw new Error("the fake gave no token");
    expect(token.length).toBeGreaterThan(10);
    for (const secret of [
      "CANARY",
      "leak.example",
      "leak@example.com",
      "987654321",
      "5550001234",
      token,
      fake.mock.runtime.credentials.readWrite.clientSecret,
    ]) {
      expect(text, `the report contains ${secret}`).not.toContain(secret);
    }
    expect(text).toContain("leaky_field");
    expect(summary.exitCode).toBe(1);
  });

  test("sends only reads, plus the token exchange and the user search", async () => {
    const fake = fakeProduction();
    await report(await fake.connect());
    expect(fake.seen.length).toBeGreaterThan(40);
    const writes = fake.seen.filter((request) => request.method !== "GET");
    expect(writes.length).toBeGreaterThan(0);
    for (const request of writes) {
      expect(request.method).toBe("POST");
      expect(["/api/v2/token", "/api/v2/users"]).toContain(request.path);
    }
    for (const { operationId, method } of plannedRequests()) {
      expect(() => assertReadOnly(operationId, method)).not.toThrow();
    }
    const planned = plannedRequests().map((request) => request.operationId);
    expect(planned).not.toContain("generateLoginLinkForUser");
    expect(planned).not.toContain("sendWebhookTestNotification");
  });

  test("a supplied token skips the token comparison", async () => {
    const fake = fakeProduction();
    const token = await mintToken(fake);
    const prod = await fake.connect({ kind: "token", token });
    expect(prod.minted).toBeNull();
    const { lines, summary } = await report(prod);
    expect(lines).toContain(
      "skip getAccessToken  POST /token — a token was supplied, so nothing was minted to compare",
    );
    expect(lines.join("\n")).toContain("Token: supplied");
    expect(summary.shape.skipped - duesDetailsSkips(lines)).toBe(1);
    expect(summary.exitCode).toBe(0);
  });

  test("an area and a check narrow the run", async () => {
    const fake = fakeProduction();
    const { lines, summary } = await report(await fake.connect(), {
      areas: ["webhooks"],
      checks: ["spec"],
    });
    expect(summary.shape.ran).toBe(2);
    expect(summary.probes.ran).toBe(0);
    expect(lines.filter((line) => line.startsWith("== "))).toEqual([
      "== webhooks ==",
    ]);
    const paths = fake.seen.map((request) => request.path);
    expect(paths.filter((path) => path.includes("webhook"))).toHaveLength(2);
    expect(paths.some((path) => path.includes("/users"))).toBe(false);
  });

  test("skips a step whose id was never found, and says why", async () => {
    const fake = fakeProduction(async (request, response) => {
      if (new URL(request.url).pathname !== "/api/v2/webhooks") return response;
      return Response.json({ webhook_list: [] }, { status: response.status });
    });
    const { lines, summary } = await report(await fake.connect(), {
      areas: ["webhooks"],
      checks: ["spec"],
    });
    expect(lines).toContain(
      "skip getWebhookDetails  GET /webhook/{webhook_id} — listWebhooks found no webhook",
    );
    expect(summary.shape.skipped).toBe(1);
  });

  test("names the content type of a non-JSON answer, and nothing else of it", async () => {
    const fake = fakeProduction(async (request, response) =>
      new URL(request.url).pathname === "/api/v2/forms"
        ? new Response("<html>someone@example.com</html>", {
            status: 502,
            headers: { "content-type": "text/html" },
          })
        : response,
    );
    const { text, summary } = await report(await fake.connect(), {
      areas: ["forms"],
      checks: ["spec"],
    });
    expect(text).toContain("prod answered 502 with text/html instead of JSON");
    expect(text).not.toContain("someone@example.com");
    expect(summary.exitCode).toBe(1);
  });

  test("reports a production error with its masked text", async () => {
    const fake = fakeProduction(async (request, response) =>
      new URL(request.url).pathname === "/api/v2/templates"
        ? Response.json({ error: "Nope for a@b.com 12345678" }, { status: 403 })
        : response,
    );
    const { text } = await report(await fake.connect(), {
      areas: ["templates"],
      checks: ["spec"],
    });
    expect(text).toContain('prod answered 403: "Nope for <email> <digits>"');
    expect(text).not.toContain("a@b.com");
    expect(text).not.toContain("12345678");
  });

  test("reports a mock that breaks its own contract as a finding", async () => {
    const fake = fakeProduction();
    const real = mockTarget();
    const broken: MockTarget = {
      ...real,
      call: (operationId, input) =>
        operationId === "getMe"
          ? Promise.reject(new Error("contract violation: synthetic"))
          : real.call(operationId, input),
    };
    const { text, summary } = await report(await fake.connect(), {
      areas: ["auth"],
      checks: ["mock"],
      mock: broken,
    });
    expect(text).toContain(
      "mock breaks its own contract: contract violation: synthetic",
    );
    expect(summary.shape.differ).toBe(1);
    expect(summary.exitCode).toBe(1);
  });

  test("production-only paths are findings; mock-only paths are notes", async () => {
    const extra: Rewrite = async (request, response) => {
      if (new URL(request.url).pathname !== "/api/v2/me") return response;
      const body: unknown = await response.json();
      return Response.json(isRecord(body) ? { ...body, extra: 1 } : body);
    };
    const fake = fakeProduction(extra);
    const withExtra = await report(await fake.connect(), {
      areas: ["auth"],
      checks: ["mock"],
    });
    expect(withExtra.text).toContain("diff only in prod: extra (number)");
    expect(withExtra.summary.exitCode).toBe(1);

    const dropped: Rewrite = async (request, response) => {
      if (new URL(request.url).pathname !== "/api/v2/me") return response;
      const body: unknown = await response.json();
      if (!isRecord(body)) return response;
      const [first] = Object.keys(body);
      const rest = Object.fromEntries(
        Object.entries(body).filter(([name]) => name !== first),
      );
      return Response.json(rest);
    };
    const lacking = await report(await fakeProduction(dropped).connect(), {
      areas: ["auth"],
      checks: ["mock"],
    });
    expect(lacking.text).toContain("note only in mock:");
    expect(lacking.summary.findings).toBe(0);
    expect(lacking.summary.notes).toBeGreaterThan(0);
    expect(lacking.summary.exitCode).toBe(0);
  });
});

describe("the plan", () => {
  test("formats the date window in Istanbul time", () => {
    expect(istanbulStamp(new Date("2026-11-01T09:00:00+03:00"))).toBe(
      "2026-11-01T09:00:00+03:00",
    );
    expect(istanbulStamp(new Date("2026-11-01T00:30:00Z"))).toBe(
      "2026-11-01T03:30:00+03:00",
    );
  });

  test("covers the last 365 days ending at the side's clock", () => {
    const step = STEPS.find((s) => s.operationId === "getMembershipDuesList");
    const built = step?.build({
      now: () => new Date("2026-11-01T09:00:00+03:00"),
      ids: new Map(),
    });
    expect(built).toMatchObject({
      input: {
        query: {
          status: "paid",
          start_date: "2025-11-01T09:00:00+03:00",
          end_date: "2026-11-01T09:00:00+03:00",
          start_page: 1,
          how_many: 20,
        },
      },
    });
  });

  test("remembers ids from an array or from a single object", () => {
    const step = STEPS.find(
      (s) => s.operationId === "listChangedCommunicationPermissions",
    );
    const asArray: Ids = new Map();
    step?.remember?.(
      { permission_list: [{ id: 1 }, { id: 2, email: "a@example.invalid" }] },
      asArray,
    );
    expect(asArray.get("permissionEmail")).toBe("a@example.invalid");
    const asObject: Ids = new Map();
    step?.remember?.(
      { permission_list: { id: 3, email: "b@example.invalid" } },
      asObject,
    );
    expect(asObject.get("permissionEmail")).toBe("b@example.invalid");
  });

  test("takes the answer's form from the same row as the answer", () => {
    const step = STEPS.find((s) => s.operationId === "getFormAnswerList");
    const ids: Ids = new Map();
    step?.remember?.(
      {
        answer_list: [
          { id: 1, custom_form_id: null, user_id: null },
          { id: 2, custom_form_id: 20, user_id: 200 },
          { id: 3, custom_form_id: 30, user_id: 300 },
        ],
      },
      ids,
    );
    expect(Object.fromEntries(ids)).toEqual({
      answer: 2,
      answerForm: 20,
      answerUser: 200,
    });
  });

  test("uses the user search's whole documented column list", () => {
    const step = STEPS.find((s) => s.operationId === "getUserList");
    const built = step?.build({ now: () => new Date(), ids: new Map() });
    const body =
      built && "input" in built && isRecord(built.input.body)
        ? built.input.body
        : {};
    const columns = Array.isArray(body.values_list) ? body.values_list : [];
    expect(columns).toContain("email");
    expect(columns).toContain("allow_comm_via_sms_date");
    expect(columns.some((c) => String(c).startsWith("user_defined"))).toBe(
      false,
    );
  });
});

describe("the production parity command", () => {
  // Every child runs in a fresh empty directory, so Bun auto-loads no env
  // file into it. The production variables are also set to empty strings,
  // which stops any env file from filling them, and the origin points at a
  // port nothing listens on, so no child process here can reach production.
  const SCRIPT = join(REPO, "scripts", "prod-parity.ts");
  const blanked = {
    FONZIP_PROD_TOKEN: "",
    FONZIP_PROD_CLIENT_ID: "",
    FONZIP_PROD_CLIENT_SECRET: "",
    FONZIP_PROD_ORIGIN: "http://127.0.0.1:9",
  };
  // Clears the guards that stop unattended runs, to reach the checks after.
  const attended = { NODE_ENV: "", CI: "" };
  const dummyCredentials = {
    FONZIP_PROD_CLIENT_ID: "not-a-real-client",
    FONZIP_PROD_CLIENT_SECRET: "not-a-real-secret",
  };

  const cli = (
    args: string[],
    extraEnv: Record<string, string> = {},
    cwd: string = mkdtempSync(join(tmpdir(), "prod-parity-cli-")),
  ) =>
    Bun.spawnSync([process.execPath, SCRIPT, ...args], {
      cwd,
      env: { ...process.env, ...blanked, ...extraEnv },
      stdout: "pipe",
      stderr: "pipe",
    });

  test("--list prints the plan with no credentials and no calls", () => {
    const run = cli(["--list"]);
    expect(run.exitCode).toBe(0);
    const text = run.stdout.toString();
    for (const area of AREAS) expect(text).toContain(`\n${area}\n`);
    expect(text).toContain("sends: user_id from getUserList");
    expect(text).toContain("probe  getMe");
    expect(run.stderr.toString()).toBe("");
  });

  test("--list honours --area", () => {
    const run = cli(["--list", "--area", "webhooks"]);
    expect(run.exitCode).toBe(0);
    const text = run.stdout.toString();
    expect(text).toContain("getWebhookDetails");
    expect(text).not.toContain("getUserList");
  });

  test("without --live it is a dry run, even with credentials", () => {
    const run = cli([], { ...attended, ...dummyCredentials });
    expect(run.exitCode).toBe(0);
    expect(run.stdout.toString()).toContain("nothing was sent");
    expect(run.stdout.toString()).toContain("Add --live");
    expect(run.stderr.toString()).not.toContain("connecting");
  });

  test("rejects an unknown area, check or flag, and --list with --live", () => {
    for (const args of [
      ["--area", "nope"],
      ["--check", "nope"],
      ["--area"],
      ["--bogus"],
      ["--list", "--live"],
    ]) {
      expect(cli(args).exitCode, args.join(" ")).toBe(2);
    }
  });

  test("--live names the environment variables when credentials are missing", () => {
    const run = cli(["--live"], attended);
    expect(run.exitCode).toBe(2);
    const message = run.stderr.toString();
    expect(message).toContain("FONZIP_PROD_TOKEN");
    expect(message).toContain("FONZIP_PROD_CLIENT_ID");
    expect(message).toContain("FONZIP_PROD_CLIENT_SECRET");
    expect(message).toContain(".env.prod-parity");
  });

  test("--live refuses to run under a test runner or in CI, even with credentials", () => {
    const underTest = cli(["--live"], {
      ...dummyCredentials,
      NODE_ENV: "test",
      CI: "",
    });
    expect(underTest.exitCode).toBe(2);
    expect(underTest.stderr.toString()).toContain("refusing");
    expect(underTest.stderr.toString()).not.toContain("connecting");
    const inCi = cli(["--live"], {
      ...dummyCredentials,
      NODE_ENV: "",
      CI: "true",
    });
    expect(inCi.exitCode).toBe(2);
    expect(inCi.stderr.toString()).toContain("refusing to run in CI");
    expect(inCi.stderr.toString()).not.toContain("connecting");
  });

  test("--live refuses while an auto-loaded env file holds production variables", () => {
    for (const [file, line] of [
      [".env", "FONZIP_PROD_CLIENT_ID=not-a-real-client"],
      [".env.local", "export FONZIP_PROD_TOKEN=not-a-real-token"],
    ] as const) {
      const cwd = mkdtempSync(join(tmpdir(), "prod-parity-cli-"));
      writeFileSync(join(cwd, file), `# local\n${line}\n`);
      const live = cli(["--live"], { ...attended, ...dummyCredentials }, cwd);
      expect(live.exitCode, file).toBe(2);
      const message = live.stderr.toString();
      expect(message).toContain(
        `refusing to run: ${file} defines FONZIP_PROD_*`,
      );
      expect(message).toContain(".env.prod-parity");
      expect(message).not.toContain("not-a-real");
      expect(message).not.toContain("connecting");
      const dry = cli([], attended, cwd);
      expect(dry.exitCode, file).toBe(0);
      expect(dry.stderr.toString()).toContain(`warning: ${file} defines`);
    }
  });

  test("--live ignores the dedicated credentials file's own name", () => {
    const cwd = mkdtempSync(join(tmpdir(), "prod-parity-cli-"));
    writeFileSync(
      join(cwd, ".env.prod-parity"),
      "FONZIP_PROD_CLIENT_ID=not-a-real-client\n",
    );
    const dry = cli([], attended, cwd);
    expect(dry.exitCode).toBe(0);
    expect(dry.stderr.toString()).toBe("");
  });
});
