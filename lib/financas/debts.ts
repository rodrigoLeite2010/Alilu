import { addMonthsToMonth, monthOf } from "./dates";

/**
 * "Controle de dívidas": saldo devedor + valor da parcela mensal. A
 * previsão de término é só aritmética — nunca leva juros em conta (o
 * usuário não informa taxa de juros aqui), é uma referência simples de
 * "se eu continuar pagando essa parcela, quando acabo?".
 */

export interface Debt {
  id: string;
  name: string;
  balanceCents: number;
  installmentCents: number;
}

export interface DebtPayoff {
  paidOff: boolean;
  /** Quantas parcelas faltam (0 se já quitada). */
  monthsRemaining: number;
  /** "YYYY-MM" do mês previsto de quitação; null se já quitada. */
  payoffMonth: string | null;
}

export function debtPayoff(debt: Pick<Debt, "balanceCents" | "installmentCents">, today: string): DebtPayoff {
  if (debt.balanceCents <= 0) return { paidOff: true, monthsRemaining: 0, payoffMonth: null };
  const monthsRemaining = Math.ceil(debt.balanceCents / debt.installmentCents);
  return { paidOff: false, monthsRemaining, payoffMonth: addMonthsToMonth(monthOf(today), monthsRemaining) };
}
