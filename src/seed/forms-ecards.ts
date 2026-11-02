import { SEED_ANCHOR } from "../core/clock";
import type { Row } from "../store/collection";
import type { UdvValue, UserRecord } from "../store/records";
import { TRANSACTION_TYPE } from "../store/transactions";
import type { EcardRefs } from "./campaigns";
import { createTransaction, type SeedContext } from "./context";
import {
  addDays,
  daysBeforeAnchor,
  istanbulDate,
  istanbulDateTime,
} from "./dates";
import type { SystemRefs } from "./system";

const FORM_PRICE = 450;
const ARCHIVED_AFTER_DAYS = 90;
const EXPLANATION_INFORMATION = "Lütfen bilgilerinizi eksiksiz doldurun.";
const PHONE_INFORMATION = "Başında 0 olmadan, 10 haneli olarak yazın.";
// The first message id of a mail the seed sends without drawing from the RNG.
const ACKNOWLEDGEMENT_MESSAGE_ID = 7_300_000;

// A custom field as the answer to its question reads: the text a contact
// typed, or the choice a contact made.
function udvAnswer(value: UdvValue | undefined): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  return Array.isArray(value) ? value.join(", ") : String(value);
}

export function seedForms(
  ctx: SeedContext,
  users: readonly Row<UserRecord>[],
  system: SystemRefs,
): void {
  const { db, rng } = ctx;
  const [admin, secondAdmin = admin] = ctx.adminIds;
  const udvProfession = db.userDefinedValues.find(
    (row) => row.value === "meslek",
  );
  const udvBranch = db.userDefinedValues.find((row) => row.value === "sube");
  // The survey asks for these custom fields, in this order, after the profession.
  const surveyFields = [
    "mezuniyet_yili",
    "sube",
    "burs_gonullusu",
    "ilgi_alanlari",
    "ozgecmis_notu",
  ] as const;
  const plans = [
    {
      title: "Burs Başvuru Formu",
      paid: false,
      approval: true,
      answers: 14,
      archived: false,
      limit: 200,
      verifiesEmail: true,
      survey: false,
    },
    {
      title: "Gönüllü Kayıt Formu",
      paid: false,
      approval: false,
      answers: 10,
      archived: false,
      limit: null,
      verifiesEmail: true,
      survey: false,
    },
    {
      title: "Mezuniyet Yıllığı Siparişi",
      paid: true,
      approval: false,
      answers: 9,
      archived: false,
      limit: 100,
      verifiesEmail: true,
      survey: false,
    },
    {
      // Asks the contact's custom fields instead of a choice, never asks to
      // verify the address, and thanks every respondent by mail.
      title: "Etkinlik Memnuniyet Anketi",
      paid: false,
      approval: false,
      answers: 7,
      archived: false,
      limit: null,
      verifiesEmail: false,
      survey: true,
    },
    {
      title: "2024 Kermes Kayıt",
      paid: false,
      approval: false,
      answers: 2,
      archived: true,
      limit: 50,
      verifiesEmail: true,
      survey: false,
    },
    {
      // Opened lately: nobody has answered yet.
      title: "Yaz Okulu Ön Kayıt Formu",
      paid: false,
      approval: false,
      answers: 0,
      archived: false,
      limit: 80,
      verifiesEmail: true,
      survey: false,
    },
  ] as const;
  for (const [order, plan] of plans.entries()) {
    const age = 400 - order * 60;
    const created = daysBeforeAnchor(age);
    const answerWindow = plan.archived ? ARCHIVED_AFTER_DAYS : age;
    // Every third form was imported, with no creator, and a form without a
    // creator was never edited either.
    const creator = order % 3 === 2 ? null : admin;
    const edited = creator !== null && order % 2 === 1;
    const form = db.forms.insert({
      title: plan.title,
      url: `https://kelder.example/form/${order + 1}`,
      active: !plan.archived,
      order: order + 1,
      listing: order < 3,
      application_limit: plan.limit,
      create_date: istanbulDateTime(created),
      created_by_id: creator,
      update_date: edited ? istanbulDateTime(addDays(created, 20)) : null,
      updated_by_id: edited ? secondAdmin : null,
      archived_by_id: plan.archived ? admin : null,
      archive_date: plan.archived
        ? istanbulDateTime(addDays(created, ARCHIVED_AFTER_DAYS))
        : null,
      requires_approval: plan.approval,
      price: plan.paid ? FORM_PRICE : null,
    });
    const question = (
      title: string,
      type: 0 | 1 | 2 | 3,
      extra: {
        required?: boolean;
        information?: string;
        staticQuestion?: 1 | 2 | 4 | 31;
        udvId?: number | null;
        custom?: {
          name: string;
          short: "text" | "select" | "multiple" | "boolean";
        } | null;
        options?: string[];
      },
    ) => {
      const information =
        extra.information ?? (type === 3 ? EXPLANATION_INFORMATION : null);
      const row = db.formQuestions.insert({
        form_id: form.id,
        title,
        slug: title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"),
        order: db.formQuestions.count((q) => q.form_id === form.id) + 1,
        question_type: type,
        required: extra.required ?? false,
        information,
        // Only a static question has a static code. A custom field, a custom
        // question and an explanation carry 0.
        static_question: type === 0 ? (extra.staticQuestion ?? 1) : 0,
        deleted: false,
        udv_id: extra.udvId ?? null,
        custom_question: null,
        options: (extra.options ?? []).map((text, index) => ({
          id: index + 1,
          text,
          order: index,
        })),
        additional_info_for_question: information !== null,
        another_question: null,
        dependent_question_option_ids: [],
        depends_on_another_question_answer: false,
        section_id: form.id * 10 + 1,
        show_other_for_multiple: false,
      });
      if (extra.custom) {
        db.formQuestions.update(row.id, {
          custom_question: {
            id: row.id,
            name: extra.custom.name,
            short: extra.custom.short,
          },
        });
      }
      return row.id;
    };
    const phone = question("Telefon", 0, {
      required: true,
      information: PHONE_INFORMATION,
      staticQuestion: 1,
    });
    const city = question("Şehir", 0, { staticQuestion: 31 });
    question("Açıklama", 3, {});
    const profession = question("Meslek", 1, {
      udvId: udvProfession?.id ?? null,
    });
    const surveyQuestions = plan.survey
      ? surveyFields.flatMap((key) => {
          const field = db.userDefinedValues.find((row) => row.value === key);
          return field
            ? [{ key, id: question(field.name, 1, { udvId: field.id }) }]
            : [];
        })
      : [];
    const choice = plan.survey
      ? null
      : question(order === 0 ? "Eğitim Durumu" : "Tercihiniz", 2, {
          required: true,
          custom: {
            name: order === 0 ? "Eğitim Durumu" : "Tercihiniz",
            short: "select",
          },
          options:
            order === 0
              ? ["Lise", "Lisans", "Yüksek Lisans"]
              : ["Evet", "Hayır", "Kararsızım"],
        });
    const note = plan.survey
      ? null
      : question("Eklemek istedikleriniz", 2, {
          custom: { name: "Not", short: "text" },
        });
    const branch = plan.archived
      ? question("Şube", 1, { udvId: udvBranch?.id ?? null })
      : null;

    for (let index = 0; index < plan.answers; index += 1) {
      const user = users[30 + ((order * 23 + index * 3) % 110)];
      if (!user) continue;
      const at = addDays(
        created,
        ((rng.int(1, 300) - 1) % (answerWindow - 1)) + 1,
      );
      const status = plan.paid
        ? index % 8 === 6
          ? 5
          : index % 8 === 3
            ? 4
            : 3
        : 3;
      const transaction = plan.paid
        ? createTransaction(ctx, {
            amount: FORM_PRICE,
            at,
            status,
            method: 0,
            paymentSettingsId: system.cardSettingsIds[0],
            bankAccountId: null,
            type: TRANSACTION_TYPE.form,
          })
        : null;
      // Every fourth answer draws a mail id, as it always has, so the RNG
      // stream stays where other seeds expect it. The survey thanks the
      // others too, with ids that need no draw.
      const sentMailId =
        index % 4 === 0
          ? db.sentEmails.insert({
              message_id: rng.int(1_000_000, 9_999_999),
              status: 1,
            }).id
          : plan.survey
            ? db.sentEmails.insert({
                message_id: ACKNOWLEDGEMENT_MESSAGE_ID + order * 100 + index,
                status: 1,
              }).id
            : null;
      const approval = plan.approval
        ? (([0, 1, 2] as const)[index % 3] ?? 0)
        : 1;
      // A form that asks for approval is answered by deciding. Any other form
      // is answered by the mail it sends.
      const responded = plan.approval ? approval !== 0 : sentMailId !== null;
      const anonymous = index % 7 === 6;
      const answer = db.formAnswers.insert({
        form_id: form.id,
        user_id: anonymous ? null : user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        email_verification: plan.verifiesEmail ? index % 5 !== 4 : null,
        complete_date: istanbulDateTime(at),
        transaction_id: transaction?.id ?? null,
        approval_status: approval,
        sent_mail_id: sentMailId,
        ip_address: `203.0.113.${((order * 17 + index * 7) % 254) + 1}`,
        city: anonymous ? null : user.city_text || null,
        country: anonymous ? null : user.country_text || null,
        respond_date: responded
          ? istanbulDateTime(
              new Date(
                Math.min(
                  addDays(at, 1 + (index % 3)).getTime(),
                  SEED_ANCHOR.getTime(),
                ),
              ),
            )
          : null,
        responded_by_id: responded
          ? (ctx.adminIds[(order + index) % ctx.adminIds.length] ?? admin)
          : null,
      });
      const optionId = (index % 3) + 1;
      const optionText =
        (order === 0
          ? ["Lise", "Lisans", "Yüksek Lisans"]
          : ["Evet", "Hayır", "Kararsızım"])[index % 3] ?? "";
      const item = (
        questionId: number,
        value: string,
        selected: number[] = [],
      ) =>
        db.formAnswerItems.insert({
          answer_id: answer.id,
          question_id: questionId,
          answer: value,
          db_answer: value,
          selected_option_ids: selected,
        });
      item(phone, user.phone);
      item(city, user.city_text);
      item(profession, String(user.user_defined_values.meslek ?? ""));
      for (const field of surveyQuestions) {
        item(field.id, udvAnswer(user.user_defined_values[field.key]));
      }
      if (choice !== null) item(choice, optionText, [optionId]);
      if (note !== null && index % 2 === 0) {
        item(note, "Teşekkürler, bilgilendirme bekliyorum.");
      }
      if (branch !== null) {
        item(branch, String(user.user_defined_values.sube ?? ""));
      }
    }
  }
  seedMergeCandidates(ctx, users);
}

