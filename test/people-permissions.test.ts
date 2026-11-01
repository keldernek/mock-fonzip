import { describe, expect, test } from "bun:test";

import { client, kelder, leaf, matchingIds } from "./people-fixtures";

const PAGE = { start_page: 1, how_many: 10 };

describe("getCommunicationPermissions", () => {
  test("finds a permission record by email, case-insensitively, and by E.164 phone for sms and phone", async () => {
    const shared = client();
    const db = kelder(shared);
    const record = db.communicationPermissions.find(
      (row) => row.user_id === 1010,
    );
    if (!record) throw new Error("no permission for 1010");
    const byEmail = await shared.ok("getCommunicationPermissions", {
      path: {
        permission_type: "email",
        permission_value: record.email.toLocaleUpperCase("en"),
      },
    });
    expect(byEmail).toEqual({
      total: 1,
      permission_list: {
        id: 1010,
        email: record.email,
        phone: record.phone,
        phone_slug: record.phone_slug,
        allow_comm_via_phone: record.allow_comm_via_phone,
        allow_comm_via_phone_date: record.allow_comm_via_phone_date,
        allow_comm_via_sms: record.allow_comm_via_sms,
        allow_comm_via_sms_date: record.allow_comm_via_sms_date,
        allow_comm_via_email: record.allow_comm_via_email,
        allow_comm_via_email_date: record.allow_comm_via_email_date,
      },
    });
    for (const permission_type of ["sms", "phone"] as const) {
      const byPhone = await shared.ok("getCommunicationPermissions", {
        path: { permission_type, permission_value: record.phone },
      });
      expect(byPhone.permission_list?.id).toBe(1010);
    }
  });

  test("reports a record that belongs to no contact without an id", async () => {
    const shared = client();
    const orphan = kelder(shared).communicationPermissions.find(
      (row) => row.user_id === null,
    );
    if (!orphan) throw new Error("no unlinked permission");
    const body = await shared.ok("getCommunicationPermissions", {
      path: { permission_type: "email", permission_value: orphan.email },
    });
    expect(body.total).toBe(1);
    expect(body.permission_list?.id).toBeUndefined();
    expect(body.permission_list?.email).toBe(orphan.email);
  });

  test("answers 400 for a value of the wrong shape or an undocumented type, and 404 when no record matches", async () => {
    const shared = client();
    const call = (permission_type: string, permission_value: string) =>
      shared.call("getCommunicationPermissions", {
        path: { permission_type, permission_value },
      });
    const email = await call("email", "nobody");
    expect(email.status).toBe(400);
    expect(email.body).toEqual({
      error: "Invalid values: nobody is not an email address",
    });
    const phone = await call("sms", "05321234567");
    expect(phone.body).toEqual({
      error:
        "Invalid values: 05321234567 is not a phone number in E.164 format",
    });
    expect((await call("fax", "+905321234567")).status).toBe(400);
    const missing = await call("email", "yok@kimse.example");
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({
      error: "Communication permission not found",
    });
  });
});

describe("listChangedCommunicationPermissions", () => {
  test("counts the records whose channel changed in the last days, newest change first, one record per page", async () => {
    const shared = client();
    const db = kelder(shared);
    const now = Date.parse("2026-11-01T09:00:00+03:00");
    const changedWithin = (days: number) =>
      db.communicationPermissions
        .list((row) => {
          const at = Date.parse(row.allow_comm_via_sms_date);
          return at >= now - days * 86_400_000 && at <= now;
        })
        .sort(
          (a, b) =>
            Date.parse(b.allow_comm_via_sms_date) -
            Date.parse(a.allow_comm_via_sms_date),
        );
    const threeDays = changedWithin(3);
    const sevenDays = changedWithin(7);
    expect(threeDays.length).toBeGreaterThan(5);
    expect(sevenDays.length).toBeGreaterThanOrEqual(threeDays.length);
    const byDefault = await shared.ok("listChangedCommunicationPermissions", {
      path: { permission_type: "sms" },
      query: PAGE,
    });
    expect(byDefault.total, "days defaults to 3").toBe(threeDays.length);
    expect(byDefault.permission_list?.allow_comm_via_sms_date).toBe(
      threeDays[0]?.allow_comm_via_sms_date,
    );
    const one = await shared.ok("listChangedCommunicationPermissions", {
      path: { permission_type: "sms" },
      query: { days: 1, start_page: 2, how_many: 1 },
    });
    expect(one.total).toBe(changedWithin(1).length);
    expect(one.permission_list?.allow_comm_via_sms_date).toBe(
      changedWithin(1)[1]?.allow_comm_via_sms_date,
    );
    const past = await shared.ok("listChangedCommunicationPermissions", {
      path: { permission_type: "sms" },
      query: { days: 1, start_page: 99, how_many: 10 },
    });
    expect(past.permission_list).toBeUndefined();
    const outOfRange = await shared.call(
      "listChangedCommunicationPermissions",
      {
        path: { permission_type: "sms" },
        query: { ...PAGE, days: 8 },
      },
    );
    expect(outOfRange.status, "days is 1 to 7").toBe(400);
  });
});

