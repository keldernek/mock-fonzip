import createClient, { type Client, type ClientOptions } from "openapi-fetch";

import type { paths } from "./generated/mock-control.js";

export * from "./generated/mock-control.js";
export type { paths as MockControlPaths };

export const MOCK_ORIGIN = "http://localhost:4811";

export interface MockControlOptions extends ClientOptions {
  /** The mock's origin. The control plane is served under `/__mock`. */
  readonly baseUrl?: string;
}

export type MockControlClient = Client<paths>;

export function createMockControl({
  baseUrl = MOCK_ORIGIN,
  ...options
}: MockControlOptions = {}): MockControlClient {
  return createClient<paths>({
    ...options,
    baseUrl: `${baseUrl.replace(/\/+$/, "")}/__mock`,
  });
}
