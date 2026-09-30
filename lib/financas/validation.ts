import { isValidISODate } from "./dates";
import { categoriesFor, EXPENSE_CATEGORIES } from "./categories";
import type { EntryKind, ExpenseNature, Recurrence } from "./types";

export interface EntryInput {
  kind: EntryKind;
  description: string;
  amountCents: number;
  category: string;
  nature: ExpenseNature | null;
  date: string;
  recurrence: Recurrence;
  recurrenceEnd: string | null;
  paymentMethod: string | null;
  note: string | null;
  paid: boolean;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const MAX_AMOUNT_CENTS = 100_000_000_00; // R$ 100 milhões
const RECURRENCES: Recurrence[] = ["none", "weekly", "biweekly", "monthly", "yearly"];

function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length > max) return undefined;
  return trimmed === "" ? null : trimmed;
}

export function parseEntryInput(body: unknown): ParseResult<EntryInput> {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Dados inválidos." };
  const raw = body as Record<string, unknown>;

  const kind = raw.kind;
  if (kind !== "income" && kind !== "expense") return { ok: false, error: "Tipo inválido." };

  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  if (description.length < 1 || description.length > 120) {
    return { ok: false, error: "Informe uma descrição de até 120 caracteres." };
  }

  const amountCents = raw.amountCents;
  if (
    typeof amountCents !== "number" ||
    !Number.isInteger(amountCents) ||
    amountCents <= 0 ||
    amountCents > MAX_AMOUNT_CENTS
  ) {
    return { ok: false, error: "Informe um valor maior que zero." };
  }

  const category = typeof raw.category === "string" ? raw.category : "";
  if (!categoriesFor(kind).includes(category)) return { ok: false, error: "Categoria inválida." };

  let nature: ExpenseNature | null = null;
  if (kind === "expense") {
    const value = raw.nature ?? "variable";
    if (value !== "fixed" && value !== "variable") return { ok: false, error: "Classificação inválida." };
    nature = value;
  }

  if (!isValidISODate(raw.date)) return { ok: false, error: "Data inválida." };
  const date = raw.date;

  const recurrence = (raw.recurrence ?? "none") as Recurrence;
  if (!RECURRENCES.includes(recurrence)) return { ok: false, error: "Periodicidade inválida." };

  let recurrenceEnd: string | null = null;
  if (raw.recurrenceEnd !== undefined && raw.recurrenceEnd !== null && raw.recurrenceEnd !== "") {
    if (!isValidISODate(raw.recurrenceEnd) || raw.recurrenceEnd < date) {
      return { ok: false, error: "Data final da recorrência inválida." };
    }
    recurrenceEnd = raw.recurrenceEnd;
  }
  if (recurrence === "none") recurrenceEnd = null;

  const paymentMethod = optionalText(raw.paymentMethod, 40);
  const note = optionalText(raw.note, 300);
  if (paymentMethod === undefined || note === undefined) return { ok: false, error: "Texto muito longo." };

  return {
    ok: true,
    value: {
      kind,
      description,
      amountCents,
      category,
      nature,
      date,
      recurrence,
      recurrenceEnd,
      paymentMethod,
      note,
      paid: raw.paid === true,
    },
  };
}

export function parseSettingsInput(
  body: unknown,
): ParseResult<{ savingsGoalCents?: number; month?: string; openingBalanceCents?: number }> {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Dados inválidos." };
  const raw = body as Record<string, unknown>;
  const value: { savingsGoalCents?: number; month?: string; openingBalanceCents?: number } = {};

  if (raw.savingsGoalCents !== undefined) {
    const v = raw.savingsGoalCents;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > MAX_AMOUNT_CENTS) {
      return { ok: false, error: "Meta de economia inválida." };
    }
    value.savingsGoalCents = v;
  }
  if (raw.openingBalanceCents !== undefined) {
    const v = raw.openingBalanceCents;
    if (
      typeof v !== "number" ||
      !Number.isInteger(v) ||
      Math.abs(v) > MAX_AMOUNT_CENTS ||
      typeof raw.month !== "string" ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(raw.month)
    ) {
      return { ok: false, error: "Saldo inicial inválido." };
    }
    value.openingBalanceCents = v;
    value.month = raw.month;
  }
  return { ok: true, value };
}

