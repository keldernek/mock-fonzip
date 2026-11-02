import type { Row } from "../store/collection";
import type { TimelineRecord, UserRecord } from "../store/records";
import { currencyById } from "../store/reference";
import type { SeedContext } from "./context";
import { daysBeforeAnchor, istanbulDateTime } from "./dates";
import { iban } from "./identity";
import { BANKS } from "./names";
import type { SystemRefs } from "./system";

export function seedBankTransactions(
  ctx: SeedContext,
  system: SystemRefs,
): void {
  const { db, rng } = ctx;
  const wire = (transactionId: number | null): boolean => {
    const transaction =
      transactionId === null ? undefined : db.transactions.get(transactionId);
    return (
      transaction?.payment_method === 2 && transaction.payment_status === 3
    );
  };
  const record = (input: {
    accountId: number;
    amount: number;
    at: string;
    status: 3 | 8 | 9;
    type: 1 | 2 | 4 | null;
    userId: number | null;
    sender: string;
    description: string;
    donationId?: number;
    subscriptionId?: number;
    ecardSaleId?: number;
  }) => {
    const account = db.bankAccounts.get(input.accountId);
    db.bankTransactions.insert({
      bank_account_id: input.accountId,
      amount: input.amount,
      currency_code: currencyById(account?.currency_id ?? 1).iso_code,
      complete_date: input.at,
      payment_status: input.status,
      transaction_type: input.type,
      counterparty_name: input.sender,
      counterparty_iban: rng.chance(0.2)
        ? `TR** **** **** ${rng.digits(4)}`
        : iban(rng),
      counterparty_vkn: rng.chance(0.5) ? rng.digits(11) : null,
      counterparty_bank: rng.pick(BANKS),
      description: input.description,
      reference: `REF${rng.digits(12)}`,
      bank_transaction_type: rng.pick(["EFT", "FAST", "HAVALE"]),
      sequence_no: rng.digits(6),
      provider: rng.pick(["isbank-api", "ziraat-mt940"]),
      matched_user_id: input.userId,
      matched_donation_id: input.donationId ?? null,
      matched_subscription_id: input.subscriptionId ?? null,
      matched_certificate_sale_id: input.ecardSaleId ?? null,
    });
  };
  const userName = (userId: number | null): string => {
    const user = userId === null ? undefined : db.users.get(userId);
    return user
      ? `${user.first_name} ${user.last_name}`.trim().toLocaleUpperCase("tr-TR")
      : "BİLİNMEYEN GÖNDERİCİ";
  };
  for (const donation of db.donations.list((row) => wire(row.transaction_id))) {
    const transaction = db.transactions.get(donation.transaction_id);
    if (!transaction) continue;
    record({
      accountId: transaction.bank_account_id ?? system.tryBankAccountIds[0],
      amount: transaction.amount,
      at: transaction.complete_date,
      status: 3,
      type: 1,
      userId: donation.user_id,
      sender: userName(donation.user_id),
      description: "BAĞIŞ",
      donationId: donation.id,
    });
  }
  for (const payment of db.subscriptions.list(
    (row) => row.status === 2 && wire(row.transaction_id),
  )) {
    const transaction =
      payment.transaction_id === null
        ? undefined
        : db.transactions.get(payment.transaction_id);
    if (!transaction) continue;
    record({
      accountId: system.tryBankAccountIds[0],
      amount: transaction.amount,
      at: transaction.complete_date,
      status: 3,
      type: 2,
      userId: payment.user_id,
      sender: userName(payment.user_id),
      description: `${(payment.period ?? payment.operation_date).slice(0, 4)} AIDAT`,
      subscriptionId: payment.id,
    });
  }
  for (const sale of db.ecardTransactions.list((row) =>
    wire(row.transaction_id),
  )) {
    const transaction = db.transactions.get(sale.transaction_id);
    if (!transaction) continue;
    record({
      accountId: system.tryBankAccountIds[0],
      amount: transaction.amount,
      at: transaction.complete_date,
      status: 3,
      type: 4,
      userId: sale.user_id,
      sender: userName(sale.user_id),
      description: "E-KART",
      ecardSaleId: sale.id,
    });
  }
  for (let index = 0; index < 12; index += 1) {
    const waiting = index < 8;
    record({
      accountId:
        index === 3
          ? system.usdBankAccountId
          : rng.pick(system.tryBankAccountIds),
      amount: index === 3 ? 250 : rng.pick([300, 500, 1000, 1500, 2000]),
      at: istanbulDateTime(daysBeforeAnchor(rng.int(0, 20), rng.int(0, 900))),
      status: waiting ? 8 : 9,
      type: null,
      userId: null,
      sender: waiting
        ? userName(null)
        : rng.pick(["KİRA ÖDEMESİ", "İADE - TEDARİKÇİ", "HATALI GÖNDERİM"]),
      description: waiting
        ? rng.pick(["bagis", "burs icin", "Aidat 2026", "KELDER"])
        : "Derneğe ait olmayan ödeme",
    });
  }
}

