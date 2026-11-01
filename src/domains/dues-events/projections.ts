import type { Row } from "../../store/collection";
import { fullName, present, userName } from "../../store/joins";
import type {
  DebtCategoryRecord,
  EventRecord,
  TicketRecord,
  TransactionRecord,
  UserRecord,
} from "../../store/records";
import { currencyById, type PaymentStatus } from "../../store/reference";
import type { OrgStore } from "../../store/store";

export function toTransaction(store: OrgStore, tx: Row<TransactionRecord>) {
  const settings =
    tx.payment_settings_id === null
      ? undefined
      : store.paymentSettings.get(tx.payment_settings_id);
  const account =
    tx.bank_account_id === null
      ? undefined
      : store.bankAccounts.get(tx.bank_account_id);
  return {
    id: tx.id,
    conversation_id: tx.conversation_id,
    complete_date: tx.complete_date,
    amount: tx.amount,
    currency: currencyById(tx.currency_id),
    installment_count: tx.installment_count,
    installment_amount: tx.installment_amount,
    ip_address: tx.ip_address,
    payment_status: tx.payment_status,
    payment_status_display: tx.payment_status_display,
    error_code: present(tx.error_code),
    error_text: present(tx.error_text),
    refund_date: present(tx.refund_date),
    fonzip_id: tx.fonzip_id,
    fonzip_id_hashed: tx.fonzip_id_hashed,
    transaction_id: tx.transaction_id,
    provision_no: present(tx.provision_no),
    receipt_no: tx.receipt_no,
    auth_code: present(tx.auth_code),
    reference_id: tx.reference_id,
    order_id: tx.order_id,
    payment_settings_id: present(tx.payment_settings_id),
    payment_settings: settings && {
      id: settings.id,
      name: settings.name,
      provider_no: settings.provider_no,
      status: settings.status,
      business_account: settings.business_account,
    },
    bank_account_id: present(tx.bank_account_id),
    bank_account: account && {
      id: account.id,
      name: account.name,
      currency_id: account.currency_id,
    },
    payment_method: tx.payment_method,
    refunded_by_id: present(tx.refunded_by_id),
    refunded_by__name: userName(store, tx.refunded_by_id),
    refund_reason: present(tx.refund_reason),
    fonzip_framework: tx.fonzip_framework,
    bin_number: present(tx.bin_number),
    last_four: present(tx.last_four),
  };
}

const PAYMENT_STATUSES: readonly PaymentStatus[] = [0, 1, 2, 3, 4, 5, 6];

export function paymentStatus(value: number): PaymentStatus | undefined {
  return PAYMENT_STATUSES.find((status) => status === value);
}

export function transactionOf(
  store: OrgStore,
  transactionId: number | null,
): Row<TransactionRecord> | undefined {
  return transactionId === null
    ? undefined
    : store.transactions.get(transactionId);
}

export function toUserReference(user: Row<UserRecord>) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    name: fullName(user),
    first_name: user.first_name,
    last_name: user.last_name,
    tckno: user.tckno,
    profile_pic: present(user.profile_pic),
    corporate_type: user.corporate_type,
    membership_no: user.membership_no,
  };
}

function nonEmpty(value: string): string | undefined {
  return value === "" ? undefined : value;
}

export function toUserDetails(store: OrgStore, user: Row<UserRecord>) {
  const permission = store.communicationPermissions.find(
    (row) => row.user_id === user.id,
  );
  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    name: fullName(user),
    nationality_text: user.nationality_text,
    tckno: user.tckno,
    birthday: nonEmpty(user.birthday),
    email: user.email,
    phone: user.phone,
    home_phone_first: user.home_phone_first,
    address: user.address,
    post_code: user.post_code,
    district_text: user.district_text,
    city_text: user.city_text,
    country_text: user.country_text,
    work_phone: user.work_phone,
    work_address: user.work_address,
    work_post_code: user.work_post_code,
    private: user.private,
    work_district_text: user.work_district_text,
    work_city_text: user.work_city_text,
    work_country_text: user.work_country_text,
    email_second: nonEmpty(user.email_second),
    membership_no: user.membership_no,
    admin: user.admin,
    corporate_type: user.corporate_type,
    apply_date: user.apply_date,
    allow_comm_via_phone: permission?.allow_comm_via_phone,
    allow_comm_via_phone_date: permission?.allow_comm_via_phone_date,
    allow_comm_via_sms: permission?.allow_comm_via_sms,
    allow_comm_via_sms_date: permission?.allow_comm_via_sms_date,
    allow_comm_via_email: permission?.allow_comm_via_email,
    allow_comm_via_email_date: permission?.allow_comm_via_email_date,
    join_date: user.join_date,
    total_financial: user.total_financial,
  };
}

export function toDebtCategory(category: Row<DebtCategoryRecord>) {
  return { id: category.id, name: category.name, deleted: category.deleted };
}

export function soldCount(store: OrgStore, ticketId: number): number {
  return store.soldTickets.count((seat) => {
    if (seat.ticket_id !== ticketId) return false;
    const sale = store.ticketSales.get(seat.ticket_sale_id);
    return (
      sale !== undefined &&
      store.transactions.get(sale.transaction_id)?.payment_status === 3
    );
  });
}

export function toTicket(store: OrgStore, ticket: Row<TicketRecord>) {
  return {
    id: ticket.id,
    title: ticket.title,
    sold: soldCount(store, ticket.id),
    quantity: ticket.quantity,
    price: ticket.price,
    ticket_type: ticket.ticket_type,
    details: ticket.details,
    post_sale_message: ticket.post_sale_message,
    sales_start_on_date: ticket.sales_start_on_date,
    sales_start: present(ticket.sales_start),
    sales_end_on_date: ticket.sales_end_on_date,
    sales_end: present(ticket.sales_end),
    max_per_person: ticket.max_per_person,
    order: ticket.order,
    tag_control: ticket.tag_control,
    tags_to_control: ticket.tags_to_control,
    member_with_no_debt: ticket.member_with_no_debt,
    related_with_no_debt: ticket.related_with_no_debt,
  };
}

export function ticketsOf(store: OrgStore, eventId: number) {
  return store.tickets
    .list((ticket) => ticket.event_id === eventId)
    .sort((a, b) => a.order - b.order || a.id - b.id);
}

export function toEvent(store: OrgStore, event: Row<EventRecord>) {
  return {
    id: event.id,
    name: event.name,
    url: event.url,
    venue: event.venue,
    address: event.address,
    details: event.details,
    paid_event: event.paid_event,
    payment_settings_id: present(event.payment_settings_id),
    image: nonEmpty(event.image),
    start_date: event.start_date,
    all_day: event.all_day,
    end_date: event.end_date,
    ticket_types: ticketsOf(store, event.id).map((ticket) =>
      toTicket(store, ticket),
    ),
    active: event.active,
    max_installment: event.max_installment,
    send_reminder: event.send_reminder,
    ask_billing_info: event.ask_billing_info,
    location: event.location,
    sender_account_id: present(event.sender_account_id),
  };
}
