import { notFound } from "../../api/errors";
import type { Handler, HandlerInput } from "../../api/handler";
import {
  inDateRange,
  matchesQuery,
  newestFirst,
  paginate,
  parseDateRange,
} from "../../api/listing";
import type { components } from "../../generated/openapi";
import { istanbulDateTime } from "../../seed/dates";
import type { Row } from "../../store/collection";
import { fullName, present, userName } from "../../store/joins";
import type {
  FormAnswerItemRecord,
  FormAnswerRecord,
  FormRecord,
} from "../../store/records";
import { PAYMENT_STATUS } from "../../store/reference";
import type { OrgStore } from "../../store/store";
import { mergePendingDuplicate } from "./contacts";
import {
  compareBy,
  dateValue,
  type OrderField,
  type SortKey,
  type SortValue,
} from "./ordering";
import { applyResponse, parseResponse } from "./form-responses";
import { toTransaction } from "./transactions";

type Form = Row<FormRecord>;
type Answer = Row<FormAnswerRecord>;
type FormOrderBy = components["schemas"]["FormListOrder"];
type FormOrder = OrderField<FormOrderBy>;
export type AnswerStatus = HandlerInput<"getFormAnswerList">["query"]["status"];

const APPROVAL_STATUS: Readonly<
  Record<FormAnswerRecord["approval_status"], AnswerStatus>
> = { 0: "waiting_approval", 1: "answer", 2: "rejected" };

export function answerStatus(store: OrgStore, answer: Answer): AnswerStatus {
  const payment =
    answer.transaction_id === null
      ? undefined
      : store.transactions.get(answer.transaction_id);
  if (payment?.payment_status === PAYMENT_STATUS.refunded) return "refund";
  if (payment && payment.payment_status !== PAYMENT_STATUS.successful) {
    return "failed";
  }
  return APPROVAL_STATUS[answer.approval_status];
}

interface FormView {
  readonly id: number;
  readonly form: Form;
  readonly responses: number;
  readonly waiting: number;
  readonly lastAnswer: string | null;
}

function viewOf(store: OrgStore, form: Form): FormView {
  const responses = store.formAnswers
    .list((answer) => answer.form_id === form.id)
    .map((answer) => ({ answer, status: answerStatus(store, answer) }))
    .filter((row) => row.status !== "failed");
  const last = responses
    .map((row) => row.answer.complete_date)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  return {
    id: form.id,
    form,
    responses: responses.length,
    waiting: responses.filter((row) => row.status === "waiting_approval")
      .length,
    lastAnswer: last ?? null,
  };
}

const FORM_ORDER: Readonly<Record<FormOrder, (view: FormView) => SortValue>> = {
  order: (view) => view.form.order,
  title: (view) => view.form.title,
  response_count: (view) => view.responses,
  waiting_approval: (view) => view.waiting,
  last_answer_date: (view) => dateValue(view.lastAnswer),
};

function orderingBy(
  field: FormOrder,
  descending = false,
): readonly SortKey<FormView>[] {
  const primary = { value: FORM_ORDER[field], descending };
  return field === "order" || field === "title"
    ? [primary]
    : [primary, { value: FORM_ORDER.title }];
}

const FORM_ORDERINGS: Readonly<
  Record<FormOrderBy, readonly SortKey<FormView>[]>
> = {
  order: orderingBy("order"),
  title: orderingBy("title"),
  "-title": orderingBy("title", true),
  response_count: orderingBy("response_count"),
  "-response_count": orderingBy("response_count", true),
  waiting_approval: orderingBy("waiting_approval"),
  "-waiting_approval": orderingBy("waiting_approval", true),
  last_answer_date: orderingBy("last_answer_date"),
  "-last_answer_date": orderingBy("last_answer_date", true),
};

function isFormOrderBy(value: string | undefined): value is FormOrderBy {
  return value !== undefined && Object.hasOwn(FORM_ORDERINGS, value);
}

function toFormItem(store: OrgStore, view: FormView) {
  const { form } = view;
  return {
    id: form.id,
    title: form.title,
    url: form.url,
    active: form.active,
    order: form.order,
    listing: form.listing,
    last_answer_date: view.lastAnswer,
    application_limit: form.application_limit,
    waiting_approval: view.waiting,
    response_count: view.responses,
    create_date: form.create_date,
    created_by_id: form.created_by_id,
    created_by__name: userName(store, form.created_by_id),
    update_date: present(form.update_date),
    updated_by_id: present(form.updated_by_id),
    updated_by__name: userName(store, form.updated_by_id),
    archived_by_id: present(form.archived_by_id),
    archived_by__name: userName(store, form.archived_by_id),
    archive_date: present(form.archive_date),
  };
}

export const getFormList: Handler<"getFormList"> = ({ query }, { store }) => {
  const archived = query.archived === "true";
  const views = store.forms
    .list(
      (form) =>
        (form.archive_date !== null) === archived &&
        matchesQuery(query.query, [form.title]),
    )
    .map((form) => viewOf(store, form))
    .sort(
      compareBy(
        FORM_ORDERINGS[
          isFormOrderBy(query.order_by) ? query.order_by : "order"
        ],
      ),
    );
  return {
    status: 200,
    body: {
      form_list: paginate(views, query).map((view) => toFormItem(store, view)),
      total: views.length,
    },
  };
};

function transactionOf(store: OrgStore, answer: Answer) {
  return answer.transaction_id === null
    ? undefined
    : store.transactions.get(answer.transaction_id);
}

