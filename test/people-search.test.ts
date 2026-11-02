import { describe, expect, test } from "bun:test";

import { specRuntime } from "../src/spec/runtime";
import { isJsonObject } from "../src/spec/json";
import {
  ALL_USER_COLUMNS,
  cardInfo,
  client,
  day,
  donation,
  dues,
  expectStatus,
  kelder,
  leaf,
  matchingIds,
  person,
  search,
  within,
  type Group,
  type OrderBy,
} from "./people-fixtures";

const EVERYONE: Group = { condition: "and", attributes: [] };

describe("id and membership number lists", () => {
  test("id takes comparisons and a ;-separated contains list", async () => {
    const shared = client();
    const db = kelder(shared);
    const [a, b, c] = ["a", "b", "c"].map((label) => person(db, label));
    if (a === undefined || b === undefined || c === undefined) {
      throw new Error("three people");
    }
    const scope = [a, b, c];
    const ids = async (filter: Parameters<typeof within>[1]) =>
      matchingIds(shared, within(scope, filter));
    expect(await ids(leaf("id", "eq", b))).toEqual([b]);
    expect(await ids(leaf("id", "neq", b))).toEqual([a, c]);
    expect(await ids(leaf("id", "lt", b))).toEqual([a]);
    expect(await ids(leaf("id", "lte", b))).toEqual([a, b]);
    expect(await ids(leaf("id", "gt", b))).toEqual([c]);
    expect(await ids(leaf("id", "gte", b))).toEqual([b, c]);
    expect(await ids(leaf("id", "()", { start: a, end: b }))).toEqual([a, b]);
    expect(await ids(leaf("id", "contains", `${a};${c}`))).toEqual([a, c]);
    expect(await ids(leaf("id", "exist"))).toEqual(scope);
    expect(await ids(leaf("id", "isnull"))).toEqual([]);
  });

  test("membership_no contains takes a list too", async () => {
    const shared = client();
    const found = await matchingIds(shared, {
      condition: "and",
      attributes: [leaf("membership_no", "contains", "3; 7;12")],
    });
    expect(found, "seeded members 3, 7 and 12").toEqual([1003, 1007, 1012]);
  });
});

describe("the duplicate condition", () => {
  test("finds users sharing an email, phone, TC kimlik or membership number with another user", async () => {
    const shared = client();
    const db = kelder(shared);
    const twinA = person(db, "twin-a");
    const twinB = person(db, "twin-b");
    const single = person(db, "single");
    db.users.update(twinA, {
      email: "ortak@kisi.example",
      phone: "+905550000001",
      tckno: "10000000146",
      membership_no: 9001,
    });
    db.users.update(twinB, {
      email: "ORTAK@kisi.example",
      phone: "+90 555 000 00 01",
      tckno: "10000000146",
      membership_no: 9001,
    });
    db.users.update(single, {
      email: "tek@kisi.example",
      phone: "+905550000002",
      tckno: "10000000147",
      membership_no: 9002,
    });
    const scope = [twinA, twinB, single];
    for (const parameter of [
      "email",
      "phone",
      "tckno",
      "membership_no",
    ] as const) {
      expect(
        await matchingIds(shared, within(scope, leaf(parameter, "duplicate"))),
        parameter,
      ).toEqual([twinA, twinB]);
    }
  });

  test("is refused for parameters it does not document", async () => {
    await expectStatus(
      client(),
      { condition: "and", attributes: [leaf("city", "duplicate")] },
      400,
      "Invalid values: the duplicate condition does not apply to city",
    );
  });
});

describe("card expiry", () => {
  test("is the end of the month four years after a saved card's first use", async () => {
    const shared = client();
    const db = kelder(shared);
    const soon = person(db, "soon");
    const later = person(db, "later");
    const none = person(db, "none");
    donation(
      db,
      soon,
      { at: "2022-11-10" },
      { card_info_id: cardInfo(db, soon) },
    );
    donation(
      db,
      later,
      { at: "2023-03-02" },
      { card_info_id: cardInfo(db, later) },
    );
    const scope = [soon, later, none];
    const ids = (filter: Parameters<typeof within>[1]) =>
      matchingIds(shared, within(scope, filter));
    expect(await ids(leaf("card_expiry", "eq", "2026-11-30"))).toEqual([soon]);
    expect(await ids(leaf("card_expiry", "+=", 29))).toEqual([soon]);
    expect(await ids(leaf("card_expiry", "gt", day(0)))).toEqual([soon, later]);
    expect(await ids(leaf("card_expiry", "gte", "2027-01-01"))).toEqual([
      later,
    ]);
    expect(await ids(leaf("card_expiry", "isnull"))).toEqual([none]);
  });
});

