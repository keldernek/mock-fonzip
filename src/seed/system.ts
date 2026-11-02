import { apiDateTime, daysBeforeAnchor } from "./dates";
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
    readonly smsReminder: number;
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
      create_date: apiDateTime(daysBeforeAnchor(daysAgo)),
      created_by_id: admin,
      update_date:
        daysAgo > 400 ? apiDateTime(daysBeforeAnchor(daysAgo - 200)) : null,
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
      create_date: apiDateTime(daysBeforeAnchor(daysAgo)),
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

  // Production's templates are sparse: most have no creator and no update,
  // and some have no category. A template with no subject is an SMS, and one
  // with no button has no button text or action. Nulls come from each
  // template's own entry here, so the seeded RNG stays untouched.
  const template = (spec: {
    readonly title: string;
    readonly categoryId: number | null;
    readonly sms: boolean;
    readonly subject: string | null;
    readonly message: string;
    readonly button: {
      readonly text: string;
      readonly detail: "login" | "cc" | "donation" | "dues" | "member_card";
    } | null;
    readonly createdDaysAgo: number;
    readonly createdBy: number | null;
    readonly updated: {
      readonly daysAgo: number;
      readonly by: number | null;
    } | null;
    readonly translations: Readonly<
      Record<string, Readonly<Record<string, string | null>>>
    >;
  }) =>
    db.templates.insert({
      title: spec.title,
      subject: spec.subject,
      message: spec.message,
      has_association_logo: !spec.sms,
      type_sms: spec.sms,
      background_color: "#f4f1ea",
      body_color: "#ffffff",
      footer_text_color: "#5b5b5b",
      footer_icon_color: 1,
      has_button: spec.button !== null,
      btn_text: spec.button?.text ?? null,
      btn_color: "#8b1d2c",
      btn_text_color: "#ffffff",
      btn_operation: 2,
      btn_operation_detail: spec.button?.detail ?? null,
      category_id: spec.categoryId,
      translations: spec.translations,
      create_date: apiDateTime(daysBeforeAnchor(spec.createdDaysAgo)),
      update_date:
        spec.updated === null
          ? null
          : apiDateTime(daysBeforeAnchor(spec.updated.daysAgo)),
      created_by_id: spec.createdBy,
      updated_by_id: spec.updated?.by ?? null,
    }).id;

  return {
    cardSettingsIds: [iyzico.id, vpos.id],
    tryBankAccountIds: [main.id, scholarship.id],
    usdBankAccountId: usd.id,
    marketingChannelIds: channels,
    applicationIds: { api: applications[0] ?? consoleApp, console: consoleApp },
    f2fGroupIds: f2f,
    templateIds: {
      donationThanks: template({
        title: "Bağış Teşekkür",
        categoryId: 1,
        sms: false,
        subject: "Bağışınız için teşekkür ederiz",
        message: "Sevgili {{name}}, {{amount}} tutarındaki bağışınız ulaştı.",
        button: { text: "Bağış Geçmişim", detail: "donation" },
        createdDaysAgo: 400,
        createdBy: admin,
        updated: { daysAgo: 90, by: secondAdmin },
        translations: {
          en: {
            subject: "Thank you for your donation",
            message: "Dear {{name}}, your donation of {{amount}} has arrived.",
            btn_text: "My donations",
          },
          de: {
            subject: "Vielen Dank für Ihre Spende",
            message:
              "Liebe/r {{name}}, Ihre Spende über {{amount}} ist angekommen.",
            btn_text: "Meine Spenden",
          },
          fr: {
            subject: "Merci pour votre don",
            message: "Cher/Chère {{name}}, votre don de {{amount}} est arrivé.",
            btn_text: "Mes dons",
          },
        },
      }),
      duesReminder: template({
        title: "Aidat Hatırlatma",
        categoryId: 2,
        sms: false,
        subject: "Aidat borcunuz hakkında",
        message:
          "Sevgili {{name}}, {{period}} dönemi aidatınız ödenmemiş görünüyor.",
        button: { text: "Aidat Öde", detail: "dues" },
        createdDaysAgo: 380,
        createdBy: secondAdmin,
        updated: null,
        translations: {
          en: {
            subject: "About your outstanding dues",
            message: "Dear {{name}}, your dues for {{period}} look unpaid.",
            btn_text: "Pay dues",
          },
          es: {
            subject: "Sobre su cuota pendiente",
            message:
              "Estimado/a {{name}}, su cuota de {{period}} parece sin pagar.",
            btn_text: "Pagar la cuota",
          },
          it: {
            subject: "Sulla sua quota in sospeso",
            message:
              "Gentile {{name}}, la quota di {{period}} risulta non pagata.",
            btn_text: "Paga la quota",
          },
        },
      }),
      eventTicket: template({
        title: "Etkinlik Bileti",
        categoryId: 3,
        sms: false,
        subject: "Biletiniz hazır",
        message: "Sevgili {{name}}, {{event}} biletiniz ektedir.",
        button: null,
        createdDaysAgo: 300,
        createdBy: null,
        updated: { daysAgo: 45, by: admin },
        translations: {
          en: {
            subject: "Your ticket is ready",
            message: "Dear {{name}}, your ticket for {{event}} is attached.",
            btn_text: null,
          },
          pt: {
            subject: "O seu bilhete está pronto",
            message:
              "Caro/a {{name}}, o bilhete para {{event}} segue em anexo.",
            btn_text: null,
          },
        },
      }),
      cardUpdate: template({
        title: "Kart Güncelleme",
        categoryId: 1,
        sms: false,
        subject: "Kart bilgilerinizi güncelleyin",
        message:
          "Düzenli bağışınız için kart bilgilerinizi güncellemeniz gerekiyor.",
        button: { text: "Kartımı Güncelle", detail: "cc" },
        createdDaysAgo: 200,
        createdBy: null,
        updated: null,
        translations: {
          en: {
            subject: "Please update your card details",
            message: "Your monthly donation needs updated card details.",
            btn_text: "Update my card",
          },
          ru: {
            subject: "Обновите данные вашей карты",
            message:
              "Для регулярного пожертвования нужно обновить данные карты.",
            btn_text: "Обновить карту",
          },
          nl: {
            subject: "Werk uw kaartgegevens bij",
            message:
              "Voor uw maandelijkse gift zijn nieuwe kaartgegevens nodig.",
            btn_text: "Kaart bijwerken",
          },
        },
      }),
      smsThanks: template({
        title: "SMS Teşekkür",
        categoryId: 1,
        sms: true,
        subject: null,
        message: "KELDER: Bağışınız için teşekkürler.",
        button: null,
        createdDaysAgo: 150,
        createdBy: null,
        updated: null,
        translations: {
          en: {
            subject: null,
            message: "KELDER: Thank you for your donation.",
            btn_text: null,
          },
        },
      }),
      campaignThanks: template({
        title: "Kampanya Teşekkür",
        categoryId: 1,
        sms: false,
        subject: "Kampanyaya desteğiniz için teşekkürler",
        message: "{{campaign}} kampanyasına katkınız ulaştı.",
        button: { text: "Üye Kartım", detail: "member_card" },
        createdDaysAgo: 60,
        createdBy: null,
        updated: null,
        translations: {
          en: {
            subject: "Thank you for supporting the campaign",
            message: "Your contribution to {{campaign}} has arrived.",
            btn_text: "My member card",
          },
        },
      }),
      // The newest template, so the first row of the default list. It reads
      // like the first row production sent: an SMS with no subject, category,
      // button text or action, and one translation whose texts are null where
      // an SMS has nothing to say.
      smsReminder: template({
        title: "SMS Hatırlatma",
        categoryId: null,
        sms: true,
        subject: null,
        message: "KELDER: {{period}} dönemi aidatınız için hatırlatma.",
        button: null,
        createdDaysAgo: 5,
        createdBy: null,
        updated: null,
        translations: {
          tr: {
            subject: null,
            message: "KELDER: {{period}} dönemi aidatınız için hatırlatma.",
            btn_text: null,
          },
        },
      }),
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
