import type { ErrorObject } from "ajv";
import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";

import type { ServedOperationId } from "../src/operations";
import {
  diffShapes,
  displayPath,
  errorTextOf,
  freeFormPropertyNames,
  isRecord,
  kindOf,
  locate,
  MAP_KEY,
  revealEnumMiss,
  safeKey,
  sanitizeErrorText,
  shapeOf,
  type Shape,
} from "../src/prod-parity/shape";
import {
  countLines,
  describeErrors,
  specIssues,
} from "../src/prod-parity/spec-issues";
import {
  assertReadOnly,
  connectProd,
  mockTarget,
  NEVER_CALLED,
  ProdUnavailableError,
  RefusedRequestError,
  type Exchange,
  type ProdOptions,
} from "../src/prod-parity/targets";
import { specRuntime } from "../src/spec/runtime";
import {
  createTestClient,
  routeOf,
  type CallInput,
  type TestClient,
} from "../src/testing/client";

// These tests never touch the network. Every production call goes through a
// fake fetch, and the global fetch is replaced by a guard that fails the run.
const guard = {
  spy: undefined as ReturnType<typeof blockNetwork> | undefined,
};

function blockNetwork() {
  const blocked = Object.assign(
    (): Promise<Response> =>
      Promise.reject(new Error("an offline test reached for the network")),
    { preconnect: (): void => {} },
  );
  return spyOn(globalThis, "fetch").mockImplementation(blocked);
}

beforeAll(() => {
  guard.spy = blockNetwork();
});

afterAll(() => {
  const calls = guard.spy?.mock.calls.length;
  guard.spy?.mockRestore();
  expect(calls, "calls to the global fetch").toBe(0);
});

// Canary values. A canary never belongs in any text the runner prints.
const CANARY = "ZQCANARY";
const CANARY_NUMBER = 918273645;
const CANARY_EMAIL = "zqcanary.person@canary-mail.example";

function expectClean(texts: readonly string[]): void {
  const all = texts.join("\n");
  for (const forbidden of [CANARY, String(CANARY_NUMBER), "canary", "@"]) {
    expect(all, `printed text must not contain ${forbidden}`).not.toContain(
      forbidden,
    );
  }
}

type Obj = Record<string, unknown>;

function obj(value: unknown): Obj {
  if (!isRecord(value)) throw new Error("expected an object");
  return value;
}

function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("expected an array");
  return value;
}

// bun's `rejects` matchers are typed as returning void, so a rejection is
// caught here and checked with a plain matcher.
async function failureOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  return undefined;
}

function paths(shape: Shape): string[] {
  return [...shape.keys()].sort();
}

function kindsAt(shape: Shape, path: string): string[] {
  return [...(shape.get(path) ?? [])].sort();
}

describe("kindOf", () => {
  test("names the JSON kind of a value", () => {
    expect(kindOf("text")).toBe("string");
    expect(kindOf("")).toBe("string");
    expect(kindOf(1)).toBe("integer");
    expect(kindOf(-0)).toBe("integer");
    expect(kindOf(2.0)).toBe("integer");
    expect(kindOf(1.5)).toBe("number");
    expect(kindOf(Number.NaN)).toBe("number");
    expect(kindOf(Number.POSITIVE_INFINITY)).toBe("number");
    expect(kindOf(true)).toBe("boolean");
    expect(kindOf(null)).toBe("null");
    expect(kindOf(undefined)).toBe("null");
    expect(kindOf([])).toBe("array");
    expect(kindOf({})).toBe("object");
  });
});

describe("freeFormPropertyNames and safeKey", () => {
  test("lists the spec's free-form objects and no ordinary property", () => {
    const names = freeFormPropertyNames();
    expect(names.has("user_defined_values")).toBe(true);
    expect(names.has("display_name_translations")).toBe(true);
    expect(names.has("details_translations")).toBe(true);
    for (const ordinary of ["id", "name", "email", "tags", "user_list"]) {
      expect(names.has(ordinary), ordinary).toBe(false);
    }
    expect(freeFormPropertyNames(), "cached").toBe(names);
  });

  test("keeps a field-like name and hides everything else", () => {
    for (const fine of ["id", "user_list", "_x", "A1", "a".repeat(64)]) {
      expect(safeKey(fine, false), fine).toBe(fine);
    }
    const hidden = [
      "kan grubu",
      "2026-10",
      "jane.doe@example.com",
      "1abc",
      "a-b",
      "a.b",
      "",
      "ünïcode",
      "a".repeat(65),
      "tab\there",
      "new\nline",
      "a/b",
      "{*}",
    ];
    for (const key of hidden) {
      expect(safeKey(key, false), JSON.stringify(key)).toBe(MAP_KEY);
    }
  });

  test("hides every key inside a free-form map, field-like or not", () => {
    expect(safeKey("blood_type", true)).toBe(MAP_KEY);
    expect(safeKey("id", true)).toBe(MAP_KEY);
    expect(safeKey("user_defined_values__x", true)).toBe(MAP_KEY);
  });

  test("collapses a user_defined_values__ key to one placeholder", () => {
    for (const key of [
      "user_defined_values__kan grubu",
      "user_defined_values__blood_type",
      "user_defined_values__",
      "user_defined_values__a@b.co",
    ]) {
      expect(safeKey(key, false), key).toBe("user_defined_values__{*}");
    }
    expect(safeKey("user_defined_values", false)).toBe("user_defined_values");
  });
});

describe("shapeOf", () => {
  const body = {
    total: CANARY_NUMBER,
    rows: [
      {
        id: CANARY_NUMBER,
        name: `${CANARY}-name`,
        tags: [`${CANARY}-tag`],
        user_defined_values: {
          "kan grubu": `${CANARY}-A`,
          blood_type: `${CANARY}-0`,
          ZQCANARY_inside_map: CANARY_NUMBER,
          [CANARY_EMAIL]: true,
          "2026-10": null,
        },
      },
      { id: 1.5, name: null, tags: [], user_defined_values: {} },
    ],
    [CANARY_EMAIL]: 1,
    "2026-10": 2,
    "has space": 3,
    "user_defined_values__kan grubu": `${CANARY}-udv1`,
    user_defined_values__blood_type: `${CANARY}-udv2`,
    display_name_translations: { en: `${CANARY}-en`, tr: `${CANARY}-tr` },
  };

  test("folds arrays to [] and merges the kinds of every row", () => {
    const shape = shapeOf(body);
    expect(kindsAt(shape, "")).toEqual(["object"]);
    expect(kindsAt(shape, "rows")).toEqual(["array"]);
    expect(kindsAt(shape, "rows[]")).toEqual(["object"]);
    expect(kindsAt(shape, "rows[].id")).toEqual(["integer", "number"]);
    expect(kindsAt(shape, "rows[].name")).toEqual(["null", "string"]);
    expect(kindsAt(shape, "rows[].tags")).toEqual(["array"]);
    expect(kindsAt(shape, "rows[].tags[]")).toEqual(["string"]);
    expect(kindsAt(shape, "total")).toEqual(["integer"]);
  });

  test("shows a free-form map's keys as {*} and merges their kinds", () => {
    const shape = shapeOf(body);
    expect(kindsAt(shape, "rows[].user_defined_values")).toEqual(["object"]);
    expect(kindsAt(shape, "rows[].user_defined_values.{*}")).toEqual([
      "boolean",
      "integer",
      "null",
      "string",
    ]);
    expect(kindsAt(shape, "display_name_translations.{*}")).toEqual(["string"]);
  });

  test("shows a key that is not field-like as {*}, and collapses user_defined_values__ keys", () => {
    const shape = shapeOf(body);
    expect(kindsAt(shape, "{*}")).toEqual(["integer"]);
    expect(paths(shape)).toEqual([
      "",
      "display_name_translations",
      "display_name_translations.{*}",
      "rows",
      "rows[]",
      "rows[].id",
      "rows[].name",
      "rows[].tags",
      "rows[].tags[]",
      "rows[].user_defined_values",
      "rows[].user_defined_values.{*}",
      "total",
      "user_defined_values__{*}",
      "{*}",
    ]);
    expect(kindsAt(shape, "user_defined_values__{*}")).toEqual(["string"]);
  });

  test("never lets a value or a map key into a path", () => {
    expectClean(paths(shapeOf(body)));
    expectClean(paths(shapeOf([body])));
  });

  test("hides keys at every depth below a free-form map", () => {
    const nested = {
      user: {
        user_defined_values: {
          kan_grubu: {
            ZQCANARY_second: { ZQCANARY_third: 1 },
            list: [{ ZQCANARY_in_array: [{ ZQCANARY_deep: 1 }] }],
          },
        },
      },
    };
    const shape = shapeOf(nested);
    expectClean(paths(shape));
    expect(paths(shape)).toEqual([
      "",
      "user",
      "user.user_defined_values",
      "user.user_defined_values.{*}",
      "user.user_defined_values.{*}.{*}",
      "user.user_defined_values.{*}.{*}.{*}",
      "user.user_defined_values.{*}.{*}[]",
      "user.user_defined_values.{*}.{*}[].{*}",
      "user.user_defined_values.{*}.{*}[].{*}[]",
      "user.user_defined_values.{*}.{*}[].{*}[].{*}",
    ]);
  });

  test("describes a bare value, an empty body and a root array", () => {
    expect(paths(shapeOf(`${CANARY}`))).toEqual([""]);
    expect(kindsAt(shapeOf(`${CANARY}`), "")).toEqual(["string"]);
    expect(kindsAt(shapeOf(undefined), "")).toEqual(["null"]);
    const rootArray = shapeOf([{ id: 1 }, { id: 2 }]);
    expect(paths(rootArray)).toEqual(["", "[]", "[].id"]);
    expect(kindsAt(rootArray, "")).toEqual(["array"]);
  });
});

