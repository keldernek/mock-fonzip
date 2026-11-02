import type { components } from "../generated/openapi";
import type { PaymentStatus } from "./reference";

type S = components["schemas"];

type IsJoinKey<K> = K extends `${string}__${string}` ? true : false;

export type Own<T> = {
  -readonly [K in keyof T as IsJoinKey<K> extends true ? never : K]-?: Exclude<
    T[K],
    undefined
  >;
};

export type WithNull<T, K extends keyof T> = Omit<T, K> & {
  [P in K]: T[P] | null;
};

export type PaymentMethod = S["PaymentMethod"];
export type TransactionErrorGroup = Exclude<
  S["TransactionErrorGroup"],
  undefined
>;
export type UdvValue = string | number | boolean | readonly string[] | null;

type CommunicationPermissionItem = Exclude<
  components["responses"]["CommunicationPermissionList"]["content"]["application/json"]["permission_list"],
  undefined
>;

type AllowComm =
  | "allow_comm_via_phone"
  | "allow_comm_via_phone_date"
  | "allow_comm_via_sms"
  | "allow_comm_via_sms_date"
  | "allow_comm_via_email"
  | "allow_comm_via_email_date";

export type UserRecord = Own<
  Omit<
    S["User"] & S["UserDetails"],
    "user_defined_values" | "tags_as_text" | "name" | AllowComm
  >
> & {
  user_defined_values: Record<string, UdvValue>;
  profile_pic: string | null;
};

export type UserDefinedValueRecord = Own<
  Omit<S["UserDefinedValues"], "id" | "udv_id">
> & {
  id: number;
  key: string;
};

export type TagRecord = Own<S["Tag"]>;

export interface UserTagRecord {
  id: number;
  user_id: number;
  tag_id: number;
  create_date: string;
}

export type TimelineRecord = WithNull<
  Own<Omit<S["Timeline"], "id">>,
  | "tag_id"
  | "amount"
  | "lead_type"
  | "outcome"
  | "sequence_no"
  | "is_first_touch"
> & {
  id: number;
  user_id: number;
  issuer_id: number | null;
  currency_id: number | null;
  added_by_id: number | null;
  calendar_event: {
    id: number;
    note: string;
    date: string;
    completed: boolean;
  } | null;
};

export type CommunicationPermissionRecord = Own<CommunicationPermissionItem> & {
  user_id: number | null;
};

export interface ContactProfileRecord {
  id: number;
  user_id: number;
  create_date: string;
  last_update_date: string;
  has_password: boolean;
  last_login: { date: string; ip_address: string } | null;
  profile_pic: string | null;
  language: "tr" | "en";
  agreement: { version: number; sign_date: string } | null;
  blocked_mail: boolean;
  spam_mail: boolean;
  address_book: boolean;
  donation_reminder: { period_months: number; next_cycle: string } | null;
  notify_after_dues_withdrawal: boolean;
  default_dues_reminder_withdrawal: boolean;
}

export interface ContactRelationRecord {
  id: number;
  user_id: number;
  related_user_id: number;
  dues_permission: boolean;
  comm_permission: boolean;
  create_date: string;
}

export type WebhookRecord = Own<Omit<S["Webhook"], "events">> & {
  events: Own<Exclude<S["Webhook"]["events"], undefined>>;
};

export type TemplateRecord = Own<S["Template"]>;

export interface TemplateCategory {
  readonly id: number;
  readonly name: string;
}

export type CurrencyRecord = Own<S["Currency"]>;

export type TransactionRecord = WithNull<
  Own<
    Omit<
      S["Transaction"],
      "currency" | "payment_settings" | "bank_account" | "payment_status"
    >
  >,
  | "refund_date"
  | "refunded_by_id"
  | "refund_reason"
  | "payment_settings_id"
  | "bank_account_id"
  | "error_code"
  | "error_text"
  | "bin_number"
  | "last_four"
  | "auth_code"
  | "provision_no"
> & {
  currency_id: number;
  payment_status: PaymentStatus;
  error_group: TransactionErrorGroup;
};

export type SentEmailRecord = Own<S["SentEmail"]>;

