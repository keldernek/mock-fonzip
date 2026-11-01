import { expect } from "bun:test";

import type { components } from "../src/generated/openapi";
import type { Row } from "../src/store/collection";
import type {
  CommunicationPermissionRecord,
  ContactProfileRecord,
  DonationRecord,
  EcardTransactionRecord,
  FundraisingCampaignRecord,
  SubscriptionRecord,
  TransactionRecord,
} from "../src/store/records";
import { orgStore, type OrgStore } from "../src/store/store";
import { newUser } from "../src/store/users";
import { createTestClient, type TestClient } from "../src/testing/client";

export type Filter = components["schemas"]["UserSearchFilters"];
export type Group = components["schemas"]["MainSearchFilter"];
export type OrderBy = components["schemas"]["UserSearch"]["order_by"];

const ANCHOR_UTC = Date.UTC(2026, 10, 1);
const DAY_MS = 86_400_000;

export function client(): TestClient {
  return createTestClient({
    rateLimit: { limit: 1_000_000, windowMs: 60_000 },
  });
}

export function kelder(test: TestClient): OrgStore {
  return orgStore(test.mock.runtime.world().store, "kelder");
}

export function day(offset: number): string {
  return new Date(ANCHOR_UTC + offset * DAY_MS).toISOString().slice(0, 10);
}

export function noon(date: string): string {
  return `${date}T12:00:00+03:00`;
}

function first<T>(rows: readonly T[], what: string): T {
  const [row] = rows;
  if (row === undefined) throw new Error(`no seeded ${what}`);
  return row;
}

function withoutId<T extends { id: number }>(row: T): Omit<T, "id"> {
  const { id: _id, ...rest } = row;
  return rest;
}

export function person(db: OrgStore, label: string): number {
  return db.users.insert(newUser({ email_second: `${label}@fixture.example` }))
    .id;
}

export interface Payment {
  readonly amount?: number;
  readonly at?: string;
  readonly status?: TransactionRecord["payment_status"];
  readonly currencyId?: number;
  readonly method?: TransactionRecord["payment_method"];
  readonly bin?: string;
}

export function transaction(db: OrgStore, payment: Payment = {}): number {
  const template = first(db.transactions.list(), "transaction");
  return db.transactions.insert({
    ...withoutId(template),
    amount: payment.amount ?? 100,
    complete_date: noon(payment.at ?? day(-30)),
    payment_status: payment.status ?? 3,
    currency_id: payment.currencyId ?? 1,
    payment_method: payment.method ?? 0,
    bin_number: payment.bin ?? "454360",
  }).id;
}

export function donation(
  db: OrgStore,
  userId: number,
  payment: Payment = {},
  fields: Partial<Omit<DonationRecord, "id">> = {},
): Row<DonationRecord> {
  const template = first(
    db.donations.list((row) => row.recurring_order_id === null),
    "one-time donation",
  );
  return db.donations.insert({
    ...withoutId(template),
    user_id: userId,
    transaction_id: transaction(db, payment),
    sub_donation_type_id: null,
    fundraising_campaign_id: null,
    fundraising_page_id: null,
    module_id: null,
    added_by_id: null,
    f2f_group_id: null,
    marketing_channel_id: null,
    card_info_id: null,
    monthly_donation_id: null,
    recurring_order_id: null,
    details: "",
    d_type: 0,
    donor_type: "personal",
    ...fields,
  });
}

export function monthly(
  db: OrgStore,
  userId: number,
  payment: Payment = {},
  fields: Partial<Omit<DonationRecord, "id">> = {},
): Row<DonationRecord> {
  return donation(db, userId, payment, {
    recurring_order_id: `RO-T${userId}-${db.donations.count()}`,
    recurring_status: 1,
    recurring_start_date: noon(payment.at ?? day(-30)),
    recurring_cancel_date: null,
    recurring_limit: null,
    recurring_withdraw_count: 1,
    recurring_total_withdraw_amount: payment.amount ?? 100,
    ...fields,
  });
}

export function campaign(
  db: OrgStore,
  userId: number,
  fields: Partial<Omit<FundraisingCampaignRecord, "id">> = {},
): Row<FundraisingCampaignRecord> {
  const template = first(db.fundraisingCampaigns.list(), "campaign");
  return db.fundraisingCampaigns.insert({
    ...withoutId(template),
    user_id: userId,
    status: 1,
    activation_date: null,
    finish_date: null,
    event_date: null,
    team_id: null,
    team_campaign_id: null,
    association_campaign_target_id: null,
    thanks_mail_id: null,
    thanks_sms_id: null,
    referral_thanks_mail_id: null,
    ...fields,
  });
}

