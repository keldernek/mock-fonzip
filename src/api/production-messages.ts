import type { ErrorObject } from "ajv";

import type { ValidationFailure } from "../spec/validation";

// Production words some validation failures its own way instead of the
// mock's `Invalid values: <reason>`. Each rule copies a text that
// `bun run parity:prod --live` saw, for the failure that produced it.
interface MessageRule {
  readonly operations: readonly string[];
  readonly matches: (failure: ValidationFailure) => boolean;
  readonly message: string;
}

function missing(error: ErrorObject, property: string): boolean {
  return (
    error.keyword === "required" &&
    error.instancePath === "" &&
    error.params.missingProperty === property
  );
}

function at(error: ErrorObject, property: string): boolean {
  return error.instancePath === `/${property}`;
}

const RULES: readonly MessageRule[] = [
  {
    // A search body with no values_list. Production checks it before the
    // filter.
    operations: ["getUserList"],
    matches: (failure) =>
      failure.location === "body" &&
      failure.errors.some((error) => missing(error, "values_list")),
    message: "values_list parametresi eksik",
  },
  {
    operations: [
      "listChangedCommunicationPermissions",
      "getCommunicationPermissions",
    ],
    matches: (failure) =>
      failure.location === "path" &&
      failure.errors.some((error) => at(error, "permission_type")),
    message: "Invalid permission type. must be email, sms or phone",
  },
  {
    operations: ["getMembershipDuesList"],
    matches: (failure) =>
      failure.location === "query" &&
      failure.errors.some(
        (error) =>
          missing(error, "start_date") ||
          missing(error, "end_date") ||
          at(error, "start_date") ||
          at(error, "end_date"),
      ),
    message: "Lütfen geçerli bir tarih aralığı girin",
  },
];

export function productionValidationMessage(
  operationId: string,
  failure: ValidationFailure,
): string | undefined {
  return RULES.find(
    (rule) => rule.operations.includes(operationId) && rule.matches(failure),
  )?.message;
}