function seedMergeCandidates(
  ctx: SeedContext,
  users: readonly Row<UserRecord>[],
): void {
  const { db } = ctx;
  const contacts = db.formAnswers
    .list((answer) => answer.approval_status === 0)
    .flatMap((answer) => {
      const user = users.find((row) => row.id === answer.user_id);
      return user && user.last_name !== ""
        ? [{ user, at: answer.complete_date }]
        : [];
    });
  const namesakeOf = (user: Row<UserRecord>) =>
    users.find(
      (other) =>
        !other.admin &&
        other.id !== user.id &&
        other.last_name === user.last_name,
    );
  const paired = contacts.flatMap((contact) => {
    const survivor = namesakeOf(contact.user);
    return survivor ? [{ ...contact, survivor }] : [];
  });
  const [namesake] = paired;
  const withAdmin = contacts.find(
    (contact) =>
      namesake !== undefined &&
      contact.user.id !== namesake.user.id &&
      contact.user.id !== namesake.survivor.id,
  );
  if (!namesake || !withAdmin) {
    throw new Error("no answers awaiting approval to pair as duplicates");
  }
  db.mergeCandidates.insert({
    first_user_id: namesake.survivor.id,
    second_user_id: namesake.user.id,
    create_date: namesake.at,
  });
  db.mergeCandidates.insert({
    first_user_id: ctx.adminIds[ctx.adminIds.length - 1] ?? ctx.adminIds[0],
    second_user_id: withAdmin.user.id,
    create_date: withAdmin.at,
  });
}