describe("custom (user-defined) fields", () => {
  test("filter by the field named in value.udv_id, compared by its key_type", async () => {
    const shared = client();
    const db = kelder(shared);
    const a = person(db, "udv-a");
    const b = person(db, "udv-b");
    const c = person(db, "udv-c");
    db.users.update(a, {
      user_defined_values: {
        mezuniyet_yili: 1994,
        meslek: "Mühendis",
        sube: "Fen",
        burs_gonullusu: true,
        ilgi_alanlari: ["Burs", "Spor"],
      },
    });
    db.users.update(b, {
      user_defined_values: {
        mezuniyet_yili: 2008,
        meslek: "Öğretmen",
        sube: "Yabancı Dil",
        burs_gonullusu: false,
        ilgi_alanlari: ["Kültür"],
      },
    });
    const scope = [a, b, c];
    const custom = (
      udvId: number,
      condition: Parameters<typeof leaf>[1],
      value?: unknown,
      keyType?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
    ) =>
      matchingIds(
        shared,
        within(scope, {
          type: "custom",
          parameter: "name",
          condition,
          value:
            value === undefined ? { udv_id: udvId } : { udv_id: udvId, value },
          ...(keyType === undefined ? {} : { key_type: keyType }),
        }),
      );
    expect(await custom(11, "lt", 2000, 4), "year").toEqual([a]);
    expect(await custom(11, "()", { start: 2000, end: 2010 })).toEqual([b]);
    expect(await custom(12, "contains", "mühen"), "text").toEqual([a]);
    expect(await custom(12, "exclude", "mühen")).toEqual([b, c]);
    expect(await custom(13, "eq", "yabancı dil"), "select").toEqual([b]);
    expect(await custom(14, "eq", "true"), "boolean").toEqual([a]);
    expect(await custom(14, "isnull")).toEqual([b, c]);
    expect(await custom(15, "eq", "spor"), "multiple select").toEqual([a]);
    expect(await custom(15, "exist")).toEqual([a, b]);
    expect(await custom(15, "isnull")).toEqual([c]);
  });

  test("answers 404 for an unknown field and 400 for a mismatched key_type or a missing udv_id", async () => {
    const shared = client();
    const filter = (
      value: Record<string, unknown> | null,
      keyType?: 2 | 4,
    ): Group => ({
      condition: "and",
      attributes: [
        {
          type: "custom",
          parameter: "name",
          condition: "exist",
          value,
          ...(keyType === undefined ? {} : { key_type: keyType }),
        },
      ],
    });
    await expectStatus(
      shared,
      filter({ udv_id: 99 }),
      404,
      "User defined value not found",
    );
    await expectStatus(
      shared,
      filter({ udv_id: 11 }, 2),
      400,
      "Invalid values: user defined value 11 has key_type 4, not 2",
    );
    await expectStatus(shared, filter(null), 400);
  });
});

