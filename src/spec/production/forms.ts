import type { Json } from "../json";
import type { ProductionCorrection } from "./correct";

// The object production sends as a form question's `udv_question`. It is not
// `UserDefinedValues`: production sends a different set of properties, so the
// question gets its own schema, defined inline because a correction cannot add
// a component schema.
const UDV_QUESTION: Json = {
  type: "object",
  description:
    "The custom field behind a question of type 1. Production sends null for any other question.",
  properties: {
    id: { type: "integer", description: "custom field id" },
    key: { type: "string", description: "custom field key" },
    key_type: {
      type: "integer",
      description:
        "User defined value type\n- 0: text\n- 1: paragraph\n- 2: number\n- 3: date\n- 4: year\n- 5: date-time\n- 6: boolean\n- 7: select\n- 8: multiple select",
      enum: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    },
    slug: { type: "string", description: "custom field slug" },
    show_at_profile: {
      type: "boolean",
      description: "the field shows on the member's profile",
    },
    boolean_true_text: {
      type: "string",
      nullable: true,
      description: "true text of a boolean field, null for any other field",
    },
    boolean_false_text: {
      type: "string",
      nullable: true,
      description: "false text of a boolean field, null for any other field",
    },
    select_text: {
      type: "string",
      nullable: true,
      description: "select text of a select field, null for any other field",
    },
    options: {
      type: "array",
      description: "select options",
      items: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            nullable: true,
            description: "option id, null for an option that is not stored",
          },
          order: { type: "integer", description: "option order" },
          text: { type: "string", description: "option text" },
        },
      },
    },
    file_constraints: {
      type: "object",
      description: "what an uploaded file may be",
      properties: {
        allowed_extensions: {
          type: "array",
          description: "allowed file extensions, without a dot",
          items: { type: "string" },
        },
        max_file_size_mb: {
          type: "integer",
          description: "largest allowed file, in megabytes",
        },
      },
    },
    folder_id: {
      type: "integer",
      nullable: true,
      description: "folder id of an uploaded file field",
    },
    folder_name: {
      type: "string",
      nullable: true,
      description: "folder name of an uploaded file field",
    },
    oauth_credentials__application: {
      type: "string",
      nullable: true,
      description: "application of the field's OAuth credentials",
    },
    oauth_credentials__status: {
      type: "string",
      nullable: true,
      description: "status of the field's OAuth credentials",
    },
    oauth_credentials_id: {
      type: "integer",
      nullable: true,
      description: "id of the field's OAuth credentials",
    },
    translations: {
      type: "object",
      description:
        "Translated texts of the field, by language code. Each language holds an object of strings.",
      additionalProperties: {
        type: "object",
        additionalProperties: { type: "string" },
      },
    },
    validation: {
      type: "object",
      description: "limits on the field's value, only those that are set",
      properties: {
        limit: { type: "boolean", description: "the length is limited" },
        limit_value: { type: "integer", description: "longest length" },
        max: { type: "boolean", description: "the value has a maximum" },
        max_value: { type: "integer", description: "largest value" },
      },
    },
  },
};

const STATIC_QUESTION: Json = {
  type: "integer",
  description:
    "Static Question ID\n- 0: not a static question\n- 1: phone\n- 2: Identity Number\n- 30: District\n- 31: City\n- 32: Country\n- 33: Address\n- 34: Zip/Post Code\n- 4: Birthday\n- 6: Nationality\n- 7: secondary email\n- 40: work District\n- 41: work City\n- 42: work Country\n- 43: work Address\n- 44: work Zip/Post Code\n- 8: work phone\n- 9: home phone\n- 10: profile photo",
  enum: [
    0, 1, 2, 30, 31, 32, 33, 34, 4, 6, 7, 40, 41, 42, 43, 44, 8, 9, 10,
  ],
};

// `GET /form-answers` is the only operation that gets its `status` parameter
// replaced, so the pointer names the parameter itself, by position.
const FORM_ANSWERS_STATUS = "#/paths/~1form-answers/get/parameters/5";

