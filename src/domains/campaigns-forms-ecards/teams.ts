import { notFound } from "../../api/errors";
import type { Handler, HandlerInput } from "../../api/handler";
import { matchesQuery, paginate } from "../../api/listing";
import { istanbulDateTime } from "../../seed/dates";
import { slugify } from "../../seed/identity";
import type { Row } from "../../store/collection";
import { userName } from "../../store/joins";
import type {
  FundraisingTeamRecord,
  TeamCampaignRecord,
} from "../../store/records";
import { currencyById, TRY_CURRENCY_ID } from "../../store/reference";
import type { OrgStore } from "../../store/store";
import { badRequest, failed, parsed, type Parsed } from "./failures";
import { funding, knownCurrency, liveCampaigns } from "./funding";
import {
  compareBy,
  dateValue,
  orderKey,
  type OrderField,
  type SortValue,
} from "./ordering";

type Team = Row<FundraisingTeamRecord>;
type TeamCampaign = Row<TeamCampaignRecord>;
type ListQuery = HandlerInput<"getFundraisingTeams">["query"];
type TeamOrder = OrderField<NonNullable<ListQuery["order_by"]>>;
type CampaignBody = NonNullable<
  HandlerInput<"createFundraisingTeamCampaign">["body"]
>;

const DELETED_TEAM = 4;
const APPROVED_TEAM = 1;

function liveTeam(store: OrgStore, teamId: number): Team | undefined {
  const team = store.fundraisingTeams.get(teamId);
  return team?.status === DELETED_TEAM ? undefined : team;
}

function teamCampaignOf(
  store: OrgStore,
  team: Team,
  campaignId: number,
): TeamCampaign | undefined {
  const campaign = store.teamCampaigns.get(campaignId);
  return campaign?.team_id === team.id ? campaign : undefined;
}

function raised(store: OrgStore, team: Team) {
  return funding(
    store,
    liveCampaigns(store, (campaign) => campaign.team_id === team.id),
    team.currency_id,
  );
}

function toListItem(store: OrgStore, team: Team) {
  const currency = currencyById(team.currency_id);
  const totals = raised(store, team);
  return {
    id: team.id,
    user_id: team.user_id,
    user__name: userName(store, team.user_id),
    title: team.title,
    image: team.image,
    slug: team.slug,
    currency_id: team.currency_id,
    currency__value: currency.value,
    currency__display: currency.display,
    create_date: team.create_date,
    status: team.status,
    donation_sum: totals.sum,
    donation_count: totals.count,
  };
}

function ordering(
  store: OrgStore,
): Readonly<Record<TeamOrder, (team: Team) => SortValue>> {
  return {
    title: (team) => team.title,
    create_date: (team) => dateValue(team.create_date),
    user__name: (team) => userName(store, team.user_id),
    id: (team) => team.id,
  };
}

export const getFundraisingTeams: Handler<"getFundraisingTeams"> = (
  { query },
  { store },
) => {
  const teams = store.fundraisingTeams
    .list(
      (team) =>
        (query.status === undefined
          ? team.status !== DELETED_TEAM
          : team.status === query.status) &&
        matchesQuery(query.query, [
          team.title,
          team.slug,
          userName(store, team.user_id),
        ]),
    )
    .sort(compareBy(orderKey(query.order_by ?? "title", ordering(store))));
  return {
    status: 200,
    body: {
      team_list: paginate(teams, query).map((team) => toListItem(store, team)),
      total: teams.length,
    },
  };
};

function toTeamCampaign(campaign: TeamCampaign) {
  return {
    id: campaign.id,
    title: campaign.title,
    has_target: campaign.has_target,
    target: campaign.target,
    target_currency_id: campaign.target_currency_id,
    default: campaign.default,
  };
}

