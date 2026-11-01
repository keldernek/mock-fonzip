import { errorBody, notFound } from "../../api/errors";
import type { Handler, HandlerContext } from "../../api/handler";
import type { components } from "../../generated/openapi";
import { istanbulDateTime } from "../../seed/dates";
import type { Row } from "../../store/collection";
import { fullName, userDefinedValues } from "../../store/joins";
import type {
  CommunicationPermissionRecord,
  UdvValue,
  UserDefinedValueRecord,
  UserRecord,
} from "../../store/records";
import type { OrgStore } from "../../store/store";
import { newUser } from "../../store/users";
import { recordEvent } from "./timeline";
import {
  applyFields,
  isUpdatableField,
  parseUdvValue,
  type UpdatableField,
} from "./user-fields";

type Schemas = components["schemas"];
type CreateBody = NonNullable<
  components["requestBodies"]["CreateUser"]["content"]["application/json"]
>;
type Channel = "phone" | "sms" | "email";
type User = Row<UserRecord>;
type UpdateBody = NonNullable<
  components["requestBodies"]["UpdateUser"]["content"]["application/json"]
>;

function failure(error: string): { status: 400; body: { error: string } } {
  return { status: 400, body: { error } };
}

function nonEmpty(value: string): string | undefined {
  return value === "" ? undefined : value;
}

function permissionOf(
  store: OrgStore,
  userId: number,
): Row<CommunicationPermissionRecord> | undefined {
  return store.communicationPermissions.find((row) => row.user_id === userId);
}

function toUserDetails(store: OrgStore, user: User) {
  const permission = permissionOf(store, user.id);
  return {
    id: user.id,
    first_name: user.first_name,
    last_name: nonEmpty(user.last_name),
    name: fullName(user),
    nationality_text: nonEmpty(user.nationality_text),
    tckno: nonEmpty(user.tckno),
    birthday: nonEmpty(user.birthday),
    email: nonEmpty(user.email),
    phone: nonEmpty(user.phone),
    home_phone_first: nonEmpty(user.home_phone_first),
    address: nonEmpty(user.address),
    post_code: nonEmpty(user.post_code),
    district_text: nonEmpty(user.district_text),
    city_text: nonEmpty(user.city_text),
    country_text: nonEmpty(user.country_text),
    work_phone: nonEmpty(user.work_phone),
    work_address: nonEmpty(user.work_address),
    work_post_code: nonEmpty(user.work_post_code),
    private: user.private,
    work_district_text: nonEmpty(user.work_district_text),
    work_city_text: nonEmpty(user.work_city_text),
    work_country_text: nonEmpty(user.work_country_text),
    email_second: nonEmpty(user.email_second),
    membership_no: user.membership_no === 0 ? undefined : user.membership_no,
    admin: user.admin,
    corporate_type: user.corporate_type,
    apply_date: nonEmpty(user.apply_date),
    allow_comm_via_phone: permission?.allow_comm_via_phone,
    allow_comm_via_phone_date: permission?.allow_comm_via_phone_date,
    allow_comm_via_sms: permission?.allow_comm_via_sms,
    allow_comm_via_sms_date: permission?.allow_comm_via_sms_date,
    allow_comm_via_email: permission?.allow_comm_via_email,
    allow_comm_via_email_date: permission?.allow_comm_via_email_date,
    join_date: nonEmpty(user.join_date),
    total_financial: user.total_financial,
    user_defined_values: userDefinedValues(user),
  };
}

export const getUserDetails: Handler<"getUserDetails"> = (
  { path },
  { store },
) => {
  const user = store.users.get(path.user_id);
  if (!user) return notFound("User");
  return { status: 200, body: { user: toUserDetails(store, user) } };
};

function nextMembershipNo(store: OrgStore): number {
  return (
    Math.max(0, ...store.users.list().map((user) => user.membership_no)) + 1
  );
}

type MembershipDecision = {
  readonly membership_no_decision?: "no" | "auto" | "custom";
  readonly membership_no?: number;
};

function decideMembershipNo(
  store: OrgStore,
  data: MembershipDecision,
  current: number,
): { ok: true; value: number } | { ok: false; error: string } {
  const decision =
    data.membership_no_decision ??
    (data.membership_no === undefined ? "no" : "custom");
  switch (decision) {
    case "no":
      return { ok: true, value: current };
    case "auto":
      return { ok: true, value: nextMembershipNo(store) };
    case "custom":
      return data.membership_no !== undefined && data.membership_no > 0
        ? { ok: true, value: data.membership_no }
        : {
            ok: false,
            error:
              "Invalid values: membership_no_decision custom needs a positive membership_no",
          };
  }
}

