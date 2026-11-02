import { describe, expect, test } from "bun:test";

import { createTestClient, type TestClient } from "../src/testing/client";
import { EVER, ids, kelder, PAGE, simulate } from "./dues-events-support";

function quietClient(): TestClient {
  return createTestClient({
    fetch: async () => new Response(null, { status: 204 }),
  });
}

function notifications(client: TestClient) {
  return client.mock.runtime
    .world()
    .webhooks.deliveries()
    .map((delivery) => delivery.body);
}

const TODAY = {
  start_date: "2026-11-01T00:00:00+03:00",
  end_date: "2026-11-02T00:00:00+03:00",
};

function numberOf(body: Record<string, unknown>, key: string): number {
  const value = body[key];
  return typeof value === "number" ? value : -1;
}

describe("membership-due-payment simulation", () => {
  test("records a card payment that settles the open debts and notifies SUBSCRIPTION 3", async () => {
    const client = quietClient();
    const db = kelder(client);
    const open = db.subscriptions.list(
      (row) => row.user_id === 1004 && row.status === 1,
    );
    const owed = open.reduce((sum, row) => sum + row.amount, 0);
    const before = db.users.get(1004)?.total_financial ?? 0;
    const result = await simulate(client, "membership-due-payment", {
      user_id: 1004,
    });
    expect(result.status).toBe(200);
    const paymentId = numberOf(result.body, "subscription_id");
    expect(result.body).toEqual({
      subscription_id: paymentId,
      transaction_id: expect.any(Number),
      payment_status: 3,
      settled_debt_ids: ids(open),
      balance: 0,
    });
    const detail = await client.ok("getMembershipDueDetails", {
      path: { subscription_id: paymentId },
    });
    expect(detail.subscription).toMatchObject({
      status: 2,
      amount: owed,
      balance: 0,
      assignment_status: 2,
      details: "Online aidat ödemesi",
      transaction: {
        payment_method: 0,
        payment_status: 3,
        fonzip_framework: true,
        payment_settings: { id: 71 },
      },
    });
    expect(detail.subscription?.card_info).toMatch(/^\*{4} \d{4}$/);
    const paid = await client.ok("getMembershipDuesList", {
      query: { ...PAGE, ...TODAY, status: "paid" },
    });
    expect(ids(paid.payment_list ?? [])).toEqual([paymentId]);
    for (const debt of open) {
      const settled = await client.ok("getDebtDetails", {
        path: { debt_id: debt.id },
      });
      expect(settled.subscription?.status, `debt ${debt.id}`).toBe(8);
    }
    expect(db.users.get(1004)?.total_financial).toBe(before + owed);
    expect(notifications(client)).toEqual([
      { id: paymentId, webhook_id: 21, operation: 2, status: 3 },
      { id: paymentId, webhook_id: 22, operation: 2, status: 3 },
    ]);
  });

  test("records a failed payment under status=failed and notifies SUBSCRIPTION 5", async () => {
    const client = quietClient();
    const result = await simulate(client, "membership-due-payment", {
      user_id: 1004,
      amount: 1500,
      outcome: "failed",
    });
    expect(result.body).toMatchObject({
      payment_status: 5,
      settled_debt_ids: [],
      balance: -1500,
    });
    const paymentId = numberOf(result.body, "subscription_id");
    const failed = await client.ok("getMembershipDuesList", {
      query: { ...PAGE, ...EVER, status: "failed" },
    });
    expect(failed.payment_list).toEqual([
      expect.objectContaining({
        id: paymentId,
        transaction__payment_status: 5,
        transaction__amount: 1500,
        transaction__transaction_error__code: expect.any(String),
        transaction__transaction_error__text: expect.any(String),
        transaction__transaction_error__group: expect.any(Number),
      }),
    ]);
    const debt = await client.ok("getDebtDetails", {
      path: { debt_id: 20003 },
    });
    expect(debt.subscription?.status, "the debt stays unpaid").toBe(1);
    const detail = await client.ok("getMembershipDueDetails", {
      path: { subscription_id: paymentId },
    });
    expect(detail.subscription?.transaction).toMatchObject({
      payment_status: 5,
      error_code: expect.any(String),
      error_text: expect.any(String),
    });
    expect(detail.subscription?.transaction?.auth_code).toBeNull();
    expect(notifications(client).map((body) => body.status)).toEqual([5, 5]);
  });

  test("refuses a missing or unknown member, nothing owed, and an unknown outcome", async () => {
    const client = quietClient();
    expect((await simulate(client, "membership-due-payment", {})).status).toBe(
      400,
    );
    expect(
      (await simulate(client, "membership-due-payment", { user_id: 99 }))
        .status,
    ).toBe(404);
    const settledMember = kelder(client)
      .users.list()
      .find(
        (user) =>
          kelder(client).subscriptions.find(
            (row) => row.user_id === user.id && row.status === 1,
          ) === undefined &&
          kelder(client).subscriptions.find((row) => row.user_id === user.id),
      );
    const nothing = await simulate(client, "membership-due-payment", {
      user_id: settledMember?.id ?? 0,
    });
    expect(nothing).toEqual({
      status: 400,
      body: { error: "the member owes nothing; send an amount above 0" },
    });
    const outcome = await simulate(client, "membership-due-payment", {
      user_id: 1004,
      outcome: "maybe",
    });
    expect(outcome.status).toBe(400);
    expect(notifications(client)).toEqual([]);
  });
});

