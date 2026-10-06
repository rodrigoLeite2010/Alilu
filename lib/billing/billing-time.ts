/**
 * Datas civis de cobrança. O "dia" do limite diário é o dia no Brasil
 * (America/Sao_Paulo) — antes era UTC, o que zerava o contador às 21h.
 */
export const BILLING_TIME_ZONE = "America/Sao_Paulo";

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BILLING_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "YYYY-MM-DD" do dia civil de `date` em São Paulo. */
export function billingDateStr(date: Date): string {
  return formatter.format(date);
}

/** Instante UTC em que o dia civil de São Paulo de `date` começou (Brasil não tem horário de verão desde 2019: UTC−3). */
export function billingDayStart(date: Date): Date {
  return new Date(`${billingDateStr(date)}T03:00:00.000Z`);
}