function parseUdvs(
  store: OrgStore,
  raw: Readonly<Record<string, unknown>>,
):
  | { ok: true; value: Record<string, UdvValue> }
  | { ok: false; error: string } {
  const values: Record<string, UdvValue> = {};
  const fields = store.userDefinedValues.list();
  for (const [key, value] of Object.entries(raw)) {
    const udv = fields.find((field) => field.value === key);
    if (!udv) {
      return {
        ok: false,
        error: `Invalid values: no user defined value has the key ${key}`,
      };
    }
    const parsed = parseUdvValue(udv, value);
    if (!parsed.ok) return parsed;
    values[key] = parsed.value;
  }
  return { ok: true, value: values };
}

function phoneSlug(phone: string): string {
  return phone.replaceAll(/\D/g, "");
}

function grantPermissions(
  ctx: HandlerContext,
  user: User,
  body: CreateBody,
): void {
  const channels: readonly Channel[] = ["phone", "sms", "email"];
  if (
    channels.every((channel) => body[`allow_comm_via_${channel}`] === undefined)
  ) {
    return;
  }
  const now = istanbulDateTime(ctx.clock.now());
  const at = (channel: Channel): string => {
    const given = body[`allow_comm_via_${channel}_date`];
    return given === undefined ? now : istanbulDateTime(new Date(given));
  };
  ctx.store.communicationPermissions.insert({
    user_id: user.id,
    email: user.email,
    phone: user.phone,
    phone_slug: phoneSlug(user.phone),
    allow_comm_via_phone: body.allow_comm_via_phone ?? false,
    allow_comm_via_phone_date: at("phone"),
    allow_comm_via_sms: body.allow_comm_via_sms ?? false,
    allow_comm_via_sms_date: at("sms"),
    allow_comm_via_email: body.allow_comm_via_email ?? false,
    allow_comm_via_email_date: at("email"),
  });
  const labels = { phone: "Telefon", sms: "SMS", email: "E-posta" } as const;
  const events = {
    phone: [18, 21],
    sms: [19, 22],
    email: [20, 23],
  } as const;
  for (const channel of channels) {
    const allowed = body[`allow_comm_via_${channel}`];
    if (allowed === undefined) continue;
    recordEvent(
      ctx.store,
      user.id,
      allowed ? events[channel][0] : events[channel][1],
      at(channel),
      `${labels[channel]} ile iletişim izni ${allowed ? "verildi" : "geri alındı"}`,
    );
  }
}

function bodyFields(body: CreateBody): [UpdatableField, unknown][] {
  return Object.entries(body).flatMap(([name, value]) =>
    isUpdatableField(name) && value !== undefined ? [[name, value]] : [],
  );
}

export const createUser: Handler<"createUser"> = ({ body }, ctx) => {
  const { store, clock } = ctx;
  const fields = applyFields(bodyFields(body));
  if (!fields.ok) return failure(fields.error);
  const membership = decideMembershipNo(store, body, 0);
  if (!membership.ok) return failure(membership.error);
  const udvs = parseUdvs(store, body.user_defined_values ?? {});
  if (!udvs.ok) return failure(udvs.error);
  const tagIds = [...new Set(body.tags ?? [])];
  const missingTag = tagIds.find((id) => !store.tags.get(id));
  if (missingTag !== undefined) return notFound("Tag");
  const now = istanbulDateTime(clock.now());
  const user = store.users.insert(
    newUser({
      first_name: body.first_name,
      membership_no: membership.value,
      apply_date: now,
      join_date: now,
      user_defined_values: udvs.value,
      ...fields.value,
    }),
  );
  for (const tagId of tagIds) {
    store.userTags.insert({
      user_id: user.id,
      tag_id: tagId,
      create_date: now,
    });
  }
  store.contactProfiles.insert({
    user_id: user.id,
    create_date: now,
    last_update_date: now,
    has_password: false,
    last_login: null,
    profile_pic: null,
    language: "tr",
    agreement: null,
    blocked_mail: false,
    spam_mail: false,
    address_book: false,
    donation_reminder: null,
    notify_after_dues_withdrawal: false,
    default_dues_reminder_withdrawal: false,
  });
  grantPermissions(ctx, user, body);
  return { status: 200, body: { user_id: user.id } };
};

type UpdateData = UpdateBody["data"];

