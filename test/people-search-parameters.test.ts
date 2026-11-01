import { describe, expect, test } from "bun:test";

import type { UserRecord } from "../src/store/records";
import type { OrgStore } from "../src/store/store";
import {
  bankTransfer,
  campaign,
  cardInfo,
  channel,
  client,
  day,
  donation,
  donationRequest,
  dues,
  duesPayment,
  ecardSale,
  expectStatus,
  formAnswer,
  kelder,
  leaf,
  matchingIds,
  monthly,
  noon,
  note,
  permission,
  person,
  profile,
  relation,
  ticketSale,
  within,
  type Filter,
  type Payment,
} from "./people-fixtures";

type Parameter = Filter["parameter"];
type Id = number | string;
type Give<V> = (db: OrgStore, userId: number, value: V) => void;

type Spec =
  | {
      readonly kind: "text";
      readonly give: Give<string>;
      readonly decoy?: Give<string>;
      readonly values?: readonly [string, string, string];
    }
  | {
      readonly kind: "number" | "total";
      readonly give: Give<number>;
      readonly decoy?: Give<number>;
      readonly values?: readonly [number, number];
    }
  | {
      readonly kind: "date" | "anniversary";
      readonly give: Give<string>;
      readonly decoy?: Give<string>;
    }
  | {
      readonly kind: "flag";
      readonly give: Give<boolean>;
      readonly decoy?: Give<boolean>;
    }
  | {
      readonly kind: "ids";
      readonly give: Give<Id>;
      readonly decoy?: Give<Id>;
      readonly values: readonly [Id, Id];
      readonly missing?: Id;
    }
  | { readonly kind: "explicit"; readonly where: string };

interface Case {
  readonly condition: Filter["condition"];
  readonly value?: Filter["value"];
  readonly expect: readonly string[];
}

type TextField = {
  [K in keyof UserRecord]: UserRecord[K] extends string ? K : never;
}[keyof UserRecord];

function userText(field: TextField): Spec {
  return {
    kind: "text",
    give: (db, id, value) => {
      const patch: Partial<Omit<UserRecord, "id">> = {};
      patch[field] = value;
      db.users.update(id, patch);
    },
  };
}

function yearsAgo(years: number): string {
  return `${2026 - years}-10-31`;
}

function times(count: number, each: (index: number) => void): void {
  for (let index = 0; index < count; index += 1) each(index);
}

function asNumber(value: Id): number {
  return typeof value === "number" ? value : Number(value);
}

const CAMPAIGN_OF_TEAM: Readonly<Record<string, number>> = {
  "871": 801,
  "872": 802,
};
const CAMPAIGN_OF_EVENT: Readonly<Record<string, number>> = {
  "851": 801,
  "852": 802,
};
const CAMPAIGN_OF_TEAM_CAMPAIGN: Readonly<Record<string, number>> = {
  "8701": 801,
  "8703": 802,
};

function viaCampaign(map: Readonly<Record<string, number>>, value: Id): number {
  const found = map[String(value)];
  if (found === undefined) throw new Error(`no seeded campaign for ${value}`);
  return found;
}

function paid(payment: Payment = {}): Payment {
  return { status: 3, ...payment };
}

function failed(payment: Payment = {}): Payment {
  return { status: 5, ...payment };
}

const UTM_PARTS = {
  source: "utm_source",
  medium: "utm_medium",
  campaign: "utm_campaign",
  content: "utm_content",
} as const;

function donationUtm(part: keyof typeof UTM_PARTS): Spec {
  const give =
    (payment: Payment): Give<string> =>
    (db, id, value) =>
      void donation(db, id, payment, {
        marketing_channel_id: channel(db, UTM_PARTS[part], value),
      });
  return { kind: "text", give: give(paid()), decoy: give(failed()) };
}

function ecardUtm(part: keyof typeof UTM_PARTS): Spec {
  const give =
    (payment: Payment): Give<string> =>
    (db, id, value) =>
      ecardSale(
        db,
        id,
        { marketing_channel_id: channel(db, UTM_PARTS[part], value) },
        payment,
      );
  return { kind: "text", give: give(paid()), decoy: give(failed()) };
}

function profileFlag(
  field:
    | "has_password"
    | "blocked_mail"
    | "spam_mail"
    | "address_book"
    | "notify_after_dues_withdrawal"
    | "default_dues_reminder_withdrawal",
): Spec {
  return {
    kind: "flag",
    give: (db, id, value) => {
      const fields: Parameters<typeof profile>[2] = {};
      fields[field] = value;
      profile(db, id, fields);
    },
  };
}

function channelPermission(
  allowed:
    | "allow_comm_via_phone"
    | "allow_comm_via_sms"
    | "allow_comm_via_email",
): { readonly flag: Spec; readonly date: Spec } {
  return {
    flag: {
      kind: "flag",
      give: (db, id, value) => permission(db, id, { [allowed]: value }),
    },
    date: {
      kind: "date",
      give: (db, id, value) =>
        permission(db, id, { [`${allowed}_date`]: noon(value) }),
    },
  };
}

const PHONE = channelPermission("allow_comm_via_phone");
const SMS = channelPermission("allow_comm_via_sms");
const EMAIL = channelPermission("allow_comm_via_email");

function donationFacet(
  payment: () => Payment,
  facet: (value: Id) => Parameters<typeof donation>[3],
  values: readonly [Id, Id],
  missing?: Id,
): Spec {
  const decoy = payment().status === 5 ? paid : failed;
  return {
    kind: "ids",
    values,
    ...(missing === undefined ? {} : { missing }),
    give: (db, id, value) => void donation(db, id, payment(), facet(value)),
    decoy: (db, id, value) => void donation(db, id, decoy(), facet(value)),
  };
}

function donationFacets(payment: () => Payment) {
  return {
    campaign: donationFacet(
      payment,
      (value) => ({ fundraising_campaign_id: asNumber(value) }),
      [801, 802],
      99,
    ),
    category: donationFacet(
      payment,
      (value) => ({ sub_donation_type_id: asNumber(value) }),
      [201, 202],
      99,
    ),
    page: donationFacet(
      payment,
      (value) => ({ fundraising_page_id: asNumber(value) }),
      [31, 32],
      99,
    ),
    team: donationFacet(
      payment,
      (value) => ({
        fundraising_campaign_id: viaCampaign(CAMPAIGN_OF_TEAM, value),
      }),
      [871, 872],
      99,
    ),
    event: donationFacet(
      payment,
      (value) => ({
        fundraising_campaign_id: viaCampaign(CAMPAIGN_OF_EVENT, value),
      }),
      [851, 852],
      99,
    ),
    teamCampaign: donationFacet(
      payment,
      (value) => ({
        fundraising_campaign_id: viaCampaign(CAMPAIGN_OF_TEAM_CAMPAIGN, value),
      }),
      [8701, 8703],
      99,
    ),
    currency: {
      kind: "ids",
      values: [2, 3],
      missing: 99,
      give: (db, id, value) =>
        void donation(db, id, { ...payment(), currencyId: asNumber(value) }),
      decoy: (db, id, value) =>
        void donation(db, id, {
          status: payment().status === 5 ? 3 : 5,
          currencyId: asNumber(value),
        }),
    } satisfies Spec,
  };
}

