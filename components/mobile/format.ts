/**
 * Rótulo curto de data/hora para cards mobile: "Hoje, 18:00", "Amanhã,
 * 09:30" ou "05/10, 18:30" — sempre no fuso informado (o do agendamento).
 */
export function formatWhen(iso: string, timeZone: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const build = (zone: string | undefined) => {
    const dayKey = (value: Date) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
    const time = new Intl.DateTimeFormat("pt-BR", { timeZone: zone, hour: "2-digit", minute: "2-digit" }).format(date);
    const key = dayKey(date);
    if (key === dayKey(now)) return `Hoje, ${time}`;
    if (key === dayKey(new Date(now.getTime() + 24 * 60 * 60 * 1000))) return `Amanhã, ${time}`;
    const day = new Intl.DateTimeFormat("pt-BR", { timeZone: zone, day: "2-digit", month: "2-digit" }).format(date);
    return `${day}, ${time}`;
  };

  try {
    return build(timeZone);
  } catch {
    // Fuso inválido vindo do servidor: cai no fuso do navegador em vez de quebrar a tela.
    return build(undefined);
  }
}
