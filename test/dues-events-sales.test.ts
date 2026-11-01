import { describe, expect, test } from "bun:test";

import { createTestClient, type TestClient } from "../src/testing/client";
import {
  collect,
  EVER,
  expectOrdered,
  expectSplit,
  ids,
  kelder,
  PAGE,
  sortedIds,
  type Query,
} from "./dues-events-support";

function sales(client: TestClient, query: Query = {}) {
  return collect(async (start) => {
    const body = await client.ok("getTicketSaleList", {
      query: {
        ...EVER,
        status: "paid",
        ...query,
        start_page: start,
        how_many: 100,
      },
    });
    return { rows: body.sales_list, total: body.total };
  });
}

function salesWithStatus(client: TestClient, status: number) {
  const db = kelder(client);
  return db.ticketSales.list(
    (sale) =>
      db.transactions.get(sale.transaction_id)?.payment_status === status,
  );
}

describe("getTicketSaleList", () => {
  test("lists paid, refunded and failed sales apart", async () => {
    const client = createTestClient();
    for (const [status, code] of [
      ["paid", 3],
      ["refund", 4],
      ["failed", 5],
    ] as const) {
      const listed = await sales(client, { status });
      expect(sortedIds(listed), status).toEqual(
        sortedIds(salesWithStatus(client, code)),
      );
      expect(listed.length, status).toBeGreaterThan(0);
      expect(
        listed.every((sale) => sale.transaction?.payment_status === code),
      ).toBe(true);
    }
    const noStatus = await client.call("getTicketSaleList", {
      query: { ...PAGE, ...EVER },
    });
    expect(noStatus.status, "status is required").toBe(400);
  });

  test("keeps sales inside the date range, or every sale of one event for time_selection 1", async () => {
    const client = createTestClient();
    const all = await sales(client);
    const range = {
      start_date: "2026-10-01T00:00:00+03:00",
      end_date: "2026-11-01T00:00:00+03:00",
    };
    expectSplit(
      all,
      await sales(client, range),
      (sale) => {
        const at = Date.parse(sale.transaction?.complete_date ?? "");
        return (
          at >= Date.parse(range.start_date) && at <= Date.parse(range.end_date)
        );
      },
      "date range",
    );
    const narrow = {
      start_date: "2020-01-01T00:00:00+03:00",
      end_date: "2020-01-02T00:00:00+03:00",
    };
    expect(await sales(client, narrow)).toEqual([]);
    const allTime = await sales(client, {
      ...narrow,
      time_selection: 1,
      event_id: 601,
    });
    expectSplit(
      all,
      allTime,
      (sale) => sale.event?.id === 601,
      "time_selection 1",
    );
    const noEvent = await client.call("getTicketSaleList", {
      query: { ...PAGE, ...narrow, status: "paid", time_selection: 1 },
    });
    expect(noEvent.status).toBe(400);
    expect(noEvent.body).toEqual({
      error: "event_id is required with time_selection 1",
    });
    const reversed = await client.call("getTicketSaleList", {
      query: {
        ...PAGE,
        status: "paid",
        start_date: EVER.end_date,
        end_date: EVER.start_date,
      },
    });
    expect(reversed.status).toBe(400);
  });

  test("filters by event, payment and card details, and buyer text", async () => {
    const client = createTestClient();
    const all = await sales(client);
    expectSplit(
      all,
      await sales(client, { event_id: 604 }),
      (sale) => sale.event?.id === 604,
      "event_id",
    );
    expectSplit(
      all,
      await sales(client, { payment_method: 1 }),
      (sale) => sale.transaction?.payment_method === 1,
      "payment_method",
    );
    expectSplit(
      all,
      await sales(client, { payment_settings_id: 71 }),
      (sale) => sale.transaction?.payment_settings_id === 71,
      "payment_settings_id",
    );
    expectSplit(
      all,
      await sales(client, { amount: 1500, amt_cnd: ">=" }),
      (sale) => (sale.transaction?.amount ?? 0) >= 1500,
      "amount >=",
    );
    expectSplit(
      all,
      await sales(client, { amount: 0 }),
      (sale) => sale.transaction?.amount === 0,
      "amount =",
    );
    expectSplit(
      all,
      await sales(client, { installment_count: 3 }),
      (sale) => sale.transaction?.installment_count === 3,
      "installment_count",
    );
    const card = all.find((sale) => sale.transaction?.bin_number !== undefined);
    expectSplit(
      all,
      await sales(client, {
        bin_number: Number(card?.transaction?.bin_number),
      }),
      (sale) => sale.transaction?.bin_number === card?.transaction?.bin_number,
      "bin_number",
    );
    expectSplit(
      all,
      await sales(client, { last_four: Number(card?.transaction?.last_four) }),
      (sale) =>
        Number(sale.transaction?.last_four) ===
        Number(card?.transaction?.last_four),
      "last_four",
    );
    const buyer = all[0]?.name ?? "";
    expectSplit(
      all,
      await sales(client, { query: buyer }),
      (sale) => sale.name === buyer,
      "query",
    );
    expectSplit(
      all,
      await sales(client, { query: `-${buyer}` }),
      (sale) => sale.name !== buyer,
      "query with a leading minus",
    );
  });

  test("orders by every documented order_by value in both directions and pages", async () => {
    const client = createTestClient();
    const keys = {
      id: (sale: { id?: number }) => sale.id ?? 0,
      transaction__amount: (sale: { transaction?: { amount?: number } }) =>
        sale.transaction?.amount ?? 0,
      transaction__complete_date: (sale: {
        transaction?: { complete_date?: string };
      }) => Date.parse(sale.transaction?.complete_date ?? ""),
    } as const;
    expectOrdered(
      await sales(client),
      keys.transaction__complete_date,
      "desc",
      "default order",
    );
    for (const [field, key] of Object.entries(keys)) {
      expectOrdered(
        await sales(client, { order_by: field }),
        key,
        "asc",
        field,
      );
      expectOrdered(
        await sales(client, { order_by: `-${field}` }),
        key,
        "desc",
        field,
      );
    }
    const all = await sales(client);
    const page = await client.ok("getTicketSaleList", {
      query: { ...EVER, status: "paid", start_page: 2, how_many: 5 },
    });
    expect(ids(page.sales_list ?? [])).toEqual(ids(all.slice(5, 10)));
    expect(page.total).toBe(all.length);
  });
});