export type DonationRecord = WithNull<
  Own<
    Omit<
      S["DonationResult"] & S["DonationDetailResult"],
      | "user"
      | "transaction"
      | "sent_mail"
      | "sent_mail_to_referring"
      | "card_info"
    >
  >,
  | "sub_donation_type_id"
  | "fundraising_campaign_id"
  | "fundraising_page_id"
  | "module_id"
  | "application_id"
  | "f2f_group_id"
  | "added_by_id"
  | "updated_by_id"
  | "cancelled_by_id"
  | "sent_mail_id"
  | "sent_mail_to_referring_id"
  | "thanks_mail_id"
  | "recurring_order_id"
  | "recurring_cancel_reason"
  | "recurring_cancel_date"
  | "recurring_start_date"
  | "recurring_next_cycle"
  | "recurring_next_amount"
  | "recurring_last_success_withdrawal_date"
  | "recurring_error"
  | "recurring_limit"
  | "api_tracking_id"
> & {
  transaction_id: number;
  marketing_channel_id: number | null;
  card_info_id: number | null;
  monthly_donation_id: number | null;
};

export interface CardInfoRecord {
  id: number;
  user_id: number;
  bin_number: string;
  last_four: string;
  display: string;
}

export interface MonthlyDonationRequestRecord {
  id: number;
  donation_id: number;
  user_id: number;
  request_type: 0 | 1;
  status: 0 | 1 | 2 | 3 | 4;
  value: string;
  create_date: string;
  response_date: string | null;
}

export type DonationCategoryRecord = WithNull<
  Own<Omit<S["DonationCategory"], "last_donation_date">>,
  "created_by_id" | "updated_by_id" | "update_date"
>;

export type DonationPageRecord = WithNull<
  Own<Omit<S["DonationPageList"], "last_donation_date">>,
  "created_by_id" | "updated_by_id" | "update_date"
> & {
  category_id: number | null;
  payment_settings_id: number | null;
};

export type DonationFormRecord = WithNull<
  Own<Omit<S["DonationFormList"], "last_donation_date">>,
  "created_by_id" | "updated_by_id" | "update_date"
> & {
  category_id: number | null;
  payment_settings_id: number | null;
  custom_parameters: Record<string, unknown>;
};

export interface ApplicationRecord {
  id: number;
  title: string;
  api_key_id: string | null;
}

export interface F2fGroupRecord {
  id: number;
  title: string;
}

export type MarketingChannelRecord = Own<
  Omit<S["MarketingChannel"], "donations" | "ecards">
>;

export type PaymentSettingsRecord = Own<S["PaymentSettings"]>;

export type BankAccountRecord = WithNull<
  Own<S["BankAccount"]>,
  "created_by_id" | "updated_by_id" | "update_date"
>;

export type BankTransactionRecord = Required<
  Omit<S["BankAccountTransaction"], "matched_user_name">
> & {
  bank_account_id: number;
};

export type SubscriptionRecord = WithNull<
  Own<
    Omit<
      S["MembershipDueDetails"] &
        S["MembershipDues"] &
        S["UsersMembershipDues"] &
        S["MembershipDueDebts"],
      "user" | "transaction" | "debt_category" | "status_name"
    >
  >,
  | "debt_category_id"
  | "added_by_id"
  | "updated_by_id"
  | "recurring_next_cycle"
  | "order_id"
  | "card_info"
  | "bill_no"
  // Only a payment can have no period. The debts list types its period as a
  // plain string, which would otherwise narrow the whole intersection.
  | "period"
> & {
  transaction_id: number | null;
};

export type DebtCategoryRecord = WithNull<
  Own<
    Pick<
      S["DebtCategoryListItem"],
      | "id"
      | "name"
      | "create_date"
      | "created_by_id"
      | "update_date"
      | "updated_by_id"
    >
  >,
  "created_by_id" | "update_date" | "updated_by_id"
> & {
  deleted: boolean;
};

export interface DebtAutomationRecord {
  id: number;
  title: string;
  debt_category_id: number | null;
}

