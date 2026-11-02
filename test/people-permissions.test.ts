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
    // The shape production showed for email: four keys and no total.
    expect(byEmail).toEqual({
      permission_list: [
        {
          id: 1010,
          email: record.email,
          allow_comm_via_email: record.allow_comm_via_email,
          allow_comm_via_email_date: record.allow_comm_via_email_date,
        },
      ],
    });
    // The same four keys are inferred for sms and phone, with `phone`.
    const channels = {
      sms: {
        allow_comm_via_sms: record.allow_comm_via_sms,
        allow_comm_via_sms_date: record.allow_comm_via_sms_date,
      },
      phone: {
        allow_comm_via_phone: record.allow_comm_via_phone,
        allow_comm_via_phone_date: record.allow_comm_via_phone_date,
      },
    } as const;
    for (const permission_type of ["sms", "phone"] as const) {
      const byPhone = await shared.ok("getCommunicationPermissions", {
        path: { permission_type, permission_value: record.phone },
      });
      expect(byPhone).toEqual({
        permission_list: [
          { id: 1010, phone: record.phone, ...channels[permission_type] },
        ],
      });
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
    expect(body.permission_list).toHaveLength(1);
    expect(body.permission_list?.[0]?.id).toBeUndefined();
    expect(body.permission_list?.[0]?.email).toBe(orphan.email);
  });

  test("lists every record that shares the value", async () => {
    const shared = client();
    const db = kelder(shared);
    const record = db.communicationPermissions.find(
      (row) => row.user_id === 1010,
    );
    if (!record) throw new Error("no permission for 1010");
    const { id: _id, ...copy } = record;
    db.communicationPermissions.insert({ ...copy, user_id: null });
    const body = await shared.ok("getCommunicationPermissions", {
      path: { permission_type: "email", permission_value: record.email },
    });
    expect(body.permission_list?.map((item) => item.id)).toEqual([
      1010,
      undefined,
    ]);
  });

  test("answers 200 with an empty list for a value nobody has, as production does", async () => {
    const shared = client();
    expect(
      await shared.ok("getCommunicationPermissions", {
        path: {
          permission_type: "email",
          permission_value: "yok@kimse.example",
        },
      }),
    ).toEqual({ permission_list: [] });
    for (const permission_type of ["sms", "phone"] as const) {
      expect(
        await shared.ok("getCommunicationPermissions", {
          path: { permission_type, permission_value: "+905550000000" },
        }),
      ).toEqual({ permission_list: [] });
    }
  });

  test("answers 400 for a value of the wrong shape or an undocumented type", async () => {
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
    const fax = await call("fax", "+905321234567");
    expect(fax.status).toBe(400);
    expect(fax.body).toEqual({
      error: "Invalid permission type. must be email, sms or phone",
    });
  });

  test("reports a channel nobody answered with a null date", async () => {
    const shared = client();
    const db = kelder(shared);
    const record = db.communicationPermissions.find(
      (row) => row.user_id === 1010,
    );
    if (!record) throw new Error("no permission for 1010");
    db.communicationPermissions.update(record.id, {
      allow_comm_via_phone: false,
      allow_comm_via_phone_date: null,
    });
    const body = await shared.ok("getCommunicationPermissions", {
      path: { permission_type: "phone", permission_value: record.phone },
    });
    expect(body.permission_list).toEqual([
      {
        id: 1010,
        phone: record.phone,
        allow_comm_via_phone: false,
        allow_comm_via_phone_date: null,
      },
    ]);
  });
});

