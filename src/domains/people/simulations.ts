import { invalid, type SimulationFragment } from "../../control/simulation";
import { changePermissions, type PermissionType } from "./permissions";

const TYPES: readonly PermissionType[] = ["email", "sms", "phone"];

function isPermissionType(value: string): value is PermissionType {
  return TYPES.some((type) => type === value);
}

export const simulations: SimulationFragment = {
  "withdraw-permission": {
    description:
      "A person follows the unsubscribe link of an email or SMS and withdraws one channel's communication permission now. listChangedCommunicationPermissions then reports the change.",
    input: {
      permission_type: "email, sms or phone, required",
      permission_value: "email address or E.164 phone number, required",
      details: "string",
    },
    run(input, ctx) {
      const type = input.string("permission_type");
      const value = input.string("permission_value");
      if (
        type === undefined ||
        !isPermissionType(type) ||
        value === undefined
      ) {
        return invalid(
          "permission_type (email, sms or phone) and permission_value are required",
        );
      }
      const result = changePermissions(ctx.store, {
        type,
        value,
        permission: false,
        at: ctx.clock.now(),
        details: input.string("details") ?? "abonelikten çıkma bağlantısı",
      });
      if (!result.ok) {
        return { ok: false, status: result.status, error: result.error };
      }
      return { ok: true, body: { update_count: result.updated } };
    },
  },
};
