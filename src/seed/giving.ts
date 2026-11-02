import type { Row } from "../store/collection";
import type {
  DonationRecord,
  PaymentMethod,
  UserRecord,
} from "../store/records";
import type { PaymentStatus } from "../store/reference";
import { TRANSACTION_TYPE } from "../store/transactions";
import type { CampaignRefs } from "./campaigns";
import {
  createTransaction,
  tryAmount,
  weightedStatus,
  type SeedContext,
} from "./context";
import { addDays, daysBeforeAnchor, istanbulDate, apiDateTime } from "./dates";
import type { SystemRefs } from "./system";

export const DONATION_COUNT = 300;
export const MICRO_DONATION_COUNT = 30;
export const MONTHLY_SERIES_COUNT = 18;

export interface GivingCatalog {
  readonly categoryIds: readonly [number, ...number[]];
  readonly scholarshipCategoryId: number;
  readonly pageIds: readonly [number, ...number[]];
  readonly formIds: readonly [number, ...number[]];
}

export function seedGivingCatalog(
  ctx: SeedContext,
  system: SystemRefs,
): GivingCatalog {
  const { db } = ctx;
  const [admin, secondAdmin = admin] = ctx.adminIds;
  const audit = (daysAgo: number, updated: boolean) => ({
    create_date: apiDateTime(daysBeforeAnchor(daysAgo)),
    created_by_id: admin,
    update_date: updated
      ? apiDateTime(daysBeforeAnchor(Math.floor(daysAgo / 2)))
      : null,
    updated_by_id: updated ? secondAdmin : null,
  });
  const categories = [
    ["Genel Bağış", true],
    ["Burs Fonu", true],
    ["Zekat", true],
    ["Kurban", true],
    ["Okul Onarım", true],
    ["Kütüphane", true],
    ["Spor Kulübü", true],
    ["Deprem Dayanışma (kapandı)", false],
  ] as const;
  const categoryIds = categories.map(
    ([name, active], index) =>
      db.donationCategories.insert({
        name,
        active,
        ...audit(800 - index * 40, index % 2 === 0),
      }).id,
  );
  const category = (index: number): number | null => categoryIds[index] ?? null;
  const [iyzico, vpos = iyzico] = system.cardSettingsIds;
  const pages = [
    ["Burs Fonuna Bağış", "burs-fonu", category(1), iyzico],
    ["Okulumuz İçin", "okulumuz-icin", category(4), vpos],
    ["Kurban Bağışı", "kurban", category(3), iyzico],
    ["Zekat", "zekat", category(2), null],
  ] as const;
  const pageIds = pages.map(
    ([title, slug, categoryId, settingsId], index) =>
      db.donationPages.insert({
        order: index + 1,
        title,
        url: `https://kelder.example/bagis/${slug}`,
        active: index !== 3,
        listing: index < 2,
        category_id: categoryId,
        payment_settings_id: settingsId,
        ...audit(700 - index * 50, index === 0),
      }).id,
  );
  const forms = [
    ["Web Sitesi Bağış Formu", 3, null, iyzico],
    ["Mobil Uygulama Formu", 2, category(0), vpos],
    ["Gala Gecesi Formu", 1, category(0), iyzico],
  ] as const;
  const formIds = forms.map(
    ([title, version, categoryId, settingsId], index) =>
      db.donationForms.insert({
        order: index + 1,
        title,
        api_url: `https://fonzip.com/api/v2/form/kelder-${index + 1}`,
        live: index !== 2,
        version,
        category_id: categoryId,
        payment_settings_id: settingsId,
        custom_parameters: index === 0 ? { kaynak: "web", dil: "tr" } : {},
        ...audit(650 - index * 60, index !== 1),
      }).id,
  );
  const [scholarship] = categoryIds.slice(1);
  if (scholarship === undefined) throw new Error("no scholarship category");
  const [firstCategory, ...restCategories] = categoryIds;
  const [firstPage, ...restPages] = pageIds;
  const [firstForm, ...restForms] = formIds;
  if (
    firstCategory === undefined ||
    firstPage === undefined ||
    firstForm === undefined
  ) {
    throw new Error("giving catalog is empty");
  }
  return {
    categoryIds: [firstCategory, ...restCategories],
    scholarshipCategoryId: scholarship,
    pageIds: [firstPage, ...restPages],
    formIds: [firstForm, ...restForms],
  };
}

