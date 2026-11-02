import { describe, expect, test } from "bun:test";

import {
  campaign,
  client,
  day,
  donation,
  duesPayment,
  ecardSale,
  formAnswer,
  kelder,
  monthly,
  noon,
  note,
  person,
  ticketSale,
} from "./people-fixtures";

const PAGE = { start_page: 1, how_many: 100 };

describe("getUsersTimeline", () => {
  test("derives events from the user's donations, dues, tickets, forms, e-cards and campaigns, newest first", async () => {
    const shared = client();
    const db = kelder(shared);
    const userId = person(db, "zaman");
    db.users.update(userId, { join_date: noon(day(-90)) });
    donation(
      db,
      userId,
      { amount: 750, at: day(-80) },
      { sub_donation_type_id: 202 },
    );
    donation(db, userId, { amount: 50, at: day(-79), status: 5 });
    monthly(db, userId, { amount: 200, at: day(-70) });
    duesPayment(
      db,
      userId,
      { amount: 1500, at: day(-60) },
      { period: "2026-01-01" },
    );
    ticketSale(db, userId, { eventId: 602 });
    ticketSale(db, userId, { eventId: 601 });
    formAnswer(db, userId, { formId: 702, at: day(-40) });
    ecardSale(db, userId, { certificate_id: 952 }, { at: day(-30) });
    campaign(db, userId, {
      title: "Zaman Burs",
      status: 3,
      activation_date: noon(day(-50)),
      finish_date: noon(day(-20)),
    });
    note(db, userId, {
      details: "Arandı",
      at: day(-10),
      tagId: 103,
      issuerId: 1002,
    });
    const body = await shared.ok("getUsersTimeline", {
      path: { user_id: userId },
      query: { ...PAGE, require_total: true },
    });
    const events = body.timeline ?? [];
    expect(events.map((event) => [event.event_type, event.details])).toEqual([
      [7, "Arandı"],
      [12, "Zaman Burs kampanyası tamamlandı"],
      [15, "Mezuniyet Tebrik Kartı satın aldı"],
      [14, "Gönüllü Kayıt Formu formunu doldurdu"],
      [2, "Kariyer Buluşması etkinliğine katıldı"],
      [11, "Zaman Burs kampanyasını başlattı"],
      [10, "2026 aidatı ödendi: 1.500 TRY"],
      [17, "Düzenli bağışçı oldu: aylık 200 TRY"],
      [6, "Düzenli bağış çekimi: 200 TRY"],
      [5, "750 TRY bağış yaptı (Burs Fonu)"],
      [0, "Derneğe katıldı"],
    ]);
    expect(body.total).toBe(events.length);
    expect(events[0]).toMatchObject({
      issuer__first_name: kelder(shared).users.get(1002)?.first_name,
      tag_id: 103,
      tag__name: "Yönetim Kurulu",
      tag__color: "tag-3",
      custom_date: false,
    });
    expect(
      events.some((event) => event.details?.includes("Mezunlar Gecesi")),
      "an event that has not started yet was not attended",
    ).toBe(false);
  });

  test("lists notes only, filters them by tag, pages, and returns total only on request", async () => {
    const shared = client();
    const db = kelder(shared);
    const userId = person(db, "notlar");
    note(db, userId, { details: "Bir", at: day(-3), tagId: 101 });
    note(db, userId, { details: "İki", at: day(-2) });
    note(db, userId, { details: "Üç", at: day(-1), tagId: 101 });
    note(db, userId, { details: "Güncelleme", at: day(0), eventType: 1 });
    const page = (query: Record<string, number | boolean>) =>
      shared.ok("getUsersTimeline", {
        path: { user_id: userId },
        query: { ...PAGE, ...query },
      });
    const notes = await page({ notes_only: true, require_total: true });
    expect(notes.timeline?.map((event) => event.details)).toEqual([
      "Üç",
      "İki",
      "Bir",
    ]);
    expect(notes.total).toBe(3);
    const tagged = await page({ notes_only: true, tag_id: 101 });
    expect(tagged.timeline?.map((event) => event.details)).toEqual([
      "Üç",
      "Bir",
    ]);
    expect(
      tagged.total,
      "total only when require_total is true",
    ).toBeUndefined();
    const ignored = await page({ tag_id: 101 });
    expect(ignored.timeline?.length, "tag_id needs notes_only").toBe(4);
    const second = await page({
      start_page: 2,
      how_many: 3,
      require_total: true,
    });
    expect(second.timeline?.map((event) => event.details)).toEqual(["Bir"]);
    expect(second.total).toBe(4);
  });

  test("returns acquisition leads with their namespaced id and lead fields, and 404 for an unknown user", async () => {
    const shared = client();
    const db = kelder(shared);
    const lead = db.timeline.find(
      (row) =>
        row.event_type === 27 &&
        row.amount !== null &&
        row.added_by_id !== null,
    );
    if (!lead) throw new Error("no seeded lead with an operator");
    const body = await shared.ok("getUsersTimeline", {
      path: { user_id: lead.user_id },
      query: PAGE,
    });
    const found = body.timeline?.find(
      (event) => event.id === `lead-${lead.id}`,
    );
    expect(found).toMatchObject({
      event_type: 27,
      lead_type: lead.lead_type,
      outcome: lead.outcome,
      sequence_no: lead.sequence_no,
      is_first_touch: lead.is_first_touch,
      amount: lead.amount,
      currency__display: "TRY",
      added_by__name: "Umut Korkmaz",
    });
    const interest = db.timeline.find(
      (row) => row.event_type === 27 && row.amount === null,
    );
    if (!interest) throw new Error("no seeded interest-only lead");
    const interestBody = await shared.ok("getUsersTimeline", {
      path: { user_id: interest.user_id },
      query: PAGE,
    });
    expect(
      interestBody.timeline?.find(
        (event) => event.id === `lead-${interest.id}`,
      ),
    ).toMatchObject({ amount: null, currency__display: null });
    const missing = await shared.call("getUsersTimeline", {
      path: { user_id: 99 },
      query: PAGE,
    });
    expect(missing.status).toBe(404);
  });

  // Production sends every note field on a non-lead event, null when empty,
  // and none of the lead fields. A lead carries its own fields instead.
  const NOTE_KEYS = [
    "calendarevent__completed",
    "calendarevent__date",
    "calendarevent__id",
    "calendarevent__note",
    "custom_date",
    "details",
    "event_time",
    "event_type",
    "id",
    "issuer__first_name",
    "issuer__last_name",
    "pinned",
    "tag__color",
    "tag__name",
    "tag_id",
  ];
  const LEAD_KEYS = [
    "added_by__name",
    "amount",
    "currency__display",
    "details",
    "event_time",
    "event_type",
    "id",
    "is_first_touch",
    "issuer__first_name",
    "issuer__last_name",
    "lead_type",
    "outcome",
    "pinned",
    "sequence_no",
  ];

  test("a non-lead event carries every note field, null when empty, and no lead field", async () => {
    const shared = client();
    const db = kelder(shared);
    const calendar = db.timeline.find(
      (row) => row.event_type === 7 && row.calendar_event !== null,
    );
    const tagged = db.timeline.find(
      (row) => row.event_type === 7 && row.tag_id !== null,
    );
    if (!calendar?.calendar_event || !tagged)
      throw new Error("no seeded notes");
    const eventsOf = async (userId: number) =>
      (
        await shared.ok("getUsersTimeline", {
          path: { user_id: userId },
          query: PAGE,
        })
      ).timeline ?? [];
    const withCalendar = (await eventsOf(calendar.user_id)).find(
      (event) => event.id === calendar.id,
    );
    expect(Object.keys(withCalendar ?? {}).sort()).toEqual(NOTE_KEYS);
    expect(withCalendar).toMatchObject({
      calendarevent__id: calendar.calendar_event.id,
      calendarevent__note: calendar.calendar_event.note,
      calendarevent__date: calendar.calendar_event.date,
      calendarevent__completed: calendar.calendar_event.completed,
      tag_id: null,
      tag__name: null,
      tag__color: null,
      pinned: false,
    });
    const withTag = (await eventsOf(tagged.user_id)).find(
      (event) => event.id === tagged.id,
    );
    expect(Object.keys(withTag ?? {}).sort()).toEqual(NOTE_KEYS);
    expect(withTag?.tag_id).toBe(tagged.tag_id);
    expect(withTag?.tag__name).toEqual(expect.any(String));
    expect(withTag?.tag__color).toEqual(expect.stringMatching(/^tag-[1-8]$/));
    expect(withTag?.calendarevent__id).toBeNull();
    // A derived event has no stored row, so every note field is null.
    const joined = (await eventsOf(tagged.user_id)).find(
      (event) => event.event_type === 0,
    );
    expect(Object.keys(joined ?? {}).sort()).toEqual(NOTE_KEYS);
    expect(joined).toMatchObject({
      issuer__first_name: null,
      issuer__last_name: null,
      calendarevent__id: null,
      calendarevent__note: null,
      calendarevent__date: null,
      calendarevent__completed: null,
      tag_id: null,
      tag__name: null,
      tag__color: null,
      custom_date: false,
      pinned: false,
    });
  });

  test("a lead carries its own fields, with no issuer, no details and none of the note fields", async () => {
    const shared = client();
    const db = kelder(shared);
    const lead = db.timeline.find(
      (row) => row.event_type === 27 && row.added_by_id !== null,
    );
    if (!lead) throw new Error("no seeded lead with an operator");
    const body = await shared.ok("getUsersTimeline", {
      path: { user_id: lead.user_id },
      query: PAGE,
    });
    const found = body.timeline?.find(
      (event) => event.id === `lead-${lead.id}`,
    );
    expect(Object.keys(found ?? {}).sort()).toEqual(LEAD_KEYS);
    expect(found).toMatchObject({
      details: null,
      issuer__first_name: null,
      issuer__last_name: null,
      pinned: false,
    });
    expect(typeof found?.id, "a lead id is a string").toBe("string");
    for (const event of body.timeline ?? []) {
      expect(
        Object.keys(event).sort(),
        `event ${event.id} is a lead or a note`,
      ).toEqual(event.event_type === 27 ? LEAD_KEYS : NOTE_KEYS);
    }
  });

  test("the newest user has a lead and plain events, as the user production showed did", async () => {
    const shared = client();
    const db = kelder(shared);
    const newest = Math.max(...db.users.list().map((user) => user.id));
    const body = await shared.ok("getUsersTimeline", {
      path: { user_id: newest },
      query: PAGE,
    });
    const events = body.timeline ?? [];
    const leads = events.filter((event) => event.event_type === 27);
    expect(leads).toHaveLength(1);
    expect(leads[0]).toEqual({
      id: expect.stringMatching(/^lead-\d+$/),
      details: null,
      event_time: expect.any(String),
      event_type: 27,
      issuer__first_name: null,
      issuer__last_name: null,
      pinned: false,
      lead_type: 4,
      outcome: 0,
      sequence_no: 1,
      is_first_touch: true,
      amount: null,
      currency__display: null,
      added_by__name: null,
    });
    const plain = events.filter((event) => event.event_type !== 27);
    expect(plain.length).toBeGreaterThan(2);
    for (const event of plain) {
      expect(event.calendarevent__id).toBeNull();
      expect(event.tag_id).toBeNull();
      expect(event.issuer__first_name).toBeNull();
    }
  });
});