describe("locate", () => {
  test("returns the root for an empty pointer", () => {
    const body = { a: 1 };
    expect(locate(body, "")).toEqual({
      path: "",
      value: body,
      insideMap: false,
    });
  });

  test("walks through arrays and folds the index to []", () => {
    const body = { rows: [{ id: 1 }, { id: 2, items: [{ ok: true }, 7] }] };
    expect(locate(body, "/rows/1/id")).toEqual({
      path: "rows[].id",
      value: 2,
      insideMap: false,
    });
    expect(locate(body, "/rows/1/items/0/ok").path).toBe("rows[].items[].ok");
    expect(locate(body, "/rows/1/items/1")).toEqual({
      path: "rows[].items[]",
      value: 7,
      insideMap: false,
    });
    expect(locate([[1]], "/0/0")).toEqual({
      path: "[][]",
      value: 1,
      insideMap: false,
    });
  });

  test("walks through free-form maps and hides their keys", () => {
    const body = {
      user: { user_defined_values: { "kan grubu": `${CANARY}`, list: [1, 2] } },
    };
    const atMap = locate(body, "/user/user_defined_values");
    expect(atMap.path).toBe("user.user_defined_values");
    expect(atMap.insideMap).toBe(true);
    const atEntry = locate(body, "/user/user_defined_values/kan grubu");
    expect(atEntry.path).toBe("user.user_defined_values.{*}");
    expect(atEntry.value).toBe(CANARY);
    const atItem = locate(body, "/user/user_defined_values/list/1");
    expect(atItem.path).toBe("user.user_defined_values.{*}[]");
    expect(atItem.value).toBe(2);
    expectClean([atMap.path, atEntry.path, atItem.path]);
  });

  test("hides keys at every depth below a free-form map", () => {
    const body = {
      user_defined_values: {
        kan_grubu: { ZQCANARY_second: { ZQCANARY_third: [{ ZQCANARY_4: 1 }] } },
      },
    };
    const found = locate(
      body,
      "/user_defined_values/kan_grubu/ZQCANARY_second/ZQCANARY_third/0/ZQCANARY_4",
    );
    expect(found.value).toBe(1);
    expect(found.path).toBe("user_defined_values.{*}.{*}.{*}[].{*}");
    expect(found.insideMap).toBe(true);
    expectClean([found.path]);
  });

  test("undoes the ~1 and ~0 escapes in the right order", () => {
    const body = { "a/b": { "c~d": 5 }, "~1": 7, "~0": 8, "x~": 9 };
    const slash = locate(body, "/a~1b/c~0d");
    expect(slash.value).toBe(5);
    expect(slash.path).toBe("{*}.{*}");
    expect(locate(body, "/~01").value, "~01 is a literal ~1").toBe(7);
    expect(locate(body, "/~00").value, "~00 is a literal ~0").toBe(8);
    expect(locate(body, "/x~0").value).toBe(9);
    expect(locate(body, "/a~1b").path).toBe(MAP_KEY);
  });

  test("returns an undefined value for a pointer that leads nowhere", () => {
    const body = { rows: [1], n: 4 };
    expect(locate(body, "/missing/deeper").value).toBeUndefined();
    expect(locate(body, "/rows/9").value).toBeUndefined();
    expect(locate(body, "/n/deeper").value).toBeUndefined();
    expect(locate(undefined, "/a").value).toBeUndefined();
    expect(locate(body, "/missing/deeper").path).toBe("missing.deeper");
  });

  test("hides a key that is not field-like on the way", () => {
    const body = { "jane.doe@example.com": { id: 3 } };
    const found = locate(body, "/jane.doe@example.com/id");
    expect(found.value).toBe(3);
    expect(found.path).toBe("{*}.id");
  });
});

describe("diffShapes", () => {
  test("reports nothing for equal shapes", () => {
    const diff = diffShapes(
      shapeOf({ a: [{ b: 1 }], c: "x" }),
      shapeOf({ a: [{ b: 2 }, { b: 3 }], c: "y" }),
    );
    expect(diff).toEqual({
      prodOnly: [],
      mockOnly: [],
      prodKinds: [],
      mockKinds: [],
    });
  });

  test("counts integer and number as one kind", () => {
    const diff = diffShapes(
      shapeOf({ amount: 10, rows: [{ n: 1 }] }),
      shapeOf({ amount: 10.5, rows: [{ n: 2.5 }, { n: 3 }] }),
    );
    expect(diff.prodKinds).toEqual([]);
    expect(diff.mockKinds).toEqual([]);
    const reverse = diffShapes(
      shapeOf({ amount: 10.5 }),
      shapeOf({ amount: 10 }),
    );
    expect(reverse.prodKinds).toEqual([]);
    expect(reverse.mockKinds).toEqual([]);
  });

  test("names a prod-only path with its kinds", () => {
    const diff = diffShapes(
      shapeOf({ rows: [{ id: 1, extra: "x", more: [1], gone: null }] }),
      shapeOf({ rows: [{ id: 2 }] }),
    );
    expect(diff.prodOnly).toEqual([
      "rows[].extra (string)",
      "rows[].gone (null)",
      "rows[].more (array, 1 nested)",
    ]);
    expect(diff.mockOnly).toEqual([]);
  });

  test("collapses nested prod-only paths under their parent with a count", () => {
    const diff = diffShapes(
      shapeOf({
        id: 1,
        extra: { a: { b: 1 }, c: [1, 2] },
        extra2: { x: 1 },
        deep: { l1: { l2: { l3: 1 } } },
      }),
      shapeOf({ id: 1, deep: {} }),
    );
    expect(diff.prodOnly).toEqual([
      "deep.l1 (object, 2 nested)",
      "extra (object, 4 nested)",
      "extra2 (object, 1 nested)",
    ]);
  });

  test("lists a mock-only path the same way, and a whole missing array row", () => {
    const diff = diffShapes(
      shapeOf({ rows: [] }),
      shapeOf({ rows: [{ id: 1, tags: ["x"] }], note: { a: 1 } }),
    );
    expect(diff.prodOnly).toEqual([]);
    expect(diff.mockOnly).toEqual([
      "note (object, 1 nested)",
      "rows[] (object, 3 nested)",
    ]);
  });

  test("reports a kind production sent that the mock never does", () => {
    const diff = diffShapes(
      shapeOf({ a: null, b: "s", c: 1, d: [1], e: { k: 1 } }),
      shapeOf({ a: { x: 1 }, b: "s", c: 1.5, d: [], e: 5 }),
    );
    expect(diff.prodKinds).toEqual([
      "a prod null, mock object",
      "e prod object, mock number",
    ]);
    expect(diff.mockKinds).toEqual([]);
    expect(diff.prodOnly).toEqual(["d[] (number)", "e.k (number)"]);
    expect(diff.mockOnly).toEqual(["a.x (number)"]);
  });

  test("reports a kind only the mock sent, as data-dependent", () => {
    const diff = diffShapes(
      shapeOf({ rows: [{ x: "s" }] }),
      shapeOf({ rows: [{ x: "s" }, { x: null }] }),
    );
    expect(diff.mockKinds).toEqual(["rows[].x prod string, mock null|string"]);
    expect(diff.prodKinds).toEqual([]);
  });

  test("puts a root mismatch under (body)", () => {
    const diff = diffShapes(shapeOf(`${CANARY}`), shapeOf({ a: 1 }));
    expect(diff.prodKinds).toEqual(["(body) prod string, mock object"]);
    expect(diff.mockOnly).toEqual(["a (number)"]);
    expect(displayPath("")).toBe("(body)");
    expect(displayPath("a.b")).toBe("a.b");
  });

  test("treats differently named free-form keys as the same shape", () => {
    const diff = diffShapes(
      shapeOf({
        user_defined_values: { kan_grubu: `${CANARY}`, "2026-10": 5 },
        "user_defined_values__blood type": 1,
      }),
      shapeOf({
        user_defined_values: { mezuniyet_yili: 2010 },
        user_defined_values__sube: 1,
      }),
    );
    expect(diff.prodOnly).toEqual([]);
    expect(diff.mockOnly).toEqual([]);
    expect(diff.prodKinds).toEqual([
      "user_defined_values.{*} prod number|string, mock number",
    ]);
  });

  test("prints no value, key or email from either body", () => {
    const prod = shapeOf({
      rows: [
        {
          id: CANARY_NUMBER,
          name: CANARY,
          [CANARY_EMAIL]: CANARY,
          "has space": [CANARY],
          user_defined_values: { ZQCANARY_k: CANARY, [CANARY_EMAIL]: 1 },
          user_defined_values__ZQCANARY: CANARY,
          extra: { nested: { deeper: CANARY_NUMBER } },
        },
      ],
      [CANARY_EMAIL]: { [CANARY]: { [CANARY_EMAIL]: CANARY_NUMBER } },
    });
    const mock = shapeOf({
      rows: [{ id: 1.5, name: null }],
      mock_only: [{ [CANARY_EMAIL]: CANARY }],
    });
    const diff = diffShapes(prod, mock);
    const lines = [
      ...diff.prodOnly,
      ...diff.mockOnly,
      ...diff.prodKinds,
      ...diff.mockKinds,
    ];
    expect(lines.length).toBeGreaterThan(0);
    expectClean(lines);
    expectClean(lines.concat(diffShapes(mock, prod).prodOnly));
  });
});

describe("revealEnumMiss", () => {
  test("shows numbers and booleans, which are codes", () => {
    expect(revealEnumMiss(5)).toBe("5");
    expect(revealEnumMiss(0)).toBe("0");
    expect(revealEnumMiss(-1.5)).toBe("-1.5");
    expect(revealEnumMiss(true)).toBe("true");
    expect(revealEnumMiss(false)).toBe("false");
  });

  test("never shows a string, only that it is one", () => {
    expect(revealEnumMiss(CANARY)).toBe("a string");
    expect(revealEnumMiss("")).toBe("a string");
    expect(revealEnumMiss(CANARY_EMAIL)).toBe("a string");
    expect(revealEnumMiss("5")).toBe("a string");
    expect(revealEnumMiss("true")).toBe("a string");
  });

  test("names null, missing, object and array values by kind", () => {
    expect(revealEnumMiss(null)).toBe("null");
    expect(revealEnumMiss(undefined)).toBe("null");
    expect(revealEnumMiss({ k: CANARY })).toMatch(/^an? object$/);
    expect(revealEnumMiss([CANARY])).toMatch(/^an? array$/);
  });
});