describe("filter groups", () => {
  test("and requires every attribute, or any, and groups nest", async () => {
    const shared = client();
    const db = kelder(shared);
    const ankara = person(db, "ankara");
    const izmir = person(db, "izmir");
    const both = person(db, "both");
    db.users.update(ankara, { city_text: "Ankara" });
    db.users.update(izmir, { city_text: "İzmir", corporate_type: true });
    db.users.update(both, { city_text: "Ankara", corporate_type: true });
    const scope = [ankara, izmir, both];
    expect(
      await matchingIds(
        shared,
        within(scope, {
          condition: "or",
          attributes: [
            leaf("city", "eq", "izmir"),
            {
              condition: "and",
              attributes: [
                leaf("city", "eq", "ankara"),
                leaf("corporate_type", "eq", "false"),
              ],
            },
          ],
        }),
      ),
    ).toEqual([ankara, izmir]);
    expect(
      await matchingIds(shared, {
        condition: "and",
        attributes: [
          leaf("id", "contains", scope.join(";")),
          leaf("city", "eq", "ankara"),
          leaf("corporate_type", "eq", "true"),
        ],
      }),
    ).toEqual([both]);
    expect(
      await matchingIds(
        shared,
        within(scope, {
          type: "default",
          parameter: "name",
          condition: "or",
          attributes: [
            {
              condition: "and",
              attributes: [leaf("city", "eq", "izmir")],
            },
          ],
        }),
      ),
      "the schema's own nesting: a filter whose attributes are groups",
    ).toEqual([izmir]);
    expect(await matchingIds(shared, within(scope, EVERYONE))).toEqual(scope);
  });

  test("the spec's communication-preferences example validates and finds recent email opt-ins", async () => {
    const shared = client();
    const { spec, table, validators } = specRuntime();
    const components = isJsonObject(spec.components) ? spec.components : {};
    const bodies = isJsonObject(components.requestBodies)
      ? components.requestBodies
      : {};
    const content = isJsonObject(bodies.GetUserList)
      ? bodies.GetUserList.content
      : undefined;
    const media = isJsonObject(content)
      ? content["application/json"]
      : undefined;
    const examples = isJsonObject(media) ? media.examples : undefined;
    const pick = (name: string) => {
      const example = isJsonObject(examples) ? examples[name] : undefined;
      return isJsonObject(example) ? example.value : undefined;
    };
    const route = table.byOperationId.get("getUserList");
    if (!route) throw new Error("no getUserList route");
    const validate = (body: unknown) =>
      validators.request(route).validate({ path: {}, query: {}, body })
        ?.message ?? "valid";
    expect(validate(pick("communicationPreferencesSearch"))).toBe("valid");
    expect(
      validate(pick("simpleSearch")),
      "values_list asks for name, which the User schema cannot carry",
    ).toContain("body/values_list/1");
    const response = await shared.call("getUserList", {
      body: pick("communicationPreferencesSearch"),
    });
    expect(response.status).toBe(200);
    const db = kelder(shared);
    const expected = db.communicationPermissions
      .list(
        (row) =>
          row.allow_comm_via_email &&
          Date.parse(row.allow_comm_via_email_date) >
            Date.parse("2026-10-29T00:00:00+03:00"),
      )
      .flatMap((row) => (row.user_id === null ? [] : [row.user_id]))
      .sort((a, b) => b - a);
    expect(expected.length, "seeded recent email opt-ins").toBeGreaterThan(3);
    const found = await search(
      shared,
      {
        condition: "and",
        attributes: [
          {
            condition: "and",
            attributes: [
              leaf("allow_comm_via_email", "exist", null),
              leaf("allow_comm_via_email_date", "<", 3),
              leaf("email", "exist", null),
            ],
          },
        ],
      },
      { orderBy: "-id" },
    );
    expect(found.user_list?.map((user) => user.id)).toEqual(expected);
  });
});

