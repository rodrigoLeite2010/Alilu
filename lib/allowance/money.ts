/** Dinheiro da Mesada: SEMPRE centavos inteiros (nunca float). Módulo puro (tela e servidor). */

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "12,50" · "1.250,50" · "12.5" · 12.5 → 1250 centavos; inválido/<=0 → null. */
export function parseMoneyToCents(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const cents = Math.round(value * 100);
    return cents > 0 && cents <= 100_000_000 ? cents : null;
  }
  if (typeof value !== "string") return null;
  if (/^\s*-/.test(value)) return null;
  let text = value.replace(/[^\d.,]/g, "");
  if (!text) return null;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // o último separador é o decimal
    text = lastComma > lastDot ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  } else if (lastComma >= 0) {
    text = text.replace(",", ".");
  } else if (lastDot >= 0 && text.length - lastDot - 1 === 3 && text.indexOf(".") === lastDot) {
    text = text.replace(".", ""); // "1.250" = mil duzentos e cinquenta
  }
  const number = Number(text);
  if (!Number.isFinite(number)) return null;
  const cents = Math.round(number * 100);
  return cents > 0 && cents <= 100_000_000 ? cents : null;
}

/** Mesada pode ser R$ 0 (pausada); aceita 0. */
export function parseMoneyToCentsAllowZero(value: unknown): number | null {
  if (value === 0 || value === "0" || value === "") return 0;
  return parseMoneyToCents(value);
}
