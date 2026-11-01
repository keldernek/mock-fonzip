import type { ApiKey, Organisation, Tenancy } from "../auth/tenancy";
import type { TokenService } from "../auth/tokens";
import type { Clock } from "../core/clock";
import type { Rng } from "../core/rng";
import type { operations } from "../generated/openapi";
import type { OrgStore } from "../store/store";
import type { OrgWebhooks } from "../webhooks/emitter";
import type {
  BearerOperationId,
  Domain,
  OperationId,
  OwnedBy,
  PublicOperationId,
} from "../operations";

type Operation<K extends OperationId> = operations[K];

type Present<T> = [NonNullable<T>] extends [never]
  ? Record<never, never>
  : NonNullable<T>;

type MediaOf<R> = R extends { content: infer C } ? C[keyof C] : undefined;

type BodyOf<R> = [NonNullable<R>] extends [never]
  ? undefined
  : undefined extends R
    ? MediaOf<NonNullable<R>> | undefined
    : MediaOf<R>;

type JsonBody<R> = R extends { content: { "application/json": infer B } }
  ? B
  : undefined;

type Responses<K extends OperationId> = Operation<K>["responses"];
type Status<K extends OperationId> = keyof Responses<K> & number;

export interface HandlerInput<K extends OperationId> {
  readonly path: Present<Operation<K>["parameters"]["path"]>;
  readonly query: Present<Operation<K>["parameters"]["query"]>;
  readonly body: BodyOf<Operation<K>["requestBody"]>;
}

export type HandlerResult<K extends OperationId> = {
  [S in Status<K>]: {
    readonly status: S;
    readonly body: JsonBody<Responses<K>[S]>;
  };
}[Status<K>];

export type ResponseBody<K extends OperationId, S extends Status<K>> = JsonBody<
  Responses<K>[S]
>;

export interface HandlerContext {
  readonly org: Organisation;
  readonly apiKey: ApiKey;
  readonly store: OrgStore;
  readonly clock: Clock;
  readonly rng: Rng;
  readonly webhooks: OrgWebhooks;
}

export type Handler<K extends BearerOperationId> = (
  input: HandlerInput<K>,
  ctx: HandlerContext,
) => HandlerResult<K> | Promise<HandlerResult<K>>;

export interface TokenContext {
  readonly tenancy: Tenancy;
  readonly tokens: TokenService;
}

export type TokenHandler = (
  input: HandlerInput<PublicOperationId>,
  ctx: TokenContext,
) => HandlerResult<PublicOperationId>;

type HandlerFor<K extends OperationId> = K extends PublicOperationId
  ? TokenHandler
  : K extends BearerOperationId
    ? Handler<K>
    : never;

export type Fragment<D extends Domain> = {
  readonly [K in OwnedBy<D>]: HandlerFor<K>;
};

export type BearerRegistry = {
  readonly [K in BearerOperationId]: Handler<K>;
};
