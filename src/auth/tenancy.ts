import type { components } from "../generated/openapi";
import type { Scope } from "../spec/scopes";

export type AssociationInfo = components["schemas"]["AssociationInfo"];

export const ORG_SLUGS = ["kelder", "ornek"] as const;
export type OrgSlug = (typeof ORG_SLUGS)[number];
export type Plan = "active" | "lapsed";

export interface Organisation {
  readonly slug: OrgSlug;
  readonly defaultPlan: Plan;
  readonly info: Required<AssociationInfo>;
}

export type ScopeSet = readonly ["read"] | readonly ["read", "write"];

export interface ApiKey {
  readonly id: string;
  readonly org: OrgSlug;
  readonly label: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly scopes: ScopeSet;
}

export interface ClientCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
}

export interface Credentials {
  readonly readWrite: ClientCredentials;
  readonly readOnly: ClientCredentials;
  readonly lapsed: ClientCredentials;
}

export function credentialsFromEnv(
  env: Record<string, string | undefined> = process.env,
): Credentials {
  const pair = (prefix: string, id: string): ClientCredentials => ({
    clientId: env[`${prefix}_CLIENT_ID`] ?? id,
    clientSecret: env[`${prefix}_CLIENT_SECRET`] ?? `${id}-secret`,
  });
  return {
    readWrite: pair("MOCK_FONZIP", "kelder-local"),
    readOnly: pair("MOCK_FONZIP_READONLY", "kelder-readonly"),
    lapsed: pair("MOCK_FONZIP_LAPSED", "ornek-lapsed"),
  };
}

export const ORGANISATIONS: Readonly<Record<OrgSlug, Organisation>> = {
  kelder: {
    slug: "kelder",
    defaultPlan: "active",
    info: {
      id: 1,
      name: "kelder",
      display_name: "Kabataş Erkek Liseliler Derneği",
      display_name_translations: {
        en: "Kabataş Boys High School Alumni Association",
      },
      details:
        "Kabataş Erkek Lisesi mezunlarını bir araya getiren, burs ve dayanışma çalışmaları yürüten dernek.",
      details_translations: {
        en: "Brings Kabataş Erkek Lisesi alumni together and runs scholarship and solidarity programmes.",
      },
      phone: "+902122270101",
      email: "info@kelder.example",
      url: "https://kelder.example",
      facebook_url: "https://facebook.com/kelder.example",
      twitter_url: "https://twitter.com/kelder_example",
      instagram_url: "https://instagram.com/kelder.example",
      linkedin_url: "https://linkedin.com/company/kelder-example",
      locale: "tr",
      footer_address: "Ortaköy Mah. Muallim Naci Cad. No:1, Beşiktaş/İstanbul",
      footer_phone: "0212 227 01 01",
      footer_email: "iletisim@kelder.example",
      whatsapp_number: "+905321234567",
      youtube_url: "https://youtube.com/@kelder.example",
      result: "ok",
    },
  },
  ornek: {
    slug: "ornek",
    defaultPlan: "lapsed",
    info: {
      id: 2,
      name: "ornek",
      display_name: "Örnek Dayanışma Derneği",
      display_name_translations: { en: "Örnek Solidarity Association" },
      details: "Planı sona ermiş örnek bir dernek.",
      details_translations: { en: "A sample association whose plan lapsed." },
      phone: "+903122220202",
      email: "info@ornek.example",
      url: "https://ornek.example",
      facebook_url: "",
      twitter_url: "",
      instagram_url: "",
      linkedin_url: "",
      locale: "tr",
      footer_address: "Kızılay Mah. Atatürk Blv. No:10, Çankaya/Ankara",
      footer_phone: "0312 222 02 02",
      footer_email: "info@ornek.example",
      whatsapp_number: "",
      youtube_url: "",
      result: "ok",
    },
  },
};

export function apiKeysFor(credentials: Credentials): readonly ApiKey[] {
  return [
    {
      id: "kelder-read-write",
      org: "kelder",
      label: "kelder read-write key",
      ...credentials.readWrite,
      scopes: ["read", "write"],
    },
    {
      id: "kelder-read-only",
      org: "kelder",
      label: "kelder read-only key",
      ...credentials.readOnly,
      scopes: ["read"],
    },
    {
      id: "ornek-read-write",
      org: "ornek",
      label: "ornek read-write key (plan lapsed)",
      ...credentials.lapsed,
      scopes: ["read", "write"],
    },
  ];
}

export function hasScope(key: ApiKey, scope: Scope): boolean {
  return key.scopes.some((granted) => granted === scope);
}

export interface Tenancy {
  readonly keys: readonly ApiKey[];
  organisation(slug: OrgSlug): Organisation;
  plan(slug: OrgSlug): Plan;
  setPlan(slug: OrgSlug, plan: Plan): void;
  findKey(clientId: string): ApiKey | undefined;
  resetPlans(): void;
}

export function createTenancy(credentials: Credentials): Tenancy {
  const keys = apiKeysFor(credentials);
  const plans = new Map<OrgSlug, Plan>();
  const resetPlans = (): void => {
    for (const slug of ORG_SLUGS)
      plans.set(slug, ORGANISATIONS[slug].defaultPlan);
  };
  resetPlans();
  return {
    keys,
    organisation: (slug) => ORGANISATIONS[slug],
    plan: (slug) => plans.get(slug) ?? ORGANISATIONS[slug].defaultPlan,
    setPlan(slug, plan) {
      plans.set(slug, plan);
    },
    findKey: (clientId) => keys.find((key) => key.clientId === clientId),
    resetPlans,
  };
}

export function isOrgSlug(value: string): value is OrgSlug {
  return ORG_SLUGS.some((slug) => slug === value);
}
