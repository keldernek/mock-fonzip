import type { Row } from "../store/collection";
import type { EcardRecord, UserRecord } from "../store/records";
import type { SeedContext } from "./context";
import { addDays, daysBeforeAnchor, istanbulDate, apiDateTime } from "./dates";
import { slugify } from "./identity";
import type { SystemRefs } from "./system";

export interface EcardRefs {
  readonly ecardIds: readonly [number, ...number[]];
  readonly cargoEcardIds: readonly number[];
}

export interface CampaignRefs {
  readonly campaignIds: readonly [number, ...number[]];
  readonly activeCampaignIds: readonly [number, ...number[]];
  readonly fundraisingEventIds: readonly [number, ...number[]];
}

const ECARD_TYPE = {
  single: 1,
  inHonor: 2,
  inHonorWithMessage: 3,
  condolence: 4,
  condolenceWithMessage: 5,
} as const;

type EcardType = (typeof ECARD_TYPE)[keyof typeof ECARD_TYPE];

function nonEmpty<T>(items: readonly T[], what: string): readonly [T, ...T[]] {
  const [first, ...rest] = items;
  if (first === undefined) throw new Error(`no ${what} seeded`);
  return [first, ...rest];
}

export function seedEcards(ctx: SeedContext, system: SystemRefs): EcardRefs {
  const { db } = ctx;
  const [admin] = ctx.adminIds;
  const category = (name: string, order: number, daysAgo: number) =>
    db.ecardCategories.insert({
      name,
      order: String(order),
      create_date: apiDateTime(daysBeforeAnchor(daysAgo)),
      created_by_id: admin,
      update_date:
        order === 1 ? apiDateTime(daysBeforeAnchor(daysAgo - 30)) : null,
      updated_by_id: order === 1 ? admin : null,
    }).id;
  const categories = [
    category("Doğum Günü", 1, 500),
    category("Mezuniyet", 2, 480),
    category("Anma", 3, 400),
    category("Bayram", 4, 200),
  ] as const;

  const base: Omit<
    EcardRecord,
    | "id"
    | "title"
    | "categories"
    | "has_cargo"
    | "first_amount"
    | "active"
    | "order"
    | "ecard_type"
  > = {
    listing: 1,
    starred: false,
    payment_settings_id: system.cardSettingsIds[0],
    minimum_amount: 100,
    details: "Sevdikleriniz adına burs fonuna bağış yapın, kartınız iletilsin.",
    has_fixed_amount: false,
    minimum_cargo_amount: 500,
    second_amount: 500,
    third_amount: 1000,
    image_file: "https://kelder.example/media/ecards/kart.png",
    preview_file: 0,
    first_image_x: 120,
    first_image_y: 340,
    first_image_width: 560,
    first_image_height: 60,
    font_color: "#1f2933",
    font_size: "28",
    font_family: "Playfair Display",
    font_bold: true,
    font_italic: false,
    text_align: 1,
    second_image_x: 120,
    second_image_y: 420,
    second_image_width: 560,
    second_image_height: 40,
    second_text_align: 1,
    second_font_color: "#52606d",
    second_font_size: "18",
    second_font_family: "Inter",
    second_font_bold: false,
    second_font_italic: false,
    third_image_x: 120,
    third_image_y: 470,
    third_image_width: 560,
    third_image_height: 30,
    third_text_align: 1,
    third_font_color: "#52606d",
    third_font_size: "14",
    third_font_family: "Inter",
    third_font_bold: false,
    third_font_italic: true,
    custom_message_image_x: 120,
    custom_message_image_y: 520,
    custom_message_image_width: 560,
    custom_message_image_height: 120,
    custom_message_font_color: "#323f4b",
    custom_message_font_size: "16",
    custom_message_font_family: "Inter",
    custom_message_font_bold: false,
    custom_message_font_italic: false,
    custom_message_text_align: 0,
    last_update_date: apiDateTime(daysBeforeAnchor(60)),
    thanks_mail_id: system.templateIds.donationThanks,
    referring_thanks_mail_id: system.templateIds.campaignThanks,
    thanks_sms_id: system.templateIds.smsThanks,
    referring_thanks_sms_id: system.templateIds.smsThanks,
    ask_billing_info: false,
    background: { type: 0, value: "#ffffff" },
  };
  const ecard = (
    title: string,
    categoryIds: number[],
    order: number,
    options: {
      cargo?: boolean;
      active?: boolean;
      type: EcardType;
      amount?: number;
    },
  ) =>
    db.ecards.insert({
      ...base,
      title,
      categories: categoryIds,
      has_cargo: options.cargo ?? false,
      first_amount: options.amount ?? 250,
      active: options.active ?? true,
      order,
      ecard_type: options.type,
      starred: order === 1,
      ask_billing_info: options.cargo ?? false,
      background: options.cargo
        ? { type: 1, value: "https://kelder.example/media/ecards/zemin.jpg" }
        : base.background,
    }).id;
  const ids = [
    ecard("Doğum Günü Burs Kartı", [categories[0]], 1, {
      type: ECARD_TYPE.inHonor,
    }),
    ecard("Mezuniyet Tebrik Kartı", [categories[1]], 2, {
      type: ECARD_TYPE.inHonor,
      amount: 300,
    }),
    ecard("Anma Kartı", [categories[2]], 3, {
      type: ECARD_TYPE.condolence,
      cargo: true,
      amount: 500,
    }),
    ecard("Bayram Kartı", [categories[3]], 4, { type: ECARD_TYPE.single }),
    ecard("Basılı Teşekkür Kartı", [categories[1], categories[3]], 5, {
      cargo: true,
      type: ECARD_TYPE.inHonorWithMessage,
      amount: 750,
    }),
    ecard("Eski Tasarım Kart", [categories[0]], 6, {
      type: ECARD_TYPE.single,
      active: false,
    }),
  ];
  return {
    ecardIds: nonEmpty(ids, "ecards"),
    cargoEcardIds: [ids[2] ?? 0, ids[4] ?? 0],
  };
}