export function dues(
  db: OrgStore,
  userId: number,
  fields: Partial<Omit<SubscriptionRecord, "id">> = {},
): Row<SubscriptionRecord> {
  const template = first(db.subscriptions.list(), "dues record");
  return db.subscriptions.insert({
    ...withoutId(template),
    user_id: userId,
    status: 1,
    details: "",
    recurring: false,
    recurring_withdrawal: false,
    debt_category_id: null,
    transaction_id: null,
    ...fields,
  });
}

export function duesPayment(
  db: OrgStore,
  userId: number,
  payment: Payment = {},
  fields: Partial<Omit<SubscriptionRecord, "id">> = {},
): Row<SubscriptionRecord> {
  return dues(db, userId, {
    status: 2,
    amount: payment.amount ?? 100,
    operation_date: noon(payment.at ?? day(-30)),
    transaction_id: transaction(db, payment),
    ...fields,
  });
}

export function profile(
  db: OrgStore,
  userId: number,
  fields: Partial<Omit<ContactProfileRecord, "id" | "user_id">>,
): void {
  const existing = db.contactProfiles.find((row) => row.user_id === userId);
  if (existing) {
    db.contactProfiles.update(existing.id, fields);
    return;
  }
  db.contactProfiles.insert({
    user_id: userId,
    create_date: "",
    last_update_date: "",
    has_password: false,
    last_login: null,
    profile_pic: null,
    language: "tr",
    agreement: null,
    blocked_mail: false,
    spam_mail: false,
    address_book: false,
    donation_reminder: null,
    notify_after_dues_withdrawal: false,
    default_dues_reminder_withdrawal: false,
    ...fields,
  });
}

export function note(
  db: OrgStore,
  userId: number,
  fields: {
    readonly details?: string;
    readonly at?: string;
    readonly tagId?: number;
    readonly issuerId?: number;
    readonly eventType?: 1 | 7;
  } = {},
): number {
  return db.timeline.insert({
    user_id: userId,
    details: fields.details ?? "Not",
    event_time: noon(fields.at ?? day(-5)),
    event_type: fields.eventType ?? 7,
    tag_id: fields.tagId ?? null,
    custom_date: false,
    lead_type: null,
    outcome: null,
    sequence_no: null,
    is_first_touch: null,
    amount: null,
    issuer_id: fields.issuerId ?? null,
    currency_id: null,
    added_by_id: null,
    calendar_event: null,
  }).id;
}

export function bankTransfer(
  db: OrgStore,
  userId: number,
  fields: {
    readonly iban?: string;
    readonly bank?: string;
    readonly sender?: string;
    readonly type?: 1 | 2 | 4;
    readonly at?: string;
    readonly donationId?: number;
    readonly status?: 3 | 8;
  } = {},
): void {
  const template = first(
    db.bankTransactions.list((row) => row.payment_status === 3),
    "matched transfer",
  );
  db.bankTransactions.insert({
    ...withoutId(template),
    matched_user_id: userId,
    payment_status: fields.status ?? 3,
    counterparty_iban: fields.iban ?? `TR${userId}000000000000000001`,
    counterparty_bank: fields.bank ?? "Ziraat Bankası",
    counterparty_name: fields.sender ?? "GÖNDEREN",
    transaction_type: fields.type ?? 1,
    complete_date: noon(fields.at ?? day(-20)),
    matched_donation_id: fields.donationId ?? null,
    matched_subscription_id: null,
    matched_certificate_sale_id: null,
  });
}

export function channel(
  db: OrgStore,
  part: "utm_source" | "utm_medium" | "utm_campaign" | "utm_content",
  value: string,
): number {
  return db.marketingChannels.insert({
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_content: "",
    create_date: noon(day(-60)),
    [part]: value,
  }).id;
}

export function ticketSale(
  db: OrgStore,
  userId: number,
  fields: {
    readonly eventId?: number;
    readonly ticketId?: number;
    readonly payment?: Payment;
  } = {},
): void {
  const template = first(db.ticketSales.list(), "ticket sale");
  const eventId = fields.eventId ?? 601;
  const sale = db.ticketSales.insert({
    ...withoutId(template),
    event_id: eventId,
    user_id: userId,
    transaction_id: transaction(db, fields.payment),
  });
  const ticket =
    fields.ticketId ??
    first(
      db.tickets.list((row) => row.event_id === eventId),
      "ticket",
    ).id;
  db.soldTickets.insert({
    ticket_sale_id: sale.id,
    ticket_id: ticket,
    attendee_name: "Katılımcı",
  });
}