describe("membership-due-refund simulation", () => {
  test("refunds a payment into a refund record and notifies SUBSCRIPTION 4", async () => {
    const client = quietClient();
    const db = kelder(client);
    const payment = db.subscriptions.find(
      (row) =>
        row.status === 2 &&
        db.transactions.get(row.transaction_id ?? 0)?.payment_status === 3 &&
        db.transactions.get(row.transaction_id ?? 0)?.payment_method === 0,
    );
    const userId = payment?.user_id ?? 0;
    const before = db.users.get(userId)?.total_financial ?? 0;
    const statementBefore = await client.ok("getUsersMembershipDueList", {
      path: { user_id: userId },
      query: PAGE,
    });
    const result = await simulate(client, "membership-due-refund", {
      subscription_id: payment?.id,
    });
    expect(result.status).toBe(200);
    const refundId = numberOf(result.body, "refund_id");
    expect(result.body).toMatchObject({
      subscription_id: payment?.id,
      transaction_id: payment?.transaction_id,
    });
    const refunds = await client.ok("getMembershipDuesList", {
      query: { ...PAGE, ...EVER, status: "refund" },
    });
    expect(ids(refunds.payment_list ?? [])).toContain(refundId);
    const paid = await client.ok("getMembershipDuesList", {
      query: { ...EVER, status: "paid", start_page: 1, how_many: 100 },
    });
    expect(ids(paid.payment_list ?? [])).not.toContain(payment?.id);
    const detail = await client.ok("getMembershipDueDetails", {
      path: { subscription_id: payment?.id ?? 0 },
    });
    expect(detail.subscription?.transaction).toMatchObject({
      payment_status: 4,
      refund_date: "2026-11-01T09:00:00+03:00",
      refund_reason: "Üyenin talebi üzerine iade edildi",
    });
    const refund = await client.ok("getMembershipDueDetails", {
      path: { subscription_id: refundId },
    });
    expect(refund.subscription).toMatchObject({
      status: 4,
      status_name: "İade",
      amount: payment?.amount,
      assignment_status: 3,
    });
    const statement = await client.ok("getUsersMembershipDueList", {
      path: { user_id: userId },
      query: { ...PAGE, listing: "r" },
    });
    expect(ids(statement.subscription_list ?? [])).toContain(refundId);
    expect(statement.subscription_list?.[0]?.balance).toBe(
      (statementBefore.subscription_list?.[0]?.balance ?? 0) -
        (payment?.amount ?? 0),
    );
    expect(db.users.get(userId)?.total_financial).toBe(
      before - (payment?.amount ?? 0),
    );
    expect(notifications(client)).toEqual([
      { id: payment?.id ?? 0, webhook_id: 21, operation: 2, status: 4 },
      { id: payment?.id ?? 0, webhook_id: 22, operation: 2, status: 4 },
    ]);
    const again = await simulate(client, "membership-due-refund", {
      subscription_id: payment?.id,
    });
    expect(again.status, "already refunded").toBe(409);
  });

  test("refuses a debt, a failed payment and an unknown record", async () => {
    const client = quietClient();
    expect(
      (
        await simulate(client, "membership-due-refund", {
          subscription_id: 20003,
        })
      ).status,
    ).toBe(400);
    const failed = await simulate(client, "membership-due-payment", {
      user_id: 1004,
      amount: 10,
      outcome: "failed",
    });
    const failedRefund = await simulate(client, "membership-due-refund", {
      subscription_id: failed.body.subscription_id,
    });
    expect(failedRefund).toEqual({
      status: 400,
      body: { error: "only a successful payment can be refunded" },
    });
    expect(
      (await simulate(client, "membership-due-refund", { subscription_id: 1 }))
        .status,
    ).toBe(404);
    expect((await simulate(client, "membership-due-refund", {})).status).toBe(
      400,
    );
  });
});

