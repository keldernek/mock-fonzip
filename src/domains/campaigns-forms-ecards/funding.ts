import type { Row } from "../../store/collection";
import type { FundraisingCampaignRecord } from "../../store/records";
import {
  CURRENCIES,
  currencyById,
  PAYMENT_STATUS,
} from "../../store/reference";
import type { OrgStore } from "../../store/store";

export const DELETED_CAMPAIGN = 4;

interface Funding {
  readonly sum: number;
  readonly count: number;
}

export function knownCurrency(id: number): boolean {
  return CURRENCIES.some((currency) => currency.id === id);
}

function convert(amount: number, from: number, to: number): number {
  if (from === to) return amount;
  return (amount * currencyById(from).value) / currencyById(to).value;
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function funding(
  store: OrgStore,
  campaigns: readonly Row<FundraisingCampaignRecord>[],
  currencyId: number,
): Funding {
  const ids = new Set(campaigns.map((campaign) => campaign.id));
  let sum = 0;
  let count = 0;
  for (const donation of store.donations.list(
    (row) =>
      row.fundraising_campaign_id !== null &&
      ids.has(row.fundraising_campaign_id),
  )) {
    const transaction = store.transactions.get(donation.transaction_id);
    if (transaction?.payment_status !== PAYMENT_STATUS.successful) continue;
    sum += convert(transaction.amount, transaction.currency_id, currencyId);
    count += 1;
  }
  return { sum: roundMoney(sum), count };
}

export function liveCampaigns(
  store: OrgStore,
  belongs: (campaign: Row<FundraisingCampaignRecord>) => boolean,
): Row<FundraisingCampaignRecord>[] {
  return store.fundraisingCampaigns.list(
    (campaign) => campaign.status !== DELETED_CAMPAIGN && belongs(campaign),
  );
}
