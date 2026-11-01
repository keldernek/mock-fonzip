import { notFound } from "../../api/errors";
import type { Handler, HandlerInput, ResponseBody } from "../../api/handler";
import {
  inDateRange,
  inList,
  matchesAmount,
  matchesQuery,
  newestFirst,
  paginate,
  parseDateRange,
} from "../../api/listing";
import { istanbulDate } from "../../seed/dates";
import type { Row } from "../../store/collection";
import { present, userName } from "../../store/joins";
import type {
  EcardRecord,
  EcardTransactionRecord,
  MarketingChannelRecord,
  TransactionRecord,
} from "../../store/records";
import { currencyById, PAYMENT_STATUS } from "../../store/reference";
import type { OrgStore } from "../../store/store";
import { categoryNames } from "./ecards";
import {
  compareBy,
  dateValue,
  orderKey,
  type OrderField,
  type SortKey,
  type SortValue,
} from "./ordering";

type Sale = Row<EcardTransactionRecord>;
type ListQuery = HandlerInput<"getEcardTransactionList">["query"];
type ListStatus = NonNullable<ListQuery["status"]>;
type ListField = NonNullable<ListQuery["list"]>[number];
type SaleOrder = OrderField<NonNullable<ListQuery["order_by"]>>;
type CardCountry = NonNullable<ListQuery["card_country"]>;
type CardType = NonNullable<ListQuery["card_type"]>;
type SaleListItem = NonNullable<
  ResponseBody<"getEcardTransactionList", 200>["sale_list"]
>[number];

interface SaleView {
  readonly id: number;
  readonly sale: Sale;
  readonly transaction: Row<TransactionRecord>;
  readonly ecard: Row<EcardRecord> | undefined;
  readonly channel: Row<MarketingChannelRecord> | undefined;
}

const PAYMENT_OF: Readonly<Record<ListStatus, number>> = {
  paid: PAYMENT_STATUS.successful,
  refund: PAYMENT_STATUS.refunded,
  failed: PAYMENT_STATUS.failed,
};

const CARDS: Readonly<
  Record<string, { readonly country: CardCountry; readonly type: CardType }>
> = {
  "454360": { country: 1, type: 1 },
  "540667": { country: 1, type: 2 },
  "979203": { country: 1, type: 3 },
  "402277": { country: 2, type: 1 },
};
const UNKNOWN_CARD = { country: 3, type: 4 } as const;

export const CARD_BINS = Object.keys(CARDS);

function cardOf(transaction: Row<TransactionRecord>) {
  if (transaction.bin_number === null) return undefined;
  return CARDS[transaction.bin_number] ?? UNKNOWN_CARD;
}

function viewOf(store: OrgStore, sale: Sale): SaleView | undefined {
  const transaction = store.transactions.get(sale.transaction_id);
  if (!transaction) return undefined;
  return {
    id: sale.id,
    sale,
    transaction,
    ecard: store.ecards.get(sale.certificate_id),
    channel:
      sale.marketing_channel_id === null
        ? undefined
        : store.marketingChannels.get(sale.marketing_channel_id),
  };
}

function views(store: OrgStore, keep: (sale: Sale) => boolean): SaleView[] {
  return store.ecardTransactions.list(keep).flatMap((sale) => {
    const view = viewOf(store, sale);
    return view ? [view] : [];
  });
}

function deliversOn(sale: Sale, isoDate: string): boolean {
  if (sale.delivery_time_mode === 0) return false;
  const day = istanbulDate(new Date(isoDate));
  return (
    sale.delivery_date === day ||
    sale.recipient_list.some((recipient) => recipient.delivery_date === day)
  );
}

function marketingMatches(view: SaleView, query: ListQuery): boolean {
  if (query.marketing_channel_null === true) return view.channel === undefined;
  const filters = [
    [query.utm_source, view.channel?.utm_source],
    [query.utm_medium, view.channel?.utm_medium],
    [query.utm_campaign, view.channel?.utm_campaign],
    [query.utm_content, view.channel?.utm_content],
  ] as const;
  return filters.every(
    ([wanted, value]) =>
      wanted === undefined ||
      wanted.length === 0 ||
      (value !== undefined && inList(value, wanted)),
  );
}