const PAID = donationFacets(paid);
const FAILED = donationFacets(failed);

function savedIbanFacet(
  facet: (value: Id) => Parameters<typeof donation>[3],
  values: readonly [Id, Id],
): Spec {
  return {
    kind: "ids",
    values,
    missing: 99,
    give: (db, id, value) => {
      const matched = donation(db, id, paid({ method: 2 }), facet(value));
      bankTransfer(db, id, { donationId: matched.id });
    },
    decoy: (db, id, value) => {
      const matched = donation(db, id, paid({ method: 2 }), facet(value));
      bankTransfer(db, id, { donationId: matched.id, status: 8 });
    },
  };
}

function ownedCampaign(
  facet: (value: Id) => Parameters<typeof campaign>[2],
  values: readonly [Id, Id],
  missing?: Id,
  deletedCounts = false,
): Spec {
  return {
    kind: "ids",
    values,
    ...(missing === undefined ? {} : { missing }),
    give: (db, id, value) => void campaign(db, id, facet(value)),
    ...(deletedCounts
      ? {}
      : {
          decoy: (db: OrgStore, id: number, value: Id) =>
            void campaign(db, id, { ...facet(value), status: 4 }),
        }),
  };
}

function freshRelated(db: OrgStore, holderId: number): number {
  const related = person(db, `yakın-${holderId}`);
  relation(db, holderId, related);
  return related;
}

