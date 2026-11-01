import type { ResponseBody } from "../../api/handler";
import { RELATIONS } from "../../store/relations";
import type { OrgStore } from "../../store/store";
import { roundMoney } from "./funding";

export type MergeReport = NonNullable<
  ResponseBody<"respondFormAnswer", 200>["merge"]
>;

function reassignUser(store: OrgStore, from: number, to: number): void {
  for (const relation of RELATIONS) {
    if (relation.to !== "users") continue;
    for (const row of store[relation.from].list()) {
      const value: unknown = Reflect.get(row, relation.field);
      if (value === from) {
        Reflect.set(row, relation.field, to);
      } else if (Array.isArray(value) && value.includes(from)) {
        Reflect.set(
          row,
          relation.field,
          value.map((id: unknown) => (id === from ? to : id)),
        );
      }
    }
  }
}

function dropDuplicateTags(store: OrgStore, userId: number): void {
  const seen = new Set<number>();
  for (const link of store.userTags.list((row) => row.user_id === userId)) {
    if (seen.has(link.tag_id)) store.userTags.remove(link.id);
    seen.add(link.tag_id);
  }
}

function dropSettledPairs(store: OrgStore): void {
  const seen = new Set<string>();
  for (const pair of store.mergeCandidates.list()) {
    const key = `${pair.first_user_id}:${pair.second_user_id}`;
    if (pair.first_user_id === pair.second_user_id || seen.has(key)) {
      store.mergeCandidates.remove(pair.id);
    }
    seen.add(key);
  }
}

export function mergePendingDuplicate(
  store: OrgStore,
  userId: number | null,
): MergeReport {
  const pair =
    userId === null
      ? undefined
      : store.mergeCandidates.find(
          (row) =>
            row.first_user_id === userId || row.second_user_id === userId,
        );
  if (!pair) return { status: "none" };
  const ids = {
    first_user_id: pair.first_user_id,
    second_user_id: pair.second_user_id,
  };
  const survivor = store.users.get(pair.first_user_id);
  const retired = store.users.get(pair.second_user_id);
  if (!survivor || !retired) {
    return {
      status: "failed",
      reason: "error",
      message: "One of the two contacts no longer exists.",
      ...ids,
    };
  }
  if (survivor.admin || retired.admin) {
    return {
      status: "skipped",
      reason: "not_mergeable",
      message: "An admin profile is never merged automatically.",
      ...ids,
    };
  }
  reassignUser(store, retired.id, survivor.id);
  store.users.update(survivor.id, {
    total_financial: roundMoney(
      survivor.total_financial + retired.total_financial,
    ),
  });
  store.users.remove(retired.id);
  dropDuplicateTags(store, survivor.id);
  dropSettledPairs(store);
  return {
    status: "merged",
    user_id: survivor.id,
    merged_user_id: retired.id,
  };
}