describe("getTicketSaleDetails", () => {
  test("returns a member's sale with its event, seats, transaction and mail", async () => {
    const client = createTestClient();
    const db = kelder(client);
    const sale = db.ticketSales.find(
      (row) =>
        row.user_id !== null &&
        row.sent_mail_id !== null &&
        db.soldTickets.count((seat) => seat.ticket_sale_id === row.id) > 1,
    );
    const body = await client.ok("getTicketSaleDetails", {
      path: { ticket_sale_id: sale?.id ?? 0 },
    });
    const member = db.users.get(sale?.user_id ?? 0);
    const permission = db.communicationPermissions.find(
      (row) => row.user_id === member?.id,
    );
    expect(body.ticket_sale).toMatchObject({
      id: sale?.id,
      name: sale?.name,
      email: sale?.email,
      event: { id: sale?.event_id, ticket_types: expect.any(Array) },
      transaction: { id: sale?.transaction_id, payment_status: 3 },
      member: {
        id: member?.id,
        name: `${member?.first_name} ${member?.last_name}`,
        membership_no: member?.membership_no,
        allow_comm_via_email: permission?.allow_comm_via_email,
        allow_comm_via_email_date: permission?.allow_comm_via_email_date,
      },
      sent_mail: { id: sale?.sent_mail_id, status: 2 },
    });
    expect(body.ticket_sale?.sold_tickets).toEqual(
      db.soldTickets
        .list((seat) => seat.ticket_sale_id === sale?.id)
        .map((seat) => ({ id: seat.id })),
    );
  });

  test("returns a guest's sale without a member and a failed sale without a mail", async () => {
    const client = createTestClient();
    const db = kelder(client);
    const guest = db.ticketSales.find((row) => row.user_id === null);
    const body = await client.ok("getTicketSaleDetails", {
      path: { ticket_sale_id: guest?.id ?? 0 },
    });
    expect(body.ticket_sale).not.toHaveProperty("member");
    const failed = salesWithStatus(client, 5)[0];
    const failedBody = await client.ok("getTicketSaleDetails", {
      path: { ticket_sale_id: failed?.id ?? 0 },
    });
    expect(failedBody.ticket_sale).not.toHaveProperty("sent_mail");
    expect(failedBody.ticket_sale?.transaction).toMatchObject({
      payment_status: 5,
      error_code: expect.any(String),
      error_text: expect.any(String),
    });
    const missing = await client.call("getTicketSaleDetails", {
      path: { ticket_sale_id: 1 },
    });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: "Ticket sale not found" });
  });
});

