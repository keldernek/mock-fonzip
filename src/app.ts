import { Hono } from "hono";

export function createApp(): Hono {
  const app = new Hono();
  app.notFound((c) => c.json({ error: "Object Not Found" }, 404));
  return app;
}
