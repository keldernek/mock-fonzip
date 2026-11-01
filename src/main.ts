import { createApp } from "./app";

const port = Number(process.env.MOCK_FONZIP_PORT ?? 8790);
const app = createApp();

Bun.serve({ port, fetch: app.fetch });
console.log(`mock-fonzip listening on http://localhost:${port}/api/v2`);
