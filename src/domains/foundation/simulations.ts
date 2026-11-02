import {
  invalid,
  missing,
  type SimulationFragment,
} from "../../control/simulation";
import { apiDateTime } from "../../seed/dates";
import { currencyById } from "../../store/reference";

export const simulations: SimulationFragment = {
  "incoming-transfer": {
    description:
      "A wire transfer reaches one of the association's bank accounts and waits to be matched (payment_status 8).",
    input: {
      bank_account_id: "integer, required",
      amount: "number, required",
      counterparty_name: "string",
      description: "string",
    },
    run(input, ctx) {
      const accountId = input.number("bank_account_id");
      const amount = input.number("amount");
      if (accountId === undefined || amount === undefined || amount <= 0) {
        return invalid("bank_account_id and a positive amount are required");
      }
      const account = ctx.store.bankAccounts.get(accountId);
      if (!account) return missing(`bank account ${accountId} not found`);
      const transfer = ctx.store.bankTransactions.insert({
        bank_account_id: account.id,
        amount,
        currency_code: currencyById(account.currency_id).iso_code,
        complete_date: apiDateTime(ctx.clock.now()),
        payment_status: 8,
        transaction_type: null,
        counterparty_name:
          input.string("counterparty_name") ?? "BİLİNMEYEN GÖNDERİCİ",
        counterparty_iban: null,
        counterparty_vkn: null,
        counterparty_bank: null,
        description: input.string("description") ?? null,
        reference: `REF${ctx.rng.digits(12)}`,
        bank_transaction_type: "FAST",
        sequence_no: ctx.rng.digits(6),
        provider: "mock",
        matched_user_id: null,
        matched_donation_id: null,
        matched_subscription_id: null,
        matched_certificate_sale_id: null,
      });
      return { ok: true, body: { transaction_id: transfer.id } };
    },
  },
};
