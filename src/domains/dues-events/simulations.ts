import {
  invalid,
  missing,
  type SimulationContext,
  type SimulationFragment,
  type SimulationInput,
  type SimulationResult,
} from "../../control/simulation";
import { istanbulDate, istanbulDateTime } from "../../seed/dates";
import type { Row } from "../../store/collection";
import type { TicketRecord, UserRecord } from "../../store/records";
import { WEBHOOK_OPERATIONS } from "../../webhooks/emitter";
import {
  adjustTotalFinancial,
  hasOpenDebt,
  memberBalance,
  newTransaction,
  rebalance,
  recordPayment,
  refundTransaction,
} from "./ledger";
import { soldCount, transactionOf } from "./projections";

const conflict = (error: string): SimulationResult => ({
  ok: false,
  status: 409,
  error,
});

type Outcome = "successful" | "failed";

function outcomeOf(input: SimulationInput): Outcome | undefined {
  const value = input.string("outcome") ?? "successful";
  return value === "successful" || value === "failed" ? value : undefined;
}

function duesPayment(
  input: SimulationInput,
  ctx: SimulationContext,
): SimulationResult {
  const { store } = ctx;
  const userId = input.number("user_id");
  if (userId === undefined) return invalid("user_id is required");
  const user = store.users.get(userId);
  if (!user) return missing(`user ${userId} not found`);
  const outcome = outcomeOf(input);
  if (!outcome) return invalid("outcome must be successful or failed");
  const amount = input.number("amount") ?? -memberBalance(store, user.id);
  if (amount <= 0) {
    return invalid("the member owes nothing; send an amount above 0");
  }
  const at = ctx.clock.now();
  const tx = newTransaction(store, ctx.rng, at, {
    kind: "card",
    amount,
    outcome,
    paymentSettingsId:
      store.paymentSettings.find((settings) => settings.status === 1)?.id ??
      null,
    installments: 1,
  });
  const oldest = store.subscriptions
    .list((row) => row.user_id === user.id && row.status === 1)
    .sort(
      (a, b) => Date.parse(a.operation_date) - Date.parse(b.operation_date),
    )[0];
  const recorded = recordPayment(store, {
    user,
    tx,
    at,
    details: "Online aidat ödemesi",
    period: oldest?.period ?? istanbulDate(at),
    billNo: null,
  });
  ctx.webhooks.emit(
    {
      operation: WEBHOOK_OPERATIONS.subscription,
      status: outcome === "successful" ? 3 : 5,
    },
    recorded.payment.id,
  );
  return {
    ok: true,
    body: {
      subscription_id: recorded.payment.id,
      transaction_id: tx.id,
      payment_status: tx.payment_status,
      settled_debt_ids: recorded.settled,
      balance: memberBalance(store, user.id),
    },
  };
}

function duesRefund(
  input: SimulationInput,
  ctx: SimulationContext,
): SimulationResult {
  const { store } = ctx;
  const id = input.number("subscription_id");
  if (id === undefined) return invalid("subscription_id is required");
  const payment = store.subscriptions.get(id);
  if (!payment) return missing(`membership due ${id} not found`);
  const tx = transactionOf(store, payment.transaction_id);
  if (payment.status !== 2 || !tx)
    return invalid("only a payment can be refunded");
  if (tx.payment_status === 4)
    return conflict(`payment ${id} is already refunded`);
  if (tx.payment_status !== 3) {
    return invalid("only a successful payment can be refunded");
  }
  const at = ctx.clock.now();
  refundTransaction(store, tx, at, "Üyenin talebi üzerine iade edildi");
  const { id: _paymentId, ...paid } = payment;
  const refund = store.subscriptions.insert({
    ...paid,
    status: 4,
    details: "Aidat ödemesi iadesi",
    operation_date: istanbulDateTime(at),
    create_date: istanbulDateTime(at),
    assignment_status: 3,
    added_by_id: null,
    updated_by_id: null,
    debt_category_id: null,
  });
  adjustTotalFinancial(store, payment.user_id, tx, -1);
  rebalance(store, payment.user_id);
  ctx.webhooks.emit(
    { operation: WEBHOOK_OPERATIONS.subscription, status: 4 },
    payment.id,
  );
  return {
    ok: true,
    body: {
      subscription_id: payment.id,
      refund_id: refund.id,
      transaction_id: tx.id,
      balance: memberBalance(store, payment.user_id),
    },
  };
}