export const getFundraisingTeamDetail: Handler<"getFundraisingTeamDetail"> = (
  { path },
  { store },
) => {
  const team = liveTeam(store, path.team_id);
  if (!team) return notFound("Fundraising team");
  const currency = currencyById(team.currency_id);
  const totals = raised(store, team);
  return {
    status: 200,
    body: {
      team: {
        id: team.id,
        user_id: team.user_id,
        user__name: userName(store, team.user_id),
        title: team.title,
        image: team.image,
        details: team.details,
        slug: team.slug,
        currency_id: String(team.currency_id),
        currency__value: String(currency.value),
        currency__display: currency.display,
        status: team.status,
        update_title: team.update_title ?? undefined,
        update_details: team.update_details ?? undefined,
        update_image: team.update_image ?? undefined,
        donation_sum: totals.sum,
        donation_count: totals.count,
        campaign_list: store.teamCampaigns
          .list((campaign) => campaign.team_id === team.id)
          .map(toTeamCampaign),
      },
    },
  };
};

function parseTeamCampaign(
  body: CampaignBody,
  teamCurrencyId: number,
  current: TeamCampaign | undefined,
): Parsed<Omit<TeamCampaignRecord, "id" | "team_id">> {
  const title = body.title.trim();
  if (title === "") return failed(badRequest("title is required"));
  if (body.has_target === true) {
    if (body.target === undefined) {
      return failed(badRequest("target is required when has_target is true"));
    }
    if (body.target_currency_id === undefined) {
      return failed(
        badRequest("target_currency_id is required when has_target is true"),
      );
    }
  }
  const hasTarget = body.has_target ?? current?.has_target ?? false;
  const currencyId = hasTarget
    ? (body.target_currency_id ?? current?.target_currency_id ?? teamCurrencyId)
    : teamCurrencyId;
  if (!knownCurrency(currencyId)) {
    return failed(badRequest("unknown target_currency_id"));
  }
  return parsed({
    title,
    has_target: hasTarget,
    target: hasTarget ? (body.target ?? current?.target ?? 0) : 0,
    target_currency_id: currencyId,
    default: body.default ?? current?.default ?? false,
  });
}

function makeDefault(store: OrgStore, team: Team, campaignId: number): void {
  for (const campaign of store.teamCampaigns.list(
    (row) => row.team_id === team.id,
  )) {
    store.teamCampaigns.update(campaign.id, {
      default: campaign.id === campaignId,
    });
  }
}

