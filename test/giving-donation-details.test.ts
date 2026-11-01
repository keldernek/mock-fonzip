import { describe, expect, test } from "bun:test";

import { presentPaths } from "../src/spec/properties";
import {
  ALL_TIME,
  givingClient,
  idsOf,
  kelder,
  listAll,
  PAGE,
} from "./giving-support";

describe("getDonationDetails", () => {
  test("returns every seeded donation with its donor, payment and joins", async () => {
    const client = givingClient();
    const db = kelder(client);
    const paths = new Set<string>();
    for (const donation of db.donations.list()) {
      const body = await client.ok("getDonationDetails", {
        path: { donation_id: donation.id },
      });
      presentPaths(body, "", paths);
      const transaction = db.transactions.get(donation.transaction_id);
      const user = db.users.get(donation.user_id);
      expect(body.donation).toMatchObject({
        id: donation.id,
        name: donation.name,
        recurring_status: donation.recurring_status,
        recurring_withdrawal: donation.recurring_withdrawal,
        user: { id: user?.id, membership_no: user?.membership_no },
        transaction: {
          id: transaction?.id,
          amount: transaction?.amount,
          payment_status: transaction?.payment_status,
          fonzip_id: transaction?.fonzip_id,
          currency: { id: transaction?.currency_id },
        },
      });
      const card =
        donation.card_info_id === null
          ? undefined
          : db.cardInfos.get(donation.card_info_id);
      expect(body.donation?.card_info).toBe(card?.display);
    }
    const documented = [
      "donation.recurring_error",
      "donation.recurring_cancel_date",
      "donation.recurring_cancel_reason",
      "donation.sent_mail_to_referring.status",
      "donation.module__custom_parameters",
      "donation.transaction.refunded_by__name",
      "donation.transaction.error_code",
      "donation.transaction.bank_account.currency_id",
      "donation.transaction.payment_settings.provider_no",
      "donation.card_info",
      "donation.updated_by__name",
    ];
    for (const path of documented) {
      expect(paths.has(path), `some donation carries ${path}`).toBe(true);
    }
  });

  test("a monthly series marks only its withdrawals as withdrawals", async () => {
    const client = givingClient();
    const first = await client.ok("getDonationDetails", {
      path: { donation_id: 50_001 },
    });
    expect(first.donation).toMatchObject({
      recurring_withdrawal: false,
      recurring_order_id: "RO-75751845",
      recurring_status: 1,
      card_info: expect.stringMatching(/\*\* \*\*\*\* \d{4}$/),
    });
    const withdrawal = kelder(client).donations.find(
      (row) => row.monthly_donation_id === 50_001,
    );
    const second = await client.ok("getDonationDetails", {
      path: { donation_id: withdrawal?.id ?? 0 },
    });
    expect(second.donation).toMatchObject({
      recurring_withdrawal: true,
      recurring_order_id: "RO-75751845",
    });
  });

  test("answers 404 for an unknown donation and for a micro donation id", async () => {
    const client = givingClient();
    for (const donationId of [49_999, 80_001]) {
      const response = await client.call("getDonationDetails", {
        path: { donation_id: donationId },
      });
      expect(response).toMatchObject({
        status: 404,
        body: { error: "Donation not found" },
      });
    }
  });
});

