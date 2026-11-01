export const MESSAGES = {
  400: "Invalid values",
  401: "Unauthorized Access",
  402: "No Valid Plan",
  403: "No Permission",
  404: "Object Not Found",
  405: "Invalid Request",
  429: "Rate limit exceeded",
  501: "Not Implemented",
} as const;

export function errorBody(status: keyof typeof MESSAGES): { error: string } {
  return { error: MESSAGES[status] };
}

export function notImplemented(): {
  readonly status: 501;
  readonly body: { error: string };
} {
  return { status: 501, body: errorBody(501) };
}

export function notFound(what: string): {
  readonly status: 404;
  readonly body: { error: string };
} {
  return { status: 404, body: { error: `${what} not found` } };
}

export function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body ?? {}), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
