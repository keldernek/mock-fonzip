import type { HandlerResult, TokenHandler } from "../../api/handler";
import type { ValidationFailure } from "../../spec/validation";

const GRANT_TYPE_ERROR = {
  status: 406,
  body: {
    error: "unsupported_grant_type",
    error_description: "Invalid grant_type parameter",
  },
} as const;

const INVALID_CLIENT = {
  status: 401,
  body: { error: "invalid_client", error_description: "Unauthorized Access" },
} as const;

export const getAccessToken: TokenHandler = (input, ctx) => {
  const { grant_type, client_id, client_secret } = input.body;
  if (grant_type === "authorization_code") {
    return {
      status: 400,
      body: {
        error: "invalid_grant",
        error_description: "Invalid authorization code",
      },
    };
  }
  if (grant_type === "refresh_token") {
    return {
      status: 400,
      body: {
        error: "invalid_grant",
        error_description: "Invalid refresh token",
      },
    };
  }
  const key = ctx.tenancy.findKey(client_id);
  if (!key || key.clientSecret !== client_secret) return INVALID_CLIENT;
  if (ctx.tenancy.plan(key.org) !== "active") {
    return {
      status: 402,
      body: {
        error: "invalid_grant",
        error_description:
          "Your account is not authorized to use the fonzip API",
      },
    };
  }
  const issued = ctx.tokens.issue(key);
  return {
    status: 200,
    body: {
      access_token: issued.accessToken,
      token_type: "Bearer",
      expires_in: issued.expiresIn,
    },
  };
};

export function tokenRequestRejected(
  failure: ValidationFailure,
): HandlerResult<"getAccessToken"> {
  const grantTypeAtFault =
    failure.errors.length === 0 ||
    failure.errors.some(
      (error) =>
        error.instancePath === "/grant_type" ||
        error.params.missingProperty === "grant_type",
    );
  return grantTypeAtFault ? GRANT_TYPE_ERROR : INVALID_CLIENT;
}

export const TOKEN_METHOD_NOT_ALLOWED = {
  error: "invalid_request",
  error_description: "Invalid Request",
} as const;
