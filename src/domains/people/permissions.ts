import type { Handler } from "../../api/handler";
import { paginate } from "../../api/listing";
import { istanbulDateTime } from "../../seed/dates";
import type { Row } from "../../store/collection";
import { present } from "../../store/joins";
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

function toPermission(row: Permission) {
  return {
    id: present(row.user_id),
    email: row.email === "" ? undefined : row.email,
    phone: row.phone === "" ? undefined : row.phone,
    phone_slug: row.phone_slug === "" ? undefined : row.phone_slug,
    allow_comm_via_phone: row.allow_comm_via_phone,
    allow_comm_via_phone_date: row.allow_comm_via_phone_date,
    allow_comm_via_sms: row.allow_comm_via_sms,
    allow_comm_via_sms_date: row.allow_comm_via_sms_date,
    allow_comm_via_email: row.allow_comm_via_email,
    allow_comm_via_email_date: row.allow_comm_via_email_date,
  };
}

type Lookup =
  | { readonly ok: true; readonly rows: Permission[] }
  | { readonly ok: false; readonly status: 400 | 404; readonly error: string };

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
    const rows = store.communicationPermissions.list(
      (row) => row.email.toLowerCase() === wanted,
    );
    return rows.length > 0
      ? { ok: true, rows }
      : { ok: false, status: 404, error: "Communication permission not found" };
  }
  if (!E164.test(value)) {
    return {
      ok: false,
      status: 400,
      error: `Invalid values: ${value} is not a phone number in E.164 format`,
    };
  }
  const digits = value.slice(1);
  const rows = store.communicationPermissions.list(
    (row) => row.phone_slug === digits,
  );
  return rows.length > 0
    ? { ok: true, rows }
    : { ok: false, status: 404, error: "Communication permission not found" };
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
  const [first] = found.rows;
  return {
    status: 200,
    body: {
      total: found.rows.length,
      ...(first ? { permission_list: toPermission(first) } : {}),
    },
  };
};

export const listChangedCommunicationPermissions: Handler<
  "listChangedCommunicationPermissions"
> = ({ path, query }, { store, clock }) => {
  const channel = CHANNELS[path.permission_type];
  const now = clock.now().getTime();
  const since = now - (query.days ?? 3) * DAY_MS;
  const changed = store.communicationPermissions
    .list((row) => {
      const at = Date.parse(row[channel.date]);
      return at >= since && at <= now;
    })
    .sort(
      (a, b) =>
        Date.parse(b[channel.date]) - Date.parse(a[channel.date]) ||
        a.id - b.id,
    );
  const [first] = paginate(changed, query);
  return {
    status: 200,
    body: {
      total: changed.length,
      ...(first ? { permission_list: toPermission(first) } : {}),
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
  const channel = CHANNELS[change.type];
  const at = istanbulDateTime(change.at);
  let updated = 0;
  for (const row of found.rows) {
    if (Date.parse(row[channel.date]) > change.at.getTime()) continue;
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