export function seedEcardTransactions(
  ctx: SeedContext,
  system: SystemRefs,
  ecards: EcardRefs,
  users: readonly Row<UserRecord>[],
): void {
  const { db, rng } = ctx;
  for (let index = 0; index < 30; index += 1) {
    const buyer = users[12 + ((index * 11) % 130)];
    const ecardId = ecards.ecardIds[index % 5] ?? ecards.ecardIds[0];
    const ecard = db.ecards.get(ecardId);
    if (!buyer || !ecard) continue;
    const at = daysBeforeAnchor(rng.int(0, 300), rng.int(0, 900));
    const recipients = index % 6 === 0 ? 3 : 1;
    const amount = ecard.first_amount * recipients;
    const status = index % 10 === 7 ? 4 : index % 10 === 9 ? 5 : 3;
    const wire = index % 9 === 4;
    const transaction = createTransaction(ctx, {
      amount,
      at,
      status,
      method: wire ? 2 : 0,
      paymentSettingsId: wire ? null : system.cardSettingsIds[0],
      bankAccountId: wire ? system.tryBankAccountIds[0] : null,
      type: TRANSACTION_TYPE.ecard,
    });
    const cargo = ecards.cargoEcardIds.includes(ecardId);
    const scheduled = index % 5 === 2;
    const honoree =
      index % 3 === 0
        ? "Prof. Dr. Kemal Ersoy"
        : `${rng.pick(["Ayşe", "Mehmet", "Zeynep", "Can"])} ${rng.pick(["Kaya", "Demir", "Polat"])}`;
    const sent =
      status === 3
        ? db.sentEmails.insert({
            message_id: rng.int(1_000_000, 9_999_999),
            status: rng.pick([1, 2]),
          }).id
        : null;
    const referring = index % 4 === 1;
    db.ecardTransactions.insert({
      user_id: index % 8 === 7 ? null : buyer.id,
      first_name: buyer.first_name,
      last_name: buyer.last_name,
      email: buyer.email,
      phone: buyer.phone,
      cargo_status: cargo
        ? status === 3
          ? rng.pick([1, 2, 3] as const)
          : 0
        : 0,
      cargo_number: cargo && status === 3 ? `YK${rng.digits(10)}` : "",
      cargo_company: cargo ? "Yurtiçi Kargo" : "",
      recipient_count: recipients,
      certificate_file: `https://kelder.example/media/sertifika/${index + 1}.pdf`,
      zip_file:
        recipients > 1
          ? `https://kelder.example/media/sertifika/${index + 1}.zip`
          : "",
      certificate_id: ecardId,
      sent_mail_id: sent,
      sent_mail_to_referring_id:
        referring && sent !== null
          ? db.sentEmails.insert({
              message_id: rng.int(1_000_000, 9_999_999),
              status: 2,
            }).id
          : null,
      added_by_id: wire ? ctx.adminIds[0] : null,
      delivery_time_mode: scheduled ? 1 : 0,
      delivery_date: scheduled ? istanbulDate(addDays(at, 10)) : null,
      news_via_phone: rng.chance(0.3),
      news_via_sms: rng.chance(0.4),
      news_via_email: rng.chance(0.8),
      recipient_list: Array.from({ length: recipients }, (_, recipient) => ({
        index: recipient,
        name: recipient === 0 ? honoree : `Alıcı ${recipient + 1}`,
        email: `alici${index}-${recipient}@eposta.example`,
        phone: "+905551112233",
        address: cargo ? "Barbaros Blv. No:45 D:3" : "",
        city: cargo ? "İstanbul" : "",
        district: cargo ? "Beşiktaş" : "",
        custom_message: "Adınıza burs fonuna bağış yapıldı.",
        ecard_date: istanbulDate(at),
        delivery_date: istanbulDate(scheduled ? addDays(at, 10) : at),
        cargo_number: "",
        cargo_company: "",
        cargo_status: 0,
        file: `https://kelder.example/media/sertifika/${index + 1}-${recipient}.pdf`,
        mail_message_id: rng.int(1_000_000, 9_999_999),
        sent_mail_id: sent ?? 0,
        mail_status: 1,
      })),
      bill_type: index % 7 === 3 ? 2 : index % 7 === 5 ? 1 : 0,
      billing_name: index % 7 === 3 ? "Boğaziçi Lojistik A.Ş." : "",
      tax_info: index % 7 === 3 ? "Beşiktaş VD - 1234567890" : "",
      billing_address: index % 7 === 3 ? "Barbaros Blv. No:120" : "",
      billing_district: index % 7 === 3 ? "Beşiktaş" : "",
      billing_city: index % 7 === 3 ? "İstanbul" : "",
      address: buyer.address,
      city: buyer.city_text,
      district: buyer.district_text,
      referring,
      third_name: "",
      referring_name: referring ? "Deniz Arslan" : "",
      referring_phone: referring ? "+905324445566" : "",
      referring_email: referring ? "deniz.arslan@eposta.example" : "",
      language: "tr",
      donor_type: buyer.corporate_type ? 2 : 1,
      delivery_to: cargo ? 1 : 0,
      delivery_to_name: honoree,
      custom_message: "Adınıza burs fonuna bağış yapıldı.",
      has_cargo: cargo,
      deliver_as_mail: true,
      deliver_as_cargo: cargo,
      ecard_date: istanbulDate(at),
      updated_by_id: index % 6 === 1 ? ctx.adminIds[0] : null,
      last_update_date: istanbulDateTime(at),
      transaction_id: transaction.id,
      marketing_channel_id:
        index % 3 === 1 ? rng.pick(system.marketingChannelIds) : null,
    });
  }
}
