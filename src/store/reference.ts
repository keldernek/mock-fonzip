import type {
  CurrencyRecord,
  TemplateCategory,
  TransactionErrorGroup,
} from "./records";

export const CURRENCIES: readonly CurrencyRecord[] = [
  {
    id: 1,
    name: "Türk Lirası",
    short: "TL",
    display: "TRY",
    iyzi_code: "TRY",
    iso_code: "TRY",
    value: 1,
    last_update_date: "2026-11-01T08:00:00+03:00",
  },
  {
    id: 2,
    name: "Amerikan Doları",
    short: "$",
    display: "USD",
    iyzi_code: "USD",
    iso_code: "USD",
    value: 41.92,
    last_update_date: "2026-11-01T08:00:00+03:00",
  },
  {
    id: 3,
    name: "Euro",
    short: "€",
    display: "EUR",
    iyzi_code: "EUR",
    iso_code: "EUR",
    value: 48.65,
    last_update_date: "2026-11-01T08:00:00+03:00",
  },
  {
    id: 4,
    name: "İngiliz Sterlini",
    short: "£",
    display: "GBP",
    iyzi_code: "GBP",
    iso_code: "GBP",
    value: 55.4,
    last_update_date: "2026-11-01T08:00:00+03:00",
  },
];

export const TRY_CURRENCY_ID = 1;

export function currencyById(id: number): CurrencyRecord {
  const found = CURRENCIES.find((currency) => currency.id === id);
  if (!found) throw new Error(`no currency ${id}`);
  return found;
}

export const TEMPLATE_CATEGORIES: readonly TemplateCategory[] = [
  { id: 1, name: "Bağış" },
  { id: 2, name: "Aidat" },
  { id: 3, name: "Etkinlik" },
  { id: 4, name: "Genel" },
];

export const PAYMENT_STATUS = {
  initialized: 0,
  processing: 1,
  threeDSecure: 2,
  successful: 3,
  refunded: 4,
  failed: 5,
  removed: 6,
} as const;

export type PaymentStatus =
  (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const PAYMENT_STATUS_DISPLAY: Readonly<Record<PaymentStatus, string>> = {
  0: "Başlatıldı",
  1: "İşleniyor",
  2: "3D Secure Başlatıldı",
  3: "Başarılı",
  4: "İade Edildi",
  5: "Başarısız",
  6: "Silindi",
};

export const PAYMENT_ERRORS: readonly {
  readonly code: string;
  readonly text: string;
  readonly group: Exclude<TransactionErrorGroup, null>;
}[] = [
  { code: "51", text: "Yetersiz bakiye", group: 10 },
  { code: "43", text: "Çalıntı kart", group: 20 },
  { code: "54", text: "Kartın son kullanma tarihi geçmiş", group: 21 },
  { code: "3D-01", text: "3D Secure doğrulaması başarısız", group: 40 },
  { code: "91", text: "Banka sistemine ulaşılamadı", group: 50 },
];
