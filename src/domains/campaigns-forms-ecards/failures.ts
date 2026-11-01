import { notFound } from "../../api/errors";

export interface BadRequest {
  readonly status: 400;
  readonly body: { error: string };
}

export type Failure = BadRequest | ReturnType<typeof notFound>;

export type Parsed<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: Failure };

export function badRequest(error: string): BadRequest {
  return { status: 400, body: { error } };
}

export function parsed<T>(value: T): Parsed<T> {
  return { ok: true, value };
}

export function failed<T>(failure: Failure): Parsed<T> {
  return { ok: false, failure };
}
