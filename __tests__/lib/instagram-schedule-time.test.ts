import { describe, expect, it } from "vitest";
import {
  formatInTimeZone,
  formatScheduleConfirmation,
  isValidTimeZone,
  parseAbsoluteIso,
  utcToZonedInputs,
  zonedDateTimeToUtc,
} from "@/lib/instagram/schedule-time";

describe("fuso horário do agendamento", () => {
  it("15:00 em São Paulo é 18:00 UTC (nunca publica às 18:00 locais)", () => {
    expect(zonedDateTimeToUtc("2026-09-24", "15:00", "America/Sao_Paulo").toISOString()).toBe("2026-09-24T18:00:00.000Z");
  });

  it("volta para o mesmo horário local ao exibir", () => {
    expect(utcToZonedInputs("2026-09-24T18:00:00.000Z", "America/Sao_Paulo")).toEqual({ date: "2026-09-24", time: "15:00" });
    expect(formatInTimeZone("2026-09-24T18:00:00.000Z", "America/Sao_Paulo")).toBe("24/09/2026, 15:00");
  });

  it("respeita outros fusos e horário de verão", () => {
    expect(zonedDateTimeToUtc("2026-09-24", "10:00", "America/Manaus").toISOString()).toBe("2026-09-24T14:00:00.000Z");
    // Nova York: EDT (UTC-4) em julho, EST (UTC-5) em dezembro.
    expect(zonedDateTimeToUtc("2026-07-01", "09:00", "America/New_York").toISOString()).toBe("2026-07-01T13:00:00.000Z");
    expect(zonedDateTimeToUtc("2026-12-01", "09:00", "America/New_York").toISOString()).toBe("2026-12-01T14:00:00.000Z");
    expect(zonedDateTimeToUtc("2026-09-24", "23:30", "Asia/Tokyo").toISOString()).toBe("2026-09-24T14:30:00.000Z");
  });

  it("virada de dia é tratada", () => {
    expect(zonedDateTimeToUtc("2026-09-24", "22:30", "America/Sao_Paulo").toISOString()).toBe("2026-09-25T01:30:00.000Z");
    expect(utcToZonedInputs("2026-09-25T01:30:00.000Z", "America/Sao_Paulo")).toEqual({ date: "2026-09-24", time: "22:30" });
  });

  it("recusa ISO sem fuso (ambíguo) e aceita Z/offset", () => {
    expect(parseAbsoluteIso("2026-09-24T15:00")).toBeNull();
    expect(parseAbsoluteIso("24/09/2026 15:00")).toBeNull();
    expect(parseAbsoluteIso("2026-09-24T18:00:00.000Z")?.toISOString()).toBe("2026-09-24T18:00:00.000Z");
    expect(parseAbsoluteIso("2026-09-24T15:00:00-03:00")?.toISOString()).toBe("2026-09-24T18:00:00.000Z");
  });

  it("valida fusos IANA", () => {
    expect(isValidTimeZone("America/Sao_Paulo")).toBe(true);
    expect(isValidTimeZone("Marte/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });

  it("mensagem de confirmação em português", () => {
    expect(formatScheduleConfirmation("2026-09-24T21:30:00.000Z", "America/Sao_Paulo")).toBe(
      "Seu post será publicado em 24/09 às 18:30.",
    );
  });
});
