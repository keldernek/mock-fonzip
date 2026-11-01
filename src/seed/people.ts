import type { Row } from "../store/collection";
import type { UdvValue, UserRecord } from "../store/records";
import type { SeedContext } from "./context";
import { daysBeforeAnchor, istanbulDate, istanbulDateTime } from "./dates";
import { mobilePhone, slugify, tcKimlikNo } from "./identity";
import {
  CITIES,
  COMPANY_NAMES,
  FEMALE_FIRST_NAMES,
  LAST_NAMES,
  MALE_FIRST_NAMES,
  PROFESSIONS,
  STREETS,
} from "./names";

export const USER_COUNT = 150;
export const ADMIN_COUNT = 3;

export interface PeopleRefs {
  readonly users: readonly [Row<UserRecord>, ...Row<UserRecord>[]];
  readonly tagIds: readonly [number, ...number[]];
}

const BRANCHES = [
  "Hazırlık A",
  "Hazırlık B",
  "Fen",
  "Türkçe-Matematik",
  "Yabancı Dil",
] as const;

export function seedUserDefinedValues(ctx: SeedContext): void {
  const udv = (
    name: string,
    value: string,
    keyType: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
    input: "text" | "numeric" | "date" | "select",
    options: readonly string[] = [],
  ) => {
    const row = ctx.db.userDefinedValues.insert({
      key: "",
      type: input === "select" ? "select" : "input",
      name,
      value,
      group: "Mezun Bilgileri",
      key_type: keyType,
      for: input,
      options: options.map((text, index) => ({
        id: index + 1,
        text,
        order: index,
      })),
      boolean_true_text: keyType === 6 ? "Evet" : "",
      boolean_false_text: 0,
      changable_by_users: keyType !== 4,
      select_text: 0,
      display_for: "member",
    });
    ctx.db.userDefinedValues.update(row.id, { key: `udv_${row.id}` });
  };
  udv("Mezuniyet Yılı", "mezuniyet_yili", 4, "numeric");
  udv("Meslek", "meslek", 0, "text");
  udv("Şube", "sube", 7, "select", BRANCHES);
  udv("Burs Gönüllüsü", "burs_gonullusu", 6, "select", ["Evet", "Hayır"]);
  udv("İlgi Alanları", "ilgi_alanlari", 8, "select", [
    "Burs",
    "Spor",
    "Kültür",
    "Kariyer",
  ]);
  udv("Özgeçmiş Notu", "ozgecmis_notu", 1, "text");
}

function asciiEmail(first: string, last: string, n: number): string {
  return `${slugify(first).replaceAll("-", "")}.${slugify(last).replaceAll("-", "")}${n}@eposta.example`;
}

