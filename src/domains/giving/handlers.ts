import { notImplemented } from "../../api/errors";
import type { Fragment } from "../../api/handler";
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
  getDonationCategoryList: notImplemented,
  createDonationCategory: notImplemented,
  updateDonationCategory: notImplemented,
  updateDonationCategoryStatus: notImplemented,
  deleteDonationCategory: notImplemented,
  getMicroDonationList,
  getMicroDonationDetails,
  cancelMonthlyDonation: notImplemented,
  respondMonthlyDonationAmountChangeRequest: notImplemented,
  changeMonthlyDonationValues: notImplemented,
  sendCardUpdateRequestForMonthlyDonation: notImplemented,
  createMonthlyDonationUpdateRequest: notImplemented,
  getDonationFormList: notImplemented,
  getDonationPageList: notImplemented,
  getUsersDonationList: notImplemented,
  getUsersMicroDonationList: notImplemented,
  getUsersMonthlyDonationList: notImplemented,
};
