import { describe, expect, test } from "bun:test";

import {
  apiDateTime,
  istanbulDate,
  istanbulDayOf,
  istanbulMidnight,
} from "../src/seed/dates";
import { specRuntime } from "../src/spec/runtime";
import { orgStore } from "../src/store/store";
import { createTestClient, type TestClient } from "../src/testing/client";

// Production writes every date-time in UTC with milliseconds, and the mock
// does the same (see PARITY.md, "Dates"). The strict response validator holds
// every response in the test suite to that form. Requests keep the standard
// `date-time` format, so a client may send any offset.
const OFFSET = "2026-11-01T09:00:00+03:00";
const UTC_MILLIS = "2026-11-01T06:00:00.000Z";

function kelder(client: TestClient) {
  return orgStore(client.mock.runtime.world().store, "kelder");
}

function debtsList() {
  const { table, validators } = specRuntime();
  const route = table.byOperationId.get("getMembershipDueDebtsList");
  if (!route) throw new Error("no getMembershipDueDebtsList route");
  return { route, validators };
}

function debtsResponse(operationDate: string) {
  return { total: 1, debt_list: [{ id: 1, operation_date: operationDate }] };
}

describe("the response validator", () => {
  test("accepts a date-time in UTC with milliseconds", () => {
    const { route, validators } = debtsList();
    const validate = validators.response(route, 200);
    expect(validate?.(debtsResponse(UTC_MILLIS))).toBe(true);
  });

  test("rejects a date-time with an offset, though it names the same instant", () => {
    const { route, validators } = debtsList();
    const validate = validators.response(route, 200);
    expect(Date.parse(OFFSET)).toBe(Date.parse(UTC_MILLIS));
    expect(validate?.(debtsResponse(OFFSET))).toBe(false);
    expect(validate?.errors?.map((error) => error.keyword)).toEqual(["format"]);
  });

  test.each([
    ["no milliseconds", "2026-11-01T06:00:00Z"],
    ["a lower case z", "2026-11-01T06:00:00.000z"],
    ["a space for the T", "2026-11-01 06:00:00.000Z"],
    ["fractions of a millisecond", "2026-11-01T06:00:00.000123Z"],
    ["a UTC offset spelled out", "2026-11-01T06:00:00.000+00:00"],
    ["a day the month does not have", "2026-02-30T06:00:00.000Z"],
    ["an hour past 23", "2026-11-01T24:00:00.000Z"],
    ["a date alone", "2026-11-01"],
  ])("rejects %s", (_name, value) => {
    const { route, validators } = debtsList();
    expect(validators.response(route, 200)?.(debtsResponse(value))).toBe(false);
  });
});

describe("the request validator", () => {
  test("still accepts a date-time with any offset", () => {
    const { route, validators } = debtsList();
    const request = validators.request(route);
    for (const value of [OFFSET, UTC_MILLIS, "2026-11-01T06:00:00Z"]) {
      expect(
        request.validate({
          path: {},
          query: {
            start_page: 1,
            how_many: 10,
            start_date: value,
            end_date: "2026-12-01T00:00:00-05:00",
          },
          body: undefined,
        }),
        value,
      ).toBeNull();
    }
  });

  test("a request with an offset is answered in UTC, for the same instant", async () => {
    const client = createTestClient();
    const created = await client.ok("createDebt", {
      body: { user_id: 1004, amount: 450, operation_date: OFFSET },
    });
    const detail = await client.ok("getDebtDetails", {
      path: { debt_id: created.debt_id ?? 0 },
    });
    expect(detail.subscription?.operation_date).toBe(UTC_MILLIS);
  });
});

