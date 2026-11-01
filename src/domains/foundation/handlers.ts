import { notImplemented } from "../../api/errors";
import type { Fragment } from "../../api/handler";
import { getAccessToken } from "./token";

export const handlers: Fragment<"foundation"> = {
  getAccessToken,
  getMe: (_input, ctx) => ({ status: 200, body: ctx.org.info }),
  getBankAccountList: notImplemented,
  getBankAccountTransactionList: notImplemented,
  getMarketingChannelList: notImplemented,
  getMarketingChannelFilterValues: notImplemented,
  getPaymentSystemsList: notImplemented,
  getTagsList: notImplemented,
  createTag: notImplemented,
  updateTag: notImplemented,
  deleteTag: notImplemented,
};
