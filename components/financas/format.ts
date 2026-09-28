import { formatCurrencyBRL } from "@/lib/formatters/currency";

export function money(cents: number): string {
  return formatCurrencyBRL(cents / 100);
}

const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} de ${year}`;
}

/** "2026-09-05" -> "05/09" */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}
