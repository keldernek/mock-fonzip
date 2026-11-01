import type { OrgSlug } from "../auth/tenancy";
import { Collection, type OrgCollection } from "./collection";
import type {
  ApplicationRecord,
  BankAccountRecord,
  BankTransactionRecord,
  CardInfoRecord,
  CommunicationPermissionRecord,
  ContactProfileRecord,
  ContactRelationRecord,
  DebtAutomationRecord,
  DebtCategoryRecord,
  DonationCategoryRecord,
  DonationFormRecord,
  DonationPageRecord,
  DonationRecord,
  EcardCategoryRecord,
  EcardRecord,
  EcardTransactionRecord,
  EventRecord,
  F2fGroupRecord,
  FormAnswerItemRecord,
  FormAnswerRecord,
  FormQuestionRecord,
  FormRecord,
  FundraisingCampaignRecord,
  FundraisingEventRecord,
  FundraisingTeamRecord,
  MarketingChannelRecord,
  MergeCandidateRecord,
  MonthlyDonationRequestRecord,
  PaymentSettingsRecord,
  SentEmailRecord,
  SoldTicketRecord,
  SubscriptionRecord,
  TagRecord,
  TeamCampaignRecord,
  TemplateRecord,
  TicketRecord,
  TicketSaleRecord,
  TimelineRecord,
  TransactionRecord,
  UserDefinedValueRecord,
  UserRecord,
  UserTagRecord,
  WebhookRecord,
} from "./records";

export interface Records {
  users: UserRecord;
  userDefinedValues: UserDefinedValueRecord;
  tags: TagRecord;
  userTags: UserTagRecord;
  timeline: TimelineRecord;
  communicationPermissions: CommunicationPermissionRecord;
  contactProfiles: ContactProfileRecord;
  contactRelations: ContactRelationRecord;
  webhooks: WebhookRecord;
  templates: TemplateRecord;
  transactions: TransactionRecord;
  sentEmails: SentEmailRecord;
  donations: DonationRecord;
  microDonations: DonationRecord;
  cardInfos: CardInfoRecord;
  monthlyDonationRequests: MonthlyDonationRequestRecord;
  donationCategories: DonationCategoryRecord;
  donationPages: DonationPageRecord;
  donationForms: DonationFormRecord;
  applications: ApplicationRecord;
  f2fGroups: F2fGroupRecord;
  marketingChannels: MarketingChannelRecord;
  paymentSettings: PaymentSettingsRecord;
  bankAccounts: BankAccountRecord;
  bankTransactions: BankTransactionRecord;
  subscriptions: SubscriptionRecord;
  debtCategories: DebtCategoryRecord;
  debtAutomations: DebtAutomationRecord;
  events: EventRecord;
  tickets: TicketRecord;
  ticketSales: TicketSaleRecord;
  soldTickets: SoldTicketRecord;
  forms: FormRecord;
  formQuestions: FormQuestionRecord;
  formAnswers: FormAnswerRecord;
  formAnswerItems: FormAnswerItemRecord;
  mergeCandidates: MergeCandidateRecord;
  fundraisingCampaigns: FundraisingCampaignRecord;
  fundraisingEvents: FundraisingEventRecord;
  fundraisingTeams: FundraisingTeamRecord;
  teamCampaigns: TeamCampaignRecord;
  ecardCategories: EcardCategoryRecord;
  ecards: EcardRecord;
  ecardTransactions: EcardTransactionRecord;
}

export type Store = { readonly [K in keyof Records]: Collection<Records[K]> };
export type OrgStore = {
  readonly [K in keyof Records]: OrgCollection<Records[K]>;
};

