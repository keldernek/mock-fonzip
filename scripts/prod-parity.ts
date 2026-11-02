import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { AREAS, planLines, type Area } from "../src/prod-parity/plan";
import { CHECKS, runParity, type Check } from "../src/prod-parity/run";
import { sanitizeErrorText } from "../src/prod-parity/shape";
import {
  connectProd,
  mockTarget,
  ProdUnavailableError,
  RefusedRequestError,
  type ProdAuth,
} from "../src/prod-parity/targets";

// Compares the real Fonzip API with the pinned spec and with the mock. It
// only reads, it prints no production value, and it never runs in CI or in
// `bun test`. Without --live it only prints the plan and sends nothing. Run
// it by hand: `bun run parity:prod --live`, which loads the credentials from
// `.env.prod-parity`.
//
// Exit codes: 0 nothing differs (or a dry run), 1 something differs, 2 bad
// usage, missing credentials or a refusal, 3 the run aborted (production
// unreachable or a request refused).

const DEFAULT_ORIGIN = "https://fonzip.com";
const CREDENTIALS_FILE = ".env.prod-parity";

function usage(message: string): never {
  console.error(message);
  console.error(
    "usage: bun run parity:prod [--live] [--area a,b] [--check spec,mock,errors] [--list]",
  );
  process.exit(2);
}

function choose<T extends string>(
  flag: string,
  text: string,
  allowed: readonly T[],
): T[] {
  const chosen: T[] = [];
  for (const raw of text.split(",")) {
    const item = raw.trim();
    const match = allowed.find((candidate) => candidate === item);
    if (match === undefined) {
      usage(`unknown ${flag} value "${item}"; pick from ${allowed.join(", ")}`);
    }
    if (!chosen.includes(match)) chosen.push(match);
  }
  return chosen;
}

interface Options {
  readonly areas: readonly Area[];
  readonly checks: readonly Check[];
  readonly list: boolean;
  readonly live: boolean;
}

function parseArguments(args: readonly string[]): Options {
  let areas: readonly Area[] = AREAS;
  let checks: readonly Check[] = CHECKS;
  let list = false;
  let live = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    const [flag = "", inline] = arg.split(/=(.*)/s);
    if (arg === "--list") {
      list = true;
    } else if (arg === "--live") {
      live = true;
    } else if (flag === "--area" || flag === "--check") {
      let value = inline;
      if (value === undefined) {
        index += 1;
        value = args[index];
      }
      if (value === undefined || value.startsWith("--")) {
        usage(`${flag} needs a value`);
      }
      if (flag === "--area") areas = choose(flag, value, AREAS);
      else checks = choose(flag, value, CHECKS);
    } else {
      usage(`unknown argument ${arg}`);
    }
  }
  if (list && live) usage("--list sends nothing, so it cannot go with --live");
  return { areas, checks, list, live };
}

function envValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value === undefined || value === "" ? undefined : value;
}

function readAuth(): ProdAuth {
  const token = envValue("FONZIP_PROD_TOKEN");
  if (token !== undefined) return { kind: "token", token };
  const clientId = envValue("FONZIP_PROD_CLIENT_ID");
  const clientSecret = envValue("FONZIP_PROD_CLIENT_SECRET");
  if (clientId !== undefined && clientSecret !== undefined) {
    return { kind: "credentials", credentials: { clientId, clientSecret } };
  }
  return usage(
    `set FONZIP_PROD_TOKEN, or both FONZIP_PROD_CLIENT_ID and FONZIP_PROD_CLIENT_SECRET, in ${CREDENTIALS_FILE} (bun run parity:prod loads it) or in your shell`,
  );
}

