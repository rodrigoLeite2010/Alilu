/**
 * Tipos da área Educação Financeira. Todo valor em CENTAVOS (inteiro) e
 * toda data em "YYYY-MM-DD" (string, sem fuso) — evita erro de ponto
 * flutuante e de conversão de fuso horário.
 */

export type EntryKind = "income" | "expense";
export type Recurrence = "none" | "weekly" | "biweekly" | "monthly" | "yearly";
export type ExpenseNature = "fixed" | "variable";

export interface FinEntry {
  id: string;
  kind: EntryKind;
  description: string;
  amountCents: number;
  category: string;
  nature: ExpenseNature | null;
  /** Recebimento (receita) ou vencimento (despesa); 1ª ocorrência se recorrente. */
  date: string;
  recurrence: Recurrence;
  recurrenceEnd: string | null;
  paymentMethod: string | null;
  note: string | null;
  /** Só lançamentos não recorrentes: data/hora em que foi pago/recebido. */
  paidAt: string | null;
}

export interface OccurrencePayment {
  entryId: string;
  /** Data da ocorrência paga (YYYY-MM-DD). */
  date: string;
  paidAt: string;
}

export interface Occurrence {
  entryId: string;
  kind: EntryKind;
  description: string;
  category: string;
  nature: ExpenseNature | null;
  amountCents: number;
  date: string;
  recurring: boolean;
  paid: boolean;
  paidAt: string | null;
}

export type OccurrenceStatus = "income" | "income-received" | "paid" | "pending" | "overdue";

export type BudgetState = "ok" | "attention" | "over";
