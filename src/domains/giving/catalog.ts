import type { Handler } from "../../api/handler";
import { matchesQuery, paginate } from "../../api/listing";
import type { components } from "../../generated/openapi";
import type { Row } from "../../store/collection";
import { present, userName } from "../../store/joins";
import type {
  DonationFormRecord,
  DonationPageRecord,
} from "../../store/records";
import type { OrgStore } from "../../store/store";
import { lastDonationDate } from "./categories";

interface CatalogQuery {
  readonly query?: string;
  readonly category_id?: number;
  readonly payment_settings_id?: number;
}

type CatalogEntry = Pick<
  DonationPageRecord,
  "title" | "category_id" | "payment_settings_id"
>;

function matchesCatalog(entry: CatalogEntry, query: CatalogQuery): boolean {
  return (
    matchesQuery(query.query, [entry.title]) &&
    (query.category_id === undefined ||
      entry.category_id === query.category_id) &&
    (query.payment_settings_id === undefined ||
      entry.payment_settings_id === query.payment_settings_id)
  );
}

function audit(
  store: OrgStore,
  entry: Pick<
    DonationPageRecord,
    "create_date" | "created_by_id" | "update_date" | "updated_by_id"
  >,
) {
  return {
    create_date: entry.create_date,
    created_by_id: present(entry.created_by_id),
    created_by__name: userName(store, entry.created_by_id),
    update_date: present(entry.update_date),
    updated_by_id: present(entry.updated_by_id),
    updated_by__name: userName(store, entry.updated_by_id),
  };
}

type PageOrder = components["schemas"]["DonationPageListOrder"];

interface DatedPage {
  readonly page: Row<DonationPageRecord>;
  readonly lastDonationDate: string | undefined;
}

type Compare = (a: DatedPage, b: DatedPage) => number;

const byOrder: Compare = (a, b) => a.page.order - b.page.order;
const byTitle: Compare = (a, b) =>
  a.page.title
    .toLocaleLowerCase("tr-TR")
    .localeCompare(b.page.title.toLocaleLowerCase("tr-TR"), "tr");
const byId: Compare = (a, b) => a.page.id - b.page.id;

function byLastDonation(direction: 1 | -1): Compare {
  return ({ lastDonationDate: a }, { lastDonationDate: b }) => {
    if (a === undefined || b === undefined) {
      return Number(a === undefined) - Number(b === undefined);
    }
    return direction * (Date.parse(a) - Date.parse(b));
  };
}

function chain(...comparisons: readonly Compare[]): Compare {
  return (a, b) => {
    for (const compare of comparisons) {
      const result = compare(a, b);
      if (result !== 0) return result;
    }
    return 0;
  };
}

const PAGE_ORDERINGS: { readonly [K in PageOrder]: Compare } = {
  order: chain(byOrder, byId),
  title: chain(byTitle, byId),
  "-title": chain((a, b) => byTitle(b, a), byId),
  last_donation_date: chain(byLastDonation(1), byTitle, byId),
  "-last_donation_date": chain(byLastDonation(-1), byTitle, byId),
};

function isPageOrder(value: string | undefined): value is PageOrder {
  return value !== undefined && Object.hasOwn(PAGE_ORDERINGS, value);
}

export const getDonationPageList: Handler<"getDonationPageList"> = (
  { query },
  { store },
) => {
  const matching = store.donationPages
    .list((page) => matchesCatalog(page, query))
    .map((page): DatedPage => ({
      page,
      lastDonationDate: lastDonationDate(
        store,
        (donation) => donation.fundraising_page_id === page.id,
      ),
    }))
    .sort(
      PAGE_ORDERINGS[isPageOrder(query.order_by) ? query.order_by : "order"],
    );
  return {
    status: 200,
    body: {
      result: "ok",
      page_list: paginate(matching, query).map(
        ({ page, lastDonationDate }) => ({
          id: page.id,
          order: page.order,
          title: page.title,
          url: page.url,
          active: page.active,
          listing: page.listing,
          last_donation_date: lastDonationDate,
          ...audit(store, page),
        }),
      ),
      total: matching.length,
    },
  };
};

function toForm(store: OrgStore, form: Row<DonationFormRecord>) {
  return {
    id: form.id,
    order: form.order,
    title: form.title,
    api_url: form.api_url,
    live: form.live,
    version: form.version,
    last_donation_date: lastDonationDate(
      store,
      (donation) => donation.module_id === form.id,
    ),
    ...audit(store, form),
  };
}

export const getDonationFormList: Handler<"getDonationFormList"> = (
  { query },
  { store },
) => {
  const matching = store.donationForms
    .list((form) => matchesCatalog(form, query))
    .sort((a, b) => a.order - b.order || a.id - b.id);
  return {
    status: 200,
    body: {
      form_list: paginate(matching, query).map((form) => toForm(store, form)),
      total: matching.length,
    },
  };
};
