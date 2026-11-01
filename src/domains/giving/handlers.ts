import { notImplemented } from "../../api/errors";
import type { Fragment } from "../../api/handler";
import { getDonationFormList, getDonationPageList } from "./catalog";
import {
  createDonationCategory,
  deleteDonationCategory,
  getDonationCategoryList,
  updateDonationCategory,
  updateDonationCategoryStatus,
} from "./categories";
import {
  deleteDonation,
  getDonationDetails,
  getDonationList,
  getMicroDonationDetails,
  getMicroDonationList,
} from "./donations";

export const handlers: Fragment<"giving"> = {
  createDonation: notImplemented,
  getDonationList,
  getDonationDetails,
  deleteDonation,
  getDonationReport: notImplemented,
  getDonationCategoryList,
  createDonationCategory,
  updateDonationCategory,
  updateDonationCategoryStatus,
  deleteDonationCategory,
  getMicroDonationList,
  getMicroDonationDetails,
  cancelMonthlyDonation: notImplemented,
  respondMonthlyDonationAmountChangeRequest: notImplemented,
  changeMonthlyDonationValues: notImplemented,
  sendCardUpdateRequestForMonthlyDonation: notImplemented,
  createMonthlyDonationUpdateRequest: notImplemented,
  getDonationFormList,
  getDonationPageList,
  getUsersDonationList: notImplemented,
  getUsersMicroDonationList: notImplemented,
  getUsersMonthlyDonationList: notImplemented,
};
