import type { ProductionCorrection } from "./correct";

// Corrections for the dues area: membership dues, debts and debt categories.
//
// `Transaction` and `UserReference` are shared with giving (donation and micro
// donation details), ticket sales and form answers. Production showed them
// only on dues and debts, but they are one schema, so every domain's
// projection carries the new fields.
//
// The evidence names the sections of the `parity:prod --live` report and the
// shape probe: the `== dues ==` section of the report, and the probes P7b
// (unknown user), P8b (no status), P11 (GET /subscriptions), P12
// (GET /subscription/{id}, 4 rows, union), P13 (GET /user/{id}/subscriptions),
// P14 (GET /debts) and P15 (GET /debt/{id}, 5 rows, union).

// getDebtCategoryList and getDebtCategoryUsage need no correction: production
// has no debt categories, so there is nothing to compare.
export const DUES_CORRECTIONS: readonly ProductionCorrection[] = [
  {
    at: "#/paths/~1subscriptions/get/parameters/0",
    evidence:
      "P8b: GET /subscriptions with a date window and no status answered 200 with exactly the status=paid rows. The spec marks status required with a default of paid.",
    replace: {
      name: "status",
      in: "query",
      description:
        "what kind of membership dues should be listed\n- paid: for payments\n- refund: for refunds\n- failed: for failed payment transactions\n\nProduction does not require it: without it the answer is the paid list.\n",
      required: false,
      schema: {
        type: "string",
        default: "paid",
        enum: ["paid", "refund", "failed"],
      },
    },
  },
  {
    at: "#/components/responses/MembershipDuesListResponse/content/application~1json/schema",
    evidence:
      "report getMembershipDuesList and P11: the list is under payment_list (19 nested paths), and the body has total. The spec calls it subscription_list.",
    rename: { subscription_list: "payment_list" },
  },
  {
    at: "#/components/schemas/MembershipDues",
    evidence:
      "P11 and P8b, 20 rows of GET /subscriptions?status=paid: email, phone, tckno and details are null|string, and period is null|date. Every other documented key is non-null. The rows never carried transaction__refund_date or the transaction__transaction_error__* keys, which are kept for the refund and failed lists that no probe read.",
    nullable: ["email", "phone", "tckno", "details", "period"],
  },
  {
    at: "#/components/schemas/UsersMembershipDues",
    evidence:
      "P13, GET /user/{a paying user}/subscriptions with listing a, p and d: bill_no, due_date and remove_note are always null, details is null|string, period is null|date, and the rows carry transaction__conversion_rate, transaction__converted_amount and transaction__converted_currency__display (always null) and transaction__converted (boolean). Rows never carried transaction__fonzip_id. The type of the three null conversion fields is inferred: production only showed null.",
    properties: {
      remove_note: {
        type: "string",
        description: "Why the debt was removed, for a removed debt",
      },
      transaction__converted: {
        type: "boolean",
        description: "Whether the transaction was converted to another currency",
      },
      transaction__conversion_rate: {
        type: "number",
        description: "Conversion rate of a converted transaction",
      },
      transaction__converted_amount: {
        type: "number",
        description: "Amount of a converted transaction in the other currency",
      },
      transaction__converted_currency__display: {
        type: "string",
        description: "Currency a transaction was converted to",
      },
    },
    remove: ["transaction__fonzip_id"],
    nullable: [
      "bill_no",
      "due_date",
      "details",
      "period",
      "remove_note",
      "transaction__conversion_rate",
      "transaction__converted_amount",
      "transaction__converted_currency__display",
    ],
  },
  {
    at: "#/components/schemas/MembershipDueDebts",
    evidence:
      "report getMembershipDueDebtsList and P14, 20 rows of GET /debts: details is null on all 20 (the spec allows string), and remove_note is an undocumented property, null on all 20. debt_category_id and debt_category__name are null too, which the spec already allows. user__total_financial is integer|number, which the spec's number covers.",
    properties: {
      remove_note: {
        type: "string",
        description: "Why the debt was removed, for a removed debt",
      },
    },
    nullable: ["details", "remove_note"],
  },
  {
    at: "#/components/schemas/MembershipDueDetails",
    evidence:
      "report getDebtDetails and P12 and P15 (9 objects): create_date (date-time) and last_update_date (null|date-time) are undocumented. bill_no, card_info, details, due_date, recurring_next_cycle, order_id, tckno, email, phone, updated_by_id and period are null in some or all of the objects. remove_note, status_name, order_id and debt_category are already documented.",
    properties: {
      create_date: {
        type: "string",
        format: "date-time",
        description: "Record creation timestamp",
      },
      last_update_date: {
        type: "string",
        format: "date-time",
        description: "Last update timestamp; null while the record was never updated",
      },
    },
    nullable: [
      "bill_no",
      "card_info",
      "details",
      "due_date",
      "recurring_next_cycle",
      "order_id",
      "tckno",
      "email",
      "phone",
      "updated_by_id",
      "period",
      "last_update_date",
    ],
  },
  {
    at: "#/components/schemas/Transaction",
    evidence:
      "report getDebtDetails and P12 and P15 (9 objects): association_id (integer), cardholder_name, city, country (null|string), tds (boolean) and transaction_type (integer, 2 on dues and debts) are undocumented. conversation_id is a string of 15 digits. auth_code, bank_account (object {currency_id, id, name}), bank_account_id, bin_number, ip_address, last_four, order_id, payment_method, payment_settings, payment_settings_id, provision_no, receipt_no, reference_id, refund_date, refund_reason, refunded_by_id and transaction_id are null in some or all of them. currency.iyzi_code, currency.last_update_date and fonzip_id_hashed, which the mock sends, were not in the 9 objects: left as they are.",
    properties: {
      conversation_id: { type: "string", description: "conversation id" },
      association_id: {
        type: "integer",
        description: "id of the association the transaction belongs to",
      },
      cardholder_name: {
        type: "string",
        description: "name on the card; null when not paid by card",
      },
      city: { type: "string", description: "city the payment was made from" },
      country: {
        type: "string",
        description: "country the payment was made from",
      },
      tds: {
        type: "boolean",
        description: "paid through 3D Secure",
      },
      transaction_type: {
        type: "integer",
        description:
          "what the transaction pays for: 2 for membership dues and debts",
      },
    },
    nullable: [
      "auth_code",
      "bank_account",
      "bank_account_id",
      "bin_number",
      "cardholder_name",
      "city",
      "country",
      "ip_address",
      "last_four",
      "order_id",
      "payment_method",
      "payment_settings",
      "payment_settings_id",
      "provision_no",
      "receipt_no",
      "reference_id",
      "refund_date",
      "refund_reason",
      "refunded_by_id",
      "transaction_id",
    ],
  },
  {
    at: "#/components/schemas/UserReference",
    evidence:
      "report getDebtDetails and P12 and P15 (9 objects): tax_department (always null) and total_financial (integer) are undocumented. tckno is null in some or all of them, and email, phone and profile_pic are null|string. The type of tax_department is inferred: production only showed null.",
    properties: {
      tax_department: {
        type: "string",
        description: "tax department of a corporate user",
      },
      total_financial: {
        type: "number",
        description: "users current balance amount",
      },
    },
    nullable: ["tckno", "email", "phone", "profile_pic", "tax_department"],
  },
];
