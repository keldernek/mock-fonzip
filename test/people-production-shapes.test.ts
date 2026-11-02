import { describe, expect, test } from "bun:test";

import { PEOPLE_CORRECTIONS } from "../src/spec/production/people";
import { isJsonObject, type Json } from "../src/spec/json";
import { specRuntime } from "../src/spec/runtime";
import { USER_COUNT } from "../src/seed/people";
import {
  ALL_USER_COLUMNS,
  client,
  kelder,
  search,
  type Group,
} from "./people-fixtures";

const EVERYONE: Group = { condition: "and", attributes: [] };
const PAGE_OF_20 = 20;

function at(root: Json, ...path: string[]): Json | undefined {
  let node: Json | undefined = root;
  for (const key of path) {
    if (!isJsonObject(node)) return undefined;
    node = node[key];
  }
  return node;
}

describe("the people corrections", () => {
  test("each one names a schema and says what production showed", () => {
    expect(PEOPLE_CORRECTIONS.length).toBeGreaterThan(5);
    for (const correction of PEOPLE_CORRECTIONS) {
      expect(correction.at.startsWith("#/"), correction.at).toBe(true);
      expect(correction.evidence.length, correction.at).toBeGreaterThan(40);
    }
  });

  test("a user search requires values_list, and nothing else new", () => {
    const { spec } = specRuntime();
    const body = at(
      spec,
      "components",
      "requestBodies",
      "GetUserList",
      "content",
      "application/json",
      "schema",
    );
    expect(at(body ?? null, "required")).toEqual(["search", "values_list"]);
  });

  test("a communication lookup has no total, and the changed list keeps it", () => {
    const { table } = specRuntime();
    const shape = (operationId: string) => {
      const schema = table.byOperationId
        .get(operationId)
        ?.responses.get(200)?.schema;
      const properties = at(schema ?? null, "properties");
      return isJsonObject(properties) ? properties : {};
    };
    const list = shape("listChangedCommunicationPermissions");
    const lookup = shape("getCommunicationPermissions");
    expect(Object.keys(list).sort()).toEqual(["permission_list", "total"]);
    expect(Object.keys(lookup)).toEqual(["permission_list"]);
    expect(at(list.permission_list ?? null, "type")).toBe("array");
    expect(at(lookup.permission_list ?? null, "type")).toBe("array");
  });

  test("the lookup keeps every other documented status of the changed list", () => {
    const { table } = specRuntime();
    const statuses = (operationId: string) =>
      [...(table.byOperationId.get(operationId)?.responses.keys() ?? [])].sort(
        (a, b) => a - b,
      );
    expect(statuses("getCommunicationPermissions")).toEqual(
      statuses("listChangedCommunicationPermissions"),
    );
    const responses = (operationId: string) => {
      const route = table.byOperationId.get(operationId);
      return [...(route?.responses.entries() ?? [])]
        .filter(([status]) => status !== 200)
        .map(([status, response]) => [status, response.component]);
    };
    expect(responses("getCommunicationPermissions")).toEqual(
      responses("listChangedCommunicationPermissions"),
    );
  });

  test("user-defined values keep the booleans and arrays a request may carry, while a response never does", () => {
    const { spec } = specRuntime();
    const request = at(
      spec,
      "components",
      "schemas",
      "UserDefinedValuesReference",
      "additionalProperties",
      "anyOf",
    );
    const kinds = Array.isArray(request)
      ? request.map((branch) => at(branch, "type"))
      : [];
    expect(kinds).toContain("boolean");
    expect(kinds).toContain("array");
    const response = at(
      spec,
      "components",
      "schemas",
      "UserDetails",
      "properties",
      "user_defined_values",
      "additionalProperties",
      "anyOf",
    );
    const answered = Array.isArray(response)
      ? response.map((branch) => at(branch, "type"))
      : [];
    expect(answered).toEqual(["integer", "string", "object"]);
  });

  test("a user-defined field is typed as production sends it", () => {
    const { spec } = specRuntime();
    const field = (name: string) =>
      at(
        spec,
        "components",
        "schemas",
        "UserDefinedValues",
        "properties",
        name,
      );
    expect(at(field("for") ?? null, "enum")).toEqual([
      "text",
      "numeric",
      "date",
      "select",
      "select_w_bool",
    ]);
    for (const name of [
      "boolean_true_text",
      "boolean_false_text",
      "select_text",
    ]) {
      expect(at(field(name) ?? null, "type"), name).toBe("string");
      expect(at(field(name) ?? null, "nullable"), name).toBe(true);
    }
    expect(field("changable_by_users")).toBeUndefined();
    const validation = field("validation");
    expect(Object.keys(at(validation ?? null, "properties") as object)).toEqual(
      ["limit", "limit_value", "max", "max_value"],
    );
  });
});

