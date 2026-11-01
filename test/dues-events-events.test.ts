import { describe, expect, test } from "bun:test";

import { createTestClient, type TestClient } from "../src/testing/client";
import {
  expectOrdered,
  expectSplit,
  ids,
  kelder,
  PAGE,
  type Query,
} from "./dues-events-support";

async function events(client: TestClient, query: Query = {}) {
  const body = await client.ok("getEventList", {
    query: { ...PAGE, ...query },
  });
  return body.event_list ?? [];
}

function soldOracle(client: TestClient, ticketId: number): number {
  const db = kelder(client);
  return db.soldTickets.count((seat) => {
    const sale = db.ticketSales.get(seat.ticket_sale_id);
    return (
      seat.ticket_id === ticketId &&
      db.transactions.get(sale?.transaction_id ?? 0)?.payment_status === 3
    );
  });
}

const SPRING = {
  name: "Bahar Şenliği",
  start_date: "2027-04-10T12:00:00+03:00",
  end_date: "2027-04-10T18:00:00+03:00",
};

describe("getEventList", () => {
  test("lists the events that are not archived, by start date", async () => {
    const client = createTestClient();
    const listed = await events(client);
    expect(ids(listed)).toEqual([604, 602, 605, 601, 603]);
    expect(listed.find((event) => event.id === 601)).toEqual({
      id: 601,
      url: "https://kelder.example/etkinlik/1-mezunlar-gecesi-2026",
      name: "Mezunlar Gecesi 2026",
      start_date: "2026-11-21T09:00:00+03:00",
      end_date: "2026-11-21T13:00:00+03:00",
      all_day: false,
      active: true,
      timezone: "Europe/Istanbul",
      create_date: "2026-09-22T09:00:00+03:00",
      created_by_id: 1001,
      created_by__name: "Umut Korkmaz",
      update_date: "2026-10-02T09:00:00+03:00",
      updated_by_id: 1002,
      updated_by__name: "Hüseyin Korkmaz",
    });
    const archived = await events(client, { archived: "true" });
    expect(ids(archived)).toEqual([606]);
    expect(archived[0]).toMatchObject({
      archived_by_id: 1001,
      archived_by__name: "Umut Korkmaz",
      archive_date: "2026-02-04T09:00:00+03:00",
    });
  });

  test("splits past and upcoming events at the current time", async () => {
    const client = createTestClient();
    const all = await events(client, { target: "a" });
    const now = Date.parse("2026-11-01T09:00:00+03:00");
    expectSplit(
      all,
      await events(client, { target: "p" }),
      (event) => Date.parse(event.end_date ?? "") < now,
      "past",
    );
    expectSplit(
      all,
      await events(client, { target: "u" }),
      (event) => Date.parse(event.end_date ?? "") >= now,
      "upcoming",
    );
    client.mock.runtime.clock.advance(6 * 86_400_000);
    const later = await client.ok("getEventList", {
      token: await client.token(),
      query: { ...PAGE, target: "u" },
    });
    expect(ids(later.event_list ?? []), "six days later").not.toContain(605);
  });

  test("searches names and excludes matches with a leading minus", async () => {
    const client = createTestClient();
    const all = await events(client);
    expectSplit(
      all,
      await events(client, { query: "turu" }),
      (event) => event.id === 604,
      "query",
    );
    expectSplit(
      all,
      await events(client, { query: "-turu" }),
      (event) => event.id !== 604,
      "query with a leading minus",
    );
  });

  test("orders by every documented order_by value in both directions and pages", async () => {
    const client = createTestClient();
    const keys = {
      start_date: (event: { start_date?: string }) =>
        Date.parse(event.start_date ?? ""),
      name: (event: { name?: string }) => event.name ?? "",
      id: (event: { id?: number }) => event.id ?? 0,
    } as const;
    for (const [field, key] of Object.entries(keys)) {
      expectOrdered(
        await events(client, { order_by: field }),
        key,
        "asc",
        field,
      );
      expectOrdered(
        await events(client, { order_by: `-${field}` }),
        key,
        "desc",
        field,
      );
    }
    const page = await client.ok("getEventList", {
      query: { start_page: 2, how_many: 2 },
    });
    expect(ids(page.event_list ?? [])).toEqual([605, 601]);
    expect(page.total).toBe(5);
  });
});