describe("invalid filters", () => {
  test("answer 400 for a condition the parameter does not take, a missing value, and malformed groups", async () => {
    const shared = client();
    const one = (filter: Parameters<typeof within>[1]): Group => ({
      condition: "and",
      attributes: [filter],
    });
    await expectStatus(
      shared,
      one(leaf("donation_amount", "contains", "5")),
      400,
      "Invalid values: the contains condition does not apply to donation_amount",
    );
    await expectStatus(shared, one(leaf("join_date", "contains", "2026")), 400);
    await expectStatus(
      shared,
      one(leaf("tags", "lt", 3)),
      400,
      "Invalid values: the lt condition does not apply to tags",
    );
    await expectStatus(
      shared,
      one(leaf("city", "eq")),
      400,
      "Invalid values: city eq needs a text value",
    );
    await expectStatus(
      shared,
      one(leaf("join_date", "=", "yesterday")),
      400,
      "Invalid values: join_date = needs a whole number of days",
    );
    await expectStatus(
      shared,
      one(leaf("donation_amount", "()", 5)),
      400,
      "Invalid values: donation_amount () needs a {start, end} range of numbers",
    );
    await expectStatus(
      shared,
      one(leaf("admin", "eq", "maybe")),
      400,
      "Invalid values: admin eq needs true or false",
    );
    await expectStatus(
      shared,
      one(leaf("city", "or")),
      400,
      "Invalid values: the or condition needs attributes",
    );
    await expectStatus(
      shared,
      one({ ...leaf("city", "eq", "x"), attributes: [EVERYONE] }),
      400,
      "Invalid values: a filter with attributes groups them with and or or, not eq",
    );
    await expectStatus(shared, one(leaf("tags", "eq", "abc")), 400);
  });

  test("answer 404 for an id that names no object, and accept a deleted debt category and none", async () => {
    const shared = client();
    const one = (filter: Parameters<typeof within>[1]): Group => ({
      condition: "and",
      attributes: [filter],
    });
    await expectStatus(
      shared,
      one(leaf("tags", "eq", 99)),
      404,
      "Tag not found",
    );
    await expectStatus(
      shared,
      one(leaf("fundraising_campaign", "contains", "801;99")),
      404,
      "Fundraising campaign not found",
    );
    await expectStatus(
      shared,
      one(leaf("debt_category", "eq", 99)),
      404,
      "Borç kategorisi bulunamadı.",
    );
    const deleted = await search(shared, one(leaf("debt_category", "eq", 505)));
    expect(deleted.total, "nobody holds a debt in the retired category").toBe(
      0,
    );
    const db = kelder(shared);
    const uncategorised = person(db, "no-category");
    const categorised = person(db, "category");
    dues(db, uncategorised, { status: 1, debt_category_id: null });
    dues(db, categorised, { status: 1, debt_category_id: 501 });
    const none = await matchingIds(
      shared,
      within([uncategorised, categorised], leaf("debt_category", "eq", "none")),
    );
    expect(none, "an uncategorised debt matches none").toEqual([uncategorised]);
  });

  test("text matching folds case under the Turkish locale and treats dotted and dotless i alike", async () => {
    const shared = client();
    const db = kelder(shared);
    const ascii = person(db, "ascii");
    const turkish = person(db, "turkish");
    db.users.update(ascii, { email: "sukru.tekin@kisi.example" });
    db.users.update(turkish, { city_text: "Iğdır", first_name: "Işıl" });
    const scope = [ascii, turkish];
    expect(
      await matchingIds(
        shared,
        within(scope, leaf("email", "eq", "SUKRU.TEKIN@KISI.EXAMPLE")),
      ),
    ).toEqual([ascii]);
    for (const spelling of ["IĞDIR", "iğdır", "Iğdir"]) {
      expect(
        await matchingIds(shared, within(scope, leaf("city", "eq", spelling))),
        spelling,
      ).toEqual([turkish]);
    }
    expect(
      await matchingIds(
        shared,
        within(scope, leaf("first_name", "contains", "IŞI")),
      ),
    ).toEqual([turkish]);
  });

  test("a currency filter takes the ISO code as well as the id", async () => {
    const shared = client();
    const db = kelder(shared);
    const dollar = person(db, "usd");
    const lira = person(db, "try");
    donation(db, dollar, { currencyId: 2 });
    donation(db, lira, { currencyId: 1 });
    const scope = [dollar, lira];
    expect(
      await matchingIds(
        shared,
        within(scope, leaf("donation_currency", "eq", "usd")),
      ),
    ).toEqual([dollar]);
    expect(
      await matchingIds(
        shared,
        within(scope, leaf("donation_currency", "eq", 1)),
      ),
    ).toEqual([lira]);
  });
});

const ORDER_FIELDS = [
  "id",
  "name",
  "first_name",
  "last_name",
  "membership_no",
  "email",
  "phone",
  "tckno",
  "total_financial",
  "birthday",
  "apply_date",
  "join_date",
  "last_update_date",
] as const;

