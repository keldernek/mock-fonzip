import type { Row } from "../store/collection";
import type { SubscriptionRecord, UserRecord } from "../store/records";
import { createTransaction, type SeedContext } from "./context";
import {
  addDays,
  daysBeforeAnchor,
  istanbulDate,
  istanbulDateTime,
} from "./dates";
import type { SystemRefs } from "./system";

export function seedDues(
  ctx: SeedContext,
  system: SystemRefs,
  users: readonly Row<UserRecord>[],
): void {
  const { db, rng } = ctx;
  const [admin, secondAdmin = admin] = ctx.adminIds;
  const category = (name: string, daysAgo: number, deleted = false) =>
    db.debtCategories.insert({
      name,
      create_date: istanbulDateTime(daysBeforeAnchor(daysAgo)),
      created_by_id: admin,
      update_date: deleted
        ? istanbulDateTime(daysBeforeAnchor(daysAgo - 100))
        : null,
      updated_by_id: deleted ? secondAdmin : null,
      deleted,
    }).id;
  const dues2025 = category("Yıllık Aidat 2025", 700);
  const dues2026 = category("Yıllık Aidat 2026", 330);
  const entry = category("Giriş Ücreti", 900);
  category("Gala Katılım Bedeli", 60);
  category("Eski Aidat (kullanılmıyor)", 1500, true);
  db.debtAutomations.insert({
    title: "Yıllık aidat otomasyonu",
    debt_category_id: dues2026,
  });
  db.debtAutomations.insert({
    title: "Yeni üye giriş ücreti",
    debt_category_id: entry,
  });

  const members = users.slice(3, 123);
  for (const [index, user] of members.entries()) {
    let balance = 0;
    const base = (
      status: SubscriptionRecord["status"],
      amount: number,
      at: Date,
      period: string,
    ): Omit<SubscriptionRecord, "id"> => ({
      user_id: user.id,
      status,
      details: "",
      remove_note: null,
      operation_date: istanbulDateTime(at),
      period,
      balance,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      email: user.email,
      tckno: user.tckno,
      amount,
      assignment_status: 0,
      card_info: "",
      bill_no: null,
      due_date: istanbulDateTime(addDays(at, 30)),
      recurring: false,
      recurring_amount: 0,
      recurring_period: 0,
      recurring_collection_period: 0,
      recurring_withdrawal: false,
      recurring_next_cycle: null,
      order_id: null,
      added_by_id: admin,
      updated_by_id: null,
      create_date: istanbulDateTime(at),
      debt_category_id: null,
      transaction_id: null,
    });
    const recurringPayer = index % 12 === 3;
    const debt = (
      categoryId: number,
      amount: number,
      at: Date,
      period: string,
      outcome: "paid" | "open" | "removed",
    ) => {
      balance -= outcome === "removed" ? 0 : amount;
      db.subscriptions.insert({
        ...base(
          outcome === "paid" ? 8 : outcome === "open" ? 1 : 6,
          amount,
          at,
          period,
        ),
        debt_category_id: categoryId,
        details: `${period.slice(0, 4)} yılı aidatı`,
        remove_note:
          outcome === "removed" ? "Onursal üye, aidattan muaf" : null,
        assignment_status: outcome === "paid" ? 2 : 0,
        updated_by_id: outcome === "removed" ? secondAdmin : null,
      });
      if (outcome !== "paid") return;
      const paidAt = addDays(at, rng.int(1, 60));
      const method = recurringPayer ? 0 : rng.pick([0, 0, 2, 1] as const);
      const refunded = index % 40 === 11;
      const transaction = createTransaction(ctx, {
        amount,
        at: paidAt,
        status: refunded ? 4 : 3,
        method,
        paymentSettingsId: method === 0 ? system.cardSettingsIds[0] : null,
        bankAccountId: method === 2 ? system.tryBankAccountIds[0] : null,
      });
      balance += amount;
      db.subscriptions.insert({
        ...base(2, amount, paidAt, period),
        details: `${period.slice(0, 4)} aidat ödemesi`,
        assignment_status: 2,
        card_info: method === 0 ? `**** ${rng.digits(4)}` : "",
        bill_no: `AID-${rng.digits(6)}`,
        recurring: recurringPayer,
        recurring_amount: recurringPayer ? Math.round(amount / 12) : 0,
        recurring_period: recurringPayer ? 1 : 0,
        recurring_collection_period: recurringPayer ? 12 : 0,
        recurring_withdrawal: recurringPayer,
        recurring_next_cycle: recurringPayer
          ? istanbulDate(addDays(daysBeforeAnchor(0), 15))
          : null,
        order_id: recurringPayer ? `SUB-${rng.digits(8)}` : null,
        added_by_id: method === 0 ? null : admin,
        transaction_id: transaction.id,
        debt_category_id: null,
      });
      if (!refunded) return;
      balance -= amount;
      db.subscriptions.insert({
        ...base(4, amount, addDays(paidAt, 3), period),
        details: "Mükerrer ödeme iadesi",
        assignment_status: 3,
        transaction_id: transaction.id,
      });
    };
    const roll2025 = rng.next();
    debt(
      dues2025,
      1200,
      new Date("2025-01-15T10:00:00+03:00"),
      "2025-01-01",
      roll2025 < 0.8 ? "paid" : roll2025 < 0.95 ? "open" : "removed",
    );
    debt(
      dues2026,
      1500,
      new Date("2026-01-15T10:00:00+03:00"),
      "2026-01-01",
      rng.chance(0.55) ? "paid" : "open",
    );
    if (index % 15 === 0)
      debt(
        entry,
        500,
        daysBeforeAnchor(rng.int(30, 200)),
        "2026-01-01",
        "paid",
      );
    if (index === 5) {
      db.subscriptions.insert({
        ...base(7, 300, daysBeforeAnchor(50), "2026-01-01"),
        details: "Devir bakiyesi düzeltmesi",
        added_by_id: secondAdmin,
      });
    }
    if (index === 9 || index === 21) {
      db.subscriptions.insert({
        ...base(3, 1500, daysBeforeAnchor(80), "2026-01-01"),
        details: "Üyelikten ayrılma nedeniyle iptal",
      });
    }
  }
}

