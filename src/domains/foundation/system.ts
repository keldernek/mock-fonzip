import { notFound } from "../../api/errors";
import type { Handler } from "../../api/handler";
import {
  inDateRange,
  matchesQuery,
  newestFirst,
  paginate,
  parseDateRange,
} from "../../api/listing";
import type { Row } from "../../store/collection";
import { present, userName } from "../../store/joins";
import type {
  BankAccountRecord,
  BankTransactionRecord,
} from "../../store/records";
import { currencyById } from "../../store/reference";
import type { OrgStore } from "../../store/store";

export const getPaymentSystemsList: Handler<"getPaymentSystemsList"> = (
  { query },
  { store },
) => {
  const settings = store.paymentSettings.list();
  return {
    status: 200,
    body: {
      payment_settings_list: paginate(settings, query).map((row) => ({
        id: row.id,
        name: row.name,
        provider_no: row.provider_no,
        status: row.status,
        business_account: row.business_account,
      })),
      total: settings.length,
    },
  };
};

function toBankAccount(store: OrgStore, account: Row<BankAccountRecord>) {
  return {
    id: account.id,
    name: account.name,
    bank_name: account.bank_name,
    iban: account.iban,
    details: account.details,
    currency_id: account.currency_id,
    currency__display: currencyById(account.currency_id).display,
    business_account: account.business_account,
    create_date: account.create_date,
    created_by_id: present(account.created_by_id),
    created_by__name: userName(store, account.created_by_id),
    update_date: present(account.update_date),
    updated_by_id: present(account.updated_by_id),
    updated_by__name: userName(store, account.updated_by_id),
  };
}

export const getBankAccountList: Handler<"getBankAccountList"> = (
  { query },
  { store },
) => {
  const accounts = store.bankAccounts.list();
  return {
    status: 200,
    body: {
      account_list: paginate(accounts, query).map((account) =>
        toBankAccount(store, account),
      ),
      total: accounts.length,
    },
  };
};

function toBankTransaction(store: OrgStore, row: Row<BankTransactionRecord>) {
  return {
    id: row.id,
    amount: row.amount,
    currency_code: row.currency_code,
    complete_date: row.complete_date,
    payment_status: row.payment_status,
    transaction_type: row.transaction_type,
    counterparty_name: row.counterparty_name,
    counterparty_iban: row.counterparty_iban,
    counterparty_vkn: row.counterparty_vkn,
    counterparty_bank: row.counterparty_bank,
    description: row.description,
    reference: row.reference,
    bank_transaction_type: row.bank_transaction_type,
    sequence_no: row.sequence_no,
    provider: row.provider,
    matched_user_id: row.matched_user_id,
    matched_user_name: userName(store, row.matched_user_id) ?? null,
    matched_donation_id: row.matched_donation_id,
    matched_subscription_id: row.matched_subscription_id,
    matched_certificate_sale_id: row.matched_certificate_sale_id,
  };
}

export const getBankAccountTransactionList: Handler<
  "getBankAccountTransactionList"
> = ({ path, query }, { store }) => {
  if (!store.bankAccounts.get(path.account_id)) return notFound("Bank account");
  const range = parseDateRange(query.start_date, query.end_date);
  if ("error" in range) return { status: 400, body: { error: range.error } };
  const matching = store.bankTransactions
    .list(
      (row) =>
        row.bank_account_id === path.account_id &&
        inDateRange(row.complete_date, range) &&
        (query.payment_status === undefined ||
          row.payment_status === query.payment_status) &&
        (query.transaction_type === undefined ||
          row.transaction_type === query.transaction_type) &&
        matchesQuery(query.query, [
          row.counterparty_name,
          row.description,
          row.reference,
          row.counterparty_iban,
        ]),
    )
    .sort(newestFirst((row) => row.complete_date));
  return {
    status: 200,
    body: {
      transaction_list: paginate(matching, query).map((row) =>
        toBankTransaction(store, row),
      ),
      total: matching.length,
    },
  };
};

function successfulUses(store: OrgStore, channelId: number) {
  const successful = (transactionId: number): boolean =>
    store.transactions.get(transactionId)?.payment_status === 3;
  return {
    donations: store.donations.count(
      (row) =>
        row.marketing_channel_id === channelId &&
        successful(row.transaction_id),
    ),
    ecards: store.ecardTransactions.count(
      (row) =>
        row.marketing_channel_id === channelId &&
        successful(row.transaction_id),
    ),
  };
}

export const getMarketingChannelList: Handler<"getMarketingChannelList"> = (
  { query },
  { store },
) => {
  const channels = store.marketingChannels.list();
  return {
    status: 200,
    body: {
      channel_list: paginate(channels, query).map((channel) => ({
        id: channel.id,
        utm_source: channel.utm_source,
        utm_medium: channel.utm_medium,
        utm_campaign: channel.utm_campaign,
        utm_content: channel.utm_content,
        create_date: channel.create_date,
        ...successfulUses(store, channel.id),
      })),
      total: channels.length,
    },
  };
};

export const getMarketingChannelFilterValues: Handler<
  "getMarketingChannelFilterValues"
> = (_input, { store }) => {
  const channels = store.marketingChannels.list();
  const distinct = (
    pick: (row: (typeof channels)[number]) => string,
  ): string[] =>
    [...new Set(channels.map(pick).filter((value) => value !== ""))].sort(
      (a, b) => a.localeCompare(b, "tr"),
    );
  return {
    status: 200,
    body: {
      sources: distinct((row) => row.utm_source),
      mediums: distinct((row) => row.utm_medium),
      campaigns: distinct((row) => row.utm_campaign),
      contents: distinct((row) => row.utm_content),
    },
  };
};
