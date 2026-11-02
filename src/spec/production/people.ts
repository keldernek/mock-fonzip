import type { Json } from "../json";
import type { ProductionCorrection } from "./correct";

function text(description: string): Json {
  return { type: "string", description };
}

function flag(description: string): Json {
  return { type: "boolean", description };
}

function date(description: string): Json {
  return { type: "string", format: "date", description };
}

function dateTime(description: string): Json {
  return { type: "string", format: "date-time", description };
}

// What a select field holds in `user_defined_values`: the chosen option.
const UDV_OPTION: Json = {
  type: "object",
  description: "the chosen option of a select field",
  required: ["id", "order", "text"],
  properties: {
    id: { type: "integer", description: "option id" },
    order: { type: "integer", description: "options order" },
    text: { type: "string", description: "option text" },
  },
};

// One entry of a communication permission lookup. Production sent four keys
// for the email channel. The same four, with `phone`, are inferred for sms
// and phone. `phone_slug` stays documented because no phone lookup has been
// seen. The phone and sms dates are null until the person answers, as they
// are in the user list.
const PERMISSION_ITEM: Json = {
  type: "object",
  properties: {
    id: { type: "integer", description: "user id" },
    email: { type: "string", format: "email", description: "email" },
    phone: text("phone in international format"),
    phone_slug: text("phone in E164 format"),
    allow_comm_via_phone: flag("if user has communication permission via phone"),
    allow_comm_via_phone_date: {
      type: "string",
      format: "date-time",
      nullable: true,
      description: "phone communication permission update date",
    },
    allow_comm_via_sms: flag("if user has communication permission via sms"),
    allow_comm_via_sms_date: {
      type: "string",
      format: "date-time",
      nullable: true,
      description: "sms communication permission update date",
    },
    allow_comm_via_email: flag("if user has communication permission via email"),
    allow_comm_via_email_date: dateTime(
      "email communication permission update date",
    ),
  },
};

const PERMISSION_LOOKUP = "~1communication-permissions~1{permission_type}~1{permission_value}";

