import { describe, expect, test } from "bun:test";

import { orgStore } from "../src/store/store";
import { TRANSACTION_TYPE } from "../src/store/transactions";
import { createTestClient } from "../src/testing/client";

// `Transaction` is one schema that donation, micro donation, membership due,
// debt, ticket sale and form answer details all embed. Production sent these
// keys on a due and on a debt (probes P12 and P15). Each of them is always
// there: a payment that lacks the value gets null, never a missing key.
const PRODUCTION_KEYS = [
  "amount",
  "association_id",
  "auth_code",
  "bank_account",
  "bank_account_id",
  "bin_number",
  "cardholder_name",
  "city",
  "complete_date",
  "conversation_id",
  "country",
  "currency",
  "fonzip_framework",
  "fonzip_id",
  "id",
  "installment_amount",
  "installment_count",
  "ip_address",
  "last_four",
  "order_id",
  "payment_method",
  "payment_settings",
  "payment_settings_id",
  "payment_status",
  "payment_status_display",
  "provision_no",
  "receipt_no",
  "reference_id",
  "refund_date",
  "refund_reason",
  "refunded_by_id",
  "tds",
  "transaction_id",
  "transaction_type",
] as const;

function expectProductionTransaction(
  transaction: object | undefined,
  type: number,
  label: string,
): void {
  expect(transaction, `${label} has a transaction`).toBeDefined();
  const keys = Object.keys(transaction ?? {});
  for (const key of PRODUCTION_KEYS) {
    expect(keys, `${label} sends ${key}`).toContain(key);
  }
  expect(transaction, label).toMatchObject({
    // A string of 15 digits, not an integer.
    conversation_id: expect.stringMatching(/^\d{15}$/),
    association_id: 1,
    tds: expect.any(Boolean),
    transaction_type: type,
  });
}

describe("the Transaction every detail embeds", () => {
  test("carries production's keys on dues and debts, with transaction_type 2", async () => {
    const client = createTestClient();
    const db = orgStore(client.mock.runtime.world().store, "kelder");
    const payment = db.subscriptions.find((row) => row.status === 2);
    const debt = db.subscriptions.find((row) => row.status === 1);
    const due = await client.ok("getMembershipDueDetails", {
      path: { subscription_id: payment?.id ?? 0 },
    });
    expectProductionTransaction(
      due.subscription?.transaction,
      TRANSACTION_TYPE.dues,
      "a due",
    );
    const owed = await client.ok("getDebtDetails", {
      path: { debt_id: debt?.id ?? 0 },
    });
    expectProductionTransaction(
      owed.subscription?.transaction,
      TRANSACTION_TYPE.dues,
      "a debt",
    );
  });

  test("carries them on donation and micro donation details", async () => {
    const client = createTestClient();
    const db = orgStore(client.mock.runtime.world().store, "kelder");
    const donation = db.donations.list()[0];
    const micro = db.microDonations.list()[0];
    const detail = await client.ok("getDonationDetails", {
      path: { donation_id: donation?.id ?? 0 },
    });
    expectProductionTransaction(
      detail.donation?.transaction,
      TRANSACTION_TYPE.donation,
      "a donation",
    );
    const microDetail = await client.ok("getMicroDonationDetails", {
      path: { donation_id: micro?.id ?? 0 },
    });
    expectProductionTransaction(
      microDetail.donation?.transaction,
      TRANSACTION_TYPE.donation,
      "a micro donation",
    );
  });

  test("carries them on ticket sale and form answer details", async () => {
    const client = createTestClient();
    const db = orgStore(client.mock.runtime.world().store, "kelder");
    const sale = db.ticketSales.list()[0];
    const ticketSale = await client.ok("getTicketSaleDetails", {
      path: { ticket_sale_id: sale?.id ?? 0 },
    });
    expectProductionTransaction(
      ticketSale.ticket_sale?.transaction,
      TRANSACTION_TYPE.ticket,
      "a ticket sale",
    );
    const answer = db.formAnswers.find((row) => row.transaction_id !== null);
    const formAnswer = await client.ok("getFormAnswerDetails", {
      path: { form_id: answer?.form_id ?? 0, answer_id: answer?.id ?? 0 },
    });
    // The forms correction makes the answer's transaction nullable.
    expectProductionTransaction(
      formAnswer.answer?.transaction ?? undefined,
      TRANSACTION_TYPE.form,
      "a form answer",
    );
  });

  test("names the city and country of a paying address, and nulls them without one", async () => {
    const client = createTestClient();
    const db = orgStore(client.mock.runtime.world().store, "kelder");
    const payment = db.subscriptions.find((row) => row.status === 2);
    const debt = db.subscriptions.find((row) => row.status === 1);
    const paid = await client.ok("getMembershipDueDetails", {
      path: { subscription_id: payment?.id ?? 0 },
    });
    expect(paid.subscription?.transaction).toMatchObject({
      ip_address: expect.any(String),
      city: expect.any(String),
      country: "Türkiye",
    });
    const owed = await client.ok("getDebtDetails", {
      path: { debt_id: debt?.id ?? 0 },
    });
    expect(owed.subscription?.transaction).toMatchObject({
      ip_address: null,
      city: null,
      country: null,
    });
  });
});
