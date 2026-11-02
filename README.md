# Mock Fonzip API

A local, in-memory copy of the [Fonzip API v2](https://fonzip.com/api/v2/docs). It serves every documented route under `/api/v2`, so a client switches from Fonzip to the mock by changing only the origin. The contract is the pinned OpenAPI spec in `spec/fonzip-openapi.yaml`. `PARITY.md` lists every place where that spec is silent or contradicts itself, and what the mock does there.

The data is a synthetic Turkish association, `kelder`, generated from a fixed seed. Every boot produces the same data. State lives in memory until the process stops or `POST /__mock/reset` reseeds it.

This project is not affiliated with or endorsed by Fonzip. It is a test double for developing and testing Fonzip API clients without touching a real organisation's data.

## Run the mock

The mock needs [Bun](https://bun.sh) 1.4.4 or later.

```sh
bun install
bun run dev
```

The server listens on port 8790. Set `MOCK_FONZIP_PORT` to change the port. Use `bun run start` to run it without file watching. On boot, the server prints the API and control-plane URLs, the clock's starting time, and every credential.

Get a token, then call the API with it:

```sh
token=$(curl -s -X POST http://localhost:8790/api/v2/token \
	-d grant_type=client_credentials -d client_id=kelder-local -d client_secret=kelder-local-secret |
	jq -r .access_token)
curl -s -H "Authorization: Bearer $token" http://localhost:8790/api/v2/me
curl -s -H "Authorization: Bearer $token" "http://localhost:8790/api/v2/tags?start_page=1&how_many=10"
```

## Credentials

The mock accepts only the `client_credentials` grant. Each environment variable below overrides its default.

| Key         | Organisation | Scopes          | `client_id` (env)                                    | `client_secret` (env)                                           |
| ----------- | ------------ | --------------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| Read-write  | `kelder`     | `read`, `write` | `kelder-local` (`MOCK_FONZIP_CLIENT_ID`)             | `kelder-local-secret` (`MOCK_FONZIP_CLIENT_SECRET`)             |
| Read-only   | `kelder`     | `read`          | `kelder-readonly` (`MOCK_FONZIP_READONLY_CLIENT_ID`) | `kelder-readonly-secret` (`MOCK_FONZIP_READONLY_CLIENT_SECRET`) |
| Lapsed plan | `ornek`      | `read`, `write` | `ornek-lapsed` (`MOCK_FONZIP_LAPSED_CLIENT_ID`)      | `ornek-lapsed-secret` (`MOCK_FONZIP_LAPSED_CLIENT_SECRET`)      |

A token is valid for 3600 seconds. Each key keeps its five newest tokens and retires older ones. The lapsed organisation gets 402 from `/token` until its plan is set to active.

Each operation allows 60 requests per minute for each API key and organisation pair. Set `MOCK_FONZIP_RATE_LIMIT` and `MOCK_FONZIP_RATE_WINDOW_MS` to change the limit and window.

## Control plane

The control plane lives under `/__mock`, outside the API. It takes and returns JSON.

| Method and path                                         | Action                                                                                                                             |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `POST /__mock/reset`                                    | Reseed the store. Also resets the RNG, the rate limiter, the webhook log, and every organisation's plan. Issued tokens stay valid. |
| `GET /__mock/clock`                                     | Show the mock's current time.                                                                                                      |
| `POST /__mock/clock/advance` with `{"seconds": 3600}`   | Move the clock forward, for example to expire tokens or rate-limit windows.                                                        |
| `GET /__mock/orgs`                                      | List organisations and their plans.                                                                                                |
| `PUT /__mock/orgs/{org}/plan` with `{"plan": "lapsed"}` | Set a plan to `active` or `lapsed`. On a lapsed plan, API calls get 402.                                                           |
| `GET /__mock/credentials`                               | List every key, its scopes, and its plan.                                                                                          |
| `GET /__mock/webhooks/deliveries`                       | List webhook deliveries with their URL, headers, body, and outcome.                                                                |
| `DELETE /__mock/webhooks/deliveries`                    | Clear the delivery log.                                                                                                            |
| `POST /__mock/webhooks/sink`                            | A receiver that records what it gets. The seeded webhooks point here.                                                              |
| `GET /__mock/webhooks/received`                         | List the notifications the sink received.                                                                                          |
| `GET /__mock/simulations`                               | List the simulations of events that only happen on the public site, with their inputs.                                             |
| `POST /__mock/simulations/{domain}/{name}?org=kelder`   | Run one simulation. The body is the simulation's JSON input.                                                                       |

## Check parity with the spec

```sh
bun run parity
bun run parity --domain giving
```

`parity` runs the test suite and records every exchange the tests make. It then prints four matrices: operations that return a real 200, the documented statuses each operation produced, documented inputs no test sent, and documented 200 properties no response carried. Each row names the domain that owns the operation. The command exits non-zero while any gap is not waived. Waivers live in `parity-waivers.json` and in each domain's `src/domains/<domain>/parity-waivers.json`. Each waiver needs a reason.

Every response a test receives is validated against the operation's documented schema for that status. The validation is strict: it rejects properties the spec does not document and statuses the operation does not list. It also requires every `date-time` to be UTC with milliseconds, such as `2026-03-04T05:06:07.123Z`, the way production writes it. Requests may carry any offset.

`bun run smoke` boots the real server on port 8791 and checks it over HTTP with `curl` and `jq`. It covers tokens, auth and plan errors, scopes, a wrong method, a missing parameter, a list from each domain, a donation and a simulated ticket sale with their webhook deliveries, and the rate limit. It exits non-zero on any failed check.

## Check parity with production

```sh
bun run parity:prod
bun run parity:prod --live
bun run parity:prod --live --area people,dues --check spec
```

`parity:prod --live` calls the real Fonzip API with your key and compares what it answers with the pinned spec and with the mock. Without `--live` it only prints the plan and sends nothing. You run it by hand. With `--live` it refuses to run in CI or under a test runner, and `bun test` never calls it.

It only reads. Every request is a `GET`, except the token exchange and the user search (`POST /users`), which reads. The runner checks each request before it sends it and stops the run on anything else. It follows no redirect, so the token request's client secret goes only to the origin. It never calls `generateLoginLinkForUser`, which creates a working login link, or `sendWebhookTestNotification`, and it calls no operation that needs the write scope.

It does three things:

1. **spec**: calls the read operations of the auth, people, webhooks, templates, dues and forms areas, which `--list` shows. It carries ids from each list into the detail calls that follow. It checks every answer against the spec's strict validator, so it reports undocumented properties, missing required properties, wrong types, values outside an enum, and undocumented statuses.
2. **mock**: sends the same steps to the in-process mock and compares the shape of the two answers. A property or a JSON kind that production sends and the mock does not is a finding. A property only the mock sends is a note, because production may just have no such data.
3. **errors**: sends fixed requests with invented inputs to both sides (no token, a token that does not exist, an unknown id, a missing required parameter, a wrong method, a bad grant) and compares the statuses and the shapes. A different error text is a note.

Without `--live`, or with `--list`, the command prints the plan, with what each step sends, and exits. It needs no credentials and makes no calls.

### Environment

| Variable                                             | Meaning                                                                                       |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `FONZIP_PROD_TOKEN`                                  | A bearer token to use as it is. Nothing is minted. The token comparison is skipped.           |
| `FONZIP_PROD_CLIENT_ID`, `FONZIP_PROD_CLIENT_SECRET` | Used when there is no token. The runner mints one token with them.                            |
| `FONZIP_PROD_ORIGIN`                                 | The origin to call. It defaults to `https://fonzip.com`. Give no path: `/api/v2` is included. |

Keep the variables in `.env.prod-parity` in the repo root, which is git-ignored. `bun run parity:prod` loads that file and no other. Variables exported in your shell work too.

Do not put them in `.env`. Bun loads `.env`, `.env.local` and the other default env files into every command in the repo, including `bun test` and the dev server. While one of those files defines a `FONZIP_PROD_*` variable, `--live` refuses to run and a dry run prints a warning. Only the file's name is printed.

Use a dedicated read-only API key. Minting a token retires the oldest of the key's five live tokens, so if an integration shares the key, mint the token yourself and pass it as `FONZIP_PROD_TOKEN`. The runner then touches no token at all.

The runner sends a request about every 350 ms. On a 429 it waits for the time in `Retry-After` (at most 65 seconds) and retries once.

### Flags and exit codes

- `--live` calls production. Without it the command is a dry run.
- `--area people,dues` limits the run to some of `auth`, `people`, `webhooks`, `templates`, `dues` and `forms`. The default is all of them.
- `--check spec,errors` limits the run to some of `spec`, `mock` and `errors`. The default is all of them.
- `--list` prints the plan and exits, like a dry run. It cannot go with `--live`.

An unknown value for either flag is an error.

| Exit code | Meaning                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------ |
| 0         | Nothing differs, or it was a dry run. Notes alone do not count.                                  |
| 1         | At least one finding.                                                                            |
| 2         | A bad flag, missing credentials, or a refusal: CI, a test runner, or credentials in `.env`.      |
| 3         | The run aborted: production was unreachable, the token request failed, or a request was refused. |

The report goes to stdout. Progress and rate-limit messages go to stderr.

### What it prints

The report is meant to be pasted into an issue, so it holds no production data. It prints only:

- property paths, with array items shown as `[]` and free-form keys shown as `{*}`
- JSON kinds
- HTTP status codes
- values from the spec, such as an enum
- numbers and booleans that miss a spec enum, because they are codes
- error texts from production, with email addresses and digit runs of four or more masked, and cut to 160 characters

It never prints a string, an id, an email, a URL that carries one, a token, or a secret from production. For a string that misses an enum, it says only that production sent a string. It writes no response body to disk.

## Update the spec

1. To download the published spec into `spec/fonzip-openapi.yaml`, run `bun run sync-spec`.
2. To regenerate `src/generated/openapi.d.ts`, run `bun run generate`.
3. Run `bun run test`. `test/spec.test.ts` fails when the committed types are stale.

## Add an operation

Operations are split among five domains in `src/operations.ts`. Each domain owns one folder, `src/domains/<domain>/`, and the shared files compose those folders, so domain work never edits shared code.

1. In `src/domains/<domain>/handlers.ts`, replace the operation's `notImplemented` stub with a handler typed `Handler<"operationId">`. The input carries `path`, `query`, and `body`, already validated and typed from the spec. The context carries `org`, `apiKey`, `store` (scoped to the caller's organisation), `clock`, `rng`, and `webhooks`. The handler returns `{status, body}`, and the compiler accepts only the statuses and bodies the spec documents.
2. Use the shared helpers: `paginate`, `matchesQuery`, `matchesAmount`, `parseDateRange`, `inDateRange`, `inList`, and `newestFirst` in `src/api/listing.ts`, `transactionJoin`, `userName`, `fullName`, and `present` in `src/store/joins.ts`, and `notFound` in `src/api/errors.ts`. The reference handlers in `src/domains/foundation/` show the pattern.
3. Read from and write to the collections in `src/store/store.ts`. The record types are in `src/store/records.ts`. `src/store/relations.ts` lists every foreign key, and `test/seed.test.ts` checks them all.
4. Raise webhook events with `ctx.webhooks.emit({operation, status}, objectId)`.
5. Add simulations to `src/domains/<domain>/simulations.ts`. `src/domains/foundation/simulations.ts` shows the shape.
6. Write tests in `test/<domain>.test.ts` with `createTestClient()` from `src/testing/client.ts`. `client.ok("operationId", {path, query, body})` asserts a 200 and returns the body typed from the spec. `client.call` returns any status. Both validate every response strictly.
7. Run `bun run parity --domain <domain>` until it reports no unwaived gaps. If the mock cannot close a gap, add a waiver with a reason to `src/domains/<domain>/parity-waivers.json`, and add the spec location to `src/domains/<domain>/GAPS.md`.

## License

The code is released under the [MIT License](LICENSE). `spec/fonzip-openapi.yaml` is Fonzip's published API description, pinned so the mock can be checked against it, and `src/generated/openapi.d.ts` is generated from it. The MIT License does not cover that document.
