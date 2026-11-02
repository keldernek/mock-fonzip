import { describe, expect, test } from "bun:test";

import type { TestClient } from "../src/testing/client";
import {
  campaign,
  client,
  donation,
  duesPayment,
  ecardSale,
  formAnswer,
  kelder,
  leaf,
  matchingIds,
  note,
  person,
  search,
  ticketSale,
} from "./people-fixtures";

async function details(test: TestClient, userId: number) {
  const body = await test.ok("getUserDetails", { path: { user_id: userId } });
  if (!body.user) throw new Error(`no user ${userId}`);
  return body.user;
}

async function createUser(
  test: TestClient,
  body: Record<string, unknown>,
): Promise<number> {
  const created = await test.ok("createUser", { body });
  expect(created).toEqual({ user_id: expect.any(Number) });
  return created.user_id ?? 0;
}

describe("createUser and getUserDetails", () => {
  test("creates a person with every documented field and returns them from details and the list", async () => {
    const shared = client();
    const userId = await createUser(shared, {
      corporate_type: false,
      first_name: "Deniz",
      last_name: "Yalçın",
      tckno: "10000000146",
      email: "deniz.yalcin@kisi.example",
      phone: "+905551234567",
      membership_no_decision: "custom",
      membership_no: 4242,
      birthday: "1988-04-23",
      email_second: "deniz@is.example",
      nationality_text: "Türkiye Cumhuriyeti",
      home_phone_first: "+902121112233",
      address: "Barbaros Blv. No:1",
      district_text: "Beşiktaş",
      city_text: "İstanbul",
      country_text: "Türkiye",
      post_code: "34353",
      work_phone: "+902163334455",
      work_address: "Kozyatağı Mah. No:5",
      work_district_text: "Kadıköy",
      work_city_text: "İstanbul",
      work_country_text: "Türkiye",
      work_post_code: "34742",
      apply_date: "2026-09-01T10:00:00+03:00",
      join_date: "2026-09-15T10:00:00+03:00",
      allow_comm_via_phone: false,
      allow_comm_via_sms: true,
      allow_comm_via_email: true,
      allow_comm_via_phone_date: "2026-09-15T10:00:00+03:00",
      allow_comm_via_sms_date: "2026-09-15T10:00:00+03:00",
      allow_comm_via_email_date: "2026-09-16T10:00:00+03:00",
      user_defined_values: {
        mezuniyet_yili: 2006,
        sube: "Fen",
        ilgi_alanlari: ["Burs", "Kariyer"],
        burs_gonullusu: true,
      },
      tags: [101, 104],
    });
    expect(await details(shared, userId)).toEqual({
      id: userId,
      first_name: "Deniz",
      last_name: "Yalçın",
      name: "Deniz Yalçın",
      nationality_text: "Türkiye Cumhuriyeti",
      tckno: "10000000146",
      birthday: "1988-04-23",
      email: "deniz.yalcin@kisi.example",
      phone: "+905551234567",
      home_phone_first: "+902121112233",
      address: "Barbaros Blv. No:1",
      post_code: "34353",
      district_text: "Beşiktaş",
      city_text: "İstanbul",
      country_text: "Türkiye",
      work_phone: "+902163334455",
      work_address: "Kozyatağı Mah. No:5",
      work_post_code: "34742",
      private: false,
      work_district_text: "Kadıköy",
      work_city_text: "İstanbul",
      work_country_text: "Türkiye",
      email_second: "deniz@is.example",
      membership_no: 4242,
      admin: false,
      corporate_type: false,
      apply_date: "2026-09-01",
      allow_comm_via_phone: false,
      allow_comm_via_phone_date: "2026-09-15T07:00:00.000Z",
      allow_comm_via_sms: true,
      allow_comm_via_sms_date: "2026-09-15T07:00:00.000Z",
      allow_comm_via_email: true,
      allow_comm_via_email_date: "2026-09-16T07:00:00.000Z",
      join_date: "2026-09-15",
      last_update_date: "2026-11-01T06:00:00.000Z",
      total_financial: 0,
      // A select field holds its chosen option. A yes or no field holds the
      // "yes" or "no" option, and a multiple select joins its texts.
      user_defined_values: {
        mezuniyet_yili: 2006,
        sube: { id: 3, order: 2, text: "Fen" },
        ilgi_alanlari: "Burs, Kariyer",
        burs_gonullusu: { id: 1, order: 0, text: "Evet" },
      },
    });
    const tags = await shared.ok("getUsersTagsList", {
      path: { user_id: userId },
    });
    expect(tags.tags?.map((tag) => tag.id)).toEqual([101, 104]);
    const listed = await matchingIds(shared, {
      condition: "and",
      attributes: [leaf("email", "eq", "deniz.yalcin@kisi.example")],
    });
    expect(listed).toEqual([userId]);
    const permission = await shared.ok("getCommunicationPermissions", {
      path: {
        permission_type: "email",
        permission_value: "deniz.yalcin@kisi.example",
      },
    });
    expect(permission.permission_list?.[0]?.id).toBe(userId);
  });

  test("defaults the dates to now and assigns the next membership number on auto", async () => {
    const shared = client();
    const userId = await createUser(shared, {
      first_name: "Bora",
      corporate_type: true,
      membership_no_decision: "auto",
    });
    const user = await details(shared, userId);
    expect(user).toMatchObject({
      first_name: "Bora",
      corporate_type: true,
      membership_no: 151,
      apply_date: "2026-11-01",
      join_date: "2026-11-01",
      user_defined_values: {},
    });
    expect(user.allow_comm_via_email, "no permission given").toBeUndefined();
    const plain = await createUser(shared, { first_name: "Numarasız" });
    expect((await details(shared, plain)).membership_no).toBeUndefined();
  });

  test("answers null for every text the user lacks, as production does", async () => {
    const shared = client();
    const userId = await createUser(shared, {
      first_name: "Seyrek",
      email: "seyrek@kisi.example",
    });
    const user = await details(shared, userId);
    for (const field of [
      "address",
      "birthday",
      "tckno",
      "nationality_text",
      "home_phone_first",
      "post_code",
      "district_text",
      "city_text",
      "country_text",
      "work_phone",
      "work_address",
      "work_post_code",
      "work_district_text",
      "work_city_text",
      "work_country_text",
      "email_second",
    ] as const) {
      expect(user[field], field).toBeNull();
    }
    expect(user.last_update_date).toBe("2026-11-01T06:00:00.000Z");
    const listed = await search(
      shared,
      { condition: "and", attributes: [leaf("id", "eq", userId)] },
      { values: ["address", "birthday", "tckno", "work_phone", "city_text"] },
    );
    expect(listed.user_list).toEqual([
      {
        address: null,
        birthday: null,
        tckno: null,
        work_phone: null,
        city_text: null,
      },
    ]);
  });

  test("answers 400 for invalid fields and 404 for an unknown tag", async () => {
    const shared = client();
    const refuse = async (body: Record<string, unknown>, error: string) => {
      const response = await shared.call("createUser", { body });
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(response.body).toEqual({ error });
    };
    await refuse(
      { first_name: " " },
      "Invalid values: first_name cannot be empty",
    );
    await refuse(
      { first_name: "A", birthday: "1990-02-30" },
      'Invalid values: body/birthday must match format "date"',
    );
    await refuse(
      { first_name: "A", membership_no_decision: "custom" },
      "Invalid values: membership_no_decision custom needs a positive membership_no",
    );
    await refuse(
      { first_name: "A", user_defined_values: { key: 1 } },
      "Invalid values: no user defined value has the key key",
    );
    await refuse(
      { first_name: "A", user_defined_values: { sube: "Edebiyat" } },
      "Invalid values: sube (Şube) takes one of Hazırlık A, Hazırlık B, Fen, Türkçe-Matematik, Yabancı Dil",
    );
    const validation = await shared.call("createUser", {
      body: { last_name: "Adsız" },
    });
    expect(validation.status, "first_name is required").toBe(400);
    const tag = await shared.call("createUser", {
      body: { first_name: "A", tags: [101, 99] },
    });
    expect(tag.status).toBe(404);
    expect(tag.body).toEqual({ error: "Tag not found" });
    const missing = await shared.call("getUserDetails", {
      path: { user_id: 99 },
    });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: "Kullanıcı bulunamadı" });
  });
});