const SPECS: { readonly [P in Parameter]: Spec } = {
  id: { kind: "explicit", where: "people-search.test.ts id filter" },
  name: {
    kind: "text",
    give: (db, id, value) => void db.users.update(id, { first_name: value }),
  },
  first_name: userText("first_name"),
  last_name: userText("last_name"),
  address: userText("address"),
  email: userText("email"),
  phone: userText("phone"),
  tckno: userText("tckno"),
  district: userText("district_text"),
  city: userText("city_text"),
  country: userText("country_text"),
  nationality: userText("nationality_text"),
  post_code: userText("post_code"),
  work_district: userText("work_district_text"),
  work_city: userText("work_city_text"),
  work_country: userText("work_country_text"),
  work_address: userText("work_address"),
  work_post_code: userText("work_post_code"),
  work_phone: userText("work_phone"),
  home_phone_first: userText("home_phone_first"),
  membership_no: {
    kind: "number",
    give: (db, id, value) => void db.users.update(id, { membership_no: value }),
  },
  total_financial: {
    kind: "total",
    values: [100, 300],
    give: (db, id, value) =>
      void db.users.update(id, { total_financial: value }),
  },
  age: {
    kind: "number",
    give: (db, id, value) =>
      void db.users.update(id, { birthday: yearsAgo(value) }),
  },
  birthdate: {
    kind: "date",
    give: (db, id, value) => void db.users.update(id, { birthday: value }),
  },
  birthday: {
    kind: "anniversary",
    give: (db, id, value) => void db.users.update(id, { birthday: value }),
  },
  apply_date: {
    kind: "date",
    give: (db, id, value) =>
      void db.users.update(id, { apply_date: noon(value) }),
  },
  join_date: {
    kind: "date",
    give: (db, id, value) =>
      void db.users.update(id, { join_date: noon(value) }),
  },
  corporate_type: {
    kind: "flag",
    give: (db, id, value) =>
      void db.users.update(id, { corporate_type: value }),
  },
  admin: {
    kind: "flag",
    give: (db, id, value) => void db.users.update(id, { admin: value }),
  },
  possible_duplicate: {
    kind: "flag",
    give: (db, id, value) =>
      void db.users.update(id, {
        email: value
          ? (db.users.get(1010)?.email ?? "")
          : `tek-${id}@kisi.example`,
      }),
  },
  create_date: {
    kind: "date",
    give: (db, id, value) => profile(db, id, { create_date: noon(value) }),
  },
  last_update_date: {
    kind: "date",
    give: (db, id, value) => profile(db, id, { last_update_date: noon(value) }),
  },
  days_since_registration: {
    kind: "number",
    give: (db, id, value) =>
      profile(db, id, { create_date: noon(day(-value)) }),
  },
  days_since_activation: {
    kind: "number",
    give: (db, id, value) =>
      void db.users.update(id, { join_date: noon(day(-value)) }),
  },
  membership_duration: {
    kind: "number",
    give: (db, id, value) =>
      void db.users.update(id, { join_date: noon(yearsAgo(value)) }),
  },

  allow_comm_via_phone: PHONE.flag,
  allow_comm_via_sms: SMS.flag,
  allow_comm_via_email: EMAIL.flag,
  allow_comm_via_phone_date: PHONE.date,
  allow_comm_via_sms_date: SMS.date,
  allow_comm_via_email_date: EMAIL.date,

  profile_pic: {
    kind: "text",
    give: (db, id, value) => profile(db, id, { profile_pic: value }),
  },
  password: profileFlag("has_password"),
  last_login_date: {
    kind: "date",
    give: (db, id, value) =>
      profile(db, id, {
        last_login: { date: noon(value), ip_address: "78.160.0.1" },
      }),
  },
  last_ip_address: {
    kind: "text",
    give: (db, id, value) =>
      profile(db, id, {
        last_login: { date: noon(day(-1)), ip_address: value },
      }),
  },
  language: {
    kind: "text",
    values: ["en", "tr", "n"],
    give: (db, id, value) =>
      profile(db, id, { language: value === "en" ? "en" : "tr" }),
  },
  agreement: {
    kind: "flag",
    give: (db, id, value) =>
      profile(db, id, {
        agreement: value ? { version: 1, sign_date: noon(day(-9)) } : null,
      }),
  },
  agreement_version: {
    kind: "number",
    give: (db, id, value) =>
      profile(db, id, {
        agreement: { version: value, sign_date: noon(day(-9)) },
      }),
  },
  agreement_sign_date: {
    kind: "date",
    give: (db, id, value) =>
      profile(db, id, { agreement: { version: 2, sign_date: noon(value) } }),
  },
  blocked_mail: profileFlag("blocked_mail"),
  spam_mail: profileFlag("spam_mail"),
  address_book: profileFlag("address_book"),
  reminder_settings: {
    kind: "flag",
    give: (db, id, value) =>
      profile(db, id, {
        donation_reminder: value
          ? { period_months: 3, next_cycle: day(20) }
          : null,
      }),
  },
  reminder_period: {
    kind: "number",
    give: (db, id, value) =>
      profile(db, id, {
        donation_reminder: { period_months: value, next_cycle: day(20) },
      }),
  },
  reminder_next_cycle: {
    kind: "date",
    give: (db, id, value) =>
      profile(db, id, {
        donation_reminder: { period_months: 3, next_cycle: value },
      }),
  },
  notify_after_dues_withdrawal: profileFlag("notify_after_dues_withdrawal"),
  default_dues_reminder_withdrawal: profileFlag(
    "default_dues_reminder_withdrawal",
  ),

  tags: {
    kind: "ids",
    values: [101, 102],
    missing: 99,
    give: (db, id, value) =>
      void db.userTags.insert({
        user_id: id,
        tag_id: asNumber(value),
        create_date: noon(day(-3)),
      }),
  },
  notes: {
    kind: "text",
    decoy: (db, id, value) =>
      void note(db, id, { details: value, eventType: 1 }),
    give: (db, id, value) => void note(db, id, { details: value }),
  },
  note_date: {
    kind: "date",
    decoy: (db, id, value) => void note(db, id, { at: value, eventType: 1 }),
    give: (db, id, value) => void note(db, id, { at: value }),
  },
  note_tag: {
    kind: "ids",
    decoy: (db, id, value) =>
      void note(db, id, { tagId: asNumber(value), eventType: 1 }),
    values: [101, 102],
    missing: 99,
    give: (db, id, value) => void note(db, id, { tagId: asNumber(value) }),
  },
  note_count: {
    kind: "total",
    decoy: (db, id, value) =>
      times(value, () => note(db, id, { eventType: 1 })),
    give: (db, id, value) => times(value, () => note(db, id)),
  },
  note_added_by: {
    kind: "ids",
    decoy: (db, id, value) =>
      void note(db, id, { issuerId: asNumber(value), eventType: 1 }),
    values: [1001, 1002],
    missing: 99,
    give: (db, id, value) => void note(db, id, { issuerId: asNumber(value) }),
  },
  history_event_type: {
    kind: "ids",
    values: [7, 1],
    give: (db, id, value) =>
      void note(db, id, { eventType: asNumber(value) === 1 ? 1 : 7 }),
  },
  history_event_date: {
    kind: "date",
    give: (db, id, value) => void note(db, id, { at: value }),
  },
  history_event_note: {
    kind: "text",
    give: (db, id, value) => void note(db, id, { details: value }),
  },
  history_event_active_days: {
    kind: "total",
    give: (db, id, value) =>
      times(value, (index) => note(db, id, { at: day(-1 - index) })),
  },

  donation_amount: {
    kind: "number",
    decoy: (db, id, value) => void donation(db, id, failed({ amount: value })),
    give: (db, id, value) => void donation(db, id, paid({ amount: value })),
  },
  donation_count: {
    kind: "total",
    decoy: (db, id, value) => times(value, () => donation(db, id, failed())),
    give: (db, id, value) => times(value, () => donation(db, id, paid())),
  },
  donation_date: {
    kind: "date",
    decoy: (db, id, value) => void donation(db, id, failed({ at: value })),
    give: (db, id, value) => void donation(db, id, paid({ at: value })),
  },
  first_donation_date: {
    kind: "date",
    decoy: (db, id, value) => void donation(db, id, failed({ at: value })),
    give: (db, id, value) => {
      donation(db, id, paid({ at: value }));
      donation(db, id, paid({ at: day(30) }));
    },
  },
  total_donation_amount: {
    kind: "total",
    decoy: (db, id, value) => void donation(db, id, failed({ amount: value })),
    values: [100, 300],
    give: (db, id, value) => {
      donation(db, id, paid({ amount: value - 50 }));
      donation(db, id, paid({ amount: 50 }));
    },
  },
  fundraising_campaign: PAID.campaign,
  sub_donation_type: PAID.category,
  donation_page: PAID.page,
  donor_type: {
    kind: "ids",
    decoy: (db, id) =>
      void donation(db, id, failed(), { donor_type: "corporate" }),
    values: ["corporate", "personal"],
    give: (db, id, value) =>
      void donation(db, id, paid(), {
        donor_type: value === "corporate" ? "corporate" : "personal",
      }),
  },
  d_type: {
    kind: "ids",
    decoy: (db, id) => void donation(db, id, failed(), { d_type: 1 }),
    values: [1, 0],
    give: (db, id, value) =>
      void donation(db, id, paid(), { d_type: asNumber(value) === 1 ? 1 : 0 }),
  },
  donation_currency: PAID.currency,
  donation_payment_method: {
    kind: "ids",
    decoy: (db, id) => void donation(db, id, failed({ method: 2 })),
    values: [2, 3],
    give: (db, id, value) =>
      void donation(db, id, paid({ method: asNumber(value) === 2 ? 2 : 3 })),
  },
  donation_details: {
    kind: "text",
    decoy: (db, id, value) =>
      void donation(db, id, failed(), { details: value }),
    give: (db, id, value) => void donation(db, id, paid(), { details: value }),
  },
  donation_utm_source: donationUtm("source"),
  donation_utm_medium: donationUtm("medium"),
  donation_utm_campaign: donationUtm("campaign"),
  donation_utm_content: donationUtm("content"),
  f2f_group_id: donationFacet(
    paid,
    (value) => ({ f2f_group_id: asNumber(value) }),
    [61, 62],
    99,
  ),
  fundraising_team: PAID.team,
  fundraising_event: PAID.event,
  fundraising_team_campaign: PAID.teamCampaign,

  failed_donation_amount: {
    kind: "number",
    decoy: (db, id, value) => void donation(db, id, paid({ amount: value })),
    give: (db, id, value) => void donation(db, id, failed({ amount: value })),
  },
  failed_donation_date: {
    kind: "date",
    decoy: (db, id, value) => void donation(db, id, paid({ at: value })),
    give: (db, id, value) => void donation(db, id, failed({ at: value })),
  },
  failed_fundraising_campaign: FAILED.campaign,
  failed_sub_donation_type: FAILED.category,
  failed_donation_page: FAILED.page,
  failed_donation_currency: FAILED.currency,
  failed_fundraising_team: FAILED.team,
  failed_fundraising_event: FAILED.event,
  failed_fundraising_team_campaign: FAILED.teamCampaign,

  added_donation_count: {
    kind: "total",
    decoy: (db, id, value) => times(value, () => donation(db, id, paid())),
    give: (db, id, value) =>
      times(value, () => donation(db, id, paid(), { added_by_id: 1001 })),
  },
  added_donation_amount: {
    kind: "number",
    decoy: (db, id, value) => void donation(db, id, paid({ amount: value })),
    give: (db, id, value) =>
      void donation(db, id, paid({ amount: value }), { added_by_id: 1001 }),
  },
  added_total_donation_amount: {
    kind: "total",
    decoy: (db, id, value) => void donation(db, id, paid({ amount: value })),
    values: [100, 300],
    give: (db, id, value) =>
      void donation(db, id, paid({ amount: value }), { added_by_id: 1002 }),
  },
  added_donation_date: {
    kind: "date",
    decoy: (db, id, value) => void donation(db, id, paid({ at: value })),
    give: (db, id, value) =>
      void donation(db, id, paid({ at: value }), { added_by_id: 1001 }),
  },
  added_monthly_donation_count: {
    kind: "total",
    decoy: (db, id, value) => times(value, () => monthly(db, id, paid())),
    give: (db, id, value) =>
      times(value, () => monthly(db, id, paid(), { added_by_id: 1001 })),
  },
  added_monthly_donation_amount: {
    kind: "number",
    decoy: (db, id, value) => void monthly(db, id, paid({ amount: value })),
    give: (db, id, value) =>
      void monthly(db, id, paid({ amount: value }), { added_by_id: 1001 }),
  },
  added_total_monthly_donation_amount: {
    kind: "total",
    decoy: (db, id, value) => void monthly(db, id, paid({ amount: value })),
    values: [100, 300],
    give: (db, id, value) =>
      void monthly(db, id, paid({ amount: value }), { added_by_id: 1003 }),
  },

  recurring_donor: {
    kind: "flag",
    decoy: (db, id) => void donation(db, id, paid()),
    give: (db, id, value) =>
      void monthly(db, id, paid(), { recurring_status: value ? 1 : 3 }),
  },
  recurring_donation_amount: {
    kind: "number",
    decoy: (db, id, value) => void donation(db, id, paid({ amount: value })),
    give: (db, id, value) => void monthly(db, id, paid({ amount: value })),
  },
  total_recurring_donation_amount: {
    kind: "total",
    decoy: (db, id, value) =>
      void monthly(db, id, paid({ amount: value }), { recurring_status: 3 }),
    values: [100, 300],
    give: (db, id, value) => {
      monthly(db, id, paid({ amount: value }));
      monthly(db, id, paid({ amount: 5000 }), { recurring_status: 3 });
    },
  },
  total_recurring_donation_count: {
    kind: "total",
    decoy: (db, id, value) => times(value, () => donation(db, id, paid())),
    give: (db, id, value) => times(value, () => monthly(db, id, paid())),
  },
  total_recurring_withdrawal_count: {
    kind: "total",
    give: (db, id, value) =>
      void monthly(db, id, paid(), { recurring_withdraw_count: value }),
  },
  total_recurring_withdrawal_amount: {
    kind: "total",
    values: [100, 300],
    give: (db, id, value) =>
      void monthly(db, id, paid(), { recurring_total_withdraw_amount: value }),
  },
  recurring_donation_start_date: {
    kind: "date",
    give: (db, id, value) =>
      void monthly(db, id, paid(), { recurring_start_date: noon(value) }),
  },
  recurring_donation_cancel_date: {
    kind: "date",
    give: (db, id, value) =>
      void monthly(db, id, paid(), {
        recurring_status: 3,
        recurring_cancel_date: value,
      }),
  },
  first_monthly_donation_date: {
    kind: "date",
    give: (db, id, value) => {
      monthly(db, id, paid(), { recurring_start_date: noon(value) });
      monthly(db, id, paid(), { recurring_start_date: noon(day(40)) });
    },
  },
  recurring_limit: {
    kind: "number",
    give: (db, id, value) =>
      void monthly(db, id, paid(), { recurring_limit: value }),
  },
  remaining_recurring_limit: {
    kind: "number",
    give: (db, id, value) =>
      void monthly(db, id, paid(), {
        recurring_limit: value + 2,
        recurring_withdraw_count: 2,
      }),
  },
  recurring_amount_change: {
    kind: "number",
    decoy: (db, id, value) =>
      donationRequest(db, id, { type: 0, value: String(value) }),
    give: (db, id, value) =>
      donationRequest(db, id, { type: 1, value: String(value) }),
  },
  recurring_amount_change_date: {
    kind: "date",
    decoy: (db, id, value) => donationRequest(db, id, { type: 0, at: value }),
    give: (db, id, value) =>
      donationRequest(db, id, { type: 1, value: "300", at: value }),
  },
  cancel_request: {
    kind: "flag",
    give: (db, id, value) =>
      donationRequest(db, id, { type: value ? 0 : 1, value: "200" }),
  },
  cancel_request_date: {
    kind: "date",
    decoy: (db, id, value) =>
      donationRequest(db, id, { type: 1, value: "300", at: value }),
    give: (db, id, value) => donationRequest(db, id, { type: 0, at: value }),
  },

  registered_card: {
    kind: "flag",
    give: (db, id, value) => {
      if (value) cardInfo(db, id);
    },
  },
  card_count: {
    kind: "total",
    give: (db, id, value) => times(value, () => cardInfo(db, id)),
  },
  card_add_date: {
    kind: "date",
    give: (db, id, value) =>
      void donation(db, id, paid({ at: value }), {
        card_info_id: cardInfo(db, id),
      }),
  },
  card_expiry: {
    kind: "explicit",
    where: "people-search.test.ts card expiry",
  },
  card_type: {
    kind: "ids",
    values: ["visa", "mastercard"],
    give: (db, id, value) =>
      void cardInfo(db, id, value === "visa" ? "454360" : "540667"),
  },

  subscription_payment_date: {
    kind: "date",
    decoy: (db, id, value) =>
      void duesPayment(db, id, { at: value, status: 5 }),
    give: (db, id, value) => void duesPayment(db, id, { at: value }),
  },
  subscription_payment_amount: {
    kind: "number",
    decoy: (db, id, value) => void dues(db, id, { status: 1, amount: value }),
    give: (db, id, value) => void duesPayment(db, id, { amount: value }),
  },
  subscription_payment_method: {
    kind: "ids",
    decoy: (db, id) => void duesPayment(db, id, { method: 0, status: 5 }),
    values: [0, 2],
    give: (db, id, value) =>
      void duesPayment(db, id, { method: asNumber(value) === 0 ? 0 : 2 }),
  },
  recurring_debt: {
    kind: "flag",
    decoy: (db, id) =>
      void duesPayment(db, id, { status: 5 }, { recurring: true }),
    give: (db, id, value) => void duesPayment(db, id, {}, { recurring: value }),
  },
  automatic_dues_withdrawal: {
    kind: "flag",
    give: (db, id, value) =>
      void duesPayment(db, id, {}, { recurring_withdrawal: value }),
  },
  card_for_dues: {
    kind: "flag",
    give: (db, id, value) =>
      void duesPayment(
        db,
        id,
        { method: value ? 0 : 2 },
        { recurring_withdrawal: true },
      ),
  },
  dues_card_add_date: {
    kind: "date",
    give: (db, id, value) =>
      void duesPayment(
        db,
        id,
        { method: 0, at: value },
        { recurring_withdrawal: true },
      ),
  },
  card_type_for_dues: {
    kind: "ids",
    values: ["visa", "mastercard"],
    give: (db, id, value) =>
      void duesPayment(
        db,
        id,
        { method: 0, bin: value === "visa" ? "402277" : "540667" },
        { recurring_withdrawal: true },
      ),
  },
  debt_record: {
    kind: "flag",
    give: (db, id, value) =>
      void (value ? dues(db, id, { status: 1 }) : duesPayment(db, id)),
  },
  unpaid_debt_record: {
    kind: "flag",
    give: (db, id, value) => void dues(db, id, { status: value ? 1 : 8 }),
  },
  paid_debt_record: {
    kind: "flag",
    give: (db, id, value) => void dues(db, id, { status: value ? 8 : 1 }),
  },
  debt_category: {
    kind: "ids",
    decoy: (db, id, value) =>
      void dues(db, id, { status: 6, debt_category_id: asNumber(value) }),
    values: [501, 502],
    missing: 99,
    give: (db, id, value) =>
      void dues(db, id, { status: 8, debt_category_id: asNumber(value) }),
  },
  unpaid_debt_category: {
    kind: "ids",
    decoy: (db, id, value) =>
      void dues(db, id, { status: 8, debt_category_id: asNumber(value) }),
    values: [501, 502],
    missing: 99,
    give: (db, id, value) =>
      void dues(db, id, { status: 1, debt_category_id: asNumber(value) }),
  },
  paid_debt_category: {
    kind: "ids",
    decoy: (db, id, value) =>
      void dues(db, id, { status: 1, debt_category_id: asNumber(value) }),
    values: [501, 502],
    missing: 99,
    give: (db, id, value) =>
      void dues(db, id, { status: 8, debt_category_id: asNumber(value) }),
  },
  unpaid_debt_count: {
    kind: "total",
    decoy: (db, id, value) => times(value, () => dues(db, id, { status: 8 })),
    give: (db, id, value) => times(value, () => dues(db, id, { status: 1 })),
  },
  debt_amount: {
    kind: "number",
    decoy: (db, id, value) => void duesPayment(db, id, { amount: value }),
    give: (db, id, value) => void dues(db, id, { status: 1, amount: value }),
  },
  total_debt_amount: {
    kind: "total",
    decoy: (db, id, value) => void dues(db, id, { status: 8, amount: value }),
    values: [100, 300],
    give: (db, id, value) => {
      dues(db, id, { status: 1, amount: value });
      dues(db, id, { status: 8, amount: 900 });
    },
  },
  membership_due_details: {
    kind: "text",
    give: (db, id, value) => void dues(db, id, { details: value }),
  },
  active_membership_duration: {
    kind: "total",
    give: (db, id, value) =>
      times(
        value,
        (index) =>
          void duesPayment(db, id, {}, { period: `${2026 - index}-01-01` }),
      ),
  },

  registered_event: {
    kind: "ids",
    decoy: (db, id, value) =>
      ticketSale(db, id, { eventId: asNumber(value), payment: { status: 5 } }),
    values: [601, 602],
    missing: 99,
    give: (db, id, value) => ticketSale(db, id, { eventId: asNumber(value) }),
  },
  registered_event_count: {
    kind: "total",
    decoy: (db, id, value) =>
      times(value, (index) =>
        ticketSale(db, id, { eventId: 601 + index, payment: { status: 5 } }),
      ),
    give: (db, id, value) =>
      times(value, (index) => ticketSale(db, id, { eventId: 601 + index })),
  },
  event_register_date: {
    kind: "date",
    decoy: (db, id, value) =>
      ticketSale(db, id, { payment: { at: value, status: 5 } }),
    give: (db, id, value) => ticketSale(db, id, { payment: { at: value } }),
  },
  bought_ticket_type: {
    kind: "ids",
    decoy: (db, id, value) =>
      ticketSale(db, id, {
        eventId: 601,
        ticketId: asNumber(value),
        payment: { status: 5 },
      }),
    values: [6101, 6102],
    missing: 99,
    give: (db, id, value) =>
      ticketSale(db, id, { eventId: 601, ticketId: asNumber(value) }),
  },
  ticket_payment_method: {
    kind: "ids",
    decoy: (db, id) =>
      ticketSale(db, id, { payment: { method: 0, status: 5 } }),
    values: [0, 1],
    give: (db, id, value) =>
      ticketSale(db, id, {
        payment: { method: asNumber(value) === 0 ? 0 : 1 },
      }),
  },

  custom_form: {
    kind: "ids",
    values: [701, 702],
    missing: 99,
    give: (db, id, value) => formAnswer(db, id, { formId: asNumber(value) }),
  },
  form_complete_date: {
    kind: "date",
    give: (db, id, value) => formAnswer(db, id, { at: value }),
  },

  bought_certificate: {
    kind: "flag",
    give: (db, id, value) => ecardSale(db, id, {}, { status: value ? 3 : 5 }),
  },
  certificate: {
    kind: "ids",
    decoy: (db, id, value) =>
      ecardSale(db, id, { certificate_id: asNumber(value) }, { status: 5 }),
    values: [951, 952],
    missing: 99,
    give: (db, id, value) =>
      ecardSale(db, id, { certificate_id: asNumber(value) }),
  },
  certificate_count: {
    kind: "total",
    decoy: (db, id, value) =>
      times(value, () => ecardSale(db, id, {}, { status: 5 })),
    give: (db, id, value) => times(value, () => ecardSale(db, id)),
  },
  certificate_date: {
    kind: "date",
    decoy: (db, id, value) => ecardSale(db, id, {}, { at: value, status: 5 }),
    give: (db, id, value) => ecardSale(db, id, {}, { at: value }),
  },
  certificate_currency: {
    kind: "ids",
    decoy: (db, id, value) =>
      ecardSale(db, id, {}, { currencyId: asNumber(value), status: 5 }),
    values: [2, 3],
    missing: 99,
    give: (db, id, value) =>
      ecardSale(db, id, {}, { currencyId: asNumber(value) }),
  },
  ecard_payment_method: {
    kind: "ids",
    decoy: (db, id) => ecardSale(db, id, {}, { method: 0, status: 5 }),
    values: [0, 2],
    give: (db, id, value) =>
      ecardSale(db, id, {}, { method: asNumber(value) === 0 ? 0 : 2 }),
  },
  ecard_amount: {
    kind: "number",
    decoy: (db, id, value) =>
      ecardSale(db, id, {}, { amount: value, status: 5 }),
    give: (db, id, value) => ecardSale(db, id, {}, { amount: value }),
  },
  total_ecard_sum: {
    kind: "total",
    decoy: (db, id, value) =>
      ecardSale(db, id, {}, { amount: value, status: 5 }),
    values: [100, 300],
    give: (db, id, value) => ecardSale(db, id, {}, { amount: value }),
  },
  ecard_category: {
    kind: "ids",
    decoy: (db, id) =>
      ecardSale(db, id, { certificate_id: 951 }, { status: 5 }),
    values: [901, 902],
    missing: 99,
    give: (db, id, value) =>
      ecardSale(db, id, {
        certificate_id: asNumber(value) === 901 ? 951 : 952,
      }),
  },
  ecard_delivery_date: {
    kind: "date",
    decoy: (db, id, value) =>
      ecardSale(db, id, { delivery_date: value }, { status: 5 }),
    give: (db, id, value) => ecardSale(db, id, { delivery_date: value }),
  },
  ecard_recipient_count: {
    kind: "number",
    decoy: (db, id, value) =>
      ecardSale(db, id, { recipient_count: value }, { status: 5 }),
    give: (db, id, value) => ecardSale(db, id, { recipient_count: value }),
  },
  total_ecard_recipient_count: {
    kind: "total",
    decoy: (db, id, value) =>
      ecardSale(db, id, { recipient_count: value }, { status: 5 }),
    give: (db, id, value) => ecardSale(db, id, { recipient_count: value }),
  },
  ecard_has_cargo: {
    kind: "flag",
    decoy: (db, id) => ecardSale(db, id, { has_cargo: true }, { status: 5 }),
    give: (db, id, value) => ecardSale(db, id, { has_cargo: value }),
  },
  ecard_utm_source: ecardUtm("source"),
  ecard_utm_medium: ecardUtm("medium"),
  ecard_utm_campaign: ecardUtm("campaign"),
  ecard_utm_content: ecardUtm("content"),

  fundraising_campaign_count: {
    kind: "total",
    decoy: (db, id, value) =>
      times(value, () => campaign(db, id, { status: 4 })),
    give: (db, id, value) => times(value, () => campaign(db, id)),
  },
  fundraising_campaign_start_date: {
    kind: "date",
    decoy: (db, id, value) =>
      void campaign(db, id, { status: 4, activation_date: noon(value) }),
    give: (db, id, value) =>
      void campaign(db, id, { activation_date: noon(value) }),
  },
  fundraising_campaign_end_date: {
    kind: "date",
    decoy: (db, id, value) =>
      void campaign(db, id, { status: 4, finish_date: noon(value) }),
    give: (db, id, value) =>
      void campaign(db, id, { status: 3, finish_date: noon(value) }),
  },
  fundraising_campaign_donation_total: {
    kind: "number",
    decoy: (db, id, value) => {
      donation(db, id, failed({ amount: value }), {
        fundraising_campaign_id: campaign(db, id, { status: 4 }).id,
      });
    },
    values: [100, 300],
    give: (db, id, value) => {
      const own = campaign(db, id);
      donation(db, id, paid({ amount: value }), {
        fundraising_campaign_id: own.id,
      });
    },
  },
  fundraising_campaign_donation_count: {
    kind: "number",
    decoy: (db, id, value) => {
      const own = campaign(db, id, { status: 4 });
      times(value, () =>
        donation(db, id, paid(), { fundraising_campaign_id: own.id }),
      );
    },
    values: [1, 3],
    give: (db, id, value) => {
      const own = campaign(db, id);
      times(value, () =>
        donation(db, id, paid(), { fundraising_campaign_id: own.id }),
      );
    },
  },
  fundraising_campaign_total_donation_total: {
    kind: "total",
    decoy: (db, id, value) => {
      const own = campaign(db, id);
      donation(db, id, failed({ amount: value }), {
        fundraising_campaign_id: own.id,
      });
    },
    values: [100, 300],
    give: (db, id, value) => {
      for (const amount of [value - 40, 40]) {
        const own = campaign(db, id);
        donation(db, id, paid({ amount }), { fundraising_campaign_id: own.id });
      }
    },
  },
  fundraising_campaign_total_donation_count: {
    kind: "total",
    decoy: (db, id, value) => {
      const own = campaign(db, id);
      times(value, () =>
        donation(db, id, failed(), { fundraising_campaign_id: own.id }),
      );
    },
    give: (db, id, value) => {
      const own = campaign(db, id);
      times(value, () =>
        donation(db, id, paid(), { fundraising_campaign_id: own.id }),
      );
    },
  },
  fundraising_campaign_status: ownedCampaign(
    (value) => ({ status: asNumber(value) === 1 ? 1 : 3 }),
    [1, 3],
    undefined,
    true,
  ),
  fundraising_campaign_target: {
    kind: "number",
    decoy: (db, id, value) =>
      void campaign(db, id, { status: 4, has_target: true, target: value }),
    give: (db, id, value) =>
      void campaign(db, id, { has_target: true, target: value }),
  },
  fundraising_campaign_donation_type: ownedCampaign(
    (value) => ({ sub_donation_type_id: asNumber(value) }),
    [201, 202],
    99,
  ),
  fundraising_campaign_target_event: ownedCampaign(
    (value) => ({ association_campaign_target_id: asNumber(value) }),
    [851, 852],
    99,
  ),
  fundraising_campaign_event_date: {
    kind: "date",
    decoy: (db, id, value) =>
      void campaign(db, id, { status: 4, event_date: value }),
    give: (db, id, value) => void campaign(db, id, { event_date: value }),
  },
  fundraising_team_member: ownedCampaign(
    (value) => ({ team_id: asNumber(value) }),
    [871, 872],
    99,
  ),
  fundraising_team_campaign_member: ownedCampaign(
    (value) => ({ team_campaign_id: asNumber(value) }),
    [8701, 8703],
    99,
  ),

  saved_iban: {
    kind: "flag",
    decoy: (db, id) => bankTransfer(db, id, { status: 8 }),
    give: (db, id, value) => {
      if (value) bankTransfer(db, id);
    },
  },
  saved_iban_number: {
    kind: "text",
    decoy: (db, id, value) => bankTransfer(db, id, { iban: value, status: 8 }),
    give: (db, id, value) => bankTransfer(db, id, { iban: value }),
  },
  saved_iban_bank: {
    kind: "text",
    decoy: (db, id, value) => bankTransfer(db, id, { bank: value, status: 8 }),
    give: (db, id, value) => bankTransfer(db, id, { bank: value }),
  },
  saved_iban_sender_name: {
    kind: "text",
    decoy: (db, id, value) =>
      bankTransfer(db, id, { sender: value, status: 8 }),
    give: (db, id, value) => bankTransfer(db, id, { sender: value }),
  },
  saved_iban_assignment_type: {
    kind: "ids",
    decoy: (db, id) => bankTransfer(db, id, { type: 1, status: 8 }),
    values: [1, 2],
    give: (db, id, value) =>
      bankTransfer(db, id, { type: asNumber(value) === 1 ? 1 : 2 }),
  },
  saved_iban_count: {
    kind: "total",
    decoy: (db, id, value) =>
      times(value, (index) =>
        bankTransfer(db, id, { iban: `TR99${id}${index}`, status: 8 }),
      ),
    give: (db, id, value) =>
      times(value, (index) =>
        bankTransfer(db, id, { iban: `TR00${id}${index}` }),
      ),
  },
  saved_iban_add_date: {
    kind: "date",
    decoy: (db, id, value) => bankTransfer(db, id, { at: value, status: 8 }),
    give: (db, id, value) => {
      bankTransfer(db, id, { at: value });
      bankTransfer(db, id, { at: day(30) });
    },
  },
  saved_iban_donation_category: savedIbanFacet(
    (value) => ({ sub_donation_type_id: asNumber(value) }),
    [201, 202],
  ),
  saved_iban_donation_page: savedIbanFacet(
    (value) => ({ fundraising_page_id: asNumber(value) }),
    [31, 32],
  ),
  saved_iban_fundraising_campaign: savedIbanFacet(
    (value) => ({ fundraising_campaign_id: asNumber(value) }),
    [801, 802],
  ),
  saved_iban_donation_form: savedIbanFacet(
    (value) => ({ module_id: asNumber(value) }),
    [41, 42],
  ),

  is_related_contact: {
    kind: "flag",
    decoy: (db, id) => relation(db, id, person(db, `ters-${id}`)),
    give: (db, id, value) => {
      if (value) relation(db, person(db, `sahip-${id}`), id);
    },
  },
  has_related_contact: {
    kind: "flag",
    decoy: (db, id) => relation(db, person(db, `ters-${id}`), id),
    give: (db, id, value) => {
      if (value) freshRelated(db, id);
    },
  },
  related_contact_dues_perm: {
    kind: "flag",
    give: (db, id, value) =>
      relation(db, id, person(db, `yakın-${id}`), { dues: value }),
  },
  related_contact_comm_perm: {
    kind: "flag",
    give: (db, id, value) =>
      relation(db, id, person(db, `yakın-${id}`), { comm: value }),
  },
  related_contact_tag: {
    kind: "ids",
    decoy: (db, id, value) =>
      void db.userTags.insert({
        user_id: id,
        tag_id: asNumber(value),
        create_date: noon(day(-2)),
      }),
    values: [101, 102],
    missing: 99,
    give: (db, id, value) =>
      void db.userTags.insert({
        user_id: freshRelated(db, id),
        tag_id: asNumber(value),
        create_date: noon(day(-2)),
      }),
  },
  related_contact_note: {
    kind: "text",
    decoy: (db, id, value) => void note(db, id, { details: value }),
    give: (db, id, value) =>
      void note(db, freshRelated(db, id), { details: value }),
  },
  related_contact_of: {
    kind: "ids",
    decoy: (db, id, value) => relation(db, id, asNumber(value)),
    values: [1004, 1005],
    missing: 99,
    give: (db, id, value) => relation(db, asNumber(value), id),
  },
};

