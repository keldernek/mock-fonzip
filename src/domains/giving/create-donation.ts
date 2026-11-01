import { notFound } from "../../api/errors";
import type { Handler, HandlerInput } from "../../api/handler";
import type { Rng } from "../../core/rng";
import { istanbulDateTime } from "../../seed/dates";
import { fullName, present } from "../../store/joins";
import type { CurrencyRecord, PaymentMethod } from "../../store/records";
import { CURRENCIES } from "../../store/reference";
import type { OrgStore } from "../../store/store";
import { createDonor } from "./donors";
import { now, recordDonation, singleDonation } from "./payments";

type CreateDonationBody = HandlerInput<"createDonation">["body"];
type Section = NonNullable<CreateDonationBody["section"]>;

const CARD_REFUSED = "Card payments are not available in the API";

const SECTION_TARGETS: {
  readonly [K in Section]: keyof CreateDonationBody | null;
} = {
  page: "fundraising_page_id",
  fundraising: "fundraising_campaign_id",
  form: "module_id",
  other: null,
};

interface Payment {
  readonly amount: number;
  readonly method: PaymentMethod;
  readonly currency: CurrencyRecord;
}

function parsePayment(
  body: CreateDonationBody,
): Payment | { readonly error: string } {
  const { amount, payment_method: method } = body;
  if (body.payment_method_select === "card" || method === 0) {
    return { error: CARD_REFUSED };
  }
  if (body.payment_method_select !== "other") {
    return { error: "payment_method_select must be other" };
  }
  if (method === undefined) return { error: "payment_method is required" };
  if (amount === undefined || !(amount > 0)) {
    return { error: "amount must be greater than zero" };
  }
  const currency = CURRENCIES.find(
    (candidate) =>
      candidate.iso_code === (body.currency ?? "TRY").toUpperCase(),
  );
  if (!currency) return { error: `Unknown currency ${body.currency}` };
  const section = body.section ?? "other";
  const target = SECTION_TARGETS[section];
  if (target !== null && body[target] === undefined) {
    return { error: `${target} is required for section ${section}` };
  }
  if (body.send_thanks_mail === true && body.thanks_mail_id === undefined) {
    return {
      error: "thanks_mail_id is required when send_thanks_mail is true",
    };
  }
  if (body.send_thanks_sms === true && body.thanks_sms_id === undefined) {
    return { error: "thanks_sms_id is required when send_thanks_sms is true" };
  }
  if (body.member_id === undefined && (body.first_name ?? "").trim() === "") {
    return {
      error:
        "first_name is required to create a new user when member_id is absent",
    };
  }
  return { amount, method, currency };
}

function missingReference(
  store: OrgStore,
  body: CreateDonationBody,
): string | undefined {
  const references: readonly (readonly [
    number | undefined,
    (id: number) => unknown,
    string,
  ])[] = [
    [
      body.category_id,
      (id) => store.donationCategories.get(id),
      "Donation category",
    ],
    [
      body.fundraising_page_id,
      (id) => store.donationPages.get(id),
      "Donation page",
    ],
    [body.module_id, (id) => store.donationForms.get(id), "Donation form"],
    [
      body.fundraising_campaign_id,
      (id) => store.fundraisingCampaigns.get(id),
      "Fundraising campaign",
    ],
    [body.bank_account_id, (id) => store.bankAccounts.get(id), "Bank account"],
    [body.thanks_mail_id, (id) => store.templates.get(id), "Template"],
    [body.thanks_sms_id, (id) => store.templates.get(id), "Template"],
    [
      body.referring_thanks_mail_id,
      (id) => store.templates.get(id),
      "Template",
    ],
    [body.ecard_id, (id) => store.ecards.get(id), "E-card"],
    [body.referring_ecard_id, (id) => store.ecards.get(id), "E-card"],
  ];
  return references.find(
    ([id, find]) => id !== undefined && find(id) === undefined,
  )?.[2];
}