describe("listChangedCommunicationPermissions", () => {
  test("lists the records whose channel changed in the last days, newest change first, with a total for the whole window", async () => {
    const shared = client();
    const db = kelder(shared);
    const now = Date.parse("2026-11-01T09:00:00+03:00");
    const changedAt = (row: { allow_comm_via_sms_date: string | null }) =>
      row.allow_comm_via_sms_date === null
        ? null
        : Date.parse(row.allow_comm_via_sms_date);
    const changedWithin = (days: number) =>
      db.communicationPermissions
        .list((row) => {
          const at = changedAt(row);
          return at !== null && at >= now - days * 86_400_000 && at <= now;
        })
        .sort((a, b) => (changedAt(b) ?? 0) - (changedAt(a) ?? 0));
    const threeDays = changedWithin(3);
    const sevenDays = changedWithin(7);
    expect(threeDays.length).toBeGreaterThan(5);
    expect(sevenDays.length).toBeGreaterThanOrEqual(threeDays.length);
    const byDefault = await shared.ok("listChangedCommunicationPermissions", {
      path: { permission_type: "sms" },
      query: PAGE,
    });
    expect(byDefault.total, "days defaults to 3").toBe(threeDays.length);
    expect(byDefault.permission_list).toHaveLength(
      Math.min(PAGE.how_many, threeDays.length),
    );
    expect(
      byDefault.permission_list?.map((item) => item.allow_comm_via_sms_date),
    ).toEqual(
      threeDays
        .slice(0, PAGE.how_many)
        .map((row) => row.allow_comm_via_sms_date),
    );
    // An sms entry has the same four keys as a lookup.
    const [first] = byDefault.permission_list ?? [];
    expect(Object.keys(first ?? {}).sort()).toEqual(
      [
        ...(first?.id === undefined ? [] : ["id"]),
        "phone",
        "allow_comm_via_sms",
        "allow_comm_via_sms_date",
      ].sort(),
    );
    const one = await shared.ok("listChangedCommunicationPermissions", {
      path: { permission_type: "sms" },
      query: { days: 1, start_page: 2, how_many: 1 },
    });
    expect(one.total).toBe(changedWithin(1).length);
    expect(
      one.permission_list?.map((item) => item.allow_comm_via_sms_date),
    ).toEqual([changedWithin(1)[1]?.allow_comm_via_sms_date]);
    const past = await shared.ok("listChangedCommunicationPermissions", {
      path: { permission_type: "sms" },
      query: { days: 1, start_page: 99, how_many: 10 },
    });
    expect(past.permission_list).toEqual([]);
    expect(past.total).toBe(changedWithin(1).length);
  });

  test("starts with a person, so the lookup of its email carries the user's id", async () => {
    const shared = client();
    const changed = await shared.ok("listChangedCommunicationPermissions", {
      path: { permission_type: "email" },
      query: { days: 7, start_page: 1, how_many: 20 },
    });
    const [first] = changed.permission_list ?? [];
    expect(first?.id, "a guest consent record has no id").toEqual(
      expect.any(Number),
    );
    const lookup = await shared.ok("getCommunicationPermissions", {
      path: { permission_type: "email", permission_value: first?.email ?? "" },
    });
    expect(lookup.permission_list?.[0]?.id).toBe(first?.id);
  });

  test("answers an empty list with a total of 0 when nothing changed", async () => {
    const shared = client();
    shared.mock.runtime.clock.advance(60 * 86_400_000);
    expect(
      await shared.ok("listChangedCommunicationPermissions", {
        path: { permission_type: "email" },
        query: { ...PAGE, days: 7 },
      }),
    ).toEqual({ permission_list: [], total: 0 });
  });

  test("never lists a channel nobody answered", async () => {
    const shared = client();
    const db = kelder(shared);
    const now = Date.parse("2026-11-01T09:00:00+03:00");
    const recent = db.communicationPermissions.list((row) => {
      if (row.allow_comm_via_phone_date === null) return false;
      const at = Date.parse(row.allow_comm_via_phone_date);
      return at >= now - 3 * 86_400_000 && at <= now;
    });
    const before = await shared.ok("listChangedCommunicationPermissions", {
      path: { permission_type: "phone" },
      query: PAGE,
    });
    expect(before.total).toBe(recent.length);
    const [target] = recent;
    if (!target) throw new Error("no recent phone change");
    db.communicationPermissions.update(target.id, {
      allow_comm_via_phone: false,
      allow_comm_via_phone_date: null,
    });
    const after = await shared.ok("listChangedCommunicationPermissions", {
      path: { permission_type: "phone" },
      query: PAGE,
    });
    expect(after.total).toBe(recent.length - 1);
  });

  test("answers 400 for a window production refuses: 8, 30 and 365 days", async () => {
    const shared = client();
    for (const days of [8, 30, 365]) {
      const response = await shared.call(
        "listChangedCommunicationPermissions",
        { path: { permission_type: "email" }, query: { ...PAGE, days } },
      );
      expect(response.status, `days ${days}`).toBe(400);
    }
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
    expect(after.permission_list).toEqual([
      {
        id: 1010,
        email: record.email,
        allow_comm_via_email: !record.allow_comm_via_email,
        allow_comm_via_email_date: "2026-11-01T05:30:00.000Z",
      },
    ]);
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
    expect(after.permission_list?.[0]?.allow_comm_via_phone).toBe(
      record.allow_comm_via_phone,
    );
  });

  test("a channel nobody answered takes the first update, however old", async () => {
    const shared = client();
    const db = kelder(shared);
    const record = db.communicationPermissions.find(
      (row) => row.user_id === 1010,
    );
    if (!record) throw new Error("no permission for 1010");
    db.communicationPermissions.update(record.id, {
      allow_comm_via_phone: false,
      allow_comm_via_phone_date: null,
    });
    const result = await shared.ok("updateCommunicationPermissions", {
      path: { permission_type: "phone", permission_value: record.phone },
      body: { permission: true, update_date: "2001-01-01T00:00:00+03:00" },
    });
    expect(result).toEqual({ update_count: 1 });
    const after = await shared.ok("getCommunicationPermissions", {
      path: { permission_type: "phone", permission_value: record.phone },
    });
    expect(after.permission_list).toEqual([
      {
        id: 1010,
        phone: record.phone,
        allow_comm_via_phone: true,
        allow_comm_via_phone_date: "2000-12-31T21:00:00.000Z",
      },
    ]);
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
    expect(after.permission_list?.[0]).toMatchObject({
      email: target.email,
      allow_comm_via_email: false,
      allow_comm_via_email_date: "2026-11-01T06:00:00.000Z",
    });
    const invalid = await shared.request(
      "/__mock/simulations/people/withdraw-permission?org=kelder",
      { method: "POST", body: JSON.stringify({ permission_type: "fax" }) },
    );
    expect(invalid.status).toBe(400);
  });
});