describe("the newest users, which production's order_by=-id listing starts with", () => {
  async function newestPage() {
    const shared = client();
    const found = await search(shared, EVERYONE, {
      orderBy: "-id",
      howMany: PAGE_OF_20,
      values: ALL_USER_COLUMNS,
    });
    return { shared, rows: found.user_list ?? [], total: found.total };
  }

  test("page 1 is 20 rows that carry every requested column", async () => {
    const { rows, total } = await newestPage();
    expect(total).toBe(USER_COUNT);
    expect(rows).toHaveLength(PAGE_OF_20);
    for (const row of rows) {
      // Absent keys are columns the schema cannot carry null for: an empty
      // last_name, email or tags_as_text, and a user with no permission.
      const missing = ALL_USER_COLUMNS.filter((column) => !(column in row));
      for (const column of missing) {
        expect(
          ["last_name", "email", "tags_as_text", "membership_no"],
          `row ${row.id} lacks ${column}`,
        ).toContain(column);
      }
    }
    const ids = rows.map((row) => row.id ?? 0);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
  });

  test("address, city, district and work phone are null on every row", async () => {
    const { rows } = await newestPage();
    for (const column of [
      "address",
      "city_text",
      "district_text",
      "work_phone",
    ] as const) {
      expect(
        rows.map((row) => row[column]),
        column,
      ).toEqual(Array.from({ length: PAGE_OF_20 }, () => null));
    }
  });

  test("birthday, TC kimlik, nationality, country, picture, work place and the phone and sms dates mix null and text", async () => {
    const { rows } = await newestPage();
    for (const column of [
      "birthday",
      "tckno",
      "nationality_text",
      "country_text",
      "profile_pic",
      "work_address",
      "work_city_text",
      "work_country_text",
      "work_district_text",
      "allow_comm_via_phone_date",
      "allow_comm_via_sms_date",
    ] as const) {
      const kinds = new Set(rows.map((row) => typeof row[column]));
      const nulls = rows.filter((row) => row[column] === null).length;
      expect(kinds.has("string"), `${column} has text`).toBe(true);
      expect(nulls, `${column} has null`).toBeGreaterThan(0);
      expect(nulls, `${column} is not all null`).toBeLessThan(PAGE_OF_20);
    }
  });

  test("the dates are calendar days and date-times as production sends them", async () => {
    const { rows } = await newestPage();
    for (const row of rows) {
      expect(row.apply_date, `row ${row.id}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(row.join_date, `row ${row.id}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(row.last_update_date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(row.allow_comm_via_email_date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      if (row.birthday !== null) {
        expect(row.birthday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
    expect(
      rows.some((row) => row.last_login_date === null),
      "a user who never logged in",
    ).toBe(true);
    expect(rows.some((row) => typeof row.last_login_date === "string")).toBe(
      true,
    );
  });

  test("the newest user is sparse, like the detail production showed", async () => {
    const { shared, rows } = await newestPage();
    const newest = rows[0];
    const body = await shared.ok("getUserDetails", {
      path: { user_id: newest?.id ?? 0 },
    });
    const user = body.user;
    expect(newest?.id).toBe(
      Math.max(
        ...kelder(shared)
          .users.list()
          .map((u) => u.id),
      ),
    );
    for (const field of [
      "address",
      "city_text",
      "country_text",
      "district_text",
      "email_second",
      "home_phone_first",
      "post_code",
      "work_address",
      "work_city_text",
      "work_country_text",
      "work_district_text",
      "work_phone",
      "work_post_code",
    ] as const) {
      expect(user?.[field], field).toBeNull();
    }
    for (const field of [
      "tckno",
      "birthday",
      "nationality_text",
      "allow_comm_via_phone_date",
      "allow_comm_via_sms_date",
      "allow_comm_via_email_date",
      "last_update_date",
    ] as const) {
      expect(typeof user?.[field], field).toBe("string");
    }
    expect(user?.apply_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(user?.join_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("the newest user's user-defined values are an integer, a string or an option, never a boolean or an array", async () => {
    const { shared, rows } = await newestPage();
    const body = await shared.ok("getUserDetails", {
      path: { user_id: rows[0]?.id ?? 0 },
    });
    const values = Object.values(body.user?.user_defined_values ?? {});
    const kinds = new Set(
      values.map((value) =>
        typeof value === "number"
          ? Number.isInteger(value)
            ? "integer"
            : "number"
          : typeof value,
      ),
    );
    expect([...kinds].sort()).toEqual(["integer", "object", "string"]);
    for (const value of values) {
      if (typeof value === "object") {
        expect(Object.keys(value).sort()).toEqual(["id", "order", "text"]);
      }
    }
  });

  test("seeding stays deterministic: the same boot gives the same newest page", async () => {
    const first = await newestPage();
    const second = await newestPage();
    expect(second.rows).toEqual(first.rows);
  });
});
