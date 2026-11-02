# @keldernek/fonzip-client

A typed client for the [Fonzip API v2](https://fonzip.com/api/v2/docs), built on [openapi-fetch](https://openapi-ts.dev/openapi-fetch/). A second entry point drives the control plane of [mock-fonzip](https://github.com/keldernek/mock-fonzip), the local mock of that API.

## Install

The package is a GitHub release asset, not an npm package. Add the tarball URL to your `package.json`:

```json
"dependencies": {
  "@keldernek/fonzip-client": "https://github.com/keldernek/mock-fonzip/releases/download/client-v0.1.0-main.42/keldernek-fonzip-client-0.1.0-main.42.tgz"
}
```

Each push to `main` publishes a release tagged `client-v<base>-main.<run_number>`, such as `client-v0.1.0-main.42`, whose asset is `keldernek-fonzip-client-0.1.0-main.42.tgz`. A numbered release never changes. To follow main instead, use the rolling release:

```json
"dependencies": {
  "@keldernek/fonzip-client": "https://github.com/keldernek/mock-fonzip/releases/download/client-latest/keldernek-fonzip-client-latest.tgz"
}
```

The rolling `client-latest` release moves to every new build, so its tarball changes under the same URL. Your lockfile records the tarball's integrity hash, which pins the build you installed until you update the dependency. A package manager that checks the hash refuses a newer tarball instead of installing it silently.

## Call the API

```ts
import {
  createFonzipClient,
  type GetMeResponse,
} from "@keldernek/fonzip-client";

const fonzip = createFonzipClient({
  auth: { clientId: "my-client-id", clientSecret: "my-client-secret" },
});

const { data, error } = await fonzip.GET("/tags", {
  params: { query: { start_page: 1, how_many: 10 } },
});
```

`auth` takes one of two shapes:

- `{ token }` sends that bearer token on every call. A 401 comes back as it is.
- `{ clientId, clientSecret }` requests a token from `POST /token` on the first call and reuses it. On a 401 the client requests a new token and retries the call once. When `POST /token` refuses the credentials, for example with 401 for a wrong secret or 402 for a lapsed plan, that refusal is returned as the call's `{ error, response }`.

Auth wraps `fetch`, so middleware added with `fonzip.use()` sees the token request and the retry as one exchange.

`baseUrl` defaults to `https://fonzip.com/api/v2`. Use `http://localhost:8790/api/v2` for the mock. Every other option goes to openapi-fetch's `createClient`, such as `fetch` or `headers`. The returned `FonzipClient` is an openapi-fetch client, so `fonzip.use()` adds middleware.

## Named types

Every schema in the spec is exported under its own name, such as `AssociationInfo` or `FundraisingTeamCampaignList`. Shared responses, request bodies and parameters are exported as `Response<Name>`, `RequestBody<Name>` and `Parameter<Name>`.

Each operation exports up to four types, named after its `operationId`: `<Name>Response` for its 200 body, `<Name>Body` for its JSON request body, `<Name>Query` and `<Name>Path` for its parameters. For example, `getMe` exports `GetMeResponse`. An operation exports only the parts it has. `OPERATIONS` maps each `operationId` to its method and path:

```ts
import { OPERATIONS } from "@keldernek/fonzip-client";

const { method, path } = OPERATIONS.getMe;
const { data } = await fonzip[method](path);
```

`paths`, `components` and `operations` are exported as openapi-typescript generates them.

## Drive the mock

```ts
import { createMockControl } from "@keldernek/fonzip-client/mock";

const control = createMockControl({ baseUrl: "http://localhost:8790" });
await control.POST("/reset");
await control.POST("/clock/advance", { body: { seconds: 3600 } });
const { data } = await control.GET("/clock");
```

`baseUrl` is the mock's origin and defaults to `http://localhost:8790`. The client adds `/__mock`. The control plane's schemas are exported by name from this entry point too, such as `Clock` or `WebhookDelivery`.

## Where the types come from

mock-fonzip generates the types with openapi-typescript. The API types come from its pinned copy of Fonzip's spec, `spec/fonzip-openapi.yaml`, with the same corrections the mock applies to it. The control-plane types come from `spec/mock-control-openapi.yaml`.

## License

The code is released under the MIT License. The API types are derived from Fonzip's published API description, which the MIT License does not cover.
