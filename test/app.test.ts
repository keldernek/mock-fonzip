import { expect, test } from "bun:test";

import { createApp } from "../src/app";

test("answers an unknown path with the spec's not-found body", async () => {
  const response = await createApp().request("/api/v2/nope");
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: "Object Not Found" });
});