describe("ordering", () => {
  for (const field of ORDER_FIELDS) {
    test(`order_by ${field} sorts ascending and -${field} descending`, async () => {
      const shared = client();
      const db = kelder(shared);
      const ascending = (direction: OrderBy) =>
        search(
          shared,
          { condition: "and", attributes: [leaf("admin", "eq", "false")] },
          {
            orderBy: direction,
            howMany: 100,
            values: ["id"],
          },
        );
      const forward =
        (await ascending(field)).user_list?.map((u) => u.id) ?? [];
      const backward =
        (await ascending(`-${field}`)).user_list?.map((u) => u.id) ?? [];
      const key = (id: number | undefined): string | number => {
        const user = id === undefined ? undefined : db.users.get(id);
        if (!user) return "";
        switch (field) {
          case "id":
            return user.id;
          case "name":
            return `${user.first_name} ${user.last_name}`.trim();
          case "membership_no":
          case "total_financial":
            return user[field];
          case "apply_date":
          case "join_date":
            return Date.parse(user[field]);
          case "last_update_date": {
            const profile = db.contactProfiles.find(
              (row) => row.user_id === user.id,
            );
            return Date.parse(profile?.last_update_date ?? user.apply_date);
          }
          default:
            return user[field];
        }
      };
      const compare = (a: string | number, b: string | number) =>
        typeof a === "number" && typeof b === "number"
          ? a - b
          : String(a).localeCompare(String(b), "tr");
      const keys = forward.map(key);
      expect(forward.length).toBe(100);
      for (let index = 1; index < keys.length; index += 1) {
        const previous = keys[index - 1] ?? "";
        const current = keys[index] ?? "";
        if (previous === "" || current === "") continue;
        expect(
          compare(previous, current),
          `${field} ascending at ${index}`,
        ).toBeLessThanOrEqual(0);
      }
      const backKeys = backward.map(key).filter((value) => value !== "");
      for (let index = 1; index < backKeys.length; index += 1) {
        expect(
          compare(backKeys[index - 1] ?? "", backKeys[index] ?? ""),
          `${field} descending at ${index}`,
        ).toBeGreaterThanOrEqual(0);
      }
      expect(backward[0], `-${field} starts where ${field} would end`).not.toBe(
        forward[0],
      );
    });
  }

  test("users without a value sort after the rest ascending and before them descending", async () => {
    const shared = client();
    const corporatesAnd1004: Group = {
      condition: "or",
      attributes: [
        leaf("corporate_type", "eq", "true"),
        leaf("id", "eq", 1004),
      ],
    };
    const ascending = await search(shared, corporatesAnd1004, {
      orderBy: "birthday",
      values: ["id", "birthday"],
    });
    const list = ascending.user_list ?? [];
    expect(list.length, "1004 and the corporate users").toBeGreaterThan(2);
    expect(list[0]?.id, "the only birthday comes first ascending").toBe(1004);
    expect(list.slice(1).every((user) => user.birthday === null)).toBe(true);
    const descending = await search(shared, corporatesAnd1004, {
      orderBy: "-birthday",
      values: ["id"],
    });
    expect(descending.user_list?.at(-1)?.id).toBe(1004);
  });
});