function hasTags(
  ctx: SimulationContext,
  user: Row<UserRecord> | undefined,
  ticket: Row<TicketRecord>,
): boolean {
  if (ticket.tag_control === 0) return true;
  if (!user) return false;
  const held = (tagId: number) =>
    ctx.store.userTags.find(
      (link) => link.user_id === user.id && link.tag_id === tagId,
    ) !== undefined;
  return ticket.tag_control === 1
    ? ticket.tags_to_control.some(held)
    : ticket.tags_to_control.every(held);
}

function salesWindowError(
  ticket: Row<TicketRecord>,
  now: number,
): string | undefined {
  if (
    ticket.sales_start_on_date &&
    ticket.sales_start !== null &&
    now < Date.parse(ticket.sales_start)
  ) {
    return "ticket sales have not started";
  }
  if (
    ticket.sales_end_on_date &&
    ticket.sales_end !== null &&
    now > Date.parse(ticket.sales_end)
  ) {
    return "ticket sales have ended";
  }
  return undefined;
}

function ticketSale(
  input: SimulationInput,
  ctx: SimulationContext,
): SimulationResult {
  const { store } = ctx;
  const ticketId = input.number("ticket_id");
  if (ticketId === undefined) return invalid("ticket_id is required");
  const ticket = store.tickets.get(ticketId);
  if (!ticket) return missing(`ticket ${ticketId} not found`);
  const event =
    ticket.event_id === null ? undefined : store.events.get(ticket.event_id);
  if (!event) return invalid(`ticket ${ticketId} belongs to no event`);
  if (!event.active || event.archive_date !== null) {
    return invalid(`event ${event.id} is not on sale`);
  }
  const outcome = outcomeOf(input);
  if (!outcome) return invalid("outcome must be successful or failed");
  if (ticket.price === 0 && outcome === "failed") {
    return invalid("a free ticket cannot fail");
  }
  const accountId = input.number("bank_account_id");
  if (accountId !== undefined) {
    if (ticket.price === 0) return invalid("a free ticket needs no transfer");
    if (outcome === "failed") return invalid("only a card payment can fail");
    if (!store.bankAccounts.get(accountId)) {
      return missing(`bank account ${accountId} not found`);
    }
  }
  const quantity = input.number("quantity") ?? 1;
  if (!Number.isInteger(quantity) || quantity < 1) {
    return invalid("quantity must be a whole number above 0");
  }
  const userId = input.number("user_id");
  const user = userId === undefined ? undefined : store.users.get(userId);
  if (userId !== undefined && !user) return missing(`user ${userId} not found`);
  if (
    !user &&
    (input.string("name") === undefined || input.string("email") === undefined)
  ) {
    return invalid("send user_id, or name and email for a guest buyer");
  }
  const windowError = salesWindowError(ticket, ctx.clock.now().getTime());
  if (windowError) return invalid(windowError);
  if (ticket.max_per_person > 0 && quantity > ticket.max_per_person) {
    return invalid(`at most ${ticket.max_per_person} tickets per person`);
  }
  if (
    ticket.quantity > 0 &&
    soldCount(store, ticket.id) + quantity > ticket.quantity
  ) {
    return conflict(
      `ticket ${ticket.id} has fewer than ${quantity} seats left`,
    );
  }
  if (!hasTags(ctx, user, ticket)) {
    return invalid("the buyer lacks the tags this ticket requires");
  }
  if (ticket.member_with_no_debt && (!user || hasOpenDebt(store, user.id))) {
    return invalid("this ticket is only for members with no unpaid debt");
  }
  const at = ctx.clock.now();
  const free = ticket.price === 0;
  const amount = ticket.price * quantity;
  const tx = newTransaction(
    store,
    ctx.rng,
    at,
    free || accountId !== undefined
      ? {
          kind: "manual",
          status: 3,
          amount,
          method: free ? 1 : 2,
          bankAccountId: accountId ?? null,
          transactionId: undefined,
          receiptNo: undefined,
        }
      : {
          kind: "card",
          amount,
          outcome,
          paymentSettingsId: event.payment_settings_id,
          installments: 1,
        },
  );
  const name =
    input.string("name") ??
    (user ? `${user.first_name} ${user.last_name}`.trim() : "");
  const sale = store.ticketSales.insert({
    event_id: event.id,
    transaction_id: tx.id,
    user_id: user?.id ?? null,
    name,
    phone: input.string("phone") ?? user?.phone ?? "",
    email: input.string("email") ?? user?.email ?? "",
    address: user?.address ?? "",
    city: user?.city_text ?? "",
    district: user?.district_text ?? "",
    post_code: user?.post_code ?? "",
    details: input.string("details") ?? "",
    sent_mail_id:
      outcome === "successful"
        ? store.sentEmails.insert({
            message_id: ctx.rng.int(1_000_000, 9_999_999),
            status: 0,
          }).id
        : null,
  });
  const seats = Array.from({ length: quantity }, (_, seat) =>
    store.soldTickets.insert({
      ticket_sale_id: sale.id,
      ticket_id: ticket.id,
      attendee_name: seat === 0 ? name : `Misafir ${seat}`,
    }),
  );
  ctx.webhooks.emit(
    {
      operation: WEBHOOK_OPERATIONS.ticket,
      status: outcome === "successful" ? 3 : 5,
    },
    sale.id,
  );
  return {
    ok: true,
    body: {
      ticket_sale_id: sale.id,
      transaction_id: tx.id,
      payment_status: tx.payment_status,
      sold_ticket_ids: seats.map((seat) => seat.id),
    },
  };
}