describe("getEventDetails", () => {
  test("returns an event with its tickets in order and their sold counts", async () => {
    const client = createTestClient();
    const body = await client.ok("getEventDetails", {
      path: { event_id: 601 },
    });
    expect(body.event).toMatchObject({
      id: 601,
      name: "Mezunlar Gecesi 2026",
      paid_event: true,
      payment_settings_id: 71,
      sender_account_id: 81,
      active: true,
      max_installment: 3,
      send_reminder: true,
      ask_billing_info: true,
      location: 0,
      venue: 0,
    });
    expect(
      body.event?.ticket_types?.map((ticket) => [ticket.id, ticket.order]),
    ).toEqual([
      [6101, 1],
      [6102, 2],
      [6103, 3],
    ]);
    for (const ticket of body.event?.ticket_types ?? []) {
      expect(ticket.sold, `ticket ${ticket.id}`).toBe(
        soldOracle(client, ticket.id ?? 0),
      );
    }
    expect(
      body.event?.ticket_types?.[1]?.sold,
      "refunded and failed sales do not count",
    ).toBeLessThan(
      kelder(client).soldTickets.count((seat) => seat.ticket_id === 6102),
    );
    expect(body.event?.ticket_types?.[1]).toMatchObject({
      tag_control: 1,
      tags_to_control: [103],
    });
    const online = await client.ok("getEventDetails", {
      path: { event_id: 605 },
    });
    expect(online.event).toMatchObject({
      location: 1,
      venue: 1,
      paid_event: false,
      active: false,
    });
    expect(online.event).not.toHaveProperty("payment_settings_id");
  });

  test("answers 404 for an unknown event", async () => {
    const client = createTestClient();
    const response = await client.call("getEventDetails", {
      path: { event_id: 1 },
    });
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Event not found" });
  });
});

describe("createEvent", () => {
  test("creates an event that the list and the detail show, with the tickets it names", async () => {
    const client = createTestClient();
    const ticket = await client.ok("createTicket", {
      body: { title: "Erken Kayıt", price: 300 },
    });
    const second = await client.ok("createTicket", {
      body: { title: "Kapıda", price: 400 },
    });
    const created = await client.ok("createEvent", {
      body: {
        ...SPRING,
        details: "Bahçede piknik",
        address: "Okul bahçesi",
        paid_event: true,
        payment_settings_id: 72,
        sender_account_id: 81,
        image: "https://kelder.example/media/bahar.jpg",
        max_installment: 2,
        send_reminder: true,
        ask_billing_info: true,
        location: 0,
        venue: 0,
        ticket_types: [{ id: second.ticket?.id }, { id: ticket.ticket?.id }],
      },
    });
    expect(created).toEqual({ result: "ok", event_id: expect.any(Number) });
    const eventId = created.event_id ?? 0;
    const detail = await client.ok("getEventDetails", {
      path: { event_id: eventId },
    });
    expect(detail.event).toMatchObject({
      id: eventId,
      name: "Bahar Şenliği",
      url: `https://kelder.example/etkinlik/${eventId}-bahar-senligi`,
      details: "Bahçede piknik",
      payment_settings_id: 72,
      sender_account_id: 81,
      image: "https://kelder.example/media/bahar.jpg",
      max_installment: 2,
      active: true,
      all_day: false,
    });
    expect(
      detail.event?.ticket_types?.map((row) => [row.id, row.order]),
    ).toEqual([
      [second.ticket?.id, 1],
      [ticket.ticket?.id, 2],
    ]);
    const listed = (await events(client)).find((event) => event.id === eventId);
    expect(listed).toMatchObject({
      name: "Bahar Şenliği",
      create_date: "2026-11-01T09:00:00+03:00",
    });
    expect(listed, "created through the API").not.toHaveProperty(
      "created_by_id",
    );
    const plain = await client.ok("createEvent", {
      body: { ...SPRING, url: "https://kelder.example/e/1", all_day: true },
    });
    const plainDetail = await client.ok("getEventDetails", {
      path: { event_id: plain.event_id ?? 0 },
    });
    expect(plainDetail.event).toMatchObject({
      url: "https://kelder.example/e/1",
      all_day: true,
      paid_event: false,
      ticket_types: [],
    });
    expect(plainDetail.event).not.toHaveProperty("image");
  });

  test("refuses a ticket already used by another event and unknown references", async () => {
    const client = createTestClient();
    const cases = [
      [
        { ...SPRING, ticket_types: [{ id: 6101 }] },
        400,
        "Ticket 6101 is already used by event 601; a ticket cannot be used in multiple events",
      ],
      [{ ...SPRING, ticket_types: [{ id: 9 }] }, 404, "Ticket 9 not found"],
      [{ ...SPRING, payment_settings_id: 9 }, 404, "Payment system not found"],
      [{ ...SPRING, sender_account_id: 9 }, 404, "Sender account not found"],
      [
        { ...SPRING, paid_event: true },
        400,
        "A paid event needs a payment_settings_id",
      ],
      [
        { start_date: SPRING.start_date, end_date: SPRING.end_date },
        400,
        "name is required",
      ],
      [{ name: "x" }, 400, "start_date and end_date are required"],
      [
        { ...SPRING, end_date: "2027-04-09T12:00:00+03:00" },
        400,
        "end_date must not be before start_date",
      ],
    ] as const;
    const before = kelder(client).events.count();
    for (const [body, status, error] of cases) {
      const response = await client.call("createEvent", { body });
      expect(response.status, error).toBe(status);
      expect(response.body).toEqual({ error });
    }
    expect(kelder(client).events.count(), "nothing was written").toBe(before);
    const badImage = await client.call("createEvent", {
      body: { ...SPRING, image: "resim" },
    });
    expect(badImage.status, "image must be a url").toBe(400);
  });
});

