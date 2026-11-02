import { notFoundMessage } from "../../api/errors";
import type { components } from "../../generated/openapi";
import type { Row } from "../../store/collection";
import { fullName } from "../../store/joins";
import type {
  BankTransactionRecord,
  CardInfoRecord,
  DonationRecord,
  EcardTransactionRecord,
  FundraisingCampaignRecord,
  SubscriptionRecord,
  TicketSaleRecord,
  UserRecord,
} from "../../store/records";
import { CURRENCIES, currencyById } from "../../store/reference";
import type { OrgStore } from "../../store/store";
import { dayOf, wholeYearsBetween } from "./calendar";
import type { Facts } from "./facts";
import type { Field, Id, IdDomain } from "./search-conditions";
import { activeDays, timelineOf } from "./timeline";

type SearchParameter = components["schemas"]["UserSearchFilters"]["parameter"];

type User = Row<UserRecord>;

function objects(
  what: string,
  exists: (store: OrgStore, id: number) => boolean,
  literals: readonly string[] = [],
): IdDomain {
  return {
    what,
    resolve(store, raw) {
      if (literals.includes(raw)) return { ok: true, id: raw };
      const id = Number(raw);
      if (raw === "" || !Number.isInteger(id)) {
        return {
          ok: false,
          status: 400,
          error: `Invalid values: ${what} ids are integers, got ${raw}`,
        };
      }
      return exists(store, id)
        ? { ok: true, id: String(id) }
        : { ok: false, status: 404, error: notFoundMessage(what) };
    },
  };
}

const TAGS = objects("Tag", (store, id) => store.tags.get(id) !== undefined);
const USERS = objects("User", (store, id) => store.users.get(id) !== undefined);
const CAMPAIGNS = objects(
  "Fundraising campaign",
  (store, id) => store.fundraisingCampaigns.get(id) !== undefined,
);
const DONATION_CATEGORIES = objects(
  "Donation category",
  (store, id) => store.donationCategories.get(id) !== undefined,
);
const DONATION_PAGES = objects(
  "Donation page",
  (store, id) => store.donationPages.get(id) !== undefined,
);
const DONATION_FORMS = objects(
  "Donation form",
  (store, id) => store.donationForms.get(id) !== undefined,
);
const DEBT_CATEGORIES = objects(
  "Debt category",
  (store, id) => store.debtCategories.get(id) !== undefined,
  ["none"],
);
const EVENTS = objects(
  "Event",
  (store, id) => store.events.get(id) !== undefined,
);
const TICKETS = objects(
  "Ticket",
  (store, id) => store.tickets.get(id) !== undefined,
);
const FORMS = objects("Form", (store, id) => store.forms.get(id) !== undefined);
const ECARDS = objects(
  "E-card",
  (store, id) => store.ecards.get(id) !== undefined,
);
const ECARD_CATEGORIES = objects(
  "E-card category",
  (store, id) => store.ecardCategories.get(id) !== undefined,
);
const TEAMS = objects(
  "Fundraising team",
  (store, id) => store.fundraisingTeams.get(id) !== undefined,
);
const TEAM_CAMPAIGNS = objects(
  "Fundraising team campaign",
  (store, id) => store.teamCampaigns.get(id) !== undefined,
);
const FUNDRAISING_EVENTS = objects(
  "Fundraising event",
  (store, id) => store.fundraisingEvents.get(id) !== undefined,
);
const F2F_GROUPS = objects(
  "Face-to-face group",
  (store, id) => store.f2fGroups.get(id) !== undefined,
);

const CURRENCY: IdDomain = {
  what: "Currency",
  resolve(_store, raw) {
    const currency = CURRENCIES.find(
      (row) =>
        String(row.id) === raw || row.iso_code === raw.toLocaleUpperCase("en"),
    );
    return currency
      ? { ok: true, id: String(currency.id) }
      : { ok: false, status: 404, error: "Currency not found" };
  },
};

function text(read: (user: User) => string): Field {
  return { kind: "text", read: (user) => read(user) || null };
}

function nonNull<T>(values: readonly (T | null | undefined)[]): T[] {
  return values.filter(
    (value): value is T => value !== null && value !== undefined,
  );
}

function sum(values: readonly number[]): number {
  return (
    Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100
  );
}

function earliest(dates: readonly string[]): string | null {
  return [...dates].sort((a, b) => Date.parse(a) - Date.parse(b)).at(0) ?? null;
}

function amount(facts: Facts, transactionId: number | null): number {
  return facts.transaction(transactionId)?.amount ?? 0;
}

function amountInTry(facts: Facts, transactionId: number | null): number {
  const transaction = facts.transaction(transactionId);
  return transaction
    ? transaction.amount * currencyById(transaction.currency_id).value
    : 0;
}

function completedAt(facts: Facts, transactionId: number | null): string[] {
  const transaction = facts.transaction(transactionId);
  return transaction ? [transaction.complete_date] : [];
}

function paymentMethod(facts: Facts, transactionId: number | null): Id[] {
  const transaction = facts.transaction(transactionId);
  return transaction ? [transaction.payment_method] : [];
}

function currencyOf(facts: Facts, transactionId: number | null): Id[] {
  const transaction = facts.transaction(transactionId);
  return transaction ? [transaction.currency_id] : [];
}

function paidDonations(user: User, facts: Facts): Row<DonationRecord>[] {
  return facts
    .donations(user.id)
    .filter((row) => facts.succeeded(row.transaction_id));
}

function failedDonations(user: User, facts: Facts): Row<DonationRecord>[] {
  return facts
    .donations(user.id)
    .filter(
      (row) => facts.transaction(row.transaction_id)?.payment_status === 5,
    );
}

