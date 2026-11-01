import { notImplemented } from "../../api/errors";
import type { Fragment } from "../../api/handler";
import {
  createTemplate,
  deleteTemplate,
  getTemplateDetails,
  listTemplates,
  updateTemplate,
} from "./templates";

export const handlers: Fragment<"people"> = {
  createUser: notImplemented,
  getUserList: notImplemented,
  getUserDetails: notImplemented,
  updateUser: notImplemented,
  deleteUser: notImplemented,
  getUserDefinedValuesList: notImplemented,
  generateLoginLinkForUser: notImplemented,
  getUsersTimeline: notImplemented,
  getUsersTagsList: notImplemented,
  addTagToUser: notImplemented,
  removeTagFromUser: notImplemented,
  listChangedCommunicationPermissions: notImplemented,
  getCommunicationPermissions: notImplemented,
  updateCommunicationPermissions: notImplemented,
  createWebhook: notImplemented,
  listWebhooks: notImplemented,
  getWebhookDetails: notImplemented,
  updateWebhook: notImplemented,
  deleteWebhook: notImplemented,
  sendWebhookTestNotification: notImplemented,
  createTemplate,
  listTemplates,
  getTemplateDetails,
  updateTemplate,
  deleteTemplate,
};
