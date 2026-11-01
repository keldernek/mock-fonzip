import { notFound } from "../../api/errors";
import type { HandlerInput } from "../../api/handler";
import { istanbulDate } from "../../seed/dates";
import type { FundraisingCampaignRecord } from "../../store/records";
import type { OrgStore } from "../../store/store";
import { badRequest, failed, parsed, type Parsed } from "./failures";

export type CampaignPatch = Partial<Omit<FundraisingCampaignRecord, "id">>;

type UpdateBody = NonNullable<
  HandlerInput<"updateFundraisingCampaign">["body"]
>;
type CampaignField = NonNullable<UpdateBody["field"]>;

type FieldsOfType<V> = {
  [K in keyof CampaignPatch]-?: NonNullable<CampaignPatch[K]> extends V
    ? V extends NonNullable<CampaignPatch[K]>
      ? K
      : never
    : never;
}[keyof CampaignPatch];

const REFERENCES = {
  sub_donation_type_id: {
    label: "Donation category",
    exists: (store: OrgStore, id: number) =>
      store.donationCategories.get(id) !== undefined,
  },
  payment_settings_id: {
    label: "Payment settings",
    exists: (store: OrgStore, id: number) =>
      store.paymentSettings.get(id) !== undefined,
  },
  thanks_mail_id: {
    label: "Template",
    exists: (store: OrgStore, id: number) =>
      store.templates.get(id) !== undefined,
  },
  referral_thanks_mail_id: {
    label: "Template",
    exists: (store: OrgStore, id: number) =>
      store.templates.get(id) !== undefined,
  },
  thanks_sms_id: {
    label: "Template",
    exists: (store: OrgStore, id: number) =>
      store.templates.get(id) !== undefined,
  },
  certificate_id: {
    label: "E-card",
    exists: (store: OrgStore, id: number) => store.ecards.get(id) !== undefined,
  },
  referral_certificate_id: {
    label: "E-card",
    exists: (store: OrgStore, id: number) => store.ecards.get(id) !== undefined,
  },
  association_campaign_target_id: {
    label: "Fundraising event",
    exists: (store: OrgStore, id: number) =>
      store.fundraisingEvents.get(id) !== undefined,
  },
} as const satisfies Record<
  Exclude<FieldsOfType<number> & CampaignField, "target">,
  {
    readonly label: string;
    readonly exists: (store: OrgStore, id: number) => boolean;
  }
>;

type ReferenceField = keyof typeof REFERENCES;
export const REFERENCE_FIELDS = Object.keys(REFERENCES).filter(
  (key): key is ReferenceField => Object.hasOwn(REFERENCES, key),
);

export function checkReference(
  store: OrgStore,
  field: ReferenceField,
  id: number,
): Parsed<number> {
  const reference = REFERENCES[field];
  return reference.exists(store, id)
    ? parsed(id)
    : failed(notFound(reference.label));
}

export function checkBankAccounts(
  store: OrgStore,
  ids: readonly number[],
): Parsed<number[]> {
  const missing = ids.find((id) => store.bankAccounts.get(id) === undefined);
  return missing === undefined
    ? parsed([...new Set(ids)])
    : failed(notFound("Bank account"));
}

export function campaignDate(value: string): string | null {
  const at = Date.parse(value);
  if (Number.isNaN(at)) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : istanbulDate(new Date(at));
}

type FieldParser = (value: unknown, store: OrgStore) => Parsed<CampaignPatch>;

function text(field: FieldsOfType<string>, required = false): FieldParser {
  return (value) => {
    if (typeof value !== "string") {
      return failed(badRequest(`${field} must be a string`));
    }
    if (required && value.trim() === "") {
      return failed(badRequest(`${field} cannot be empty`));
    }
    const patch: CampaignPatch = {};
    patch[field] = value;
    return parsed(patch);
  };
}

function flag(field: FieldsOfType<boolean>): FieldParser {
  return (value) => {
    if (typeof value !== "boolean") {
      return failed(badRequest(`${field} must be a boolean`));
    }
    const patch: CampaignPatch = {};
    patch[field] = value;
    return parsed(patch);
  };
}

function reference(field: ReferenceField): FieldParser {
  return (value, store) => {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      return failed(badRequest(`${field} must be an integer id`));
    }
    const checked = checkReference(store, field, value);
    if (!checked.ok) return checked;
    const patch: CampaignPatch = {};
    patch[field] = checked.value;
    return parsed(patch);
  };
}

function bankAccountIds(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const ids: number[] = [];
  for (const item of value) {
    const id: unknown =
      typeof item === "object" && item !== null && "id" in item
        ? item.id
        : item;
    if (typeof id !== "number" || !Number.isInteger(id)) return null;
    ids.push(id);
  }
  return ids;
}

const PARSERS: Readonly<Record<CampaignField, FieldParser>> = {
  title: text("title", true),
  image: text("image"),
  personal_message: text("personal_message"),
  bank_account_list: (value, store) => {
    const ids = bankAccountIds(value);
    if (ids === null) {
      return failed(
        badRequest("bank_account_list must list bank account ids or objects"),
      );
    }
    const checked = checkBankAccounts(store, ids);
    return checked.ok ? parsed({ bank_account_ids: checked.value }) : checked;
  },
  has_target: flag("has_target"),
  hide_donor_list: flag("hide_donor_list"),
  hide_total_donation: flag("hide_total_donation"),
  has_special_date: flag("has_special_date"),
  phone_show: flag("phone_show"),
  phone_required: flag("phone_required"),
  birthday_show: flag("birthday_show"),
  birthday_required: flag("birthday_required"),
  address_show: flag("address_show"),
  address_required: flag("address_required"),
  tckno_show: flag("tckno_show"),
  tckno_required: flag("tckno_required"),
  message_show: flag("message_show"),
  target: (value) =>
    typeof value === "number" && value >= 0
      ? parsed({ target: value })
      : failed(badRequest("target must be a number that is not negative")),
  event_date: (value) => {
    const date = typeof value === "string" ? campaignDate(value) : null;
    return date === null
      ? failed(badRequest("event_date must be a date"))
      : parsed({ event_date: date });
  },
  sub_donation_type_id: reference("sub_donation_type_id"),
  payment_settings_id: reference("payment_settings_id"),
  thanks_mail_id: reference("thanks_mail_id"),
  referral_thanks_mail_id: reference("referral_thanks_mail_id"),
  thanks_sms_id: reference("thanks_sms_id"),
  certificate_id: reference("certificate_id"),
  referral_certificate_id: reference("referral_certificate_id"),
  association_campaign_target_id: reference("association_campaign_target_id"),
};

function isCampaignField(name: string): name is CampaignField {
  return Object.hasOwn(PARSERS, name);
}

export function parseCampaignUpdate(
  body: UpdateBody | undefined,
  store: OrgStore,
): Parsed<CampaignPatch> {
  const entries: [CampaignField, unknown][] = [];
  if (body?.multiple === true) {
    if (body.data === undefined) {
      return failed(badRequest("data is required when multiple is true"));
    }
    for (const [name, value] of Object.entries(body.data)) {
      if (isCampaignField(name)) entries.push([name, value]);
    }
    if (entries.length === 0) {
      return failed(badRequest("data names no field that can be updated"));
    }
  } else {
    if (body?.field === undefined || body.value === undefined) {
      return failed(badRequest("field and value are required"));
    }
    entries.push([body.field, body.value]);
  }
  let patch: CampaignPatch = {};
  for (const [field, value] of entries) {
    const result = PARSERS[field](value, store);
    if (!result.ok) return result;
    patch = { ...patch, ...result.value };
  }
  return parsed(patch);
}