function paidFiltersMatch(view: SaleView, query: ListQuery): boolean {
  const { sale, transaction } = view;
  const card = cardOf(transaction);
  return (
    (query.payment_method === undefined ||
      transaction.payment_method === query.payment_method) &&
    matchesAmount(transaction.amount, query.amount, query.amt_cnd) &&
    (query.bin_number === undefined ||
      transaction.bin_number === String(query.bin_number)) &&
    (query.last_four === undefined ||
      transaction.last_four === String(query.last_four).padStart(4, "0")) &&
    (query.cargo_status === undefined ||
      (query.cargo_status === 4
        ? sale.cargo_status === 1 || sale.cargo_status === 2
        : sale.cargo_status === query.cargo_status)) &&
    (query.ecard_id === undefined || sale.certificate_id === query.ecard_id) &&
    (query.payment_settings_id === undefined ||
      transaction.payment_settings_id === query.payment_settings_id) &&
    (query.bank_account_id === undefined ||
      transaction.bank_account_id === query.bank_account_id) &&
    (query.currency_id === undefined ||
      transaction.currency_id === query.currency_id) &&
    (query.bill_type === undefined || sale.bill_type === query.bill_type) &&
    (query.delivery_date === undefined ||
      deliversOn(sale, query.delivery_date)) &&
    (query.card_country === undefined ||
      card?.country === query.card_country) &&
    (query.card_type === undefined || card?.type === query.card_type) &&
    marketingMatches(view, query)
  );
}

const SALE_ORDER: Readonly<Record<SaleOrder, (view: SaleView) => SortValue>> = {
  transaction__complete_date: (view) =>
    dateValue(view.transaction.complete_date),
  transaction__amount: (view) => view.transaction.amount,
  transaction__refund_date: (view) => dateValue(view.transaction.refund_date),
  id: (view) => view.sale.id,
  first_name: (view) => view.sale.first_name,
  last_name: (view) => view.sale.last_name,
  email: (view) => view.sale.email,
  phone: (view) => view.sale.phone,
  birthday: () => null,
  city: (view) => view.sale.city,
  district: (view) => view.sale.district,
  address: (view) => view.sale.address,
  donor_type: (view) => view.sale.donor_type,
  language: (view) => view.sale.language,
  cargo_status: (view) => view.sale.cargo_status,
  cargo_number: (view) => view.sale.cargo_number,
  cargo_company: (view) => view.sale.cargo_company,
  has_cargo: (view) => view.sale.has_cargo,
  deliver_as_mail: (view) => view.sale.deliver_as_mail,
  deliver_as_cargo: (view) => view.sale.deliver_as_cargo,
  delivery_to: (view) => view.sale.delivery_to,
  delivery_to_name: (view) => view.sale.delivery_to_name,
  delivery_date: (view) => dateValue(view.sale.delivery_date),
  delivery_time_mode: (view) => view.sale.delivery_time_mode,
  ecard_date: (view) => dateValue(view.sale.ecard_date),
  recipient_count: (view) => view.sale.recipient_count,
  recipient_list: (view) => JSON.stringify(view.sale.recipient_list),
  custom_message: (view) => view.sale.custom_message,
  referring: (view) => view.sale.referring,
  third_name: (view) => view.sale.third_name,
  referring_name: (view) => view.sale.referring_name,
  referring_email: (view) => view.sale.referring_email,
  referring_phone: (view) => view.sale.referring_phone,
  bill_type: (view) => view.sale.bill_type,
  billing_name: (view) => view.sale.billing_name,
  tax_info: (view) => view.sale.tax_info,
  billing_address: (view) => view.sale.billing_address,
  billing_district: (view) => view.sale.billing_district,
  billing_city: (view) => view.sale.billing_city,
  news_via_phone: (view) => view.sale.news_via_phone,
  news_via_sms: (view) => view.sale.news_via_sms,
  news_via_email: (view) => view.sale.news_via_email,
  last_update_date: (view) => dateValue(view.sale.last_update_date),
  certificate_id: (view) => view.sale.certificate_id,
  transaction_id: (view) => view.sale.transaction_id,
  user_id: (view) => view.sale.user_id,
  association_id: () => null,
  added_by_id: (view) => view.sale.added_by_id,
  updated_by_id: (view) => view.sale.updated_by_id,
  sent_mail_id: (view) => view.sale.sent_mail_id,
  sent_mail_to_referring_id: (view) => view.sale.sent_mail_to_referring_id,
  marketing_channel_id: (view) => view.sale.marketing_channel_id,
  agreements: () => null,
};

