// @vitest-environment node
import { describe, expect, it } from "vitest";
import { localDateKey, localTimeKey, localToUtc, nextOccurrence, occurrencesBetween, parseLocalDateTime, reminderBase, whenLabel } from "@/lib/agenda/time";

const SP = "America/Sao_Paulo";

describe("fuso horário", () => {
  it("converte hora local de São Paulo (UTC-3) para UTC e volta", () => {
    const utc = parseLocalDateTime("2026-10-10", "14:30", SP)!;
    expect(utc.toISOString()).toBe("2026-10-10T17:30:00.000Z");
    expect(localDateKey(utc, SP)).toBe("2026-10-10");
    expect(localTimeKey(utc, SP)).toBe("14:30");
  });

  it("o mesmo horário local muda de UTC conforme o fuso (Lisboa com horário de verão)", () => {
    expect(localToUtc(2026, 7, 1, 9, 0, "Europe/Lisbon").toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(localToUtc(2026, 12, 1, 9, 0, "Europe/Lisbon").toISOString()).toBe("2026-12-01T09:00:00.000Z");
  });

  it("sem hora = meia-noite local (dia inteiro) e lembrete conta a partir das 9h", () => {
    const start = parseLocalDateTime("2026-10-12", null, SP)!;
    expect(start.toISOString()).toBe("2026-10-12T03:00:00.000Z");
    expect(reminderBase(start, true, SP).toISOString()).toBe("2026-10-12T12:00:00.000Z");
  });

  it("rejeita data inválida", () => {
    expect(parseLocalDateTime("2026-02-30", "10:00", SP)).toBeNull();
    expect(parseLocalDateTime("ontem", null, SP)).toBeNull();
    expect(parseLocalDateTime("2026-10-10", "25:00", SP)).toBeNull();
  });
});

describe("recorrência", () => {
  it("semanal: próxima ocorrência mantém o horário local", () => {
    const start = parseLocalDateTime("2026-10-05", "19:00", SP)!; // segunda
    const next = nextOccurrence(start, "WEEKLY", new Date("2026-10-10T12:00:00Z"), SP)!;
    expect(localDateKey(next, SP)).toBe("2026-10-12");
    expect(localTimeKey(next, SP)).toBe("19:00");
  });

  it("mensal no dia 31 usa o último dia dos meses curtos", () => {
    const start = parseLocalDateTime("2026-01-31", "10:00", SP)!;
    const list = occurrencesBetween(start, "MONTHLY", new Date("2026-01-01T00:00:00Z"), new Date("2026-05-01T00:00:00Z"), SP);
    expect(list.map((date) => localDateKey(date, SP))).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("anual em 29/02 cai em 28/02 nos anos não bissextos", () => {
    const start = parseLocalDateTime("2028-02-29", null, SP)!;
    const next = nextOccurrence(start, "YEARLY", new Date("2028-03-01T12:00:00Z"), SP)!;
    expect(localDateKey(next, SP)).toBe("2029-02-28");
  });

  it("sem repetição: nada depois da data original", () => {
    const start = parseLocalDateTime("2026-10-05", "19:00", SP)!;
    expect(nextOccurrence(start, "NONE", new Date("2026-10-10T12:00:00Z"), SP)).toBeNull();
  });

  it("diária dentro de um intervalo", () => {
    const start = parseLocalDateTime("2026-10-01", "08:00", SP)!;
    expect(occurrencesBetween(start, "DAILY", new Date("2026-10-10T03:00:00Z"), new Date("2026-10-13T03:00:00Z"), SP)).toHaveLength(3);
  });
});

describe("whenLabel", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  it("hoje / amanhã / outro dia", () => {
    expect(whenLabel(parseLocalDateTime("2026-10-10", "14:30", SP)!, false, SP, now)).toBe("Hoje às 14:30");
    expect(whenLabel(parseLocalDateTime("2026-10-11", null, SP)!, true, SP, now)).toBe("Amanhã (dia inteiro)");
    expect(whenLabel(parseLocalDateTime("2026-10-16", "09:00", SP)!, false, SP, now)).toBe("sex., 16/10 às 09:00");
  });
});
