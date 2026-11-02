import { notFound } from "../../api/errors";
import type { Handler, HandlerInput } from "../../api/handler";
import { apiDateTime } from "../../seed/dates";
import type { Row } from "../../store/collection";
import type { TicketRecord } from "../../store/records";
import type { OrgStore } from "../../store/store";
import { hasSales } from "./events";
import { toTicket } from "./projections";
import { type Failure, invalid } from "./results";

type TicketBody = HandlerInput<"createTicket">["body"];
type TicketFields = Omit<
  TicketRecord,
  "id" | "event_id" | "order" | "quantity"
>;

function saleDate(
  onDate: boolean,
  value: string | undefined,
  fallback: string | null,
): string | null {
  if (!onDate) return null;
  return value === undefined ? fallback : apiDateTime(new Date(value));
}

function ticketFields(
  store: OrgStore,
  body: TicketBody,
  current: Row<TicketRecord> | undefined,
): TicketFields | Failure {
  const price = body.price ?? current?.price ?? 0;
  if (price < 0) return invalid("price must not be negative");
  const ticketType =
    body.ticket_type ??
    (body.price === undefined && current
      ? current.ticket_type
      : price > 0
        ? "paid"
        : "free");
  if (ticketType === "free" && price > 0) {
    return invalid("A free ticket has no price");
  }
  if (ticketType === "paid" && price <= 0) {
    return invalid("A paid ticket needs a price above 0");
  }
  const startOnDate =
    body.sales_start_on_date ?? current?.sales_start_on_date ?? false;
  const endOnDate =
    body.sales_end_on_date ?? current?.sales_end_on_date ?? false;
  const salesStart = saleDate(
    startOnDate,
    body.sales_start,
    current?.sales_start ?? null,
  );
  const salesEnd = saleDate(
    endOnDate,
    body.sales_end,
    current?.sales_end ?? null,
  );
  if (startOnDate && salesStart === null) {
    return invalid("sales_start is required with sales_start_on_date");
  }
  if (endOnDate && salesEnd === null) {
    return invalid("sales_end is required with sales_end_on_date");
  }
  if (
    salesStart !== null &&
    salesEnd !== null &&
    Date.parse(salesEnd) <= Date.parse(salesStart)
  ) {
    return invalid("sales_end must be after sales_start");
  }
  const maxPerPerson = body.max_per_person ?? current?.max_per_person ?? 0;
  if (maxPerPerson < 0) {
    return invalid("max_per_person must not be negative");
  }
  const tagControl = body.tag_control ?? current?.tag_control ?? 0;
  const tags = body.tags_to_control ?? current?.tags_to_control ?? [];
  const unknownTag = tags.find((id) => !store.tags.get(id));
  if (unknownTag !== undefined) {
    return notFound(`Tag ${unknownTag}`);
  }
  if (tagControl !== 0 && tags.length === 0) {
    return invalid("tag_control needs tags_to_control");
  }
  return {
    title: body.title.trim(),
    price,
    ticket_type: ticketType,
    details: body.details ?? current?.details ?? "",
    post_sale_message:
      body.post_sale_message ?? current?.post_sale_message ?? "",
    sales_start_on_date: startOnDate,
    sales_start: salesStart,
    sales_end_on_date: endOnDate,
    sales_end: salesEnd,
    max_per_person: maxPerPerson,
    tag_control: tagControl,
    tags_to_control: [...new Set(tags)],
    member_with_no_debt:
      body.member_with_no_debt ?? current?.member_with_no_debt ?? false,
    related_with_no_debt:
      body.related_with_no_debt ?? current?.related_with_no_debt ?? false,
  };
}

export const createTicket: Handler<"createTicket"> = ({ body }, { store }) => {
  if (body.title.trim() === "") return invalid("title must not be empty");
  const fields = ticketFields(store, body, undefined);
  if ("status" in fields) return fields;
  const ticket = store.tickets.insert({
    ...fields,
    event_id: null,
    order: 0,
    quantity: 0,
  });
  return { status: 200, body: { ticket: toTicket(store, ticket) } };
};

export const getTicketDetails: Handler<"getTicketDetails"> = (
  { path },
  { store },
) => {
  const ticket = store.tickets.get(path.ticket_id);
  if (!ticket) return notFound("Ticket");
  return { status: 200, body: { ticket: toTicket(store, ticket) } };
};

export const updateTicket: Handler<"updateTicket"> = (
  { path, body },
  { store },
) => {
  const ticket = store.tickets.get(path.ticket_id);
  if (!ticket) return notFound("Ticket");
  if (body.title.trim() === "") return invalid("title must not be empty");
  const fields = ticketFields(store, body, ticket);
  if ("status" in fields) return fields;
  const updated = store.tickets.update(ticket.id, fields) ?? ticket;
  return { status: 200, body: { ticket: toTicket(store, updated) } };
};

export const deleteTicket: Handler<"deleteTicket"> = ({ path }, { store }) => {
  const ticket = store.tickets.get(path.ticket_id);
  if (!ticket) return notFound("Ticket");
  if (hasSales(store, ticket.id)) {
    return invalid("A ticket with sales cannot be deleted");
  }
  store.tickets.remove(ticket.id);
  return { status: 200, body: { result: "ok" } };
};
