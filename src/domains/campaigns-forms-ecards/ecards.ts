import { notFound } from "../../api/errors";
import type { Handler } from "../../api/handler";
import { matchesQuery, paginate } from "../../api/listing";
import { apiDateTime } from "../../seed/dates";
import type { Row } from "../../store/collection";
import { present, userName } from "../../store/joins";
import type { EcardCategoryRecord, EcardRecord } from "../../store/records";
import type { OrgStore } from "../../store/store";
import { badRequest } from "./failures";
import { compareBy } from "./ordering";

type Category = Row<EcardCategoryRecord>;

const byOrder = compareBy<Category>([
  { value: (category) => Number(category.order) },
]);

function toCategory(store: OrgStore, category: Category) {
  return {
    id: category.id,
    name: category.name,
    order: category.order,
    create_date: category.create_date,
    created_by_id: present(category.created_by_id),
    created_by__name: userName(store, category.created_by_id),
    update_date: present(category.update_date),
    updated_by_id: present(category.updated_by_id),
    updated_by__name: userName(store, category.updated_by_id),
  };
}

export const getEcardCategoryList: Handler<"getEcardCategoryList"> = (
  { query },
  { store },
) => {
  const categories = store.ecardCategories
    .list((category) => matchesQuery(query.query, [category.name]))
    .sort(byOrder);
  const [first] = paginate(categories, query);
  return {
    status: 200,
    body: {
      category_list: first && toCategory(store, first),
      total: categories.length,
    },
  };
};

function categoryName(name: string | undefined): string | null {
  const trimmed = name?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

export const createEcardCategory: Handler<"createEcardCategory"> = (
  { body },
  { store, clock },
) => {
  const name = categoryName(body.name);
  if (name === null) return badRequest("name is required");
  const last = Math.max(
    0,
    ...store.ecardCategories.list().map((category) => Number(category.order)),
  );
  const category = store.ecardCategories.insert({
    name,
    order: String(last + 1),
    create_date: apiDateTime(clock.now()),
    created_by_id: null,
    update_date: null,
    updated_by_id: null,
  });
  return { status: 200, body: { result: "ok", category_id: category.id } };
};

export const updateEcardCategory: Handler<"updateEcardCategory"> = (
  { path, body },
  { store, clock },
) => {
  if (!store.ecardCategories.get(path.category_id)) {
    return notFound("E-card category");
  }
  const name = categoryName(body.name);
  if (name === null) return badRequest("name is required");
  store.ecardCategories.update(path.category_id, {
    name,
    update_date: apiDateTime(clock.now()),
    updated_by_id: null,
  });
  return { status: 200, body: { result: "ok" } };
};

export const deleteEcardCategory: Handler<"deleteEcardCategory"> = (
  { path },
  { store },
) => {
  if (!store.ecardCategories.remove(path.category_id)) {
    return notFound("E-card category");
  }
  for (const ecard of store.ecards.list((row) =>
    row.categories.includes(path.category_id),
  )) {
    store.ecards.update(ecard.id, {
      categories: ecard.categories.filter((id) => id !== path.category_id),
    });
  }
  return { status: 200, body: { result: "ok" } };
};

export function categoryNames(
  store: OrgStore,
  ecard: Pick<EcardRecord, "categories">,
): string[] {
  return ecard.categories.flatMap((id) => {
    const category = store.ecardCategories.get(id);
    return category ? [category.name] : [];
  });
}

const ecardOrder = compareBy<Row<EcardRecord>>([
  { value: (ecard) => ecard.order },
]);

export const getEcardList: Handler<"getEcardList"> = ({ query }, { store }) => {
  const ecards = store.ecards
    .list(
      (ecard) =>
        (query.listing === undefined || ecard.listing === query.listing) &&
        (query.category_id === undefined ||
          ecard.categories.includes(query.category_id)) &&
        matchesQuery(query.query, [ecard.title]),
    )
    .sort(ecardOrder);
  return {
    status: 200,
    body: {
      ecard_list: paginate(ecards, query).map((ecard) => ({
        id: ecard.id,
        title: ecard.title,
        active: ecard.active,
        order: ecard.order,
        listing: ecard.listing,
        starred: ecard.starred,
        categories: categoryNames(store, ecard),
      })),
      total: ecards.length,
    },
  };
};

export const getEcardDetails: Handler<"getEcardDetails"> = (
  { path },
  { store },
) => {
  const ecard = store.ecards.get(path.ecard_id);
  if (!ecard) return notFound("E-card");
  return { status: 200, body: { ecard } };
};
