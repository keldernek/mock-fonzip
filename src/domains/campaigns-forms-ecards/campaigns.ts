import { notFound } from "../../api/errors";
import type { Handler, HandlerInput } from "../../api/handler";
import { inList, matchesQuery, paginate } from "../../api/listing";
import { istanbulDate, istanbulDateTime } from "../../seed/dates";
import { slugify } from "../../seed/identity";
import type { Row } from "../../store/collection";
import { present, userName } from "../../store/joins";
import type {
  BankAccountRecord,
  FundraisingCampaignRecord,
} from "../../store/records";
import { currencyById, TRY_CURRENCY_ID } from "../../store/reference";
import type { OrgStore } from "../../store/store";
import { WEBHOOK_OPERATIONS } from "../../webhooks/emitter";
import {
  type CampaignPatch,
  checkBankAccounts,
  checkReference,
  campaignDate,
  parseCampaignUpdate,
  REFERENCE_FIELDS,
} from "./campaign-fields";
import { badRequest, failed, parsed, type Parsed } from "./failures";
import { DELETED_CAMPAIGN, funding, knownCurrency } from "./funding";
import {
  compareBy,
  dateValue,
  orderKey,
  type OrderField,
  type SortValue,
} from "./ordering";

type Campaign = Row<FundraisingCampaignRecord>;
type ListQuery = HandlerInput<"getFundraisingCampaignList">["query"];
type CampaignOrder = OrderField<NonNullable<ListQuery["order_by"]>>;
type CreateBody = NonNullable<
  HandlerInput<"createFundraisingCampaign">["body"]
>;

const STATUS = {
  waiting: 0,
  active: 1,
  rejected: 2,
  finalized: 3,
  deleted: DELETED_CAMPAIGN,
  waitingExtra: 5,
  archived: 7,
} as const;

const FEATURED_LIMIT = 6;

function liveCampaign(
  store: OrgStore,
  campaignId: number,
): Campaign | undefined {
  const campaign = store.fundraisingCampaigns.get(campaignId);
  return campaign?.status === STATUS.deleted ? undefined : campaign;
}

function donationTotal(store: OrgStore, campaign: Campaign): number {
  return funding(store, [campaign], campaign.target_currency_id).sum;
}

function toBankAccount(store: OrgStore, account: Row<BankAccountRecord>) {
  return {
    id: account.id,
    name: account.name,
    bank_name: account.bank_name,
    iban: account.iban,
    details: account.details,
    currency_id: account.currency_id,
    currency__display: currencyById(account.currency_id).display,
    business_account: account.business_account,
    create_date: account.create_date,
    created_by_id: present(account.created_by_id),
    created_by__name: userName(store, account.created_by_id),
    update_date: present(account.update_date),
    updated_by_id: present(account.updated_by_id),
    updated_by__name: userName(store, account.updated_by_id),
  };
}

function toListItem(store: OrgStore, campaign: Campaign, total: number) {
  const owner = store.users.get(campaign.user_id);
  const teamCampaign =
    campaign.team_campaign_id === null
      ? undefined
      : store.teamCampaigns.get(campaign.team_campaign_id);
  return {
    id: campaign.id,
    user_id: campaign.user_id,
    user__first_name: owner?.first_name,
    user__last_name: owner?.last_name,
    create_date: campaign.create_date,
    activation_date: present(campaign.activation_date),
    finish_date: present(campaign.finish_date),
    title: campaign.title,
    url: campaign.url,
    status: campaign.status,
    donation_total: total,
    team_id: present(campaign.team_id),
    team_campaign__title: teamCampaign?.title,
    target_currency_id: campaign.target_currency_id,
    featured: campaign.featured,
  };
}

function createdOn(
  createDate: string,
  filter: string,
  condition: ListQuery["create_date_cnd"],
): boolean {
  const created = Date.parse(createDate);
  const at = Date.parse(filter);
  if (condition === "<") return created < at;
  if (condition === ">") return created > at;
  return istanbulDate(new Date(created)) === istanbulDate(new Date(at));
}