describe("sanitizeErrorText", () => {
  test("masks emails wherever they sit", () => {
    expect(sanitizeErrorText("User jane.doe@example.com not found")).toBe(
      "User <email> not found",
    );
    expect(sanitizeErrorText('no "a+b@c.co" or <x@y.org>, or z@w.net.')).toBe(
      'no "<email>" or <<email>>, or <email>',
    );
    expect(sanitizeErrorText("ĞÜŞ@örnek.com.tr")).toBe("<email>");
    const several = sanitizeErrorText(`${CANARY_EMAIL} and ${CANARY_EMAIL}`);
    expect(several).toBe("<email> and <email>");
    expectClean([several]);
  });

  test("masks every digit run of four or more", () => {
    expect(sanitizeErrorText("id 1234567 missing")).toBe("id <digits> missing");
    expect(sanitizeErrorText("tckno 82808201650")).toBe("tckno <digits>");
    expect(sanitizeErrorText("phone +905328438658")).toBe("phone +<digits>");
    expect(sanitizeErrorText("1234")).toBe("<digits>");
    expect(sanitizeErrorText("a1b22c333d")).toBe("a1b22c333d");
    expect(sanitizeErrorText("limit 100, page 3")).toBe("limit 100, page 3");
  });

  test("masks a number written in groups, as a phone number or a date is", () => {
    for (const text of [
      "phone 0532 843 86 58",
      "phone +90 532 843 86 58",
      "phone 0532-843-8658",
      "phone (532) 843 86 58",
      "date 2026-10-31",
      "date 31.10.2026",
      "card 12 34 56 78",
    ]) {
      expect(sanitizeErrorText(text), text).not.toMatch(/\d{2}/);
      expect(sanitizeErrorText(text), text).not.toMatch(/\d\D\d/);
    }
  });

  test("replaces control characters with spaces", () => {
    const text = sanitizeErrorText("a\nb\tc\u0000d\u001b[31me\u007ff\r\ng");
    for (const char of text) {
      const code = char.charCodeAt(0);
      expect(code >= 32 && code !== 127, JSON.stringify(char)).toBe(true);
    }
    expect(text).toBe("a b c d [31me f  g");
  });

  test("replaces C1 controls, separators and bidi overrides that a terminal acts on", () => {
    const text = sanitizeErrorText(
      "a\u0085b\u009bc\u009dd\u0090e\u009ff\u2028g\u2029h\u202ei\u2066j\u2069k",
    );
    expect(text.replaceAll(/\s+/g, " ")).toBe("a b c d e f g h i j k");
    for (const char of text) {
      const code = char.charCodeAt(0);
      const label = `U+${code.toString(16)}`;
      expect(code >= 0x7f && code <= 0x9f, label).toBe(false);
      expect(code === 0x2028 || code === 0x2029, label).toBe(false);
      expect(code >= 0x202a && code <= 0x202e, label).toBe(false);
      expect(code >= 0x2066 && code <= 0x2069, label).toBe(false);
    }
  });

  test("trims the ends and keeps an empty text empty", () => {
    expect(sanitizeErrorText("  \n padded \t ")).toBe("padded");
    expect(sanitizeErrorText("")).toBe("");
    expect(sanitizeErrorText(" \n\t ")).toBe("");
  });

  test("cuts a long text at 160 characters and marks the cut", () => {
    expect(sanitizeErrorText("x".repeat(160))).toBe("x".repeat(160));
    expect(sanitizeErrorText("x".repeat(161))).toBe(`${"x".repeat(160)}…`);
    expect(sanitizeErrorText("x".repeat(5000))).toBe(`${"x".repeat(160)}…`);
    expect(sanitizeErrorText("x".repeat(159))).toBe("x".repeat(159));
  });

  test("masks before it cuts, so a cut never leaves half an email or number", () => {
    for (let pad = 140; pad <= 165; pad += 1) {
      const withEmail = sanitizeErrorText(`${"x".repeat(pad)} ${CANARY_EMAIL}`);
      expect(withEmail, `pad ${pad}`).not.toContain("canary");
      expect(withEmail, `pad ${pad}`).not.toContain("@");
      const withDigits = sanitizeErrorText(`${"x".repeat(pad)} 918273645`);
      expect(withDigits, `pad ${pad}`).not.toMatch(/\d{2}/);
      expect(withDigits.length).toBeLessThanOrEqual(161);
    }
  });
});

describe("errorTextOf", () => {
  test("is null for anything that is not an object body", () => {
    for (const body of [
      undefined,
      null,
      CANARY,
      "",
      0,
      42,
      true,
      [],
      [{ error: CANARY }],
    ]) {
      expect(errorTextOf(body), JSON.stringify(body)).toBeNull();
    }
  });

  test("is null when no error text is a non-empty string", () => {
    expect(errorTextOf({})).toBeNull();
    expect(errorTextOf({ error: "" })).toBeNull();
    expect(errorTextOf({ error: "", error_description: "" })).toBeNull();
    expect(errorTextOf({ error: 5, error_description: null })).toBeNull();
    expect(errorTextOf({ error: { message: CANARY } })).toBeNull();
    expect(errorTextOf({ error: [CANARY] })).toBeNull();
  });

  test("joins the error and its description", () => {
    expect(errorTextOf({ error: "invalid_request" })).toBe("invalid_request");
    expect(
      errorTextOf({
        error: "invalid_request",
        error_description: "Invalid Request",
      }),
    ).toBe("invalid_request: Invalid Request");
    expect(errorTextOf({ error_description: "only this" })).toBe("only this");
    expect(errorTextOf({ error: "x", error_description: "" })).toBe("x");
    expect(errorTextOf({ error: 7, error_description: "y" })).toBe("y");
  });

  test("masks the text and reads no other field", () => {
    const text = errorTextOf({
      error: `No user ${CANARY_EMAIL}`,
      error_description: "tckno 82808201650",
      message: `${CANARY} message`,
      detail: CANARY,
      errors: [CANARY],
      user: { email: CANARY_EMAIL },
    });
    // The email pattern swallows the colon that follows it; that only masks more.
    expect(text).toMatch(/^No user <email>:? tckno <digits>$/);
    expectClean([text ?? ""]);
  });

  test("cuts and cleans the joined text", () => {
    const text = errorTextOf({
      error: "a\nb",
      error_description: "c".repeat(400),
    });
    expect(text?.startsWith("a b: ccc")).toBe(true);
    expect(text?.length).toBe(161);
    expect(text?.endsWith("…")).toBe(true);
  });
});

describe("describeErrors with hand-built ajv errors", () => {
  function error(
    keyword: string,
    instancePath: string,
    params: Record<string, unknown> = {},
  ): ErrorObject {
    return { keyword, instancePath, schemaPath: "#/x", params, message: "" };
  }

  test("names an undocumented property and the kind it holds", () => {
    const body = { rows: [{ id: 1, ZQ_extra: CANARY }] };
    expect(
      describeErrors(body, [
        error("additionalProperties", "/rows/0", {
          additionalProperty: "ZQ_extra",
        }),
      ]),
    ).toEqual(["rows[].ZQ_extra: undocumented property (prod sent string)"]);
  });

  test("hides an undocumented property whose name is not field-like", () => {
    const body = { [CANARY_EMAIL]: CANARY_NUMBER, "kan grubu": true };
    const lines = describeErrors(body, [
      error("additionalProperties", "", {
        additionalProperty: CANARY_EMAIL,
      }),
      error("additionalProperties", "", { additionalProperty: "kan grubu" }),
    ]);
    expect(lines).toEqual([
      "{*}: undocumented property (prod sent integer)",
      "{*}: undocumented property (prod sent boolean)",
    ]);
    expectClean(lines);
  });

  test("hides an undocumented property that sits directly in a free-form map", () => {
    const body = { user_defined_values: { ZQ_ident: 1 } };
    expect(
      describeErrors(body, [
        error("additionalProperties", "/user_defined_values", {
          additionalProperty: "ZQ_ident",
        }),
      ]),
    ).toEqual([
      "user_defined_values.{*}: undocumented property (prod sent integer)",
    ]);
  });

  test("names a missing property from the spec", () => {
    expect(
      describeErrors({ webhook: {} }, [
        error("required", "/webhook", { missingProperty: "url" }),
      ]),
    ).toEqual(["webhook.url: missing, the spec requires it"]);
    expect(
      describeErrors({}, [error("required", "", { missingProperty: "id" })]),
    ).toEqual(["id: missing, the spec requires it"]);
  });

  test("shows numbers and booleans that miss an enum or a const, never strings", () => {
    const body = { a: 99, b: true, c: CANARY, d: null, e: { k: CANARY } };
    const lines = describeErrors(body, [
      error("enum", "/a", { allowedValues: [1, 2] }),
      error("enum", "/b", { allowedValues: ["x", "y"] }),
      error("enum", "/c", { allowedValues: [1, 2] }),
      error("const", "/a", { allowedValue: 7 }),
      error("const", "/c", { allowedValue: "fixed" }),
      error("enum", "/d", { allowedValues: [1] }),
      error("enum", "/e", { allowedValues: [1] }),
    ]);
    expect(lines).toEqual([
      "a: outside the spec enum [1,2], prod sent 99",
      "a: the spec requires 7, prod sent 99",
      'b: outside the spec enum ["x","y"], prod sent true',
      "c: outside the spec enum [1,2], prod sent a string",
      'c: the spec requires "fixed", prod sent a string',
      "d: outside the spec enum [1], prod sent null",
      expect.stringMatching(
        /^e: outside the spec enum \[1\], prod sent an? object$/,
      ),
    ]);
    expectClean(lines);
  });

  test("describes a format miss without the value", () => {
    const lines = describeErrors({ at: CANARY }, [
      error("format", "/at", { format: "date-time" }),
    ]);
    expect(lines).toEqual([
      "at: not a valid date-time (prod sent a string in another format)",
    ]);
    expectClean(lines);
  });

  test("prints the spec's limits and patterns, nothing from the body", () => {
    const body = { n: CANARY_NUMBER, s: CANARY, l: [CANARY], o: { k: CANARY } };
    const lines = describeErrors(body, [
      error("minimum", "/n", { comparison: ">=", limit: 1 }),
      error("exclusiveMaximum", "/n", { comparison: "<", limit: 5 }),
      error("maxLength", "/s", { limit: 3 }),
      error("pattern", "/s", { pattern: "^[a-z]+$" }),
      error("multipleOf", "/n", { multipleOf: 0.5 }),
      error("minItems", "/l", { limit: 2 }),
      error("maxProperties", "/o", { limit: 0 }),
      error("uniqueItems", "/l", { i: 0, j: 1 }),
      error("propertyNames", "/o", { propertyName: CANARY }),
      error("dependencies", "/o", {
        property: CANARY,
        missingProperty: CANARY,
      }),
    ]);
    // Lines come out grouped by the path they belong to, in first-seen order.
    expect(lines).toEqual([
      'n: breaks the spec\'s minimum comparison=">=" limit=1',
      'n: breaks the spec\'s exclusiveMaximum comparison="<" limit=5',
      "n: breaks the spec's multipleOf multipleOf=0.5",
      "s: breaks the spec's maxLength limit=3",
      's: breaks the spec\'s pattern pattern="^[a-z]+$"',
      "l: breaks the spec's minItems limit=2",
      "l: breaks the spec's uniqueItems",
      "o: breaks the spec's maxProperties limit=0",
      "o: breaks the spec's propertyNames",
      "o: breaks the spec's dependencies",
    ]);
    expectClean(lines);
  });

  test("reports a type miss and joins the allowed types", () => {
    const body = { a: CANARY, b: 1.5, c: null, d: [CANARY] };
    expect(
      describeErrors(body, [
        error("type", "/a", { type: "integer" }),
        error("type", "/b", { type: "integer" }),
        error("type", "/c", { type: "string,null" }),
        error("type", "/d", { type: ["object", "null"] }),
      ]),
    ).toEqual([
      "a: the spec allows integer, prod sent string",
      "b: the spec allows integer, prod sent number",
      "c: the spec allows null|string, prod sent null",
      "d: the spec allows null|object, prod sent array",
    ]);
  });

  test("drops the other branches' type errors when a branch matched its type", () => {
    const body = { c: { ZQ_key: CANARY } };
    expect(
      describeErrors(body, [
        error("additionalProperties", "/c", { additionalProperty: "ZQ_key" }),
        error("type", "/c", { type: "null" }),
        error("anyOf", "/c"),
      ]),
    ).toEqual(["c.ZQ_key: undocumented property (prod sent string)"]);
  });

  test("drops a type error that has errors below it", () => {
    const body = { c: { id: CANARY } };
    expect(
      describeErrors(body, [
        error("type", "/c/id", { type: "integer" }),
        error("type", "/c", { type: "null" }),
        error("anyOf", "/c"),
      ]),
    ).toEqual(["c.id: the spec allows integer, prod sent string"]);
  });

  test("says when a value matches no branch and no type explains why", () => {
    expect(
      describeErrors({ v: 1 }, [error("oneOf", "/v"), error("anyOf", "/v")]),
    ).toEqual(["v: matches no single oneOf branch of the spec"]);
    expect(describeErrors({ v: 1 }, [error("anyOf", "/v")])).toEqual([
      "v: matches no anyOf branch of the spec",
    ]);
    expect(
      describeErrors({ v: 1 }, [
        error("type", "/v", { type: "string" }),
        error("oneOf", "/v"),
      ]),
    ).toEqual(["v: the spec allows string, prod sent integer"]);
    expect(describeErrors(1, [error("anyOf", "")])).toEqual([
      "(body): matches no anyOf branch of the spec",
    ]);
  });

  test("is empty without errors", () => {
    expect(describeErrors({ a: 1 }, [])).toEqual([]);
  });
});

