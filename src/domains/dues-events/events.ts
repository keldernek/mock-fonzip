import { notFound } from "../../api/errors";
import type { Handler, HandlerInput } from "../../api/handler";
import { matchesQuery, paginate } from "../../api/listing";
import { istanbulDateTime } from "../../seed/dates";
import type { Row } from "../../store/collection";
import { present, userName } from "../../store/joins";
import type { EventRecord } from "../../store/records";
import type { OrgStore } from "../../store/store";
import { sortRows, unaccented } from "./filters";
import { ticketsOf, toEvent } from "./projections";

type EventBody = HandlerInput<"createEvent">["body"];

type Failure = {
  readonly status: 400 | 404;
  readonly body: { readonly error: string };
};

const invalid = (error: string) => ({ status: 400, body: { error } }) as const;

function toEventListItem(store: OrgStore, event: Row<EventRecord>) {
  return {
    id: event.id,
    url: event.url,
    name: event.name,
    start_date: event.start_date,
    end_date: event.end_date,
    all_day: event.all_day,
    active: event.active,
    timezone: event.timezone,
    create_date: event.create_date,
    created_by_id: present(event.created_by_id),
    created_by__name: userName(store, event.created_by_id),
    update_date: present(event.update_date),
    updated_by_id: present(event.updated_by_id),
    updated_by__name: userName(store, event.updated_by_id),
    archived_by_id: present(event.archived_by_id),
    archived_by__name: userName(store, event.archived_by_id),
    archive_date: present(event.archive_date),
  };
}

const TARGET: Readonly<
  Record<"a" | "p" | "u", (event: Row<EventRecord>, now: number) => boolean>
> = {
  a: () => true,
  p: (event, now) => Date.parse(event.end_date) < now,
  u: (event, now) => Date.parse(event.end_date) >= now,
};

export const getEventList: Handler<"getEventList"> = (
  { query },
  { store, clock },
) => {
  const now = clock.now().getTime();
  const target = TARGET[query.target ?? "a"];
  const archived = query.archived === "true";
  const matching = store.events.list(
    (event) =>
      target(event, now) &&
      (event.archive_date !== null) === archived &&
      matchesQuery(query.query, [event.name, event.address, event.details]),
  );
  const sorted = sortRows(matching, query.order_by ?? "start_date", {
    start_date: (event) => Date.parse(event.start_date),
    name: (event) => event.name,
    id: (event) => event.id,
  });
  return {
    status: 200,
    body: {
      event_list: paginate(sorted, query).map((event) =>
        toEventListItem(store, event),
      ),
      total: sorted.length,
    },
  };
};

export const getEventDetails: Handler<"getEventDetails"> = (
  { path },
  { store },
) => {
  const event = store.events.get(path.event_id);
  if (!event) return notFound("Event");
  return { status: 200, body: { event: toEvent(store, event) } };
};

function slug(name: string): string {
  return unaccented(name)
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
}

function checkReferences(store: OrgStore, body: EventBody): Failure | null {
  if (
    body.payment_settings_id !== undefined &&
    !store.paymentSettings.get(body.payment_settings_id)
  ) {
    return notFound("Payment system");
  }
  if (
    body.sender_account_id !== undefined &&
    !store.bankAccounts.get(body.sender_account_id)
  ) {
    return notFound("Sender account");
  }
  return null;
}

function checkSchedule(
  event: Pick<
    EventRecord,
    "start_date" | "end_date" | "paid_event" | "payment_settings_id"
  >,
): Failure | null {
  if (Date.parse(event.end_date) < Date.parse(event.start_date)) {
    return invalid("end_date must not be before start_date");
  }
  if (event.paid_event && event.payment_settings_id === null) {
    return invalid("A paid event needs a payment_settings_id");
  }
  return null;
}

function ticketIds(
  store: OrgStore,
  body: EventBody,
  eventId: number | null,
): readonly number[] | Failure {
  const requested = [
    ...new Set((body.ticket_types ?? []).map((ticket) => ticket.id)),
  ];
  for (const id of requested) {
    if (id === undefined) return invalid("Each ticket_types item needs an id");
    const ticket = store.tickets.get(id);
    if (!ticket) return notFound(`Ticket ${id}`);
    if (ticket.event_id !== null && ticket.event_id !== eventId) {
      return invalid(
        `Ticket ${id} is already used by event ${ticket.event_id}; a ticket cannot be used in multiple events`,
      );
    }
  }
  return requested.filter((id) => id !== undefined);
}

export function hasSales(store: OrgStore, ticketId: number): boolean {
  return (
    store.soldTickets.find((seat) => seat.ticket_id === ticketId) !== undefined
  );
}