describe("updateUser", () => {
  test("a single field update persists and records a profile update", async () => {
    const shared = client();
    await shared.ok("updateUser", {
      path: { user_id: 1010 },
      body: { type: "single", data: { field: "city_text", value: "Bursa" } },
    });
    expect((await details(shared, 1010)).city_text).toBe("Bursa");
    const timeline = await shared.ok("getUsersTimeline", {
      path: { user_id: 1010 },
      query: { start_page: 1, how_many: 1 },
    });
    expect(timeline.timeline?.[0]).toMatchObject({
      event_type: 1,
      event_time: "2026-11-01T06:00:00.000Z",
      details: "Profil güncellendi: city_text",
    });
    const recent = await matchingIds(shared, {
      condition: "and",
      attributes: [leaf("last_update_date", ".")],
    });
    expect(recent, "last_update_date moved to today").toContain(1010);
  });

  test("a multiple update sets every listed field and keeps the permission record's email in step", async () => {
    const shared = client();
    await shared.ok("updateUser", {
      path: { user_id: 1010 },
      body: {
        type: "multiple",
        data: [
          { field: "first_name", value: "Şükrü Can" },
          { field: "email", value: "sukru.can@kisi.example" },
          { field: "private", value: true },
          { field: "corporate_type", value: "false" },
          { field: "join_date", value: "2020-01-01T00:00:00Z" },
          { field: "tckno", value: "" },
        ],
      },
    });
    const user = await details(shared, 1010);
    expect(user).toMatchObject({
      first_name: "Şükrü Can",
      email: "sukru.can@kisi.example",
      private: true,
      corporate_type: false,
      join_date: "2020-01-01",
    });
    expect(user.tckno, "an empty value clears the field").toBeNull();
    const permission = await shared.ok("getCommunicationPermissions", {
      path: {
        permission_type: "email",
        permission_value: "sukru.can@kisi.example",
      },
    });
    expect(permission.permission_list?.[0]?.id).toBe(1010);
  });

  test("a udv update validates the value against the field's key_type", async () => {
    const shared = client();
    await shared.ok("updateUser", {
      path: { user_id: 1010 },
      body: { type: "udv", data: { udv_id: 15, value: ["Spor", "Kültür"] } },
    });
    await shared.ok("updateUser", {
      path: { user_id: 1010 },
      body: { type: "udv", data: { udv_id: 16, value: "Eczacılık okudu." } },
    });
    expect((await details(shared, 1010)).user_defined_values).toMatchObject({
      ilgi_alanlari: "Spor, Kültür",
      ozgecmis_notu: "Eczacılık okudu.",
    });
    const wrong = await shared.call("updateUser", {
      path: { user_id: 1010 },
      body: { type: "udv", data: { udv_id: 11, value: "bin dokuz yüz" } },
    });
    expect(wrong.status).toBe(400);
    expect(wrong.body).toEqual({
      error: "Invalid values: mezuniyet_yili (Mezuniyet Yılı) takes a year",
    });
    const unknown = await shared.call("updateUser", {
      path: { user_id: 1010 },
      body: { type: "udv", data: { udv_id: 99, value: "x" } },
    });
    expect(unknown.status).toBe(404);
  });

  test("a number field takes a whole number, which details return as an integer", async () => {
    const shared = client();
    const field = kelder(shared).userDefinedValues.insert({
      key: "C99",
      type: "custom",
      name: "Çocuk Sayısı",
      value: "cocuk_sayisi",
      group: "USER.GROUP.DEFINED_FIELDS",
      key_type: 2,
      for: "numeric",
      options: [],
      boolean_true_text: null,
      boolean_false_text: null,
      select_text: null,
      validation: {},
      display_for: "ngo",
    });
    const set = (value: unknown) =>
      shared.call("updateUser", {
        path: { user_id: 1010 },
        body: { type: "udv", data: { udv_id: field.id, value } },
      });
    expect((await set("3")).status, "a numeric text is a number").toBe(200);
    expect((await details(shared, 1010)).user_defined_values).toMatchObject({
      cocuk_sayisi: 3,
    });
    const fraction = await set(2.5);
    expect(fraction.status).toBe(400);
    expect(fraction.body).toEqual({
      error: `Invalid values: cocuk_sayisi (Çocuk Sayısı) takes a whole number`,
    });
    expect((await set(null)).status, "null clears the value").toBe(200);
    expect(
      (await details(shared, 1010)).user_defined_values,
    ).not.toHaveProperty("cocuk_sayisi");
  });

  test("a membership_no update assigns auto, custom, or leaves the number with no", async () => {
    const shared = client();
    const set = (data: Record<string, unknown>) =>
      shared.ok("updateUser", {
        path: { user_id: 1010 },
        body: { type: "membership_no", data },
      });
    await set({ membership_no_decision: "custom", membership_no: 777 });
    expect((await details(shared, 1010)).membership_no).toBe(777);
    await set({ membership_no_decision: "no", membership_no: 5 });
    expect((await details(shared, 1010)).membership_no).toBe(777);
    await set({ membership_no_decision: "auto" });
    expect((await details(shared, 1010)).membership_no).toBe(778);
  });

  test("answers 400 when the data does not fit the type, and 404 for an unknown user", async () => {
    const shared = client();
    const call = (user_id: number, body: unknown) =>
      shared.call("updateUser", { path: { user_id }, body });
    const mismatch = await call(1010, {
      type: "single",
      data: [{ field: "city_text", value: "Bursa" }],
    });
    expect(mismatch.status).toBe(400);
    const nameless = await call(1010, {
      type: "multiple",
      data: [{ value: "x" }],
    });
    expect(nameless.status).toBe(400);
    const badEmail = await call(1010, {
      type: "single",
      data: { field: "email", value: "not-an-email" },
    });
    expect(badEmail.body).toEqual({
      error: "Invalid values: email is not an email address",
    });
    const badDate = await call(1010, {
      type: "single",
      data: { field: "birthday", value: "1990-02-30" },
    });
    expect(badDate.body).toEqual({
      error: "Invalid values: birthday takes a YYYY-MM-DD date",
    });
    const badFlag = await call(1010, {
      type: "single",
      data: { field: "private", value: "evet" },
    });
    expect(badFlag.status).toBe(400);
    const membership = await call(1010, { type: "membership_no", data: {} });
    expect(membership.status).toBe(400);
    const missing = await call(99, {
      type: "single",
      data: { field: "city_text", value: "Bursa" },
    });
    expect(missing.status).toBe(404);
  });
});