describe("countLines", () => {
  test("counts repeats, sorts, and leaves single lines bare", () => {
    expect(countLines(["b", "a", "b", "c", "b"])).toEqual(["a", "b (×3)", "c"]);
    expect(countLines(["x", "x"])).toEqual(["x (×2)"]);
    expect(countLines([])).toEqual([]);
  });
});

describe("specIssues against real routes", () => {
  const client = createTestClient({
    rateLimit: { limit: 1_000_000, windowMs: 60_000 },
  });

  async function bodyOf(
    operationId: ServedOperationId,
    input: CallInput = {},
  ): Promise<Obj> {
    const response = await client.call(operationId, input);
    expect(response.status, operationId).toBe(200);
    return obj(structuredClone(response.body));
  }

  async function userList(): Promise<Obj> {
    return bodyOf("getUserList", {
      body: {
        values_list: ["id", "email"],
        search: {
          start_page: 1,
          how_many: 3,
          order_by: "id",
          filter: {
            condition: "and",
            attributes: [
              {
                type: "default",
                parameter: "id",
                condition: "gt",
                value: "0",
              },
            ],
          },
        },
      },
    });
  }

  async function dueWithCategory(): Promise<Obj> {
    return bodyOf("getMembershipDueDetails", {
      path: { subscription_id: 20003 },
    });
  }

  async function tags(): Promise<Obj> {
    return bodyOf("getUsersTagsList", {
      path: { user_id: 1001 },
      query: { start_page: 1, how_many: 5 },
    });
  }

  test("the real routes exist and the mock's own bodies are clean", async () => {
    expect(specRuntime().table.byOperationId.has("getUserList")).toBe(true);
    expect(specIssues(routeOf("getMe"), 200, await bodyOf("getMe"))).toEqual(
      [],
    );
    expect(specIssues(routeOf("getUserList"), 200, await userList())).toEqual(
      [],
    );
    expect(
      specIssues(
        routeOf("getUserDetails"),
        200,
        await bodyOf("getUserDetails", { path: { user_id: 1001 } }),
      ),
    ).toEqual([]);
    expect(
      specIssues(
        routeOf("listChangedCommunicationPermissions"),
        200,
        await bodyOf("listChangedCommunicationPermissions", {
          path: { permission_type: "email" },
          query: { start_page: 1, how_many: 2 },
        }),
      ),
    ).toEqual([]);
    expect(
      specIssues(
        routeOf("getMembershipDueDetails"),
        200,
        await dueWithCategory(),
      ),
    ).toEqual([]);
  });

  test("accepts an error body the spec documents", () => {
    expect(
      specIssues(routeOf("getMe"), 401, { error: "Unauthorized" }),
    ).toEqual([]);
    expect(specIssues(routeOf("getMe"), 429, { error: "Slow down" })).toEqual(
      [],
    );
  });

  test("reports an undocumented property by name and kind", async () => {
    const me = await bodyOf("getMe");
    const lines = specIssues(routeOf("getMe"), 200, {
      ...me,
      ZQ_object: { a: CANARY },
      ZQ_string: CANARY,
      ZQ_number: CANARY_NUMBER,
      ZQ_float: 1.5,
      ZQ_flag: false,
      ZQ_nothing: null,
      ZQ_list: [CANARY],
    });
    expect(lines).toEqual([
      "ZQ_flag: undocumented property (prod sent boolean)",
      "ZQ_float: undocumented property (prod sent number)",
      "ZQ_list: undocumented property (prod sent array)",
      "ZQ_nothing: undocumented property (prod sent null)",
      "ZQ_number: undocumented property (prod sent integer)",
      "ZQ_object: undocumented property (prod sent object)",
      "ZQ_string: undocumented property (prod sent string)",
    ]);
    expectClean(lines);
  });

  test("reports an undocumented property on a list row and on an error body", async () => {
    const body = await userList();
    list(body.user_list).forEach((row) => {
      obj(row).ZQ_extra = CANARY;
    });
    expect(specIssues(routeOf("getUserList"), 200, body)).toEqual([
      "user_list[].ZQ_extra: undocumented property (prod sent string) (×3)",
    ]);
    expect(
      specIssues(routeOf("getMe"), 401, { error: "x", ZQ_detail: CANARY }),
    ).toEqual(["ZQ_detail: undocumented property (prod sent string)"]);
  });

  test("hides an undocumented property whose name is not field-like", async () => {
    const body = await userList();
    const [first, second] = list(body.user_list).map(obj);
    if (!first || !second) throw new Error("expected two rows");
    first["user_defined_values__kan grubu"] = CANARY;
    first[CANARY_EMAIL] = CANARY_NUMBER;
    second["kan grubu"] = true;
    second["2026-10"] = CANARY;
    const lines = specIssues(routeOf("getUserList"), 200, body);
    expect(lines).toEqual([
      "user_list[].user_defined_values__{*}: undocumented property (prod sent string)",
      "user_list[].{*}: undocumented property (prod sent boolean)",
      "user_list[].{*}: undocumented property (prod sent integer)",
      "user_list[].{*}: undocumented property (prod sent string)",
    ]);
    expectClean(lines);
  });

  test("accepts any content inside a free-form map and prints nothing about it", async () => {
    const body = await userList();
    const [first] = list(body.user_list).map(obj);
    if (!first) throw new Error("expected a row");
    first.user_defined_values = {
      "kan grubu": CANARY,
      ZQCANARY_nested: {
        ZQCANARY_deeper: [{ ZQCANARY_deepest: CANARY_NUMBER }],
      },
      [CANARY_EMAIL]: [CANARY],
    };
    expect(specIssues(routeOf("getUserList"), 200, body)).toEqual([]);
  });

  test("reports a missing required property", async () => {
    const body = await bodyOf("getWebhookDetails", {
      path: { webhook_id: 21 },
    });
    const webhook = obj(body.webhook);
    delete webhook.name;
    delete webhook.url;
    expect(specIssues(routeOf("getWebhookDetails"), 200, body)).toEqual([
      "webhook.name: missing, the spec requires it",
      "webhook.url: missing, the spec requires it",
    ]);
    expect(
      specIssues(routeOf("getWebhookDetails"), 200, { webhook: {} }),
    ).toEqual([
      "webhook.events: missing, the spec requires it",
      "webhook.name: missing, the spec requires it",
      "webhook.url: missing, the spec requires it",
    ]);
  });

  test("reports a type mismatch with the allowed and the sent kinds", async () => {
    const me = await bodyOf("getMe");
    const route = routeOf("getMe");
    const cases: [unknown, string][] = [
      [CANARY, "string"],
      [CANARY_NUMBER + 0.5, "number"],
      [true, "boolean"],
      [null, "null"],
      [{ ZQ: CANARY }, "object"],
      [[CANARY], "array"],
    ];
    for (const [value, kind] of cases) {
      const lines = specIssues(route, 200, { ...me, id: value });
      expect(lines, kind).toEqual([
        `id: the spec allows integer, prod sent ${kind}`,
      ]);
      expectClean(lines);
    }
    expect(specIssues(route, 200, [CANARY])).toEqual([
      "(body): the spec allows object, prod sent array",
    ]);
    expect(specIssues(route, 200, null)).toEqual([
      "(body): the spec allows object, prod sent null",
    ]);
    expect(specIssues(route, 200, undefined)).toEqual([
      "(body): the spec allows object, prod sent null",
    ]);
  });

  test("a wrong kind on a nullable field says it allows null|object", async () => {
    const route = routeOf("getMembershipDueDetails");
    const base = await dueWithCategory();
    const cases: [unknown, string][] = [
      [CANARY_NUMBER, "integer"],
      [1.5, "number"],
      [CANARY, "string"],
      [true, "boolean"],
      [[CANARY], "array"],
    ];
    for (const [value, kind] of cases) {
      const body = structuredClone(base);
      obj(body.subscription).debt_category = value;
      const lines = specIssues(route, 200, body);
      expect(lines, kind).toEqual([
        `subscription.debt_category: the spec allows null|object, prod sent ${kind}`,
      ]);
      expectClean(lines);
    }
  });

  test("accepts null for a nullable field and rejects it for a plain one", async () => {
    const route = routeOf("getMembershipDueDetails");
    const body = await dueWithCategory();
    obj(body.subscription).debt_category = null;
    expect(specIssues(route, 200, body)).toEqual([]);
    obj(body.subscription).status = null;
    const lines = specIssues(route, 200, body);
    expect(lines.some((line) => line.startsWith("subscription.status: "))).toBe(
      true,
    );
  });

  test("an object with an undocumented key on a nullable field gives no spurious null line", async () => {
    const route = routeOf("getMembershipDueDetails");
    const body = await dueWithCategory();
    const category = obj(obj(body.subscription).debt_category);
    category.ZQ_key = CANARY;
    const lines = specIssues(route, 200, body);
    expect(lines).toEqual([
      "subscription.debt_category.ZQ_key: undocumented property (prod sent string)",
    ]);
    expect(lines.join("\n")).not.toMatch(/null/);
    expect(lines.join("\n")).not.toMatch(/allows/);
    expectClean(lines);

    const fresh = await dueWithCategory();
    obj(obj(fresh.subscription).debt_category).id = CANARY;
    const wrongInner = specIssues(route, 200, fresh);
    expect(wrongInner).toEqual([
      "subscription.debt_category.id: the spec allows integer, prod sent string",
    ]);
    expectClean(wrongInner);

    const replaced = await dueWithCategory();
    obj(replaced.subscription).debt_category = { ZQ_only: CANARY };
    expect(specIssues(route, 200, replaced)).toEqual([
      "subscription.debt_category.ZQ_only: undocumented property (prod sent string)",
    ]);
  });

  test("shows an enum miss that is a number or boolean, and hides a string", async () => {
    const route = routeOf("getMembershipDueDetails");
    const cases: [unknown, string][] = [
      [99, "99"],
      [-4, "-4"],
      [true, "true"],
      [false, "false"],
      [CANARY, "a string"],
      [CANARY_EMAIL, "a string"],
      ["1", "a string"],
    ];
    for (const [value, shown] of cases) {
      const body = await dueWithCategory();
      obj(body.subscription).status = value;
      const lines = specIssues(route, 200, body);
      const enumLine = lines.find((line) =>
        line.startsWith("subscription.status: outside the spec enum"),
      );
      expect(enumLine, JSON.stringify(value)).toEndWith(`prod sent ${shown}`);
      expect(enumLine).toContain("[1,2,3,4,6,7,8]");
      if (typeof value === "string") expectClean(lines);
    }
  });

  test("an enum miss of the wrong type gives one line, not a type line too", async () => {
    const body = await tags();
    obj(list(body.tags)[0]).color = 5;
    expect(specIssues(routeOf("getUsersTagsList"), 200, body)).toEqual([
      'tags[].color: outside the spec enum ["tag-1","tag-2","tag-3","tag-4","tag-5","tag-6","tag-7","tag-8"], prod sent 5',
    ]);
    const hidden = await tags();
    obj(list(hidden.tags)[0]).color = `${CANARY} tag-1`;
    const lines = specIssues(routeOf("getUsersTagsList"), 200, hidden);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEndWith("prod sent a string");
    expectClean(lines);
  });

  test("reports a status the operation does not document, and ignores that body", () => {
    const lines = specIssues(routeOf("getMe"), 402, {
      error: CANARY,
      ZQ: CANARY_NUMBER,
    });
    expect(lines).toEqual([
      "status 402 is not documented for getMe (documented: 200, 401, 429)",
    ]);
    expectClean(lines);
    expect(specIssues(routeOf("getMe"), 418, undefined)).toEqual([
      "status 418 is not documented for getMe (documented: 200, 401, 429)",
    ]);
    expect(specIssues(routeOf("getMe"), 0, {})).toHaveLength(1);
  });

  test("counts an issue that repeats across rows with (×N)", async () => {
    const body = await tags();
    const [row] = list(body.tags).map(obj);
    if (!row) throw new Error("expected a tag");
    body.tags = [1, 2, 3, 4].map((index) => ({
      ...row,
      ZQ_extra: `${CANARY}-${index}`,
    }));
    expect(specIssues(routeOf("getUsersTagsList"), 200, body)).toEqual([
      "tags[].ZQ_extra: undocumented property (prod sent string) (×4)",
    ]);
  });

  test("counts equal lines together and keeps different lines apart", async () => {
    const body = await tags();
    const [row] = list(body.tags).map(obj);
    if (!row) throw new Error("expected a tag");
    body.tags = [
      { ...row, ZQ_extra: CANARY },
      { ...row, ZQ_extra: CANARY_NUMBER },
      { ...row, ZQ_extra: CANARY },
      { ...row, color: 9 },
      { ...row, color: 9 },
      { ...row, id: CANARY },
    ];
    const lines = specIssues(routeOf("getUsersTagsList"), 200, body);
    // countLines sorts by code unit, so the capital Z of ZQ_extra comes first.
    expect(lines).toEqual([
      "tags[].ZQ_extra: undocumented property (prod sent integer)",
      "tags[].ZQ_extra: undocumented property (prod sent string) (×2)",
      'tags[].color: outside the spec enum ["tag-1","tag-2","tag-3","tag-4","tag-5","tag-6","tag-7","tag-8"], prod sent 9 (×2)',
      "tags[].id: the spec allows integer, prod sent string",
    ]);
    expectClean(lines);
  });

  test("does not change the body it checks", async () => {
    const body = await bodyOf("getMe");
    const copy = structuredClone(body);
    specIssues(routeOf("getMe"), 200, { ...body, ZQ: CANARY });
    expect(body).toEqual(copy);
  });

  test("a body full of canary values prints none of them", async () => {
    const me = await bodyOf("getMe");
    const stuffed: Obj = {};
    for (const key of Object.keys(me)) stuffed[key] = CANARY;
    stuffed.id = CANARY_NUMBER + 0.25;
    stuffed[CANARY_EMAIL] = CANARY;
    stuffed[`${CANARY} key`] = [CANARY];
    stuffed.ZQ_nested = { [CANARY_EMAIL]: { [CANARY]: CANARY_NUMBER } };
    const lines = specIssues(routeOf("getMe"), 200, stuffed);
    expect(lines.length).toBeGreaterThan(2);
    expectClean(lines);
  });
});