function addedDonations(user: User, facts: Facts): Row<DonationRecord>[] {
  return paidDonations(user, facts).filter(
    (row) => row.added_by_id !== null && row.recurring_order_id === null,
  );
}

function monthlyParents(user: User, facts: Facts): Row<DonationRecord>[] {
  return facts
    .donations(user.id)
    .filter(
      (row) =>
        row.recurring_order_id !== null && row.monthly_donation_id === null,
    );
}

function addedMonthly(user: User, facts: Facts): Row<DonationRecord>[] {
  return monthlyParents(user, facts).filter((row) => row.added_by_id !== null);
}

function campaignOf(
  facts: Facts,
  donation: Row<DonationRecord>,
): Row<FundraisingCampaignRecord> | undefined {
  return donation.fundraising_campaign_id === null
    ? undefined
    : facts.store.fundraisingCampaigns.get(donation.fundraising_campaign_id);
}

function utm(
  facts: Facts,
  channelId: number | null,
  part: "utm_source" | "utm_medium" | "utm_campaign" | "utm_content",
): string[] {
  const channel =
    channelId === null
      ? undefined
      : facts.store.marketingChannels.get(channelId);
  return channel ? [channel[part]] : [];
}

function duesPayments(user: User, facts: Facts): Row<SubscriptionRecord>[] {
  return facts
    .subscriptions(user.id)
    .filter((row) => row.status === 2 && facts.succeeded(row.transaction_id));
}

function debts(
  user: User,
  facts: Facts,
  statuses: readonly SubscriptionRecord["status"][],
): Row<SubscriptionRecord>[] {
  return facts
    .subscriptions(user.id)
    .filter((row) => statuses.includes(row.status));
}

const UNPAID: readonly SubscriptionRecord["status"][] = [1];
const PAID: readonly SubscriptionRecord["status"][] = [8];
const ANY_DEBT: readonly SubscriptionRecord["status"][] = [1, 8];

function debtCategories(rows: readonly Row<SubscriptionRecord>[]): Id[] {
  return rows.map((row) => row.debt_category_id ?? "none");
}

function duesCardPayments(user: User, facts: Facts): Row<SubscriptionRecord>[] {
  return duesPayments(user, facts).filter(
    (row) =>
      row.recurring_withdrawal &&
      facts.transaction(row.transaction_id)?.payment_method === 0,
  );
}

function paidTickets(user: User, facts: Facts): Row<TicketSaleRecord>[] {
  return facts
    .ticketSales(user.id)
    .filter((sale) => facts.succeeded(sale.transaction_id));
}

function paidEcards(user: User, facts: Facts): Row<EcardTransactionRecord>[] {
  return facts
    .ecardSales(user.id)
    .filter((sale) => facts.succeeded(sale.transaction_id));
}

function ownCampaigns(
  user: User,
  facts: Facts,
): Row<FundraisingCampaignRecord>[] {
  return facts.campaigns(user.id).filter((campaign) => campaign.status !== 4);
}

function campaignDonations(
  facts: Facts,
  campaign: Row<FundraisingCampaignRecord>,
): Row<DonationRecord>[] {
  return facts
    .donationsToCampaign(campaign.id)
    .filter((row) => facts.succeeded(row.transaction_id));
}

function cardBrand(bin: string): string {
  if (bin.startsWith("9792")) return "troy";
  if (/^3[47]/.test(bin)) return "amex";
  if (bin.startsWith("4")) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(bin)) return "mastercard";
  return "other";
}

function cardFirstUse(facts: Facts, card: Row<CardInfoRecord>): string | null {
  return earliest(
    facts
      .donations(card.user_id)
      .filter((row) => row.card_info_id === card.id)
      .flatMap((row) => completedAt(facts, row.transaction_id)),
  );
}

const CARD_LIFETIME_YEARS = 4;

function cardExpiry(facts: Facts, card: Row<CardInfoRecord>): string | null {
  const firstUse = cardFirstUse(facts, card);
  if (firstUse === null) return null;
  const issued = new Date(Date.parse(firstUse));
  const expiry = new Date(
    Date.UTC(
      issued.getUTCFullYear() + CARD_LIFETIME_YEARS,
      issued.getUTCMonth() + 1,
      0,
    ),
  );
  return expiry.toISOString().slice(0, 10);
}

function savedIbans(user: User, facts: Facts): Row<BankTransactionRecord>[] {
  return facts
    .bankTransfers(user.id)
    .filter(
      (row) => row.payment_status === 3 && row.counterparty_iban !== null,
    );
}

function matchedDonations(user: User, facts: Facts): Row<DonationRecord>[] {
  return nonNull(
    savedIbans(user, facts).map((row) =>
      row.matched_donation_id === null
        ? undefined
        : facts.store.donations.get(row.matched_donation_id),
    ),
  );
}

function notes(user: User, facts: Facts) {
  return facts.storedTimeline(user.id).filter((row) => row.event_type === 7);
}

function permission<
  K extends
    | "allow_comm_via_phone"
    | "allow_comm_via_sms"
    | "allow_comm_via_email",
>(channel: K): { readonly allowed: Field; readonly date: Field } {
  return {
    allowed: {
      kind: "flag",
      read: (user, facts) => facts.permission(user.id)?.[channel] ?? false,
    },
    date: {
      kind: "date",
      read: (user, facts) =>
        facts.permission(user.id)?.[`${channel}_date`] ?? null,
    },
  };
}

const PHONE = permission("allow_comm_via_phone");
const SMS = permission("allow_comm_via_sms");
const EMAIL = permission("allow_comm_via_email");