describe("deleteUser", () => {
  test("removes the contact from details and lists, detaches guest records, and keeps the permission as evidence", async () => {
    const shared = client();
    const db = kelder(shared);
    const userId = await createUser(shared, {
      first_name: "Silinecek",
      email: "silinecek@kisi.example",
      phone: "+905559998877",
      allow_comm_via_email: true,
      tags: [102],
    });
    ticketSale(db, userId);
    formAnswer(db, userId);
    ecardSale(db, userId);
    note(db, userId, { details: "Silinmeden önce not" });
    expect(
      await shared.ok("deleteUser", { path: { user_id: userId } }),
    ).toEqual({ result: "ok" });
    const gone = await shared.call("getUserDetails", {
      path: { user_id: userId },
    });
    expect(gone.status).toBe(404);
    const listed = await matchingIds(shared, {
      condition: "and",
      attributes: [leaf("id", "eq", userId)],
    });
    expect(listed).toEqual([]);
    expect(db.ticketSales.count((row) => row.user_id === userId)).toBe(0);
    expect(db.formAnswers.count((row) => row.user_id === userId)).toBe(0);
    expect(db.ecardTransactions.count((row) => row.user_id === userId)).toBe(0);
    expect(db.userTags.count((row) => row.user_id === userId)).toBe(0);
    expect(db.timeline.count((row) => row.user_id === userId)).toBe(0);
    const evidence = await shared.ok("getCommunicationPermissions", {
      path: {
        permission_type: "email",
        permission_value: "silinecek@kisi.example",
      },
    });
    expect(evidence.permission_list?.[0]).toMatchObject({
      email: "silinecek@kisi.example",
      allow_comm_via_email: true,
    });
    expect(
      evidence.permission_list?.[0]?.id,
      "no longer linked",
    ).toBeUndefined();
    const again = await shared.call("deleteUser", {
      path: { user_id: userId },
    });
    expect(again.status).toBe(404);
  });

  test("deletes the one seeded contact without donations, dues or campaigns", async () => {
    const shared = client();
    await shared.ok("deleteUser", { path: { user_id: 1146 } });
    expect(
      (await shared.call("getUserDetails", { path: { user_id: 1146 } })).status,
    ).toBe(404);
  });

  test("refuses with 400 while records that need a contact remain, and 403 for an administrator", async () => {
    const shared = client();
    const db = kelder(shared);
    const donor = person(db, "donor");
    donation(db, donor);
    const owner = person(db, "owner");
    campaign(db, owner);
    duesPayment(db, owner);
    const refused = await shared.call("deleteUser", {
      path: { user_id: donor },
    });
    expect(refused.status).toBe(400);
    expect(refused.body).toEqual({
      error: `Invalid values: user ${donor} has donations, which need a contact, so it cannot be deleted`,
    });
    const both = await shared.call("deleteUser", { path: { user_id: owner } });
    expect(both.body).toEqual({
      error: `Invalid values: user ${owner} has membership dues, fundraising campaigns, which need a contact, so it cannot be deleted`,
    });
    const admin = await shared.call("deleteUser", { path: { user_id: 1001 } });
    expect(admin.status).toBe(403);
    expect(
      (await shared.call("getUserDetails", { path: { user_id: donor } }))
        .status,
    ).toBe(200);
  });
});