describe("assertReadOnly", () => {
  const routes = specRuntime().table.routes;
  const readingPosts = new Set(["getAccessToken", "getUserList"]);
  const verbs = [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "HEAD",
    "OPTIONS",
    "TRACE",
    "CONNECT",
    "",
    " ",
    "get ",
    "GET\n",
    "GET\u200b",
    "get;post",
  ];

  function refused(operationId: ServedOperationId, method?: string): boolean {
    try {
      assertReadOnly(operationId, method);
      return false;
    } catch (error) {
      if (error instanceof RefusedRequestError) return true;
      throw error;
    }
  }

  // The rule as the runner documents it, written out independently of the
  // module: a read-scoped operation may GET, and two operations may POST.
  function shouldAccept(route: (typeof routes)[number], verb: string): boolean {
    if (route.operationId === "generateLoginLinkForUser") return false;
    if (route.access === "bearer" && route.scope !== "read") return false;
    const upper = verb.toUpperCase();
    if (upper === "GET") return true;
    return upper === "POST" && readingPosts.has(route.operationId);
  }

  test("the route table is the whole API, with every verb in it", () => {
    expect(routes.length).toBeGreaterThan(100);
    for (const method of ["get", "post", "put", "patch", "delete"] as const) {
      expect(
        routes.some((route) => route.method === method),
        method,
      ).toBe(true);
    }
  });

  test("refuses every DELETE, PUT and PATCH operation", () => {
    const writes = routes.filter((route) =>
      ["delete", "put", "patch"].includes(route.method),
    );
    expect(writes.length).toBeGreaterThan(30);
    for (const route of writes) {
      const id = route.operationId;
      expect(refused(id), `${id} with its own verb`).toBe(true);
      for (const verb of ["GET", "get", "POST", "PUT", "PATCH", "DELETE"]) {
        expect(refused(id, verb), `${verb} ${id}`).toBe(true);
      }
    }
  });

  test("refuses every POST except getAccessToken and getUserList", () => {
    const posts = routes.filter(
      (route) =>
        route.method === "post" && !readingPosts.has(route.operationId),
    );
    expect(posts.length).toBeGreaterThan(10);
    for (const route of posts) {
      const id = route.operationId;
      expect(refused(id), `${id} with its own verb`).toBe(true);
      for (const verb of ["GET", "get", "POST", "post", "PUT", "DELETE"]) {
        expect(refused(id, verb), `${verb} ${id}`).toBe(true);
      }
    }
  });

  test("refuses generateLoginLinkForUser although it is a GET", () => {
    expect(routeOf("generateLoginLinkForUser").method).toBe("get");
    expect(NEVER_CALLED.has("generateLoginLinkForUser")).toBe(true);
    for (const verb of [undefined, "GET", "get", "POST", "PUT", "DELETE"]) {
      expect(refused("generateLoginLinkForUser", verb), String(verb)).toBe(
        true,
      );
    }
  });

  test("refuses every operation NEVER_CALLED lists, with any verb", () => {
    expect(NEVER_CALLED.size).toBeGreaterThan(0);
    for (const id of NEVER_CALLED) {
      expect(specRuntime().table.byOperationId.has(id), id).toBe(true);
      for (const verb of verbs)
        expect(refused(id, verb), `${verb} ${id}`).toBe(true);
    }
  });

  test("refuses every write-scoped operation, even as a GET", () => {
    const writeScoped = routes.filter(
      (route) => route.access === "bearer" && route.scope === "write",
    );
    expect(writeScoped.length).toBeGreaterThan(50);
    for (const route of writeScoped) {
      for (const verb of [undefined, ...verbs]) {
        expect(
          refused(route.operationId, verb),
          `${verb} ${route.operationId}`,
        ).toBe(true);
      }
    }
  });

  test("refuses a method override to a verb that is not GET", () => {
    const readable = routes.filter(
      (route) =>
        route.operationId !== "generateLoginLinkForUser" &&
        (route.access === "public" || route.scope === "read"),
    );
    expect(readable.length).toBeGreaterThan(50);
    for (const route of readable) {
      const id = route.operationId;
      for (const verb of [
        "PUT",
        "PATCH",
        "DELETE",
        "put",
        "patch",
        "delete",
        "HEAD",
        "OPTIONS",
        "TRACE",
        "",
        " ",
        "GET ",
        "get\n",
        "GET\u200b",
      ]) {
        expect(refused(id, verb), `${JSON.stringify(verb)} ${id}`).toBe(true);
      }
      if (!readingPosts.has(id)) {
        expect(refused(id, "POST"), `POST ${id}`).toBe(true);
        expect(refused(id, "post"), `post ${id}`).toBe(true);
      }
    }
  });

  test("accepts GET on every read operation, by default and by override", () => {
    const reads = routes.filter(
      (route) =>
        route.method === "get" &&
        route.operationId !== "generateLoginLinkForUser",
    );
    expect(reads.length).toBeGreaterThan(50);
    for (const route of reads) {
      const id = route.operationId;
      expect(route.access === "public" || route.scope === "read", id).toBe(
        true,
      );
      expect(refused(id), `${id} by default`).toBe(false);
      expect(refused(id, "GET"), `GET ${id}`).toBe(false);
      expect(refused(id, "get"), `get ${id}`).toBe(false);
    }
  });

  test("accepts the token exchange and the user search", () => {
    expect(refused("getAccessToken")).toBe(false);
    expect(refused("getAccessToken", "POST")).toBe(false);
    expect(refused("getAccessToken", "post")).toBe(false);
    expect(refused("getAccessToken", "GET"), "the 405 probe").toBe(false);
    expect(refused("getUserList")).toBe(false);
    expect(refused("getUserList", "POST")).toBe(false);
    expect(refused("getUserList", "post")).toBe(false);
    expect(refused("getUserList", "GET")).toBe(false);
    for (const verb of ["PUT", "PATCH", "DELETE"]) {
      expect(refused("getAccessToken", verb), `${verb} getAccessToken`).toBe(
        true,
      );
      expect(refused("getUserList", verb), `${verb} getUserList`).toBe(true);
    }
  });

  test("accepts exactly the combinations the rule allows, across the whole table", () => {
    let accepted = 0;
    for (const route of routes) {
      for (const verb of [undefined, ...verbs]) {
        const effective = verb ?? route.method;
        const expected = shouldAccept(route, effective);
        if (expected) accepted += 1;
        expect(
          refused(route.operationId, verb),
          `${JSON.stringify(verb)} ${route.operationId}`,
        ).toBe(!expected);
      }
    }
    expect(accepted).toBeGreaterThan(50);
  });

  test("never accepts a write-scoped operation or a non-GET verb outside the two POSTs", () => {
    for (const route of routes) {
      for (const verb of verbs) {
        if (refused(route.operationId, verb)) continue;
        const upper = verb.toUpperCase();
        expect(upper === "GET" || upper === "POST", verb).toBe(true);
        if (upper === "POST") {
          expect(readingPosts.has(route.operationId), route.operationId).toBe(
            true,
          );
        }
        if (route.access === "bearer") expect(route.scope).toBe("read");
        expect(route.operationId).not.toBe("generateLoginLinkForUser");
      }
    }
  });

  test("the refusal names the operation and the verb, and nothing else", () => {
    expect(() => assertReadOnly("deleteTag")).toThrow(RefusedRequestError);
    expect(() => assertReadOnly("deleteTag")).toThrow(
      /refusing DELETE deleteTag: .*the prod parity runner only reads/,
    );
    expect(() => assertReadOnly("getMe", "put")).toThrow(
      /refusing PUT getMe: PUT is not allowed for it/,
    );
    expect(() => assertReadOnly("createTag", "get")).toThrow(
      /refusing GET createTag: it needs the write scope/,
    );
    expect(() => assertReadOnly("generateLoginLinkForUser")).toThrow(
      /refusing GET generateLoginLinkForUser: it changes production state/,
    );
  });
});