export function seedUsers(
  ctx: SeedContext,
): readonly [Row<UserRecord>, ...Row<UserRecord>[]] {
  const { db, rng } = ctx;
  const users: Row<UserRecord>[] = [];
  for (let index = 0; index < USER_COUNT; index += 1) {
    const corporate = index >= ADMIN_COUNT && index % 25 === 7;
    const female = !corporate && rng.chance(0.25);
    const first = corporate
      ? (COMPANY_NAMES[index % COMPANY_NAMES.length] ?? COMPANY_NAMES[0])
      : female
        ? rng.pick(FEMALE_FIRST_NAMES)
        : rng.pick(MALE_FIRST_NAMES);
    const last = corporate ? "" : rng.pick(LAST_NAMES);
    const place = rng.pick(CITIES);
    const district = rng.pick(place.districts);
    const work = rng.pick(CITIES);
    const graduation = rng.int(1965, 2024);
    const birth = new Date(
      Date.UTC(graduation - 18, rng.int(0, 11), rng.int(1, 28)),
    );
    const joined = daysBeforeAnchor(rng.int(30, 3650));
    const applied = new Date(joined.getTime() - rng.int(1, 20) * 86_400_000);
    const values: Record<string, UdvValue> = corporate
      ? {}
      : {
          mezuniyet_yili: graduation,
          meslek: rng.pick(PROFESSIONS),
          sube: rng.pick(BRANCHES),
          burs_gonullusu: rng.chance(0.3),
          ilgi_alanlari: ["Burs", rng.pick(["Spor", "Kültür", "Kariyer"])],
        };
    users.push(
      db.users.insert({
        corporate_type: corporate,
        first_name: first,
        last_name: last,
        address: `${rng.pick(STREETS)} No:${rng.int(1, 180)} D:${rng.int(1, 24)}`,
        birthday: corporate ? "" : istanbulDate(birth),
        total_financial: 0,
        email: corporate
          ? `bagis@${slugify(first).split("-")[0] ?? "kurum"}.example`
          : asciiEmail(first, last, index + 1),
        phone: mobilePhone(rng),
        membership_no: index + 1,
        tckno: corporate ? "" : tcKimlikNo(rng),
        apply_date: istanbulDateTime(applied),
        join_date: istanbulDateTime(joined),
        user_defined_values: values,
        nationality_text: "Türkiye Cumhuriyeti",
        home_phone_first: rng.chance(0.3) ? `+90212${rng.digits(7)}` : "",
        post_code: `34${rng.digits(3)}`,
        district_text: district,
        city_text: place.city,
        country_text: "Türkiye",
        work_phone: rng.chance(0.4) ? `+90216${rng.digits(7)}` : "",
        work_address: rng.chance(0.5)
          ? `${rng.pick(STREETS)} No:${rng.int(1, 90)}`
          : "",
        work_post_code: `34${rng.digits(3)}`,
        private: rng.chance(0.1),
        work_district_text: rng.pick(work.districts),
        work_city_text: work.city,
        work_country_text: "Türkiye",
        email_second: rng.chance(0.2)
          ? asciiEmail(first, last, index + 501)
          : "",
        admin: index < ADMIN_COUNT,
        profile_pic:
          !corporate && index % 3 === 0
            ? `https://kelder.example/media/profil/${index + 1}.jpg`
            : null,
      }),
    );
  }
  const [first, ...rest] = users;
  if (!first) throw new Error("no users seeded");
  return [first, ...rest];
}

export function seedTags(
  ctx: SeedContext,
  users: readonly Row<UserRecord>[],
): readonly [number, ...number[]] {
  const { db, rng } = ctx;
  const names = [
    "Burs Bağışçısı",
    "Gönüllü",
    "Yönetim Kurulu",
    "1990'lar Mezunu",
    "2000'ler Mezunu",
    "Etkinlik Katılımcısı",
    "Kurumsal Destekçi",
    "Aidat Borçlu",
  ] as const;
  const colors = [
    "tag-1",
    "tag-2",
    "tag-3",
    "tag-4",
    "tag-5",
    "tag-6",
    "tag-7",
    "tag-8",
  ] as const;
  const ids = names.map(
    (name, index) =>
      db.tags.insert({ name, color: colors[index] ?? "tag-1" }).id,
  );
  for (const user of users) {
    for (const tagId of ids) {
      if (!rng.chance(0.2)) continue;
      db.userTags.insert({
        user_id: user.id,
        tag_id: tagId,
        create_date: istanbulDateTime(daysBeforeAnchor(rng.int(1, 700))),
      });
    }
  }
  const [first, ...rest] = ids;
  if (first === undefined) throw new Error("no tags seeded");
  return [first, ...rest];
}