export function ecardSale(
  db: OrgStore,
  userId: number,
  fields: Partial<Omit<EcardTransactionRecord, "id">> = {},
  payment: Payment = {},
): void {
  const template = first(db.ecardTransactions.list(), "e-card sale");
  db.ecardTransactions.insert({
    ...withoutId(template),
    user_id: userId,
    certificate_id: 951,
    delivery_date: null,
    has_cargo: false,
    recipient_count: 1,
    marketing_channel_id: null,
    transaction_id: transaction(db, payment),
    ...fields,
  });
}

export function formAnswer(
  db: OrgStore,
  userId: number,
  fields: { readonly formId?: number; readonly at?: string } = {},
): void {
  const template = first(db.formAnswers.list(), "form answer");
  db.formAnswers.insert({
    ...withoutId(template),
    user_id: userId,
    form_id: fields.formId ?? 701,
    complete_date: noon(fields.at ?? day(-12)),
    transaction_id: null,
  });
}

export function donationRequest(
  db: OrgStore,
  userId: number,
  fields: {
    readonly type: 0 | 1;
    readonly value?: string;
    readonly at?: string;
  },
): void {
  db.monthlyDonationRequests.insert({
    donation_id: monthly(db, userId).id,
    user_id: userId,
    request_type: fields.type,
    status: 0,
    value: fields.value ?? "",
    create_date: noon(fields.at ?? day(-3)),
    response_date: null,
  });
}

export function relation(
  db: OrgStore,
  holderId: number,
  relatedId: number,
  fields: { readonly dues?: boolean; readonly comm?: boolean } = {},
): void {
  db.contactRelations.insert({
    user_id: holderId,
    related_user_id: relatedId,
    dues_permission: fields.dues ?? false,
    comm_permission: fields.comm ?? false,
    create_date: noon(day(-50)),
  });
}

export function permission(
  db: OrgStore,
  userId: number,
  fields: Partial<Omit<CommunicationPermissionRecord, "id">>,
): void {
  db.communicationPermissions.insert({
    user_id: userId,
    email: `kisi${userId}@izin.example`,
    phone: `+90555${String(userId).padStart(7, "0")}`,
    phone_slug: `90555${String(userId).padStart(7, "0")}`,
    allow_comm_via_phone: false,
    allow_comm_via_phone_date: noon(day(-400)),
    allow_comm_via_sms: false,
    allow_comm_via_sms_date: noon(day(-400)),
    allow_comm_via_email: false,
    allow_comm_via_email_date: noon(day(-400)),
    ...fields,
  });
}

export function cardInfo(db: OrgStore, userId: number, bin = "454360"): number {
  return db.cardInfos.insert({
    user_id: userId,
    bin_number: bin,
    last_four: "1234",
    display: `${bin.slice(0, 4)} ${bin.slice(4)}** **** 1234`,
  }).id;
}

export interface SearchOptions {
  readonly orderBy?: OrderBy;
  readonly startPage?: number;
  readonly howMany?: number;
  readonly values?: readonly string[];
}

export async function search(
  test: TestClient,
  filter: Group,
  options: SearchOptions = {},
) {
  return test.ok("getUserList", {
    body: {
      search: {
        start_page: options.startPage ?? 1,
        how_many: options.howMany ?? 100,
        order_by: options.orderBy ?? "id",
        filter,
      },
      ...(options.values ? { values_list: options.values } : {}),
    },
  });
}

export function leaf(
  parameter: Filter["parameter"],
  condition: Filter["condition"],
  value?: Filter["value"],
): Filter {
  return {
    type: "default",
    parameter,
    condition,
    ...(value === undefined ? {} : { value }),
  };
}

export function within(ids: readonly number[], filter: Filter | Group): Group {
  return {
    condition: "and",
    attributes: [leaf("id", "contains", ids.join(";")), filter],
  };
}

export async function matchingIds(
  test: TestClient,
  filter: Group,
  options: SearchOptions = {},
): Promise<number[]> {
  const found = await search(test, filter, { values: ["id"], ...options });
  return (found.user_list ?? []).map((user) => user.id ?? 0);
}

export async function expectStatus(
  test: TestClient,
  filter: Group,
  status: number,
  error?: string,
): Promise<void> {
  const response = await test.call("getUserList", {
    body: {
      search: { start_page: 1, how_many: 10, order_by: "id", filter },
    },
  });
  expect(response.status, JSON.stringify(filter)).toBe(status);
  if (error !== undefined) expect(response.body).toEqual({ error });
}