function ticketRefund(
  input: SimulationInput,
  ctx: SimulationContext,
): SimulationResult {
  const { store } = ctx;
  const id = input.number("ticket_sale_id");
  if (id === undefined) return invalid("ticket_sale_id is required");
  const sale = store.ticketSales.get(id);
  if (!sale) return missing(`ticket sale ${id} not found`);
  const tx = transactionOf(store, sale.transaction_id);
  if (!tx) return missing(`ticket sale ${id} has no transaction`);
  if (tx.payment_status === 4)
    return conflict(`ticket sale ${id} is already refunded`);
  if (tx.payment_status !== 3)
    return invalid("only a successful sale can be refunded");
  if (tx.amount === 0) return invalid("a free ticket has nothing to refund");
  refundTransaction(
    store,
    tx,
    ctx.clock.now(),
    "Katılımcının talebi üzerine iade edildi",
  );
  ctx.webhooks.emit(
    { operation: WEBHOOK_OPERATIONS.ticket, status: 4 },
    sale.id,
  );
  return { ok: true, body: { ticket_sale_id: sale.id, transaction_id: tx.id } };
}

export const simulations: SimulationFragment = {
  "membership-due-payment": {
    description:
      "A member pays dues by card on the public site. A successful payment settles the member's open debts oldest first and sends the SUBSCRIPTION webhook with status 3; a failed one records the failed transaction and sends status 5.",
    input: {
      user_id: "integer, required",
      amount: "number, defaults to what the member owes",
      outcome: "successful (default) or failed",
    },
    run: duesPayment,
  },
  "membership-due-refund": {
    description:
      "A successful dues payment is refunded. Its transaction becomes refunded, a refund record (status 4) joins the member's ledger, and the SUBSCRIPTION webhook goes out with status 4 for the payment.",
    input: { subscription_id: "integer, required: a successful payment" },
    run: duesRefund,
  },
  "ticket-sale": {
    description:
      "Someone buys event tickets on the public site, by card or by wire transfer. The sale follows the ticket's capacity, per-person limit, sales window, tag rule and no-debt rule, and sends the TICKET webhook with status 3, or 5 for a failed card payment.",
    input: {
      ticket_id: "integer, required",
      quantity: "integer, default 1",
      user_id: "integer: a member buyer",
      name: "string: a guest buyer's name, required without user_id",
      email: "string: a guest buyer's email, required without user_id",
      phone: "string",
      details: "string",
      bank_account_id:
        "integer: pay by wire transfer to this account instead of by card",
      outcome: "successful (default) or failed, for a card payment",
    },
    run: ticketSale,
  },
  "ticket-refund": {
    description:
      "A paid ticket sale is refunded. Its transaction becomes refunded, its seats stop counting as sold, and the TICKET webhook goes out with status 4.",
    input: { ticket_sale_id: "integer, required: a successful paid sale" },
    run: ticketRefund,
  },
};
