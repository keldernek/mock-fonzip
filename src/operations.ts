import type { operations } from "./generated/openapi";

export const OWNERSHIP = {
  foundation: [
    "getAccessToken",
    "getMe",
    "getBankAccountList",
    "getBankAccountTransactionList",
    "getMarketingChannelList",
    "getMarketingChannelFilterValues",
    "getPaymentSystemsList",
    "getTagsList",
    "createTag",
    "updateTag",
    "deleteTag",
  ],
  people: [
    "createUser",
    "getUserList",
    "getUserDetails",
    "updateUser",
    "deleteUser",
    "getUserDefinedValuesList",
    "generateLoginLinkForUser",
    "getUsersTimeline",
    "getUsersTagsList",
    "addTagToUser",
    "removeTagFromUser",
    "listChangedCommunicationPermissions",
    "getCommunicationPermissions",
    "updateCommunicationPermissions",
    "createWebhook",
    "listWebhooks",
    "getWebhookDetails",
    "updateWebhook",
    "deleteWebhook",
    "sendWebhookTestNotification",
    "createTemplate",
    "listTemplates",
    "getTemplateDetails",
    "updateTemplate",
    "deleteTemplate",
  ],
  giving: [
    "createDonation",
    "getDonationList",
    "getDonationDetails",
    "deleteDonation",
    "getDonationReport",
    "getDonationCategoryList",
    "createDonationCategory",
    "updateDonationCategory",
    "updateDonationCategoryStatus",
    "deleteDonationCategory",
    "getMicroDonationList",
    "getMicroDonationDetails",
    "cancelMonthlyDonation",
    "respondMonthlyDonationAmountChangeRequest",
    "changeMonthlyDonationValues",
    "sendCardUpdateRequestForMonthlyDonation",
    "createMonthlyDonationUpdateRequest",
    "getDonationFormList",
    "getDonationPageList",
    "getUsersDonationList",
    "getUsersMicroDonationList",
    "getUsersMonthlyDonationList",
  ],
  "dues-events": [
    "getMembershipDuesList",
    "getMembershipDueDetails",
    "deleteMembershipDue",
    "getUsersMembershipDueList",
    "getMembershipDueDebtsList",
    "createDebt",
    "getDebtDetails",
    "updateDebt",
    "updateDebtStatus",
    "deleteDebt",
    "getDebtCategoryList",
    "createDebtCategory",
    "getDebtCategoryUsage",
    "updateDebtCategory",
    "deleteDebtCategory",
    "getEventList",
    "createEvent",
    "getEventDetails",
    "updateEvent",
    "updateEventStatus",
    "deleteEvent",
    "createTicket",
    "getTicketDetails",
    "updateTicket",
    "deleteTicket",
    "getTicketSaleList",
    "getTicketSaleDetails",
    "getUserBoughtTicketList",
  ],
  "campaigns-forms-ecards": [
    "getFundraisingCampaignList",
    "createFundraisingCampaign",
    "getFundraisingCampaignDetails",
    "updateFundraisingCampaign",
    "updateFundraisingCampaignStatus",
    "deleteFundraisingCampaign",
    "getFundraisingEvents",
    "createFundraisingEvent",
    "updateFundraisingEvent",
    "deleteFundraisingEvent",
    "getFundraisingTeams",
    "createFundraisingTeam",
    "getFundraisingTeamDetail",
    "updateFundraisingTeam",
    "deleteFundraisingTeam",
    "getFundraisingTeamsCampaigns",
    "createFundraisingTeamCampaign",
    "updateFundraisingTeamCampaign",
    "deleteFundraisingTeamCampaign",
    "getFormList",
    "getFormAnswerList",
    "getFormAnswerDetails",
    "respondFormAnswer",
    "getUserAnswerList",
    "getEcardCategoryList",
    "createEcardCategory",
    "updateEcardCategory",
    "deleteEcardCategory",
    "getEcardList",
    "getEcardDetails",
    "getEcardTransactionList",
    "getEcardTransactionDetails",
    "deleteEcardTransaction",
    "getUserEcardTransactionList",
  ],
} as const;

export const NOT_SERVED = ["oauthAuthorizeGet"] as const;

export type OperationId = keyof operations;
export type Domain = keyof typeof OWNERSHIP;
export type OwnedBy<D extends Domain> = (typeof OWNERSHIP)[D][number];
export type ServedOperationId = OwnedBy<Domain>;
export type NotServedOperationId = (typeof NOT_SERVED)[number];
export type PublicOperationId = "getAccessToken";
export type BearerOperationId = Exclude<ServedOperationId, PublicOperationId>;

type Overlap<D extends Domain> = OwnedBy<D> & OwnedBy<Exclude<Domain, D>>;
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
function assertTrue<T extends true>(proof: T): T {
  return proof;
}
assertTrue<Same<ServedOperationId | NotServedOperationId, OperationId>>(true);
assertTrue<Same<ServedOperationId & NotServedOperationId, never>>(true);
assertTrue<Same<{ [D in Domain]: Overlap<D> }[Domain], never>>(true);

export const DOMAINS: readonly Domain[] = [
  "foundation",
  "people",
  "giving",
  "dues-events",
  "campaigns-forms-ecards",
];

const OWNER_BY_OPERATION = new Map<string, Domain>(
  DOMAINS.flatMap((domain) =>
    OWNERSHIP[domain].map((operationId): [string, Domain] => [
      operationId,
      domain,
    ]),
  ),
);

export function ownerOf(operationId: string): Domain | undefined {
  return OWNER_BY_OPERATION.get(operationId);
}

export function isServedOperationId(id: string): id is ServedOperationId {
  return OWNER_BY_OPERATION.has(id);
}

export function isNotServedOperationId(id: string): id is NotServedOperationId {
  return NOT_SERVED.some((notServed) => notServed === id);
}
