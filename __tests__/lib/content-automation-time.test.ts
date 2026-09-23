// Matemática pura de fuso horário do Piloto Automático (automation-time.ts).
// Sem banco, sem rede — mesmo espírito de schedule-time.test.ts, que este
// módulo reaproveita por baixo.
import { describe, expect, it } from "vitest";
import { isDueForGeneration, publishInstantUtc, zonedToday } from "@/lib/content-automation/backend/automation-time";

describe("zonedToday", () => {
  it("resolve a data civil e o dia da semana no fuso de São Paulo (UTC-3)", () => {
    // 2026-09-23T02:30:00Z ainda é 2026-09-22 23:30 em São Paulo (terça).
    const now = new Date("2026-09-23T02:30:00Z");
    const { date, dayOfWeek } = zonedToday(now, "America/Sao_Paulo");
    expect(date).toBe("2026-09-22");
    expect(dayOfWeek).toBe("TUESDAY");
  });

  it("vira o dia certo logo após a meia-noite local", () => {
    // 2026-09-23T04:00:00Z já é 2026-09-23 01:00 em São Paulo (quarta).
    const now = new Date("2026-09-23T04:00:00Z");
    const { date, dayOfWeek } = zonedToday(now, "America/Sao_Paulo");
    expect(date).toBe("2026-09-23");
    expect(dayOfWeek).toBe("WEDNESDAY");
  });

  it("cai para America/Sao_Paulo quando o fuso salvo é inválido", () => {
    const now = new Date("2026-09-23T04:00:00Z");
    const withInvalid = zonedToday(now, "Nao/Existe");
    const withDefault = zonedToday(now, "America/Sao_Paulo");
    expect(withInvalid).toEqual(withDefault);
  });

  it("um fuso bem diferente (Tóquio, UTC+9) pode estar um dia à frente de São Paulo", () => {
    const now = new Date("2026-09-23T02:30:00Z"); // 22/09 em SP, 23/09 11:30 em Tóquio
    const tokyo = zonedToday(now, "Asia/Tokyo");
    expect(tokyo.date).toBe("2026-09-23");
    expect(tokyo.dayOfWeek).toBe("WEDNESDAY");
  });
});

describe("publishInstantUtc", () => {
  it("converte data civil + HH:mm no fuso da automação para o instante UTC correto", () => {
    const instant = publishInstantUtc("2026-09-23", "19:00", "America/Sao_Paulo");
    expect(instant.toISOString()).toBe("2026-09-23T22:00:00.000Z");
  });

  it("usa America/Sao_Paulo quando o fuso é inválido, em vez de lançar erro", () => {
    const instant = publishInstantUtc("2026-09-23", "19:00", "algo-invalido");
    expect(instant.toISOString()).toBe("2026-09-23T22:00:00.000Z");
  });
});

describe("isDueForGeneration", () => {
  const publishAt = new Date("2026-09-23T22:00:00.000Z"); // 19h em SP

  it("ainda não é hora quando falta mais que o lead configurado", () => {
    const now = new Date("2026-09-23T19:00:00.000Z"); // 3h antes, lead = 120 min
    expect(isDueForGeneration(now, publishAt, 120)).toBe(false);
  });

  it("é hora exatamente no início da janela de pré-geração", () => {
    const now = new Date("2026-09-23T20:00:00.000Z"); // exatamente 2h antes
    expect(isDueForGeneration(now, publishAt, 120)).toBe(true);
  });

  it("continua 'devido' mesmo depois do horário de publicação já ter passado (cron atrasado)", () => {
    const now = new Date("2026-09-23T23:30:00.000Z"); // 1h30 depois do horário
    expect(isDueForGeneration(now, publishAt, 120)).toBe(true);
  });

  it("lead de 0 minutos só fica devido no próprio instante do horário", () => {
    const before = new Date("2026-09-23T21:59:59.000Z");
    const at = new Date("2026-09-23T22:00:00.000Z");
    expect(isDueForGeneration(before, publishAt, 0)).toBe(false);
    expect(isDueForGeneration(at, publishAt, 0)).toBe(true);
  });
});
