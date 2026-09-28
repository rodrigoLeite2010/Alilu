import { isValidISODate } from "./dates";
import { categoriesFor } from "./categories";
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
