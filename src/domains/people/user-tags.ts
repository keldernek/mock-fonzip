import { notFound } from "../../api/errors";
import type { Handler } from "../../api/handler";
import { istanbulDateTime } from "../../seed/dates";

export const getUsersTagsList: Handler<"getUsersTagsList"> = (
  { path },
  { store },
) => {
  if (!store.users.get(path.user_id)) return notFound("User");
  const linked = new Set(
    store.userTags
      .list((link) => link.user_id === path.user_id)
      .map((link) => link.tag_id),
  );
  return {
    status: 200,
    body: {
      tags: store.tags
        .list((tag) => linked.has(tag.id))
        .map((tag) => ({ id: tag.id, name: tag.name, color: tag.color })),
    },
  };
};

export const addTagToUser: Handler<"addTagToUser"> = (
  { path },
  { store, clock },
) => {
  if (!store.users.get(path.user_id)) return notFound("User");
  if (!store.tags.get(path.tag_id)) return notFound("Tag");
  const linked = store.userTags.find(
    (link) => link.user_id === path.user_id && link.tag_id === path.tag_id,
  );
  if (!linked) {
    store.userTags.insert({
      user_id: path.user_id,
      tag_id: path.tag_id,
      create_date: istanbulDateTime(clock.now()),
    });
  }
  return { status: 200, body: { result: "ok" } };
};

export const removeTagFromUser: Handler<"removeTagFromUser"> = (
  { path },
  { store },
) => {
  if (!store.users.get(path.user_id)) return notFound("User");
  if (!store.tags.get(path.tag_id)) return notFound("Tag");
  for (const link of store.userTags.list(
    (row) => row.user_id === path.user_id && row.tag_id === path.tag_id,
  )) {
    store.userTags.remove(link.id);
  }
  return { status: 200, body: { result: "ok" } };
};
