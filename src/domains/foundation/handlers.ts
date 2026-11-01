import type { Fragment } from "../../api/handler";
import {
  getBankAccountList,
  getBankAccountTransactionList,
  getMarketingChannelFilterValues,
  getMarketingChannelList,
  getPaymentSystemsList,
} from "./system";
import { createTag, deleteTag, getTagsList, updateTag } from "./tags";
import { getAccessToken } from "./token";

export const handlers: Fragment<"foundation"> = {
  getAccessToken,
  getMe: (_input, ctx) => ({ status: 200, body: ctx.org.info }),
  getBankAccountList,
  getBankAccountTransactionList,
  getMarketingChannelList,
  getMarketingChannelFilterValues,
  getPaymentSystemsList,
  getTagsList,
  createTag,
  updateTag,
  deleteTag,
};