describe("getUserDefinedValuesList", () => {
  test("lists the association's user-defined fields with their keys and options", async () => {
    const shared = client();
    const body = await shared.ok("getUserDefinedValuesList");
    expect(
      body.udv_list?.map((udv) => [udv.udv_id, udv.value, udv.key_type]),
    ).toEqual([
      [11, "mezuniyet_yili", 4],
      [12, "meslek", 0],
      [13, "sube", 7],
      [14, "burs_gonullusu", 6],
      [15, "ilgi_alanlari", 8],
      [16, "ozgecmis_notu", 1],
    ]);
    // Production names every field custom, shows it to ngo, groups it under
    // USER.GROUP.DEFINED_FIELDS and ids it C<number>. Its texts are null, and
    // only a select field carries a select_text.
    expect(body.udv_list?.[3]).toEqual({
      id: "C14",
      udv_id: 14,
      type: "custom",
      name: "Burs Gönüllüsü",
      value: "burs_gonullusu",
      group: "USER.GROUP.DEFINED_FIELDS",
      key_type: 6,
      for: "select_w_bool",
      options: [
        { id: 1, text: "Evet", order: 0 },
        { id: 2, text: "Hayır", order: 1 },
      ],
      boolean_true_text: null,
      boolean_false_text: null,
      select_text: "Seçiniz",
      validation: {},
      display_for: "ngo",
    });
    expect(body.udv_list?.[1]).toMatchObject({
      for: "text",
      select_text: null,
    });
    for (const udv of body.udv_list ?? []) {
      expect(udv, `${udv.value} has no changable_by_users`).not.toHaveProperty(
        "changable_by_users",
      );
    }
  });

  test("describes a field's limits in validation: nothing, a text limit or a numeric cap", async () => {
    const shared = client();
    const body = await shared.ok("getUserDefinedValuesList");
    const validation = Object.fromEntries(
      (body.udv_list ?? []).map((udv) => [udv.value, udv.validation]),
    );
    expect(validation).toEqual({
      mezuniyet_yili: { max: true, max_value: 2100 },
      meslek: {},
      sube: {},
      burs_gonullusu: {},
      ilgi_alanlari: {},
      ozgecmis_notu: { limit: true, limit_value: 500 },
    });
    const fors = new Set((body.udv_list ?? []).map((udv) => udv.for));
    expect(fors).toEqual(new Set(["text", "numeric", "select_w_bool"]));
  });
});