function listed(
  store: OrgStore,
  campaign: Campaign,
  query: ListQuery,
): boolean {
  return (
    (query.status === undefined
      ? campaign.status !== STATUS.deleted
      : inList(campaign.status, query.status)) &&
    (query.category_id === undefined ||
      campaign.sub_donation_type_id === query.category_id) &&
    (query.team_campaign_id === undefined ||
      campaign.team_campaign_id === query.team_campaign_id) &&
    (query.payment_settings_id === undefined ||
      campaign.payment_settings_id === query.payment_settings_id) &&
    (query.association_campaign_target_id === undefined ||
      campaign.association_campaign_target_id ===
        query.association_campaign_target_id) &&
    (query.create_date === undefined ||
      createdOn(
        campaign.create_date,
        query.create_date,
        query.create_date_cnd,
      )) &&
    matchesQuery(query.query, [
      campaign.title,
      userName(store, campaign.user_id),
    ])
  );
}

interface CampaignView {
  readonly id: number;
  readonly campaign: Campaign;
  readonly total: number;
}

function ordering(store: OrgStore) {
  const values: Readonly<
    Record<CampaignOrder, (view: CampaignView) => SortValue>
  > = {
    user__name: (view) => userName(store, view.campaign.user_id),
    title: (view) => view.campaign.title,
    create_date: (view) => dateValue(view.campaign.create_date),
    activation_date: (view) => dateValue(view.campaign.activation_date),
    donation_total: (view) => view.total,
  };
  return values;
}

export const getFundraisingCampaignList: Handler<
  "getFundraisingCampaignList"
> = ({ query }, { store }) => {
  const views = store.fundraisingCampaigns
    .list((campaign) => listed(store, campaign, query))
    .map((campaign): CampaignView => ({
      id: campaign.id,
      campaign,
      total: donationTotal(store, campaign),
    }))
    .sort(
      compareBy(
        query.order_by === undefined
          ? []
          : orderKey(query.order_by, ordering(store)),
      ),
    );
  return {
    status: 200,
    body: {
      campaign_list: paginate(views, query).map((view) =>
        toListItem(store, view.campaign, view.total),
      ),
      total: views.length,
    },
  };
};

function toDetail(store: OrgStore, campaign: Campaign) {
  const owner = store.users.get(campaign.user_id);
  return {
    id: campaign.id,
    user_id: campaign.user_id,
    user__first_name: owner?.first_name,
    user__last_name: owner?.last_name,
    user__profile_pic: owner ? present(owner.profile_pic) : undefined,
    create_date: campaign.create_date,
    activation_date: present(campaign.activation_date),
    finish_date: present(campaign.finish_date),
    title: campaign.title,
    url: campaign.url,
    image: campaign.image,
    personal_message: campaign.personal_message,
    user_note: campaign.user_note,
    has_target: campaign.has_target,
    hide_total_donation: campaign.hide_total_donation,
    hide_donor_list: campaign.hide_donor_list,
    target: campaign.target,
    status: campaign.status,
    donation_total: donationTotal(store, campaign),
    featured: campaign.featured,
    phone_show: campaign.phone_show,
    phone_required: campaign.phone_required,
    birthday_show: campaign.birthday_show,
    birthday_required: campaign.birthday_required,
    address_show: campaign.address_show,
    address_required: campaign.address_required,
    tckno_show: campaign.tckno_show,
    tckno_required: campaign.tckno_required,
    message_show: campaign.message_show,
    sub_donation_type_id: present(campaign.sub_donation_type_id),
    thanks_mail_id: present(campaign.thanks_mail_id),
    payment_settings_id: campaign.payment_settings_id,
    certificate_id: present(campaign.certificate_id),
    thanks_sms_id: present(campaign.thanks_sms_id),
    referral_certificate_id: present(campaign.referral_certificate_id),
    referral_thanks_mail_id: present(campaign.referral_thanks_mail_id),
    has_special_date: campaign.has_special_date,
    event_date: present(campaign.event_date),
    bank_account_list: campaign.bank_account_ids.flatMap((id) => {
      const account = store.bankAccounts.get(id);
      return account ? [toBankAccount(store, account)] : [];
    }),
    update_title: present(campaign.update_title),
    update_image: present(campaign.update_image),
    update_personal_message: present(campaign.update_personal_message),
    association_campaign_target_id: present(
      campaign.association_campaign_target_id,
    ),
  };
}

