import type { Fragment } from "../../api/handler";
import {
  createFundraisingCampaign,
  deleteFundraisingCampaign,
  getFundraisingCampaignDetails,
  getFundraisingCampaignList,
  updateFundraisingCampaign,
  updateFundraisingCampaignStatus,
} from "./campaigns";
import {
  deleteEcardTransaction,
  getEcardTransactionDetails,
  getEcardTransactionList,
  getUserEcardTransactionList,
} from "./ecard-sales";
import {
  createEcardCategory,
  deleteEcardCategory,
  getEcardCategoryList,
  getEcardDetails,
  getEcardList,
  updateEcardCategory,
} from "./ecards";
import {
  getFormAnswerDetails,
  getFormAnswerList,
  getFormList,
  getUserAnswerList,
  respondFormAnswer,
} from "./forms";
import {
  createFundraisingEvent,
  deleteFundraisingEvent,
  getFundraisingEvents,
  updateFundraisingEvent,
} from "./fundraising-events";
import {
  createFundraisingTeam,
  createFundraisingTeamCampaign,
  deleteFundraisingTeam,
  deleteFundraisingTeamCampaign,
  getFundraisingTeamDetail,
  getFundraisingTeams,
  getFundraisingTeamsCampaigns,
  updateFundraisingTeam,
  updateFundraisingTeamCampaign,
} from "./teams";

export const handlers: Fragment<"campaigns-forms-ecards"> = {
  getFundraisingCampaignList,
  createFundraisingCampaign,
  getFundraisingCampaignDetails,
  updateFundraisingCampaign,
  updateFundraisingCampaignStatus,
  deleteFundraisingCampaign,
  getFundraisingEvents,
  createFundraisingEvent,
  updateFundraisingEvent,
  deleteFundraisingEvent,
  getFundraisingTeams,
  createFundraisingTeam,
  getFundraisingTeamDetail,
  updateFundraisingTeam,
  deleteFundraisingTeam,
  getFundraisingTeamsCampaigns,
  createFundraisingTeamCampaign,
  updateFundraisingTeamCampaign,
  deleteFundraisingTeamCampaign,
  getFormList,
  getFormAnswerList,
  getFormAnswerDetails,
  respondFormAnswer,
  getUserAnswerList,
  getEcardCategoryList,
  createEcardCategory,
  updateEcardCategory,
  deleteEcardCategory,
  getEcardList,
  getEcardDetails,
  getEcardTransactionList,
  getEcardTransactionDetails,
  deleteEcardTransaction,
  getUserEcardTransactionList,
};
