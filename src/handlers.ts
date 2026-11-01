import type { BearerRegistry, TokenHandler } from "./api/handler";
import { handlers as campaignsFormsEcards } from "./domains/campaigns-forms-ecards/handlers";
import { handlers as duesEvents } from "./domains/dues-events/handlers";
import { handlers as foundation } from "./domains/foundation/handlers";
import { handlers as giving } from "./domains/giving/handlers";
import { handlers as people } from "./domains/people/handlers";

const { getAccessToken, ...foundationBearer } = foundation;

export const tokenHandler: TokenHandler = getAccessToken;

export const bearerHandlers: BearerRegistry = {
  ...foundationBearer,
  ...people,
  ...giving,
  ...duesEvents,
  ...campaignsFormsEcards,
};