export const getFundraisingCampaignDetails: Handler<
  "getFundraisingCampaignDetails"
> = ({ path }, { store }) => {
  const campaign = liveCampaign(store, path.campaign_id);
  if (!campaign) return notFound("Fundraising campaign");
  return { status: 200, body: { campaign: toDetail(store, campaign) } };
};

function referencesOf(
  store: OrgStore,
  body: CreateBody,
): Parsed<CampaignPatch> {
  const patch: CampaignPatch = {};
  for (const field of REFERENCE_FIELDS) {
    const id = body[field];
    if (id === undefined) continue;
    const checked = checkReference(store, field, id);
    if (!checked.ok) return checked;
    patch[field] = checked.value;
  }
  return parsed(patch);
}

function lifecycleFor(
  status: FundraisingCampaignRecord["status"],
  now: string,
): Pick<FundraisingCampaignRecord, "activation_date" | "finish_date"> {
  switch (status) {
    case STATUS.waiting:
    case STATUS.rejected:
    case STATUS.waitingExtra:
    case STATUS.deleted:
      return { activation_date: null, finish_date: null };
    case STATUS.active:
      return { activation_date: now, finish_date: null };
    case STATUS.finalized:
    case STATUS.archived:
      return { activation_date: now, finish_date: now };
  }
}

