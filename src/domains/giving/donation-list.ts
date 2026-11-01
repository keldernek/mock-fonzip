import { notFound } from "../../api/errors";
import type { HandlerResult } from "../../api/handler";
import {
  inDateRange,
  inList,
  matchesAmount,
  matchesQuery,
  paginate,
  parseDateRange,
} from "../../api/listing";
import type { operations } from "../../generated/openapi";
import type { OrgCollection } from "../../store/collection";
import type {
  DonationRecord,
  MarketingChannelRecord,
} from "../../store/records";
import type { OrgStore } from "../../store/store";
import {
  donationResult,
  lookup,
  viewOf,
  type DonationResult,
  type DonationView,
} from "./rows";

type DonationListQuery = operations["getDonationList"]["parameters"]["query"];
type ListValue = NonNullable<DonationListQuery["list"]>[number];
type OrderBy = NonNullable<DonationListQuery["order_by"]>;
type Field = keyof DonationResult;

const PAYMENT_STATUS_BY_LIST = { paid: 3, refund: 4, failed: 5 } as const;

const BASE_FIELDS: readonly Field[] = [
  "id",
  "user_id",
  "recurring_status",
  "transaction__payment_status",
  "transaction__fonzip_framework",
  "d_type",
  "email",
  "user__email",
  "user__first_name",
  "user__last_name",
  "updated_by_id",
  "last_update_date",
];

const STATUS_FIELDS: {
  readonly [K in DonationListQuery["status"]]: readonly Field[];
} = {
  paid: [],
  refund: ["transaction__refund_date", "transaction__refunded_by_id"],
  failed: [
    "transaction__transaction_error__code",
    "transaction__transaction_error__text",
    "transaction__transaction_error__group",
  ],
};

const DEFAULT_LIST: readonly ListValue[] = [
  "name_surname",
  "amount",
  "sub_donation_type",
  "complete_date",
  "payment_method",
  "email_status",
];

const LIST_FIELDS: { readonly [K in ListValue]: readonly Field[] } = {
  details: ["details"],
  name_surname: ["name"],
  address: ["address", "city", "district"],
  amount: [
    "transaction__amount",
    "transaction__currency__display",
    "transaction__currency__iso_code",
  ],
  sub_donation_type: ["sub_donation_type_id", "sub_donation_type__name"],
  birthday: ["birthday"],
  email_status: [
    "sent_mail_id",
    "sent_mail__message_id",
    "sent_mail__status",
    "sent_mail_to_referring_id",
    "sent_mail_to_referring__message_id",
    "sent_mail_to_referring__status",
  ],
  complete_date: ["transaction__complete_date"],
  fundraising_campaign: [
    "fundraising_campaign_id",
    "fundraising_campaign__title",
  ],
  tckno: ["tckno"],
  tax_department: [],
  phone: ["phone"],
  donation_page: ["fundraising_page_id", "fundraising_page__title"],
  module: ["module_id", "module__title"],
  payment_method: ["transaction__payment_method"],
  added_by_id: ["added_by_id", "added_by__name"],
  f2f_group_id: ["f2f_group_id", "f2f_group__title"],
  fonzip_id: ["transaction__fonzip_id"],
  recurring_order_id: ["recurring_order_id"],
  recurring_withdraw_count: ["recurring_withdraw_count"],
  recurring_total_withdraw_count: ["recurring_total_withdraw_count"],
  recurring_total_withdraw_amount: ["recurring_total_withdraw_amount"],
  transaction_id: ["transaction__transaction_id"],
  provision_no: ["transaction__provision_no"],
  auth_code: ["transaction__auth_code"],
  reference_id: ["transaction__reference_id"],
  ip_address: ["transaction__ip_address"],
  fundraising_campaign_user: [
    "fundraising_campaign__user_id",
    "fundraising_campaign__user__title",
  ],
  api_tracking_id: ["api_tracking_id"],
  news_via_phone: ["news_via_phone"],
  news_via_sms: ["news_via_sms"],
  news_via_email: ["news_via_email"],
  application: ["application_id", "application__title"],
  card_number: ["transaction__bin_number"],
  receipt_no: ["transaction__receipt_no"],
  donor_type: ["donor_type"],
  amount_visible: ["amount_visible"],
  name_hidden: ["name_hidden"],
  message: ["message"],
  show_message: ["show_message"],
  referring_name: ["referring_name"],
  referring_email: ["referring_email"],
  referring_phone: ["referring_phone"],
  bank_account__name: ["transaction__bank_account__name"],
  payment_settings__name: ["transaction__payment_settings__name"],
  recurring_cancel_reason: ["recurring_cancel_reason"],
  recurring_cancel_date: ["recurring_cancel_date"],
  recurring_start_date: ["recurring_start_date"],
  recurring_stop_date: [],
  cancelled_by_id: ["cancelled_by_id", "cancelled_by__name"],
  marketing_channel__utm_source: ["marketing_channel__utm_source"],
  marketing_channel__utm_medium: ["marketing_channel__utm_medium"],
  marketing_channel__utm_campaign: ["marketing_channel__utm_campaign"],
  marketing_channel__utm_content: ["marketing_channel__utm_content"],
};