interface DonationPlan {
  readonly user: Row<UserRecord>;
  readonly at: Date;
  readonly amount: number;
  readonly status: PaymentStatus;
  readonly method: PaymentMethod;
  readonly monthly: {
    readonly parentId: number | null;
    readonly orderId: string;
    readonly status: 0 | 1 | 2 | 3 | 4;
    readonly cardInfoId: number;
  } | null;
  readonly micro: boolean;
}

export function seedDonations(
  ctx: SeedContext,
  system: SystemRefs,
  catalog: GivingCatalog,
  campaigns: CampaignRefs,
  users: readonly Row<UserRecord>[],
): void {
  const { db, rng } = ctx;
  const donors = users.slice(3);
  const pickDonor = (): Row<UserRecord> => {
    const donor = rng.pickFrom(donors);
    if (!donor) throw new Error("no donors");
    return donor;
  };

  const insertDonation = (plan: DonationPlan): Row<DonationRecord> => {
    const { user } = plan;
    const card = plan.method === 0;
    const transaction = createTransaction(ctx, {
      amount: plan.amount,
      at: plan.at,
      status: plan.status,
      method: plan.method,
      paymentSettingsId: card ? rng.pick(system.cardSettingsIds) : null,
      bankAccountId:
        plan.method === 2 ? rng.pick(system.tryBankAccountIds) : null,
      installments: card && plan.amount >= 2500 ? 3 : 1,
      type: TRANSACTION_TYPE.donation,
    });
    const online = card && !plan.micro;
    const sentMail =
      plan.status === 3 && online
        ? db.sentEmails.insert({
            message_id: rng.int(1_000_000, 9_999_999),
            status: rng.pick([2, 3, 4]),
          }).id
        : null;
    const referring = !plan.micro && rng.chance(0.08);
    const referralMail =
      referring && plan.status === 3
        ? db.sentEmails.insert({
            message_id: rng.int(1_000_000, 9_999_999),
            status: 2,
          }).id
        : null;
    const viaApi = !plan.micro && online && rng.chance(0.15);
    const campaignId =
      !plan.micro && plan.monthly === null && rng.chance(0.25)
        ? rng.pick(campaigns.activeCampaignIds)
        : null;
    const pageId =
      !plan.micro && campaignId === null && rng.chance(0.6)
        ? rng.pick(catalog.pageIds)
        : null;
    const manual = plan.method === 1 || plan.method === 3;
    const cancelled = plan.monthly?.status === 3;
    const monthlyParent =
      plan.monthly !== null && plan.monthly.parentId === null;
    const name = `${user.first_name} ${user.last_name}`.trim();
    return (plan.micro ? db.microDonations : db.donations).insert({
      user_id: user.id,
      recurring_status: plan.monthly?.status ?? 0,
      d_type: plan.method === 1 && rng.chance(0.3) ? 1 : 0,
      email: user.email,
      details: manual ? "Elden teslim alındı" : "",
      name,
      address: user.address,
      city: user.city_text,
      district: user.district_text,
      sub_donation_type_id: plan.micro
        ? catalog.categoryIds[0]
        : rng.chance(0.9)
          ? rng.pick(catalog.categoryIds)
          : null,
      birthday: user.birthday,
      sent_mail_id: sentMail,
      sent_mail_to_referring_id: referralMail,
      fundraising_campaign_id: campaignId,
      tckno: user.tckno,
      phone: user.phone,
      fundraising_page_id: pageId,
      module_id: pageId === null && !manual ? rng.pick(catalog.formIds) : null,
      added_by_id: manual ? rng.pick(ctx.adminIds) : null,
      f2f_group_id: plan.method === 3 ? rng.pick(system.f2fGroupIds) : null,
      recurring_order_id: plan.monthly?.orderId ?? null,
      recurring_withdraw_count: 0,
      recurring_total_withdraw_count: 0,
      recurring_total_withdraw_amount: 0,
      api_tracking_id: viaApi ? `trk-${rng.hex(12)}` : null,
      news_via_phone: rng.chance(0.4),
      news_via_sms: rng.chance(0.5),
      news_via_email: rng.chance(0.8),
      application_id: viaApi
        ? system.applicationIds.api
        : online
          ? null
          : system.applicationIds.console,
      donor_type: user.corporate_type ? "corporate" : "personal",
      amount_visible: !rng.chance(0.2),
      name_hidden: rng.chance(0.1),
      message:
        campaignId !== null && rng.chance(0.5)
          ? "Başarılar dilerim, iyi ki varsınız!"
          : null,
      show_message: campaignId !== null,
      referring_name: referring ? "Selin Aydın" : "",
      referring_email: referring ? "selin.aydin@eposta.example" : "",
      referring_phone: referring ? "+905321112233" : "",
      updated_by_id: manual ? rng.pick(ctx.adminIds) : null,
      last_update_date: apiDateTime(plan.at),
      recurring_cancel_reason:
        cancelled && monthlyParent ? "Bütçe nedeniyle iptal" : null,
      recurring_cancel_date:
        cancelled && monthlyParent ? istanbulDate(addDays(plan.at, 120)) : null,
      recurring_start_date: monthlyParent ? apiDateTime(plan.at) : null,
      cancelled_by_id: cancelled && monthlyParent ? ctx.adminIds[0] : null,
      recurring_limit: monthlyParent ? rng.pick([0, 12, 24]) : null,
      recurring_withdrawal: plan.monthly !== null && !monthlyParent,
      recurring_next_amount:
        monthlyParent && plan.monthly?.status === 1 ? plan.amount : null,
      recurring_error:
        plan.monthly?.status === 2 && monthlyParent ? "Yetersiz bakiye" : null,
      recurring_next_cycle:
        monthlyParent &&
        (plan.monthly?.status === 1 || plan.monthly?.status === 4)
          ? istanbulDate(addDays(daysBeforeAnchor(0), rng.int(1, 28)))
          : null,
      recurring_last_success_withdrawal_date: monthlyParent
        ? istanbulDate(plan.at)
        : null,
      referring,
      referring_address: referring ? "Nispetiye Cad. No:12" : "",
      referring_city: referring ? "İstanbul" : "",
      referring_district: referring ? "Beşiktaş" : "",
      custom_parameters: viaApi ? { kanal: "entegrasyon" } : {},
      thanks_mail_id: online ? system.templateIds.donationThanks : null,
      transaction_id: transaction.id,
      marketing_channel_id:
        online && rng.chance(0.4) ? rng.pick(system.marketingChannelIds) : null,
      card_info_id: plan.monthly?.cardInfoId ?? null,
      monthly_donation_id: plan.monthly?.parentId ?? null,
    });
  };

  const monthlyStatuses = [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 3, 3, 4, 1, 1,
  ] as const;
  let created = 0;
  for (let series = 0; series < MONTHLY_SERIES_COUNT; series += 1) {
    const user = pickDonor();
    const status = monthlyStatuses[series] ?? 1;
    const card = db.cardInfos.insert({
      user_id: user.id,
      bin_number: rng.pick(["454360", "540667", "979203"]),
      last_four: rng.digits(4),
      display: "",
    });
    db.cardInfos.update(card.id, {
      display: `${card.bin_number.slice(0, 4)} ${card.bin_number.slice(4)}** **** ${card.last_four}`,
    });
    const amount = rng.pick([100, 150, 200, 250, 500, 1000]);
    const withdrawals = status === 4 ? 1 : rng.int(3, 8);
    const start = daysBeforeAnchor(withdrawals * 30 + rng.int(0, 20));
    const orderId = `RO-${rng.digits(8)}`;
    const parent = insertDonation({
      user,
      at: start,
      amount,
      status: status === 4 ? 0 : 3,
      method: 0,
      monthly: { parentId: null, orderId, status, cardInfoId: card.id },
      micro: false,
    });
    created += 1;
    let successful = 1;
    for (let cycle = 1; cycle < withdrawals; cycle += 1) {
      const failed = status === 2 && cycle === withdrawals - 1;
      insertDonation({
        user,
        at: addDays(start, cycle * 30),
        amount,
        status: failed ? 5 : 3,
        method: 0,
        monthly: { parentId: parent.id, orderId, status, cardInfoId: card.id },
        micro: false,
      });
      created += 1;
      if (!failed) successful += 1;
    }
    db.donations.update(parent.id, {
      recurring_withdraw_count: successful,
      recurring_total_withdraw_count: withdrawals,
      recurring_total_withdraw_amount: successful * amount,
    });
  }

  const methods: readonly [PaymentMethod, ...PaymentMethod[]] = [
    0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 1, 3,
  ];
  for (; created < DONATION_COUNT; created += 1) {
    const method = rng.pick(methods);
    insertDonation({
      user: pickDonor(),
      at: daysBeforeAnchor(rng.int(0, 365), rng.int(0, 1200)),
      amount: tryAmount(rng),
      status: method === 0 ? weightedStatus(rng) : rng.chance(0.06) ? 4 : 3,
      method,
      monthly: null,
      micro: false,
    });
  }

  for (let index = 0; index < MICRO_DONATION_COUNT; index += 1) {
    insertDonation({
      user: pickDonor(),
      at: daysBeforeAnchor(rng.int(0, 180), rng.int(0, 1200)),
      amount: rng.pick([5, 10, 15, 20, 25, 50]),
      status: index % 10 === 9 ? 4 : index % 10 === 8 ? 5 : 3,
      method: 0,
      monthly: null,
      micro: true,
    });
  }

  const parents = db.donations.list(
    (row) =>
      row.recurring_order_id !== null &&
      row.monthly_donation_id === null &&
      row.recurring_status === 1,
  );
  const requests: [number, 0 | 1, 0 | 1 | 2 | 3 | 4, string][] = [
    [0, 0, 0, "Taşınıyorum, bağışımı durdurmak istiyorum"],
    [1, 1, 0, "750"],
    [2, 1, 4, "2000"],
    [3, 1, 3, "300"],
  ];
  for (const [index, type, status, value] of requests) {
    const parent = parents[index];
    if (!parent) continue;
    db.monthlyDonationRequests.insert({
      donation_id: parent.id,
      user_id: parent.user_id,
      request_type: type,
      status,
      value,
      create_date: apiDateTime(daysBeforeAnchor(10 - index * 2)),
      response_date:
        status === 0 ? null : apiDateTime(daysBeforeAnchor(9 - index * 2)),
    });
  }
}