function campaignUrl(store: OrgStore, origin: string, title: string): string {
  const base = `${origin}/kampanya/${slugify(title)}`;
  const taken = (url: string) =>
    store.fundraisingCampaigns.find((campaign) => campaign.url === url) !==
    undefined;
  if (!taken(base)) return base;
  let suffix = 2;
  while (taken(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function newCampaign(
  store: OrgStore,
  body: CreateBody,
  origin: string,
  now: string,
): Parsed<Omit<FundraisingCampaignRecord, "id">> {
  if (body.user_id === undefined) {
    return failed(badRequest("user_id is required"));
  }
  const title = body.title?.trim() ?? "";
  if (title === "") return failed(badRequest("title is required"));
  if (body.status === STATUS.deleted) {
    return failed(badRequest("a campaign cannot be created as deleted"));
  }
  const currencyId = body.target_currency_id ?? TRY_CURRENCY_ID;
  const currencies = body.currencies ?? [currencyId];
  if (![currencyId, ...currencies].every(knownCurrency)) {
    return failed(notFound("Currency"));
  }
  if (!store.users.get(body.user_id)) return failed(notFound("User"));
  const references = referencesOf(store, body);
  if (!references.ok) return references;
  const accounts = checkBankAccounts(
    store,
    (body.bank_account_list ?? []).flatMap((account) =>
      account.id === undefined ? [] : [account.id],
    ),
  );
  if (!accounts.ok) return accounts;
  const paymentSettingsId =
    references.value.payment_settings_id ?? store.paymentSettings.list()[0]?.id;
  if (paymentSettingsId === undefined) {
    return failed(badRequest("payment_settings_id is required"));
  }
  let eventDate: string | null = null;
  if (body.event_date !== undefined) {
    eventDate = campaignDate(body.event_date);
    if (eventDate === null)
      return failed(badRequest("event_date must be a date"));
  }
  const status = body.status ?? STATUS.active;
  return parsed({
    user_id: body.user_id,
    create_date: now,
    ...lifecycleFor(status, now),
    title,
    update_title: null,
    update_image: null,
    update_personal_message: null,
    url: body.url ?? campaignUrl(store, origin, title),
    status,
    target_currency_id: currencyId,
    featured: false,
    image: body.image ?? "",
    personal_message: body.personal_message ?? "",
    user_note: body.user_note ?? "",
    has_target: body.has_target ?? false,
    hide_total_donation: body.hide_total_donation ?? false,
    hide_donor_list: body.hide_donor_list ?? false,
    target: body.target ?? 0,
    has_special_date: body.has_special_date ?? false,
    event_date: eventDate,
    phone_show: body.phone_show ?? false,
    phone_required: body.phone_required ?? false,
    birthday_show: body.birthday_show ?? false,
    birthday_required: body.birthday_required ?? false,
    address_show: body.address_show ?? false,
    address_required: body.address_required ?? false,
    tckno_show: body.tckno_show ?? false,
    tckno_required: body.tckno_required ?? false,
    message_show: body.message_show ?? true,
    sub_donation_type_id: references.value.sub_donation_type_id ?? null,
    thanks_mail_id: references.value.thanks_mail_id ?? null,
    payment_settings_id: paymentSettingsId,
    currencies: [...new Set(currencies)],
    certificate_id: references.value.certificate_id ?? null,
    thanks_sms_id: references.value.thanks_sms_id ?? null,
    referral_certificate_id: references.value.referral_certificate_id ?? null,
    referral_thanks_mail_id: references.value.referral_thanks_mail_id ?? null,
    association_campaign_target_id:
      references.value.association_campaign_target_id ?? null,
    bank_account_ids: accounts.value,
    team_id: null,
    team_campaign_id: null,
  });
}

export const createFundraisingCampaign: Handler<"createFundraisingCampaign"> = (
  { body },
  { store, clock, org, webhooks },
) => {
  const record = newCampaign(
    store,
    body ?? {},
    org.info.url,
    istanbulDateTime(clock.now()),
  );
  if (!record.ok) return record.failure;
  const campaign = store.fundraisingCampaigns.insert(record.value);
  webhooks.emit(
    { operation: WEBHOOK_OPERATIONS.fundraisingCampaign, status: 0 },
    campaign.id,
  );
  return { status: 200, body: { result: "ok", campaign_id: campaign.id } };
};

export const updateFundraisingCampaign: Handler<"updateFundraisingCampaign"> = (
  { path, body },
  { store },
) => {
  if (!liveCampaign(store, path.campaign_id)) {
    return notFound("Fundraising campaign");
  }
  const patch = parseCampaignUpdate(body, store);
  if (!patch.ok) return patch.failure;
  store.fundraisingCampaigns.update(path.campaign_id, patch.value);
  return { status: 200, body: { result: "ok" } };
};

function statusChange(
  store: OrgStore,
  campaign: Campaign,
  body: HandlerInput<"updateFundraisingCampaignStatus">["body"],
  now: string,
): Parsed<CampaignPatch> {
  switch (body?.action) {
    case undefined:
      return failed(badRequest("action is required"));
    case "reactivate":
      return campaign.status === STATUS.finalized
        ? parsed({ status: STATUS.active, finish_date: null })
        : failed(badRequest("only a finalized campaign can be reactivated"));
    case "finalize":
      return campaign.status === STATUS.active
        ? parsed({
            status: STATUS.finalized,
            finish_date: now,
            featured: false,
          })
        : failed(badRequest("only an active campaign can be finalized"));
    case "featured": {
      if (body.featured === undefined) {
        return failed(
          badRequest("featured is required when action is featured"),
        );
      }
      if (!body.featured) return parsed({ featured: false });
      if (campaign.status !== STATUS.active) {
        return failed(badRequest("only an active campaign can be featured"));
      }
      const featured = store.fundraisingCampaigns.count(
        (row) => row.featured && row.id !== campaign.id,
      );
      return featured >= FEATURED_LIMIT
        ? failed(
            badRequest(
              `at most ${FEATURED_LIMIT} campaigns can be featured at once`,
            ),
          )
        : parsed({ featured: true });
    }
  }
}

export const updateFundraisingCampaignStatus: Handler<
  "updateFundraisingCampaignStatus"
> = ({ path, body }, { store, clock }) => {
  const campaign = liveCampaign(store, path.campaign_id);
  if (!campaign) return notFound("Fundraising campaign");
  const patch = statusChange(
    store,
    campaign,
    body,
    istanbulDateTime(clock.now()),
  );
  if (!patch.ok) return patch.failure;
  store.fundraisingCampaigns.update(campaign.id, patch.value);
  return { status: 200, body: { result: "ok" } };
};

export const deleteFundraisingCampaign: Handler<"deleteFundraisingCampaign"> = (
  { path },
  { store },
) => {
  if (!liveCampaign(store, path.campaign_id)) {
    return notFound("Fundraising campaign");
  }
  store.fundraisingCampaigns.update(path.campaign_id, {
    status: STATUS.deleted,
    featured: false,
  });
  return { status: 200, body: { result: "ok" } };
};
