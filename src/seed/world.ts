import type { OrgSlug } from "../auth/tenancy";
import { createRng } from "../core/rng";
import { createStore, orgStore, type Store } from "../store/store";
import { seedCampaigns, seedEcards } from "./campaigns";
import type { SeedContext } from "./context";
import { daysBeforeAnchor, istanbulDateTime } from "./dates";
import { seedDebtTransactions, seedDues, seedEvents } from "./dues-events";
import { seedEcardTransactions, seedForms } from "./forms-ecards";
import {
  seedDonations,
  seedGivingCatalog,
  seedMicroDonationVariety,
} from "./giving";
import { iban, mobilePhone, tcKimlikNo } from "./identity";
import { seedBankTransactions, seedTimeline, settleTotals } from "./ledger";
import {
  ADMIN_COUNT,
  seedCommunicationPermissions,
  seedContactProfiles,
  seedTags,
  seedUserDefinedValues,
  seedUsers,
} from "./people";
import { seedSystem, seedWebhooks } from "./system";

export interface SeedOptions {
  readonly seed: number;
  readonly selfOrigin: string;
  readonly apiKeyIds: Readonly<Record<OrgSlug, readonly string[]>>;
}

function seedKelder(store: Store, options: SeedOptions): void {
  const db = orgStore(store, "kelder");
  const rng = createRng(options.seed);
  const bootstrap: SeedContext = {
    db,
    rng,
    selfOrigin: options.selfOrigin,
    adminIds: [store.users.firstId],
  };
  seedUserDefinedValues(bootstrap);
  const users = seedUsers(bootstrap);
  const admins = users.slice(0, ADMIN_COUNT).map((user) => user.id);
  const ctx: SeedContext = {
    ...bootstrap,
    adminIds: [admins[0] ?? users[0].id, ...admins.slice(1)],
  };
  const tagIds = seedTags(ctx, users);
  seedCommunicationPermissions(ctx, users);
  const system = seedSystem(ctx, options.apiKeyIds.kelder);
  seedWebhooks(ctx);
  const catalog = seedGivingCatalog(ctx, system);
  const ecards = seedEcards(ctx, system);
  const campaigns = seedCampaigns(
    ctx,
    system,
    users,
    catalog.scholarshipCategoryId,
    ecards,
  );
  seedDonations(ctx, system, catalog, campaigns, users);
  seedDues(ctx, system, users);
  seedEvents(ctx, system, users, tagIds);
  seedForms(ctx, users, system);
  seedEcardTransactions(ctx, system, ecards, users);
  seedBankTransactions(ctx, system);
  seedTimeline(ctx, users);
  settleTotals(ctx);
  seedMicroDonationVariety(ctx, system, catalog, campaigns);
  seedDebtTransactions(ctx);
  seedContactProfiles(ctx, users);
}

function seedOrnek(store: Store, options: SeedOptions): void {
  const db = orgStore(store, "ornek");
  const rng = createRng(options.seed + 7);
  const created = istanbulDateTime(daysBeforeAnchor(400));
  const people = [
    ["Hatice", "Güler"],
    ["Recep", "Altun"],
    ["Sevgi", "Erdem"],
  ] as const;
  for (const [index, [first, last]] of people.entries()) {
    db.users.insert({
      corporate_type: false,
      first_name: first,
      last_name: last,
      address: "Atatürk Blv. No:10",
      birthday: "1980-05-12",
      total_financial: 0,
      email: `${first.toLowerCase()}@ornek.example`,
      phone: mobilePhone(rng),
      membership_no: index + 1,
      tckno: tcKimlikNo(rng),
      apply_date: created,
      join_date: created,
      user_defined_values: {},
      nationality_text: "Türkiye Cumhuriyeti",
      home_phone_first: "",
      post_code: "06420",
      district_text: "Çankaya",
      city_text: "Ankara",
      country_text: "Türkiye",
      work_phone: "",
      work_address: "",
      work_post_code: "",
      private: false,
      work_district_text: "",
      work_city_text: "",
      work_country_text: "",
      email_second: "",
      admin: index === 0,
      profile_pic: null,
    });
  }
  db.tags.insert({ name: "Üye", color: "tag-2" });
  db.tags.insert({ name: "Bağışçı", color: "tag-5" });
  db.paymentSettings.insert({
    name: "Sanal POS",
    provider_no: "vpos",
    status: 0,
    business_account: true,
  });
  db.bankAccounts.insert({
    name: "Dernek Hesabı",
    bank_name: "Halkbank",
    iban: iban(rng),
    details: "",
    currency_id: 1,
    business_account: true,
    create_date: created,
    created_by_id: null,
    update_date: null,
    updated_by_id: null,
  });
}

export function seedWorld(options: SeedOptions): Store {
  const store = createStore();
  seedKelder(store, options);
  seedOrnek(store, options);
  return store;
}