function createDate(user: User, facts: Facts): string {
  return facts.profile(user.id)?.create_date ?? user.apply_date;
}

export function lastUpdateDate(user: User, facts: Facts): string {
  return facts.profile(user.id)?.last_update_date ?? createDate(user, facts);
}

function daysSince(facts: Facts, date: string): number | null {
  const day = dayOf(date);
  return day === null ? null : facts.today - day;
}

export const SEARCH_FIELDS: { readonly [P in SearchParameter]: Field } = {
  id: { kind: "number", read: (user) => user.id, idList: true },
  name: text((user) => fullName(user)),
  first_name: text((user) => user.first_name),
  last_name: text((user) => user.last_name),
  address: text((user) => user.address),
  email: {
    kind: "text",
    read: (user) => user.email || null,
    duplicate: "email",
  },
  phone: {
    kind: "text",
    read: (user) => user.phone || null,
    duplicate: "phone",
  },
  tckno: {
    kind: "text",
    read: (user) => user.tckno || null,
    duplicate: "tckno",
  },
  district: text((user) => user.district_text),
  city: text((user) => user.city_text),
  country: text((user) => user.country_text),
  nationality: text((user) => user.nationality_text),
  post_code: text((user) => user.post_code),
  work_district: text((user) => user.work_district_text),
  work_city: text((user) => user.work_city_text),
  work_country: text((user) => user.work_country_text),
  work_address: text((user) => user.work_address),
  work_post_code: text((user) => user.work_post_code),
  work_phone: text((user) => user.work_phone),
  home_phone_first: text((user) => user.home_phone_first),
  membership_no: {
    kind: "number",
    read: (user) => (user.membership_no === 0 ? null : user.membership_no),
    idList: true,
    duplicate: "membership_no",
  },
  total_financial: { kind: "total", read: (user) => user.total_financial },
  age: {
    kind: "number",
    read: (user, facts) => {
      const birth = user.birthday === "" ? null : dayOf(user.birthday);
      return birth === null ? null : wholeYearsBetween(birth, facts.today);
    },
  },
  birthdate: { kind: "date", read: (user) => user.birthday || null },
  birthday: { kind: "anniversary", read: (user) => user.birthday || null },
  apply_date: { kind: "date", read: (user) => user.apply_date || null },
  join_date: { kind: "date", read: (user) => user.join_date || null },
  corporate_type: { kind: "flag", read: (user) => user.corporate_type },
  admin: { kind: "flag", read: (user) => user.admin },
  possible_duplicate: {
    kind: "flag",
    read: (user, facts) =>
      facts.sharedValue("email", user) ||
      facts.sharedValue("phone", user) ||
      facts.sharedValue("tckno", user),
  },
  create_date: { kind: "date", read: createDate },
  last_update_date: { kind: "date", read: lastUpdateDate },
  days_since_registration: {
    kind: "number",
    read: (user, facts) => daysSince(facts, createDate(user, facts)),
  },
  days_since_activation: {
    kind: "number",
    read: (user, facts) =>
      user.join_date === "" ? null : daysSince(facts, user.join_date),
  },
  membership_duration: {
    kind: "number",
    read: (user, facts) => {
      const joined = user.join_date === "" ? null : dayOf(user.join_date);
      return joined === null ? null : wholeYearsBetween(joined, facts.today);
    },
  },

  allow_comm_via_phone: PHONE.allowed,
  allow_comm_via_sms: SMS.allowed,
  allow_comm_via_email: EMAIL.allowed,
  allow_comm_via_phone_date: PHONE.date,
  allow_comm_via_sms_date: SMS.date,
  allow_comm_via_email_date: EMAIL.date,

  profile_pic: {
    kind: "text",
    read: (user, facts) => facts.profile(user.id)?.profile_pic ?? null,
  },
  password: {
    kind: "flag",
    read: (user, facts) => facts.profile(user.id)?.has_password ?? false,
  },
  last_login_date: {
    kind: "date",
    read: (user, facts) => facts.profile(user.id)?.last_login?.date ?? null,
  },
  last_ip_address: {
    kind: "text",
    read: (user, facts) =>
      facts.profile(user.id)?.last_login?.ip_address ?? null,
  },
  language: {
    kind: "text",
    read: (user, facts) => facts.profile(user.id)?.language ?? null,
  },
  agreement: {
    kind: "flag",
    read: (user, facts) => (facts.profile(user.id)?.agreement ?? null) !== null,
  },
  agreement_version: {
    kind: "number",
    read: (user, facts) => facts.profile(user.id)?.agreement?.version ?? null,
  },
  agreement_sign_date: {
    kind: "date",
    read: (user, facts) => facts.profile(user.id)?.agreement?.sign_date ?? null,
  },
  blocked_mail: {
    kind: "flag",
    read: (user, facts) => facts.profile(user.id)?.blocked_mail ?? false,
  },
  spam_mail: {
    kind: "flag",
    read: (user, facts) => facts.profile(user.id)?.spam_mail ?? false,
  },
  address_book: {
    kind: "flag",
    read: (user, facts) => facts.profile(user.id)?.address_book ?? false,
  },
  reminder_settings: {
    kind: "flag",
    read: (user, facts) =>
      (facts.profile(user.id)?.donation_reminder ?? null) !== null,
  },
  reminder_period: {
    kind: "number",
    read: (user, facts) =>
      facts.profile(user.id)?.donation_reminder?.period_months ?? null,
  },
  reminder_next_cycle: {
    kind: "date",
    read: (user, facts) =>
      facts.profile(user.id)?.donation_reminder?.next_cycle ?? null,
  },
  notify_after_dues_withdrawal: {
    kind: "flag",
    read: (user, facts) =>
      facts.profile(user.id)?.notify_after_dues_withdrawal ?? false,
  },
  default_dues_reminder_withdrawal: {
    kind: "flag",
    read: (user, facts) =>
      facts.profile(user.id)?.default_dues_reminder_withdrawal ?? false,
  },

  tags: {
    kind: "ids",
    read: (user, facts) => facts.tagIds(user.id),
    domain: TAGS,
  },
  notes: {
    kind: "texts",
    read: (user, facts) => notes(user, facts).map((row) => row.details),
  },
  note_date: {
    kind: "dates",
    read: (user, facts) => notes(user, facts).map((row) => row.event_time),
  },
  note_tag: {
    kind: "ids",
    read: (user, facts) => nonNull(notes(user, facts).map((row) => row.tag_id)),
    domain: TAGS,
  },
  note_count: {
    kind: "total",
    read: (user, facts) => notes(user, facts).length,
  },
  note_added_by: {
    kind: "ids",
    read: (user, facts) =>
      nonNull(notes(user, facts).map((row) => row.issuer_id)),
    domain: USERS,
  },
  history_event_type: {
    kind: "ids",
    read: (user, facts) =>
      timelineOf(user, facts).map((event) => event.event_type),
  },
  history_event_date: {
    kind: "dates",
    read: (user, facts) =>
      timelineOf(user, facts).map((event) => event.event_time),
  },
  history_event_note: {
    kind: "texts",
    read: (user, facts) =>
      timelineOf(user, facts).map((event) => event.details),
  },
  history_event_active_days: {
    kind: "total",
    read: (user, facts) => activeDays(timelineOf(user, facts)),
  },

  donation_amount: {
    kind: "numbers",
    read: (user, facts) =>
      paidDonations(user, facts).map((row) =>
        amount(facts, row.transaction_id),
      ),
  },
  donation_count: {
    kind: "total",
    read: (user, facts) => paidDonations(user, facts).length,
  },
  donation_date: {
    kind: "dates",
    read: (user, facts) =>
      paidDonations(user, facts).flatMap((row) =>
        completedAt(facts, row.transaction_id),
      ),
  },
  first_donation_date: {
    kind: "date",
    read: (user, facts) =>
      earliest(
        paidDonations(user, facts).flatMap((row) =>
          completedAt(facts, row.transaction_id),
        ),
      ),
  },
  total_donation_amount: {
    kind: "total",
    read: (user, facts) =>
      sum(
        paidDonations(user, facts).map((row) =>
          amountInTry(facts, row.transaction_id),
        ),
      ),
  },
  fundraising_campaign: {
    kind: "ids",
    read: (user, facts) =>
      nonNull(
        paidDonations(user, facts).map((row) => row.fundraising_campaign_id),
      ),
    domain: CAMPAIGNS,
  },
  sub_donation_type: {
    kind: "ids",
    read: (user, facts) =>
      nonNull(
        paidDonations(user, facts).map((row) => row.sub_donation_type_id),
      ),
    domain: DONATION_CATEGORIES,
  },
  donation_page: {
    kind: "ids",
    read: (user, facts) =>
      nonNull(paidDonations(user, facts).map((row) => row.fundraising_page_id)),
    domain: DONATION_PAGES,
  },
  donor_type: {
    kind: "ids",
    read: (user, facts) =>
      paidDonations(user, facts).map((row) => row.donor_type),
  },
  d_type: {
    kind: "ids",
    read: (user, facts) => paidDonations(user, facts).map((row) => row.d_type),
  },
  donation_currency: {
    kind: "ids",
    read: (user, facts) =>
      paidDonations(user, facts).flatMap((row) =>
        currencyOf(facts, row.transaction_id),
      ),
    domain: CURRENCY,
  },
  donation_payment_method: {
    kind: "ids",
    read: (user, facts) =>
      paidDonations(user, facts).flatMap((row) =>
        paymentMethod(facts, row.transaction_id),
      ),
  },
  donation_details: {
    kind: "texts",
    read: (user, facts) => paidDonations(user, facts).map((row) => row.details),
  },
  donation_utm_source: {
    kind: "texts",
    read: (user, facts) =>
      paidDonations(user, facts).flatMap((row) =>
        utm(facts, row.marketing_channel_id, "utm_source"),
      ),
  },
  donation_utm_medium: {
    kind: "texts",
    read: (user, facts) =>
      paidDonations(user, facts).flatMap((row) =>
        utm(facts, row.marketing_channel_id, "utm_medium"),
      ),
  },
  donation_utm_campaign: {
    kind: "texts",
    read: (user, facts) =>
      paidDonations(user, facts).flatMap((row) =>
        utm(facts, row.marketing_channel_id, "utm_campaign"),
      ),
  },
  donation_utm_content: {
    kind: "texts",
    read: (user, facts) =>
      paidDonations(user, facts).flatMap((row) =>
        utm(facts, row.marketing_channel_id, "utm_content"),
      ),
  },
  f2f_group_id: {
    kind: "ids",
    read: (user, facts) =>
      nonNull(paidDonations(user, facts).map((row) => row.f2f_group_id)),
    domain: F2F_GROUPS,
  },
  fundraising_team: {
    kind: "ids",
    read: (user, facts) =>
      nonNull(
        paidDonations(user, facts).map(
          (row) => campaignOf(facts, row)?.team_id,
        ),
      ),
    domain: TEAMS,
  },
  fundraising_event: {
    kind: "ids",
    read: (user, facts) =>
      nonNull(
        paidDonations(user, facts).map(
          (row) => campaignOf(facts, row)?.association_campaign_target_id,
        ),
      ),
    domain: FUNDRAISING_EVENTS,
  },
  fundraising_team_campaign: {
    kind: "ids",
    read: (user, facts) =>
      nonNull(
        paidDonations(user, facts).map(
          (row) => campaignOf(facts, row)?.team_campaign_id,
        ),
      ),
    domain: TEAM_CAMPAIGNS,
  },

  failed_donation_amount: {
    kind: "numbers",
    read: (user, facts) =>
      failedDonations(user, facts).map((row) =>
        amount(facts, row.transaction_id),
      ),
  },
  failed_donation_date: {
    kind: "dates",
    read: (user, facts) =>
      failedDonations(user, facts).flatMap((row) =>
        completedAt(facts, row.transaction_id),
      ),
  },
  failed_fundraising_campaign: {
    kind: "ids",
    read: (user, facts) =>
      nonNull(
        failedDonations(user, facts).map((row) => row.fundraising_campaign_id),
      ),
    domain: CAMPAIGNS,
  },
  failed_sub_donation_type: {
    kind: "ids",
    read: (user, facts) =>
      nonNull(
        failedDonations(user, facts).map((row) => row.sub_donation_type_id),
      ),
    domain: DONATION_CATEGORIES,
  },
  failed_donation_page: {
    kind: "ids",
    read: (user, facts) =>
      nonNull(
        failedDonations(user, facts).map((row) => row.fundraising_page_id),
      ),
    domain: DONATION_PAGES,
  },
  failed_donation_currency: {
    kind: "ids",
    read: (user, facts) =>
      failedDonations(user, facts).flatMap((row) =>
        currencyOf(facts, row.transaction_id),
      ),
    domain: CURRENCY,
  },
  failed_fundraising_team: {
    kind: "ids",
    read: (user, facts) =>
      nonNull(
        failedDonations(user, facts).map(
          (row) => campaignOf(facts, row)?.team_id,
        ),
      ),
    domain: TEAMS,
  },
  failed_fundraising_event: {
    kind: "ids",
    read: (user, facts) =>
      nonNull(
        failedDonations(user, facts).map(
          (row) => campaignOf(facts, row)?.association_campaign_target_id,
        ),
      ),
    domain: FUNDRAISING_EVENTS,
  },
  failed_fundraising_team_campaign: {
    kind: "ids",
    read: (user, facts) =>
      nonNull(
        failedDonations(user, facts).map(
          (row) => campaignOf(facts, row)?.team_campaign_id,
        ),
      ),
    domain: TEAM_CAMPAIGNS,
  },

  added_donation_count: {
    kind: "total",
    read: (user, facts) => addedDonations(user, facts).length,
  },
  added_donation_amount: {
    kind: "numbers",
    read: (user, facts) =>
      addedDonations(user, facts).map((row) =>
        amount(facts, row.transaction_id),
      ),
  },
  added_total_donation_amount: {
    kind: "total",
    read: (user, facts) =>
      sum(
        addedDonations(user, facts).map((row) =>
          amountInTry(facts, row.transaction_id),
        ),
      ),
  },
  added_donation_date: {
    kind: "dates",
    read: (user, facts) =>
      addedDonations(user, facts).flatMap((row) =>
        completedAt(facts, row.transaction_id),
      ),
  },
  added_monthly_donation_count: {
    kind: "total",
    read: (user, facts) => addedMonthly(user, facts).length,
  },
  added_monthly_donation_amount: {
    kind: "numbers",
    read: (user, facts) =>
      addedMonthly(user, facts).map((row) => amount(facts, row.transaction_id)),
  },
  added_total_monthly_donation_amount: {
    kind: "total",
    read: (user, facts) =>
      sum(
        addedMonthly(user, facts).map((row) =>
          amountInTry(facts, row.transaction_id),
        ),
      ),
  },

  recurring_donor: {
    kind: "flag",
    read: (user, facts) =>
      monthlyParents(user, facts).some((row) => row.recurring_status === 1),
  },
  recurring_donation_amount: {
    kind: "numbers",
    read: (user, facts) =>
      monthlyParents(user, facts).map((row) =>
        amount(facts, row.transaction_id),
      ),
  },
  total_recurring_donation_amount: {
    kind: "total",
    read: (user, facts) =>
      sum(
        monthlyParents(user, facts)
          .filter((row) => row.recurring_status === 1)
          .map((row) => amountInTry(facts, row.transaction_id)),
      ),
  },
  total_recurring_donation_count: {
    kind: "total",
    read: (user, facts) => monthlyParents(user, facts).length,
  },
  total_recurring_withdrawal_count: {
    kind: "total",
    read: (user, facts) =>
      sum(
        monthlyParents(user, facts).map((row) => row.recurring_withdraw_count),
      ),
  },
  total_recurring_withdrawal_amount: {
    kind: "total",
    read: (user, facts) =>
      sum(
        monthlyParents(user, facts).map(
          (row) => row.recurring_total_withdraw_amount,
        ),
      ),
  },
  recurring_donation_start_date: {
    kind: "dates",
    read: (user, facts) =>
      nonNull(
        monthlyParents(user, facts).map((row) => row.recurring_start_date),
      ),
  },
  recurring_donation_cancel_date: {
    kind: "dates",
    read: (user, facts) =>
      nonNull(
        monthlyParents(user, facts).map((row) => row.recurring_cancel_date),
      ),
  },
  first_monthly_donation_date: {
    kind: "date",
    read: (user, facts) =>
      earliest(
        nonNull(
          monthlyParents(user, facts).map((row) => row.recurring_start_date),
        ),
      ),
  },
  recurring_limit: {
    kind: "numbers",
    read: (user, facts) =>
      nonNull(
        monthlyParents(user, facts).map((row) => row.recurring_limit),
      ).filter((limit) => limit > 0),
  },
  remaining_recurring_limit: {
    kind: "numbers",
    read: (user, facts) =>
      monthlyParents(user, facts).flatMap((row) =>
        row.recurring_limit === null || row.recurring_limit === 0
          ? []
          : [Math.max(0, row.recurring_limit - row.recurring_withdraw_count)],
      ),
  },
  recurring_amount_change: {
    kind: "numbers",
    read: (user, facts) =>
      facts
        .donationRequests(user.id)
        .filter((row) => row.request_type === 1)
        .map((row) => Number(row.value))
        .filter((value) => Number.isFinite(value)),
  },
  recurring_amount_change_date: {
    kind: "dates",
    read: (user, facts) =>
      facts
        .donationRequests(user.id)
        .filter((row) => row.request_type === 1)
        .map((row) => row.create_date),
  },
  cancel_request: {
    kind: "flag",
    read: (user, facts) =>
      facts.donationRequests(user.id).some((row) => row.request_type === 0),
  },
  cancel_request_date: {
    kind: "dates",
    read: (user, facts) =>
      facts
        .donationRequests(user.id)
        .filter((row) => row.request_type === 0)
        .map((row) => row.create_date),
  },

  registered_card: {
    kind: "flag",
    read: (user, facts) => facts.cards(user.id).length > 0,
  },
  card_count: {
    kind: "total",
    read: (user, facts) => facts.cards(user.id).length,
  },
  card_add_date: {
    kind: "dates",
    read: (user, facts) =>
      nonNull(facts.cards(user.id).map((card) => cardFirstUse(facts, card))),
  },
  card_expiry: {
    kind: "dates",
    read: (user, facts) =>
      nonNull(facts.cards(user.id).map((card) => cardExpiry(facts, card))),
  },
  card_type: {
    kind: "ids",
    read: (user, facts) =>
      facts.cards(user.id).map((card) => cardBrand(card.bin_number)),
  },

  subscription_payment_date: {
    kind: "dates",
    read: (user, facts) =>
      duesPayments(user, facts).map((row) => row.operation_date),
  },
  subscription_payment_amount: {
    kind: "numbers",
    read: (user, facts) => duesPayments(user, facts).map((row) => row.amount),
  },
  subscription_payment_method: {
    kind: "ids",
    read: (user, facts) =>
      duesPayments(user, facts).flatMap((row) =>
        paymentMethod(facts, row.transaction_id),
      ),
  },
  recurring_debt: {
    kind: "flag",
    read: (user, facts) =>
      duesPayments(user, facts).some((row) => row.recurring),
  },
  automatic_dues_withdrawal: {
    kind: "flag",
    read: (user, facts) =>
      facts.subscriptions(user.id).some((row) => row.recurring_withdrawal),
  },
  card_for_dues: {
    kind: "flag",
    read: (user, facts) => duesCardPayments(user, facts).length > 0,
  },
  dues_card_add_date: {
    kind: "date",
    read: (user, facts) =>
      earliest(duesCardPayments(user, facts).map((row) => row.operation_date)),
  },
  card_type_for_dues: {
    kind: "ids",
    read: (user, facts) =>
      nonNull(
        duesCardPayments(user, facts).map((row) => {
          const bin = facts.transaction(row.transaction_id)?.bin_number ?? null;
          return bin === null ? null : cardBrand(bin);
        }),
      ),
  },
  debt_record: {
    kind: "flag",
    read: (user, facts) => debts(user, facts, ANY_DEBT).length > 0,
  },
  unpaid_debt_record: {
    kind: "flag",
    read: (user, facts) => debts(user, facts, UNPAID).length > 0,
  },
  paid_debt_record: {
    kind: "flag",
    read: (user, facts) => debts(user, facts, PAID).length > 0,
  },
  debt_category: {
    kind: "ids",
    read: (user, facts) => debtCategories(debts(user, facts, ANY_DEBT)),
    domain: DEBT_CATEGORIES,
  },
  unpaid_debt_category: {
    kind: "ids",
    read: (user, facts) => debtCategories(debts(user, facts, UNPAID)),
    domain: DEBT_CATEGORIES,
  },
  paid_debt_category: {
    kind: "ids",
    read: (user, facts) => debtCategories(debts(user, facts, PAID)),
    domain: DEBT_CATEGORIES,
  },
  unpaid_debt_count: {
    kind: "total",
    read: (user, facts) => debts(user, facts, UNPAID).length,
  },
  debt_amount: {
    kind: "numbers",
    read: (user, facts) =>
      debts(user, facts, ANY_DEBT).map((row) => row.amount),
  },
  total_debt_amount: {
    kind: "total",
    read: (user, facts) =>
      sum(debts(user, facts, UNPAID).map((row) => row.amount)),
  },
  membership_due_details: {
    kind: "texts",
    read: (user, facts) =>
      facts.subscriptions(user.id).map((row) => row.details),
  },
  active_membership_duration: {
    kind: "total",
    read: (user, facts) =>
      new Set(duesPayments(user, facts).map((row) => row.period.slice(0, 4)))
        .size,
  },

  registered_event: {
    kind: "ids",
    read: (user, facts) =>
      paidTickets(user, facts).map((sale) => sale.event_id),
    domain: EVENTS,
  },
  registered_event_count: {
    kind: "total",
    read: (user, facts) =>
      new Set(paidTickets(user, facts).map((sale) => sale.event_id)).size,
  },
  event_register_date: {
    kind: "dates",
    read: (user, facts) =>
      paidTickets(user, facts).flatMap((sale) =>
        completedAt(facts, sale.transaction_id),
      ),
  },
  bought_ticket_type: {
    kind: "ids",
    read: (user, facts) => {
      const sales = new Set(paidTickets(user, facts).map((sale) => sale.id));
      return facts.store.soldTickets
        .list((seat) => sales.has(seat.ticket_sale_id))
        .map((seat) => seat.ticket_id);
    },
    domain: TICKETS,
  },
  ticket_payment_method: {
    kind: "ids",
    read: (user, facts) =>
      paidTickets(user, facts).flatMap((sale) =>
        paymentMethod(facts, sale.transaction_id),
      ),
  },

  custom_form: {
    kind: "ids",
    read: (user, facts) =>
      facts.formAnswers(user.id).map((answer) => answer.form_id),
    domain: FORMS,
  },
  form_complete_date: {
    kind: "dates",
    read: (user, facts) =>
      facts.formAnswers(user.id).map((answer) => answer.complete_date),
  },

  bought_certificate: {
    kind: "flag",
    read: (user, facts) => paidEcards(user, facts).length > 0,
  },
  certificate: {
    kind: "ids",
    read: (user, facts) =>
      paidEcards(user, facts).map((sale) => sale.certificate_id),
    domain: ECARDS,
  },
  certificate_count: {
    kind: "total",
    read: (user, facts) => paidEcards(user, facts).length,
  },
  certificate_date: {
    kind: "dates",
    read: (user, facts) =>
      paidEcards(user, facts).flatMap((sale) =>
        completedAt(facts, sale.transaction_id),
      ),
  },
  certificate_currency: {
    kind: "ids",
    read: (user, facts) =>
      paidEcards(user, facts).flatMap((sale) =>
        currencyOf(facts, sale.transaction_id),
      ),
    domain: CURRENCY,
  },
  ecard_payment_method: {
    kind: "ids",
    read: (user, facts) =>
      paidEcards(user, facts).flatMap((sale) =>
        paymentMethod(facts, sale.transaction_id),
      ),
  },
  ecard_amount: {
    kind: "numbers",
    read: (user, facts) =>
      paidEcards(user, facts).map((sale) => amount(facts, sale.transaction_id)),
  },
  total_ecard_sum: {
    kind: "total",
    read: (user, facts) =>
      sum(
        paidEcards(user, facts).map((sale) =>
          amountInTry(facts, sale.transaction_id),
        ),
      ),
  },
  ecard_category: {
    kind: "ids",
    read: (user, facts) =>
      paidEcards(user, facts).flatMap(
        (sale) => facts.store.ecards.get(sale.certificate_id)?.categories ?? [],
      ),
    domain: ECARD_CATEGORIES,
  },
  ecard_delivery_date: {
    kind: "dates",
    read: (user, facts) =>
      nonNull(paidEcards(user, facts).map((sale) => sale.delivery_date)),
  },
  ecard_recipient_count: {
    kind: "numbers",
    read: (user, facts) =>
      paidEcards(user, facts).map((sale) => sale.recipient_count),
  },
  total_ecard_recipient_count: {
    kind: "total",
    read: (user, facts) =>
      sum(paidEcards(user, facts).map((sale) => sale.recipient_count)),
  },
  ecard_has_cargo: {
    kind: "flag",
    read: (user, facts) =>
      paidEcards(user, facts).some((sale) => sale.has_cargo),
  },
  ecard_utm_source: {
    kind: "texts",
    read: (user, facts) =>
      paidEcards(user, facts).flatMap((sale) =>
        utm(facts, sale.marketing_channel_id, "utm_source"),
      ),
  },
  ecard_utm_medium: {
    kind: "texts",
    read: (user, facts) =>
      paidEcards(user, facts).flatMap((sale) =>
        utm(facts, sale.marketing_channel_id, "utm_medium"),
      ),
  },
  ecard_utm_campaign: {
    kind: "texts",
    read: (user, facts) =>
      paidEcards(user, facts).flatMap((sale) =>
        utm(facts, sale.marketing_channel_id, "utm_campaign"),
      ),
  },
  ecard_utm_content: {
    kind: "texts",
    read: (user, facts) =>
      paidEcards(user, facts).flatMap((sale) =>
        utm(facts, sale.marketing_channel_id, "utm_content"),
      ),
  },

  fundraising_campaign_count: {
    kind: "total",
    read: (user, facts) => ownCampaigns(user, facts).length,
  },
  fundraising_campaign_start_date: {
    kind: "dates",
    read: (user, facts) =>
      nonNull(ownCampaigns(user, facts).map((row) => row.activation_date)),
  },
  fundraising_campaign_end_date: {
    kind: "dates",
    read: (user, facts) =>
      nonNull(ownCampaigns(user, facts).map((row) => row.finish_date)),
  },
  fundraising_campaign_donation_total: {
    kind: "numbers",
    read: (user, facts) =>
      ownCampaigns(user, facts).map((campaign) =>
        sum(
          campaignDonations(facts, campaign).map((row) =>
            amountInTry(facts, row.transaction_id),
          ),
        ),
      ),
  },
  fundraising_campaign_donation_count: {
    kind: "numbers",
    read: (user, facts) =>
      ownCampaigns(user, facts).map(
        (campaign) => campaignDonations(facts, campaign).length,
      ),
  },
  fundraising_campaign_total_donation_total: {
    kind: "total",
    read: (user, facts) =>
      sum(
        ownCampaigns(user, facts).flatMap((campaign) =>
          campaignDonations(facts, campaign).map((row) =>
            amountInTry(facts, row.transaction_id),
          ),
        ),
      ),
  },
  fundraising_campaign_total_donation_count: {
    kind: "total",
    read: (user, facts) =>
      sum(
        ownCampaigns(user, facts).map(
          (campaign) => campaignDonations(facts, campaign).length,
        ),
      ),
  },
  fundraising_campaign_status: {
    kind: "ids",
    read: (user, facts) => facts.campaigns(user.id).map((row) => row.status),
  },
  fundraising_campaign_target: {
    kind: "numbers",
    read: (user, facts) =>
      ownCampaigns(user, facts)
        .filter((row) => row.has_target)
        .map((row) => row.target),
  },
  fundraising_campaign_donation_type: {
    kind: "ids",
    read: (user, facts) =>
      nonNull(ownCampaigns(user, facts).map((row) => row.sub_donation_type_id)),
    domain: DONATION_CATEGORIES,
  },
  fundraising_campaign_target_event: {
    kind: "ids",
    read: (user, facts) =>
      nonNull(
        ownCampaigns(user, facts).map(
          (row) => row.association_campaign_target_id,
        ),
      ),
    domain: FUNDRAISING_EVENTS,
  },
  fundraising_campaign_event_date: {
    kind: "dates",
    read: (user, facts) =>
      nonNull(ownCampaigns(user, facts).map((row) => row.event_date)),
  },
  fundraising_team_member: {
    kind: "ids",
    read: (user, facts) => [
      ...new Set([
        ...facts.teams(user.id).map((team) => team.id),
        ...nonNull(ownCampaigns(user, facts).map((row) => row.team_id)),
      ]),
    ],
    domain: TEAMS,
  },
  fundraising_team_campaign_member: {
    kind: "ids",
    read: (user, facts) =>
      nonNull(ownCampaigns(user, facts).map((row) => row.team_campaign_id)),
    domain: TEAM_CAMPAIGNS,
  },

  saved_iban: {
    kind: "flag",
    read: (user, facts) => savedIbans(user, facts).length > 0,
  },
  saved_iban_number: {
    kind: "texts",
    read: (user, facts) =>
      nonNull(savedIbans(user, facts).map((row) => row.counterparty_iban)),
  },
  saved_iban_bank: {
    kind: "texts",
    read: (user, facts) =>
      nonNull(savedIbans(user, facts).map((row) => row.counterparty_bank)),
  },
  saved_iban_sender_name: {
    kind: "texts",
    read: (user, facts) =>
      nonNull(savedIbans(user, facts).map((row) => row.counterparty_name)),
  },
  saved_iban_assignment_type: {
    kind: "ids",
    read: (user, facts) =>
      nonNull(savedIbans(user, facts).map((row) => row.transaction_type)),
  },
  saved_iban_count: {
    kind: "total",
    read: (user, facts) =>
      new Set(savedIbans(user, facts).map((row) => row.counterparty_iban)).size,
  },
  saved_iban_add_date: {
    kind: "dates",
    read: (user, facts) => {
      const first = new Map<string, string>();
      for (const row of savedIbans(user, facts)) {
        const iban = row.counterparty_iban ?? "";
        const seen = first.get(iban);
        if (
          seen === undefined ||
          Date.parse(row.complete_date) < Date.parse(seen)
        ) {
          first.set(iban, row.complete_date);
        }
      }
      return [...first.values()];
    },
  },
  saved_iban_donation_category: {
    kind: "ids",
    read: (user, facts) =>
      nonNull(
        matchedDonations(user, facts).map((row) => row.sub_donation_type_id),
      ),
    domain: DONATION_CATEGORIES,
  },
  saved_iban_donation_page: {
    kind: "ids",
    read: (user, facts) =>
      nonNull(
        matchedDonations(user, facts).map((row) => row.fundraising_page_id),
      ),
    domain: DONATION_PAGES,
  },
  saved_iban_fundraising_campaign: {
    kind: "ids",
    read: (user, facts) =>
      nonNull(
        matchedDonations(user, facts).map((row) => row.fundraising_campaign_id),
      ),
    domain: CAMPAIGNS,
  },
  saved_iban_donation_form: {
    kind: "ids",
    read: (user, facts) =>
      nonNull(matchedDonations(user, facts).map((row) => row.module_id)),
    domain: DONATION_FORMS,
  },

  is_related_contact: {
    kind: "flag",
    read: (user, facts) => facts.relationsOf(user.id).length > 0,
  },
  has_related_contact: {
    kind: "flag",
    read: (user, facts) => facts.relationsHeld(user.id).length > 0,
  },
  related_contact_dues_perm: {
    kind: "flag",
    read: (user, facts) =>
      facts.relationsHeld(user.id).some((row) => row.dues_permission),
  },
  related_contact_comm_perm: {
    kind: "flag",
    read: (user, facts) =>
      facts.relationsHeld(user.id).some((row) => row.comm_permission),
  },
  related_contact_tag: {
    kind: "ids",
    read: (user, facts) =>
      facts
        .relationsHeld(user.id)
        .flatMap((row) => facts.tagIds(row.related_user_id)),
    domain: TAGS,
  },
  related_contact_note: {
    kind: "texts",
    read: (user, facts) =>
      facts.relationsHeld(user.id).flatMap((row) =>
        facts
          .storedTimeline(row.related_user_id)
          .filter((entry) => entry.event_type === 7)
          .map((entry) => entry.details),
      ),
  },
  related_contact_of: {
    kind: "ids",
    read: (user, facts) => facts.relationsOf(user.id).map((row) => row.user_id),
    domain: USERS,
  },
};