export function createStore(): Store {
  return {
    users: new Collection("users", 1001),
    userDefinedValues: new Collection("userDefinedValues", 11),
    tags: new Collection("tags", 101),
    userTags: new Collection("userTags", 1),
    timeline: new Collection("timeline", 70_001),
    communicationPermissions: new Collection("communicationPermissions", 5001),
    contactProfiles: new Collection("contactProfiles", 3001),
    contactRelations: new Collection("contactRelations", 3601),
    webhooks: new Collection("webhooks", 21),
    templates: new Collection("templates", 301),
    transactions: new Collection("transactions", 900_001),
    sentEmails: new Collection("sentEmails", 600_001),
    donations: new Collection("donations", 50_001),
    microDonations: new Collection("microDonations", 80_001),
    cardInfos: new Collection("cardInfos", 4001),
    monthlyDonationRequests: new Collection("monthlyDonationRequests", 7001),
    donationCategories: new Collection("donationCategories", 201),
    donationPages: new Collection("donationPages", 31),
    donationForms: new Collection("donationForms", 41),
    applications: new Collection("applications", 3),
    f2fGroups: new Collection("f2fGroups", 61),
    marketingChannels: new Collection("marketingChannels", 401),
    paymentSettings: new Collection("paymentSettings", 71),
    bankAccounts: new Collection("bankAccounts", 81),
    bankTransactions: new Collection("bankTransactions", 30_001),
    subscriptions: new Collection("subscriptions", 20_001),
    debtCategories: new Collection("debtCategories", 501),
    debtAutomations: new Collection("debtAutomations", 551),
    events: new Collection("events", 601),
    tickets: new Collection("tickets", 6101),
    ticketSales: new Collection("ticketSales", 61_001),
    soldTickets: new Collection("soldTickets", 62_001),
    forms: new Collection("forms", 701),
    formQuestions: new Collection("formQuestions", 7101),
    formAnswers: new Collection("formAnswers", 71_001),
    formAnswerItems: new Collection("formAnswerItems", 72_001),
    mergeCandidates: new Collection("mergeCandidates", 73_001),
    fundraisingCampaigns: new Collection("fundraisingCampaigns", 801),
    fundraisingEvents: new Collection("fundraisingEvents", 851),
    fundraisingTeams: new Collection("fundraisingTeams", 871),
    teamCampaigns: new Collection("teamCampaigns", 8701),
    ecardCategories: new Collection("ecardCategories", 901),
    ecards: new Collection("ecards", 951),
    ecardTransactions: new Collection("ecardTransactions", 95_001),
  };
}

export function orgStore(store: Store, org: OrgSlug): OrgStore {
  return {
    users: store.users.for(org),
    userDefinedValues: store.userDefinedValues.for(org),
    tags: store.tags.for(org),
    userTags: store.userTags.for(org),
    timeline: store.timeline.for(org),
    communicationPermissions: store.communicationPermissions.for(org),
    contactProfiles: store.contactProfiles.for(org),
    contactRelations: store.contactRelations.for(org),
    webhooks: store.webhooks.for(org),
    templates: store.templates.for(org),
    transactions: store.transactions.for(org),
    sentEmails: store.sentEmails.for(org),
    donations: store.donations.for(org),
    microDonations: store.microDonations.for(org),
    cardInfos: store.cardInfos.for(org),
    monthlyDonationRequests: store.monthlyDonationRequests.for(org),
    donationCategories: store.donationCategories.for(org),
    donationPages: store.donationPages.for(org),
    donationForms: store.donationForms.for(org),
    applications: store.applications.for(org),
    f2fGroups: store.f2fGroups.for(org),
    marketingChannels: store.marketingChannels.for(org),
    paymentSettings: store.paymentSettings.for(org),
    bankAccounts: store.bankAccounts.for(org),
    bankTransactions: store.bankTransactions.for(org),
    subscriptions: store.subscriptions.for(org),
    debtCategories: store.debtCategories.for(org),
    debtAutomations: store.debtAutomations.for(org),
    events: store.events.for(org),
    tickets: store.tickets.for(org),
    ticketSales: store.ticketSales.for(org),
    soldTickets: store.soldTickets.for(org),
    forms: store.forms.for(org),
    formQuestions: store.formQuestions.for(org),
    formAnswers: store.formAnswers.for(org),
    formAnswerItems: store.formAnswerItems.for(org),
    mergeCandidates: store.mergeCandidates.for(org),
    fundraisingCampaigns: store.fundraisingCampaigns.for(org),
    fundraisingEvents: store.fundraisingEvents.for(org),
    fundraisingTeams: store.fundraisingTeams.for(org),
    teamCampaigns: store.teamCampaigns.for(org),
    ecardCategories: store.ecardCategories.for(org),
    ecards: store.ecards.for(org),
    ecardTransactions: store.ecardTransactions.for(org),
  };
}
