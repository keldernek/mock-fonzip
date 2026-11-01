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
import {
  createEvent,
  deleteEvent,
  getEventDetails,
  getEventList,
  updateEvent,
  updateEventStatus,
} from "./events";
import {
  getTicketSaleDetails,
  getTicketSaleList,
  getUserBoughtTicketList,
} from "./ticket-sales";
import {
  createTicket,
  deleteTicket,
  getTicketDetails,
  updateTicket,
} from "./tickets";

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
  getEventList,
  createEvent,
  getEventDetails,
  updateEvent,
  updateEventStatus,
  deleteEvent,
  createTicket,
  getTicketDetails,
  updateTicket,
  deleteTicket,
  getTicketSaleList,
  getTicketSaleDetails,
  getUserBoughtTicketList,
};
