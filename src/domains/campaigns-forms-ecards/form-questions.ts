import type { Row } from "../../store/collection";
import type {
  FormQuestionRecord,
  UserDefinedValueRecord,
} from "../../store/records";
import type { OrgStore } from "../../store/store";

type Field = Row<UserDefinedValueRecord>;

// `UserDefinedValues.key_type`.
const PARAGRAPH = 1;
const YEAR = 4;
const BOOLEAN = 6;
const SELECT = 7;
const MULTIPLE_SELECT = 8;

const BOOLEAN_TRUE_TEXT = "Evet";
const BOOLEAN_FALSE_TEXT = "Hayır";
const SELECT_TEXT = "Seçiniz";
const PARAGRAPH_LIMIT = 1000;
const YEAR_LIMIT = 2100;
const MAX_FILE_SIZE_MB = 10;
const ALLOWED_EXTENSIONS = [
  "doc",
  "docx",
  "gif",
  "heic",
  "jpeg",
  "jpg",
  "pdf",
  "png",
  "xls",
  "xlsx",
] as const;

// The store keeps a placeholder (0 or "") for a text a field does not have.
// Production sends null for it.
function storedText(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function isSelect(field: Field): boolean {
  return field.key_type === SELECT || field.key_type === MULTIPLE_SELECT;
}

// Only the limits a field has are set.
function validationOf(field: Field) {
  if (field.key_type === PARAGRAPH) {
    return { limit: true, limit_value: PARAGRAPH_LIMIT };
  }
  if (field.key_type === YEAR) return { max: true, max_value: YEAR_LIMIT };
  return {};
}

// A question shows a custom field as production does, not as
// `GET /user-defined-values` does. A boolean field offers its two answers as
// options that are not stored, so they have no id.
function toUdvQuestion(field: Field) {
  const boolean = field.key_type === BOOLEAN;
  return {
    id: field.id,
    key: field.value,
    key_type: field.key_type,
    slug: field.value.replaceAll("_", "-"),
    show_at_profile: true,
    boolean_true_text:
      storedText(field.boolean_true_text) ??
      (boolean ? BOOLEAN_TRUE_TEXT : null),
    boolean_false_text:
      storedText(field.boolean_false_text) ??
      (boolean ? BOOLEAN_FALSE_TEXT : null),
    select_text:
      storedText(field.select_text) ?? (isSelect(field) ? SELECT_TEXT : null),
    options: field.options.map((option, index) => ({
      id: boolean ? null : (option.id ?? null),
      order: option.order ?? index,
      text: option.text ?? "",
    })),
    file_constraints: {
      allowed_extensions: [...ALLOWED_EXTENSIONS],
      max_file_size_mb: MAX_FILE_SIZE_MB,
    },
    folder_id: null,
    folder_name: null,
    oauth_credentials__application: null,
    oauth_credentials__status: null,
    oauth_credentials_id: null,
    translations: { tr: { name: field.name } },
    validation: validationOf(field),
  };
}

export function toQuestion(store: OrgStore, question: Row<FormQuestionRecord>) {
  const field =
    question.udv_id === null
      ? undefined
      : store.userDefinedValues.get(question.udv_id);
  return {
    id: question.id,
    title: question.title,
    slug: question.slug,
    order: question.order,
    question_type: question.question_type,
    required: question.required,
    information: question.information,
    static_question: question.static_question,
    udv_question: field ? toUdvQuestion(field) : null,
    custom_question: question.custom_question,
    deleted: question.deleted,
    additional_info_for_question: question.additional_info_for_question,
    another_question: question.another_question,
    dependent_question_option_ids: question.dependent_question_option_ids,
    depends_on_another_question_answer:
      question.depends_on_another_question_answer,
    section_id: question.section_id,
    show_other_for_multiple: question.show_other_for_multiple,
  };
}