function saleOrdering(orderBy: string): SortKey<SaleView>[] {
  const keys = orderKey(orderBy, SALE_ORDER);
  const [primary] = keys;
  if (primary && orderBy.replace(/^-/, "") === "first_name") {
    return [
      ...keys,
      { value: SALE_ORDER.last_name, descending: primary.descending },
    ];
  }
  return keys;
}

function mailOf(store: OrgStore, id: number | null) {
  return id === null ? undefined : store.sentEmails.get(id);
}

function baseFields(view: SaleView) {
  const { sale, transaction } = view;
  return {
    id: sale.id,
    user_id: present(sale.user_id),
    first_name: sale.first_name,
    last_name: sale.last_name,
    email: sale.email,
    phone: sale.phone,
    certificate_id: sale.certificate_id,
    certificate_file: sale.certificate_file,
    zip_file: sale.zip_file === "" ? undefined : sale.zip_file,
    cargo_status: sale.cargo_status,
    cargo_company: sale.cargo_company,
    cargo_number: sale.cargo_number,
    recipient_count: sale.recipient_count,
    transaction__payment_status: transaction.payment_status,
    transaction__fonzip_framework: transaction.fonzip_framework,
  };
}

function amountFields(view: SaleView) {
  const currency = currencyById(view.transaction.currency_id);
  return {
    transaction__amount: view.transaction.amount,
    transaction__currency__display: currency.display,
    transaction__currency__iso_code: currency.iso_code,
  };
}

function mailFields(store: OrgStore, view: SaleView) {
  const mail = mailOf(store, view.sale.sent_mail_id);
  const referring = mailOf(store, view.sale.sent_mail_to_referring_id);
  return {
    sent_mail_id: present(view.sale.sent_mail_id),
    sent_mail__message_id: mail?.message_id,
    sent_mail__status: mail?.status,
    sent_mail_to_referring_id: present(view.sale.sent_mail_to_referring_id),
    sent_mail_to_referring__message_id: referring?.message_id,
    sent_mail_to_referring__status: referring?.status,
  };
}

function deliveryFields(view: SaleView) {
  return {
    delivery_time_mode: view.sale.delivery_time_mode,
    delivery_date: present(view.sale.delivery_date),
  };
}

function recipients(sale: Sale) {
  return sale.recipient_list.map(({ delivery_date, ...recipient }) => ({
    ...recipient,
    delivery_date: sale.delivery_time_mode === 2 ? delivery_date : undefined,
  }));
}

function defaultFields(store: OrgStore, view: SaleView) {
  return {
    certificate__title: view.ecard?.title,
    ...amountFields(view),
    transaction__payment_method: view.transaction.payment_method,
    transaction__complete_date: view.transaction.complete_date,
    ...deliveryFields(view),
    ...mailFields(store, view),
  };
}

type FieldGroup = (store: OrgStore, view: SaleView) => SaleListItem;

