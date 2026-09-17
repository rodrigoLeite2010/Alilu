import { describe, expect, it } from "vitest";
import {
  calculateOvertime,
  isOvertimeInputValid,
  validateOvertimeInput,
  type OvertimeInput,
} from "@/lib/calculators/overtime";

const base = (overrides: Partial<OvertimeInput> = {}): OvertimeInput => ({
  monthlySalary: 2200,
  weeklyHours: 44,
  overtimeHours: 10,
  overtimePercent: 50,
  ...overrides,
});

describe("calculateOvertime", () => {
  it("salário 2.200, jornada 44h (divisor 220), 10h extras a 50% = valor hora 10, hora extra 15, total 150", () => {
    const result = calculateOvertime(base());
    expect(result.monthlyHoursDivisor).toBe(220);
    expect(result.normalHourValue).toBeCloseTo(10, 10);
    expect(result.overtimeHourValue).toBeCloseTo(15, 10);
    expect(result.headline).toBeCloseTo(150, 10);
  });

  it("jornada de 40h usa divisor 200 (Súmula 431/TST)", () => {
    const result = calculateOvertime(base({ monthlySalary: 2000, weeklyHours: 40, overtimeHours: 1 }));
    expect(result.monthlyHoursDivisor).toBe(200);
    expect(result.normalHourValue).toBeCloseTo(10, 10);
  });

  it("adicional de 100% dobra o valor da hora normal", () => {
    const result = calculateOvertime(base({ overtimePercent: 100, overtimeHours: 1 }));
    expect(result.overtimeHourValue).toBeCloseTo(result.normalHourValue * 2, 10);
  });

  it("zero horas extras resulta em total zero", () => {
    const result = calculateOvertime(base({ overtimeHours: 0 }));
    expect(result.headline).toBe(0);
  });

  it("additionalOnlyValue é a diferença entre a hora extra e a hora normal", () => {
    const result = calculateOvertime(base());
    expect(result.additionalOnlyValue).toBeCloseTo(5, 10);
  });

  it("salário zero ou negativo é inválido", () => {
    expect(validateOvertimeInput(base({ monthlySalary: 0 })).monthlySalary).toBeDefined();
    expect(validateOvertimeInput(base({ monthlySalary: -100 })).monthlySalary).toBeDefined();
  });

  it("jornada semanal acima de 44h é inválida (limite constitucional)", () => {
    expect(validateOvertimeInput(base({ weeklyHours: 45 })).weeklyHours).toBeDefined();
  });

  it("horas extras negativas são inválidas", () => {
    expect(validateOvertimeInput(base({ overtimeHours: -1 })).overtimeHours).toBeDefined();
  });

  it("adicional abaixo de 50% é inválido (mínimo constitucional)", () => {
    expect(validateOvertimeInput(base({ overtimePercent: 30 })).overtimePercent).toBeDefined();
  });

  it("entrada válida não gera erros", () => {
    expect(isOvertimeInputValid(base())).toBe(true);
  });
});
