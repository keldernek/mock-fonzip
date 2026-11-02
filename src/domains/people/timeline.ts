import { notFound } from "../../api/errors";
import type { Handler } from "../../api/handler";
import { newestFirst, paginate } from "../../api/listing";
import { istanbulDayOf, istanbulMidnight } from "../../seed/dates";
import type { Row } from "../../store/collection";
import { present, userName } from "../../store/joins";
import type {
  DonationRecord,
  TimelineRecord,
  UserRecord,
} from "../../store/records";
import { currencyById } from "../../store/reference";
import type { OrgStore } from "../../store/store";
import { dayOf } from "./calendar";
import { createFacts, type Facts } from "./facts";

type EventType = TimelineRecord["event_type"];

interface TimelineEvent {
  readonly id: number | string;
  readonly event_type: EventType;
  readonly event_time: string;
  readonly details: string;
  readonly stored: Row<TimelineRecord> | null;
}

const DERIVED_ID_BASE = 1_000_000_000;
const DERIVED_ID_STRIDE = 10_000_000;

function derived(
  source: number,
  sourceId: number,
  event_type: EventType,
  event_time: string | null,
  details: string,
): TimelineEvent[] {
  if (event_time === null) return [];
  return [
    {
      id: DERIVED_ID_BASE + source * DERIVED_ID_STRIDE + sourceId,
      event_type,
      event_time,
      details,
      stored: null,
    },
  ];
}

function money(amount: number, currencyId: number): string {
  return `${amount.toLocaleString("tr-TR")} ${currencyById(currencyId).display}`;
}

function donationEvents(
  facts: Facts,
  donation: Row<DonationRecord>,
  source: number,
): TimelineEvent[] {
  const transaction = facts.transaction(donation.transaction_id);
  if (!transaction) return [];
  const amount = money(transaction.amount, transaction.currency_id);
  const category =
    donation.sub_donation_type_id === null
      ? undefined
      : facts.store.donationCategories.get(donation.sub_donation_type_id);
  const monthly = donation.recurring_order_id !== null;
  const parent = monthly && donation.monthly_donation_id === null;
  const events: TimelineEvent[] = [];
  if (transaction.payment_status === 3) {
    events.push(
      ...derived(
        source,
        donation.id,
        monthly ? 6 : 5,
        transaction.complete_date,
        monthly
          ? `Düzenli bağış çekimi: ${amount}`
          : `${amount} bağış yaptı${category ? ` (${category.name})` : ""}`,
      ),
    );
  }
  if (parent) {
    events.push(
      ...derived(
        17,
        donation.id,
        17,
        donation.recurring_start_date,
        `Düzenli bağışçı oldu: aylık ${amount}`,
      ),
    );
    if (donation.recurring_status === 3 && donation.recurring_cancel_date) {
      events.push(
        ...derived(
          8,
          donation.id,
          8,
          istanbulMidnight(donation.recurring_cancel_date),
          `Düzenli bağışını iptal etti${donation.recurring_cancel_reason ? `: ${donation.recurring_cancel_reason}` : ""}`,
        ),
      );
    }
  }
  return events;
}

function derivedEvents(user: Row<UserRecord>, facts: Facts): TimelineEvent[] {
  const { store } = facts;
  const nowMs = facts.now.getTime();
  return [
    ...derived(0, user.id, 0, user.join_date || null, "Derneğe katıldı"),
    ...facts
      .donations(user.id)
      .flatMap((donation) => donationEvents(facts, donation, 5)),
    ...facts
      .microDonations(user.id)
      .flatMap((donation) => donationEvents(facts, donation, 31)),
    ...facts
      .subscriptions(user.id)
      .filter((row) => row.status === 2 && facts.succeeded(row.transaction_id))
      .flatMap((row) =>
        derived(
          10,
          row.id,
          10,
          row.operation_date,
          `${istanbulDayOf(row.period ?? row.operation_date).slice(0, 4)} aidatı ödendi: ${money(row.amount, 1)}`,
        ),
      ),
    ...facts
      .ticketSales(user.id)
      .filter((sale) => facts.succeeded(sale.transaction_id))
      .flatMap((sale) => {
        const event = store.events.get(sale.event_id);
        if (!event || Date.parse(event.start_date) > nowMs) return [];
        return derived(
          2,
          sale.id,
          2,
          event.start_date,
          `${event.name} etkinliğine katıldı`,
        );
      }),
    ...facts
      .campaigns(user.id)
      .filter((campaign) => campaign.status !== 4)
      .flatMap((campaign) => [
        ...derived(
          11,
          campaign.id,
          11,
          campaign.activation_date,
          `${campaign.title} kampanyasını başlattı`,
        ),
        ...(campaign.status === 3
          ? derived(
              12,
              campaign.id,
              12,
              campaign.finish_date,
              `${campaign.title} kampanyası tamamlandı`,
            )
          : []),
      ]),
    ...facts
      .teams(user.id)
      .flatMap((team) =>
        derived(
          13,
          team.id,
          13,
          team.create_date,
          `${team.title} takımıyla bağış toplamaya katıldı`,
        ),
      ),
    ...facts.formAnswers(user.id).flatMap((answer) => {
      const form = store.forms.get(answer.form_id);
      return derived(
        14,
        answer.id,
        14,
        answer.complete_date,
        `${form?.title ?? "Form"} formunu doldurdu`,
      );
    }),
    ...facts
      .ecardSales(user.id)
      .filter((sale) => facts.succeeded(sale.transaction_id))
      .flatMap((sale) => {
        const ecard = store.ecards.get(sale.certificate_id);
        const transaction = facts.transaction(sale.transaction_id);
        return derived(
          15,
          sale.id,
          15,
          transaction?.complete_date ?? null,
          `${ecard?.title ?? "E-kart"} satın aldı`,
        );
      }),
  ];
}