export function seedEvents(
  ctx: SeedContext,
  system: SystemRefs,
  users: readonly Row<UserRecord>[],
  tagIds: readonly number[],
): void {
  const { db, rng } = ctx;
  const [admin, secondAdmin = admin] = ctx.adminIds;
  const plans = [
    {
      name: "Mezunlar Gecesi 2026",
      startIn: 20,
      paid: true,
      active: true,
      archived: false,
      sales: 18,
      prices: [1500, 2500, 750],
    },
    {
      name: "Kariyer Buluşması",
      startIn: -40,
      paid: false,
      active: true,
      archived: false,
      sales: 10,
      prices: [0],
    },
    {
      name: "Burs Ödül Töreni",
      startIn: 45,
      paid: false,
      active: true,
      archived: false,
      sales: 0,
      prices: [0],
    },
    {
      name: "Boğaz Turu",
      startIn: -120,
      paid: true,
      active: true,
      archived: false,
      sales: 9,
      prices: [900, 450],
    },
    {
      name: "Online Söyleşi: Okul Tarihi",
      startIn: 5,
      paid: false,
      active: false,
      archived: false,
      sales: 0,
      prices: [0],
    },
    {
      name: "2025 Yılbaşı Balosu",
      startIn: -300,
      paid: true,
      active: false,
      archived: true,
      sales: 8,
      prices: [2000],
    },
  ] as const;
  for (const [order, plan] of plans.entries()) {
    const start = addDays(daysBeforeAnchor(0), plan.startIn);
    const created = addDays(start, -60);
    const slug = plan.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
    const event = db.events.insert({
      url: `https://kelder.example/etkinlik/${order + 1}-${slug}`,
      name: plan.name,
      start_date: istanbulDateTime(start),
      end_date: istanbulDateTime(new Date(start.getTime() + 4 * 3_600_000)),
      all_day: false,
      active: plan.active,
      timezone: "Europe/Istanbul",
      create_date: istanbulDateTime(created),
      created_by_id: admin,
      update_date:
        order % 2 === 0 ? istanbulDateTime(addDays(created, 10)) : null,
      updated_by_id: order % 2 === 0 ? secondAdmin : null,
      archived_by_id: plan.archived ? admin : null,
      archive_date: plan.archived ? istanbulDateTime(addDays(start, 30)) : null,
      venue: order === 4 ? 1 : 0,
      address:
        order === 4
          ? ""
          : "Kabataş Erkek Lisesi Konferans Salonu, Ortaköy/İstanbul",
      details: `${plan.name} için tüm mezunlarımızı bekliyoruz.`,
      paid_event: plan.paid,
      payment_settings_id: plan.paid ? system.cardSettingsIds[0] : null,
      image: `https://kelder.example/media/etkinlik/${order + 1}.jpg`,
      max_installment: plan.paid ? 3 : 1,
      send_reminder: plan.startIn > 0,
      ask_billing_info: plan.paid,
      location: order === 4 ? 1 : 0,
      sender_account_id: plan.paid ? system.tryBankAccountIds[0] : null,
    });
    const tickets = plan.prices.map((price, ticketOrder) =>
      db.tickets.insert({
        event_id: event.id,
        title:
          price === 0
            ? "Ücretsiz Katılım"
            : (["Standart", "VIP", "Öğrenci"][ticketOrder] ?? "Standart"),
        quantity: price === 0 ? 300 : 120,
        price,
        ticket_type: price === 0 ? "free" : "paid",
        details: price === 0 ? "Kayıt zorunludur." : "Akşam yemeği dahildir.",
        post_sale_message: "Biletiniz e-posta adresinize gönderildi.",
        sales_start_on_date: true,
        sales_start: istanbulDateTime(created),
        sales_end_on_date: true,
        sales_end: istanbulDateTime(start),
        max_per_person: price === 0 ? 1 : 4,
        order: ticketOrder + 1,
        tag_control: ticketOrder === 1 ? 1 : 0,
        tags_to_control: ticketOrder === 1 ? tagIds.slice(2, 3) : [],
        member_with_no_debt: ticketOrder === 2,
        related_with_no_debt: false,
      }),
    );
    for (let sale = 0; sale < plan.sales; sale += 1) {
      const buyer = users[20 + ((order * 17 + sale * 5) % 120)];
      const ticket = tickets[sale % tickets.length];
      if (!buyer || !ticket) continue;
      const count = ticket.price === 0 ? 1 : rng.int(1, 3);
      const status = !plan.paid
        ? 3
        : sale % 9 === 4
          ? 4
          : sale % 9 === 7
            ? 5
            : 3;
      const transaction = createTransaction(ctx, {
        amount: ticket.price * count,
        at: addDays(created, rng.int(1, 55)),
        status,
        method: plan.paid ? 0 : 1,
        paymentSettingsId: plan.paid ? system.cardSettingsIds[0] : null,
        bankAccountId: null,
        installments: plan.paid && count > 2 ? 3 : 1,
      });
      const member = sale % 6 !== 5;
      const saleRow = db.ticketSales.insert({
        event_id: event.id,
        transaction_id: transaction.id,
        user_id: member ? buyer.id : null,
        name: `${buyer.first_name} ${buyer.last_name}`.trim(),
        phone: buyer.phone,
        email: buyer.email,
        address: buyer.address,
        city: buyer.city_text,
        district: buyer.district_text,
        post_code: buyer.post_code,
        details: count > 1 ? "Eşimle birlikte katılacağım." : "",
        sent_mail_id:
          status === 3
            ? db.sentEmails.insert({
                message_id: rng.int(1_000_000, 9_999_999),
                status: 2,
              }).id
            : null,
      });
      for (let seat = 0; seat < count; seat += 1) {
        db.soldTickets.insert({
          ticket_sale_id: saleRow.id,
          ticket_id: ticket.id,
          attendee_name: seat === 0 ? saleRow.name : `Misafir ${seat}`,
        });
      }
    }
  }
}