export type EventRecord = WithNull<
  Own<Omit<S["EventList"] & S["Event"], "ticket_types">>,
  | "created_by_id"
  | "archived_by_id"
  | "archive_date"
  | "updated_by_id"
  | "update_date"
  | "payment_settings_id"
  | "sender_account_id"
>;

export type TicketRecord = WithNull<
  Own<Omit<S["EventTicket"], "sold">>,
  "sales_start" | "sales_end"
> & {
  event_id: number | null;
};

export interface TicketSaleRecord {
  id: number;
  event_id: number;
  transaction_id: number;
  user_id: number | null;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  district: string;
  post_code: string;
  details: string;
  sent_mail_id: number | null;
}

export interface SoldTicketRecord {
  id: number;
  ticket_sale_id: number;
  ticket_id: number;
  attendee_name: string;
}

export type FormRecord = WithNull<
  Own<
    Omit<S["Form"], "last_answer_date" | "waiting_approval" | "response_count">
  >,
  | "application_limit"
  | "archived_by_id"
  | "archive_date"
  | "updated_by_id"
  | "update_date"
> & {
  requires_approval: boolean;
  price: number | null;
};

export type FormQuestionRecord = Own<
  Omit<S["FormQuestion"], "udv_question" | "custom_question">
> & {
  form_id: number;
  udv_id: number | null;
  custom_question: Own<S["CustomQuestion"]> | null;
  options: Own<S["SelectedOptionDetail"]>[];
};

export interface FormAnswerRecord {
  id: number;
  form_id: number;
  user_id: number | null;
  first_name: string;
  last_name: string;
  email: string;
  email_verification: boolean;
  complete_date: string;
  transaction_id: number | null;
  approval_status: 0 | 1 | 2;
  sent_mail_id: number | null;
}

export interface MergeCandidateRecord {
  id: number;
  first_user_id: number;
  second_user_id: number;
  create_date: string;
}

export interface FormAnswerItemRecord {
  id: number;
  answer_id: number;
  question_id: number;
  answer: string;
  db_answer: string;
  selected_option_ids: number[];
}

type CampaignDetail = Exclude<
  components["responses"]["FundraisingCampaignDetailsResponse"]["content"]["application/json"]["campaign"],
  undefined
>;

export type FundraisingCampaignRecord = WithNull<
  Own<
    Omit<
      S["FundraisingCampaignList"] & S["FundraisingCampaign"] & CampaignDetail,
      "bank_account_list" | "donation_total" | "team_id"
    >
  >,
  | "update_title"
  | "update_image"
  | "update_personal_message"
  | "activation_date"
  | "finish_date"
  | "event_date"
  | "certificate_id"
  | "thanks_sms_id"
  | "referral_certificate_id"
  | "referral_thanks_mail_id"
  | "association_campaign_target_id"
  | "sub_donation_type_id"
  | "thanks_mail_id"
> & {
  bank_account_ids: number[];
  team_id: number | null;
  team_campaign_id: number | null;
};

export type FundraisingEventRecord = Own<S["FundraisingEvent"]>;

type TeamDetail = Exclude<
  components["responses"]["FundraisingTeamDetailResponse"]["content"]["application/json"]["team"],
  undefined
>;

export type FundraisingTeamRecord = WithNull<
  Own<
    Omit<
      TeamDetail & S["FundraisingTeamDetail"],
      "donation_sum" | "donation_count" | "campaign_list" | "currency_id"
    >
  >,
  "update_title" | "update_details" | "update_image"
> & {
  currency_id: number;
};

export type TeamCampaignRecord = Own<S["FundraisingTeamCampaignList"]> & {
  team_id: number;
};

export type EcardCategoryRecord = WithNull<
  Own<S["EcardCategory"]>,
  "created_by_id" | "updated_by_id" | "update_date"
>;

export type EcardRecord = Own<S["EcardDetails"]>;

export type EcardTransactionRecord = WithNull<
  Own<S["EcardTransaction"] & S["EcardTransactionDetail"]>,
  | "sent_mail_id"
  | "sent_mail_to_referring_id"
  | "added_by_id"
  | "updated_by_id"
  | "delivery_date"
  | "user_id"
> & {
  transaction_id: number;
  marketing_channel_id: number | null;
};
