import type { ProductionCorrection } from "./correct";

// Corrections for the auth area: getAccessToken and getMe.
export const AUTH_CORRECTIONS: readonly ProductionCorrection[] = [
  {
    at: "#/components/schemas/AssociationInfo",
    evidence: "getMe: prod sent phone null",
    nullable: ["phone"],
  },
];
