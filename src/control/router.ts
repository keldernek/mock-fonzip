import type { Context, Hono } from "hono";

import { json } from "../api/errors";
import { isOrgSlug, ORG_SLUGS, type Plan } from "../auth/tenancy";
import type { MockRuntime } from "../app";
import { apiDateTime } from "../seed/dates";
import { SIMULATIONS } from "../simulations";
import { DOMAINS } from "../operations";
import { orgStore } from "../store/store";
import { SimulationInput } from "./simulation";

export interface ReceivedNotification {
  readonly at: string;
  readonly receiver: string | null;
  readonly auth_token: string | null;
  readonly body: unknown;
}

export const CONTROL_BASE = "/__mock";

function parseObject(text: string): Record<string, unknown> | null {
  if (text.trim() === "") return {};
  try {
    const body: unknown = JSON.parse(text);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return null;
    }
    return Object.fromEntries(Object.entries(body));
  } catch {
    return null;
  }
}

async function readObject(c: Context): Promise<Record<string, unknown> | null> {
  return parseObject(await c.req.text());
}

function isPlan(value: unknown): value is Plan {
  return value === "active" || value === "lapsed";
}

export function mountControl(app: Hono, runtime: MockRuntime): void {
  const control = (path: string): string => `${CONTROL_BASE}${path}`;

  app.post(control("/reset"), () => {
    runtime.reset();
    return json({ result: "ok", now: runtime.clock.now().toISOString() }, 200);
  });

  app.get(control("/clock"), () =>
    json({ now: runtime.clock.now().toISOString() }, 200),
  );

  app.post(control("/clock/advance"), async (c) => {
    const body = await readObject(c);
    const seconds = body?.seconds;
    if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
      return json({ error: 'send {"seconds": <number>}' }, 400);
    }
    runtime.clock.advance(seconds * 1000);
    return json({ now: runtime.clock.now().toISOString() }, 200);
  });

  app.get(control("/orgs"), () =>
    json(
      {
        orgs: ORG_SLUGS.map((slug) => ({
          slug,
          name: runtime.tenancy.organisation(slug).info.display_name,
          plan: runtime.tenancy.plan(slug),
        })),
      },
      200,
    ),
  );

  app.put(control("/orgs/:org/plan"), async (c) => {
    const org = c.req.param("org") ?? "";
    if (!isOrgSlug(org)) return json({ error: `unknown org ${org}` }, 404);
    const body = await readObject(c);
    if (!isPlan(body?.plan)) {
      return json({ error: 'send {"plan": "active" | "lapsed"}' }, 400);
    }
    runtime.tenancy.setPlan(org, body.plan);
    return json({ slug: org, plan: body.plan }, 200);
  });

  app.get(control("/webhooks/deliveries"), () =>
    json({ deliveries: runtime.world().webhooks.deliveries() }, 200),
  );

  app.delete(control("/webhooks/deliveries"), () => {
    runtime.world().webhooks.clear();
    return json({ result: "ok" }, 200);
  });

  app.post(control("/webhooks/sink"), async (c) => {
    const text = await c.req.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    runtime.world().received.push({
      at: apiDateTime(runtime.clock.now()),
      receiver: c.req.query("receiver") ?? null,
      auth_token: c.req.header("x-fz-auth-token") ?? null,
      body,
    });
    return json({ result: "ok" }, 200);
  });

  app.get(control("/webhooks/received"), () =>
    json({ received: runtime.world().received }, 200),
  );

  app.get(control("/simulations"), () =>
    json(
      {
        simulations: DOMAINS.flatMap((domain) =>
          Object.entries(SIMULATIONS[domain]).map(([name, simulation]) => ({
            domain,
            name,
            path: control(`/simulations/${domain}/${name}`),
            description: simulation.description,
            input: simulation.input,
          })),
        ),
      },
      200,
    ),
  );

  app.post(control("/simulations/:domain/:name"), async (c) => {
    const domain = DOMAINS.find(
      (candidate) => candidate === c.req.param("domain"),
    );
    const simulation = domain
      ? SIMULATIONS[domain][c.req.param("name") ?? ""]
      : undefined;
    if (!simulation) return json({ error: "unknown simulation" }, 404);
    const org = c.req.query("org") ?? "kelder";
    if (!isOrgSlug(org)) return json({ error: `unknown org ${org}` }, 404);
    const body = await readObject(c);
    if (body === null) return json({ error: "send a JSON object" }, 400);
    const world = runtime.world();
    const result = simulation.run(new SimulationInput(body), {
      org: runtime.tenancy.organisation(org),
      store: orgStore(world.store, org),
      clock: runtime.clock,
      rng: world.rng,
      webhooks: world.webhooks.forOrg(org),
    });
    return result.ok
      ? json(result.body, 200)
      : json({ error: result.error }, result.status);
  });

  app.get(control("/credentials"), () =>
    json(
      {
        token_url: "/api/v2/token",
        keys: runtime.tenancy.keys.map((key) => ({
          org: key.org,
          label: key.label,
          client_id: key.clientId,
          client_secret: key.clientSecret,
          scopes: key.scopes,
          plan: runtime.tenancy.plan(key.org),
        })),
        rate_limit: runtime.rateLimit,
      },
      200,
    ),
  );
}
