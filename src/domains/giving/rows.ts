import type { components } from "../../generated/openapi";
import type { OrgCollection, Row } from "../../store/collection";
import {
  nonEmpty,
  present,
  transactionDetail,
  transactionJoin,
  userName,
  userReference,
} from "../../store/joins";
import type { DonationRecord, TransactionRecord } from "../../store/records";
import type { OrgStore } from "../../store/store";
import { paymentStatusOf, transactionOf } from "./payments";

type S = components["schemas"];
export type DonationResult = S["DonationResult"];
type DonationDetail = S["DonationDetailResult"];

export interface DonationView {
  readonly donation: Row<DonationRecord>;
  readonly transaction: Row<TransactionRecord>;
}

export function viewOf(
  store: OrgStore,
  donation: Row<DonationRecord>,
): DonationView {
  return { donation, transaction: transactionOf(store, donation) };
}

export function lookup<R extends { id: number }>(
  collection: OrgCollection<R>,
  id: number | null,
): Row<R> | undefined {
  return id === null ? undefined : collection.get(id);
}

function startOfDay(date: string | null): string | undefined {
  return date === null ? undefined : `${date}T00:00:00+03:00`;
}

export function donationResult(
  store: OrgStore,
  { donation, transaction }: DonationView,
): DonationResult {
  const tx = transactionJoin(store, transaction);
  const user = store.users.get(donation.user_id);
  const category = lookup(
    store.donationCategories,
    donation.sub_donation_type_id,
  );
  const campaign = lookup(
    store.fundraisingCampaigns,
    donation.fundraising_campaign_id,
  );
  const page = lookup(store.donationPages, donation.fundraising_page_id);
  const form = lookup(store.donationForms, donation.module_id);
  const group = lookup(store.f2fGroups, donation.f2f_group_id);
  const application = lookup(store.applications, donation.application_id);
  const channel = lookup(
    store.marketingChannels,
    donation.marketing_channel_id,
  );
  const mail = lookup(store.sentEmails, donation.sent_mail_id);
  const referralMail = lookup(
    store.sentEmails,
    donation.sent_mail_to_referring_id,
  );
  return {
    id: donation.id,
    user_id: donation.user_id,
    transaction__fonzip_framework: tx.transaction__fonzip_framework,
    recurring_status: donation.recurring_status,
    transaction__payment_status: paymentStatusOf(transaction),
    d_type: donation.d_type,
    email: nonEmpty(donation.email),
    user__email: user && nonEmpty(user.email),
    details: donation.details,
    name: donation.name,
    user__first_name: user?.first_name,
    user__last_name: user?.last_name,
    address: donation.address,
    city: donation.city,
    district: donation.district,
    transaction__amount: tx.transaction__amount,
    transaction__currency__display: tx.transaction__currency__display,
    transaction__currency__iso_code: tx.transaction__currency__iso_code,
    sub_donation_type_id: present(donation.sub_donation_type_id),
    sub_donation_type__name: category?.name,
    birthday: nonEmpty(donation.birthday),
    sent_mail_id: mail?.id,
    sent_mail__message_id: mail?.message_id,
    sent_mail__status: mail?.status,
    sent_mail_to_referring_id: referralMail?.id,
    sent_mail_to_referring__message_id: referralMail?.message_id,
    sent_mail_to_referring__status: referralMail?.status,
    transaction__complete_date: tx.transaction__complete_date,
    fundraising_campaign_id: campaign?.id,
    fundraising_campaign__title: campaign?.title,
    tckno: donation.tckno,
    phone: donation.phone,
    fundraising_page_id: page?.id,
    fundraising_page__title: page?.title,
    module_id: form?.id,
    module__title: form?.title,
    transaction__payment_method: tx.transaction__payment_method,
    added_by_id: present(donation.added_by_id),
    added_by__name: userName(store, donation.added_by_id),
    f2f_group_id: group?.id,
    f2f_group__title: group?.title,
    transaction__fonzip_id: tx.transaction__fonzip_id,
    recurring_order_id: present(donation.recurring_order_id),
    recurring_withdraw_count: donation.recurring_withdraw_count,
    recurring_total_withdraw_count: donation.recurring_total_withdraw_count,
    recurring_total_withdraw_amount: donation.recurring_total_withdraw_amount,
    transaction__transaction_id: tx.transaction__transaction_id,
    transaction__provision_no: tx.transaction__provision_no,
    transaction__auth_code: tx.transaction__auth_code,
    transaction__reference_id: tx.transaction__reference_id,
    transaction__ip_address: tx.transaction__ip_address,
    transaction__bank_account__name: tx.transaction__bank_account__name,
    transaction__payment_settings__name: tx.transaction__payment_settings__name,
    fundraising_campaign__user_id: campaign?.user_id,
    fundraising_campaign__user__title: userName(
      store,
      campaign?.user_id ?? null,
    ),
    api_tracking_id: present(donation.api_tracking_id),
    news_via_phone: donation.news_via_phone,
    news_via_sms: donation.news_via_sms,
    news_via_email: donation.news_via_email,
    application_id: application?.id,
    application__title: application?.title,
    transaction__bin_number: tx.transaction__bin_number,
    transaction__receipt_no: tx.transaction__receipt_no,
    donor_type: donation.donor_type,
    amount_visible: donation.amount_visible,
    name_hidden: donation.name_hidden,
    message: donation.message,
    show_message: donation.show_message,
    referring_name: donation.referring_name,
    referring_email: donation.referring_email,
    referring_phone: donation.referring_phone,
    transaction__refund_date: tx.transaction__refund_date,
    transaction__transaction_error__code:
      tx.transaction__transaction_error__code,
    transaction__transaction_error__text:
      tx.transaction__transaction_error__text,
    transaction__transaction_error__group:
      tx.transaction__transaction_error__group,
    transaction__refunded_by_id: tx.transaction__refunded_by_id,
    updated_by_id: present(donation.updated_by_id),
    last_update_date: donation.last_update_date,
    recurring_cancel_reason: present(donation.recurring_cancel_reason),
    recurring_cancel_date: startOfDay(donation.recurring_cancel_date),
    recurring_start_date: present(donation.recurring_start_date),
    cancelled_by_id: present(donation.cancelled_by_id),
    cancelled_by__name: userName(store, donation.cancelled_by_id),
    marketing_channel__utm_source: channel?.utm_source,
    marketing_channel__utm_medium: channel?.utm_medium,
    marketing_channel__utm_campaign: channel?.utm_campaign,
    marketing_channel__utm_content: channel?.utm_content,
  };
}

