import { createMockFonzip } from "./app";
import { runningClock } from "./core/clock";

const port = Number(process.env.MOCK_FONZIP_PORT ?? 8790);
const limit = Number(process.env.MOCK_FONZIP_RATE_LIMIT ?? 60);
const windowMs = Number(process.env.MOCK_FONZIP_RATE_WINDOW_MS ?? 60_000);

const { app, runtime } = createMockFonzip({
  clock: runningClock(),
  rateLimit: { limit, windowMs },
  selfOrigin: `http://localhost:${port}`,
});

Bun.serve({ port, fetch: app.fetch });

const origin = `http://localhost:${port}`;
console.log(
  `mock-fonzip API at ${origin}/api/v2, control plane at ${origin}/__mock`,
);
console.log(`clock starts at ${runtime.clock.now().toISOString()}`);
for (const key of runtime.tenancy.keys) {
  console.log(
    `  ${key.label}: client_id=${key.clientId} client_secret=${key.clientSecret}`,
  );
}
