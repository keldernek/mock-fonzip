import { notFound } from "../../api/errors";
import type { Handler } from "../../api/handler";
import type { components } from "../../generated/openapi";
import type { Row } from "../../store/collection";
import type { WebhookRecord } from "../../store/records";
import { PAYMENT_STATUS } from "../../store/reference";
import type { OrgStore } from "../../store/store";
import type { WebhookEvent } from "../../webhooks/emitter";

type WebhookBody = components["schemas"]["Webhook"];
type Events = WebhookRecord["events"];
type EventKey = keyof Events;

const EVENT_KEYS: readonly EventKey[] = [
  "DONATION",
  "SUBSCRIPTION",
  "TICKET",
  "FORM",
  "CERTIFICATE_SALE",
  "FUNDRAISING_CAMPAIGN",
];

function failure(error: string): { status: 400; body: { error: string } } {
  return { status: 400, body: { error: `Invalid values: ${error}` } };
}

function toWebhook(row: Row<WebhookRecord>) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    authentication: row.authentication,
    auth_token: row.auth_token === "" ? undefined : row.auth_token,
    events: row.events,
  };
}

function parseWebhook(
  body: WebhookBody | undefined,
):
  | { ok: true; record: Omit<WebhookRecord, "id"> }
  | { ok: false; error: string } {
  if (body === undefined)
    return { ok: false, error: "a webhook body is required" };
  const name = body.name.trim();
  if (name === "") return { ok: false, error: "name cannot be empty" };
  const authentication = body.authentication ?? false;
  const token = body.auth_token?.trim() ?? "";
  if (authentication && token === "") {
    return { ok: false, error: "authentication needs an auth_token" };
  }
  const events: Events = {
    DONATION: body.events.DONATION ?? false,
    SUBSCRIPTION: body.events.SUBSCRIPTION ?? false,
    TICKET: body.events.TICKET ?? false,
    FORM: body.events.FORM ?? false,
    CERTIFICATE_SALE: body.events.CERTIFICATE_SALE ?? false,
    FUNDRAISING_CAMPAIGN: body.events.FUNDRAISING_CAMPAIGN ?? false,
  };
  return {
    ok: true,
    record: {
      name,
      url: body.url,
      authentication,
      auth_token: authentication ? token : "",
      events,
    },
  };
}

export const listWebhooks: Handler<"listWebhooks"> = (_input, { store }) => ({
  status: 200,
  body: {
    webhook_list: store.webhooks
      .list()
      .map((row) => ({ id: row.id, name: row.name, url: row.url })),
  },
});

export const getWebhookDetails: Handler<"getWebhookDetails"> = (
  { path },
  { store },
) => {
  const row = store.webhooks.get(path.webhook_id);
  if (!row) return notFound("Webhook");
  return { status: 200, body: { webhook: toWebhook(row) } };
};

export const createWebhook: Handler<"createWebhook"> = (
  { body },
  { store },
) => {
  const parsed = parseWebhook(body);
  if (!parsed.ok) return failure(parsed.error);
  store.webhooks.insert(parsed.record);
  return { status: 200, body: { result: "ok" } };
};

export const updateWebhook: Handler<"updateWebhook"> = (
  { path, body },
  { store },
) => {
  if (!store.webhooks.get(path.webhook_id)) return notFound("Webhook");
  if (body?.id !== undefined && body.id !== path.webhook_id) {
    return failure(
      `body id ${body.id} does not match webhook ${path.webhook_id}`,
    );
  }
  const parsed = parseWebhook(body);
  if (!parsed.ok) return failure(parsed.error);
  store.webhooks.update(path.webhook_id, parsed.record);
  return { status: 200, body: { result: "ok" } };
};

export const deleteWebhook: Handler<"deleteWebhook"> = (
  { path },
  { store },
) => {
  if (!store.webhooks.remove(path.webhook_id)) return notFound("Webhook");
  return { status: 200, body: { result: "ok" } };
};

function latestId(rows: readonly { id: number }[]): number {
  return Math.max(0, ...rows.map((row) => row.id));
}

function latestSuccessfulId(
  store: OrgStore,
  rows: readonly { id: number; transaction_id: number | null }[],
): number {
  return latestId(
    rows.filter(
      (row) =>
        row.transaction_id === null ||
        store.transactions.get(row.transaction_id)?.payment_status ===
          PAYMENT_STATUS.successful,
    ),
  );
}

const TEST_EVENTS: {
  readonly [K in EventKey]: {
    readonly event: WebhookEvent;
    readonly latest: (store: OrgStore) => number;
  };
} = {
  DONATION: {
    event: { operation: 1, status: 3 },
    latest: (store) => latestSuccessfulId(store, store.donations.list()),
  },
  SUBSCRIPTION: {
    event: { operation: 2, status: 3 },
    latest: (store) =>
      latestSuccessfulId(
        store,
        store.subscriptions.list((row) => row.status === 2),
      ),
  },
  TICKET: {
    event: { operation: 3, status: 3 },
    latest: (store) => latestSuccessfulId(store, store.ticketSales.list()),
  },
  FORM: {
    event: { operation: 4, status: 3 },
    latest: (store) => latestSuccessfulId(store, store.formAnswers.list()),
  },
  CERTIFICATE_SALE: {
    event: { operation: 5, status: 3 },
    latest: (store) =>
      latestSuccessfulId(store, store.ecardTransactions.list()),
  },
  FUNDRAISING_CAMPAIGN: {
    event: { operation: 6, status: 0 },
    latest: (store) => latestId(store.fundraisingCampaigns.list()),
  },
};

export const sendWebhookTestNotification: Handler<
  "sendWebhookTestNotification"
> = ({ path }, { store, webhooks }) => {
  const row = store.webhooks.get(path.webhook_id);
  if (!row) return notFound("Webhook");
  const key = EVENT_KEYS.find((candidate) => row.events[candidate]);
  if (key === undefined) {
    return failure(`webhook ${row.id} subscribes to no events`);
  }
  const test = TEST_EVENTS[key];
  webhooks.send(row, test.event, test.latest(store));
  return { status: 200, body: { result: "ok" } };
};