export function seedCampaigns(
  ctx: SeedContext,
  system: SystemRefs,
  users: readonly Row<UserRecord>[],
  scholarshipCategoryId: number,
  ecards: EcardRefs,
): CampaignRefs {
  const { db, rng } = ctx;
  const eventIds = [
    db.fundraisingEvents.insert({
      title: "Burs Seferberliği 2026",
      has_target: true,
      target: 2_500_000,
      target_currency_id: 1,
      image: "https://kelder.example/media/events/burs-2026.jpg",
    }).id,
    db.fundraisingEvents.insert({
      title: "İstanbul Maratonu 2026",
      has_target: true,
      target: 750_000,
      target_currency_id: 1,
      image: "https://kelder.example/media/events/maraton.jpg",
    }).id,
    db.fundraisingEvents.insert({
      title: "Mezunlar Gecesi",
      has_target: false,
      target: 0,
      target_currency_id: 1,
      image: "https://kelder.example/media/events/gece.jpg",
    }).id,
  ];

  const leaders = users.slice(5, 8);
  const teamIds = leaders.map((leader, index) => {
    const title =
      [
        "1995 Mezunları Takımı",
        "Kabataş Koşucuları",
        "Kürek Takımı Dayanışması",
      ][index] ?? `Takım ${index + 1}`;
    const team = db.fundraisingTeams.insert({
      user_id: leader.id,
      title,
      image: `https://kelder.example/media/teams/${slugify(title)}.jpg`,
      details: `${title} burs fonu için birlikte bağış topluyor.`,
      slug: slugify(title),
      currency_id: 1,
      create_date: apiDateTime(daysBeforeAnchor(200 - index * 30)),
      status: index === 2 ? 0 : 1,
      update_title: index === 1 ? `${title} 2026` : null,
      update_details:
        index === 1 ? "Güncellenmiş takım açıklaması onay bekliyor." : null,
      update_image:
        index === 1
          ? `https://kelder.example/media/teams/${slugify(title)}-yeni.jpg`
          : null,
    });
    db.teamCampaigns.insert({
      team_id: team.id,
      title: `${title} - Burs`,
      has_target: true,
      target: 100_000 + index * 50_000,
      target_currency_id: 1,
      default: true,
    });
    db.teamCampaigns.insert({
      team_id: team.id,
      title: `${title} - Maraton`,
      has_target: index !== 0,
      target: index !== 0 ? 40_000 : 0,
      target_currency_id: 1,
      default: false,
    });
    return team.id;
  });

  const statuses = [1, 1, 1, 1, 0, 1, 3, 2, 5, 7] as const;
  const campaignIds = statuses.map((status, index) => {
    const owner = users[10 + index * 7] ?? users[0];
    if (!owner) throw new Error("campaign owner missing");
    const created = daysBeforeAnchor(260 - index * 22);
    const teamId = index < 3 ? (teamIds[index] ?? null) : null;
    const teamCampaign =
      teamId === null
        ? undefined
        : db.teamCampaigns.find((row) => row.team_id === teamId && row.default);
    const title = `${owner.first_name} ${owner.last_name} - ${["Burs Fonu", "Maraton Koşusu", "Doğum Günü Kampanyası", "Anma Kampanyası", "Kütüphane Desteği"][index % 5]}`;
    return db.fundraisingCampaigns.insert({
      user_id: owner.id,
      create_date: apiDateTime(created),
      activation_date:
        status === 0 || status === 2 ? null : apiDateTime(addDays(created, 1)),
      finish_date:
        status === 3 || status === 7 ? apiDateTime(addDays(created, 90)) : null,
      title: title.trim(),
      update_title: index === 3 ? `${title.trim()} 2026` : null,
      update_image:
        index === 3
          ? `https://kelder.example/media/campaigns/4-yeni.jpg`
          : null,
      update_personal_message:
        index === 3
          ? "Hedefimize yaklaştık, desteğiniz için teşekkür ederim."
          : null,
      url: `https://kelder.example/kampanya/${slugify(title)}`,
      status,
      target_currency_id: 1,
      featured: index === 0,
      image: `https://kelder.example/media/campaigns/${index + 1}.jpg`,
      personal_message:
        "Okulumuzun öğrencilerine burs sağlamak için bu kampanyayı başlattım.",
      user_note: index % 3 === 0 ? "Kampanya sahibi fatura istemiyor." : "",
      has_target: index !== 4,
      hide_total_donation: index === 8,
      hide_donor_list: index === 8,
      target: index === 4 ? 0 : rng.pick([25_000, 50_000, 75_000, 100_000]),
      has_special_date: index === 2,
      event_date: index === 2 ? istanbulDate(addDays(created, 30)) : null,
      phone_show: true,
      phone_required: false,
      birthday_show: index === 2,
      birthday_required: false,
      address_show: index === 3,
      address_required: index === 3,
      tckno_show: true,
      tckno_required: index % 2 === 0,
      message_show: true,
      sub_donation_type_id: scholarshipCategoryId,
      thanks_mail_id: system.templateIds.campaignThanks,
      payment_settings_id: system.cardSettingsIds[0],
      currencies: index === 1 ? [1, 2, 3] : [1],
      certificate_id: index === 2 ? ecards.ecardIds[0] : null,
      thanks_sms_id: index % 2 === 0 ? system.templateIds.smsThanks : null,
      referral_certificate_id: null,
      referral_thanks_mail_id:
        index === 2 ? system.templateIds.donationThanks : null,
      association_campaign_target_id:
        index < 6 ? (eventIds[index % 2] ?? null) : null,
      bank_account_ids: [system.tryBankAccountIds[0]],
      team_id: teamId,
      team_campaign_id: teamCampaign?.id ?? null,
    }).id;
  });
  const active = campaignIds.filter((_, index) => statuses[index] === 1);
  return {
    campaignIds: nonEmpty(campaignIds, "campaigns"),
    activeCampaignIds: nonEmpty(active, "active campaigns"),
    fundraisingEventIds: nonEmpty(eventIds, "fundraising events"),
  };
}