export function seedTimeline(
  ctx: SeedContext,
  users: readonly Row<UserRecord>[],
): void {
  const { db, rng } = ctx;
  const entry = (
    userId: number,
    eventType: TimelineRecord["event_type"],
    at: string,
    details: string,
    extra: Partial<Omit<TimelineRecord, "id" | "user_id">> = {},
  ) =>
    db.timeline.insert({
      user_id: userId,
      details,
      event_time: at,
      event_type: eventType,
      tag_id: null,
      custom_date: false,
      lead_type: null,
      outcome: null,
      sequence_no: null,
      is_first_touch: null,
      amount: null,
      issuer_id: null,
      currency_id: null,
      added_by_id: null,
      calendar_event: null,
      ...extra,
    });
  const tagIds = db.tags.list().map((tag) => tag.id);
  for (const [index, user] of users.slice(3, 40).entries()) {
    const at = daysBeforeAnchor(rng.int(1, 200));
    entry(
      user.id,
      7,
      istanbulDateTime(at),
      "Telefonla görüşüldü, burs programı hakkında bilgi verildi.",
      {
        issuer_id: ctx.adminIds[index % ctx.adminIds.length] ?? ctx.adminIds[0],
        custom_date: index % 4 === 0,
        tag_id:
          index % 3 === 1 ? (tagIds[index % tagIds.length] ?? null) : null,
        calendar_event:
          index % 3 === 0
            ? {
                id: 9000 + index,
                note: "Geri arama yapılacak",
                date: istanbulDateTime(daysBeforeAnchor(-rng.int(1, 14))),
                completed: index % 2 === 0,
              }
            : null,
      },
    );
    const leads = Array.from({ length: (index % 3) + 1 }, () => {
      const outcome = rng.pick([0, 1, 2, 3, 4] as const);
      const paid = outcome !== 0 && outcome !== 2;
      return {
        at: istanbulDateTime(daysBeforeAnchor(rng.int(1, 300))),
        lead_type: rng.pick([0, 1, 2, 3, 4, 5, 10] as const),
        outcome,
        amount: paid ? rng.pick([100, 250, 500]) : null,
      };
    }).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    for (const [position, lead] of leads.entries()) {
      entry(user.id, 27, lead.at, "Temas noktası", {
        lead_type: lead.lead_type,
        outcome: lead.outcome,
        sequence_no: position + 1,
        is_first_touch: position === 0,
        amount: lead.amount,
        currency_id: lead.amount === null ? null : 1,
        added_by_id: index % 4 === 2 ? ctx.adminIds[0] : null,
      });
    }
  }
  const channels = [
    ["allow_comm_via_phone", 18, 21, "Telefon"],
    ["allow_comm_via_sms", 19, 22, "SMS"],
    ["allow_comm_via_email", 20, 23, "E-posta"],
  ] as const;
  for (const permission of db.communicationPermissions.list()) {
    if (permission.user_id === null) continue;
    for (const [field, granted, revoked, label] of channels) {
      const allowed = permission[field];
      entry(
        permission.user_id,
        allowed ? granted : revoked,
        permission[`${field}_date`],
        `${label} ile iletişim izni ${allowed ? "verildi" : "geri alındı"}`,
      );
    }
  }
}

export function settleTotals(ctx: SeedContext): void {
  const { db } = ctx;
  const totals = new Map<number, number>();
  const add = (userId: number, transactionId: number | null): void => {
    const transaction =
      transactionId === null ? undefined : db.transactions.get(transactionId);
    if (transaction?.payment_status !== 3) return;
    totals.set(
      userId,
      (totals.get(userId) ?? 0) +
        transaction.amount * currencyById(transaction.currency_id).value,
    );
  };
  for (const donation of db.donations.list())
    add(donation.user_id, donation.transaction_id);
  for (const donation of db.microDonations.list())
    add(donation.user_id, donation.transaction_id);
  for (const payment of db.subscriptions.list((row) => row.status === 2))
    add(payment.user_id, payment.transaction_id);
  for (const [userId, total] of totals) {
    db.users.update(userId, { total_financial: Math.round(total * 100) / 100 });
  }
}