// The value is never echoed: it may sit next to a credential.
function readOrigin(): string {
  const raw = envValue("FONZIP_PROD_ORIGIN") ?? DEFAULT_ORIGIN;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return usage("FONZIP_PROD_ORIGIN is not a URL");
  }
  const plain =
    (url.protocol === "https:" || url.protocol === "http:") &&
    url.pathname === "/" &&
    url.search === "" &&
    url.hash === "" &&
    url.username === "" &&
    url.password === "";
  if (!plain) {
    return usage(
      "FONZIP_PROD_ORIGIN must be an http(s) origin such as https://fonzip.com, with no path, credentials, query or fragment (the request paths already include /api/v2)",
    );
  }
  return url.origin;
}

// A test run or a CI job must never get to production, even when
// credentials reach it.
function refuseUnattended(): void {
  if (process.env.CI !== undefined && process.env.CI !== "") {
    usage("refusing to run in CI: this command is for a person at a terminal");
  }
  if (process.env.NODE_ENV === "test") {
    usage("refusing to run under a test runner: it would call production");
  }
}

// The env files Bun loads into every command started in this directory,
// including `bun test` and the dev server.
function autoloadedEnvFiles(): string[] {
  const names = new Set([
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    ".env.test",
  ]);
  if (process.env.NODE_ENV) names.add(`.env.${process.env.NODE_ENV}`);
  names.delete(CREDENTIALS_FILE);
  return [...names];
}

const PROD_VARIABLE = /^\s*(?:export\s+)?FONZIP_PROD_[A-Z0-9_]*\s*=/m;

// Names the auto-loaded env files that define production credentials. Only
// the file names are reported, never their contents.
function filesLeakingCredentials(): string[] {
  return autoloadedEnvFiles().filter((name) => {
    const path = join(process.cwd(), name);
    return existsSync(path) && PROD_VARIABLE.test(readFileSync(path, "utf8"));
  });
}

function refuseAutoloadedCredentials(): void {
  const files = filesLeakingCredentials();
  if (files.length === 0) return;
  usage(
    `refusing to run: ${files.join(", ")} defines FONZIP_PROD_* variables, and Bun loads that file into every command here, including bun test and the dev server. Move them to ${CREDENTIALS_FILE}, which only bun run parity:prod loads.`,
  );
}

function listPlan(options: Options, reason: string): void {
  console.log(`Plan for the production parity run. ${reason}`);
  console.log(`Areas: ${options.areas.join(", ")}`);
  console.log(
    "step  = a read of production, then the same step on the mock, compared",
  );
  console.log(
    "probe = a fixed request with invented inputs, sent to both and compared",
  );
  console.log("");
  for (const line of planLines(options.areas)) console.log(line);
}

const options = parseArguments(process.argv.slice(2));
if (!options.live) {
  listPlan(
    options,
    options.list
      ? "--list sends nothing."
      : "This was a dry run: nothing was sent. Add --live to call production.",
  );
  for (const file of filesLeakingCredentials()) {
    console.error(
      `warning: ${file} defines FONZIP_PROD_* variables, which Bun loads into every command here. Move them to ${CREDENTIALS_FILE}; --live refuses to run until then.`,
    );
  }
} else {
  refuseUnattended();
  refuseAutoloadedCredentials();
  const auth = readAuth();
  const origin = readOrigin();
  console.error(
    auth.kind === "token"
      ? `connecting to ${origin} with the supplied token`
      : `connecting to ${origin}; minting one token`,
  );
  try {
    const prod = await connectProd({
      origin,
      auth,
      log: (line) => console.error(line),
    });
    const summary = await runParity({
      origin,
      areas: options.areas,
      checks: options.checks,
      prod,
      mock: mockTarget(),
      out: (line) => console.log(line),
    });
    process.exitCode = summary.exitCode;
  } catch (error) {
    if (
      error instanceof ProdUnavailableError ||
      error instanceof RefusedRequestError
    ) {
      console.error(error.message);
    } else {
      const name = error instanceof Error ? error.name : "error";
      const message = error instanceof Error ? error.message : String(error);
      console.error(`unexpected ${name}: ${sanitizeErrorText(message)}`);
    }
    process.exitCode = 3;
  }
}