export function seedContactProfiles(
  ctx: SeedContext,
  users: readonly Row<UserRecord>[],
): void {
  const { db, rng } = ctx;
  const DAY_MS = 86_400_000;
  const anchor = daysBeforeAnchor(0).getTime();
  const between = (from: Date): Date => {
    const days = Math.max(1, Math.floor((anchor - from.getTime()) / DAY_MS));
    return daysBeforeAnchor(rng.int(0, days - 1), rng.int(0, 1200));
  };
  const note = (
    userId: number,
    eventType: 1 | 24 | 26,
    at: string,
    details: string,
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
    });
  for (const [index, user] of users.entries()) {
    const created = new Date(user.apply_date);
    const person = !user.corporate_type;
    const admin = index < ADMIN_COUNT;
    const updates = Array.from(
      { length: rng.chance(0.4) ? rng.int(1, 2) : 0 },
      () => between(created),
    ).sort((a, b) => a.getTime() - b.getTime());
    for (const at of updates) {
      note(user.id, 1, istanbulDateTime(at), "Profil bilgileri güncellendi");
    }
    const hasPassword = admin || (person && rng.chance(0.6));
    const reminder =
      person && rng.chance(0.12)
        ? {
            period_months: rng.pick([1, 3, 6, 12]),
            next_cycle: istanbulDate(daysBeforeAnchor(-rng.int(1, 60))),
            asked: between(created),
          }
        : null;
    if (reminder) {
      note(
        user.id,
        26,
        istanbulDateTime(reminder.asked),
        `${reminder.period_months} ayda bir bağış hatırlatması istedi`,
      );
    }
    db.contactProfiles.insert({
      user_id: user.id,
      create_date: user.apply_date,
      last_update_date: istanbulDateTime(updates.at(-1) ?? created),
      has_password: hasPassword,
      last_login: hasPassword
        ? {
            date: istanbulDateTime(between(created)),
            ip_address: `78.${rng.int(160, 191)}.${rng.int(0, 255)}.${rng.int(1, 254)}`,
          }
        : null,
      profile_pic:
        person && rng.chance(0.3)
          ? `https://kelder.example/media/profil/${user.id}.jpg`
          : null,
      language: rng.chance(0.1) ? "en" : "tr",
      agreement:
        person && rng.chance(0.7)
          ? {
              version: rng.pick([1, 2, 3]),
              sign_date: istanbulDateTime(between(created)),
            }
          : null,
      blocked_mail: rng.chance(0.04),
      spam_mail: rng.chance(0.03),
      address_book: rng.chance(0.25),
      donation_reminder: reminder
        ? {
            period_months: reminder.period_months,
            next_cycle: reminder.next_cycle,
          }
        : null,
      notify_after_dues_withdrawal: rng.chance(0.5),
      default_dues_reminder_withdrawal: rng.chance(0.3),
    });
  }
  for (let index = 0; index < 15; index += 1) {
    const holder = users[10 + index * 9];
    const related = users[11 + index * 9];
    if (!holder || !related) continue;
    const at = istanbulDateTime(between(new Date(holder.join_date)));
    db.contactRelations.insert({
      user_id: holder.id,
      related_user_id: related.id,
      dues_permission: index % 2 === 0,
      comm_permission: index % 3 === 0,
      create_date: at,
    });
    note(
      holder.id,
      24,
      at,
      `İlişkili kişi eklendi: ${related.first_name} ${related.last_name}`.trim(),
    );
  }
}

export function seedCommunicationPermissions(
  ctx: SeedContext,
  users: readonly Row<UserRecord>[],
): void {
  const { db, rng } = ctx;
  const permission = (
    userId: number | null,
    email: string,
    phone: string,
    recentlyChanged: boolean,
  ) => {
    const changed = (allowed: boolean) => ({
      allowed,
      date: istanbulDateTime(
        daysBeforeAnchor(
          recentlyChanged ? rng.int(0, 2) : rng.int(8, 900),
          rng.int(0, 600),
        ),
      ),
    });
    const viaPhone = changed(rng.chance(0.6));
    const viaSms = changed(rng.chance(0.7));
    const viaEmail = changed(rng.chance(0.85));
    db.communicationPermissions.insert({
      user_id: userId,
      email,
      phone,
      phone_slug: phone.replaceAll(/\D/g, ""),
      allow_comm_via_phone: viaPhone.allowed,
      allow_comm_via_phone_date: viaPhone.date,
      allow_comm_via_sms: viaSms.allowed,
      allow_comm_via_sms_date: viaSms.date,
      allow_comm_via_email: viaEmail.allowed,
      allow_comm_via_email_date: viaEmail.date,
    });
  };
  users.forEach((user, index) =>
    permission(user.id, user.email, user.phone, index % 12 === 5),
  );
  for (let index = 0; index < 12; index += 1) {
    const first = rng.pick(MALE_FIRST_NAMES);
    const last = rng.pick(LAST_NAMES);
    permission(
      null,
      asciiEmail(first, last, 900 + index),
      mobilePhone(rng),
      index % 3 === 0,
    );
  }
}
