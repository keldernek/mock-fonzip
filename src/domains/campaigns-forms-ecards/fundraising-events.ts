import { notFound } from "../../api/errors";
import type { Handler, HandlerInput } from "../../api/handler";
import type { Row } from "../../store/collection";
import type { FundraisingEventRecord } from "../../store/records";
import { TRY_CURRENCY_ID } from "../../store/reference";
import type { OrgStore } from "../../store/store";
import { badRequest, failed, parsed, type Parsed } from "./failures";
import { funding, knownCurrency, liveCampaigns } from "./funding";

type EventBody = HandlerInput<"createFundraisingEvent">["body"];
type FundraisingEvent = Row<FundraisingEventRecord>;

const HTTP_URL = /^https?:\/\/\S+$/i;

function parseEvent(
  body: EventBody,
  current: FundraisingEvent | undefined,
): Parsed<Omit<FundraisingEventRecord, "id">> {
  const title = body?.title?.trim() ?? "";
  if (title === "") return failed(badRequest("title is required"));
  if (body?.has_target === true && body.target_currency_id === undefined) {
    return failed(
      badRequest("target_currency_id is required when has_target is true"),
    );
  }
  if (body?.image !== undefined && !HTTP_URL.test(body.image)) {
    return failed(badRequest("image must be an http(s) URL"));
  }
  const hasTarget = body?.has_target ?? current?.has_target ?? false;
  const currencyId = hasTarget
    ? (body?.target_currency_id ??
      current?.target_currency_id ??
      TRY_CURRENCY_ID)
    : TRY_CURRENCY_ID;
  if (!knownCurrency(currencyId)) {
    return failed(badRequest("unknown target_currency_id"));
  }
  return parsed({
    title,
    has_target: hasTarget,
    target: hasTarget ? (body?.target ?? current?.target ?? 0) : 0,
    target_currency_id: currencyId,
    image: body?.image ?? current?.image ?? "",
  });
}

function toEvent(store: OrgStore, event: FundraisingEvent) {
  const campaigns = liveCampaigns(
    store,
    (campaign) => campaign.association_campaign_target_id === event.id,
  );
  const raised = funding(store, campaigns, event.target_currency_id);
  return {
    id: event.id,
    title: event.title,
    target: event.target,
    donation_sum: raised.sum,
    donation_count: raised.count,
    campaign_count: campaigns.length,
  };
}

export const getFundraisingEvents: Handler<"getFundraisingEvents"> = (
  _input,
  { store },
) => ({
  status: 200,
  body: {
    event_list: store.fundraisingEvents
      .list()
      .map((event) => toEvent(store, event)),
  },
});

export const createFundraisingEvent: Handler<"createFundraisingEvent"> = (
  { body },
  { store },
) => {
  const event = parseEvent(body, undefined);
  if (!event.ok) return event.failure;
  store.fundraisingEvents.insert(event.value);
  return { status: 200, body: { result: "ok" } };
};

export const updateFundraisingEvent: Handler<"updateFundraisingEvent"> = (
  { path, body },
  { store },
) => {
  const current = store.fundraisingEvents.get(path.event_id);
  if (!current) return notFound("Fundraising event");
  const event = parseEvent(body, current);
  if (!event.ok) return event.failure;
  store.fundraisingEvents.update(current.id, event.value);
  return { status: 200, body: { result: "ok" } };
};

export const deleteFundraisingEvent: Handler<"deleteFundraisingEvent"> = (
  { path },
  { store },
) => {
  if (!store.fundraisingEvents.remove(path.event_id)) {
    return notFound("Fundraising event");
  }
  for (const campaign of store.fundraisingCampaigns.list(
    (row) => row.association_campaign_target_id === path.event_id,
  )) {
    store.fundraisingCampaigns.update(campaign.id, {
      association_campaign_target_id: null,
    });
  }
  return { status: 200, body: { result: "ok" } };
};
