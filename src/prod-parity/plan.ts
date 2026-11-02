import type { ClientCredentials } from "../auth/tenancy";
import type { ServedOperationId } from "../operations";
import { deref, isJsonObject } from "../spec/json";
import { specRuntime } from "../spec/runtime";
import { routeOf, type CallInput } from "../testing/client";
import { isRecord } from "./shape";

// The plan is data: what the production parity runner sends, in what order,
// and which ids it carries from one response into the next request. Nothing
// here talks to a server.

export const AREAS = [
  "auth",
  "people",
  "webhooks",
  "templates",
  "dues",
  "forms",
] as const;
export type Area = (typeof AREAS)[number];

export const ROWS = 20;
// An id no organisation has: the largest 32-bit integer.
export const UNKNOWN = 2147483647;

const WINDOW_DAYS = 365;
const DAY_MS = 86_400_000;
const ISTANBUL_OFFSET_MS = 3 * 3_600_000;

const PAGE = { start_page: 1, how_many: ROWS } as const;

export type Ids = Map<string, string | number>;

// One side of the comparison: production or the mock. Each keeps its own ids,
// because an id from one side means nothing on the other.
export interface Side {
  readonly now: () => Date;
  readonly ids: Ids;
  // Set on the mock side only. Production's token is minted by the runner.
  readonly credentials?: ClientCredentials;
}

export type Built =
  | { readonly input: CallInput }
  | { readonly missing: string };

export interface ShapeStep {
  readonly area: Area;
  readonly operationId: ServedOperationId;
  // Describes the request without any production value.
  readonly sends: string;
  // On production the runner reuses the token it minted at startup.
  readonly usesMintedToken?: true;
  readonly build: (side: Side) => Built;
  // Stores ids from a 200 body for the steps that follow.
  readonly remember?: (body: unknown, ids: Ids) => void;
}

// A request with fixed, invented inputs. Production and the mock both get it,
// and their answers are compared.
export interface Probe {
  readonly area: Area;
  readonly operationId: ServedOperationId;
  readonly sends: string;
  readonly input: CallInput;
}

// The window is in Istanbul time, which Fonzip uses and which has no daylight
// saving.
export function istanbulStamp(date: Date): string {
  const shifted = new Date(date.getTime() + ISTANBUL_OFFSET_MS);
  return `${shifted.toISOString().slice(0, 19)}+03:00`;
}

function windowQuery(side: Side): { start_date: string; end_date: string } {
  const end = side.now();
  return {
    start_date: istanbulStamp(new Date(end.getTime() - WINDOW_DAYS * DAY_MS)),
    end_date: istanbulStamp(end),
  };
}

const WINDOW_TEXT = `last ${WINDOW_DAYS} days`;
const PAGE_TEXT = `${ROWS} rows`;

function idValue(value: unknown): string | number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return typeof value === "string" && value !== "" ? value : undefined;
}