function isParameter(key: string): key is Parameter {
  return Object.hasOwn(SPECS, key);
}

const DATE_LABELS = ["P", "Q", "T", "F", "N"] as const;
const DATE_OFFSETS = { P: -40, Q: -10, T: 0, F: 5 } as const;
const BIRTH_YEARS = { P: 1980, Q: 1990, T: 1975, F: 2001 } as const;

function textCases([a, b, needle]: readonly [string, string, string]): Case[] {
  return [
    { condition: "eq", value: a.toLocaleLowerCase("tr-TR"), expect: ["A"] },
    { condition: "eq", value: b.toLocaleUpperCase("tr-TR"), expect: ["B"] },
    { condition: "neq", value: b, expect: ["A", "C"] },
    { condition: "contains", value: needle, expect: ["A"] },
    { condition: "exclude", value: needle, expect: ["B", "C"] },
    { condition: "exist", expect: ["A", "B"] },
    { condition: "isnull", expect: ["C"] },
  ];
}

function numberCases(
  [a, b]: readonly [number, number],
  zeroIsNone: boolean,
): Case[] {
  const mid = (a + b) / 2;
  const below = zeroIsNone ? ["A", "C"] : ["A"];
  return [
    { condition: "eq", value: a, expect: ["A"] },
    { condition: "eq", value: String(b), expect: ["B"] },
    { condition: "neq", value: a, expect: ["B", "C"] },
    { condition: "lt", value: mid, expect: below },
    { condition: "lte", value: a, expect: below },
    { condition: "gt", value: mid, expect: ["B"] },
    { condition: "gte", value: b, expect: ["B"] },
    { condition: "()", value: { start: a, end: mid }, expect: ["A"] },
    { condition: "exist", expect: ["A", "B"] },
    { condition: "isnull", expect: ["C"] },
  ];
}