const LIST_FIELDS = {
  ecard: (_store, view) => ({ certificate__title: view.ecard?.title }),
  amount: (_store, view) => amountFields(view),
  email_status: mailFields,
  complete_date: (_store, view) => ({
    transaction__complete_date: view.transaction.complete_date,
  }),
  payment_method: (_store, view) => ({
    transaction__payment_method: view.transaction.payment_method,
  }),
  fonzip_id: (_store, view) => ({
    transaction__fonzip_id: view.transaction.fonzip_id,
  }),
  transaction_id: (_store, view) => ({
    transaction__transaction_id: view.transaction.transaction_id,
  }),
  provision_no: (_store, view) => ({
    transaction__provision_no: present(view.transaction.provision_no),
  }),
  receipt_no: (_store, view) => ({
    transaction__receipt_no: view.transaction.receipt_no,
  }),
  ip_address: (_store, view) => ({
    transaction__ip_address: view.transaction.ip_address,
  }),
  payment_settings_id: (_store, view) => ({
    transaction__payment_settings_id: present(
      view.transaction.payment_settings_id,
    ),
  }),
  payment_settings__name: (store, view) => ({
    transaction__payment_settings__name:
      view.transaction.payment_settings_id === null
        ? undefined
        : store.paymentSettings.get(view.transaction.payment_settings_id)?.name,
  }),
  bank_account_id: (_store, view) => ({
    transaction__bank_account_id: present(view.transaction.bank_account_id),
  }),
  bank_account__name: (store, view) => ({
    transaction__bank_account__name:
      view.transaction.bank_account_id === null
        ? undefined
        : store.bankAccounts.get(view.transaction.bank_account_id)?.name,
  }),
  added_by_id: (store, view) => ({
    added_by_id: present(view.sale.added_by_id),
    added_by__name: userName(store, view.sale.added_by_id),
  }),
  card_number: (_store, view) => ({
    transaction__bin_number: present(view.transaction.bin_number),
    transaction__last_four: present(view.transaction.last_four),
  }),
  delivery_date: (_store, view) => deliveryFields(view),
  news_via_phone: (_store, view) => ({
    news_via_phone: view.sale.news_via_phone,
  }),
  news_via_sms: (_store, view) => ({ news_via_sms: view.sale.news_via_sms }),
  news_via_email: (_store, view) => ({
    news_via_email: view.sale.news_via_email,
  }),
  recipient_list: (_store, view) => ({
    recipient_list: recipients(view.sale),
  }),
  bill_type: (_store, view) => ({ bill_type: view.sale.bill_type }),
  billing_name: (_store, view) => ({ billing_name: view.sale.billing_name }),
  tax_info: (_store, view) => ({ tax_info: view.sale.tax_info }),
  billing_address: (_store, view) => ({
    billing_address: view.sale.billing_address,
  }),
  billing_district: (_store, view) => ({
    billing_district: view.sale.billing_district,
  }),
  billing_city: (_store, view) => ({ billing_city: view.sale.billing_city }),
  address: (_store, view) => ({ address: view.sale.address }),
  city: (_store, view) => ({ city: view.sale.city }),
  district: (_store, view) => ({ district: view.sale.district }),
  referring: (_store, view) => ({ referring: view.sale.referring }),
  third_name: (_store, view) => ({ third_name: view.sale.third_name }),
  referring_name: (_store, view) => ({
    referring_name: view.sale.referring_name,
  }),
  referring_email: (_store, view) => ({
    referring_email: view.sale.referring_email,
  }),
  referring_phone: (_store, view) => ({
    referring_phone: view.sale.referring_phone,
  }),
  language: (_store, view) => ({ language: view.sale.language }),
  donor_type: (_store, view) => ({ donor_type: view.sale.donor_type }),
  delivery_to: (_store, view) => ({ delivery_to: view.sale.delivery_to }),
  delivery_to_name: (_store, view) => ({
    delivery_to_name: view.sale.delivery_to_name,
  }),
  custom_message: (_store, view) => ({
    custom_message: view.sale.custom_message,
  }),
  has_cargo: (_store, view) => ({ has_cargo: view.sale.has_cargo }),
  deliver_as_mail: (_store, view) => ({
    deliver_as_mail: view.sale.deliver_as_mail,
  }),
  deliver_as_cargo: (_store, view) => ({
    deliver_as_cargo: view.sale.deliver_as_cargo,
  }),
  ecard_date: (_store, view) => ({ ecard_date: view.sale.ecard_date }),
  category: (store, view) => ({
    certificate__categories__name: view.ecard
      ? categoryNames(store, view.ecard)
      : [],
  }),
  marketing_channel__utm_source: (_store, view) => ({
    marketing_channel__utm_source: view.channel?.utm_source,
  }),
  marketing_channel__utm_medium: (_store, view) => ({
    marketing_channel__utm_medium: view.channel?.utm_medium,
  }),
  marketing_channel__utm_campaign: (_store, view) => ({
    marketing_channel__utm_campaign: view.channel?.utm_campaign,
  }),
  marketing_channel__utm_content: (_store, view) => ({
    marketing_channel__utm_content: view.channel?.utm_content,
  }),
} satisfies Record<ListField, FieldGroup>;

