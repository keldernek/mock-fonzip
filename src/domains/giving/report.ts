import { notFound } from "../../api/errors";
import type { Handler, ResponseBody } from "../../api/handler";
import { inDateRange, parseDateRange } from "../../api/listing";
import type { operations } from "../../generated/openapi";
import { userName } from "../../store/joins";
import { CURRENCIES, TRY_CURRENCY_ID } from "../../store/reference";
import type { OrgStore } from "../../store/store";
import { lookup, viewOf, type DonationView } from "./rows";

type ReportType = NonNullable<
  operations["getDonationReport"]["parameters"]["query"]["report_type"]
>;
type ReportItem = NonNullable<
  ResponseBody<"getDonationReport", 200>["list"]
>[number];
type GroupFields = Omit<ReportItem, "ts" | "tc" | "tu">;

interface Group {
  readonly key: string;
  readonly fields: GroupFields;
}

type Grouping = (store: OrgStore, view: DonationView) => Group;

function campaignOf(store: OrgStore, { donation }: DonationView) {
  return lookup(store.fundraisingCampaigns, donation.fundraising_campaign_id);
}

function addedBy(store: OrgStore, { donation }: DonationView): GroupFields {
  return {
    added_by_id: donation.added_by_id ?? undefined,
    added_by__name: userName(store, donation.added_by_id),
  };
}

const GROUPINGS: { readonly [K in ReportType]: Grouping } = {
  1: (store, { donation }) => ({
    key: String(donation.sub_donation_type_id),
    fields: {
      sub_donation_type__name: lookup(
        store.donationCategories,
        donation.sub_donation_type_id,
      )?.name,
    },
  }),
  2: (store, { donation }) => ({
    key: String(donation.fundraising_page_id),
    fields: {
      fundraising_page__title: lookup(
        store.donationPages,
        donation.fundraising_page_id,
      )?.title,
    },
  }),
  3: (store, view) => {
    const campaign = campaignOf(store, view);
    return {
      key: String(campaign?.id),
      fields: { fundraising_campaign__title: campaign?.title },
    };
  },
  4: (store, view) => ({
    key: String(view.donation.added_by_id),
    fields: addedBy(store, view),
  }),
  5: (store, { donation }) => ({
    key: String(donation.module_id),
    fields: {
      module__title: lookup(store.donationForms, donation.module_id)?.title,
    },
  }),
  6: (_store, { donation }) => {
    const subStatus = donation.recurring_withdrawal ? 1 : 0;
    return {
      key: `${donation.recurring_status}/${subStatus}`,
      fields: { status: donation.recurring_status, sub_status: subStatus },
    };
  },
  7: (store, view) => {
    const target = lookup(
      store.fundraisingEvents,
      campaignOf(store, view)?.association_campaign_target_id ?? null,
    );
    return {
      key: String(target?.id),
      fields: {
        fundraising_campaign__association_campaign_target__title: target?.title,
      },
    };
  },
  8: (store, view) => {
    const team = lookup(
      store.fundraisingTeams,
      campaignOf(store, view)?.team_id ?? null,
    );
    return {
      key: String(team?.id),
      fields: { fundraising_campaign__team__title: team?.title },
    };
  },
  9: (store, view) => {
    const teamCampaign = lookup(
      store.teamCampaigns,
      campaignOf(store, view)?.team_campaign_id ?? null,
    );
    return {
      key: String(teamCampaign?.id),
      fields: {
        fundraising_campaign__team_campaign__title: teamCampaign?.title,
      },
    };
  },
  10: (store, { donation }) => ({
    key: String(donation.f2f_group_id),
    fields: {
      f2f_group__name: lookup(store.f2fGroups, donation.f2f_group_id)?.title,
    },
  }),
  11: (store, view) => ({
    key: `${view.donation.f2f_group_id}/${view.donation.added_by_id}`,
    fields: {
      f2f_group__name: lookup(store.f2fGroups, view.donation.f2f_group_id)
        ?.title,
      ...addedBy(store, view),
    },
  }),
};

function totals(views: readonly DonationView[]) {
  const sum = views.reduce((total, view) => total + view.transaction.amount, 0);
  return {
    ts: Math.round(sum * 100) / 100,
    tc: views.length,
    tu: new Set(views.map((view) => view.donation.user_id)).size,
  };
}

export const getDonationReport: Handler<"getDonationReport"> = (
  { query },
  { store },
) => {
  const range = parseDateRange(query.start_date, query.end_date);
  if ("error" in range) return { status: 400, body: { error: range.error } };
  const currencyId = query.currency_id ?? TRY_CURRENCY_ID;
  if (!CURRENCIES.some((currency) => currency.id === currencyId)) {
    return notFound("Currency");
  }
  const views = store.donations
    .list()
    .map((donation) => viewOf(store, donation))
    .filter(
      ({ transaction }) =>
        transaction.payment_status === 3 &&
        transaction.currency_id === currencyId &&
        inDateRange(transaction.complete_date, range),
    );
  if (query.aggregate === "true") return { status: 200, body: totals(views) };
  const grouping = GROUPINGS[query.report_type ?? 1];
  const groups = new Map<
    string,
    { fields: GroupFields; views: DonationView[] }
  >();
  for (const view of views) {
    const { key, fields } = grouping(store, view);
    const group = groups.get(key) ?? { fields, views: [] };
    group.views.push(view);
    groups.set(key, group);
  }
  return {
    status: 200,
    body: {
      list: [...groups.values()]
        .map(({ fields, views: members }) => ({
          ...fields,
          ...totals(members),
        }))
        .sort((a, b) => b.ts - a.ts || b.tc - a.tc),
    },
  };
};
