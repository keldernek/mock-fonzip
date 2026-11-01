import { notImplemented } from "../../api/errors";
import type { Fragment } from "../../api/handler";
import {
  createDebtCategory,
  deleteDebtCategory,
  getDebtCategoryList,
  getDebtCategoryUsage,
  updateDebtCategory,
} from "./debt-categories";
import {
  createDebt,
  deleteDebt,
  getDebtDetails,
  getMembershipDueDebtsList,
  updateDebt,
  updateDebtStatus,
} from "./debts";
import {
  deleteMembershipDue,
  getMembershipDueDetails,
  getMembershipDuesList,
  getUsersMembershipDueList,
} from "./dues";

export const handlers: Fragment<"dues-events"> = {
  getMembershipDuesList,
  getMembershipDueDetails,
  deleteMembershipDue,
  getUsersMembershipDueList,
  getMembershipDueDebtsList,
  createDebt,
  getDebtDetails,
  updateDebt,
  updateDebtStatus,
  deleteDebt,
  getDebtCategoryList,
  createDebtCategory,
  getDebtCategoryUsage,
  updateDebtCategory,
  deleteDebtCategory,
  getEventList: notImplemented,
  createEvent: notImplemented,
  getEventDetails: notImplemented,
  updateEvent: notImplemented,
  updateEventStatus: notImplemented,
  deleteEvent: notImplemented,
  createTicket: notImplemented,
  getTicketDetails: notImplemented,
  updateTicket: notImplemented,
  deleteTicket: notImplemented,
  getTicketSaleList: notImplemented,
  getTicketSaleDetails: notImplemented,
  getUserBoughtTicketList: notImplemented,
};