export function seedMicroDonationVariety(
  ctx: SeedContext,
  system: SystemRefs,
  catalog: GivingCatalog,
  campaigns: CampaignRefs,
): void {
  const { db } = ctx;
  const [admin, secondAdmin = admin] = ctx.adminIds;
  const [online, onPage, transfer, faceToFace, monthly] =
    db.microDonations.list();
  if (!online || !onPage || !transfer || !faceToFace || !monthly) {
    throw new Error("too few micro donations to vary");
  }
  const mail = (messageId: number, status: 1 | 2) =>
    db.sentEmails.insert({ message_id: messageId, status }).id;
  const notCard = {
    payment_settings_id: null,
    fonzip_framework: false,
    bin_number: null,
    last_four: null,
    provision_no: null,
    auth_code: null,
    transaction_id: "",
  };
  db.microDonations.update(online.id, {
    fundraising_campaign_id: campaigns.activeCampaignIds[0],
    message: "Küçük ama gönülden!",
    show_message: true,
    referring: true,
    referring_name: "Selin Aydın",
    referring_email: "selin.aydin@eposta.example",
    referring_phone: "+905321112233",
    referring_address: "Nispetiye Cad. No:12",
    referring_city: "İstanbul",
    referring_district: "Beşiktaş",
    sent_mail_id: mail(7_100_001, 2),
    sent_mail_to_referring_id: mail(7_100_002, 1),
    thanks_mail_id: system.templateIds.donationThanks,
    marketing_channel_id: system.marketingChannelIds[0],
    api_tracking_id: "trk-mikro-000001",
    application_id: system.applicationIds.api,
  });
  db.microDonations.update(onPage.id, {
    fundraising_page_id: catalog.pageIds[0],
    module_id: null,
  });
  db.microDonations.update(transfer.id, {
    module_id: null,
    details: "Havale ile gönderildi",
    added_by_id: admin,
    updated_by_id: secondAdmin,
  });
  db.transactions.update(transfer.transaction_id, {
    ...notCard,
    payment_method: 2,
    bank_account_id: system.tryBankAccountIds[0],
  });
  db.microDonations.update(faceToFace.id, {
    module_id: null,
    f2f_group_id: system.f2fGroupIds[0],
    added_by_id: admin,
  });
  db.transactions.update(faceToFace.transaction_id, {
    ...notCard,
    payment_method: 3,
  });
  const started = db.transactions.get(monthly.transaction_id)?.complete_date;
  db.microDonations.update(monthly.id, {
    recurring_status: 3,
    recurring_order_id: "RO-MIKRO-0001",
    recurring_start_date: started ?? null,
    recurring_cancel_reason: "Bağışçının talebi",
    recurring_cancel_date: istanbulDate(daysBeforeAnchor(1)),
    cancelled_by_id: admin,
    recurring_limit: 12,
  });
}