function sentEmail(
  store: OrgStore,
  id: number | null,
): S["SentEmail"] | undefined {
  const mail = lookup(store.sentEmails, id);
  return (
    mail && {
      id: mail.id,
      message_id: String(mail.message_id),
      status: mail.status,
    }
  );
}

export function donationDetail(
  store: OrgStore,
  { donation, transaction }: DonationView,
): DonationDetail {
  const user = store.users.get(donation.user_id);
  const form = lookup(store.donationForms, donation.module_id);
  const application = lookup(store.applications, donation.application_id);
  const card = lookup(store.cardInfos, donation.card_info_id);
  return {
    id: donation.id,
    user: user && userReference(user),
    transaction: transactionDetail(store, transaction),
    d_type: donation.d_type,
    sub_donation_type_id: present(donation.sub_donation_type_id),
    donor_type: donation.donor_type,
    name: donation.name,
    phone: donation.phone,
    email: nonEmpty(donation.email),
    address: donation.address,
    birthday: nonEmpty(donation.birthday),
    city: donation.city,
    district: donation.district,
    details: donation.details,
    tckno: donation.tckno,
    news_via_phone: donation.news_via_phone,
    news_via_sms: donation.news_via_sms,
    news_via_email: donation.news_via_email,
    recurring_limit: present(donation.recurring_limit),
    recurring_withdrawal: donation.recurring_withdrawal,
    recurring_next_amount: present(donation.recurring_next_amount),
    recurring_error: present(donation.recurring_error),
    recurring_next_cycle: present(donation.recurring_next_cycle),
    recurring_last_success_withdrawal_date: present(
      donation.recurring_last_success_withdrawal_date,
    ),
    recurring_status: donation.recurring_status,
    recurring_cancel_date: present(donation.recurring_cancel_date),
    recurring_order_id: present(donation.recurring_order_id),
    recurring_withdraw_count: donation.recurring_withdraw_count,
    recurring_total_withdraw_count: donation.recurring_total_withdraw_count,
    recurring_total_withdraw_amount: donation.recurring_total_withdraw_amount,
    referring: donation.referring,
    referring_name: donation.referring_name,
    referring_phone: donation.referring_phone,
    referring_email: donation.referring_email,
    referring_address: donation.referring_address,
    referring_city: donation.referring_city,
    referring_district: donation.referring_district,
    recurring_cancel_reason: present(donation.recurring_cancel_reason),
    name_hidden: donation.name_hidden,
    amount_visible: donation.amount_visible,
    message: donation.message,
    show_message: donation.show_message,
    fundraising_campaign_id: present(donation.fundraising_campaign_id),
    fundraising_page_id: present(donation.fundraising_page_id),
    module_id: form?.id,
    module__name: form?.title,
    module__custom_parameters: form?.custom_parameters,
    custom_parameters: donation.custom_parameters,
    thanks_mail_id: present(donation.thanks_mail_id),
    application_id: application?.id,
    application__name: application?.title,
    api_tracking_id: present(donation.api_tracking_id),
    sent_mail: sentEmail(store, donation.sent_mail_id),
    sent_mail_to_referring: sentEmail(
      store,
      donation.sent_mail_to_referring_id,
    ),
    card_info: card?.display,
    added_by_id: present(donation.added_by_id),
    added_by__name: userName(store, donation.added_by_id),
    updated_by_id: present(donation.updated_by_id),
    updated_by__name: userName(store, donation.updated_by_id),
    last_update_date: donation.last_update_date,
  };
}
