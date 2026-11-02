// Fields of a transaction record that every creator fills the same way.
//
// None of them draws from the seeded RNG. A creator that drew another value
// would shift every seeded value after it, in every domain.

// What a transaction pays for. Production showed 2 on membership dues and
// debts. Donations (1) and e-cards (4) follow the codes
// `BankAccountTransaction.transaction_type` documents for a matched transfer.
// Ticket sales (3) and form payments (5) are the mock's own choice: nothing
// shows production's codes for them.
export const TRANSACTION_TYPE = {
  donation: 1,
  dues: 2,
  ticket: 3,
  ecard: 4,
  form: 5,
} as const;

const CITIES = ["İstanbul", "Ankara", "İzmir", "Bursa"] as const;

export interface PaymentOrigin {
  readonly city: string | null;
  readonly country: string | null;
}

// Production resolves the city and country of the paying IP address and
// leaves both null when the payment has none. The mock reads the city off the
// second octet of the seeded `85.96-111.x.x` address.
export function originOf(ipAddress: string | null): PaymentOrigin {
  if (ipAddress === null || ipAddress === "") {
    return { city: null, country: null };
  }
  const octet = Number(ipAddress.split(".")[1]);
  const city = CITIES[Number.isInteger(octet) ? octet % CITIES.length : 0];
  return { city: city ?? CITIES[0], country: "Türkiye" };
}

// Production's conversation id is a string of 15 digits. It is made from the
// one 8-digit draw the creators already take: the draw, then 7 more digits
// that follow from it.
export function conversationId(draw: number): string {
  return `${draw}${String((draw * 7919) % 10_000_000).padStart(7, "0")}`;
}
