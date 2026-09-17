import { describe, expect, it } from "vitest";
import {
  calculateBusinessDays,
  getNationalHolidays,
  isBusinessDaysInputValid,
  validateBusinessDaysInput,
  type BusinessDaysInput,
} from "@/lib/calculators/business-days";

const base = (overrides: Partial<BusinessDaysInput> = {}): BusinessDaysInput => ({
  startDate: "2026-09-01",
  endDate: "2026-09-30",
  includeStartDate: true,
  considerHolidays: false,
  considerCorpusChristi: false,
  ...overrides,
});

describe("getNationalHolidays", () => {
  it("2026: Páscoa em 5 de abril (valor conhecido/independente) => Sexta-feira Santa correta", () => {
    // Domingo de Páscoa de 2026 é 5 de abril de 2026 (fato de calendário
    // verificável de forma independente, não calculado pelo próprio código).
    const holidays = getNationalHolidays(2026, false);
    expect(holidays).toContain("2026-04-03"); // Páscoa - 2 dias = Sexta-feira Santa
  });

  it("Carnaval NÃO é considerado feriado nacional (é ponto facultativo, não feriado obrigatório)", () => {
    const holidays = getNationalHolidays(2026, false);
    expect(holidays).not.toContain("2026-02-16"); // segunda-feira de Carnaval de 2026
    expect(holidays).not.toContain("2026-02-17"); // terça-feira de Carnaval de 2026 (Páscoa - 47 dias)
  });

  it("inclui os feriados fixos esperados", () => {
    const holidays = getNationalHolidays(2026, false);
    expect(holidays).toEqual(
      expect.arrayContaining([
        "2026-01-01",
        "2026-04-21",
        "2026-05-01",
        "2026-09-07",
        "2026-10-12",
        "2026-11-02",
        "2026-11-15",
        "2026-11-20",
        "2026-12-25",
      ])
    );
  });

  it("Corpus Christi só entra quando considerCorpusChristi é true", () => {
    const withoutCorpus = getNationalHolidays(2026, false);
    const withCorpus = getNationalHolidays(2026, true);
    expect(withCorpus.length).toBe(withoutCorpus.length + 1);
    expect(withCorpus).toContain("2026-06-04"); // Páscoa (5/4) + 60 dias
  });
});

describe("calculateBusinessDays", () => {
  it("setembro de 2026 (30 dias corridos), sem feriados: 4 sábados, 4 domingos, 22 dias úteis", () => {
    // 01/09/2026 é uma terça-feira (fato de calendário verificável de forma
    // independente). Setembro/2026 tem 4 sábados (5,12,19,26) e 4 domingos
    // (6,13,20,27) => 30 - 8 = 22 dias úteis sem descontar feriados.
    const result = calculateBusinessDays(base());
    expect(result.totalDays).toBe(30);
    expect(result.saturdays).toBe(4);
    expect(result.sundays).toBe(4);
    expect(result.headline).toBe(22);
  });

  it("mesmo período considerando feriados: desconta 7 de setembro (feriado nacional, segunda-feira)", () => {
    const result = calculateBusinessDays(base({ considerHolidays: true }));
    expect(result.holidaysCount).toBe(1);
    expect(result.holidayDates).toContain("2026-09-07");
    expect(result.headline).toBe(21);
  });

  it("includeStartDate=false exclui a data inicial da contagem", () => {
    const withStart = calculateBusinessDays(
      base({ startDate: "2026-09-01", endDate: "2026-09-01", includeStartDate: true })
    );
    const withoutStart = calculateBusinessDays(
      base({ startDate: "2026-09-01", endDate: "2026-09-01", includeStartDate: false })
    );
    expect(withStart.totalDays).toBe(1);
    expect(withoutStart.totalDays).toBe(0);
  });

  it("data inicial igual à final (mesmo dia, incluído): 1 dia corrido", () => {
    const result = calculateBusinessDays(
      base({ startDate: "2026-09-15", endDate: "2026-09-15" })
    );
    expect(result.totalDays).toBe(1);
    expect(result.headline).toBe(1); // 15/09/2026 é terça-feira
  });

  it("período cruzando virada de ano considera feriados dos dois anos", () => {
    const result = calculateBusinessDays(
      base({ startDate: "2026-12-30", endDate: "2027-01-02", considerHolidays: true })
    );
    // 30/12 (qua), 31/12 (qui), 01/01 (sex, feriado), 02/01 (sáb)
    expect(result.totalDays).toBe(4);
    expect(result.saturdays).toBe(1);
    expect(result.holidaysCount).toBe(1);
    expect(result.headline).toBe(2);
  });

  it("data final anterior à inicial é inválida", () => {
    const errors = validateBusinessDaysInput(
      base({ startDate: "2026-09-30", endDate: "2026-09-01" })
    );
    expect(errors.endDate).toBeDefined();
  });

  it("datas em formato inválido são rejeitadas", () => {
    const errors = validateBusinessDaysInput(base({ startDate: "2026-02-30" }));
    expect(errors.startDate).toBeDefined();
  });

  it("entrada válida não gera erros", () => {
    expect(isBusinessDaysInputValid(base())).toBe(true);
  });
});
