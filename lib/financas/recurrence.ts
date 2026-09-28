import { addDays, addMonthsAnchored, diffDays, parseISO } from "./dates";
import type { FinEntry, Occurrence, OccurrencePayment, Recurrence } from "./types";

const MAX_ITERATIONS = 2000;

function paymentKey(entryId: string, date: string): string {
  return `${entryId}|${date}`;
}

/** Datas em que o lançamento acontece dentro de [from, to] (inclusive). */
export function occurrenceDates(
  entry: Pick<FinEntry, "date" | "recurrence" | "recurrenceEnd">,
  from: string,
  to: string,
): string[] {
  const { date, recurrence, recurrenceEnd } = entry;
  const last = recurrenceEnd && recurrenceEnd < to ? recurrenceEnd : to;
  if (last < from) return [];

  if (recurrence === "none") {
    return date >= from && date <= to ? [date] : [];
  }

  const result: string[] = [];

  if (recurrence === "weekly" || recurrence === "biweekly") {
    const step = recurrence === "weekly" ? 7 : 14;
    let current = date;
    if (current < from) {
      const skip = Math.ceil(diffDays(current, from) / step);
      current = addDays(current, skip * step);
    }
    for (let i = 0; current <= last && i < MAX_ITERATIONS; i += 1) {
      result.push(current);
      current = addDays(current, step);
    }
    return result;
  }

  const stepMonths = (recurrence as Recurrence) === "yearly" ? 12 : 1;
  const start = parseISO(date);
  const target = parseISO(from);
  const monthsBetween = (target.year - start.year) * 12 + (target.month - start.month);
  let k = Math.max(0, Math.floor(monthsBetween / stepMonths) - 1);
  for (let i = 0; i < MAX_ITERATIONS; i += 1, k += 1) {
    const current = addMonthsAnchored(date, k * stepMonths);
    if (current > last) break;
    if (current >= from) result.push(current);
  }
  return result;
}

/**
 * Expande lançamentos (únicos e recorrentes) em ocorrências datadas dentro do
 * período, já com a situação de pagamento de cada uma.
 */
export function expandOccurrences(
  entries: FinEntry[],
  payments: OccurrencePayment[],
  from: string,
  to: string,
): Occurrence[] {
  const paid = new Map<string, string>();
  for (const payment of payments) {
    paid.set(paymentKey(payment.entryId, payment.date), payment.paidAt);
  }

  const result: Occurrence[] = [];
  for (const entry of entries) {
    const recurring = entry.recurrence !== "none";
    for (const date of occurrenceDates(entry, from, to)) {
      const paidAt = recurring ? (paid.get(paymentKey(entry.id, date)) ?? null) : entry.paidAt;
      result.push({
        entryId: entry.id,
        kind: entry.kind,
        description: entry.description,
        category: entry.category,
        nature: entry.nature,
        amountCents: entry.amountCents,
        date,
        recurring,
        paid: paidAt !== null,
        paidAt,
      });
    }
  }

  return result.sort(
    (a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description, "pt-BR"),
  );
}