describe("updateCommunicationPermissions", () => {
  test("sets the channel on every matching record, records the change on the contact's timeline, and lists it as changed", async () => {
    const shared = client();
    const db = kelder(shared);
    const record = db.communicationPermissions.find(
      (row) => row.user_id === 1010,
    );
    if (!record) throw new Error("no permission for 1010");
    const result = await shared.ok("updateCommunicationPermissions", {
      path: { permission_type: "email", permission_value: record.email },
      body: {
        permission: !record.allow_comm_via_email,
        update_date: "2026-11-01T08:30:00+03:00",
        details: "İYS üzerinden",
      },
    });
    expect(result).toEqual({ update_count: 1 });
    const after = await shared.ok("getCommunicationPermissions", {
      path: { permission_type: "email", permission_value: record.email },
    });
    expect(after.permission_list).toMatchObject({
      allow_comm_via_email: !record.allow_comm_via_email,
      allow_comm_via_email_date: "2026-11-01T08:30:00+03:00",
      allow_comm_via_sms: record.allow_comm_via_sms,
    });
    const timeline = await shared.ok("getUsersTimeline", {
      path: { user_id: 1010 },
      query: { start_page: 1, how_many: 1 },
    });
    expect(timeline.timeline?.[0]).toMatchObject({
      event_type: record.allow_comm_via_email ? 23 : 20,
      details: `E-posta ile iletişim izni ${record.allow_comm_via_email ? "geri alındı" : "verildi"} (İYS üzerinden)`,
    });
    const changed = await matchingIds(shared, {
      condition: "and",
      attributes: [
        leaf("id", "eq", 1010),
        leaf("allow_comm_via_email_date", "."),
      ],
    });
    expect(changed).toEqual([1010]);
  });

  test("ignores a change older than the stored one, so out-of-order updates converge", async () => {
    const shared = client();
    const record = kelder(shared).communicationPermissions.find(
      (row) => row.user_id === 1010,
    );
    if (!record) throw new Error("no permission for 1010");
    const stale = await shared.ok("updateCommunicationPermissions", {
      path: { permission_type: "phone", permission_value: record.phone },
      body: {
        permission: !record.allow_comm_via_phone,
        update_date: "2001-01-01T00:00:00+03:00",
      },
    });
    expect(stale).toEqual({ update_count: 0 });
    const after = await shared.ok("getCommunicationPermissions", {
      path: { permission_type: "phone", permission_value: record.phone },
    });
    expect(after.permission_list?.allow_comm_via_phone).toBe(
      record.allow_comm_via_phone,
    );
  });

  test("updates every record that shares the value", async () => {
    const shared = client();
    const db = kelder(shared);
    const record = db.communicationPermissions.find(
      (row) => row.user_id === 1010,
    );
    if (!record) throw new Error("no permission for 1010");
    const { id: _id, ...copy } = record;
    db.communicationPermissions.insert({ ...copy, user_id: null });
    const result = await shared.ok("updateCommunicationPermissions", {
      path: { permission_type: "sms", permission_value: record.phone },
      body: { permission: true, update_date: "2026-11-01T08:00:00+03:00" },
    });
    expect(result).toEqual({ update_count: 2 });
  });

  test("answers 400 for a future update_date or a malformed value, and 404 when nothing matches", async () => {
    const shared = client();
    const call = (permission_value: string, update_date: string) =>
      shared.call("updateCommunicationPermissions", {
        path: { permission_type: "email", permission_value },
        body: { permission: true, update_date },
      });
    const future = await call("a@b.example", "2027-01-01T00:00:00+03:00");
    expect(future.body).toEqual({
      error: "Invalid values: update_date is in the future",
    });
    expect((await call("not-email", "2026-10-01T00:00:00+03:00")).status).toBe(
      400,
    );
    expect(
      (await call("yok@kimse.example", "2026-10-01T00:00:00+03:00")).status,
    ).toBe(404);
    const noDate = await shared.call("updateCommunicationPermissions", {
      path: { permission_type: "email", permission_value: "a@b.example" },
      body: { permission: true },
    });
    expect(noDate.status, "update_date is required").toBe(400);
  });
});

describe("the withdraw-permission simulation", () => {
  test("turns a channel off now, as an unsubscribe link would, and shows up as a changed permission", async () => {
    const shared = client();
    const record = kelder(shared).communicationPermissions.find(
      (row) => row.user_id === 1012 && row.allow_comm_via_email,
    );
    const target =
      record ??
      kelder(shared).communicationPermissions.find(
        (row) => row.user_id !== null && row.allow_comm_via_email,
      );
    if (!target) throw new Error("no email opt-in");
    const before = await shared.ok("listChangedCommunicationPermissions", {
      path: { permission_type: "email" },
      query: { days: 1, start_page: 1, how_many: 1 },
    });
    const response = await shared.request(
      "/__mock/simulations/people/withdraw-permission?org=kelder",
      {
        method: "POST",
        body: JSON.stringify({
          permission_type: "email",
          permission_value: target.email,
        }),
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ update_count: 1 });
    const after = await shared.ok("listChangedCommunicationPermissions", {
      path: { permission_type: "email" },
      query: { days: 1, start_page: 1, how_many: 1 },
    });
    expect(after.total).toBe((before.total ?? 0) + 1);
    expect(after.permission_list).toMatchObject({
      email: target.email,
      allow_comm_via_email: false,
      allow_comm_via_email_date: "2026-11-01T09:00:00+03:00",
    });
    const invalid = await shared.request(
      "/__mock/simulations/people/withdraw-permission?org=kelder",
      { method: "POST", body: JSON.stringify({ permission_type: "fax" }) },
    );
    expect(invalid.status).toBe(400);
  });
});
