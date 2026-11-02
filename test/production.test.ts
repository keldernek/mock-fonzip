import { describe, expect, test } from "bun:test";

import type { JsonObject } from "../src/spec/json";
import { applyCorrections } from "../src/spec/production/correct";
import { createTestClient } from "../src/testing/client";

const PAGE = { start_page: 1, how_many: 20 };

function specWith(schemas: JsonObject): JsonObject {
  return { openapi: "3.0.3", components: { schemas } };
}

function schemaOf(spec: JsonObject, name: string): unknown {
  const components = spec.components as JsonObject;
  return (components.schemas as JsonObject)[name];
}

describe("production corrections", () => {
  const base = specWith({
    Row: {
      type: "object",
      required: ["old_name", "gone"],
      properties: {
        old_name: { type: "string" },
        gone: { type: "integer" },
        kind: { type: "integer", enum: [1, 2] },
        link: { $ref: "#/components/schemas/Link", description: "A link" },
        either: { anyOf: [{ type: "string" }, { type: "integer" }] },
        joined: { allOf: [{ $ref: "#/components/schemas/Link" }] },
      },
    },
    Link: { type: "object", properties: { id: { type: "integer" } } },
  });

  test("rename, remove, add and make properties nullable", () => {
    const corrected = applyCorrections(base, [
      {
        at: "#/components/schemas/Row",
        evidence: "test",
        rename: { old_name: "new_name" },
        remove: ["gone"],
        properties: { extra: { type: "boolean" } },
        nullable: ["new_name", "kind", "link", "either", "joined", "extra"],
        require: ["extra", "new_name"],
      },
    ]);
    expect(schemaOf(corrected, "Row")).toEqual({
      type: "object",
      required: ["new_name", "extra"],
      properties: {
        new_name: { type: "string", nullable: true },
        kind: { type: "integer", enum: [1, 2], nullable: true },
        link: {
          description: "A link",
          anyOf: [{ $ref: "#/components/schemas/Link" }, { type: "null" }],
        },
        either: {
          anyOf: [{ type: "string" }, { type: "integer" }, { type: "null" }],
        },
        joined: {
          anyOf: [
            { allOf: [{ $ref: "#/components/schemas/Link" }] },
            { type: "null" },
          ],
        },
        extra: { type: "boolean", nullable: true },
      },
    });
    expect(schemaOf(corrected, "Link"), "other schemas stay").toEqual(
      schemaOf(base, "Link"),
    );
  });

  test("replace a schema found through an escaped pointer", () => {
    const spec: JsonObject = {
      components: {
        responses: {
          List: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { list: { type: "object" } },
                },
              },
            },
          },
        },
      },
    };
    const corrected = applyCorrections(spec, [
      {
        at: "#/components/responses/List/content/application~1json/schema/properties/list",
        evidence: "test",
        replace: { type: "array", items: { type: "integer" } },
      },
    ]);
    expect(corrected).toEqual({
      components: {
        responses: {
          List: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    list: { type: "array", items: { type: "integer" } },
                  },
                },
              },
            },
          },
        },
      },
    });
  });

  test("refuse a pointer that misses, a $ref target and an unknown property", () => {
    const at =
      (pointer: string, extra: object = {}) =>
      () =>
        applyCorrections(base, [{ at: pointer, evidence: "test", ...extra }]);
    expect(at("#/components/schemas/Nope")).toThrow("does not resolve");
    expect(at("#/components/schemas/Row/properties/link")).toThrow(
      "is a $ref to #/components/schemas/Link",
    );
    expect(at("#/components/schemas/Row", { nullable: ["missing"] })).toThrow(
      "has no missing to make nullable",
    );
    expect(at("#/components/schemas/Row", { require: ["missing"] })).toThrow(
      "has no missing to require",
    );
    expect(at("#/components/schemas/Row", { remove: ["missing"] })).toThrow(
      "has no missing to remove",
    );
    expect(
      at("#/components/schemas/Row", { rename: { old_name: "gone" } }),
    ).toThrow("already has gone");
  });
});

describe("production texts", () => {
  test("getMe sends the association phone as null, as production does", async () => {
    const client = createTestClient();
    const me = await client.ok("getMe");
    expect(me.phone).toBeNull();
  });

  test("an unknown permission type gets production's message", async () => {
    const client = createTestClient();
    const list = await client.call("listChangedCommunicationPermissions", {
      path: { permission_type: "fax" },
      query: PAGE,
    });
    const one = await client.call("getCommunicationPermissions", {
      path: { permission_type: "fax", permission_value: "a@b.example" },
    });
    for (const response of [list, one]) {
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "Invalid permission type. must be email, sms or phone",
      });
    }
  });

  test("a dues list without a date window gets production's message", async () => {
    const client = createTestClient();
    const response = await client.call("getMembershipDuesList", {
      query: { ...PAGE, status: "paid" },
    });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Lütfen geçerli bir tarih aralığı girin",
    });
  });

  test("other validation failures keep the mock's own message", async () => {
    const client = createTestClient();
    const response = await client.call("getUserList", {
      body: { values_list: ["id"], search: { ...PAGE, order_by: "-id" } },
    });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: expect.stringMatching(/^Invalid values: /),
    });
  });
});