function storedEvent(row: Row<TimelineRecord>): TimelineEvent {
  return {
    id: row.event_type === 27 ? `lead-${row.id}` : row.id,
    event_type: row.event_type,
    event_time: row.event_time,
    details: row.details,
    stored: row,
  };
}

export function timelineOf(
  user: Row<UserRecord>,
  facts: Facts,
): TimelineEvent[] {
  return [
    ...facts.storedTimeline(user.id).map(storedEvent),
    ...derivedEvents(user, facts),
  ].sort(
    (a, b) =>
      newestFirst<TimelineEvent>((event) => event.event_time)(a, b) ||
      String(b.id).localeCompare(String(a.id), "en", { numeric: true }),
  );
}

export function activeDays(events: readonly TimelineEvent[]): number {
  return new Set(events.map((event) => dayOf(event.event_time))).size;
}

// A lead (event type 27) comes from its own record. Production sends it
// without the note fields (`custom_date`, the calendar event and the tag),
// and with no issuer and no details.
function toLead(event: TimelineEvent, row: Row<TimelineRecord>, facts: Facts) {
  return {
    id: event.id,
    details: null,
    event_time: event.event_time,
    event_type: event.event_type,
    issuer__first_name: null,
    issuer__last_name: null,
    pinned: false,
    lead_type: present(row.lead_type),
    outcome: present(row.outcome),
    sequence_no: present(row.sequence_no),
    is_first_touch: present(row.is_first_touch),
    amount: row.amount,
    currency__display:
      row.currency_id === null ? null : currencyById(row.currency_id).display,
    added_by__name: userName(facts.store, row.added_by_id) ?? null,
  };
}

// Any other event carries every note field, null when the event has none.
function toTimeline(facts: Facts, event: TimelineEvent) {
  const row = event.stored;
  if (row && event.event_type === 27) return toLead(event, row, facts);
  const issuer =
    row && row.issuer_id !== null
      ? facts.store.users.get(row.issuer_id)
      : undefined;
  const tag =
    row && row.tag_id !== null ? facts.store.tags.get(row.tag_id) : undefined;
  const calendar = row?.calendar_event ?? null;
  return {
    id: event.id,
    details: event.details,
    event_time: event.event_time,
    event_type: event.event_type,
    issuer__first_name: issuer?.first_name ?? null,
    issuer__last_name: issuer?.last_name ?? null,
    calendarevent__id: calendar?.id ?? null,
    calendarevent__note: calendar?.note ?? null,
    calendarevent__date: calendar?.date ?? null,
    calendarevent__completed: calendar?.completed ?? null,
    tag_id: tag?.id ?? null,
    tag__name: tag?.name ?? null,
    tag__color: tag?.color ?? null,
    custom_date: row?.custom_date ?? false,
    pinned: false,
  };
}

export const getUsersTimeline: Handler<"getUsersTimeline"> = (
  { path, query },
  { store, clock },
) => {
  const user = store.users.get(path.user_id);
  if (!user) return notFound("User");
  const facts = createFacts(store, clock);
  const events = timelineOf(user, facts).filter(
    (event) =>
      query.notes_only !== true ||
      (event.event_type === 7 &&
        (query.tag_id === undefined || event.stored?.tag_id === query.tag_id)),
  );
  return {
    status: 200,
    body: {
      timeline: paginate(events, query).map((event) =>
        toTimeline(facts, event),
      ),
      ...(query.require_total === true ? { total: events.length } : {}),
    },
  };
};

export function recordEvent(
  store: OrgStore,
  userId: number,
  eventType: 1 | 18 | 19 | 20 | 21 | 22 | 23,
  at: string,
  details: string,
): void {
  store.timeline.insert({
    user_id: userId,
    details,
    event_time: at,
    event_type: eventType,
    tag_id: null,
    custom_date: false,
    lead_type: null,
    outcome: null,
    sequence_no: null,
    is_first_touch: null,
    amount: null,
    issuer_id: null,
    currency_id: null,
    added_by_id: null,
    calendar_event: null,
  });
}
