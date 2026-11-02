import type { OrgSlug } from "../auth/tenancy";
import type { Clock } from "../core/clock";
import type { components } from "../generated/openapi";
import { apiDateTime } from "../seed/dates";
import type { WebhookRecord } from "../store/records";
import type { Store } from "../store/store";

export type WebhookNotification = Required<
  components["schemas"]["WebhookNotification"]
>;

export const WEBHOOK_OPERATIONS = {
  donation: 1,
  subscription: 2,
  ticket: 3,
  form: 4,
  ecardSale: 5,
  fundraisingCampaign: 6,
} as const;

export const OUTCOME_STATUS = { successful: 3, refunded: 4, error: 5 } as const;

export type WebhookEvent =
  | {
      readonly operation: Exclude<
        (typeof WEBHOOK_OPERATIONS)[keyof typeof WEBHOOK_OPERATIONS],
        6
      >;
      readonly status: (typeof OUTCOME_STATUS)[keyof typeof OUTCOME_STATUS];
    }
  | { readonly operation: 6; readonly status: 0 };

const SUBSCRIPTION_KEY: Readonly<
  Record<WebhookEvent["operation"], keyof WebhookRecord["events"]>
> = {
  1: "DONATION",
  2: "SUBSCRIPTION",
  3: "TICKET",
  4: "FORM",
  5: "CERTIFICATE_SALE",
  6: "FUNDRAISING_CAMPAIGN",
};

export const WEBHOOK_TIMEOUT_MS = 5000;

export type DeliveryOutcome =
  | { readonly state: "pending" }
  | { readonly state: "delivered"; readonly status: number }
  | { readonly state: "failed"; readonly error: string };

export interface Delivery {
  readonly id: number;
  readonly at: string;
  readonly org: OrgSlug;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: WebhookNotification;
  outcome: DeliveryOutcome;
}

export type WebhookFetch = (request: Request) => Promise<Response>;

export interface OrgWebhooks {
  emit(event: WebhookEvent, objectId: number): readonly Delivery[];
  send(webhook: WebhookRecord, event: WebhookEvent, objectId: number): Delivery;
}

export interface WebhookEmitter {
  forOrg(org: OrgSlug): OrgWebhooks;
  deliveries(): readonly Delivery[];
  clear(): void;
  settle(): Promise<void>;
}

export function createWebhookEmitter(
  store: Store,
  clock: Clock,
  fetcher: WebhookFetch,
): WebhookEmitter {
  const log: Delivery[] = [];
  const inFlight = new Set<Promise<void>>();
  let nextId = 1;

  const deliver = (
    org: OrgSlug,
    webhook: WebhookRecord,
    event: WebhookEvent,
    objectId: number,
  ): Delivery => {
    const body: WebhookNotification = {
      id: objectId,
      webhook_id: webhook.id,
      operation: event.operation,
      status: event.status,
    };
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (webhook.authentication) headers["X-FZ-Auth-Token"] = webhook.auth_token;
    const delivery: Delivery = {
      id: nextId,
      at: apiDateTime(clock.now()),
      org,
      url: webhook.url,
      headers,
      body,
      outcome: { state: "pending" },
    };
    nextId += 1;
    log.push(delivery);
    const attempt = (async () => {
      try {
        const response = await fetcher(
          new Request(webhook.url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
          }),
        );
        delivery.outcome = { state: "delivered", status: response.status };
      } catch (error) {
        delivery.outcome = {
          state: "failed",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    })();
    inFlight.add(attempt);
    void attempt.finally(() => inFlight.delete(attempt));
    return delivery;
  };

  return {
    forOrg(org) {
      const webhooks = store.webhooks.for(org);
      return {
        emit(event, objectId) {
          const key = SUBSCRIPTION_KEY[event.operation];
          return webhooks
            .list((webhook) => webhook.events[key])
            .map((webhook) => deliver(org, webhook, event, objectId));
        },
        send(webhook, event, objectId) {
          return deliver(org, webhook, event, objectId);
        },
      };
    },
    deliveries: () => log,
    clear() {
      log.length = 0;
    },
    async settle() {
      await Promise.all(inFlight);
    },
  };
}
