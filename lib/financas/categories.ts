import type { EntryKind } from "./types";

export const EXPENSE_CATEGORIES = [
  "Moradia",
  "Alimentação",
  "Transporte",
  "Saúde",
  "Educação",
  "Lazer",
  "Filhos",
  "Seguros",
  "Assinaturas",
  "Empréstimos",
  "Financiamentos",
  "Cartão",
  "Impostos",
  "Pets",
  "Outros",
] as const;

export const INCOME_CATEGORIES = [
  "Salário",
  "Renda extra",
  "Freelance",
  "Comissão",
  "Aluguel",
  "Investimentos",
  "Outros",
] as const;

export function categoriesFor(kind: EntryKind): readonly string[] {
  return kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export const RECURRENCE_LABELS = {
  none: "Única",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  yearly: "Anual",
} as const;