type Compare = (a: DonationView, b: DonationView) => number;

const byName: Compare = (a, b) =>
  a.donation.name.localeCompare(b.donation.name, "tr", {
    sensitivity: "base",
  });
const byAmount: Compare = (a, b) => a.transaction.amount - b.transaction.amount;
const byCompleteDate: Compare = (a, b) =>
  Date.parse(a.transaction.complete_date) -
  Date.parse(b.transaction.complete_date);

const ORDERINGS: { readonly [K in OrderBy]: readonly [Compare, 1 | -1] } = {
  name: [byName, 1],
  "-name": [byName, -1],
  transaction__amount: [byAmount, 1],
  "-transaction__amount": [byAmount, -1],
  transaction__complete_date: [byCompleteDate, 1],
  "-transaction__complete_date": [byCompleteDate, -1],
};

function ordering(orderBy: OrderBy): Compare {
  const [compare, direction] = ORDERINGS[orderBy];
  return (a, b) => direction * compare(a, b) || a.donation.id - b.donation.id;
}

function copyField<K extends Field>(
  to: DonationResult,
  from: DonationResult,
  field: K,
): void {
  if (from[field] !== undefined) to[field] = from[field];
}

function project(
  row: DonationResult,
  fields: ReadonlySet<Field>,
): DonationResult {
  const projected: DonationResult = {};
  for (const field of fields) copyField(projected, row, field);
  return projected;
}

function listedFields(
  status: DonationListQuery["status"],
  list: readonly ListValue[] | undefined,
): ReadonlySet<Field> {
  return new Set([
    ...BASE_FIELDS,
    ...STATUS_FIELDS[status],
    ...(list ?? DEFAULT_LIST).flatMap((value) => LIST_FIELDS[value]),
  ]);
}

function missingReference(
  store: OrgStore,
  query: DonationListQuery,
): string | undefined {
  const references: readonly (readonly [
    number | undefined,
    (id: number) => unknown,
    string,
  ])[] = [
    [
      query.category_id,
      (id) => store.donationCategories.get(id),
      "Donation category",
    ],
    [query.donation_page, (id) => store.donationPages.get(id), "Donation page"],
    [
      query.fundraising_campaign,
      (id) => store.fundraisingCampaigns.get(id),
      "Fundraising campaign",
    ],
    [
      query.association_campaign_target,
      (id) => store.fundraisingEvents.get(id),
      "Fundraising event",
    ],
    [
      query.payment_settings_id,
      (id) => store.paymentSettings.get(id),
      "Payment settings",
    ],
    [query.bank_account_id, (id) => store.bankAccounts.get(id), "Bank account"],
  ];
  return references.find(
    ([id, find]) => id !== undefined && find(id) === undefined,
  )?.[2];
}

