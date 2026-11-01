import { istanbulDateTime, daysBeforeAnchor } from "./dates";
import type { SeedContext } from "./context";
import { iban } from "./identity";

export interface SystemRefs {
  readonly cardSettingsIds: readonly [number, ...number[]];
  readonly tryBankAccountIds: readonly [number, ...number[]];
  readonly usdBankAccountId: number;
  readonly marketingChannelIds: readonly [number, ...number[]];
  readonly applicationIds: { readonly api: number; readonly console: number };
  readonly f2fGroupIds: readonly [number, ...number[]];
  readonly templateIds: {
    readonly donationThanks: number;
    readonly duesReminder: number;
    readonly eventTicket: number;
    readonly cardUpdate: number;
    readonly smsThanks: number;
    readonly campaignThanks: number;
  };
}

export function seedSystem(
  ctx: SeedContext,
  apiKeyIds: readonly string[],
): SystemRefs {
  const { db, rng } = ctx;
  const [admin, secondAdmin = admin] = ctx.adminIds;

  const iyzico = db.paymentSettings.insert({
    name: "iyzico Sanal POS",
    provider_no: "iyzico",
    status: 1,
    business_account: true,
  });
  const vpos = db.paymentSettings.insert({
    name: "İş Bankası Sanal POS",
    provider_no: "vpos",
    status: 1,
    business_account: true,
  });
  db.paymentSettings.insert({
    name: "PayPal (pasif)",
    provider_no: "paypal",
    status: 0,
    business_account: false,
  });

  const bankAccount = (
    name: string,
    bank: string,
    currencyId: number,
    daysAgo: number,
    details: string,
  ) =>
    db.bankAccounts.insert({
      name,
      bank_name: bank,
      iban: iban(rng),
      details,
      currency_id: currencyId,
      business_account: true,
      create_date: istanbulDateTime(daysBeforeAnchor(daysAgo)),
      created_by_id: admin,
      update_date:
        daysAgo > 400
          ? istanbulDateTime(daysBeforeAnchor(daysAgo - 200))
          : null,
      updated_by_id: daysAgo > 400 ? secondAdmin : null,
    });
  const main = bankAccount(
    "Genel Bağış Hesabı",
    "Türkiye İş Bankası",
    1,
    900,
    "Bağış ve aidat havaleleri için ana hesap",
  );
  const scholarship = bankAccount(
    "Burs Fonu Hesabı",
    "Ziraat Bankası",
    1,
    620,
    "Yalnızca burs bağışları",
  );
  const usd = bankAccount(
    "Döviz Hesabı (USD)",
    "Garanti BBVA",
    2,
    300,
    "Yurt dışı mezun bağışları",
  );

  const channel = (
    source: string,
    medium: string,
    campaign: string,
    content: string,
    daysAgo: number,
  ) =>
    db.marketingChannels.insert({
      utm_source: source,
      utm_medium: medium,
      utm_campaign: campaign,
      utm_content: content,
      create_date: istanbulDateTime(daysBeforeAnchor(daysAgo)),
    }).id;
  const channels = [
    channel("google", "cpc", "burs-2026", "arama-metni", 240),
    channel("instagram", "social", "burs-2026", "hikaye", 230),
    channel("newsletter", "email", "ekim-bulteni", "ust-banner", 31),
    channel("facebook", "social", "mezunlar-gecesi", "etkinlik-gonderisi", 75),
    channel("google", "cpc", "kurban-2026", "arama-metni", 160),
    channel("linkedin", "social", "kurumsal-destek", "sponsorlu-icerik", 120),
  ] as const;

  const applications = apiKeyIds.map(
    (keyId, index) =>
      db.applications.insert({
        title: index === 0 ? "Kelder Entegrasyonu" : `Entegrasyon ${index + 1}`,
        api_key_id: keyId,
      }).id,
  );
  const consoleApp = db.applications.insert({
    title: "Fonzip Paneli",
    api_key_id: null,
  }).id;

  const f2f = [
    db.f2fGroups.insert({ title: "Mezunlar Günü Standı" }).id,
    db.f2fGroups.insert({ title: "Okul Kapısı Gönüllüleri" }).id,
  ] as const;

  const template = (
    title: string,
    categoryId: number,
    sms: boolean,
    subject: string,
    message: string,
    button: {
      text: string;
      detail: "login" | "cc" | "donation" | "dues" | "member_card";
    } | null,
  ) =>
    db.templates.insert({
      title,
      subject,
      message,
      has_association_logo: !sms,
      type_sms: sms,
      background_color: "#f4f1ea",
      body_color: "#ffffff",
      footer_text_color: "#5b5b5b",
      footer_icon_color: 1,
      has_button: button !== null,
      btn_text: button?.text ?? "",
      btn_color: "#8b1d2c",
      btn_text_color: "#ffffff",
      btn_operation: 2,
      btn_operation_detail: button?.detail ?? "login",
      category_id: categoryId,
      translations: {},
    }).id;

  return {
    cardSettingsIds: [iyzico.id, vpos.id],
    tryBankAccountIds: [main.id, scholarship.id],
    usdBankAccountId: usd.id,
    marketingChannelIds: channels,
    applicationIds: { api: applications[0] ?? consoleApp, console: consoleApp },
    f2fGroupIds: f2f,
    templateIds: {
      donationThanks: template(
        "Bağış Teşekkür",
        1,
        false,
        "Bağışınız için teşekkür ederiz",
        "Sevgili {{name}}, {{amount}} tutarındaki bağışınız ulaştı.",
        { text: "Bağış Geçmişim", detail: "donation" },
      ),
      duesReminder: template(
        "Aidat Hatırlatma",
        2,
        false,
        "Aidat borcunuz hakkında",
        "Sevgili {{name}}, {{period}} dönemi aidatınız ödenmemiş görünüyor.",
        { text: "Aidat Öde", detail: "dues" },
      ),
      eventTicket: template(
        "Etkinlik Bileti",
        3,
        false,
        "Biletiniz hazır",
        "Sevgili {{name}}, {{event}} biletiniz ektedir.",
        null,
      ),
      cardUpdate: template(
        "Kart Güncelleme",
        1,
        false,
        "Kart bilgilerinizi güncelleyin",
        "Düzenli bağışınız için kart bilgilerinizi güncellemeniz gerekiyor.",
        { text: "Kartımı Güncelle", detail: "cc" },
      ),
      smsThanks: template(
        "SMS Teşekkür",
        1,
        true,
        "",
        "KELDER: Bağışınız için teşekkürler.",
        null,
      ),
      campaignThanks: template(
        "Kampanya Teşekkür",
        1,
        false,
        "Kampanyaya desteğiniz için teşekkürler",
        "{{campaign}} kampanyasına katkınız ulaştı.",
        { text: "Üye Kartım", detail: "member_card" },
      ),
    },
  };
}

export function seedWebhooks(ctx: SeedContext): void {
  const sink = `${ctx.selfOrigin}/__mock/webhooks/sink`;
  ctx.db.webhooks.insert({
    name: "Muhasebe Entegrasyonu",
    url: `${sink}?receiver=muhasebe`,
    authentication: true,
    auth_token: "kelder-muhasebe-token",
    events: {
      DONATION: true,
      SUBSCRIPTION: true,
      TICKET: false,
      FORM: false,
      CERTIFICATE_SALE: true,
      FUNDRAISING_CAMPAIGN: false,
    },
  });
  ctx.db.webhooks.insert({
    name: "CRM Senkronizasyonu",
    url: `${sink}?receiver=crm`,
    authentication: false,
    auth_token: "",
    events: {
      DONATION: true,
      SUBSCRIPTION: true,
      TICKET: true,
      FORM: true,
      CERTIFICATE_SALE: true,
      FUNDRAISING_CAMPAIGN: true,
    },
  });
}
