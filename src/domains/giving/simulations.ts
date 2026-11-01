import {
  invalid,
  missing,
  type SimulationContext,
  type SimulationFragment,
  type SimulationInput,
  type SimulationResult,
} from "../../control/simulation";
import { CURRENCIES, PAYMENT_ERRORS } from "../../store/reference";
import { createDonor } from "./donors";
import {
  now,
  recordDonation,
  refundDonation,
  singleDonation,
  transactionOf,
  type PaymentError,
} from "./payments";

const CARD_BINS = ["454360", "540667", "979203", "402277"] as const;

const DONATION_INPUT = {
  amount: "number, required",
  user_id:
    "integer; omit to create a new donor from first_name, last_name, email",
  first_name: "string",
  last_name: "string",
  email: "string",
  currency: "ISO code, default TRY",
  category_id: "integer",
  fundraising_page_id: "integer",
  fundraising_campaign_id: "integer",
  module_id: "integer",
  marketing_channel_id: "integer",
  message: "string, the donor's message on a fundraising campaign",
};

function referenceMissing(
  input: SimulationInput,
  ctx: SimulationContext,
): string | undefined {
  const { store } = ctx;
  const references: readonly (readonly [
    string,
    (id: number) => unknown,
    string,
  ])[] = [
    ["user_id", (id) => store.users.get(id), "user"],
    [
      "category_id",
      (id) => store.donationCategories.get(id),
      "donation category",
    ],
    [
      "fundraising_page_id",
      (id) => store.donationPages.get(id),
      "donation page",
    ],
    [
      "fundraising_campaign_id",
      (id) => store.fundraisingCampaigns.get(id),
      "fundraising campaign",
    ],
    ["module_id", (id) => store.donationForms.get(id), "donation form"],
    [
      "marketing_channel_id",
      (id) => store.marketingChannels.get(id),
      "marketing channel",
    ],
  ];
  for (const [field, find, label] of references) {
    const id = input.number(field);
    if (id !== undefined && find(id) === undefined) {
      return `${label} ${id} not found`;
    }
  }
  return undefined;
}

function cardDonation(
  input: SimulationInput,
  ctx: SimulationContext,
  error: PaymentError | null,
): SimulationResult {
  const { store, rng } = ctx;
  const amount = input.number("amount");
  if (amount === undefined || amount <= 0) {
    return invalid("a positive amount is required");
  }
  const currency = CURRENCIES.find(
    (candidate) =>
      candidate.iso_code === (input.string("currency") ?? "TRY").toUpperCase(),
  );
  if (!currency) return invalid(`unknown currency ${input.string("currency")}`);
  const userId = input.number("user_id");
  const firstName = (input.string("first_name") ?? "").trim();
  if (userId === undefined && firstName === "") {
    return invalid("user_id or first_name is required");
  }
  const unknown = referenceMissing(input, ctx);
  if (unknown !== undefined) return missing(unknown);
  const at = now(ctx);
  const donor =
    (userId === undefined ? undefined : store.users.get(userId)) ??
    createDonor(
      store,
      {
        firstName,
        lastName: (input.string("last_name") ?? "").trim(),
        email: input.string("email") ?? "",
        phone: "",
        tckno: "",
        birthday: "",
        address: "",
        district: "",
        city: "",
        postCode: "",
        corporate: false,
      },
      at,
    );
  const settings = store.paymentSettings.find((row) => row.status === 1);
  const campaignId = input.number("fundraising_campaign_id") ?? null;
  const { donation, transaction } = recordDonation(
    ctx,
    donor,
    {
      amount,
      currencyId: currency.id,
      completeDate: at,
      status: error === null ? 3 : 5,
      method: 0,
      paymentSettingsId: settings?.id ?? null,
      bankAccountId: null,
      card: { bin: rng.pick(CARD_BINS), lastFour: rng.digits(4) },
      error,
      bankTransactionId: rng.digits(12),
      receiptNo: `MKB-${rng.digits(8)}`,
      ipAddress: `85.${rng.int(96, 111)}.${rng.int(0, 255)}.${rng.int(1, 254)}`,
    },
    {
      ...singleDonation(donor, at),
      sub_donation_type_id: input.number("category_id") ?? null,
      fundraising_page_id: input.number("fundraising_page_id") ?? null,
      fundraising_campaign_id: campaignId,
      module_id: input.number("module_id") ?? null,
      marketing_channel_id: input.number("marketing_channel_id") ?? null,
      message: campaignId === null ? null : (input.string("message") ?? null),
      show_message: campaignId !== null,
    },
  );
  return {
    ok: true,
    body: {
      donation_id: donation.id,
      member_id: donor.id,
      transaction_id: transaction.id,
      payment_status: transaction.payment_status,
    },
  };
}

export const simulations: SimulationFragment = {
  "public-donation": {
    description:
      "A donor pays by card on the association's public site. The donation is successful (payment_status 3) and the DONATION webhook fires with status 3.",
    input: DONATION_INPUT,
    run: (input, ctx) => cardDonation(input, ctx, null),
  },
  "failed-donation": {
    description:
      "A donor's card payment on the public site is declined (payment_status 5). The DONATION webhook fires with status 5.",
    input: {
      ...DONATION_INPUT,
      error_code: `one of ${PAYMENT_ERRORS.map((error) => error.code).join(", ")}; default 51`,
    },
    run(input, ctx) {
      const code = input.string("error_code") ?? "51";
      const error = PAYMENT_ERRORS.find((candidate) => candidate.code === code);
      if (!error) return invalid(`unknown error_code ${code}`);
      return cardDonation(input, ctx, error);
    },
  },
  "refund-donation": {
    description:
      "An admin refunds a successful donation from the Fonzip console (payment_status 4). The DONATION webhook fires with status 4.",
    input: {
      donation_id: "integer, required",
      reason: "string",
      refunded_by_id: "integer, the admin who refunds",
    },
    run(input, ctx) {
      const donationId = input.number("donation_id");
      if (donationId === undefined) return invalid("donation_id is required");
      const donation = ctx.store.donations.get(donationId);
      if (!donation) return missing(`donation ${donationId} not found`);
      const refundedById = input.number("refunded_by_id") ?? null;
      if (refundedById !== null && !ctx.store.users.get(refundedById)) {
        return missing(`user ${refundedById} not found`);
      }
      if (transactionOf(ctx.store, donation).payment_status !== 3) {
        return {
          ok: false,
          status: 409,
          error: "only a successful donation can be refunded",
        };
      }
      refundDonation(
        ctx,
        donation,
        input.string("reason") ?? "Bağışçının talebi üzerine iade edildi",
        refundedById,
      );
      const refunded = transactionOf(ctx.store, donation);
      return {
        ok: true,
        body: {
          donation_id: donation.id,
          payment_status: refunded.payment_status,
          refund_date: refunded.refund_date,
        },
      };
    },
  },
};
