import { notFound } from "../../api/errors";
import type { Handler } from "../../api/handler";
import { unmatchBankTransfers } from "../../store/bank-transfers";
import { PAYMENT_STATUS_DISPLAY } from "../../store/reference";
import { listDonations } from "./donation-list";
import { debitDonor, transactionOf } from "./payments";
import { donationDetail, viewOf } from "./rows";

export const getDonationList: Handler<"getDonationList"> = (
  { query },
  { store },
) => listDonations(store, store.donations, query);

export const getMicroDonationList: Handler<"getMicroDonationList"> = (
  { query },
  { store },
) => listDonations(store, store.microDonations, query);

export const getDonationDetails: Handler<"getDonationDetails"> = (
  { path },
  { store },
) => {
  const donation = store.donations.get(path.donation_id);
  if (!donation) return notFound("Donation");
  return {
    status: 200,
    body: { donation: donationDetail(store, viewOf(store, donation)) },
  };
};

export const getMicroDonationDetails: Handler<"getMicroDonationDetails"> = (
  { path },
  { store },
) => {
  const donation = store.microDonations.get(path.donation_id);
  if (!donation) return notFound("Micro donation");
  return {
    status: 200,
    body: { donation: donationDetail(store, viewOf(store, donation)) },
  };
};

export const deleteDonation: Handler<"deleteDonation"> = (
  { path },
  { store },
) => {
  const donation = store.donations.get(path.donation_id);
  if (!donation) return notFound("Donation");
  if (
    donation.recurring_order_id !== null &&
    donation.monthly_donation_id === null
  ) {
    return {
      status: 400,
      body: {
        error: "A monthly donation cannot be deleted. Cancel it instead.",
      },
    };
  }
  const transaction = transactionOf(store, donation);
  if (transaction.payment_status === 3) {
    debitDonor(store, donation, transaction);
  }
  store.transactions.update(transaction.id, {
    payment_status: 6,
    payment_status_display: PAYMENT_STATUS_DISPLAY[6],
  });
  unmatchBankTransfers(store, "matched_donation_id", donation.id);
  store.donations.remove(donation.id);
  return { status: 200, body: { result: "ok" } };
};