function matchesCategory(
  donation: DonationRecord,
  query: DonationListQuery,
): boolean {
  if (query.category_id !== undefined) {
    return donation.sub_donation_type_id === query.category_id;
  }
  return query.no_category !== true || donation.sub_donation_type_id === null;
}

function matchesChannel(
  channel: MarketingChannelRecord | undefined,
  query: DonationListQuery,
): boolean {
  if (query.marketing_channel_null === true) return channel === undefined;
  return (
    inList(channel?.utm_source, query.utm_source) &&
    inList(channel?.utm_medium, query.utm_medium) &&
    inList(channel?.utm_campaign, query.utm_campaign) &&
    inList(channel?.utm_content, query.utm_content)
  );
}

function matchesRecurring(
  donation: DonationRecord,
  recurring: DonationListQuery["recurring"],
): boolean {
  const isRecurring = donation.recurring_order_id !== null;
  if (recurring === 1) return isRecurring;
  if (recurring === 0) return !isRecurring;
  return true;
}

function sameNumber(
  stored: string | null,
  wanted: number | undefined,
): boolean {
  return wanted === undefined || (stored !== null && Number(stored) === wanted);
}

function equalsIfGiven<T>(value: T, wanted: T | undefined): boolean {
  return wanted === undefined || value === wanted;
}

export function listDonations(
  store: OrgStore,
  source: OrgCollection<DonationRecord>,
  query: DonationListQuery,
): HandlerResult<"getDonationList"> {
  const range = parseDateRange(query.start_date, query.end_date);
  if ("error" in range) return { status: 400, body: { error: range.error } };
  const missing = missingReference(store, query);
  if (missing !== undefined) return notFound(missing);
  const paymentStatus = PAYMENT_STATUS_BY_LIST[query.status];
  const matching = source
    .list()
    .map((donation) => viewOf(store, donation))
    .filter(({ donation, transaction }) => {
      const campaign = lookup(
        store.fundraisingCampaigns,
        donation.fundraising_campaign_id,
      );
      const channel = lookup(
        store.marketingChannels,
        donation.marketing_channel_id,
      );
      return (
        transaction.payment_status === paymentStatus &&
        inDateRange(transaction.complete_date, range) &&
        matchesCategory(donation, query) &&
        equalsIfGiven(donation.fundraising_page_id, query.donation_page) &&
        equalsIfGiven(
          donation.fundraising_campaign_id,
          query.fundraising_campaign,
        ) &&
        equalsIfGiven(
          campaign?.association_campaign_target_id,
          query.association_campaign_target,
        ) &&
        equalsIfGiven(
          transaction.payment_settings_id,
          query.payment_settings_id,
        ) &&
        equalsIfGiven(transaction.bank_account_id, query.bank_account_id) &&
        matchesChannel(channel, query) &&
        equalsIfGiven(donation.api_tracking_id, query.api_tracking_id) &&
        matchesRecurring(donation, query.recurring) &&
        (query.donor_type === undefined ||
          query.donor_type === null ||
          donation.donor_type === query.donor_type) &&
        matchesAmount(transaction.amount, query.amount, query.amt_cnd) &&
        equalsIfGiven(transaction.payment_method, query.payment_method) &&
        sameNumber(transaction.bin_number, query.bin_number) &&
        sameNumber(transaction.last_four, query.last_four) &&
        matchesQuery(query.query, [
          donation.name,
          donation.email,
          donation.phone,
          donation.tckno,
        ])
      );
    })
    .sort(ordering(query.order_by ?? "-transaction__complete_date"));
  const fields = listedFields(query.status, query.list);
  return {
    status: 200,
    body: {
      donation_list: paginate(matching, query).map((view) =>
        project(donationResult(store, view), fields),
      ),
      total: matching.length,
    },
  };
}