function sendMail(store: OrgStore, rng: Rng, address: string): number {
  return store.sentEmails.insert({
    message_id: rng.int(1_000_000, 9_999_999),
    status: address === "" ? 5 : 0,
  }).id;
}

export const createDonation: Handler<"createDonation"> = ({ body }, ctx) => {
  const { store, rng } = ctx;
  const payment = parsePayment(body);
  if ("error" in payment)
    return { status: 400, body: { error: payment.error } };
  const member =
    body.member_id === undefined ? undefined : store.users.get(body.member_id);
  if (body.member_id !== undefined && !member) return notFound("User");
  const missing = missingReference(store, body);
  if (missing !== undefined) return notFound(missing);

  const at = now(ctx);
  const donor =
    member ??
    createDonor(
      store,
      {
        firstName: (body.first_name ?? "").trim(),
        lastName: (body.last_name ?? "").trim(),
        email: body.email ?? "",
        phone: body.phone ?? "",
        tckno: body.tckno ?? "",
        birthday: body.birthday ?? "",
        address: body.address ?? "",
        district: body.district ?? "",
        city: body.city ?? "",
        postCode: body.post_code ?? "",
        corporate: body.donor_type === "corporate",
      },
      at,
    );
  const named = body.first_name !== undefined || body.last_name !== undefined;
  const email = body.email ?? donor.email;
  const referring = body.referring === true;
  const referringEmail = referring ? (body.referring_email ?? "") : "";
  const application = store.applications.find(
    (row) => row.api_key_id === ctx.apiKey.id,
  );
  const { donation } = recordDonation(
    ctx,
    donor,
    {
      amount: payment.amount,
      currencyId: payment.currency.id,
      completeDate:
        body.complete_date === undefined
          ? at
          : istanbulDateTime(new Date(body.complete_date)),
      status: 3,
      method: payment.method,
      paymentSettingsId: null,
      bankAccountId: body.bank_account_id ?? null,
      card: null,
      error: null,
      bankTransactionId: body.transaction_id ?? "",
      receiptNo: body.receipt_no ?? "",
      ipAddress: "",
    },
    {
      ...singleDonation(donor, at),
      d_type: body.d_type ?? 0,
      details: body.details ?? "",
      name: named
        ? `${body.first_name ?? ""} ${body.last_name ?? ""}`.trim()
        : fullName(donor),
      email,
      phone: body.phone ?? donor.phone,
      tckno: body.tckno ?? donor.tckno,
      birthday: body.birthday ?? donor.birthday,
      address: body.address ?? donor.address,
      city: body.city ?? donor.city_text,
      district: body.district ?? donor.district_text,
      donor_type:
        body.donor_type ?? (donor.corporate_type ? "corporate" : "personal"),
      sub_donation_type_id: body.category_id ?? null,
      fundraising_page_id: body.fundraising_page_id ?? null,
      module_id: body.module_id ?? null,
      fundraising_campaign_id: body.fundraising_campaign_id ?? null,
      name_hidden: body.name_hidden ?? false,
      amount_visible: body.amount_visible ?? true,
      application_id: application?.id ?? null,
      thanks_mail_id: body.thanks_mail_id ?? null,
      sent_mail_id:
        body.send_thanks_mail === true ? sendMail(store, rng, email) : null,
      referring,
      referring_name: referring ? (body.referring_name ?? "") : "",
      referring_email: referringEmail,
      referring_phone: referring ? (body.referring_phone ?? "") : "",
      referring_address: referring ? (body.referring_address ?? "") : "",
      referring_city: referring ? (body.referring_city ?? "") : "",
      referring_district: referring ? (body.referring_district ?? "") : "",
      sent_mail_to_referring_id:
        referring && body.referring_thanks_mail_id !== undefined
          ? sendMail(store, rng, referringEmail)
          : null,
    },
  );
  return {
    status: 200,
    body: {
      result: "ok",
      result_code: "200",
      donation_id: donation.id,
      member_id: donor.id,
      fundraising_campaign_id: present(donation.fundraising_campaign_id),
    },
  };
};
