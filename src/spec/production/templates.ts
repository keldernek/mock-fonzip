import type { ProductionCorrection } from "./correct";

// Corrections for the templates and webhooks areas.
//
// Webhooks need none: production has no webhook, so `listWebhooks` answered an
// empty `webhook_list` and `getWebhookDetails` had nothing to compare.
//
// All three schemas below are response-only. `Template` is the body of
// `getTemplateDetails` alone, and the `createTemplate` and `updateTemplate`
// requests use `components.requestBodies.Template`, a separate schema, so a
// request still refuses null and the response-only fields.
const LIST_RESPONSE =
  "#/components/responses/TemplateListResponse/content/application~1json/schema";

const DATE_TIME = { type: "string", format: "date-time" } as const;

export const TEMPLATES_CORRECTIONS: readonly ProductionCorrection[] = [
  {
    at: LIST_RESPONSE,
    evidence:
      'listTemplates: prod sent result as a string ("ok") beside template_list and total',
    properties: {
      result: { type: "string", description: "ok" },
    },
  },
  {
    at: "#/components/schemas/TemplateList",
    evidence:
      "listTemplates, page 1 of 20 rows: prod sent category__name and category_id null on 8 rows, subject null on 9 (SMS templates have no subject), and the undocumented create_date (string, every row), update_date (null on 18, string on 2), created_by__name and created_by_id (null on 17, string and integer on 3), updated_by__name and updated_by_id (null on 18, string and integer on 2)",
    properties: {
      create_date: {
        ...DATE_TIME,
        description: "Template creation time, in UTC with milliseconds",
      },
      update_date: {
        ...DATE_TIME,
        description:
          "Last update time, in UTC with milliseconds. Null until the template is updated",
      },
      created_by__name: {
        type: "string",
        description: "Name of the user who created the template",
      },
      created_by_id: {
        type: "integer",
        description: "Id of the user who created the template",
      },
      updated_by__name: {
        type: "string",
        description: "Name of the user who last updated the template",
      },
      updated_by_id: {
        type: "integer",
        description: "Id of the user who last updated the template",
      },
    },
    nullable: [
      "subject",
      "category_id",
      "category__name",
      "update_date",
      "created_by__name",
      "created_by_id",
      "updated_by__name",
      "updated_by_id",
    ],
  },
  {
    at: "#/components/schemas/Template",
    evidence:
      "getTemplateDetails, first template of listTemplates, and 20 templates in the probe: prod sent subject, btn_text, btn_operation_detail and category_id null; badge_icon, design, heading and preheader (undocumented) null on all 20; references (undocumented) as an empty object on all 20; and never sent category__name (0 of 20)",
    remove: ["category__name"],
    properties: {
      badge_icon: {
        type: "string",
        description:
          "Badge icon. Production sent null on every template, so the type of a value is a guess",
      },
      design: {
        description:
          "Editor design of the template. Production sent null on every template, so an object or a string is a guess",
        anyOf: [{ type: "object" }, { type: "string" }],
      },
      heading: {
        type: "string",
        description:
          "Heading. Production sent null on every template, so the type of a value is a guess",
      },
      preheader: {
        type: "string",
        description:
          "Preheader. Production sent null on every template, so the type of a value is a guess",
      },
      references: {
        type: "object",
        description:
          "What refers to the template. Production sent an empty object on every template",
      },
    },
    nullable: [
      "subject",
      "btn_text",
      "btn_operation_detail",
      "category_id",
      "badge_icon",
      "design",
      "heading",
      "preheader",
    ],
  },
  {
    at: "#/components/schemas/Template/properties/translations",
    evidence:
      "getTemplateDetails: prod keyed translations by language code (de, en, es, fr, it, nl, pt, ru and tr in the probe) and not by the placeholder language_code. Each language is an object of strings, and tr's three values may be null",
    replace: {
      type: "object",
      description:
        "Translations of the template, by language code. Each language maps a field name (subject, message, btn_text) to its text, or to null",
      additionalProperties: {
        type: "object",
        additionalProperties: { type: "string", nullable: true },
      },
    },
  },
];
