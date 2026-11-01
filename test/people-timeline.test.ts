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
});