function toAnswerItem(store: OrgStore, answer: Answer, failed: boolean) {
  const payment = transactionOf(store, answer);
  return {
    id: answer.id,
    first_name: answer.first_name,
    last_name: answer.last_name,
    email: answer.email,
    complete_date: answer.complete_date,
    user_id: present(answer.user_id),
    transaction_id: present(answer.transaction_id),
    transaction__amount: payment?.amount,
    custom_form_id: answer.form_id,
    custom_form__title: store.forms.get(answer.form_id)?.title,
    ...(failed && payment
      ? {
          transaction__transaction_error__code: present(payment.error_code),
          transaction__transaction_error__text: present(payment.error_text),
          transaction__transaction_error__group: payment.error_group,
        }
      : {}),
  };
}

export const getFormAnswerList: Handler<"getFormAnswerList"> = (
  { query },
  { store },
) => {
  const range = parseDateRange(query.start_date, query.end_date);
  if ("error" in range) return { status: 400, body: { error: range.error } };
  const answers = store.formAnswers
    .list(
      (answer) =>
        answerStatus(store, answer) === query.status &&
        inDateRange(answer.complete_date, range) &&
        matchesQuery(query.query, [
          answer.first_name,
          answer.last_name,
          answer.email,
          store.forms.get(answer.form_id)?.title,
        ]),
    )
    .sort(newestFirst((answer) => answer.complete_date));
  return {
    status: 200,
    body: {
      answer_list: paginate(answers, query).map((answer) =>
        toAnswerItem(store, answer, query.status === "failed"),
      ),
      total: answers.length,
    },
  };
};

function answerOfForm(
  store: OrgStore,
  formId: number,
  answerId: number,
): Answer | undefined {
  const answer = store.formAnswers.get(answerId);
  return answer?.form_id === formId ? answer : undefined;
}

function toUdvQuestion(store: OrgStore, udvId: number | null) {
  const udv = udvId === null ? undefined : store.userDefinedValues.get(udvId);
  return (
    udv && {
      id: `C${udv.id}`,
      udv_id: udv.id,
      type: udv.type,
      name: udv.name,
      value: udv.value,
      group: udv.group,
      key_type: udv.key_type,
      for: udv.for,
      options: udv.options,
      boolean_true_text: udv.boolean_true_text,
      boolean_false_text: udv.boolean_false_text,
      changable_by_users: udv.changable_by_users,
      select_text: udv.select_text,
      display_for: udv.display_for,
    }
  );
}

function toAnswerDetail(store: OrgStore, item: Row<FormAnswerItemRecord>) {
  const question = store.formQuestions.get(item.question_id);
  return {
    id: item.id,
    question: question && {
      id: question.id,
      title: question.title,
      slug: question.slug,
      order: question.order,
      question_type: question.question_type,
      required: question.required,
      information: question.information,
      static_question: question.static_question,
      udv_question: toUdvQuestion(store, question.udv_id),
      custom_question: question.custom_question ?? undefined,
      deleted: question.deleted,
    },
    answer: item.answer,
    db_answer: item.db_answer,
    selected_option_list: (question?.options ?? []).filter((option) =>
      item.selected_option_ids.includes(option.id),
    ),
  };
}

function toAnswerDetails(store: OrgStore, answer: Answer) {
  const payment = transactionOf(store, answer);
  const user =
    answer.user_id === null ? undefined : store.users.get(answer.user_id);
  const mail =
    answer.sent_mail_id === null
      ? undefined
      : store.sentEmails.get(answer.sent_mail_id);
  const order = (item: Row<FormAnswerItemRecord>) =>
    store.formQuestions.get(item.question_id)?.order ?? 0;
  return {
    id: answer.id,
    transaction: payment && toTransaction(store, payment),
    complete_date: answer.complete_date,
    user: user && {
      id: user.id,
      name: fullName(user),
      membership_no: user.membership_no,
    },
    email: answer.email,
    email_verification: answer.email_verification,
    first_name: answer.first_name,
    last_name: answer.last_name,
    approval_status: answer.approval_status,
    form_answer_list: store.formAnswerItems
      .list((item) => item.answer_id === answer.id)
      .sort((a, b) => order(a) - order(b) || a.id - b.id)
      .map((item) => toAnswerDetail(store, item)),
    sent_mail: mail && {
      id: mail.id,
      message_id: mail.message_id,
      status: mail.status,
    },
  };
}

export const getFormAnswerDetails: Handler<"getFormAnswerDetails"> = (
  { path },
  { store },
) => {
  const answer = answerOfForm(store, path.form_id, path.answer_id);
  if (!answer) return notFound("Form answer");
  return { status: 200, body: { answer: toAnswerDetails(store, answer) } };
};

export const respondFormAnswer: Handler<"respondFormAnswer"> = (
  { path, body },
  ctx,
) => {
  const answer = answerOfForm(ctx.store, path.form_id, path.answer_id);
  if (!answer) return notFound("Form answer");
  const response = parseResponse(ctx.store, body);
  if (!response.ok) return response.failure;
  applyResponse(ctx, answer, response.value, istanbulDateTime(ctx.clock.now()));
  return {
    status: 200,
    body: {
      result: "ok",
      merge: mergePendingDuplicate(ctx.store, answer.user_id),
    },
  };
};

export const getUserAnswerList: Handler<"getUserAnswerList"> = (
  { path, query },
  { store },
) => {
  if (!store.users.get(path.user_id)) return notFound("User");
  const answers = store.formAnswers
    .list((answer) => answer.user_id === path.user_id)
    .sort(newestFirst((answer) => answer.complete_date));
  return {
    status: 200,
    body: {
      answer_list: paginate(answers, query).map((answer) => ({
        id: answer.id,
        complete_date: answer.complete_date,
        transaction_id: present(answer.transaction_id),
        transaction__amount: transactionOf(store, answer)?.amount,
        custom_form_id: answer.form_id,
        custom_form__title: store.forms.get(answer.form_id)?.title,
      })),
      total: answers.length,
    },
  };
};
