import { describe, expect, it } from "vitest";
import {
  calculateEmployeeCost,
  isEmployeeCostInputValid,
  validateEmployeeCostInput,
  type EmployeeCostInput,
} from "@/lib/calculators/employee-cost";

const base = (overrides: Partial<EmployeeCostInput> = {}): EmployeeCostInput => ({
  grossSalary: 3000,
  regime: "geral",
  ratPercent: 2,
  thirdPartyPercent: 5.8,
  monthlyBenefits: 0,
  ...overrides,
});

// Valores esperados calculados de forma independente (fora do código-fonte).
// CPP/RAT/terceiros incidem sobre o salário do mês + as provisões
// tributáveis de 13º e férias (gozadas + terço) — ver cabeçalho de
// employee-cost.ts (correção da auditoria).
describe("calculateEmployeeCost — regime geral", () => {
  it("bruto 3.000, RAT 2%, terceiros 5,8%, benefícios 300", () => {
    const result = calculateEmployeeCost(base({ monthlyBenefits: 300 }));
    // Base de CPP/RAT/terceiros = 3.000 + provisão de férias (250) + terço
    // (83,33) + 13º (250) = 3.583,33.
    expect(result.chargesBase).toBeCloseTo(3583.33, 1);
    expect(result.employerINSS).toBeCloseTo(716.67, 1);
    expect(result.rat).toBeCloseTo(71.67, 1);
    expect(result.thirdParty).toBeCloseTo(207.83, 1);
    expect(result.fgtsOnSalary).toBeCloseTo(240, 6);
    expect(result.vacationProvision).toBeCloseTo(250, 6);
    expect(result.vacationOneThirdProvision).toBeCloseTo(83.33, 1);
    expect(result.thirteenthProvision).toBeCloseTo(250, 6);
    expect(result.fgtsOnProvisions).toBeCloseTo(46.67, 1);
    expect(result.totalCharges).toBeCloseTo(1866.17, 1);
    expect(result.headline).toBeCloseTo(5166.17, 1);
  });

  it("CASO OBRIGATÓRIO DE AUDITORIA: bruto 5.000, RAT 1%, terceiros 5,8% — confirma os ~R$ 260,56/mês antes ausentes das provisões de encargos", () => {
    const buggyEmployerINSS = 5000 * 0.2;
    const buggyRat = 5000 * 0.01;
    const buggyThirdParty = 5000 * 0.058;
    const buggyChargesTotal = buggyEmployerINSS + buggyRat + buggyThirdParty;

    const result = calculateEmployeeCost(
      base({ grossSalary: 5000, ratPercent: 1, thirdPartyPercent: 5.8, monthlyBenefits: 0 })
    );
    const fixedChargesTotal = result.employerINSS + result.rat + result.thirdParty;

    expect(result.chargesBase).toBeCloseTo(5972.22, 1);
    expect(result.employerINSS).toBeCloseTo(1194.44, 1);
    expect(result.rat).toBeCloseTo(59.72, 1);
    expect(result.thirdParty).toBeCloseTo(346.39, 1);
    // A diferença entre a base correta (salário + provisões) e a base
    // antiga (só salário) deve ser de ~R$ 260,56/mês, conforme a auditoria.
    expect(fixedChargesTotal - buggyChargesTotal).toBeCloseTo(260.56, 1);
  });
});

// Distinção Simples Nacional Anexo IV vs. demais anexos: fonte oficial da
// Receita Federal (Simples Nacional) e fonte contábil especializada
// (Confirp), documentadas no cabeçalho de employee-cost.ts.
describe("calculateEmployeeCost — Simples Nacional, Anexo IV", () => {
  it("recolhe INSS patronal e RAT separados (como o regime geral), mas nunca contribuições a terceiros", () => {
    const result = calculateEmployeeCost(
      base({ regime: "simples_anexo_iv", monthlyBenefits: 300 })
    );
    // Mesma base ampliada (salário + provisões) que o regime geral, já que
    // o Anexo IV também recolhe CPP/RAT separadamente da mesma forma.
    expect(result.chargesBase).toBeCloseTo(3583.33, 1);
    expect(result.employerINSS).toBeCloseTo(716.67, 1);
    expect(result.rat).toBeCloseTo(71.67, 1);
    expect(result.thirdParty).toBe(0);
    expect(result.totalCharges).toBeCloseTo(1658.33, 1);
    expect(result.headline).toBeCloseTo(4958.33, 1);
  });

  it("regime Anexo IV ainda exige RAT válido, mas ignora validação de terceiros", () => {
    const errors = validateEmployeeCostInput(
      base({ regime: "simples_anexo_iv", ratPercent: 0, thirdPartyPercent: Number.NaN })
    );
    expect(errors.ratPercent).toBeDefined();
    expect(errors.thirdPartyPercent).toBeUndefined();
  });
});

describe("calculateEmployeeCost — Simples Nacional, demais anexos (I, II, III, V)", () => {
  it("não soma INSS patronal/RAT/terceiros (já embutidos no DAS)", () => {
    const result = calculateEmployeeCost(
      base({ regime: "simples_outros", monthlyBenefits: 300 })
    );
    expect(result.employerINSS).toBe(0);
    expect(result.rat).toBe(0);
    expect(result.thirdParty).toBe(0);
    expect(result.totalCharges).toBeCloseTo(870, 1);
    expect(result.headline).toBeCloseTo(4170, 1);
  });

  it("regime simples_outros ignora validação de RAT/terceiros", () => {
    const errors = validateEmployeeCostInput(
      base({ regime: "simples_outros", ratPercent: Number.NaN, thirdPartyPercent: Number.NaN })
    );
    expect(errors.ratPercent).toBeUndefined();
    expect(errors.thirdPartyPercent).toBeUndefined();
  });
});

describe("validação", () => {
  it("salário zero ou negativo é inválido", () => {
    expect(validateEmployeeCostInput(base({ grossSalary: 0 })).grossSalary).toBeDefined();
  });

  it("RAT fora de 1-3% é inválido no regime geral", () => {
    expect(validateEmployeeCostInput(base({ ratPercent: 0 })).ratPercent).toBeDefined();
    expect(validateEmployeeCostInput(base({ ratPercent: 4 })).ratPercent).toBeDefined();
  });

  it("benefícios negativos são inválidos", () => {
    expect(validateEmployeeCostInput(base({ monthlyBenefits: -10 })).monthlyBenefits).toBeDefined();
  });

  it("entrada válida não gera erros", () => {
    expect(isEmployeeCostInputValid(base())).toBe(true);
  });
});