function dateCases(format: (label: "P" | "Q" | "T" | "F") => string): Case[] {
  const q = format("Q");
  const t = format("T");
  return [
    { condition: "eq", value: q, expect: ["Q"] },
    { condition: "eq", value: `${q}T23:30:00+03:00`, expect: ["Q"] },
    { condition: "neq", value: q, expect: ["P", "T", "F", "N"] },
    { condition: "lt", value: q, expect: ["P"] },
    { condition: "lte", value: q, expect: ["P", "Q"] },
    { condition: "gt", value: t, expect: ["F"] },
    { condition: "gte", value: t, expect: ["T", "F"] },
    { condition: "!lt", value: q, expect: ["Q", "T", "F", "N"] },
    { condition: "!gt", value: q, expect: ["P", "Q", "N"] },
    {
      condition: "()",
      value: { start: format("Q").replace(/-\d\d$/, "-15"), end: t },
      expect: ["Q", "T"],
    },
    { condition: "=", value: 10, expect: ["Q"] },
    { condition: "+=", value: 5, expect: ["F"] },
    { condition: "<", value: 20, expect: ["Q", "T"] },
    { condition: ">", value: 20, expect: ["P"] },
    { condition: ".", expect: ["T"] },
    { condition: "exist", expect: ["P", "Q", "T", "F"] },
    { condition: "isnull", expect: ["N"] },
  ];
}