function isFieldUpdate(
  data: UpdateData,
): data is Schemas["UserSingleFieldUpdate"] {
  return !Array.isArray(data) && "field" in data;
}

type Change =
  | { readonly kind: "fields"; readonly patch: Partial<Omit<UserRecord, "id">> }
  | {
      readonly kind: "udv";
      readonly udv: Row<UserDefinedValueRecord>;
      readonly value: UdvValue;
    };

function planUpdate(
  store: OrgStore,
  user: User,
  body: UpdateBody,
):
  | { ok: true; change: Change; labels: string[] }
  | { ok: false; status: 400 | 404; error: string } {
  const { data } = body;
  switch (body.type) {
    case "single":
    case "multiple": {
      const items = Array.isArray(data) ? data : [data];
      if ((body.type === "single") === Array.isArray(data)) {
        return {
          ok: false,
          status: 400,
          error: `Invalid values: a ${body.type} update takes ${body.type === "single" ? "one {field, value} object" : "a list of {field, value} objects"}`,
        };
      }
      const entries: [UpdatableField, unknown][] = [];
      for (const item of items) {
        if (!isFieldUpdate(item) || item.field === undefined) {
          return {
            ok: false,
            status: 400,
            error: "Invalid values: each field update names a field",
          };
        }
        entries.push([item.field, item.value]);
      }
      const parsed = applyFields(entries);
      if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
      return {
        ok: true,
        change: { kind: "fields", patch: parsed.value },
        labels: entries.map(([field]) => field),
      };
    }
    case "udv": {
      if (Array.isArray(data) || !("udv_id" in data)) {
        return {
          ok: false,
          status: 400,
          error: "Invalid values: a udv update takes {udv_id, value}",
        };
      }
      const udv =
        data.udv_id === undefined
          ? undefined
          : store.userDefinedValues.get(data.udv_id);
      if (!udv) {
        return {
          ok: false,
          status: 404,
          error: "User defined value not found",
        };
      }
      const parsed = parseUdvValue(udv, data.value ?? null);
      if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
      return {
        ok: true,
        change: { kind: "udv", udv, value: parsed.value },
        labels: [udv.value],
      };
    }
    case "membership_no": {
      if (Array.isArray(data) || !("membership_no_decision" in data)) {
        return {
          ok: false,
          status: 400,
          error:
            "Invalid values: a membership_no update takes membership_no_decision",
        };
      }
      const decided = decideMembershipNo(store, data, user.membership_no);
      if (!decided.ok) return { ok: false, status: 400, error: decided.error };
      return {
        ok: true,
        change: { kind: "fields", patch: { membership_no: decided.value } },
        labels: ["membership_no"],
      };
    }
  }
}

function syncPermission(store: OrgStore, user: User): void {
  const permission = permissionOf(store, user.id);
  if (!permission) return;
  store.communicationPermissions.update(permission.id, {
    email: user.email,
    phone: user.phone,
    phone_slug: phoneSlug(user.phone),
  });
}

export const updateUser: Handler<"updateUser"> = (
  { path, body },
  { store, clock },
) => {
  const user = store.users.get(path.user_id);
  if (!user) return notFound("User");
  const plan = planUpdate(store, user, body);
  if (!plan.ok) return { status: plan.status, body: { error: plan.error } };
  const updated =
    plan.change.kind === "fields"
      ? store.users.update(user.id, plan.change.patch)
      : store.users.update(user.id, {
          user_defined_values: {
            ...user.user_defined_values,
            [plan.change.udv.value]: plan.change.value,
          },
        });
  if (updated) syncPermission(store, updated);
  const now = istanbulDateTime(clock.now());
  recordEvent(
    store,
    user.id,
    1,
    now,
    `Profil güncellendi: ${plan.labels.join(", ")}`,
  );
  const profile = store.contactProfiles.find((row) => row.user_id === user.id);
  if (profile)
    store.contactProfiles.update(profile.id, { last_update_date: now });
  return { status: 200, body: { result: "ok" } };
};

function blockers(store: OrgStore, userId: number): string[] {
  const owned = (row: { user_id: number }) => row.user_id === userId;
  return [
    store.donations.count(owned) > 0 ? "donations" : null,
    store.microDonations.count(owned) > 0 ? "micro donations" : null,
    store.subscriptions.count(owned) > 0 ? "membership dues" : null,
    store.monthlyDonationRequests.count(owned) > 0
      ? "monthly donation requests"
      : null,
    store.fundraisingCampaigns.count(owned) > 0
      ? "fundraising campaigns"
      : null,
    store.fundraisingTeams.count(owned) > 0 ? "fundraising teams" : null,
  ].filter((what) => what !== null);
}