describe("updateEvent", () => {
  test("updates the fields it is sent and keeps the rest", async () => {
    const client = createTestClient();
    client.mock.runtime.clock.advance(3_600_000);
    const updated = await client.ok("updateEvent", {
      path: { event_id: 603 },
      body: {
        name: "Burs Ödül Gecesi",
        details: "Yeni saat",
        end_date: "2026-12-16T22:00:00+03:00",
      },
    });
    expect(updated).toEqual({ result: "ok" });
    const detail = await client.ok("getEventDetails", {
      path: { event_id: 603 },
    });
    expect(detail.event).toMatchObject({
      name: "Burs Ödül Gecesi",
      details: "Yeni saat",
      start_date: "2026-12-16T09:00:00+03:00",
      end_date: "2026-12-16T22:00:00+03:00",
      address: "Kabataş Erkek Lisesi Konferans Salonu, Ortaköy/İstanbul",
    });
    const listed = (await events(client)).find((event) => event.id === 603);
    expect(listed).toMatchObject({ update_date: "2026-11-01T10:00:00+03:00" });
    expect(listed).not.toHaveProperty("updated_by_id");
  });

  test("updates every documented field", async () => {
    const client = createTestClient();
    const body = {
      name: "Burs Ödül Töreni 2026",
      url: "https://kelder.example/etkinlik/burs-2026",
      venue: 1,
      address: "Çevrimiçi",
      details: "Canlı yayın",
      paid_event: true,
      payment_settings_id: 72,
      image: "https://kelder.example/media/burs.jpg",
      start_date: "2026-12-17T19:00:00+03:00",
      all_day: true,
      end_date: "2026-12-17T21:00:00+03:00",
      max_installment: 6,
      send_reminder: false,
      ask_billing_info: true,
      location: 1,
      sender_account_id: 82,
    } as const;
    await client.ok("updateEvent", { path: { event_id: 603 }, body });
    const detail = await client.ok("getEventDetails", {
      path: { event_id: 603 },
    });
    expect(detail.event).toMatchObject({ id: 603, ...body });
  });

  test("replaces the event's tickets, freeing the ones it drops", async () => {
    const client = createTestClient();
    const fresh = await client.ok("createTicket", {
      body: { title: "Davetli", price: 0 },
    });
    await client.ok("updateEvent", {
      path: { event_id: 603 },
      body: { ticket_types: [{ id: fresh.ticket?.id }] },
    });
    const detail = await client.ok("getEventDetails", {
      path: { event_id: 603 },
    });
    expect(detail.event?.ticket_types?.map((ticket) => ticket.id)).toEqual([
      fresh.ticket?.id,
    ]);
    const dropped = await client.ok("getTicketDetails", {
      path: { ticket_id: 6105 },
    });
    expect(dropped.ticket?.order, "the dropped ticket is free again").toBe(0);
    const reused = await client.ok("updateEvent", {
      path: { event_id: 605 },
      body: { ticket_types: [{ id: 6108 }, { id: 6105 }] },
    });
    expect(reused.result).toBe("ok");
  });

  test("refuses to drop a ticket with sales or take another event's ticket", async () => {
    const client = createTestClient();
    const dropSold = await client.call("updateEvent", {
      path: { event_id: 601 },
      body: { ticket_types: [{ id: 6101 }] },
    });
    expect(dropSold.status).toBe(400);
    expect(dropSold.body).toEqual({
      error: "Ticket 6102 has sales and cannot leave the event",
    });
    const steal = await client.call("updateEvent", {
      path: { event_id: 603 },
      body: { ticket_types: [{ id: 6105 }, { id: 6101 }] },
    });
    expect(steal.status).toBe(400);
    const detail = await client.ok("getEventDetails", {
      path: { event_id: 601 },
    });
    expect(detail.event?.ticket_types).toHaveLength(3);
    const reversed = await client.call("updateEvent", {
      path: { event_id: 603 },
      body: { end_date: "2026-01-01T00:00:00+03:00" },
    });
    expect(reversed.status).toBe(400);
    const missing = await client.call("updateEvent", {
      path: { event_id: 1 },
      body: { name: "x" },
    });
    expect(missing.status).toBe(404);
  });
});

