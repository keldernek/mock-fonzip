import { notImplemented } from "../../api/errors";
import type { Fragment } from "../../api/handler";
import {
  getCommunicationPermissions,
  listChangedCommunicationPermissions,
  updateCommunicationPermissions,
} from "./permissions";
import { getUserList } from "./search";
import {
  createTemplate,
  deleteTemplate,
  getTemplateDetails,
  listTemplates,
  updateTemplate,
} from "./templates";
import { getUsersTimeline } from "./timeline";
import {
  createWebhook,
  deleteWebhook,
  getWebhookDetails,
  listWebhooks,
  sendWebhookTestNotification,
  updateWebhook,
} from "./webhooks";

export const handlers: Fragment<"people"> = {
  createUser: notImplemented,
  getUserList,
  getUserDetails: notImplemented,
  updateUser: notImplemented,
  deleteUser: notImplemented,
  getUserDefinedValuesList: notImplemented,
  generateLoginLinkForUser: notImplemented,
  getUsersTimeline,
  getUsersTagsList: notImplemented,
  addTagToUser: notImplemented,
  removeTagFromUser: notImplemented,
  listChangedCommunicationPermissions,
  getCommunicationPermissions,
  updateCommunicationPermissions,
  createWebhook,
  listWebhooks,
  getWebhookDetails,
  updateWebhook,
  deleteWebhook,
  sendWebhookTestNotification,
  createTemplate,
  listTemplates,
  getTemplateDetails,
  updateTemplate,
  deleteTemplate,
};