describe("ticket-sale members", () => {
  const MEMBER_1021 = {
    mezuniyet_yili: 2018,
    meslek: "Mühendis",
    sube: "Türkçe-Matematik",
    burs_gonullusu: false,
    ilgi_alanlari: ["Burs", "Kariyer"],
  };

  test("carry the user-defined values getUserDetails returns", async () => {
    const client = createTestClient();
    for (const [saleId, userId, values] of [
      [61001, 1021, MEMBER_1021],
      [61023, 1058, {}],
    ] as const) {
      const details = await client.ok("getUserDetails", {
        path: { user_id: userId },
      });
      expect(details.user?.user_defined_values, `user ${userId}`).toEqual(
        values,
      );
      const sale = await client.ok("getTicketSaleDetails", {
        path: { ticket_sale_id: saleId },
      });
      expect(sale.ticket_sale?.member, `sale ${saleId}`).toMatchObject({
        id: userId,
        user_defined_values: values,
      });
      const listed = (await sales(client)).find((row) => row.id === saleId);
      expect(listed?.member, `listed sale ${saleId}`).toMatchObject({
        id: userId,
        user_defined_values: values,
      });
    }
  });
});

describe("getUserBoughtTicketList", () => {
  test("lists a member's successful purchases, newest first", async () => {
    const client = createTestClient();
    const db = kelder(client);
    const counts = new Map<number, number>();
    for (const sale of db.ticketSales.list((row) => row.user_id !== null)) {
      counts.set(sale.user_id ?? 0, (counts.get(sale.user_id ?? 0) ?? 0) + 1);
    }
    const [userId] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [0];
    const body = await client.ok("getUserBoughtTicketList", {
      path: { user_id: userId },
      query: PAGE,
    });
    const expected = db.ticketSales.list(
      (sale) =>
        sale.user_id === userId &&
        db.transactions.get(sale.transaction_id)?.payment_status === 3,
    );
    expect(sortedIds(body.bought_ticket_list ?? [])).toEqual(
      sortedIds(expected),
    );
    expect(body.total).toBe(expected.length);
    const first = body.bought_ticket_list?.[0];
    const sale = db.ticketSales.get(first?.id ?? 0);
    const tx = db.transactions.get(sale?.transaction_id ?? 0);
    const event = db.events.get(sale?.event_id ?? 0);
    expect(first).toEqual({
      id: sale?.id,
      event_id: event?.id,
      transaction__amount: tx?.amount,
      transaction__complete_date: tx?.complete_date,
      event__name: event?.name,
      transaction__fonzip_id_hashed: tx?.fonzip_id_hashed,
      event__url: event?.url,
    });
    const dates = (body.bought_ticket_list ?? []).map((row) =>
      Date.parse(row.transaction__complete_date ?? ""),
    );
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
    const page = await client.ok("getUserBoughtTicketList", {
      path: { user_id: userId },
      query: { start_page: 2, how_many: 1 },
    });
    expect(ids(page.bought_ticket_list ?? [])).toEqual(
      ids((body.bought_ticket_list ?? []).slice(1, 2)),
    );
  });

  test("answers 404 for an unknown user", async () => {
    const client = createTestClient();
    const missing = await client.call("getUserBoughtTicketList", {
      path: { user_id: 99 },
      query: PAGE,
    });
    expect(missing.status).toBe(404);
  });
});