describe("generateLoginLinkForUser", () => {
  test("links a member to the page each redirection type names, with a fresh token every time", async () => {
    const shared = client();
    const targets = {
      3: "/profil/aidat-odeme",
      4: "/profil/bagislarim",
      5: "/profil",
      10: "/profil/uyelik-karti",
      12: "/profil/aidat-kart-guncelleme",
    } as const;
    const tokens = new Set<string>();
    for (const [type, path] of Object.entries(targets)) {
      const body = await shared.ok("generateLoginLinkForUser", {
        path: { user_id: 1010 },
        query: { redirection_type: Number(type) },
      });
      const link = new URL(body.link ?? "");
      expect(link.origin).toBe("https://kelder.example");
      expect(link.searchParams.get("next"), `type ${type}`).toBe(path);
      tokens.add(link.pathname);
    }
    const fallback = await shared.ok("generateLoginLinkForUser", {
      path: { user_id: 1010 },
    });
    expect(new URL(fallback.link ?? "").searchParams.get("next")).toBe(
      "/profil",
    );
    expect(tokens.size, "one token per link").toBe(5);
  });

  test("refuses administrators with 403, unknown users with 404 and undocumented types with 400", async () => {
    const shared = client();
    const admin = await shared.call("generateLoginLinkForUser", {
      path: { user_id: 1001 },
    });
    expect(admin.status).toBe(403);
    expect(admin.body).toEqual({
      error:
        "No Permission: login links are for members, and user 1001 is an administrator",
    });
    const missing = await shared.call("generateLoginLinkForUser", {
      path: { user_id: 99 },
    });
    expect(missing.status).toBe(404);
    const type = await shared.call("generateLoginLinkForUser", {
      path: { user_id: 1010 },
      query: { redirection_type: 7 },
    });
    expect(type.status).toBe(400);
  });
});

