export const MESSAGES = {
  400: "Invalid values",
  401: "Unauthorized access",
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

// Production answers a missing object in Turkish. These are the texts
// `bun run parity:prod --live` saw, keyed by the subject the handlers pass
// to `notFound`. A subject production has not shown keeps the English
// fallback, `<Thing> not found`.
export const PRODUCTION_NOT_FOUND: Readonly<Record<string, string>> = {
  User: "Kullanıcı bulunamadı",
  Webhook: "Web tetiklemesi bulunamadı.",
  Template: "Şablon bulunamadı.",
  "Membership due": "Aidat ödemesi bulunamadı.",
  Debt: "Borç bulunamadı.",
  "Debt category": "Borç kategorisi bulunamadı.",
  "Form answer": "Form bulunamadı.",
};

export function notFoundMessage(what: string): string {
  return PRODUCTION_NOT_FOUND[what] ?? `${what} not found`;
}

export function notFound(what: string): {
  readonly status: 404;
  readonly body: { error: string };
} {
  return { status: 404, body: { error: notFoundMessage(what) } };
}

export function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body ?? {}), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
