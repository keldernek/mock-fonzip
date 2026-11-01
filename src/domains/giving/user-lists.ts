import { notFound } from "../../api/errors";
import type { Handler } from "../../api/handler";
import { newestFirst, paginate, type PageRequest } from "../../api/listing";
import type { components } from "../../generated/openapi";
import type { OrgCollection } from "../../store/collection";
import { present, transactionJoin } from "../../store/joins";
import type { DonationRecord } from "../../store/records";
import type { OrgStore } from "../../store/store";
import { isMonthlyParent, monthlyRequestOf } from "./monthly";
import { paymentStatusOf } from "./payments";
import { lookup, viewOf, type DonationView } from "./rows";

type S = components["schemas"];

function usersDonation(
  store: OrgStore,
  { donation, transaction }: DonationView,
): S["UsersDonation"] {
  const tx = transactionJoin(store, transaction);
  return {
    id: donation.id,
    sub_donation_type_id: present(donation.sub_donation_type_id),
    sub_donation_type__name: lookup(
      store.donationCategories,
      donation.sub_donation_type_id,
    )?.name,
    d_type: donation.d_type,
    transaction__payment_method: tx.transaction__payment_method,
    transaction__complete_date: tx.transaction__complete_date,
    transaction__amount: tx.transaction__amount,
    transaction__currency__display: tx.transaction__currency__display,
    transaction__payment_status: paymentStatusOf(transaction),
  };
}

function usersDonations(
  store: OrgStore,
  source: OrgCollection<DonationRecord>,
  userId: number,
  page: PageRequest,
) {
  if (!store.users.get(userId)) return notFound("User");
  const views = source
    .list((donation) => donation.user_id === userId)
    .map((donation) => viewOf(store, donation))
    .sort(newestFirst((view) => view.transaction.complete_date));
  return {
    status: 200,
    body: {
      donation_list: paginate(views, page).map((view) =>
        usersDonation(store, view),
      ),
      total: views.length,
    },
  } as const;
}

export const getUsersDonationList: Handler<"getUsersDonationList"> = (
  { path, query },
  { store },
) => usersDonations(store, store.donations, path.user_id, query);

export const getUsersMicroDonationList: Handler<"getUsersMicroDonationList"> = (
  { path, query },
  { store },
) => usersDonations(store, store.microDonations, path.user_id, query);

function usersMonthlyDonation(
  store: OrgStore,
  { donation, transaction }: DonationView,
): S["UsersMonthlyDonation"] {
  const tx = transactionJoin(store, transaction);
  const page = lookup(store.donationPages, donation.fundraising_page_id);
  const campaign = lookup(
    store.fundraisingCampaigns,
    donation.fundraising_campaign_id,
  );
  const application = lookup(store.applications, donation.application_id);
  const card = lookup(store.cardInfos, donation.card_info_id);
  const request = monthlyRequestOf(store, donation.id);
  return {
    id: donation.id,
    sub_donation_type_id: present(donation.sub_donation_type_id),
    sub_donation_type__name: lookup(
      store.donationCategories,
      donation.sub_donation_type_id,
    )?.name,
    transaction__payment_method: tx.transaction__payment_method,
    transaction__complete_date: tx.transaction__complete_date,
    transaction__amount: tx.transaction__amount,
    transaction__currency__display: tx.transaction__currency__display,
    fundraising_page_id: page?.id,
    fundraising_page__title: page?.title,
    fundraising_campaign_id: campaign?.id,
    fundraising_campaign__title: campaign?.title,
    application_id: application?.id,
    application__title: application?.title,
    recurring_next_amount: present(donation.recurring_next_amount),
    card_info_id: card?.id,
    recurring_order_id: present(donation.recurring_order_id),
    user_id: donation.user_id,
    card_info__last_four: card?.last_four,
    recurring_status: donation.recurring_status,
    recurring_next_cycle: present(donation.recurring_next_cycle),
    recurringcancelrequest__status: request?.status,
    recurringcancelrequest__request_type: request?.request_type,
  };
}

export const getUsersMonthlyDonationList: Handler<
  "getUsersMonthlyDonationList"
> = ({ path }, { store }) => {
  if (!store.users.get(path.user_id)) return notFound("User");
  const series = store.donations
    .list(
      (donation) =>
        donation.user_id === path.user_id && isMonthlyParent(donation),
    )
    .map((donation) => viewOf(store, donation))
    .sort(newestFirst((view) => view.transaction.complete_date));
  return {
    status: 200,
    body: {
      recurring: series.map((view) => usersMonthlyDonation(store, view)),
    },
  };
};