// Corrections for the forms area: forms and form answers.
export const FORMS_CORRECTIONS: readonly ProductionCorrection[] = [
  {
    at: "#/components/schemas/Form",
    evidence:
      "report getFormList, page 1: created_by__name, created_by_id, update_date, updated_by__name and updated_by_id were each null on 3 rows (×3), where the spec allows a string or an integer. last_answer_date was null|string, which the spec already allows.",
    nullable: [
      "created_by_id",
      "created_by__name",
      "update_date",
      "updated_by_id",
      "updated_by__name",
    ],
  },
  {
    at: FORM_ANSWERS_STATUS,
    evidence:
      "probe P8a: GET /form-answers without status answered 200 with exactly the rows of status=answer (and not those of waiting_approval, rejected, refund or failed). The spec marks status required.",
    replace: {
      name: "status",
      in: "query",
      required: false,
      schema: {
        type: "string",
        description:
          "answer status\n- answer: list answers\n- waiting_approval: list answers waiting approval\n- rejected: list rejected answers\n- refund: list refunds\n- failed: list failed answers",
        default: "answer",
        enum: ["answer", "waiting_approval", "rejected", "refund", "failed"],
      },
    },
  },
  {
    at: "#/components/schemas/FormAnswer",
    evidence:
      "report getFormAnswerList, status=answer, last 365 days, page 1, and probe P16 and P8a: every row had transaction__amount, transaction_id, transaction__currency__display and transaction__currency__iso_code as null. The last two are undocumented. Their types are inferred from the sibling transaction__ fields.",
    properties: {
      transaction__currency__display: {
        type: "string",
        description: "payment currency display, null without a payment",
      },
      transaction__currency__iso_code: {
        type: "string",
        description: "payment currency ISO code, null without a payment",
      },
    },
    nullable: [
      "transaction_id",
      "transaction__amount",
      "transaction__currency__display",
      "transaction__currency__iso_code",
    ],
  },
  {
    at: "#/components/schemas/UsersAnswers",
    evidence:
      "report getUserAnswerList, user from getFormAnswerList, page 1: transaction__amount and transaction_id were null, where the spec allows a number and an integer. The report showed no currency fields on this list.",
    nullable: ["transaction_id", "transaction__amount"],
  },
  {
    at: "#/components/schemas/FormAnswerDetails",
    evidence:
      "report getFormAnswerDetails and probe P17 (one answer of status=answer): transaction null and email_verification null; city, country and ip_address strings; respond_date a date-time string; responded_by an object with id, membership_no and name; source the integer 0. Those six are undocumented. city, country, respond_date and responded_by are nullable by inference only: an answer nobody has responded to has no response date or responder, and a location can be unknown. ip_address and source are not.",
    properties: {
      city: { type: "string", description: "city the answer was sent from" },
      country: {
        type: "string",
        description: "country the answer was sent from",
      },
      ip_address: {
        type: "string",
        description: "IP address the answer was sent from",
      },
      respond_date: {
        type: "string",
        format: "date-time",
        description: "date of the response, null until someone responds",
      },
      responded_by: {
        $ref: "#/components/schemas/UserFormAnswerDetails",
        description: "who responded, null until someone responds",
      },
      source: {
        type: "integer",
        description: "where the answer came from, 0 is the only value seen",
      },
    },
    nullable: [
      "transaction",
      "email_verification",
      "city",
      "country",
      "respond_date",
      "responded_by",
    ],
  },
  {
    at: "#/components/schemas/FormQuestion",
    evidence:
      "report getFormAnswerDetails and probe P17 (19 questions of one answer): additional_info_for_question, depends_on_another_question_answer and show_other_for_multiple were booleans, dependent_question_option_ids an array, section_id an integer and another_question null (all undocumented, so its type is inferred). custom_question was null on all 19, information null on 18 of them and a string on one. static_question was 0 on 15 (the spec enum lacks 0) and 6, 1, 4 or 2 on the rest. udv_question was null on 4 and an object on 15, with another set of properties than UserDefinedValues: no name, type, for, group, display_for, udv_id, value or changable_by_users, but key, slug, show_at_profile, file_constraints, folder_id, folder_name, oauth_credentials__application, oauth_credentials__status, oauth_credentials_id, translations and validation. boolean_true_text and boolean_false_text were null and select_text null|string. options[].id was integer|null. The oauth_credentials and folder types are inferred, as all were null.",
    properties: {
      additional_info_for_question: {
        type: "boolean",
        description: "the question has additional information",
      },
      another_question: {
        type: "integer",
        description:
          "id of the question this one stands in for, null for none. The type is inferred.",
      },
      dependent_question_option_ids: {
        type: "array",
        description: "ids of the options that other questions depend on",
        items: { type: "integer" },
      },
      depends_on_another_question_answer: {
        type: "boolean",
        description: "the question shows depending on another answer",
      },
      section_id: {
        type: "integer",
        description: "id of the form section the question sits in",
      },
      show_other_for_multiple: {
        type: "boolean",
        description: "a multiple choice question offers an Other option",
      },
      static_question: STATIC_QUESTION,
      udv_question: { anyOf: [UDV_QUESTION, { type: "null" }] },
    },
    nullable: ["another_question", "custom_question", "information"],
  },
  {
    at: "#/components/schemas/SentEmail",
    evidence:
      "report getFormAnswerDetails and probe P17: sent_mail.message_id was a string, where the spec says integer. SentEmail also describes the sent_mail of donation and micro donation details and of ticket sales, which the report did not reach.",
    properties: {
      message_id: { type: "string", description: "Sent email message id" },
    },
  },
];
