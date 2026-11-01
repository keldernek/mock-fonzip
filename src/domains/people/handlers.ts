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
import { addTagToUser, getUsersTagsList, removeTagFromUser } from "./user-tags";
import {
  createUser,
  deleteUser,
  generateLoginLinkForUser,
  getUserDefinedValuesList,
  getUserDetails,
  updateUser,
} from "./users";
import {
  createWebhook,
  deleteWebhook,
  getWebhookDetails,
  listWebhooks,
  sendWebhookTestNotification,
  updateWebhook,
} from "./webhooks";

export const handlers: Fragment<"people"> = {
  createUser,
  getUserList,
  getUserDetails,
  updateUser,
  deleteUser,
  getUserDefinedValuesList,
  generateLoginLinkForUser,
  getUsersTimeline,
  getUsersTagsList,
  addTagToUser,
  removeTagFromUser,
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
