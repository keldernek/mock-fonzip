import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { toJson } from "../src/spec/json";
import { specRuntime } from "../src/spec/runtime";
import { loadWaivers, parseWaivers } from "../src/testing/parity";

const { table } = specRuntime();

describe("parity waivers", () => {
  test("the committed waivers parse, and each one carries a reason", () => {
    const raw = toJson(
      JSON.parse(
        readFileSync(
          new URL("../parity-waivers.json", import.meta.url),
          "utf8",
        ),
      ),
    );
    const waivers = parseWaivers(raw, table);
    const all = [...waivers.statuses, ...waivers.inputs, ...waivers.properties];
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((waiver) => waiver.reason.length > 20)).toBe(true);
  });

  test("rejects a waiver without a reason", () => {
    expect(() =>
      parseWaivers(
        {
          statuses: [{ status: 501, operations: "all" }],
          inputs: [],
          properties: [],
        },
        table,
      ),
    ).toThrow("needs a reason");
  });

  test("rejects a waiver that names an unknown operation", () => {
    expect(() =>
      parseWaivers(
        {
          statuses: [],
          inputs: [
            {
              operationId: "getNothing",
              input: "query.x",
              reason: "a long enough reason",
            },
          ],
          properties: [],
        },
        table,
      ),
    ).toThrow("unknown operationId");
  });

  test("merges the global file with every domain's file", () => {
    expect(() => loadWaivers(table)).not.toThrow();
  });

  test("keeps a domain's waivers to the operations it owns", () => {
    const foreign = {
      statuses: [
        {
          status: 404,
          operations: ["getTagsList"],
          reason: "a long enough reason",
        },
      ],
      inputs: [],
      properties: [],
    };
    expect(() => parseWaivers(foreign, table, "giving")).toThrow(
      "belongs to foundation, not giving",
    );
    const broad = {
      statuses: [
        { status: 404, operations: "all", reason: "a long enough reason" },
      ],
      inputs: [],
      properties: [],
    };
    expect(() => parseWaivers(broad, table, "giving")).toThrow(
      "must list its operations",
    );
    const own = {
      statuses: [
        {
          status: 404,
          operations: ["getDonationList"],
          reason: "a long enough reason",
        },
      ],
      inputs: [],
      properties: [],
    };
    expect(parseWaivers(own, table, "giving").statuses).toHaveLength(1);
  });
});