/** Converte texto digitado ("1.234,56") em centavos; null se inválido. */
export function reaisTextToCents(text: string): number | null {
  const trimmed = text.trim().replace(/^R\$\s*/, "");
  if (trimmed === "") return null;
  // "1.234,56" e "8.000" (só milhar) seguem o padrão brasileiro; "12.5" vira 12,5.
  const brazilianThousands = /^\d{1,3}(\.\d{3})+$/.test(trimmed);
  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : brazilianThousands
      ? trimmed.replace(/\./g, "")
      : trimmed;
  const number = Number(normalized);
  if (!Number.isFinite(number)) return null;
  return Math.round(number * 100);
}

export interface GoalInput {
  name: string;
  targetCents: number;
  currentCents: number;
  targetDate: string | null;
}

const MAX_GOAL_CENTS = 100_000_000_00;

export function parseGoalInput(body: unknown): ParseResult<GoalInput> {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Dados inválidos." };
  const raw = body as Record<string, unknown>;

  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (name.length < 1 || name.length > 80) return { ok: false, error: "Informe um nome de até 80 caracteres." };

  const targetCents = raw.targetCents;
  if (typeof targetCents !== "number" || !Number.isInteger(targetCents) || targetCents <= 0 || targetCents > MAX_GOAL_CENTS) {
    return { ok: false, error: "Informe um valor alvo maior que zero." };
  }

  const currentCents = raw.currentCents ?? 0;
  if (typeof currentCents !== "number" || !Number.isInteger(currentCents) || currentCents < 0 || currentCents > MAX_GOAL_CENTS) {
    return { ok: false, error: "Valor atual inválido." };
  }

  let targetDate: string | null = null;
  if (raw.targetDate !== undefined && raw.targetDate !== null && raw.targetDate !== "") {
    if (!isValidISODate(raw.targetDate)) return { ok: false, error: "Data desejada inválida." };
    targetDate = raw.targetDate;
  }

  return { ok: true, value: { name, targetCents, currentCents, targetDate } };
}

export function parseDelta(body: unknown): ParseResult<{ deltaCents: number }> {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Dados inválidos." };
  const raw = body as Record<string, unknown>;
  const deltaCents = raw.deltaCents;
  if (typeof deltaCents !== "number" || !Number.isInteger(deltaCents) || deltaCents === 0 || Math.abs(deltaCents) > MAX_GOAL_CENTS) {
    return { ok: false, error: "Valor inválido." };
  }
  return { ok: true, value: { deltaCents } };
}

export interface CategoryLimitInput {
  limitCents: number;
}

const MAX_LIMIT_CENTS = 100_000_000_00;

export function isValidExpenseCategory(value: unknown): value is (typeof EXPENSE_CATEGORIES)[number] {
  return typeof value === "string" && (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

export function parseCategoryLimitInput(body: unknown): ParseResult<CategoryLimitInput> {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Dados inválidos." };
  const raw = body as Record<string, unknown>;
  const limitCents = raw.limitCents;
  if (typeof limitCents !== "number" || !Number.isInteger(limitCents) || limitCents <= 0 || limitCents > MAX_LIMIT_CENTS) {
    return { ok: false, error: "Informe um limite maior que zero." };
  }
  return { ok: true, value: { limitCents } };
}

export interface DebtInput {
  name: string;
  balanceCents: number;
  installmentCents: number;
}

const MAX_DEBT_CENTS = 100_000_000_00;

export function parseDebtInput(body: unknown): ParseResult<DebtInput> {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Dados inválidos." };
  const raw = body as Record<string, unknown>;

  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (name.length < 1 || name.length > 80) return { ok: false, error: "Informe um nome de até 80 caracteres." };

  const balanceCents = raw.balanceCents;
  if (typeof balanceCents !== "number" || !Number.isInteger(balanceCents) || balanceCents < 0 || balanceCents > MAX_DEBT_CENTS) {
    return { ok: false, error: "Informe um saldo devedor válido." };
  }

  const installmentCents = raw.installmentCents;
  if (
    typeof installmentCents !== "number" ||
    !Number.isInteger(installmentCents) ||
    installmentCents <= 0 ||
    installmentCents > MAX_DEBT_CENTS
  ) {
    return { ok: false, error: "Informe um valor de parcela maior que zero." };
  }

  return { ok: true, value: { name, balanceCents, installmentCents } };
}