function refundFields(store: OrgStore, view: SaleView) {
  return {
    transaction__refund_date: present(view.transaction.refund_date),
    transaction__refund_reason: present(view.transaction.refund_reason),
    transaction__refunded_by_id: present(view.transaction.refunded_by_id),
    transaction__refunded_by__name: userName(
      store,
      view.transaction.refunded_by_id,
    ),
  };
}

function errorFields(view: SaleView) {
  return {
    transaction__transaction_error__code: present(view.transaction.error_code),
    transaction__transaction_error__text: present(view.transaction.error_text),
    transaction__transaction_error__group: view.transaction.error_group,
  };
}

function toListItem(
  store: OrgStore,
  view: SaleView,
  status: ListStatus,
  list: readonly ListField[] | undefined,
): SaleListItem {
  const base = baseFields(view);
  switch (status) {
    case "refund":
      return {
        ...base,
        ...defaultFields(store, view),
        ...refundFields(store, view),
      };
    case "failed":
      return { ...base, ...defaultFields(store, view), ...errorFields(view) };
    case "paid":
      if (list === undefined) return { ...base, ...defaultFields(store, view) };
      return list.reduce<SaleListItem>(
        (item, field) => ({ ...item, ...LIST_FIELDS[field](store, view) }),
        base,
      );
  }
}

function dateFor(view: SaleView, status: ListStatus): string | null {
  return status === "refund"
    ? view.transaction.refund_date
    : view.transaction.complete_date;
}

export const getEcardTransactionList: Handler<"getEcardTransactionList"> = (
  { query },
  { store },
) => {
  const range = parseDateRange(query.start_date, query.end_date);
  if ("error" in range) return { status: 400, body: { error: range.error } };
  const status = query.status ?? "paid";
  const rows = views(store, () => true)
    .filter((view) => {
      const at = dateFor(view, status);
      return (
        view.transaction.payment_status === PAYMENT_OF[status] &&
        at !== null &&
        inDateRange(at, range) &&
        matchesQuery(query.query, [
          view.sale.first_name,
          view.sale.last_name,
          view.sale.email,
          view.sale.phone,
          view.sale.referring_name,
          view.sale.delivery_to_name,
        ]) &&
        (status !== "paid" || paidFiltersMatch(view, query))
      );
    })
    .sort(
      compareBy(
        saleOrdering(
          query.order_by ??
            (status === "refund"
              ? "-transaction__refund_date"
              : "-transaction__complete_date"),
        ),
      ),
    );
  return {
    status: 200,
    body: {
      sale_list: paginate(rows, query).map((view) =>
        toListItem(
          store,
          view,
          status,
          status === "paid" ? query.list : undefined,
        ),
      ),
      total: rows.length,
    },
  };
};