describe("ticket-sale simulation", () => {
  test("sells seats to a member and shows them in the lists, the detail and the sold count", async () => {
    const client = quietClient();
    const before = await client.ok("getTicketDetails", {
      path: { ticket_id: 6101 },
    });
    const result = await simulate(client, "ticket-sale", {
      ticket_id: 6101,
      quantity: 2,
      user_id: 1020,
      details: "Eşimle geleceğim",
    });
    expect(result.status).toBe(200);
    const saleId = numberOf(result.body, "ticket_sale_id");
    expect(result.body).toMatchObject({
      payment_status: 3,
      sold_ticket_ids: expect.any(Array),
    });
    const after = await client.ok("getTicketDetails", {
      path: { ticket_id: 6101 },
    });
    expect(after.ticket?.sold).toBe((before.ticket?.sold ?? 0) + 2);
    const event = await client.ok("getEventDetails", {
      path: { event_id: 601 },
    });
    expect(event.event?.ticket_types?.[0]?.sold).toBe(after.ticket?.sold);
    const detail = await client.ok("getTicketSaleDetails", {
      path: { ticket_sale_id: saleId },
    });
    const member = kelder(client).users.get(1020);
    expect(detail.ticket_sale).toMatchObject({
      id: saleId,
      name: `${member?.first_name} ${member?.last_name}`,
      email: member?.email,
      details: "Eşimle geleceğim",
      member: { id: 1020 },
      event: { id: 601 },
      transaction: {
        amount: 3000,
        payment_status: 3,
        payment_settings_id: 71,
        payment_method: 0,
      },
      sent_mail: { status: 0 },
    });
    expect(detail.ticket_sale?.sold_tickets).toHaveLength(2);
    const listed = await client.ok("getTicketSaleList", {
      query: { ...PAGE, ...TODAY, status: "paid" },
    });
    expect(ids(listed.sales_list ?? [])).toEqual([saleId]);
    const bought = await client.ok("getUserBoughtTicketList", {
      path: { user_id: 1020 },
      query: PAGE,
    });
    expect(ids(bought.bought_ticket_list ?? [])).toContain(saleId);
    expect(notifications(client), "only the CRM webhook takes tickets").toEqual(
      [{ id: saleId, webhook_id: 22, operation: 3, status: 3 }],
    );
  });

  test("sells a free seat to a guest and records a failed card sale", async () => {
    const client = quietClient();
    const free = await simulate(client, "ticket-sale", {
      ticket_id: 6105,
      name: "Elif Demir",
      email: "elif.demir@eposta.example",
      phone: "+905551112233",
    });
    expect(free.body).toMatchObject({ payment_status: 3 });
    const guest = await client.ok("getTicketSaleDetails", {
      path: { ticket_sale_id: numberOf(free.body, "ticket_sale_id") },
    });
    expect(guest.ticket_sale).toMatchObject({
      name: "Elif Demir",
      phone: "+905551112233",
      transaction: { amount: 0, payment_method: 1 },
    });
    expect(guest.ticket_sale).not.toHaveProperty("member");
    const failed = await simulate(client, "ticket-sale", {
      ticket_id: 6101,
      user_id: 1030,
      outcome: "failed",
    });
    expect(failed.body).toMatchObject({ payment_status: 5 });
    const failedList = await client.ok("getTicketSaleList", {
      query: { ...PAGE, ...TODAY, status: "failed" },
    });
    expect(ids(failedList.sales_list ?? [])).toEqual([
      numberOf(failed.body, "ticket_sale_id"),
    ]);
    expect(notifications(client).map((body) => body.status)).toEqual([3, 5]);
  });

  test("sells seats paid by wire transfer to one of the association's accounts", async () => {
    const client = quietClient();
    const result = await simulate(client, "ticket-sale", {
      ticket_id: 6101,
      user_id: 1020,
      quantity: 2,
      bank_account_id: 81,
    });
    expect(result.body).toMatchObject({ payment_status: 3 });
    const detail = await client.ok("getTicketSaleDetails", {
      path: { ticket_sale_id: numberOf(result.body, "ticket_sale_id") },
    });
    const account = kelder(client).bankAccounts.get(81);
    expect(detail.ticket_sale?.transaction).toMatchObject({
      amount: 3000,
      payment_method: 2,
      bank_account_id: 81,
      bank_account: {
        id: 81,
        name: account?.name,
        currency_id: account?.currency_id,
      },
      fonzip_framework: false,
    });
    const wired = await client.ok("getTicketSaleList", {
      query: { ...PAGE, ...TODAY, status: "paid", payment_method: 2 },
    });
    expect(ids(wired.sales_list ?? [])).toEqual([
      numberOf(result.body, "ticket_sale_id"),
    ]);
    const refused = [
      [
        { ticket_id: 6105, user_id: 1020, bank_account_id: 81 },
        400,
        "a free ticket needs no transfer",
      ],
      [
        {
          ticket_id: 6101,
          user_id: 1020,
          bank_account_id: 81,
          outcome: "failed",
        },
        400,
        "only a card payment can fail",
      ],
      [
        { ticket_id: 6101, user_id: 1020, bank_account_id: 9 },
        404,
        "bank account 9 not found",
      ],
    ] as const;
    for (const [input, status, error] of refused) {
      expect(await simulate(client, "ticket-sale", input), error).toEqual({
        status,
        body: { error },
      });
    }
  });

  test("keeps capacity, per-person limits, tag and debt rules, and the sales window", async () => {
    const client = quietClient();
    const db = kelder(client);
    expect(
      await simulate(client, "ticket-sale", {
        ticket_id: 6105,
        user_id: 1020,
        outcome: "failed",
      }),
    ).toEqual({ status: 400, body: { error: "a free ticket cannot fail" } });
    db.tickets.update(6105, { quantity: 2 });
    for (const name of ["A", "B"]) {
      const sold = await simulate(client, "ticket-sale", {
        ticket_id: 6105,
        name,
        email: `${name}@eposta.example`,
      });
      expect(sold.status).toBe(200);
    }
    const full = await simulate(client, "ticket-sale", {
      ticket_id: 6105,
      name: "C",
      email: "c@eposta.example",
    });
    expect(full).toEqual({
      status: 409,
      body: { error: "ticket 6105 has fewer than 1 seats left" },
    });
    expect(
      (await client.ok("getTicketDetails", { path: { ticket_id: 6105 } }))
        .ticket?.sold,
    ).toBe(2);
    const tagged =
      db.userTags.find((link) => link.tag_id === 103)?.user_id ?? 0;
    const untagged =
      db.users
        .list()
        .find(
          (user) =>
            db.userTags.find(
              (link) => link.user_id === user.id && link.tag_id === 103,
            ) === undefined,
        )?.id ?? 0;
    const debtFree =
      db.users
        .list()
        .find(
          (user) =>
            !user.admin &&
            db.subscriptions.find(
              (row) => row.user_id === user.id && row.status === 1,
            ) === undefined,
        )?.id ?? 0;
    const refused = [
      [
        { ticket_id: 6101, user_id: 1020, quantity: 5 },
        400,
        "at most 4 tickets per person",
      ],
      [
        { ticket_id: 6102, user_id: untagged },
        400,
        "the buyer lacks the tags this ticket requires",
      ],
      [
        { ticket_id: 6102, name: "Misafir", email: "m@eposta.example" },
        400,
        "the buyer lacks the tags this ticket requires",
      ],
      [
        { ticket_id: 6103, user_id: 1004 },
        400,
        "this ticket is only for members with no unpaid debt",
      ],
      [
        { ticket_id: 6108, name: "x", email: "x@eposta.example" },
        400,
        "event 605 is not on sale",
      ],
      [
        { ticket_id: 6109, name: "x", email: "x@eposta.example" },
        400,
        "event 606 is not on sale",
      ],
      [
        { ticket_id: 6104, name: "x", email: "x@eposta.example" },
        400,
        "ticket sales have ended",
      ],
      [
        { ticket_id: 6105, name: "x" },
        400,
        "send user_id, or name and email for a guest buyer",
      ],
      [{ ticket_id: 6106, user_id: 99 }, 404, "user 99 not found"],
      [{ ticket_id: 1 }, 404, "ticket 1 not found"],
      [
        { ticket_id: 6106, user_id: 1020, quantity: 0 },
        400,
        "quantity must be a whole number above 0",
      ],
    ] as const;
    for (const [input, status, error] of refused) {
      const response = await simulate(client, "ticket-sale", input);
      expect(response, JSON.stringify(input)).toEqual({
        status,
        body: { error },
      });
    }
    expect(
      (
        await simulate(client, "ticket-sale", {
          ticket_id: 6102,
          user_id: tagged,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await simulate(client, "ticket-sale", {
          ticket_id: 6103,
          user_id: debtFree,
        })
      ).status,
    ).toBe(200);
    const loose = await client.ok("createTicket", {
      body: { title: "Bağımsız", price: 10 },
    });
    expect(
      await simulate(client, "ticket-sale", {
        ticket_id: loose.ticket?.id,
        user_id: 1020,
      }),
    ).toEqual({
      status: 400,
      body: { error: `ticket ${loose.ticket?.id} belongs to no event` },
    });
    const later = await client.ok("createTicket", {
      body: {
        title: "Sonra",
        price: 0,
        sales_start_on_date: true,
        sales_start: "2026-12-01T00:00:00+03:00",
      },
    });
    await client.ok("updateEvent", {
      path: { event_id: 603 },
      body: { ticket_types: [{ id: 6105 }, { id: later.ticket?.id }] },
    });
    expect(
      await simulate(client, "ticket-sale", {
        ticket_id: later.ticket?.id,
        user_id: 1020,
      }),
    ).toEqual({
      status: 400,
      body: { error: "ticket sales have not started" },
    });
  });
});

describe("ticket-refund simulation", () => {
  test("refunds a paid sale, frees its seats and notifies TICKET 4", async () => {
    const client = quietClient();
    const sold = await simulate(client, "ticket-sale", {
      ticket_id: 6101,
      user_id: 1020,
      quantity: 2,
    });
    const saleId = numberOf(sold.body, "ticket_sale_id");
    const before = await client.ok("getTicketDetails", {
      path: { ticket_id: 6101 },
    });
    const result = await simulate(client, "ticket-refund", {
      ticket_sale_id: saleId,
    });
    expect(result).toEqual({
      status: 200,
      body: {
        ticket_sale_id: saleId,
        transaction_id: numberOf(sold.body, "transaction_id"),
      },
    });
    const after = await client.ok("getTicketDetails", {
      path: { ticket_id: 6101 },
    });
    expect(after.ticket?.sold).toBe((before.ticket?.sold ?? 0) - 2);
    const refunds = await client.ok("getTicketSaleList", {
      query: { ...PAGE, ...TODAY, status: "refund" },
    });
    expect(ids(refunds.sales_list ?? [])).toEqual([saleId]);
    const paid = await client.ok("getTicketSaleList", {
      query: { ...PAGE, ...TODAY, status: "paid" },
    });
    expect(ids(paid.sales_list ?? [])).not.toContain(saleId);
    const detail = await client.ok("getTicketSaleDetails", {
      path: { ticket_sale_id: saleId },
    });
    expect(detail.ticket_sale?.transaction).toMatchObject({
      payment_status: 4,
      refund_date: "2026-11-01T09:00:00+03:00",
      refund_reason: "Katılımcının talebi üzerine iade edildi",
    });
    const bought = await client.ok("getUserBoughtTicketList", {
      path: { user_id: 1020 },
      query: PAGE,
    });
    expect(
      ids(bought.bought_ticket_list ?? []),
      "a refunded ticket is not bought",
    ).not.toContain(saleId);
    expect(notifications(client)).toEqual([
      { id: saleId, webhook_id: 22, operation: 3, status: 3 },
      { id: saleId, webhook_id: 22, operation: 3, status: 4 },
    ]);
    const again = await simulate(client, "ticket-refund", {
      ticket_sale_id: saleId,
    });
    expect(again.status).toBe(409);
  });

  test("refuses a free sale, a failed sale and an unknown one", async () => {
    const client = quietClient();
    const db = kelder(client);
    const free = db.ticketSales.find(
      (sale) => db.transactions.get(sale.transaction_id)?.amount === 0,
    );
    expect(
      await simulate(client, "ticket-refund", { ticket_sale_id: free?.id }),
    ).toEqual({
      status: 400,
      body: { error: "a free ticket has nothing to refund" },
    });
    const failed = db.ticketSales.find(
      (sale) => db.transactions.get(sale.transaction_id)?.payment_status === 5,
    );
    expect(
      (await simulate(client, "ticket-refund", { ticket_sale_id: failed?.id }))
        .status,
    ).toBe(400);
    expect(
      (await simulate(client, "ticket-refund", { ticket_sale_id: 1 })).status,
    ).toBe(404);
    expect((await simulate(client, "ticket-refund", {})).status).toBe(400);
  });
});

describe("the dues-events simulations", () => {
  test("are listed on the control plane with their inputs", async () => {
    const client = quietClient();
    const response = await client.request("/__mock/simulations");
    const body: unknown = await response.json();
    expect(body).toMatchObject({
      simulations: expect.arrayContaining(
        [
          "membership-due-payment",
          "membership-due-refund",
          "ticket-sale",
          "ticket-refund",
        ].map((name) =>
          expect.objectContaining({
            domain: "dues-events",
            name,
            path: `/__mock/simulations/dues-events/${name}`,
          }),
        ),
      ),
    });
  });
});