describe("updateEventStatus", () => {
  test("turns an event passive and active again", async () => {
    const client = createTestClient();
    await client.ok("updateEventStatus", {
      path: { event_id: 601 },
      body: { active: false },
    });
    expect(
      (await events(client)).find((event) => event.id === 601)?.active,
    ).toBe(false);
    await client.ok("updateEventStatus", {
      path: { event_id: 605 },
      body: { active: true },
    });
    const detail = await client.ok("getEventDetails", {
      path: { event_id: 605 },
    });
    expect(detail.event?.active).toBe(true);
    const missing = await client.call("updateEventStatus", {
      path: { event_id: 601 },
      body: {},
    });
    expect(missing.status).toBe(400);
    const unknown = await client.call("updateEventStatus", {
      path: { event_id: 1 },
      body: { active: true },
    });
    expect(unknown.status).toBe(404);
  });
});

describe("deleteEvent", () => {
  test("deletes an event without sales together with its tickets", async () => {
    const client = createTestClient();
    const deleted = await client.ok("deleteEvent", { path: { event_id: 603 } });
    expect(deleted).toEqual({ result: "ok" });
    const gone = await client.call("getEventDetails", {
      path: { event_id: 603 },
    });
    expect(gone.status).toBe(404);
    expect(ids(await events(client))).not.toContain(603);
    const ticket = await client.call("getTicketDetails", {
      path: { ticket_id: 6105 },
    });
    expect(ticket.status).toBe(404);
  });

  test("refuses an event with sales and answers 404 for an unknown one", async () => {
    const client = createTestClient();
    const sold = await client.call("deleteEvent", { path: { event_id: 601 } });
    expect(sold.status).toBe(400);
    expect(sold.body).toEqual({
      error: "An event with ticket sales cannot be deleted",
    });
    expect(ids(await events(client))).toContain(601);
    const unknown = await client.call("deleteEvent", { path: { event_id: 1 } });
    expect(unknown.status).toBe(404);
  });
});

