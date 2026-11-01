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
import { createDonation } from "./create-donation";
import {
  deleteDonation,
  getDonationDetails,
  getDonationList,
  getMicroDonationDetails,
  getMicroDonationList,
} from "./donations";
import {
  cancelMonthlyDonation,
  changeMonthlyDonationValues,
  createMonthlyDonationUpdateRequest,
  respondMonthlyDonationAmountChangeRequest,
  sendCardUpdateRequestForMonthlyDonation,
} from "./monthly";
import {
  getUsersDonationList,
  getUsersMicroDonationList,
  getUsersMonthlyDonationList,
} from "./user-lists";

export const handlers: Fragment<"giving"> = {
  createDonation,
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
  cancelMonthlyDonation,
  respondMonthlyDonationAmountChangeRequest,
  changeMonthlyDonationValues,
  sendCardUpdateRequestForMonthlyDonation,
  createMonthlyDonationUpdateRequest,
  getDonationFormList,
  getDonationPageList,
  getUsersDonationList,
  getUsersMicroDonationList,
  getUsersMonthlyDonationList,
};