function attachTickets(
  store: OrgStore,
  eventId: number,
  ids: readonly number[],
): Failure | null {
  const leaving = ticketsOf(store, eventId).filter(
    (ticket) => !ids.includes(ticket.id),
  );
  const sold = leaving.find((ticket) => hasSales(store, ticket.id));
  if (sold) {
    return invalid(`Ticket ${sold.id} has sales and cannot leave the event`);
  }
  for (const ticket of leaving) {
    store.tickets.update(ticket.id, { event_id: null, order: 0 });
  }
  for (const [index, id] of ids.entries()) {
    store.tickets.update(id, { event_id: eventId, order: index + 1 });
  }
  return null;
}

function dateTime(value: string): string {
  return istanbulDateTime(new Date(value));
}

export const createEvent: Handler<"createEvent"> = (
  { body },
  { store, clock, org },
) => {
  if (body.name === undefined || body.name.trim() === "") {
    return invalid("name is required");
  }
  if (body.start_date === undefined || body.end_date === undefined) {
    return invalid("start_date and end_date are required");
  }
  const draft = {
    start_date: dateTime(body.start_date),
    end_date: dateTime(body.end_date),
    paid_event: body.paid_event ?? false,
    payment_settings_id: body.payment_settings_id ?? null,
  };
  const failure = checkSchedule(draft) ?? checkReferences(store, body);
  if (failure) return failure;
  const tickets = ticketIds(store, body, null);
  if ("status" in tickets) return tickets;
  const event = store.events.insert({
    ...draft,
    name: body.name.trim(),
    url: body.url ?? "",
    all_day: body.all_day ?? false,
    active: true,
    timezone: "Europe/Istanbul",
    create_date: istanbulDateTime(clock.now()),
    created_by_id: null,
    update_date: null,
    updated_by_id: null,
    archived_by_id: null,
    archive_date: null,
    venue: body.venue ?? 0,
    address: body.address ?? "",
    details: body.details ?? "",
    image: body.image ?? "",
    max_installment: body.max_installment ?? 1,
    send_reminder: body.send_reminder ?? false,
    ask_billing_info: body.ask_billing_info ?? false,
    location: body.location ?? 0,
    sender_account_id: body.sender_account_id ?? null,
  });
  if (body.url === undefined) {
    store.events.update(event.id, {
      url: `${org.info.url}/etkinlik/${event.id}-${slug(event.name)}`,
    });
  }
  attachTickets(store, event.id, tickets);
  return { status: 200, body: { result: "ok", event_id: event.id } };
};

export const updateEvent: Handler<"updateEvent"> = (
  { path, body },
  { store, clock },
) => {
  const event = store.events.get(path.event_id);
  if (!event) return notFound("Event");
  if (body.name !== undefined && body.name.trim() === "") {
    return invalid("name must not be empty");
  }
  const draft = {
    start_date:
      body.start_date === undefined
        ? event.start_date
        : dateTime(body.start_date),
    end_date:
      body.end_date === undefined ? event.end_date : dateTime(body.end_date),
    paid_event: body.paid_event ?? event.paid_event,
    payment_settings_id: body.payment_settings_id ?? event.payment_settings_id,
  };
  const failure = checkSchedule(draft) ?? checkReferences(store, body);
  if (failure) return failure;
  const tickets =
    body.ticket_types === undefined ? null : ticketIds(store, body, event.id);
  if (tickets !== null && "status" in tickets) return tickets;
  if (tickets !== null) {
    const refused = attachTickets(store, event.id, tickets);
    if (refused) return refused;
  }
  store.events.update(event.id, {
    ...draft,
    name: body.name?.trim() ?? event.name,
    url: body.url ?? event.url,
    venue: body.venue ?? event.venue,
    address: body.address ?? event.address,
    details: body.details ?? event.details,
    image: body.image ?? event.image,
    all_day: body.all_day ?? event.all_day,
    max_installment: body.max_installment ?? event.max_installment,
    send_reminder: body.send_reminder ?? event.send_reminder,
    ask_billing_info: body.ask_billing_info ?? event.ask_billing_info,
    location: body.location ?? event.location,
    sender_account_id: body.sender_account_id ?? event.sender_account_id,
    update_date: istanbulDateTime(clock.now()),
    updated_by_id: null,
  });
  return { status: 200, body: { result: "ok" } };
};

export const updateEventStatus: Handler<"updateEventStatus"> = (
  { path, body },
  { store, clock },
) => {
  const event = store.events.get(path.event_id);
  if (!event) return notFound("Event");
  if (body.active === undefined) return invalid("active is required");
  store.events.update(event.id, {
    active: body.active,
    update_date: istanbulDateTime(clock.now()),
    updated_by_id: null,
  });
  return { status: 200, body: { result: "ok" } };
};

export const deleteEvent: Handler<"deleteEvent"> = ({ path }, { store }) => {
  const event = store.events.get(path.event_id);
  if (!event) return notFound("Event");
  if (store.ticketSales.find((sale) => sale.event_id === event.id)) {
    return invalid("An event with ticket sales cannot be deleted");
  }
  for (const ticket of ticketsOf(store, event.id)) {
    store.tickets.remove(ticket.id);
  }
  store.events.remove(event.id);
  return { status: 200, body: { result: "ok" } };
};
