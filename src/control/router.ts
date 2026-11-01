import type { Context, Hono } from "hono";

import { json } from "../api/errors";
import { isOrgSlug, ORG_SLUGS, type Plan } from "../auth/tenancy";
import type { MockRuntime } from "../app";

export const CONTROL_BASE = "/__mock";

async function readObject(c: Context): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await c.req.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return null;
    }
    return Object.fromEntries(Object.entries(body));
  } catch {
    return null;
  }
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