function toDetail(store: OrgStore, view: SaleView) {
  const { sale, transaction, ecard } = view;
  const mail = mailOf(store, sale.sent_mail_id);
  const referring = mailOf(store, sale.sent_mail_to_referring_id);
  const settings =
    transaction.payment_settings_id === null
      ? undefined
      : store.paymentSettings.get(transaction.payment_settings_id);
  return {
    id: sale.id,
    user_id: present(sale.user_id),
    certificate_file: sale.certificate_file,
    first_name: sale.first_name,
    last_name: sale.last_name,
    email: sale.email,
    phone: sale.phone,
    address: sale.address,
    city: sale.city,
    district: sale.district,
    referring: sale.referring,
    referring_name: sale.referring_name,
    referring_phone: sale.referring_phone,
    referring_email: sale.referring_email,
    delivery_to: sale.delivery_to,
    delivery_to_name: sale.delivery_to_name,
    deliver_as_cargo: sale.deliver_as_cargo,
    cargo_status: sale.cargo_status,
    donor_type: sale.donor_type,
    cargo_number: sale.cargo_number,
    cargo_company: sale.cargo_company,
    sent_mail__status: mail?.status,
    sent_mail_to_referring__message_id: referring?.message_id,
    certificate_id: sale.certificate_id,
    certificate__title: ecard?.title,
    transaction__payment_settings__name: settings?.name,
    transaction__currency__display: currencyById(transaction.currency_id)
      .display,
    transaction__amount: transaction.amount,
    transaction__payment_status: transaction.payment_status,
    transaction__transaction_error__text: present(transaction.error_text),
    transaction__bin_number: present(transaction.bin_number),
    transaction__refund_date: present(transaction.refund_date),
    transaction__fonzip_id: transaction.fonzip_id,
    transaction__provision_no: present(transaction.provision_no),
    transaction__fonzip_framework: transaction.fonzip_framework,
    certificate__has_cargo: ecard?.has_cargo,
    transaction__payment_method: transaction.payment_method,
    added_by__name: userName(store, sale.added_by_id),
    transaction__refunded_by_id: present(transaction.refunded_by_id),
    transaction__refunded_by__name: userName(store, transaction.refunded_by_id),
    updated_by_id: present(sale.updated_by_id),
    updated_by__name: userName(store, sale.updated_by_id),
    last_update_date: sale.last_update_date,
  };
}

function saleView(store: OrgStore, saleId: number): SaleView | undefined {
  const sale = store.ecardTransactions.get(saleId);
  return sale && viewOf(store, sale);
}

export const getEcardTransactionDetails: Handler<
  "getEcardTransactionDetails"
> = ({ path }, { store }) => {
  const view = saleView(store, path.sale_id);
  if (!view) return notFound("E-card transaction");
  return { status: 200, body: { ecard_transaction: toDetail(store, view) } };
};

export const deleteEcardTransaction: Handler<"deleteEcardTransaction"> = (
  { path },
  { store },
) => {
  const sale = store.ecardTransactions.remove(path.sale_id);
  if (!sale) return notFound("E-card transaction");
  store.transactions.remove(sale.transaction_id);
  for (const transfer of store.bankTransactions.list(
    (row) => row.matched_certificate_sale_id === sale.id,
  )) {
    store.bankTransactions.update(transfer.id, {
      matched_certificate_sale_id: null,
    });
  }
  return { status: 200, body: { result: "ok" } };
};

export const getUserEcardTransactionList: Handler<
  "getUserEcardTransactionList"
> = ({ path, query }, { store }) => {
  if (!store.users.get(path.user_id)) return notFound("User");
  const rows = views(store, (sale) => sale.user_id === path.user_id)
    .filter(
      (view) => view.transaction.payment_status === PAYMENT_STATUS.successful,
    )
    .sort(newestFirst((view) => view.transaction.complete_date));
  return {
    status: 200,
    body: {
      sale_list: paginate(rows, query).map((view) => ({
        id: view.sale.id,
        certificate_id: view.sale.certificate_id,
        certificate__title: view.ecard?.title,
        ...amountFields(view),
        transaction__complete_date: view.transaction.complete_date,
      })),
      total: rows.length,
    },
  };
};