describe("the date helpers", () => {
  test("apiDateTime writes UTC with milliseconds", () => {
    expect(apiDateTime(new Date(OFFSET))).toBe(UTC_MILLIS);
    expect(apiDateTime(new Date("2026-11-01T06:00:00.987Z"))).toBe(
      "2026-11-01T06:00:00.987Z",
    );
  });

  test("istanbulDate is the Istanbul calendar day, not the UTC day", () => {
    // 21:00Z is midnight in Istanbul, so the day has already changed there.
    expect(istanbulDate(new Date("2026-10-31T20:59:59.999Z"))).toBe(
      "2026-10-31",
    );
    expect(istanbulDate(new Date("2026-10-31T21:00:00.000Z"))).toBe(
      "2026-11-01",
    );
    expect(istanbulDate(new Date("2026-12-31T23:30:00.000Z"))).toBe(
      "2027-01-01",
    );
    expect(istanbulDate(new Date("2026-07-01T20:59:00.000Z"))).toBe(
      "2026-07-01",
    );
  });

  test("istanbulMidnight is 21:00:00.000Z on the day before", () => {
    expect(istanbulMidnight("2026-11-01")).toBe("2026-10-31T21:00:00.000Z");
    expect(istanbulMidnight("2027-01-01")).toBe("2026-12-31T21:00:00.000Z");
    expect(istanbulDate(new Date(istanbulMidnight("2026-11-01")))).toBe(
      "2026-11-01",
    );
  });
});

describe("a calendar day cut from a stored date-time", () => {
  // Between 21:00Z and midnight the UTC day is the day before the Istanbul
  // one, so a cut of the first ten characters would be a day early.
  const LATE = "2026-10-31T22:00:00.000Z";
  const NEW_YEAR = "2026-12-31T21:00:00.000Z";

  test("istanbulDayOf passes a date through and gives the Istanbul day of a date-time", () => {
    expect(istanbulDayOf("2026-11-01")).toBe("2026-11-01");
    expect(istanbulDayOf(LATE)).toBe("2026-11-01");
    expect(istanbulDayOf("2026-10-31T20:59:59.999Z")).toBe("2026-10-31");
    expect(istanbulDayOf("2026-11-01T00:30:00+03:00")).toBe("2026-11-01");
    expect(istanbulDayOf("2026-10-31T23:30:00-05:00")).toBe("2026-11-01");
  });

  test("apply_date and join_date are the Istanbul day", async () => {
    const client = createTestClient();
    kelder(client).users.update(1010, {
      apply_date: LATE,
      join_date: NEW_YEAR,
    });
    const { user } = await client.ok("getUserDetails", {
      path: { user_id: 1010 },
    });
    expect(user).toMatchObject({
      apply_date: "2026-11-01",
      join_date: "2027-01-01",
    });
  });

  test("a statement's due_date is the Istanbul day", async () => {
    const client = createTestClient();
    const db = kelder(client);
    const row = db.subscriptions.find((debt) => debt.user_id === 1015);
    if (!row) throw new Error("no subscription for 1015");
    db.subscriptions.update(row.id, { due_date: LATE });
    const statement = await client.ok("getUsersMembershipDueList", {
      path: { user_id: 1015 },
      query: { start_page: 1, how_many: 100 },
    });
    expect(
      statement.subscription_list?.find((item) => item.id === row.id)?.due_date,
    ).toBe("2026-11-01");
  });

  test("the year of a dues payment with no period is the Istanbul year", async () => {
    const client = createTestClient();
    const db = kelder(client);
    const payment = db.subscriptions.find(
      (row) => row.status === 2 && row.transaction_id !== null,
    );
    if (!payment) throw new Error("no paid dues");
    db.subscriptions.update(payment.id, {
      period: null,
      operation_date: NEW_YEAR,
    });
    const body = await client.ok("getUsersTimeline", {
      path: { user_id: payment.user_id },
      query: { start_page: 1, how_many: 100 },
    });
    const event = body.timeline?.find(
      (item) => item.id === 1_000_000_000 + 10 * 10_000_000 + payment.id,
    );
    expect(event?.details).toStartWith("2027 aidatı ödendi");
    expect(event?.event_time).toBe(NEW_YEAR);
  });
});