function uniqueSlug(store: OrgStore, title: string): string {
  const base = slugify(title);
  const taken = (slug: string) =>
    store.fundraisingTeams.find((team) => team.slug === slug) !== undefined;
  if (!taken(base)) return base;
  let suffix = 2;
  while (taken(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export const createFundraisingTeam: Handler<"createFundraisingTeam"> = (
  { body },
  { store, clock },
) => {
  const title = body.title.trim();
  if (title === "") return badRequest("title is required");
  const currencyId = body.currency_id ?? TRY_CURRENCY_ID;
  if (!knownCurrency(currencyId)) return badRequest("unknown currency_id");
  if (!store.users.get(body.user_id)) return notFound("User");
  const campaign = parseTeamCampaign(
    { ...body.campaign, default: true },
    currencyId,
    undefined,
  );
  if (!campaign.ok) return campaign.failure;
  const team = store.fundraisingTeams.insert({
    user_id: body.user_id,
    title,
    image: body.image ?? "",
    details: body.details,
    slug: uniqueSlug(store, title),
    currency_id: currencyId,
    create_date: istanbulDateTime(clock.now()),
    status: APPROVED_TEAM,
    update_title: null,
    update_details: null,
    update_image: null,
  });
  store.teamCampaigns.insert({ ...campaign.value, team_id: team.id });
  return { status: 200, body: { team_id: team.id } };
};

export const updateFundraisingTeam: Handler<"updateFundraisingTeam"> = (
  { path, body },
  { store },
) => {
  const team = liveTeam(store, path.team_id);
  if (!team) return notFound("Fundraising team");
  const title = body.title.trim();
  if (title === "") return badRequest("title is required");
  if (!knownCurrency(body.currency_id)) {
    return badRequest("unknown currency_id");
  }
  if (!store.users.get(body.user_id)) return notFound("User");
  const listed = body.campaign_list.flatMap((item) =>
    item.id === undefined ? [] : [{ id: item.id, default: item.default }],
  );
  if (listed.some((item) => !teamCampaignOf(store, team, item.id))) {
    return notFound("Fundraising team campaign");
  }
  const defaults = listed.filter((item) => item.default === true);
  const [newDefault, ...extra] = defaults;
  if (extra.length > 0) {
    return badRequest("only one team campaign can be the default");
  }
  store.fundraisingTeams.update(team.id, {
    user_id: body.user_id,
    title,
    details: body.details,
    currency_id: body.currency_id,
    image: body.image ?? team.image,
    status: body.status ?? team.status,
  });
  if (newDefault) {
    makeDefault(store, team, newDefault.id);
  } else {
    for (const item of listed) {
      if (item.default === false) {
        store.teamCampaigns.update(item.id, { default: false });
      }
    }
  }
  return { status: 200, body: {} };
};

export const deleteFundraisingTeam: Handler<"deleteFundraisingTeam"> = (
  { path },
  { store },
) => {
  if (!liveTeam(store, path.team_id)) return notFound("Fundraising team");
  store.fundraisingTeams.update(path.team_id, { status: DELETED_TEAM });
  return { status: 200, body: {} };
};

export const getFundraisingTeamsCampaigns: Handler<
  "getFundraisingTeamsCampaigns"
> = ({ path }, { store }) => {
  const team = liveTeam(store, path.team_id);
  if (!team) return notFound("Fundraising team");
  return {
    status: 200,
    body: {
      team_campaign_list: store.teamCampaigns
        .list((campaign) => campaign.team_id === team.id)
        .map((campaign) => ({
          id: campaign.id,
          title: campaign.title,
          default: campaign.default,
        })),
    },
  };
};

function campaignResult(campaign: TeamCampaign) {
  return {
    result: "ok" as const,
    campaign: {
      ...toTeamCampaign(campaign),
      target_currency__display: currencyById(campaign.target_currency_id)
        .display,
    },
  };
}

export const createFundraisingTeamCampaign: Handler<
  "createFundraisingTeamCampaign"
> = ({ path, body }, { store }) => {
  const team = liveTeam(store, path.team_id);
  if (!team) return notFound("Fundraising team");
  const parsedCampaign = parseTeamCampaign(body, team.currency_id, undefined);
  if (!parsedCampaign.ok) return parsedCampaign.failure;
  const campaign = store.teamCampaigns.insert({
    ...parsedCampaign.value,
    team_id: team.id,
  });
  if (campaign.default) makeDefault(store, team, campaign.id);
  return { status: 200, body: campaignResult(campaign) };
};

export const updateFundraisingTeamCampaign: Handler<
  "updateFundraisingTeamCampaign"
> = ({ path, body }, { store }) => {
  const team = liveTeam(store, path.team_id);
  if (!team) return notFound("Fundraising team");
  const current = teamCampaignOf(store, team, path.campaign_id);
  if (!current) return notFound("Fundraising team campaign");
  const parsedCampaign = parseTeamCampaign(body, team.currency_id, current);
  if (!parsedCampaign.ok) return parsedCampaign.failure;
  const campaign = store.teamCampaigns.update(current.id, parsedCampaign.value);
  if (!campaign) return notFound("Fundraising team campaign");
  if (campaign.default) makeDefault(store, team, campaign.id);
  return { status: 200, body: campaignResult(campaign) };
};

export const deleteFundraisingTeamCampaign: Handler<
  "deleteFundraisingTeamCampaign"
> = ({ path }, { store }) => {
  const team = liveTeam(store, path.team_id);
  if (!team) return notFound("Fundraising team");
  if (!teamCampaignOf(store, team, path.campaign_id)) {
    return notFound("Fundraising team campaign");
  }
  store.teamCampaigns.remove(path.campaign_id);
  for (const campaign of store.fundraisingCampaigns.list(
    (row) => row.team_campaign_id === path.campaign_id,
  )) {
    store.fundraisingCampaigns.update(campaign.id, { team_campaign_id: null });
  }
  return { status: 200, body: {} };
};
