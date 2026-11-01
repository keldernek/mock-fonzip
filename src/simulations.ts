import type { SimulationFragment } from "./control/simulation";
import { simulations as campaignsFormsEcards } from "./domains/campaigns-forms-ecards/simulations";
import { simulations as duesEvents } from "./domains/dues-events/simulations";
import { simulations as foundation } from "./domains/foundation/simulations";
import { simulations as giving } from "./domains/giving/simulations";
import { simulations as people } from "./domains/people/simulations";
import type { Domain } from "./operations";

export const SIMULATIONS: Readonly<Record<Domain, SimulationFragment>> = {
  foundation,
  people,
  giving,
  "dues-events": duesEvents,
  "campaigns-forms-ecards": campaignsFormsEcards,
};
