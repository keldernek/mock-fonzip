import { notImplemented } from "../../api/errors";
import type { Fragment } from "../../api/handler";

export const handlers: Fragment<"giving"> = {
  createDonation: notImplemented,
  getDonationList: notImplemented,
  getDonationDetails: notImplemented,
  deleteDonation: notImplemented,
  getDonationReport: notImplemented,
  getDonationCategoryList: notImplemented,
  createDonationCategory: notImplemented,
  updateDonationCategory: notImplemented,
  updateDonationCategoryStatus: notImplemented,
  deleteDonationCategory: notImplemented,
  getMicroDonationList: notImplemented,
  getMicroDonationDetails: notImplemented,
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
