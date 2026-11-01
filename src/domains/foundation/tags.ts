import { notFound } from "../../api/errors";
import type { Handler } from "../../api/handler";
import { matchesQuery, paginate } from "../../api/listing";
import type { Row } from "../../store/collection";
import type { TagRecord } from "../../store/records";
import type { OrgStore } from "../../store/store";

function toTag(tag: Row<TagRecord>) {
  return { id: tag.id, name: tag.name, color: tag.color };
}

export const getTagsList: Handler<"getTagsList"> = ({ query }, { store }) => {
  const matching = store.tags.list((tag) =>
    matchesQuery(query.query, [tag.name]),
  );
  return {
    status: 200,
    body: {
      tag_list: paginate(matching, query).map(toTag),
      total: matching.length,
    },
  };
};

export const createTag: Handler<"createTag"> = ({ body }, { store }) => {
  const tag = store.tags.insert({ name: body.name, color: body.color });
  return { status: 200, body: { result: "ok", tag_id: tag.id } };
};

export const updateTag: Handler<"updateTag"> = ({ path, body }, { store }) => {
  const tag = store.tags.update(path.tag_id, {
    name: body.name,
    color: body.color,
  });
  if (!tag) return notFound("Tag");
  return { status: 200, body: { result: "ok" } };
};

function detachTag(store: OrgStore, tagId: number): void {
  for (const link of store.userTags.list((row) => row.tag_id === tagId)) {
    store.userTags.remove(link.id);
  }
  for (const entry of store.timeline.list((row) => row.tag_id === tagId)) {
    store.timeline.update(entry.id, { tag_id: null });
  }
  for (const ticket of store.tickets.list((row) =>
    row.tags_to_control.includes(tagId),
  )) {
    store.tickets.update(ticket.id, {
      tags_to_control: ticket.tags_to_control.filter((id) => id !== tagId),
    });
  }
}

export const deleteTag: Handler<"deleteTag"> = ({ path }, { store }) => {
  if (!store.tags.remove(path.tag_id)) return notFound("Tag");
  detachTag(store, path.tag_id);
  return { status: 200, body: { result: "ok" } };
};