function removeContact(store: OrgStore, userId: number): void {
  const remove = <R extends { id: number }>(
    collection: {
      list(predicate: (row: R) => boolean): R[];
      remove(id: number): unknown;
    },
    predicate: (row: R) => boolean,
  ) => {
    for (const row of collection.list(predicate)) collection.remove(row.id);
  };
  remove(store.userTags, (row) => row.user_id === userId);
  remove(store.timeline, (row) => row.user_id === userId);
  remove(store.contactProfiles, (row) => row.user_id === userId);
  remove(
    store.contactRelations,
    (row) => row.user_id === userId || row.related_user_id === userId,
  );
  remove(store.cardInfos, (row) => row.user_id === userId);
  for (const row of store.timeline.list(
    (entry) => entry.issuer_id === userId || entry.added_by_id === userId,
  )) {
    store.timeline.update(row.id, {
      issuer_id: row.issuer_id === userId ? null : row.issuer_id,
      added_by_id: row.added_by_id === userId ? null : row.added_by_id,
    });
  }
  for (const row of store.communicationPermissions.list(
    (entry) => entry.user_id === userId,
  )) {
    store.communicationPermissions.update(row.id, { user_id: null });
  }
  for (const row of store.ticketSales.list((sale) => sale.user_id === userId)) {
    store.ticketSales.update(row.id, { user_id: null });
  }
  for (const row of store.formAnswers.list(
    (answer) => answer.user_id === userId,
  )) {
    store.formAnswers.update(row.id, { user_id: null });
  }
  for (const row of store.ecardTransactions.list(
    (sale) => sale.user_id === userId,
  )) {
    store.ecardTransactions.update(row.id, { user_id: null });
  }
  for (const row of store.bankTransactions.list(
    (transfer) => transfer.matched_user_id === userId,
  )) {
    store.bankTransactions.update(row.id, { matched_user_id: null });
  }
  store.users.remove(userId);
}

export const deleteUser: Handler<"deleteUser"> = ({ path }, { store }) => {
  const user = store.users.get(path.user_id);
  if (!user) return notFound("User");
  if (user.admin) {
    return {
      status: 403,
      body: {
        error: `${errorBody(403).error}: user ${user.id} is an administrator`,
      },
    };
  }
  const kept = blockers(store, user.id);
  if (kept.length > 0) {
    return failure(
      `Invalid values: user ${user.id} has ${kept.join(", ")}, which need a contact, so it cannot be deleted`,
    );
  }
  removeContact(store, user.id);
  return { status: 200, body: { result: "ok" } };
};

function toUserDefinedValue(udv: Row<UserDefinedValueRecord>) {
  return {
    id: udv.key,
    udv_id: udv.id,
    type: udv.type,
    name: udv.name,
    value: udv.value,
    group: udv.group,
    key_type: udv.key_type,
    for: udv.for,
    options: udv.options,
    boolean_true_text: nonEmpty(udv.boolean_true_text),
    boolean_false_text: udv.boolean_false_text,
    changable_by_users: udv.changable_by_users,
    select_text: udv.select_text,
    display_for: udv.display_for,
  };
}

export const getUserDefinedValuesList: Handler<"getUserDefinedValuesList"> = (
  _input,
  { store },
) => ({
  status: 200,
  body: { udv_list: store.userDefinedValues.list().map(toUserDefinedValue) },
});

const LOGIN_TARGETS = {
  3: "/profil/aidat-odeme",
  4: "/profil/bagislarim",
  5: "/profil",
  10: "/profil/uyelik-karti",
  12: "/profil/aidat-kart-guncelleme",
} as const;

export const generateLoginLinkForUser: Handler<"generateLoginLinkForUser"> = (
  { path, query },
  { store, org, rng },
) => {
  const user = store.users.get(path.user_id);
  if (!user) return notFound("User");
  if (user.admin) {
    return {
      status: 403,
      body: {
        error: `${errorBody(403).error}: login links are for members, and user ${user.id} is an administrator`,
      },
    };
  }
  const target = LOGIN_TARGETS[query.redirection_type ?? 5];
  const link = new URL(`/giris/${rng.hex(40)}`, org.info.url);
  link.searchParams.set("next", target);
  return { status: 200, body: { link: link.toString() } };
};
