import type { Row } from "../store/collection";
import type {
  UdvValue,
  UserDefinedValueRecord,
  UserRecord,
} from "../store/records";
import { newUser, type NewUser } from "../store/users";
import type { SeedContext } from "./context";
import { daysBeforeAnchor, istanbulDate, apiDateTime } from "./dates";
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
// A listing by `order_by=-id` starts with the newest users. The first page of
// 20 is sparse, like the organisation production showed: it has few
// addresses and a mix of filled and empty profiles.
export const NEWEST_PAGE = 20;

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
  // Production names every field `custom` and shows it to `ngo`, groups it
  // under USER.GROUP.DEFINED_FIELDS and ids it C<number>. Its `for` is text,
  // numeric, date or select_w_bool, and every select, yes/no or multiple
  // select field is select_w_bool. It sends no yes or no texts, and only a
  // select field carries a select_text.
  const udv = (
    name: string,
    value: string,
    keyType: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
    input: "text" | "numeric" | "date" | "select_w_bool",
    options: readonly string[] = [],
    validation: UserDefinedValueRecord["validation"] = {},
  ) => {
    const row = ctx.db.userDefinedValues.insert({
      key: "",
      type: "custom",
      name,
      value,
      group: "USER.GROUP.DEFINED_FIELDS",
      key_type: keyType,
      for: input,
      options: options.map((text, index) => ({
        id: index + 1,
        text,
        order: index,
      })),
      boolean_true_text: null,
      boolean_false_text: null,
      select_text: input === "select_w_bool" ? "Seçiniz" : null,
      validation,
      display_for: "ngo",
    });
    ctx.db.userDefinedValues.update(row.id, { key: `C${row.id}` });
  };
  udv("Mezuniyet Yılı", "mezuniyet_yili", 4, "numeric", [], {
    max: true,
    max_value: 2100,
  });
  udv("Meslek", "meslek", 0, "text");
  udv("Şube", "sube", 7, "select_w_bool", BRANCHES);
  udv("Burs Gönüllüsü", "burs_gonullusu", 6, "select_w_bool", [
    "Evet",
    "Hayır",
  ]);
  udv("İlgi Alanları", "ilgi_alanlari", 8, "select_w_bool", [
    "Burs",
    "Spor",
    "Kültür",
    "Kariyer",
  ]);
  udv("Özgeçmiş Notu", "ozgecmis_notu", 1, "text", [], {
    limit: true,
    limit_value: 500,
  });
}

function asciiEmail(first: string, last: string, n: number): string {
  return `${slugify(first).replaceAll("-", "")}.${slugify(last).replaceAll("-", "")}${n}@eposta.example`;
}

// The newest page leaves most columns empty. The holes depend on the user's
// position only, so they draw nothing from the shared RNG. The newest user
// matches the detail production showed: no address, city, district, home or
// work phone, post codes, second email or work place, but a TC kimlik number,
// a birthday and a nationality. The other holes leave the page a mix of
// filled and empty values.
function sparseProfile(index: number, drawn: NewUser): Partial<NewUser> {
  const at = (period: number, phase: number) => index % period === phase;
  const keep = (hole: boolean, text: string) => (hole ? "" : text);
  return {
    address: "",
    city_text: "",
    district_text: "",
    work_phone: "",
    post_code: "",
    work_post_code: "",
    home_phone_first: "",
    email_second: keep(index === USER_COUNT - 1, drawn.email_second),
    birthday: keep(at(5, 0) || at(5, 1), drawn.birthday),
    tckno: keep(at(2, 0), drawn.tckno),
    nationality_text: keep(index < USER_COUNT - 9, drawn.nationality_text),
    country_text: keep(at(7, 2), drawn.country_text),
    work_address: at(3, 2)
      ? ""
      : drawn.work_address || `Sanayi Cd. No:${index - 100}`,
    work_city_text: keep(at(5, 4), drawn.work_city_text),
    work_country_text: keep(at(4, 1), drawn.work_country_text),
    work_district_text: keep(at(6, 5), drawn.work_district_text),
  };
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
    const drawn = newUser({
      corporate_type: corporate,
      first_name: first,
      last_name: last,
      address: `${rng.pick(STREETS)} No:${rng.int(1, 180)} D:${rng.int(1, 24)}`,
      birthday: corporate ? "" : istanbulDate(birth),
      email: corporate
        ? `bagis@${slugify(first).split("-")[0] ?? "kurum"}.example`
        : asciiEmail(first, last, index + 1),
      phone: mobilePhone(rng),
      membership_no: index + 1,
      tckno: corporate ? "" : tcKimlikNo(rng),
      apply_date: apiDateTime(applied),
      join_date: apiDateTime(joined),
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
      email_second: rng.chance(0.2) ? asciiEmail(first, last, index + 501) : "",
      admin: index < ADMIN_COUNT,
      profile_pic:
        !corporate && index % 3 === 0
          ? `https://kelder.example/media/profil/${index + 1}.jpg`
          : null,
    });
    const holes =
      index >= USER_COUNT - NEWEST_PAGE ? sparseProfile(index, drawn) : {};
    users.push(db.users.insert({ ...drawn, ...holes }));
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
        create_date: apiDateTime(daysBeforeAnchor(rng.int(1, 700))),
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
      note(user.id, 1, apiDateTime(at), "Profil bilgileri güncellendi");
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
        apiDateTime(reminder.asked),
        `${reminder.period_months} ayda bir bağış hatırlatması istedi`,
      );
    }
    db.contactProfiles.insert({
      user_id: user.id,
      create_date: user.apply_date,
      last_update_date: apiDateTime(updates.at(-1) ?? created),
      has_password: hasPassword,
      last_login: hasPassword
        ? {
            date: apiDateTime(between(created)),
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
              sign_date: apiDateTime(between(created)),
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
    const at = apiDateTime(between(new Date(holder.join_date)));
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
  // A channel never answered has no date and no permission. The draws below
  // happen all the same, so the RNG stream does not depend on it.
  const permission = (
    userId: number | null,
    email: string,
    phone: string,
    recentlyChanged: boolean,
    unanswered: { readonly phone: boolean; readonly sms: boolean } = {
      phone: false,
      sms: false,
    },
  ) => {
    const changed = (allowed: boolean) => ({
      allowed,
      date: apiDateTime(
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
      allow_comm_via_phone: !unanswered.phone && viaPhone.allowed,
      allow_comm_via_phone_date: unanswered.phone ? null : viaPhone.date,
      allow_comm_via_sms: !unanswered.sms && viaSms.allowed,
      allow_comm_via_sms_date: unanswered.sms ? null : viaSms.date,
      allow_comm_via_email: viaEmail.allowed,
      allow_comm_via_email_date: viaEmail.date,
    });
  };
  // Some of the newest page have not answered for phone or sms, as in
  // production's first page. The newest user has answered for both.
  users.forEach((user, index) => {
    const newest = index >= USER_COUNT - NEWEST_PAGE;
    permission(user.id, user.email, user.phone, index % 12 === 5, {
      phone: newest && index % 7 === 3,
      sms: newest && index % 6 === 1,
    });
  });
  for (let index = 0; index < 12; index += 1) {
    const first = rng.pick(MALE_FIRST_NAMES);
    const last = rng.pick(LAST_NAMES);
    // A guest's consent was recorded long ago, so the changed list starts
    // with a person. Production's lookup always carried the user's id, and the
    // parity run follows the first changed email into the lookup.
    permission(
      null,
      asciiEmail(first, last, 900 + index),
      mobilePhone(rng),
      false,
    );
  }
}
