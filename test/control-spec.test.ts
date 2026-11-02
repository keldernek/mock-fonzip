import { expect, test } from "bun:test";

import { ORG_SLUGS } from "../src/auth/tenancy";
import { CONTROL_BASE } from "../src/control/router";
import { DOMAINS } from "../src/operations";
import { readControlSpec } from "../src/spec/document";
import {
  isJsonObject,
  resolvePointer,
  type JsonObject,
} from "../src/spec/json";
import { isMethod } from "../src/spec/routes";
import { createValidators } from "../src/spec/validation";
import { createTestClient } from "../src/testing/client";

const spec = readControlSpec();

function paths(): [string, JsonObject][] {
  if (!isJsonObject(spec.paths)) throw new Error("the spec has no paths");
  return Object.entries(spec.paths).flatMap(
    ([path, item]): [string, JsonObject][] =>
      isJsonObject(item) ? [[path, item]] : [],
  );
}

function documentedRoutes(): string[] {
  return paths().flatMap(([path, item]) =>
    Object.keys(item)
      .filter(isMethod)
      .map((method) => `${method.toUpperCase()} ${path}`),
  );
}

// Keyed `POST /clock/advance 400`, valued with the response component name.
function documentedResponses(): Map<string, string> {
  const documented = new Map<string, string>();
  for (const [path, item] of paths()) {
    for (const [method, operation] of Object.entries(item)) {
      if (!isMethod(method) || !isJsonObject(operation)) continue;
      if (!isJsonObject(operation.responses)) continue;
      for (const [status, response] of Object.entries(operation.responses)) {
        const ref = isJsonObject(response) ? response.$ref : undefined;
        const name = typeof ref === "string" ? ref.split("/").at(-1) : null;
        if (!name) throw new Error(`${method} ${path} ${status} is not a $ref`);
        documented.set(`${method.toUpperCase()} ${path} ${status}`, name);
      }
    }
  }
  return documented;
}

interface Exchange {
  readonly route: string;
  readonly status: number;
  readonly body: unknown;
}

async function driveEveryControlRoute(): Promise<Exchange[]> {
  let release = (): void => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const client = createTestClient({
    fetch: async (request) => {
      await held;
      if (request.url.includes("receiver=crm")) {
        throw new Error("connection refused");
      }
      return new Response(null, { status: 204 });
    },
  });
  const exchanges: Exchange[] = [];
  const send = async (
    route: string,
    init: RequestInit = {},
    path = route.slice(route.indexOf(" ") + 1),
  ): Promise<unknown> => {
    const response = await client.request(`${CONTROL_BASE}${path}`, {
      method: route.slice(0, route.indexOf(" ")),
      ...init,
    });
    const body: unknown = await response.json();
    exchanges.push({ route, status: response.status, body });
    return body;
  };
  const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });
  const simulate = "POST /simulations/{domain}/{name}";

  await send("POST /reset");
  await send("GET /clock");
  await send("POST /clock/advance", json({ seconds: 90 }));
  await send("POST /clock/advance", json({ seconds: "soon" }));
  await send("GET /orgs");
  const plan = "PUT /orgs/{org}/plan";
  await send(plan, json({ plan: "active" }), "/orgs/ornek/plan");
  await send(plan, json({ plan: "paused" }), "/orgs/ornek/plan");
  await send(plan, json({ plan: "active" }), "/orgs/nowhere/plan");
  await send("GET /credentials");

  const donation = await send(
    simulate,
    json({ user_id: 1054, amount: 300 }),
    "/simulations/giving/public-donation",
  );
  await send("GET /webhooks/deliveries");
  release();
  await client.mock.runtime.world().webhooks.settle();
  await send("GET /webhooks/deliveries");
  await send("DELETE /webhooks/deliveries");

  await send(
    "POST /webhooks/sink",
    { ...json({ id: 1 }), headers: { "X-FZ-Auth-Token": "sink-token" } },
    "/webhooks/sink?receiver=crm",
  );
  await send("POST /webhooks/sink", { body: "not json" });
  await send("GET /webhooks/received");

  await send("GET /simulations");
  const refund = "/simulations/giving/refund-donation";
  const donationId =
    typeof donation === "object" &&
    donation !== null &&
    "donation_id" in donation
      ? donation.donation_id
      : undefined;
  await send(simulate, json({ donation_id: donationId }), refund);
  await send(simulate, json({ donation_id: donationId }), refund);
  await send(simulate, json({}), refund);
  await send(simulate, json([1]), refund);
  await send(simulate, json({}), "/simulations/giving/nope");
  await send(simulate, json({}), `${refund}?org=nowhere`);
  return exchanges;
}

test("the control spec documents exactly the routes the router mounts", () => {
  const mounted = createTestClient()
    .mock.app.routes.filter((route) =>
      route.path.startsWith(`${CONTROL_BASE}/`),
    )
    .map(
      (route) =>
        `${route.method} ${route.path
          .slice(CONTROL_BASE.length)
          .replaceAll(/:(\w+)/g, "{$1}")}`,
    );
  expect(documentedRoutes().toSorted()).toEqual(mounted.toSorted());
});

test("every control response matches the control spec, and every documented response occurs", async () => {
  const validators = createValidators(spec, {
    routes: [],
    byOperationId: new Map(),
    byPath: new Map(),
  });
  const documented = documentedResponses();
  const exchanges = await driveEveryControlRoute();
  for (const { route, status, body } of exchanges) {
    const key = `${route} ${status}`;
    const name = documented.get(key);
    expect(name, `${key} is not documented`).toBeString();
    const validate = validators.component(name ?? "");
    validate(body);
    expect(validate.errors ?? [], key).toEqual([]);
  }
  expect(
    [...new Set(exchanges.map((e) => `${e.route} ${e.status}`))].toSorted(),
  ).toEqual([...documented.keys()].toSorted());
  const [inFlight, settled] = exchanges
    .filter((exchange) => exchange.route === "GET /webhooks/deliveries")
    .map((exchange) => exchange.body);
  expect(inFlight).toMatchObject({
    deliveries: [
      { outcome: { state: "pending" } },
      { outcome: { state: "pending" } },
    ],
  });
  expect(settled).toMatchObject({
    deliveries: [
      {
        headers: { "X-FZ-Auth-Token": expect.any(String) },
        outcome: { state: "delivered", status: 204 },
      },
      { outcome: { state: "failed", error: "connection refused" } },
    ],
  });
});

test("the control spec's enums follow the code", () => {
  const values = (name: string): unknown => {
    const schema = resolvePointer(spec, `#/components/schemas/${name}`);
    return isJsonObject(schema) ? schema.enum : undefined;
  };
  expect(values("Domain")).toEqual([...DOMAINS]);
  expect(values("OrgSlug")).toEqual([...ORG_SLUGS]);
});