describe("user tags", () => {
  test("adds and removes a tag, idempotently, and lists the user's tags in id order", async () => {
    const shared = client();
    const userId = await createUser(shared, { first_name: "Etiketli" });
    const list = async () =>
      (
        await shared.ok("getUsersTagsList", { path: { user_id: userId } })
      ).tags?.map((tag) => tag.id);
    expect(await list()).toEqual([]);
    for (const tag_id of [105, 102, 105]) {
      expect(
        await shared.ok("addTagToUser", { path: { user_id: userId, tag_id } }),
      ).toEqual({ result: "ok" });
    }
    const tags = await shared.ok("getUsersTagsList", {
      path: { user_id: userId },
    });
    expect(tags.tags).toEqual([
      { id: 102, name: "Gönüllü", color: "tag-2" },
      { id: 105, name: "2000'ler Mezunu", color: "tag-5" },
    ]);
    const tagged = await matchingIds(shared, {
      condition: "and",
      attributes: [leaf("id", "eq", userId), leaf("tags", "eq", 105)],
    });
    expect(tagged).toEqual([userId]);
    await shared.ok("removeTagFromUser", {
      path: { user_id: userId, tag_id: 105 },
    });
    await shared.ok("removeTagFromUser", {
      path: { user_id: userId, tag_id: 105 },
    });
    expect(await list()).toEqual([102]);
  });

  test("answers 404 for an unknown user or tag when adding or removing", async () => {
    const shared = client();
    for (const operation of ["addTagToUser", "removeTagFromUser"] as const) {
      const user = await shared.call(operation, {
        path: { user_id: 99, tag_id: 101 },
      });
      expect(user.body).toEqual({ error: "Kullanıcı bulunamadı" });
      const tag = await shared.call(operation, {
        path: { user_id: 1010, tag_id: 99 },
      });
      expect(tag.status).toBe(404);
      expect(tag.body).toEqual({ error: "Tag not found" });
    }
  });

  test("answers 200 with no tags for a user that does not exist, as production does", async () => {
    const shared = client();
    const list = await shared.call("getUsersTagsList", {
      path: { user_id: 99 },
    });
    expect(list.status).toBe(200);
    expect(list.body).toEqual({ tags: [] });
  });
});