// Corrections for the people area: users, user-defined values, timeline,
// tags and communication permissions.
export const PEOPLE_CORRECTIONS: readonly ProductionCorrection[] = [
  {
    at: "#/components/requestBodies/GetUserList/content/application~1json/schema",
    evidence:
      "probe P2: POST /users without values_list answers 400 `values_list parametresi eksik`; the report's search with every documented column answers 200.",
    require: ["values_list"],
  },
  {
    at: "#/components/schemas/User",
    evidence:
      "report people getUserList (POST /users, page 1, 20 rows, order_by=-id, every documented column) and probe P2. Production sends allow_comm_via_email, allow_comm_via_email_date, allow_comm_via_phone, allow_comm_via_phone_date (null on 3 of 20 rows), allow_comm_via_sms, allow_comm_via_sms_date (null on 3), city_text (null on 20), country_text (null on 3), district_text (null on 20), last_login_date, last_update_date, nationality_text (null on 11), profile_pic (null on 11), work_address (null on 7), work_city_text (null on 8), work_country_text (null on 6), work_district_text (null on 6) and work_phone (null on 20), none of them documented. address is null on 20 rows, birthday on 8 and tckno on 11. apply_date and join_date are YYYY-MM-DD, not date-times. last_login_date is nullable by decision, since a user may never have logged in.",
    properties: {
      allow_comm_via_email: flag("if user has communication permission via email"),
      allow_comm_via_email_date: dateTime(
        "email communication permission update date",
      ),
      allow_comm_via_phone: flag("if user has communication permission via phone"),
      allow_comm_via_phone_date: dateTime(
        "phone communication permission update date",
      ),
      allow_comm_via_sms: flag("if user has communication permission via sms"),
      allow_comm_via_sms_date: dateTime(
        "sms communication permission update date",
      ),
      city_text: text("City"),
      country_text: text("Country"),
      district_text: text("District"),
      nationality_text: text("nationality"),
      last_login_date: dateTime("last login date"),
      last_update_date: dateTime("profile last update date"),
      profile_pic: text("profile picture URL"),
      work_address: text("Work address"),
      work_city_text: text("Work city"),
      work_country_text: text("Work country"),
      work_district_text: text("Work district"),
      work_phone: text("Work phone"),
      apply_date: date("users apply date"),
      join_date: date("users join date"),
    },
    nullable: [
      "address",
      "birthday",
      "tckno",
      "allow_comm_via_phone_date",
      "allow_comm_via_sms_date",
      "city_text",
      "country_text",
      "district_text",
      "nationality_text",
      "last_login_date",
      "profile_pic",
      "work_address",
      "work_city_text",
      "work_country_text",
      "work_district_text",
      "work_phone",
    ],
  },
  {
    at: "#/components/schemas/UserDetails",
    evidence:
      "report people getUserDetails (GET /user/{user_id}, the newest user of the -id list) and probe P3 over 6 users. Production sent null for address, city_text, country_text, district_text, email_second, home_phone_first, post_code, work_address, work_city_text, work_country_text, work_district_text, work_phone and work_post_code, and null or a string for birthday, tckno, nationality_text, allow_comm_via_phone_date and allow_comm_via_sms_date. It also sends last_update_date, a date-time the spec lacks, and apply_date and join_date as YYYY-MM-DD. user_defined_values holds an integer, a string, or {id, order, text} for a select field, never an array or a boolean.",
    properties: {
      last_update_date: dateTime("profile last update date"),
      apply_date: date("users application date"),
      join_date: date("users join date"),
      user_defined_values: {
        type: "object",
        description:
          "user defined values as key value pairs. The key is the field's key (UserDefinedValues.value). A select field holds its chosen option.",
        additionalProperties: {
          description: "UDV Key (value*) paired with corresponding value",
          anyOf: [{ type: "integer" }, { type: "string" }, UDV_OPTION],
        },
      },
    },
    nullable: [
      "address",
      "birthday",
      "tckno",
      "city_text",
      "country_text",
      "district_text",
      "nationality_text",
      "email_second",
      "home_phone_first",
      "post_code",
      "work_address",
      "work_city_text",
      "work_country_text",
      "work_district_text",
      "work_phone",
      "work_post_code",
      "allow_comm_via_phone_date",
      "allow_comm_via_sms_date",
    ],
  },
  {
    at: "#/components/schemas/UserDefinedValues",
    evidence:
      "report people getUserDefinedValuesList (GET /user-defined-values, 45 rows) and probe P1. boolean_true_text and boolean_false_text are null on 45 rows, select_text is null on 33 and a string on 12, so all three are nullable texts. `for` is select_w_bool on 12 rows, text, numeric or date. Production adds validation, an object that is {} on 43 rows, {limit, limit_value} on 1 text field and {max, max_value} on 1 numeric field. It never sends changable_by_users (0 of 45 rows).",
    remove: ["changable_by_users"],
    properties: {
      for: {
        type: "string",
        description: "input type for key",
        enum: ["text", "numeric", "date", "select", "select_w_bool"],
      },
      boolean_true_text: text("True text for boolean field"),
      boolean_false_text: text("False text for boolean field"),
      select_text: text("Select text for select and multiple select fields"),
      validation: {
        type: "object",
        description:
          "Limits of the field. Empty when the field has none. A text field can limit its length, a numeric field can cap its value.",
        properties: {
          limit: flag("if the text length is limited"),
          limit_value: { type: "integer", description: "maximum text length" },
          max: flag("if the value has an upper bound"),
          max_value: { type: "integer", description: "maximum value" },
        },
      },
    },
    nullable: ["boolean_true_text", "boolean_false_text", "select_text"],
  },
  {
    at: "#/components/schemas/Timeline",
    evidence:
      "report people getUsersTimeline (3 rows) and probe P4 over 6 users, by event_type. Rows of event types 1 and 14 always carry calendarevent__completed, calendarevent__date, calendarevent__id, calendarevent__note, issuer__first_name, issuer__last_name, tag__color, tag__name and tag_id, null when empty (2 rows each for the calendar and tag keys, 3 for issuer_*). Every row carries pinned, a boolean. details is null on the lead row (event_type 27, id `lead-<n>`), which also sends issuer__first_name and issuer__last_name as null.",
    properties: {
      pinned: flag("if the event is pinned to the top of the timeline"),
    },
    nullable: [
      "details",
      "issuer__first_name",
      "issuer__last_name",
      "calendarevent__id",
      "calendarevent__note",
      "calendarevent__date",
      "calendarevent__completed",
      "tag_id",
      "tag__name",
      "tag__color",
    ],
  },
  {
    at: "#/components/responses/CommunicationPermissionList/content/application~1json/schema/properties/permission_list",
    evidence:
      "report people listChangedCommunicationPermissions and probe P5: GET /communication-permissions/email?days=7 answers 200 with total and permission_list, an array (empty). days=30 and days=365 answer 400.",
    replace: {
      type: "array",
      description: "permissions changed in the window, newest change first",
      items: PERMISSION_ITEM,
    },
  },
  {
    // The lookup shares its 200 with the list, but production answers it
    // without total. The 200 is a $ref, so the correction replaces the
    // operation's responses and gives the lookup an inline 200.
    at: `#/paths/${PERMISSION_LOOKUP}/get/responses`,
    evidence:
      "report people getCommunicationPermissions and probe P6a/P6b: GET /communication-permissions/email/{email} answers 200 {permission_list: [{id, email, allow_comm_via_email, allow_comm_via_email_date}]} with no total, and 200 {permission_list: []} for an email nobody has, not 404.",
    replace: {
      "200": {
        description: "Permissions Listed",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                permission_list: {
                  type: "array",
                  description: "the permission records of the value",
                  items: PERMISSION_ITEM,
                },
              },
            },
          },
        },
      },
      "400": { $ref: "#/components/responses/OperationFailed" },
      "401": { $ref: "#/components/responses/UnauthorizedAccess" },
      "402": { $ref: "#/components/responses/NoValidPlan" },
      "403": { $ref: "#/components/responses/NoPermission" },
      "404": { $ref: "#/components/responses/ObjectNotFound" },
      "405": { $ref: "#/components/responses/InvalidRequest" },
      "429": { $ref: "#/components/responses/RateLimitExceeded" },
      "501": { $ref: "#/components/responses/NotImplemented" },
    },
  },
];
