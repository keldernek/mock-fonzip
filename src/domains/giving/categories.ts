import { notFound } from "../../api/errors";
import type { Handler } from "../../api/handler";
import { matchesQuery, paginate } from "../../api/listing";
import type { components } from "../../generated/openapi";
import type { Row } from "../../store/collection";
import { present, userName } from "../../store/joins";
import type {
  DonationCategoryRecord,
  DonationRecord,
} from "../../store/records";
import type { OrgStore } from "../../store/store";
import { now, transactionOf } from "./payments";

export function lastDonationDate(
  store: OrgStore,
  matches: (donation: DonationRecord) => boolean,
): string | undefined {
  let latest: string | undefined;
  for (const donation of [
    ...store.donations.list(matches),
    ...store.microDonations.list(matches),
  ]) {
    const transaction = transactionOf(store, donation);
    if (transaction.payment_status !== 3) continue;
    if (
      latest === undefined ||
      Date.parse(transaction.complete_date) > Date.parse(latest)
    ) {
      latest = transaction.complete_date;
    }
  }
  return latest;
}

function toCategory(
  store: OrgStore,
  category: Row<DonationCategoryRecord>,
): components["schemas"]["DonationCategory"] {
  return {
    id: category.id,
    name: category.name,
    active: category.active,
    create_date: category.create_date,
    created_by_id: present(category.created_by_id),
    created_by__name: userName(store, category.created_by_id),
    update_date: present(category.update_date),
    updated_by_id: present(category.updated_by_id),
    updated_by__name: userName(store, category.updated_by_id),
    last_donation_date: lastDonationDate(
      store,
      (donation) => donation.sub_donation_type_id === category.id,
    ),
  };
}

export const getDonationCategoryList: Handler<"getDonationCategoryList"> = (
  { query },
  { store },
) => {
  const matching = store.donationCategories.list((category) =>
    matchesQuery(query.query, [category.name]),
  );
  const [first] = paginate(matching, query);
  return {
    status: 200,
    body: {
      category_list: first && toCategory(store, first),
      total: matching.length,
    },
  };
};

const NAME_REQUIRED = {
  status: 400,
  body: { error: "name is required" },
} as const;

export const createDonationCategory: Handler<"createDonationCategory"> = (
  { body },
  ctx,
) => {
  const name = body.name?.trim() ?? "";
  if (name === "") return NAME_REQUIRED;
  const category = ctx.store.donationCategories.insert({
    name,
    active: true,
    create_date: now(ctx),
    created_by_id: null,
    update_date: null,
    updated_by_id: null,
  });
  return { status: 200, body: { result: "ok", category_id: category.id } };
};

export const updateDonationCategory: Handler<"updateDonationCategory"> = (
  { path, body },
  ctx,
) => {
  if (!ctx.store.donationCategories.get(path.category_id)) {
    return notFound("Donation category");
  }
  const name = body.name?.trim() ?? "";
  if (name === "") return NAME_REQUIRED;
  ctx.store.donationCategories.update(path.category_id, {
    name,
    update_date: now(ctx),
    updated_by_id: null,
  });
  return { status: 200, body: { result: "ok" } };
};

export const updateDonationCategoryStatus: Handler<
  "updateDonationCategoryStatus"
> = ({ path, body }, ctx) => {
  const updated = ctx.store.donationCategories.update(path.category_id, {
    active: body.active,
    update_date: now(ctx),
    updated_by_id: null,
  });
  if (!updated) return notFound("Donation category");
  return { status: 200, body: { result: "ok" } };
};

function detachCategory(store: OrgStore, categoryId: number): void {
  for (const source of [store.donations, store.microDonations]) {
    for (const donation of source.list(
      (row) => row.sub_donation_type_id === categoryId,
    )) {
      source.update(donation.id, { sub_donation_type_id: null });
    }
  }
  for (const campaign of store.fundraisingCampaigns.list(
    (row) => row.sub_donation_type_id === categoryId,
  )) {
    store.fundraisingCampaigns.update(campaign.id, {
      sub_donation_type_id: null,
    });
  }
  for (const catalog of [store.donationPages, store.donationForms]) {
    for (const entry of catalog.list((row) => row.category_id === categoryId)) {
      catalog.update(entry.id, { category_id: null });
    }
  }
}

export const deleteDonationCategory: Handler<"deleteDonationCategory"> = (
  { path },
  { store },
) => {
  if (!store.donationCategories.remove(path.category_id)) {
    return notFound("Donation category");
  }
  detachCategory(store, path.category_id);
  return { status: 200, body: { result: "ok" } };
};