describe("connectProd", () => {
  const ORIGIN = "https://prod.parity-test.invalid";
  const TOKEN = "supplied-token-ZQ";
  const SECRET = "s3cr&t=p w+/é;ZQSECRET";
  const CLIENT_ID = "client-id-ZQ";
  const credentials = { clientId: CLIENT_ID, clientSecret: SECRET };

  interface Seen {
    readonly method: string;
    readonly url: string;
    readonly headers: Headers;
    readonly text: string;
  }

  type Reply = (request: Request) => Response | Promise<Response>;
  type ResponseBody = ConstructorParameters<typeof Response>[0];

  function json(
    body: unknown,
    status = 200,
    headers: Record<string, string> = {},
  ): Reply {
    return () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json", ...headers },
      });
  }

  function raw(body: ResponseBody, status: number, contentType?: string) {
    const reply: Reply = () =>
      new Response(body, {
        status,
        headers: contentType ? { "content-type": contentType } : {},
      });
    return reply;
  }

  function throws(thrown: unknown): Reply {
    return () => {
      throw thrown;
    };
  }

  interface Rig {
    readonly options: ProdOptions;
    readonly seen: Seen[];
    readonly waits: number[];
    readonly logs: string[];
  }

  // The last reply repeats once the list runs out.
  function rig(
    replies: readonly Reply[],
    overrides: Partial<ProdOptions> = {},
  ): Rig {
    const seen: Seen[] = [];
    const waits: number[] = [];
    const logs: string[] = [];
    let index = 0;
    const options: ProdOptions = {
      origin: ORIGIN,
      auth: { kind: "token", token: TOKEN },
      pauseMs: 0,
      fetch: async (request) => {
        seen.push({
          method: request.method,
          url: request.url,
          headers: request.headers,
          text: await request.text(),
        });
        const reply = replies[Math.min(index, replies.length - 1)];
        index += 1;
        if (!reply) throw new Error("the rig has no reply");
        return reply(request);
      },
      sleep: async (ms) => {
        waits.push(ms);
      },
      log: (line) => logs.push(line),
      ...overrides,
    };
    return { options, seen, waits, logs };
  }

  const tokenBody = {
    access_token: "minted-token-ZQ",
    token_type: "Bearer",
    expires_in: 3600,
  };

  describe("redirects", () => {
    const redirectTo =
      (status: number): Reply =>
      () =>
        new Response(null, {
          status,
          headers: { location: "https://elsewhere.invalid/collect" },
        });

    test("a redirected token request fails and never follows the redirect", async () => {
      const redirects: string[] = [];
      const { options, seen } = rig([
        (request) => {
          redirects.push(request.redirect);
          return redirectTo(307)(request);
        },
      ]);
      const failure = await failureOf(
        connectProd({ ...options, auth: { kind: "credentials", credentials } }),
      );
      expect(failure).toBeInstanceOf(ProdUnavailableError);
      expect(failure instanceof Error ? failure.message : "").toContain(
        "status 307",
      );
      expect(redirects).toEqual(["manual"]);
      expect(seen.map((request) => request.url)).toEqual([
        `${ORIGIN}/api/v2/token`,
      ]);
    });

    test("a redirected read comes back as its 3xx status", async () => {
      const { options, seen } = rig([redirectTo(302)]);
      const { target } = await connectProd(options);
      const exchange = await target.call("getMe", {});
      expect(exchange.status).toBe(302);
      expect(seen).toHaveLength(1);
    });
  });

  function at<T>(items: readonly T[], index: number): T {
    const item = items[index];
    if (item === undefined) throw new Error(`no item ${index}`);
    return item;
  }

  describe("minting", () => {
    test("posts a form to /token, then calls with the minted bearer", async () => {
      const r = rig([json(tokenBody), json({ id: 1 })], {
        auth: { kind: "credentials", credentials },
      });
      const prod = await connectProd(r.options);
      expect(r.seen).toHaveLength(1);
      const mint = at(r.seen, 0);
      expect(mint.method).toBe("POST");
      expect(mint.url).toBe(`${ORIGIN}/api/v2/token`);
      expect(mint.headers.get("content-type")).toBe(
        "application/x-www-form-urlencoded",
      );
      expect(mint.headers.get("accept")).toBe("application/json");
      expect(mint.headers.get("authorization")).toBeNull();
      expect(Object.fromEntries(new URLSearchParams(mint.text))).toEqual({
        grant_type: "client_credentials",
        client_id: CLIENT_ID,
        client_secret: SECRET,
      });
      expect(mint.text, "the secret is form-encoded").not.toContain(SECRET);
      expect(prod.minted).toEqual({ status: 200, body: tokenBody });

      const exchange = await prod.target.call("getMe", {});
      expect(exchange).toEqual({ status: 200, body: { id: 1 } });
      const call = at(r.seen, 1);
      expect(call.method).toBe("GET");
      expect(call.url).toBe(`${ORIGIN}/api/v2/me`);
      expect(call.headers.get("authorization")).toBe("Bearer minted-token-ZQ");
      expect(call.headers.get("content-type")).toBeNull();
      expect(call.text).toBe("");
      expect(r.seen).toHaveLength(2);
    });

    test("mints once however many calls follow", async () => {
      const r = rig([json(tokenBody), json({})], {
        auth: { kind: "credentials", credentials },
      });
      const prod = await connectProd(r.options);
      await prod.target.call("getMe", {});
      await prod.target.call("getMe", {});
      await prod.target.call("getTagsList", {
        query: { start_page: 1, how_many: 10 },
      });
      expect(r.seen.filter((seen) => seen.url.endsWith("/token"))).toHaveLength(
        1,
      );
      for (const seen of r.seen.slice(1)) {
        expect(seen.headers.get("authorization")).toBe(
          "Bearer minted-token-ZQ",
        );
      }
    });

    test("a supplied token skips minting and is used as the bearer", async () => {
      const r = rig([json({ id: 1 })]);
      const prod = await connectProd(r.options);
      expect(r.seen).toHaveLength(0);
      expect(prod.minted).toBeNull();
      await prod.target.call("getMe", {});
      expect(r.seen).toHaveLength(1);
      expect(at(r.seen, 0).headers.get("authorization")).toBe(
        `Bearer ${TOKEN}`,
      );
    });

    test("sends no bearer to the token route, and honours an explicit token", async () => {
      const r = rig([json({ error: "x" }, 405)]);
      const prod = await connectProd(r.options);
      await prod.target.call("getAccessToken", { method: "GET" });
      expect(at(r.seen, 0).headers.get("authorization")).toBeNull();
      expect(at(r.seen, 0).method).toBe("GET");
      await prod.target.call("getMe", { token: null });
      expect(at(r.seen, 1).headers.get("authorization")).toBeNull();
      await prod.target.call("getMe", { token: "other-token" });
      expect(at(r.seen, 2).headers.get("authorization")).toBe(
        "Bearer other-token",
      );
      await prod.target.call("getMe", { token: "" });
      expect(at(r.seen, 3).headers.get("authorization")).toBeNull();
    });

    test("a refused mint throws without the secret, the client id or the reply text", async () => {
      for (const reply of [
        json({ error: `bad client_secret ${SECRET} for ${CLIENT_ID}` }, 401),
        json({ error: "invalid_client" }, 400),
        json({ error: "plan lapsed" }, 402),
        json({ error: "x" }, 500),
        raw(`<html>${SECRET}</html>`, 502, "text/html"),
        raw("", 503),
      ]) {
        const r = rig([reply], {
          auth: { kind: "credentials", credentials },
        });
        const failure = await connectProd(r.options).catch(
          (error: unknown) => error,
        );
        expect(failure).toBeInstanceOf(ProdUnavailableError);
        const message = failure instanceof Error ? failure.message : "";
        expect(message).toMatch(
          /^production refused the token request with status \d{3}$/,
        );
        for (const forbidden of [
          SECRET,
          CLIENT_ID,
          "ZQSECRET",
          "bad",
          ORIGIN,
        ]) {
          expect(message).not.toContain(forbidden);
        }
      }
    });

    test("a 200 without a usable access token also throws", async () => {
      for (const reply of [
        json({}),
        json({ access_token: 12345 }),
        json({ access_token: null }),
        json([tokenBody]),
        json(null),
        raw("not json", 200, "text/plain"),
        raw("", 200),
      ]) {
        const r = rig([reply], { auth: { kind: "credentials", credentials } });
        expect(await failureOf(connectProd(r.options))).toBeInstanceOf(
          ProdUnavailableError,
        );
        expect(r.seen).toHaveLength(1);
      }
    });

    test("a network failure while minting leaks neither the secret nor the URL", async () => {
      const r = rig(
        [
          throws(
            Object.assign(
              new TypeError(`fetch failed ${ORIGIN}/api/v2/token ${SECRET}`),
              { code: "ECONNREFUSED" },
            ),
          ),
        ],
        { auth: { kind: "credentials", credentials } },
      );
      const failure = await connectProd(r.options).catch(
        (error: unknown) => error,
      );
      expect(failure).toBeInstanceOf(ProdUnavailableError);
      const message = failure instanceof Error ? failure.message : "";
      expect(message).toBe(
        "could not reach production for getAccessToken (TypeError ECONNREFUSED)",
      );
      for (const forbidden of [
        SECRET,
        CLIENT_ID,
        "prod.parity-test",
        "https",
      ]) {
        expect(message).not.toContain(forbidden);
      }
    });

    test("strips trailing slashes from the origin", async () => {
      const r = rig([json({})], { origin: `${ORIGIN}///` });
      const prod = await connectProd(r.options);
      await prod.target.call("getMe", {});
      expect(at(r.seen, 0).url).toBe(`${ORIGIN}/api/v2/me`);
    });
  });

  describe("requests", () => {
    test("builds the path and the query from the input", async () => {
      const r = rig([json({})]);
      const prod = await connectProd(r.options);
      await prod.target.call("getUserDetails", { path: { user_id: 1001 } });
      await prod.target.call("getTagsList", {
        query: { start_page: 2, how_many: 10, query: "a&b c" },
      });
      expect(at(r.seen, 0).url).toBe(`${ORIGIN}/api/v2/user/1001`);
      const url = new URL(at(r.seen, 1).url);
      expect(url.pathname).toBe("/api/v2/tags");
      expect(Object.fromEntries(url.searchParams)).toEqual({
        start_page: "2",
        how_many: "10",
        query: "a&b c",
      });
    });

    test("sends a JSON body for the user search, once, and retries it unchanged", async () => {
      const search = { search: { start_page: 1, how_many: 2 } };
      const r = rig([json({}, 429, { "retry-after": "1" }), json({ ok: 1 })]);
      const prod = await connectProd(r.options);
      const exchange = await prod.target.call("getUserList", { body: search });
      expect(exchange.status).toBe(200);
      expect(r.seen).toHaveLength(2);
      for (const seen of r.seen) {
        expect(seen.method).toBe("POST");
        expect(seen.headers.get("content-type")).toBe("application/json");
        expect(JSON.parse(seen.text)).toEqual(search);
        expect(seen.headers.get("authorization")).toBe(`Bearer ${TOKEN}`);
      }
      expect(at(r.seen, 1).url).toBe(at(r.seen, 0).url);
    });

    test("uses the injected clock for now()", async () => {
      const fixed = new Date("2026-11-01T00:00:00Z");
      const injected = await connectProd(
        rig([json({})], { now: () => fixed }).options,
      );
      expect(injected.target.now()).toBe(fixed);
      const before = Date.now();
      const real = await connectProd(rig([json({})]).options);
      const stamp = real.target.now().getTime();
      expect(stamp).toBeGreaterThanOrEqual(before);
      expect(stamp).toBeLessThanOrEqual(Date.now());
    });
  });

  describe("pacing", () => {
    test("waits between requests and not before the first", async () => {
      const r = rig([json({})], { pauseMs: 350 });
      const prod = await connectProd(r.options);
      await prod.target.call("getMe", {});
      expect(r.waits, "no wait before the first request").toEqual([]);
      await prod.target.call("getMe", {});
      await prod.target.call("getMe", {});
      expect(r.waits).toHaveLength(2);
      for (const wait of r.waits) {
        expect(wait).toBeGreaterThan(0);
        expect(wait).toBeLessThanOrEqual(350);
      }
    });

    test("paces the token request like any other", async () => {
      const r = rig([json(tokenBody), json({})], {
        pauseMs: 350,
        auth: { kind: "credentials", credentials },
      });
      const prod = await connectProd(r.options);
      expect(r.waits).toEqual([]);
      await prod.target.call("getMe", {});
      expect(r.waits).toHaveLength(1);
      expect(at(r.waits, 0)).toBeLessThanOrEqual(350);
    });

    test("does not wait at all with a zero pause", async () => {
      const r = rig([json({})], { pauseMs: 0 });
      const prod = await connectProd(r.options);
      for (let call = 0; call < 5; call += 1)
        await prod.target.call("getMe", {});
      expect(r.waits).toEqual([]);
    });
  });

  describe("rate limiting", () => {
    test("retries a 429 exactly once, after the retry-after wait", async () => {
      const r = rig([
        json({ error: "slow down" }, 429, { "retry-after": "7" }),
        json({ id: 1 }),
      ]);
      const prod = await connectProd(r.options);
      const exchange = await prod.target.call("getMe", {});
      expect(exchange).toEqual({ status: 200, body: { id: 1 } });
      expect(r.seen).toHaveLength(2);
      expect(r.waits).toEqual([7000]);
      expect(r.logs).toHaveLength(1);
      expect(at(r.logs, 0)).toContain("getMe");
      expect(at(r.logs, 0)).toContain("7s");
      expect(at(r.logs, 0)).not.toContain(ORIGIN);
    });

    test("gives up after the one retry and returns the second 429", async () => {
      const r = rig([
        json({ error: "first" }, 429, { "retry-after": "2" }),
        json({ error: "second" }, 429, { "retry-after": "2" }),
        json({ id: 1 }),
      ]);
      const prod = await connectProd(r.options);
      const exchange = await prod.target.call("getMe", {});
      expect(exchange).toEqual({ status: 429, body: { error: "second" } });
      expect(r.seen).toHaveLength(2);
      expect(r.waits).toEqual([2000]);
      const next = await prod.target.call("getMe", {});
      expect(next.status, "the third reply, on a new call").toBe(200);
      expect(r.seen).toHaveLength(3);
    });

    test("caps the wait at 65 seconds", async () => {
      for (const header of ["66", "300", "86400", "1e9", "Infinity"]) {
        const r = rig([
          json({}, 429, { "retry-after": header }),
          json({ id: 1 }),
        ]);
        const prod = await connectProd(r.options);
        await prod.target.call("getMe", {});
        expect(r.waits, header).toEqual([65_000]);
      }
      const edge = rig([json({}, 429, { "retry-after": "65" }), json({})]);
      await (await connectProd(edge.options)).target.call("getMe", {});
      expect(edge.waits).toEqual([65_000]);
    });

    test("waits the full 65 seconds when retry-after is absent or unusable", async () => {
      const unusable: (Record<string, string> | undefined)[] = [
        undefined,
        { "retry-after": "" },
        { "retry-after": "0" },
        { "retry-after": "-5" },
        { "retry-after": "soon" },
        { "retry-after": "Wed, 21 Oct 2026 07:28:00 GMT" },
      ];
      for (const headers of unusable) {
        const r = rig([json({}, 429, headers), json({ id: 1 })]);
        const prod = await connectProd(r.options);
        await prod.target.call("getMe", {});
        expect(r.waits, JSON.stringify(headers)).toEqual([65_000]);
      }
    });

    test("honours a short or fractional retry-after", async () => {
      for (const [header, ms] of [
        ["1", 1000],
        ["30", 30_000],
        ["1.5", 1500],
        [" 4 ", 4000],
      ] as const) {
        const r = rig([json({}, 429, { "retry-after": header }), json({})]);
        await (await connectProd(r.options)).target.call("getMe", {});
        expect(r.waits, header).toEqual([ms]);
      }
    });

    test("does not retry any other status", async () => {
      for (const status of [200, 400, 401, 402, 403, 404, 405, 500, 501, 503]) {
        const r = rig([json({ error: "x" }, status, { "retry-after": "5" })]);
        const prod = await connectProd(r.options);
        const exchange = await prod.target.call("getMe", {});
        expect(exchange.status).toBe(status);
        expect(r.seen, String(status)).toHaveLength(1);
        expect(r.waits).toEqual([]);
      }
    });

    test("retries a 429 on the token request too", async () => {
      const r = rig(
        [json({}, 429, { "retry-after": "3" }), json(tokenBody), json({})],
        { auth: { kind: "credentials", credentials } },
      );
      const prod = await connectProd(r.options);
      expect(r.seen).toHaveLength(2);
      expect(r.waits).toEqual([3000]);
      expect(prod.minted?.status).toBe(200);
      await prod.target.call("getMe", {});
      expect(at(r.seen, 2).headers.get("authorization")).toBe(
        "Bearer minted-token-ZQ",
      );
    });

    test("a mint that is rate limited twice throws with the status", async () => {
      const r = rig([json({}, 429, { "retry-after": "1" })], {
        auth: { kind: "credentials", credentials },
      });
      const failure = await failureOf(connectProd(r.options));
      expect(failure).toBeInstanceOf(ProdUnavailableError);
      expect(failure instanceof Error ? failure.message : "").toBe(
        "production refused the token request with status 429",
      );
      expect(r.seen).toHaveLength(2);
    });

    test("waits the pause again before the retry when the pause is long", async () => {
      const r = rig([json({}, 429, { "retry-after": "1" }), json({})], {
        pauseMs: 350,
      });
      const prod = await connectProd(r.options);
      await prod.target.call("getMe", {});
      expect(r.seen).toHaveLength(2);
      expect(at(r.waits, 0)).toBe(1000);
    });
  });

  describe("network failures", () => {
    const email = "jane.doe@example.com";

    test("become ProdUnavailableError without the URL or an email path value", async () => {
      const thrown = Object.assign(
        new TypeError(
          `Unable to connect to ${ORIGIN}/api/v2/user/${email} (${email})`,
        ),
        { code: "ECONNRESET", path: `${ORIGIN}/api/v2/user/${email}` },
      );
      const r = rig([throws(thrown)]);
      const prod = await connectProd(r.options);
      const failure = await prod.target
        .call("getUserDetails", { path: { user_id: email } })
        .catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(ProdUnavailableError);
      const message = failure instanceof Error ? failure.message : "";
      expect(message).toBe(
        "could not reach production for getUserDetails (TypeError ECONNRESET)",
      );
      for (const forbidden of [
        email,
        encodeURIComponent(email),
        "jane",
        "@",
        "https",
        "parity-test",
        "/api",
        TOKEN,
      ]) {
        expect(message).not.toContain(forbidden);
      }
      expect(r.seen).toHaveLength(1);
      expect(at(r.seen, 0).url).toContain(encodeURIComponent(email));
    });

    test("keep only the name and a string code of whatever was thrown", async () => {
      const cases: [unknown, string][] = [
        [new Error(`boom ${email}`), "Error"],
        [Object.assign(new Error("x"), { code: 42 }), "Error"],
        [
          Object.assign(new Error("x"), { code: "ETIMEDOUT" }),
          "Error ETIMEDOUT",
        ],
        [
          Object.assign(new DOMException(`${email}`, "AbortError"), {}),
          "AbortError",
        ],
        [`plain string ${email}`, "unknown error"],
        [undefined, "unknown error"],
        [null, "unknown error"],
        [{ message: email }, "unknown error"],
        [{ message: email, code: "EPIPE" }, "unknown error EPIPE"],
      ];
      for (const [thrown, expected] of cases) {
        const r = rig([throws(thrown)]);
        const prod = await connectProd(r.options);
        const failure = await prod.target
          .call("getMe", {})
          .catch((error: unknown) => error);
        expect(failure).toBeInstanceOf(ProdUnavailableError);
        const message = failure instanceof Error ? failure.message : "";
        expect(message).toBe(
          `could not reach production for getMe (${expected})`,
        );
        expect(message).not.toContain(email);
      }
    });

    test("are not retried and do not stop the next call", async () => {
      const r = rig([throws(new TypeError("down")), json({ id: 1 })]);
      const prod = await connectProd(r.options);
      expect(await failureOf(prod.target.call("getMe", {}))).toBeInstanceOf(
        ProdUnavailableError,
      );
      expect(r.seen).toHaveLength(1);
      expect(r.waits).toEqual([]);
      const next = await prod.target.call("getMe", {});
      expect(next.status).toBe(200);
    });
  });

  describe("replies that are not JSON", () => {
    test("name the content type and drop the body", async () => {
      const r = rig([
        raw(
          `<html>${CANARY} ${CANARY_EMAIL}</html>`,
          502,
          "text/html; charset=utf-8",
        ),
      ]);
      const prod = await connectProd(r.options);
      const exchange = await prod.target.call("getMe", {});
      expect(exchange).toEqual({
        status: 502,
        body: undefined,
        nonJson: "text/html; charset=utf-8",
      });
      expectClean([JSON.stringify(exchange)]);
    });

    test("say so when there is no content type", async () => {
      const r = rig([raw(new TextEncoder().encode(`${CANARY} not json`), 500)]);
      const prod = await connectProd(r.options);
      const exchange = await prod.target.call("getMe", {});
      expect(exchange.nonJson).toBe("no content type");
      expect(exchange.body).toBeUndefined();
      expectClean([JSON.stringify(exchange)]);
    });

    test("treat broken JSON labelled as JSON the same way", async () => {
      for (const body of ["{", "{'a':1}", "nope", "<", "{} {}", "   "]) {
        const r = rig([raw(body, 200, "application/json")]);
        const prod = await connectProd(r.options);
        const exchange = await prod.target.call("getMe", {});
        expect(exchange, JSON.stringify(body)).toEqual({
          status: 200,
          body: undefined,
          nonJson: "application/json",
        });
      }
    });

    test("an empty body is not a JSON failure", async () => {
      const r = rig([raw("", 204)]);
      const exchange = await (
        await connectProd(r.options)
      ).target.call("getMe", {});
      expect(exchange).toEqual({ status: 204, body: undefined });
      expect("nonJson" in exchange).toBe(false);
    });

    test("parse JSON even when the content type says otherwise", async () => {
      const r = rig([raw('{"id":1}', 200, "text/plain")]);
      const exchange = await (
        await connectProd(r.options)
      ).target.call("getMe", {});
      expect(exchange).toEqual({ status: 200, body: { id: 1 } });
    });

    test("pass through JSON scalars, arrays and null", async () => {
      for (const body of ["null", "[1,2]", '"text"', "5", "true"]) {
        const r = rig([raw(body, 200, "application/json")]);
        const exchange: Exchange = await (
          await connectProd(r.options)
        ).target.call("getMe", {});
        expect(exchange.body).toEqual(JSON.parse(body));
        expect(exchange.nonJson).toBeUndefined();
      }
    });
  });

  describe("writes", () => {
    const writeRoutes = specRuntime().table.routes.filter(
      (route) =>
        route.method !== "get" &&
        route.operationId !== "getAccessToken" &&
        route.operationId !== "getUserList",
    );

    test("every write operation is refused before anything is sent", async () => {
      expect(writeRoutes.length).toBeGreaterThan(50);
      const r = rig([json({})], { pauseMs: 350 });
      const prod = await connectProd(r.options);
      for (const route of writeRoutes) {
        const failure = await prod.target
          .call(route.operationId, {
            path: { any_id: 1 },
            body: { name: CANARY },
          })
          .catch((error: unknown) => error);
        expect(failure, route.operationId).toBeInstanceOf(RefusedRequestError);
        const message = failure instanceof Error ? failure.message : "";
        expect(message).toContain(route.operationId);
        expect(message).not.toContain(CANARY);
        expect(message).not.toContain(TOKEN);
      }
      expect(r.seen, "fetch must never run").toHaveLength(0);
      expect(r.waits, "not even a pacing wait").toEqual([]);
      expect(r.logs).toEqual([]);
    });

    test("a write is refused with the minted token too", async () => {
      const r = rig([json(tokenBody), json({})], {
        auth: { kind: "credentials", credentials },
      });
      const prod = await connectProd(r.options);
      expect(r.seen).toHaveLength(1);
      for (const route of writeRoutes) {
        expect(
          await failureOf(
            prod.target.call(route.operationId, { token: "minted-token-ZQ" }),
          ),
        ).toBeInstanceOf(RefusedRequestError);
      }
      expect(r.seen, "only the mint was sent").toHaveLength(1);
    });

    test("a method override to a write verb is refused before anything is sent", async () => {
      const r = rig([json({})]);
      const prod = await connectProd(r.options);
      const readOperations = [
        "getMe",
        "getTagsList",
        "getUserList",
        "getAccessToken",
        "getUserDetails",
      ] as const;
      for (const operationId of readOperations) {
        for (const method of [
          "put",
          "PUT",
          "patch",
          "delete",
          "DELETE",
          "head",
          "options",
          "",
          "get ",
        ]) {
          expect(
            await failureOf(prod.target.call(operationId, { method })),
            `${method} ${operationId}`,
          ).toBeInstanceOf(RefusedRequestError);
        }
      }
      for (const method of ["post", "POST"]) {
        for (const operationId of [
          "getMe",
          "getTagsList",
          "getUserDetails",
        ] as const) {
          expect(
            await failureOf(prod.target.call(operationId, { method })),
          ).toBeInstanceOf(RefusedRequestError);
        }
      }
      expect(r.seen).toHaveLength(0);
    });

    test("login links are never requested, whatever the verb", async () => {
      const r = rig([json({})]);
      const prod = await connectProd(r.options);
      for (const method of [undefined, "GET", "get", "POST"]) {
        expect(
          await failureOf(
            prod.target.call("generateLoginLinkForUser", {
              path: { user_id: 1 },
              method,
            }),
          ),
        ).toBeInstanceOf(RefusedRequestError);
      }
      expect(r.seen).toHaveLength(0);
    });

    test("the reads that are allowed do reach fetch, with the verb they were given", async () => {
      const r = rig([json({})]);
      const prod = await connectProd(r.options);
      await prod.target.call("getMe", {});
      await prod.target.call("getMe", { method: "get" });
      await prod.target.call("getUserList", { method: "POST", body: {} });
      await prod.target.call("getAccessToken", { method: "GET" });
      await prod.target.call("getAccessToken", { body: {} });
      expect(r.seen.map((seen) => seen.method)).toEqual([
        "GET",
        "GET",
        "POST",
        "GET",
        "POST",
      ]);
    });

    test("an unknown operation fails before fetch", async () => {
      const r = rig([json({})]);
      const prod = await connectProd(r.options);
      // @ts-expect-error not a served operation
      const failure = await failureOf(prod.target.call("notAnOperation", {}));
      expect(failure).toBeInstanceOf(Error);
      expect(failure).not.toBeInstanceOf(RefusedRequestError);
      expect(r.seen).toHaveLength(0);
    });
  });

  describe("against the in-process mock", () => {
    function mockFetch(client: TestClient) {
      return async (request: Request): Promise<Response> =>
        client.mock.app.request(request);
    }

    test("mints a token, reads, and gets a body the spec accepts", async () => {
      const client = createTestClient();
      const prod = await connectProd({
        origin: "https://mock.parity-test.invalid",
        auth: {
          kind: "credentials",
          credentials: client.mock.runtime.credentials.readWrite,
        },
        fetch: mockFetch(client),
        pauseMs: 0,
      });
      expect(prod.minted?.status).toBe(200);
      const me = await prod.target.call("getMe", {});
      expect(me.status).toBe(200);
      expect(specIssues(routeOf("getMe"), me.status, me.body)).toEqual([]);

      const viaMock = await mockTarget().call("getMe", {});
      const diff = diffShapes(shapeOf(me.body), shapeOf(viaMock.body));
      expect(diff).toEqual({
        prodOnly: [],
        mockOnly: [],
        prodKinds: [],
        mockKinds: [],
      });
    });

    test("gets the documented 405 from a GET on the token route", async () => {
      const client = createTestClient();
      const prod = await connectProd({
        origin: "https://mock.parity-test.invalid",
        auth: { kind: "token", token: await client.token() },
        fetch: mockFetch(client),
        pauseMs: 0,
      });
      const probe = await prod.target.call("getAccessToken", { method: "GET" });
      expect(probe.status).toBe(405);
      expect(
        specIssues(routeOf("getAccessToken"), probe.status, probe.body),
      ).toEqual([]);
    });

    test("a bad secret fails the mint without echoing it", async () => {
      const client = createTestClient();
      const failure = await connectProd({
        origin: "https://mock.parity-test.invalid",
        auth: {
          kind: "credentials",
          credentials: {
            clientId: client.mock.runtime.credentials.readWrite.clientId,
            clientSecret: `wrong-${CANARY}`,
          },
        },
        fetch: mockFetch(client),
        pauseMs: 0,
      }).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(ProdUnavailableError);
      expectClean([failure instanceof Error ? failure.message : ""]);
    });
  });
});