const FLAG_CASES: readonly Case[] = [
  { condition: "eq", value: "true", expect: ["A"] },
  { condition: "eq", value: 1, expect: ["A"] },
  { condition: "eq", value: "false", expect: ["B", "C"] },
  { condition: "neq", value: "true", expect: ["B", "C"] },
  { condition: "exist", expect: ["A"] },
  { condition: "isnull", expect: ["B", "C"] },
];

function idCases([x, y]: readonly [Id, Id]): Case[] {
  return [
    { condition: "eq", value: x, expect: ["A"] },
    { condition: "eq", value: String(y), expect: ["B"] },
    { condition: "neq", value: x, expect: ["B", "C"] },
    { condition: "exclude", value: x, expect: ["B", "C"] },
    { condition: "contains", value: `${x};${y}`, expect: ["A", "B"] },
    { condition: "exist", expect: ["A", "B"] },
    { condition: "isnull", expect: ["C"] },
  ];
}

interface Plan {
  readonly people: readonly (readonly [
    string,
    ((db: OrgStore, id: number) => void) | null,
  ])[];
  readonly cases: readonly Case[];
  readonly missing?: Id;
}

function decoyed<V>(
  decoy: Give<V> | undefined,
  value: V,
): ((db: OrgStore, id: number) => void) | null {
  return decoy ? (db, id) => decoy(db, id, value) : null;
}

