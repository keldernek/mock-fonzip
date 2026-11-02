import type { Handler } from "../../api/handler";
import { paginate } from "../../api/listing";
import { apiDateTime } from "../../seed/dates";
import type { Row } from "../../store/collection";
import { nonEmpty, present } from "../../store/joins";
import type { CommunicationPermissionRecord } from "../../store/records";
import type { OrgStore } from "../../store/store";
import { recordEvent } from "./timeline";

export type PermissionType = "email" | "sms" | "phone";
type Permission = Row<CommunicationPermissionRecord>;

const CHANNELS = {
  email: {
    allowed: "allow_comm_via_email",
    date: "allow_comm_via_email_date",
    granted: 20,
    revoked: 23,
    label: "E-posta",
  },
  sms: {
    allowed: "allow_comm_via_sms",
    date: "allow_comm_via_sms_date",
    granted: 19,
    revoked: 22,
    label: "SMS",
  },
  phone: {
    allowed: "allow_comm_via_phone",
    date: "allow_comm_via_phone_date",
    granted: 18,
    revoked: 21,
    label: "Telefon",
  },
} as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164 = /^\+[1-9]\d{7,14}$/;
const DAY_MS = 86_400_000;

// A lookup answers with the keys of the channel it asked about: the contact
// point (`email` or `phone`), the permission and its date. Production showed
// this for email; sms and phone are inferred.
function toPermission(row: Permission, type: PermissionType) {
  const id = present(row.user_id);
  switch (type) {
    case "email":
      return {
        id,
        email: nonEmpty(row.email),
        allow_comm_via_email: row.allow_comm_via_email,
        allow_comm_via_email_date: row.allow_comm_via_email_date,
      };
    case "sms":
      return {
        id,
        phone: nonEmpty(row.phone),
        allow_comm_via_sms: row.allow_comm_via_sms,
        allow_comm_via_sms_date: row.allow_comm_via_sms_date,
      };
    case "phone":
      return {
        id,
        phone: nonEmpty(row.phone),
        allow_comm_via_phone: row.allow_comm_via_phone,
        allow_comm_via_phone_date: row.allow_comm_via_phone_date,
      };
  }
}

type Lookup =
  | { readonly ok: true; readonly rows: Permission[] }
  | { readonly ok: false; readonly status: 400 | 404; readonly error: string };

// A value that names no record finds no rows. Reading answers with an empty
// list, and changing answers 404.
function findPermissions(
  store: OrgStore,
  type: PermissionType,
  value: string,
): Lookup {
  if (type === "email") {
    if (!EMAIL.test(value)) {
      return {
        ok: false,
        status: 400,
        error: `Invalid values: ${value} is not an email address`,
      };
    }
    const wanted = value.toLowerCase();
    return {
      ok: true,
      rows: store.communicationPermissions.list(
        (row) => row.email.toLowerCase() === wanted,
      ),
    };
  }
  if (!E164.test(value)) {
    return {
      ok: false,
      status: 400,
      error: `Invalid values: ${value} is not a phone number in E.164 format`,
    };
  }
  const digits = value.slice(1);
  return {
    ok: true,
    rows: store.communicationPermissions.list(
      (row) => row.phone_slug === digits,
    ),
  };
}

export const getCommunicationPermissions: Handler<
  "getCommunicationPermissions"
> = ({ path }, { store }) => {
  const found = findPermissions(
    store,
    path.permission_type,
    path.permission_value,
  );
  if (!found.ok) return { status: found.status, body: { error: found.error } };
  return {
    status: 200,
    body: {
      permission_list: found.rows.map((row) =>
        toPermission(row, path.permission_type),
      ),
    },
  };
};

export const listChangedCommunicationPermissions: Handler<
  "listChangedCommunicationPermissions"
> = ({ path, query }, { store, clock }) => {
  const channel = CHANNELS[path.permission_type];
  const now = clock.now().getTime();
  const since = now - (query.days ?? 3) * DAY_MS;
  const changeOf = (row: Permission): number | null => {
    const date = row[channel.date];
    return date === null ? null : Date.parse(date);
  };
  const changed = store.communicationPermissions
    .list((row) => {
      const at = changeOf(row);
      return at !== null && at >= since && at <= now;
    })
    .sort((a, b) => (changeOf(b) ?? 0) - (changeOf(a) ?? 0) || a.id - b.id);
  return {
    status: 200,
    body: {
      total: changed.length,
      permission_list: paginate(changed, query).map((row) =>
        toPermission(row, path.permission_type),
      ),
    },
  };
};

interface PermissionChange {
  readonly type: PermissionType;
  readonly value: string;
  readonly permission: boolean;
  readonly at: Date;
  readonly details: string | undefined;
}

export function changePermissions(
  store: OrgStore,
  change: PermissionChange,
): { ok: true; updated: number } | (Lookup & { ok: false }) {
  const found = findPermissions(store, change.type, change.value);
  if (!found.ok) return found;
  if (found.rows.length === 0) {
    return {
      ok: false,
      status: 404,
      error: "Communication permission not found",
    };
  }
  const channel = CHANNELS[change.type];
  const at = apiDateTime(change.at);
  let updated = 0;
  for (const row of found.rows) {
    const current = row[channel.date];
    if (current !== null && Date.parse(current) > change.at.getTime()) continue;
    const patch: Partial<Omit<CommunicationPermissionRecord, "id">> = {};
    patch[channel.allowed] = change.permission;
    patch[channel.date] = at;
    store.communicationPermissions.update(row.id, patch);
    updated += 1;
    if (row.user_id === null) continue;
    const verb = change.permission ? "verildi" : "geri alındı";
    recordEvent(
      store,
      row.user_id,
      change.permission ? channel.granted : channel.revoked,
      at,
      `${channel.label} ile iletişim izni ${verb}${change.details ? ` (${change.details})` : ""}`,
    );
  }
  return { ok: true, updated };
}

export const updateCommunicationPermissions: Handler<
  "updateCommunicationPermissions"
> = ({ path, body }, { store, clock }) => {
  const at = new Date(Date.parse(body.update_date));
  if (at.getTime() > clock.now().getTime()) {
    return {
      status: 400,
      body: { error: "Invalid values: update_date is in the future" },
    };
  }
  const result = changePermissions(store, {
    type: path.permission_type,
    value: path.permission_value,
    permission: body.permission,
    at,
    details: body.details,
  });
  if (!result.ok) {
    return { status: result.status, body: { error: result.error } };
  }
  return { status: 200, body: { update_count: result.updated } };
};
