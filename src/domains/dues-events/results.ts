export type Failure = {
  readonly status: 400 | 404;
  readonly body: { readonly error: string };
};

export const invalid = (error: string) =>
  ({ status: 400, body: { error } }) as const;
