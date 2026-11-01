import { notFound } from "../../api/errors";
import { nonEmpty } from "../../store/joins";
import type { Handler } from "../../api/handler";
import {
  type DateRange,
  inDateRange,
  matchesAmount,
  matchesQuery,
  paginate,
  parseDateRange,
} from "../../api/listing";
import type { Row } from "../../store/collection";
import type { TicketSaleRecord, TransactionRecord } from "../../store/records";
import type { OrgStore } from "../../store/store";
import { sameDigits, sortRows } from "./filters";
import {
  toEvent,
  toTransaction,
  toUserDetails,
  transactionOf,
} from "./projections";

const SALE_STATUS = { paid: 3, refund: 4, failed: 5 } as const;

function toTicketSale(
  store: OrgStore,
  sale: Row<TicketSaleRecord>,
  tx: Row<TransactionRecord> | undefined,
) {
  const event = store.events.get(sale.event_id);
  const member =
    sale.user_id === null ? undefined : store.users.get(sale.user_id);
  const mail =
    sale.sent_mail_id === null
      ? undefined
      : store.sentEmails.get(sale.sent_mail_id);
  return {
    id: sale.id,
    transaction: tx && toTransaction(store, tx),
    event: event && toEvent(store, event),
    sold_tickets: store.soldTickets
      .list((seat) => seat.ticket_sale_id === sale.id)
      .map((seat) => ({ id: seat.id })),
    member: member && toUserDetails(store, member),
    name: sale.name,
    phone: sale.phone,
    email: nonEmpty(sale.email),
    address: sale.address,
    city: sale.city,
    district: sale.district,
    post_code: sale.post_code,
    details: sale.details,
    sent_mail: mail && {
      id: mail.id,
      message_id: mail.message_id,
      status: mail.status,
    },
  };
}

export const getTicketSaleList: Handler<"getTicketSaleList"> = (
  { query },
  { store },
) => {
  const allTime = query.time_selection === 1;
  if (allTime && query.event_id === undefined) {
    return {
      status: 400,
      body: { error: "event_id is required with time_selection 1" },
    };
  }
  let window: DateRange | null = null;
  if (!allTime) {
    const range = parseDateRange(query.start_date, query.end_date);
    if ("error" in range) return { status: 400, body: { error: range.error } };
    window = range;
  }
  const status = SALE_STATUS[query.status];
  const matching = store.ticketSales.list().flatMap((sale) => {
    const tx = transactionOf(store, sale.transaction_id);
    if (!tx || tx.payment_status !== status) return [];
    const keep =
      (window === null || inDateRange(tx.complete_date, window)) &&
      (query.event_id === undefined || sale.event_id === query.event_id) &&
      (query.payment_method === undefined ||
        tx.payment_method === query.payment_method) &&
      matchesAmount(tx.amount, query.amount, query.amt_cnd) &&
      sameDigits(tx.bin_number, query.bin_number) &&
      sameDigits(tx.last_four, query.last_four) &&
      (query.installment_count === undefined ||
        tx.installment_count === query.installment_count) &&
      (query.payment_settings_id === undefined ||
        tx.payment_settings_id === query.payment_settings_id) &&
      matchesQuery(query.query, [sale.name, sale.email, sale.phone]);
    return keep ? [{ id: sale.id, sale, tx }] : [];
  });
  const sorted = sortRows(
    matching,
    query.order_by ?? "-transaction__complete_date",
    {
      id: (item) => item.id,
      transaction__amount: (item) => item.tx.amount,
      transaction__complete_date: (item) => Date.parse(item.tx.complete_date),
    },
  );
  return {
    status: 200,
    body: {
      sales_list: paginate(sorted, query).map((item) =>
        toTicketSale(store, item.sale, item.tx),
      ),
      total: sorted.length,
    },
  };
};

export const getTicketSaleDetails: Handler<"getTicketSaleDetails"> = (
  { path },
  { store },
) => {
  const sale = store.ticketSales.get(path.ticket_sale_id);
  if (!sale) return notFound("Ticket sale");
  return {
    status: 200,
    body: {
      ticket_sale: toTicketSale(
        store,
        sale,
        transactionOf(store, sale.transaction_id),
      ),
    },
  };
};

export const getUserBoughtTicketList: Handler<"getUserBoughtTicketList"> = (
  { path, query },
  { store },
) => {
  if (!store.users.get(path.user_id)) return notFound("User");
  const bought = store.ticketSales.list().flatMap((sale) => {
    const tx = transactionOf(store, sale.transaction_id);
    return sale.user_id === path.user_id && tx?.payment_status === 3
      ? [{ id: sale.id, sale, tx }]
      : [];
  });
  const sorted = sortRows(bought, "-transaction__complete_date", {
    transaction__complete_date: (item) => Date.parse(item.tx.complete_date),
  });
  return {
    status: 200,
    body: {
      bought_ticket_list: paginate(sorted, query).map(({ sale, tx }) => {
        const event = store.events.get(sale.event_id);
        return {
          id: sale.id,
          event_id: sale.event_id,
          transaction__amount: tx.amount,
          transaction__complete_date: tx.complete_date,
          event__name: event?.name,
          transaction__fonzip_id_hashed: tx.fonzip_id_hashed,
          event__url: event?.url,
        };
      }),
      total: sorted.length,
    },
  };
};