describe("getMicroDonationDetails", () => {
  test("returns each micro donation with its form", async () => {
    const client = givingClient();
    const db = kelder(client);
    const paths = new Set<string>();
    for (const micro of db.microDonations.list()) {
      const body = await client.ok("getMicroDonationDetails", {
        path: { donation_id: micro.id },
      });
      const form =
        micro.module_id === null
          ? undefined
          : db.donationForms.get(micro.module_id);
      expect(body.donation?.id).toBe(micro.id);
      expect(body.donation?.module_id).toBe(form?.id);
      expect(body.donation?.module__name).toBe(form?.title);
      expect(body.donation?.transaction?.id).toBe(micro.transaction_id);
      presentPaths(body, "", paths);
    }
    for (const path of [
      "donation.sent_mail.status",
      "donation.sent_mail_to_referring.message_id",
      "donation.transaction.bank_account.name",
      "donation.recurring_cancel_reason",
    ]) {
      expect(paths.has(path), `some micro donation carries ${path}`).toBe(true);
    }
  });

  test("answers 404 for an unknown micro donation and for a donation id", async () => {
    const client = givingClient();
    for (const donationId of [79_999, 50_001]) {
      const response = await client.call("getMicroDonationDetails", {
        path: { donation_id: donationId },
      });
      expect(response).toMatchObject({
        status: 404,
        body: { error: "Micro donation not found" },
      });
    }
  });
});

describe("deleteDonation", () => {
  test("removes the donation, voids its payment and releases its bank transfer", async () => {
    const client = givingClient();
    const db = kelder(client);
    const transfer = db.bankTransactions.find(
      (row) => row.matched_donation_id !== null,
    );
    const donationId = transfer?.matched_donation_id ?? 0;
    const donation = db.donations.get(donationId);
    const transaction = db.transactions.get(donation?.transaction_id ?? 0);
    const before = db.users.get(donation?.user_id ?? 0)?.total_financial ?? 0;
    const paid = await listAll(client, "getDonationList", { status: "paid" });
    expect(idsOf(paid.rows)).toContain(donationId);

    const deleted = await client.ok("deleteDonation", {
      path: { donation_id: donationId },
    });
    expect(deleted).toEqual({ result: "ok" });

    const detail = await client.call("getDonationDetails", {
      path: { donation_id: donationId },
    });
    expect(detail.status).toBe(404);
    const after = await listAll(client, "getDonationList", { status: "paid" });
    expect(after.total).toBe(paid.total - 1);
    expect(idsOf(after.rows)).not.toContain(donationId);
    expect(db.transactions.get(transaction?.id ?? 0)).toMatchObject({
      payment_status: 6,
      payment_status_display: "Silindi",
    });
    const transfers = await client.ok("getBankAccountTransactionList", {
      path: { account_id: transfer?.bank_account_id ?? 0 },
      query: { ...ALL_TIME, ...PAGE, payment_status: 8 },
    });
    expect(
      transfers.transaction_list?.find((row) => row.id === transfer?.id),
      "the transfer waits to be matched again",
    ).toMatchObject({ matched_donation_id: null, transaction_type: null });
    expect(db.users.get(donation?.user_id ?? 0)?.total_financial).toBe(
      Math.round((before - (transaction?.amount ?? 0)) * 100) / 100,
    );
    const again = await client.call("deleteDonation", {
      path: { donation_id: donationId },
    });
    expect(again.status, "already deleted").toBe(404);
  });

  test("deletes a monthly withdrawal but refuses the monthly donation itself", async () => {
    const client = givingClient();
    const db = kelder(client);
    const withdrawal = db.donations.find(
      (row) => row.monthly_donation_id === 50_001,
    );
    const ok = await client.call("deleteDonation", {
      path: { donation_id: withdrawal?.id ?? 0 },
    });
    expect(ok.status).toBe(200);
    const refused = await client.call("deleteDonation", {
      path: { donation_id: 50_001 },
    });
    expect(refused).toMatchObject({
      status: 400,
      body: {
        error: "A monthly donation cannot be deleted. Cancel it instead.",
      },
    });
    expect(
      db.donations.get(50_001),
      "the monthly donation stays",
    ).toBeDefined();
  });

  test("answers 404 for an unknown donation", async () => {
    const client = givingClient();
    const response = await client.call("deleteDonation", {
      path: { donation_id: 49_999 },
    });
    expect(response).toMatchObject({
      status: 404,
      body: { error: "Donation not found" },
    });
  });
});