function plan(spec: Exclude<Spec, { kind: "explicit" }>): Plan {
  switch (spec.kind) {
    case "text": {
      const values = spec.values ?? ["Alfa Kara", "İzmir Beta", "kara"];
      return {
        people: [
          ["A", (db, id) => spec.give(db, id, values[0])],
          ["B", (db, id) => spec.give(db, id, values[1])],
          ["C", decoyed(spec.decoy, values[0])],
        ],
        cases: textCases(values),
      };
    }
    case "number":
    case "total": {
      const values = spec.values ?? (spec.kind === "total" ? [1, 3] : [10, 20]);
      return {
        people: [
          ["A", (db, id) => spec.give(db, id, values[0])],
          ["B", (db, id) => spec.give(db, id, values[1])],
          ["C", decoyed(spec.decoy, values[0])],
        ],
        cases: numberCases(values, spec.kind === "total"),
      };
    }
    case "date":
      return {
        people: DATE_LABELS.map((label) => [
          label,
          label === "N"
            ? decoyed(spec.decoy, day(DATE_OFFSETS.Q))
            : (db, id) => spec.give(db, id, day(DATE_OFFSETS[label])),
        ]),
        cases: dateCases((label) => day(DATE_OFFSETS[label])),
      };
    case "anniversary":
      return {
        people: DATE_LABELS.map((label) => [
          label,
          label === "N"
            ? null
            : (db, id) =>
                spec.give(
                  db,
                  id,
                  `${BIRTH_YEARS[label]}${day(DATE_OFFSETS[label]).slice(4)}`,
                ),
        ]),
        cases: dateCases((label) => `2000${day(DATE_OFFSETS[label]).slice(4)}`),
      };
    case "flag":
      return {
        people: [
          ["A", (db, id) => spec.give(db, id, true)],
          ["B", (db, id) => spec.give(db, id, false)],
          ["C", decoyed(spec.decoy, true)],
        ],
        cases: FLAG_CASES,
      };
    case "ids":
      return {
        people: [
          ["A", (db, id) => spec.give(db, id, spec.values[0])],
          ["B", (db, id) => spec.give(db, id, spec.values[1])],
          ["C", decoyed(spec.decoy, spec.values[0])],
        ],
        cases: idCases(spec.values),
        ...(spec.missing === undefined ? {} : { missing: spec.missing }),
      };
  }
}

describe("every documented user search parameter", () => {
  const shared = client();
  const db = kelder(shared);
  for (const parameter of Object.keys(SPECS).filter(isParameter)) {
    const spec = SPECS[parameter];
    if (spec.kind === "explicit") {
      test(`${parameter} is covered by ${spec.where}`, () => {
        expect(spec.where).not.toBe("");
      });
      continue;
    }
    test(`${parameter} (${spec.kind}) includes matching users and excludes the rest under every condition it takes`, async () => {
      const steps = plan(spec);
      const ids = new Map<string, number>();
      for (const [label, give] of steps.people) {
        const id = person(db, `${parameter}-${label}`);
        ids.set(label, id);
        give?.(db, id);
      }
      const scope = [...ids.values()];
      for (const step of steps.cases) {
        const found = await matchingIds(
          shared,
          within(scope, leaf(parameter, step.condition, step.value)),
        );
        expect(
          found,
          `${parameter} ${step.condition} ${JSON.stringify(step.value)}`,
        ).toEqual(step.expect.map((label) => ids.get(label) ?? 0));
      }
      if (steps.missing !== undefined) {
        await expectStatus(
          shared,
          within(scope, leaf(parameter, "eq", steps.missing)),
          404,
        );
      }
    });
  }
});