describe("mockTarget", () => {
  test("answers a call with only the status and the body", async () => {
    const target = mockTarget();
    const me = await target.call("getMe", {});
    expect(Object.keys(me).sort()).toEqual(["body", "status"]);
    expect(me.status).toBe(200);
    expect(obj(me.body).name).toBe("kelder");
  });

  test("passes the path, query and token through to the mock", async () => {
    const target = mockTarget();
    const tags = await target.call("getTagsList", {
      query: { start_page: 1, how_many: 2 },
    });
    expect(tags.status).toBe(200);
    expect(list(obj(tags.body).tag_list)).toHaveLength(2);
    const unauthorised = await target.call("getMe", { token: null });
    expect(unauthorised.status).toBe(401);
    const missing = await target.call("getUserDetails", {
      path: { user_id: 1 },
    });
    expect(missing.status).toBe(404);
  });

  test("exposes the read-write credentials the mock accepts", async () => {
    const target = mockTarget();
    expect(target.credentials.clientId).not.toBe("");
    expect(target.credentials.clientSecret).not.toBe("");
    const client = createTestClient();
    expect(target.credentials).toEqual(
      client.mock.runtime.credentials.readWrite,
    );
  });

  test("reports the mock's clock, which does not move by itself", async () => {
    const target = mockTarget();
    const first = target.now();
    expect(first).toBeInstanceOf(Date);
    await Bun.sleep(5);
    expect(target.now().getTime()).toBe(first.getTime());
    expect(mockTarget().now().getTime()).toBe(first.getTime());
  });

  test("gives every call its own store, seeded the same way", async () => {
    const one = mockTarget();
    const two = mockTarget();
    const created = await one.call("createTag", {
      body: { name: "Yalnızca Bir", color: "tag-1" },
    });
    expect(created.status).toBe(200);
    const page = { query: { start_page: 1, how_many: 100 } };
    const inOne = obj((await one.call("getTagsList", page)).body);
    const inTwo = obj((await two.call("getTagsList", page)).body);
    expect(list(inOne.tag_list).length).toBe(list(inTwo.tag_list).length + 1);
  });
});