function textValue(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

// A list wrapper may hold an array or, where the spec says so, one object.
function rowsOf(body: unknown, key: string): Record<string, unknown>[] {
  if (!isRecord(body)) return [];
  const list = body[key];
  if (Array.isArray(list)) return list.filter(isRecord);
  return isRecord(list) ? [list] : [];
}

interface Pick {
  readonly name: string;
  readonly field: string;
  readonly text?: true;
}

// Stores the named fields of the first row that has all of them.
function takeFirst(
  ids: Ids,
  body: unknown,
  listKey: string,
  picks: readonly Pick[],
): void {
  for (const row of rowsOf(body, listKey)) {
    const found: [string, string | number][] = [];
    for (const pick of picks) {
      const value = pick.text
        ? textValue(row[pick.field])
        : idValue(row[pick.field]);
      if (value === undefined) break;
      found.push([pick.name, value]);
    }
    if (found.length === picks.length) {
      for (const [name, value] of found) ids.set(name, value);
      return;
    }
  }
}

function firstId(
  side: Side,
  names: readonly string[],
): string | number | undefined {
  for (const name of names) {
    const value = side.ids.get(name);
    if (value !== undefined) return value;
  }
  return undefined;
}

// A step that needs one id: the first of `names` that was found.
function withId(
  names: readonly string[],
  missing: string,
  make: (id: string | number) => CallInput,
): (side: Side) => Built {
  return (side) => {
    const id = firstId(side, names);
    return id === undefined ? { missing } : { input: make(id) };
  };
}

function fixed(input: CallInput): (side: Side) => Built {
  return () => ({ input });
}

let searchColumns: readonly string[] | undefined;

// Every column the user search can return, read from the spec. The
// user-defined columns are named by the organisation, so they are left out.
function userSearchColumns(): readonly string[] {
  if (searchColumns) return searchColumns;
  const { spec } = specRuntime();
  const schema = deref(spec, {
    $ref: "#/components/schemas/UserSearchValues",
  });
  const branches =
    isJsonObject(schema) && Array.isArray(schema.anyOf) ? schema.anyOf : [];
  for (const branch of branches) {
    const resolved = deref(spec, branch);
    if (!isJsonObject(resolved) || !Array.isArray(resolved.enum)) continue;
    searchColumns = resolved.enum.filter(
      (value): value is string =>
        typeof value === "string" && !value.startsWith("user_defined_values__"),
    );
    return searchColumns;
  }
  throw new Error("UserSearchValues has no enum branch in the spec");
}

export const STEPS: readonly ShapeStep[] = [
  {
    area: "auth",
    operationId: "getAccessToken",
    sends:
      "grant_type=client_credentials with the key's client id and secret (production: the token minted at startup)",
    usesMintedToken: true,
    build: (side) =>
      side.credentials
        ? {
            input: {
              body: {
                grant_type: "client_credentials",
                client_id: side.credentials.clientId,
                client_secret: side.credentials.clientSecret,
              },
            },
          }
        : { missing: "no client credentials for this side" },
  },
  {
    area: "auth",
    operationId: "getMe",
    sends: "no parameters",
    build: fixed({}),
  },
  {
    area: "people",
    operationId: "getUserList",
    sends: `page 1, ${PAGE_TEXT}, order_by=-id, empty filter, every documented column`,
    build: () => ({
      input: {
        body: {
          search: {
            ...PAGE,
            order_by: "-id",
            filter: { condition: "and", attributes: [] },
          },
          values_list: userSearchColumns(),
        },
      },
    }),
    remember: (body, ids) => {
      takeFirst(ids, body, "user_list", [{ name: "user", field: "id" }]);
      takeFirst(ids, body, "user_list", [
        { name: "userEmail", field: "email", text: true },
      ]);
    },
  },
  {
    area: "people",
    operationId: "getUserDetails",
    sends: "user_id from getUserList",
    build: withId(["user"], "getUserList found no user", (id) => ({
      path: { user_id: id },
    })),
  },
  {
    area: "people",
    operationId: "getUserDefinedValuesList",
    sends: "no parameters",
    build: fixed({}),
  },
  {
    area: "people",
    operationId: "getUsersTimeline",
    sends: `user_id from getUserList, page 1, ${PAGE_TEXT}`,
    build: withId(["user"], "getUserList found no user", (id) => ({
      path: { user_id: id },
      query: PAGE,
    })),
  },
  {
    area: "people",
    operationId: "getUsersTagsList",
    sends: "user_id from getUserList",
    build: withId(["user"], "getUserList found no user", (id) => ({
      path: { user_id: id },
    })),
  },
  {
    area: "people",
    operationId: "listChangedCommunicationPermissions",
    sends: `permission_type=email, days=7, page 1, ${PAGE_TEXT}`,
    build: fixed({
      path: { permission_type: "email" },
      query: { days: 7, ...PAGE },
    }),
    remember: (body, ids) =>
      takeFirst(ids, body, "permission_list", [
        { name: "permissionEmail", field: "email", text: true },
      ]),
  },
  {
    area: "people",
    operationId: "getCommunicationPermissions",
    sends:
      "permission_type=email, an email from listChangedCommunicationPermissions or getUserList",
    build: withId(
      ["permissionEmail", "userEmail"],
      "no email found by listChangedCommunicationPermissions or getUserList",
      (email) => ({
        path: { permission_type: "email", permission_value: email },
      }),
    ),
  },
  {
    area: "webhooks",
    operationId: "listWebhooks",
    sends: "no parameters",
    build: fixed({}),
    remember: (body, ids) =>
      takeFirst(ids, body, "webhook_list", [{ name: "webhook", field: "id" }]),
  },
  {
    area: "webhooks",
    operationId: "getWebhookDetails",
    sends: "webhook_id from listWebhooks",
    build: withId(["webhook"], "listWebhooks found no webhook", (id) => ({
      path: { webhook_id: id },
    })),
  },
  {
    area: "templates",
    operationId: "listTemplates",
    sends: `page 1, ${PAGE_TEXT}`,
    build: fixed({ query: PAGE }),
    remember: (body, ids) =>
      takeFirst(ids, body, "template_list", [
        { name: "template", field: "id" },
      ]),
  },
  {
    area: "templates",
    operationId: "getTemplateDetails",
    sends: "template_id from listTemplates",
    build: withId(["template"], "listTemplates found no template", (id) => ({
      path: { template_id: id },
    })),
  },
  {
    area: "dues",
    operationId: "getMembershipDuesList",
    sends: `status=paid, ${WINDOW_TEXT}, page 1, ${PAGE_TEXT}`,
    build: (side) => ({
      input: { query: { status: "paid", ...windowQuery(side), ...PAGE } },
    }),
    remember: (body, ids) => {
      takeFirst(ids, body, "subscription_list", [
        { name: "subscription", field: "id" },
      ]);
      takeFirst(ids, body, "subscription_list", [
        { name: "subscriptionUser", field: "user_id" },
      ]);
    },
  },
  {
    area: "dues",
    operationId: "getMembershipDueDetails",
    sends: "subscription_id from getMembershipDuesList",
    build: withId(
      ["subscription"],
      "getMembershipDuesList found no subscription",
      (id) => ({ path: { subscription_id: id } }),
    ),
  },
  {
    area: "dues",
    operationId: "getUsersMembershipDueList",
    sends: `user_id from getMembershipDuesList or getUserList, listing=a, page 1, ${PAGE_TEXT}`,
    build: withId(
      ["subscriptionUser", "user"],
      "no user found by getMembershipDuesList or getUserList",
      (id) => ({
        path: { user_id: id },
        query: { listing: "a", ...PAGE },
      }),
    ),
  },
  {
    area: "dues",
    operationId: "getMembershipDueDebtsList",
    sends: `page 1, ${PAGE_TEXT}`,
    build: fixed({ query: PAGE }),
    remember: (body, ids) =>
      takeFirst(ids, body, "debt_list", [{ name: "debt", field: "id" }]),
  },
  {
    area: "dues",
    operationId: "getDebtDetails",
    sends: "debt_id from getMembershipDueDebtsList",
    build: withId(
      ["debt"],
      "getMembershipDueDebtsList found no debt",
      (id) => ({ path: { debt_id: id } }),
    ),
  },
  {
    area: "dues",
    operationId: "getDebtCategoryList",
    sends: `page 1, ${PAGE_TEXT}`,
    build: fixed({ query: PAGE }),
    remember: (body, ids) =>
      takeFirst(ids, body, "category_list", [
        { name: "debtCategory", field: "id" },
      ]),
  },
  {
    area: "dues",
    operationId: "getDebtCategoryUsage",
    sends: "category_id from getDebtCategoryList",
    build: withId(
      ["debtCategory"],
      "getDebtCategoryList found no category",
      (id) => ({ path: { category_id: id } }),
    ),
  },
  {
    area: "forms",
    operationId: "getFormList",
    sends: `page 1, ${PAGE_TEXT}`,
    build: fixed({ query: PAGE }),
  },
  {
    area: "forms",
    operationId: "getFormAnswerList",
    sends: `status=answer, ${WINDOW_TEXT}, page 1, ${PAGE_TEXT}`,
    build: (side) => ({
      input: { query: { status: "answer", ...windowQuery(side), ...PAGE } },
    }),
    remember: (body, ids) => {
      takeFirst(ids, body, "answer_list", [
        { name: "answer", field: "id" },
        { name: "answerForm", field: "custom_form_id" },
      ]);
      takeFirst(ids, body, "answer_list", [
        { name: "answerUser", field: "user_id" },
      ]);
    },
  },
  {
    area: "forms",
    operationId: "getFormAnswerDetails",
    sends: "form_id and answer_id from one row of getFormAnswerList",
    build: (side) => {
      const form = side.ids.get("answerForm");
      const answer = side.ids.get("answer");
      return form === undefined || answer === undefined
        ? { missing: "getFormAnswerList found no answer" }
        : { input: { path: { form_id: form, answer_id: answer } } };
    },
  },
  {
    area: "forms",
    operationId: "getUserAnswerList",
    sends: `user_id from getFormAnswerList or getUserList, page 1, ${PAGE_TEXT}`,
    build: withId(
      ["answerUser", "user"],
      "no user found by getFormAnswerList or getUserList",
      (id) => ({ path: { user_id: id }, query: PAGE }),
    ),
  },
];

const FIXED_WINDOW = {
  start_date: "2026-01-01T00:00:00+03:00",
  end_date: "2026-02-01T00:00:00+03:00",
} as const;

export const PROBES: readonly Probe[] = [
  {
    area: "auth",
    operationId: "getMe",
    sends: "no Authorization header",
    input: { token: null },
  },
  {
    area: "auth",
    operationId: "getMe",
    sends: "a token that does not exist",
    input: { token: "prod-parity-not-a-real-token" },
  },
  {
    area: "auth",
    operationId: "getAccessToken",
    sends: "GET instead of POST",
    input: { method: "GET" },
  },
  {
    area: "auth",
    operationId: "getAccessToken",
    sends: "client_credentials with an unknown client",
    input: {
      body: {
        grant_type: "client_credentials",
        client_id: "prod-parity-unknown-client",
        client_secret: "prod-parity-wrong-secret",
      },
    },
  },
  {
    area: "auth",
    operationId: "getAccessToken",
    sends: "the password grant with an unknown client",
    input: {
      body: {
        grant_type: "password",
        client_id: "prod-parity-unknown-client",
        client_secret: "prod-parity-wrong-secret",
      },
    },
  },
  {
    area: "people",
    operationId: "getUserDetails",
    sends: `user_id ${UNKNOWN}`,
    input: { path: { user_id: UNKNOWN } },
  },
  {
    area: "people",
    operationId: "getUsersTimeline",
    sends: `user_id ${UNKNOWN}, page 1, ${PAGE_TEXT}`,
    input: { path: { user_id: UNKNOWN }, query: PAGE },
  },
  {
    area: "people",
    operationId: "getUsersTagsList",
    sends: `user_id ${UNKNOWN}`,
    input: { path: { user_id: UNKNOWN } },
  },
  {
    area: "people",
    operationId: "getUserList",
    sends: "a search without the required filter",
    input: {
      body: { search: { ...PAGE, order_by: "-id" } },
    },
  },
  {
    area: "people",
    operationId: "listChangedCommunicationPermissions",
    sends: `permission_type=fax, page 1, ${PAGE_TEXT}`,
    input: { path: { permission_type: "fax" }, query: PAGE },
  },
  {
    area: "people",
    operationId: "getCommunicationPermissions",
    sends: "an email nobody has",
    input: {
      path: {
        permission_type: "email",
        permission_value: "prod-parity-probe@example.invalid",
      },
    },
  },
  {
    area: "webhooks",
    operationId: "getWebhookDetails",
    sends: `webhook_id ${UNKNOWN}`,
    input: { path: { webhook_id: UNKNOWN } },
  },
  {
    area: "templates",
    operationId: "getTemplateDetails",
    sends: `template_id ${UNKNOWN}`,
    input: { path: { template_id: UNKNOWN } },
  },
  {
    area: "dues",
    operationId: "getMembershipDueDetails",
    sends: `subscription_id ${UNKNOWN}`,
    input: { path: { subscription_id: UNKNOWN } },
  },
  {
    area: "dues",
    operationId: "getDebtDetails",
    sends: `debt_id ${UNKNOWN}`,
    input: { path: { debt_id: UNKNOWN } },
  },
  {
    area: "dues",
    operationId: "getDebtCategoryUsage",
    sends: `category_id ${UNKNOWN}`,
    input: { path: { category_id: UNKNOWN } },
  },
  {
    area: "dues",
    operationId: "getUsersMembershipDueList",
    sends: `user_id ${UNKNOWN}, page 1, ${PAGE_TEXT}`,
    input: { path: { user_id: UNKNOWN }, query: PAGE },
  },
  {
    area: "dues",
    operationId: "getMembershipDuesList",
    sends: "status=paid and a page, but no date window",
    input: { query: { status: "paid", ...PAGE } },
  },
  {
    area: "forms",
    operationId: "getFormAnswerDetails",
    sends: `form_id ${UNKNOWN}, answer_id ${UNKNOWN}`,
    input: { path: { form_id: UNKNOWN, answer_id: UNKNOWN } },
  },
  {
    area: "forms",
    operationId: "getUserAnswerList",
    sends: `user_id ${UNKNOWN}, page 1, ${PAGE_TEXT}`,
    input: { path: { user_id: UNKNOWN }, query: PAGE },
  },
  {
    area: "forms",
    operationId: "getFormAnswerList",
    sends: "a window and a page, but no status",
    input: { query: { ...FIXED_WINDOW, ...PAGE } },
  },
];

export function methodOf(
  operationId: ServedOperationId,
  input?: CallInput,
): string {
  return (input?.method ?? routeOf(operationId).method).toUpperCase();
}

export interface PlannedRequest {
  readonly operationId: ServedOperationId;
  readonly method: string;
}

// Every (operation, method) pair the plan can send, including the token
// request the runner makes to mint a token. Steps never override the
// operation's own method.
export function plannedRequests(): PlannedRequest[] {
  const seen = new Map<string, PlannedRequest>();
  const add = (operationId: ServedOperationId, input?: CallInput): void => {
    const method = methodOf(operationId, input);
    seen.set(`${method} ${operationId}`, { operationId, method });
  };
  add("getAccessToken");
  for (const step of STEPS) add(step.operationId);
  for (const probe of PROBES) add(probe.operationId, probe.input);
  return [...seen.values()];
}

// The plan as text, for `--list`. It lists only what the plan sends, so it
// needs neither credentials nor a network.
export function planLines(areas: readonly Area[]): string[] {
  const lines: string[] = [];
  for (const area of AREAS.filter((candidate) => areas.includes(candidate))) {
    lines.push(`${area}`);
    for (const step of STEPS.filter((candidate) => candidate.area === area)) {
      const route = routeOf(step.operationId);
      lines.push(
        `  step   ${step.operationId}  ${methodOf(step.operationId)} ${route.specPath}`,
        `           sends: ${step.sends}`,
      );
    }
    for (const probe of PROBES.filter((candidate) => candidate.area === area)) {
      const route = routeOf(probe.operationId);
      lines.push(
        `  probe  ${probe.operationId}  ${methodOf(probe.operationId, probe.input)} ${route.specPath}  [${probe.sends}]`,
      );
    }
  }
  return lines;
}
