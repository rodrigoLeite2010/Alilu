import { formatNumberBRL } from "@/lib/formatters/currency";

/** Monetary input accepts BRL grouping and at most two decimal places. */
export function parsePropertyAmount(input: string): number | null {
  const text = input.trim().replace(/^R\$\s*/i, "");
  if (!text) return 0;
  let normalized: string;
  if (text.includes(",")) {
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{0,2}$/.test(text)) return null;
    normalized = text.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) {
    normalized = text.replace(/\./g, "");
  } else {
    if (!/^\d+(?:\.\d{0,2})?$/.test(text)) return null;
    normalized = text;
  }
  const value = Number(normalized);
  return Number.isFinite(value) && value <= 1e12 ? value : null;
}

export function formatPropertyAmount(value: number): string {
  return formatNumberBRL(value, 2);
}
