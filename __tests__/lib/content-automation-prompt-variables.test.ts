import { describe, expect, it } from "vitest";
import { applyPromptVariables, displaySiteUrl } from "@/lib/content-automation/prompt-variables";
import { findNextSlot } from "@/lib/content-automation/backend/automation-time";

const context = {
  diaSemana: "Segunda-feira",
  runDate: "2026-10-05",
  hora: "08:00",
  nomeConta: "@alilu",
  tema: "Stories Alilu",
  categoria: "Motivacional",
  urlSite: "www.alilu.com.br",
};

describe("applyPromptVariables", () => {
  it("substitui todas as variáveis conhecidas (com ou sem espaços dentro das chaves)", () => {
    expect(
      applyPromptVariables(
        "{{diaSemana}} {{ data }} {{hora}} {{nomeConta}} {{tema}} {{categoria}} {{urlSite}}",
        context,
      ),
    ).toBe("Segunda-feira 05/10/2026 08:00 alilu Stories Alilu Motivacional www.alilu.com.br");
  });

  it("mantém variáveis desconhecidas e texto sem variáveis exatamente como estão", () => {
    expect(applyPromptVariables("Olá {{fulano}}", context)).toBe("Olá {{fulano}}");
    expect(applyPromptVariables("Sem variáveis", context)).toBe("Sem variáveis");
  });

  it("categoria/conta ausentes viram texto vazio", () => {
    expect(applyPromptVariables("[{{categoria}}][{{nomeConta}}]", { ...context, categoria: null, nomeConta: null })).toBe("[][]");
  });

  it("displaySiteUrl tira protocolo e barra final, com padrão quando vazio", () => {
    expect(displaySiteUrl("https://alilu.com.br/")).toBe("alilu.com.br");
    expect(displaySiteUrl("")).toBe("www.alilu.com.br");
    expect(displaySiteUrl(undefined)).toBe("www.alilu.com.br");
  });
});

describe("findNextSlot", () => {
  const slots = [
    { dayOfWeek: "WEDNESDAY" as const, publishTime: "08:00", enabled: true, id: "a" },
    { dayOfWeek: "WEDNESDAY" as const, publishTime: "19:00", enabled: true, id: "b" },
    { dayOfWeek: "MONDAY" as const, publishTime: "07:00", enabled: true, id: "c" },
    { dayOfWeek: "TUESDAY" as const, publishTime: "07:00", enabled: false, id: "d" },
  ];

  it("acha o próximo horário de hoje que ainda não passou", () => {
    // Quarta 30/09/2026 12:00 em São Paulo (15:00 UTC).
    const found = findNextSlot(slots, new Date("2026-09-30T15:00:00.000Z"), "America/Sao_Paulo");
    expect(found?.slot.id).toBe("b");
    expect(found?.daysAhead).toBe(0);
  });

  it("depois do último horário de hoje, pula para o próximo dia habilitado (ignorando os desligados)", () => {
    // Quarta 30/09/2026 20:00 em São Paulo (23:00 UTC) → segunda 05/10 07:00.
    const found = findNextSlot(slots, new Date("2026-09-30T23:00:00.000Z"), "America/Sao_Paulo");
    expect(found?.slot.id).toBe("c");
    expect(found?.date).toBe("2026-10-05");
  });

  it("sem nenhum horário habilitado, devolve null", () => {
    expect(findNextSlot([{ dayOfWeek: "MONDAY", publishTime: "08:00", enabled: false }], new Date(), "America/Sao_Paulo")).toBeNull();
  });
});