describe("values_list and pagination", () => {
  test("returns exactly the requested columns, and a user-defined value by key", async () => {
    const shared = client();
    const found = await search(
      shared,
      { condition: "and", attributes: [leaf("id", "eq", 1004)] },
      {
        values: [
          "id",
          "first_name",
          "tags_as_text",
          "user_defined_values__mezuniyet_yili",
          "city_text",
        ],
      },
    );
    const user = kelder(shared).users.get(1004);
    expect(found.user_list).toEqual([
      {
        id: 1004,
        first_name: user?.first_name,
        ...(found.user_list?.[0]?.tags_as_text === undefined
          ? {}
          : { tags_as_text: expect.any(String) }),
        city_text: user?.city_text,
        user_defined_values: {
          mezuniyet_yili: user?.user_defined_values.mezuniyet_yili,
        },
      },
    ]);
  });

  test("a select field comes back as the chosen option, a yes or no field as its yes or no option, and a multiple select as its texts", async () => {
    const shared = client();
    const db = kelder(shared);
    const user = db.users.get(1004);
    const udv = (value: string) =>
      db.userDefinedValues.find((row) => row.value === value);
    const option = (value: string, text: string) => {
      const options = udv(value)?.options ?? [];
      const position = options.findIndex((item) => item.text === text);
      return { id: position + 1, order: position, text };
    };
    const found = await search(
      shared,
      { condition: "and", attributes: [leaf("id", "eq", 1004)] },
      {
        values: [
          "user_defined_values__mezuniyet_yili",
          "user_defined_values__sube",
          "user_defined_values__burs_gonullusu",
          "user_defined_values__ilgi_alanlari",
          "user_defined_values__meslek",
        ],
      },
    );
    const values = user?.user_defined_values ?? {};
    expect(found.user_list).toEqual([
      {
        user_defined_values: {
          mezuniyet_yili: values.mezuniyet_yili,
          sube: option("sube", String(values.sube)),
          burs_gonullusu: option(
            "burs_gonullusu",
            values.burs_gonullusu === true ? "Evet" : "Hayır",
          ),
          ilgi_alanlari: (values.ilgi_alanlari as string[]).join(", "),
          meslek: values.meslek,
        },
      },
    ]);
    const mezuniyet = found.user_list?.[0]?.user_defined_values?.mezuniyet_yili;
    expect(Number.isInteger(mezuniyet), "a number field is an integer").toBe(
      true,
    );
  });

  test("a search without values_list is refused with production's text", async () => {
    const shared = client();
    const response = await shared.call("getUserList", {
      body: {
        search: {
          start_page: 1,
          how_many: 10,
          order_by: "id",
          filter: EVERYONE,
        },
      },
    });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "values_list parametresi eksik" });
    const empty = await search(shared, EVERYONE, { values: [], howMany: 2 });
    expect(empty.user_list, "an empty list asks for no column").toEqual([
      {},
      {},
    ]);
  });

  test("returns every column the schema names for a user that has them all", async () => {
    const shared = client();
    const db = kelder(shared);
    const tagged = db.users.find(
      (user) =>
        !user.corporate_type &&
        user.email !== "" &&
        db.userTags.count((link) => link.user_id === user.id) > 0,
    );
    if (!tagged) throw new Error("no tagged person");
    const found = await search(
      shared,
      { condition: "and", attributes: [leaf("id", "eq", tagged.id)] },
      { values: ALL_USER_COLUMNS },
    );
    const [row] = found.user_list ?? [];
    expect(Object.keys(row ?? {}).sort()).toEqual([...ALL_USER_COLUMNS].sort());
    const names = db.userTags
      .list((link) => link.user_id === tagged.id)
      .map((link) => link.tag_id)
      .sort((a, b) => a - b)
      .map((id) => db.tags.get(id)?.name);
    expect(row?.tags_as_text).toBe(names.join(", "));
    const permission = db.communicationPermissions.find(
      (record) => record.user_id === tagged.id,
    );
    expect(row).toMatchObject({
      allow_comm_via_email: permission?.allow_comm_via_email,
      allow_comm_via_email_date: permission?.allow_comm_via_email_date,
      allow_comm_via_phone: permission?.allow_comm_via_phone,
      allow_comm_via_sms: permission?.allow_comm_via_sms,
      apply_date: tagged.apply_date.slice(0, 10),
      join_date: tagged.join_date.slice(0, 10),
    });
    expect(row?.apply_date, "a calendar day, not a date-time").toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
    const profile = db.contactProfiles.find(
      (record) => record.user_id === tagged.id,
    );
    expect(row?.last_update_date).toBe(profile?.last_update_date);
    expect(row?.last_login_date).toBe(profile?.last_login?.date ?? null);
    expect(row?.profile_pic).toBe(profile?.profile_pic ?? null);
  });

  test("a column a user lacks is null, and a user who never logged in has a null last_login_date", async () => {
    const shared = client();
    const db = kelder(shared);
    const lapsed = db.contactProfiles.find(
      (record) => record.last_login === null,
    );
    if (!lapsed) throw new Error("no profile without a login");
    const found = await search(
      shared,
      { condition: "and", attributes: [leaf("id", "eq", lapsed.user_id)] },
      { values: ["last_login_date", "profile_pic"] },
    );
    expect(found.user_list?.[0]?.last_login_date).toBeNull();
  });

  test("pages through the matching users with a total that ignores paging", async () => {
    const shared = client();
    const all = await search(shared, EVERYONE, { values: ["id"] });
    expect(all.total).toBe(150);
    const third = await search(shared, EVERYONE, {
      startPage: 3,
      howMany: 40,
      values: ["id"],
    });
    expect(third.total).toBe(150);
    expect(third.user_list?.map((user) => user.id)).toEqual(
      Array.from({ length: 40 }, (_, index) => 1081 + index),
    );
    const last = await search(shared, EVERYONE, {
      startPage: 4,
      howMany: 40,
      values: ["id"],
    });
    expect(last.user_list?.length, "150 = 3 × 40 + 30").toBe(30);
    const beyond = await search(shared, EVERYONE, {
      startPage: 5,
      howMany: 40,
      values: ["id"],
    });
    expect(beyond.user_list).toEqual([]);
    const tooMany = await shared.call("getUserList", {
      body: {
        search: {
          start_page: 1,
          how_many: 101,
          order_by: "id",
          filter: EVERYONE,
        },
      },
    });
    expect(tooMany.status, "how_many is at most 100").toBe(400);
  });
});