describe("tickets", () => {
  test("returns a seeded ticket with the seats its successful sales hold", async () => {
    const client = createTestClient();
    const body = await client.ok("getTicketDetails", {
      path: { ticket_id: 6101 },
    });
    expect(body.ticket).toEqual({
      id: 6101,
      title: "Standart",
      sold: soldOracle(client, 6101),
      quantity: 120,
      price: 1500,
      ticket_type: "paid",
      details: "Akşam yemeği dahildir.",
      post_sale_message: "Biletiniz e-posta adresinize gönderildi.",
      sales_start_on_date: true,
      sales_start: "2026-09-22T09:00:00+03:00",
      sales_end_on_date: true,
      sales_end: "2026-11-21T09:00:00+03:00",
      max_per_person: 4,
      order: 1,
      tag_control: 0,
      tags_to_control: [],
      member_with_no_debt: false,
      related_with_no_debt: false,
    });
    const missing = await client.call("getTicketDetails", {
      path: { ticket_id: 1 },
    });
    expect(missing.status).toBe(404);
  });

  test("creates a ticket outside any event, with documented defaults", async () => {
    const client = createTestClient();
    const created = await client.ok("createTicket", {
      body: {
        title: " VIP Masa ",
        price: 5000,
        details: "Sahne önü",
        post_sale_message: "Görüşmek üzere",
        sales_start_on_date: true,
        sales_start: "2026-11-02T09:00:00+03:00",
        sales_end_on_date: true,
        sales_end: "2026-11-20T09:00:00+03:00",
        max_per_person: 2,
        tag_control: 2,
        tags_to_control: [103, 101],
        member_with_no_debt: true,
        related_with_no_debt: true,
      },
    });
    expect(created.ticket).toEqual({
      id: expect.any(Number),
      title: "VIP Masa",
      sold: 0,
      quantity: 0,
      price: 5000,
      ticket_type: "paid",
      details: "Sahne önü",
      post_sale_message: "Görüşmek üzere",
      sales_start_on_date: true,
      sales_start: "2026-11-02T09:00:00+03:00",
      sales_end_on_date: true,
      sales_end: "2026-11-20T09:00:00+03:00",
      max_per_person: 2,
      order: 0,
      tag_control: 2,
      tags_to_control: [103, 101],
      member_with_no_debt: true,
      related_with_no_debt: true,
    });
    const fetched = await client.ok("getTicketDetails", {
      path: { ticket_id: created.ticket?.id ?? 0 },
    });
    expect(fetched.ticket).toEqual(created.ticket);
    const free = await client.ok("createTicket", {
      body: { title: "Ücretsiz" },
    });
    expect(free.ticket).toMatchObject({
      price: 0,
      ticket_type: "free",
      sales_start_on_date: false,
      sales_end_on_date: false,
      max_per_person: 0,
    });
    expect(free.ticket).not.toHaveProperty("sales_start");
  });

  test("refuses inconsistent prices, sale dates and tag rules", async () => {
    const client = createTestClient();
    const cases = [
      [
        { title: "x", price: 100, ticket_type: "free" },
        400,
        "A free ticket has no price",
      ],
      [
        { title: "x", ticket_type: "paid" },
        400,
        "A paid ticket needs a price above 0",
      ],
      [{ title: "x", price: -1 }, 400, "price must not be negative"],
      [
        { title: "x", sales_start_on_date: true },
        400,
        "sales_start is required with sales_start_on_date",
      ],
      [
        { title: "x", sales_end_on_date: true },
        400,
        "sales_end is required with sales_end_on_date",
      ],
      [
        {
          title: "x",
          sales_start_on_date: true,
          sales_start: "2026-11-10T00:00:00+03:00",
          sales_end_on_date: true,
          sales_end: "2026-11-09T00:00:00+03:00",
        },
        400,
        "sales_end must be after sales_start",
      ],
      [
        { title: "x", max_per_person: -2 },
        400,
        "max_per_person must not be negative",
      ],
      [
        { title: "x", tag_control: 1 },
        400,
        "tag_control needs tags_to_control",
      ],
      [{ title: "x", tags_to_control: [99] }, 404, "Tag 99 not found"],
      [{ title: "   " }, 400, "title must not be empty"],
    ] as const;
    for (const [body, status, error] of cases) {
      const response = await client.call("createTicket", { body });
      expect(response.status, error).toBe(status);
      expect(response.body).toEqual({ error });
    }
    const untitled = await client.call("createTicket", { body: { price: 1 } });
    expect(untitled.status, "title is required").toBe(400);
  });

  test("updates a ticket, keeping the fields it is not sent and its sold count", async () => {
    const client = createTestClient();
    const sold = soldOracle(client, 6101);
    const updated = await client.ok("updateTicket", {
      path: { ticket_id: 6101 },
      body: {
        title: "Standart Bilet",
        price: 1750,
        details: "Yemek ve içecek dahil",
      },
    });
    expect(updated.ticket).toMatchObject({
      id: 6101,
      title: "Standart Bilet",
      price: 1750,
      details: "Yemek ve içecek dahil",
      ticket_type: "paid",
      sold,
      quantity: 120,
      max_per_person: 4,
      order: 1,
      sales_end: "2026-11-21T09:00:00+03:00",
    });
    const event = await client.ok("getEventDetails", {
      path: { event_id: 601 },
    });
    expect(event.event?.ticket_types?.[0]?.title).toBe("Standart Bilet");
    const toFree = await client.ok("updateTicket", {
      path: { ticket_id: 6104 },
      body: { title: "Ücretsiz Katılım", sales_end_on_date: false },
    });
    expect(toFree.ticket).toMatchObject({
      ticket_type: "free",
      sales_end_on_date: false,
    });
    expect(toFree.ticket).not.toHaveProperty("sales_end");
    const invalid = await client.call("updateTicket", {
      path: { ticket_id: 6101 },
      body: { title: "x", ticket_type: "free" },
    });
    expect(invalid.status, "a priced ticket cannot turn free").toBe(400);
    const missing = await client.call("updateTicket", {
      path: { ticket_id: 1 },
      body: { title: "x" },
    });
    expect(missing.status).toBe(404);
  });

  test("updates every documented ticket field", async () => {
    const client = createTestClient();
    const body = {
      title: "Öğrenci İndirimli",
      price: 500,
      ticket_type: "paid",
      details: "Öğrenci belgesi gerekir",
      post_sale_message: "Kapıda belgenizi gösterin",
      sales_start_on_date: true,
      sales_start: "2026-10-01T09:00:00+03:00",
      sales_end_on_date: true,
      sales_end: "2026-11-20T09:00:00+03:00",
      max_per_person: 1,
      tag_control: 1,
      tags_to_control: [104, 105],
      member_with_no_debt: false,
      related_with_no_debt: true,
    } as const;
    const updated = await client.ok("updateTicket", {
      path: { ticket_id: 6103 },
      body,
    });
    expect(updated.ticket).toMatchObject({
      id: 6103,
      ...body,
      order: 3,
      quantity: 120,
    });
    const fetched = await client.ok("getTicketDetails", {
      path: { ticket_id: 6103 },
    });
    expect(fetched.ticket).toEqual(updated.ticket);
  });

  test("deletes a ticket without sales and refuses one with sales", async () => {
    const client = createTestClient();
    const deleted = await client.ok("deleteTicket", {
      path: { ticket_id: 6105 },
    });
    expect(deleted).toEqual({ result: "ok" });
    const gone = await client.call("getTicketDetails", {
      path: { ticket_id: 6105 },
    });
    expect(gone.status).toBe(404);
    const event = await client.ok("getEventDetails", {
      path: { event_id: 603 },
    });
    expect(event.event?.ticket_types).toEqual([]);
    const sold = await client.call("deleteTicket", {
      path: { ticket_id: 6101 },
    });
    expect(sold.status).toBe(400);
    expect(sold.body).toEqual({
      error: "A ticket with sales cannot be deleted",
    });
    const missing = await client.call("deleteTicket", {
      path: { ticket_id: 6105 },
    });
    expect(missing.status).toBe(404);
  });
});
