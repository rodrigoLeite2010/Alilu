import { describe, expect, it } from "vitest";
import {
  calculateCompoundInterest,
  isCompoundInterestInputValid,
  toMonthlyRate,
  validateCompoundInterestInput,
  type CompoundInterestInput,
} from "@/lib/calculators/compound-interest";

/**
 * Testes da Calculadora de Juros Compostos (ETAPA 3, seção "TESTES").
 * Os valores esperados vêm de uma fórmula fechada independente da
 * implementação (anuidade postecipada — aporte ao final do período):
 *
 *   FV = P*(1+i)^n + C*(((1+i)^n - 1) / i)   quando i > 0
 *   FV = P + C*n                              quando i = 0
 *
 * onde P = valor inicial, C = aporte mensal, i = taxa mensal, n = meses.
 * Isso garante que os testes comprovam o resultado matemático, não apenas
 * que a função executa sem erro.
 */
function expectedFutureValue(
  initial: number,
  contribution: number,
  monthlyRate: number,
  months: number
): number {
  if (monthlyRate === 0) {
    return initial + contribution * months;
  }
  const factor = Math.pow(1 + monthlyRate, months);
  return initial * factor + contribution * ((factor - 1) / monthlyRate);
}

function baseInput(
  overrides: Partial<CompoundInterestInput> = {}
): CompoundInterestInput {
  return {
    initialAmount: 1000,
    monthlyContribution: 0,
    rate: 1,
    rateType: "mensal",
    period: 12,
    periodType: "meses",
    ...overrides,
  };
}

describe("1) capital sem aporte", () => {
  it("cresce exatamente conforme a fórmula de juros compostos", () => {
    const result = calculateCompoundInterest(baseInput());
    expect(result.finalAmount).toBeCloseTo(
      expectedFutureValue(1000, 0, 0.01, 12),
      6
    );
    expect(result.details.totalContributed).toBe(0);
    expect(result.details.totalInvested).toBe(1000);
  });
});

describe("2) capital + aportes", () => {
  it("soma corretamente o crescimento do capital e dos aportes", () => {
    const input = baseInput({ monthlyContribution: 100 });
    const result = calculateCompoundInterest(input);
    expect(result.finalAmount).toBeCloseTo(
      expectedFutureValue(1000, 100, 0.01, 12),
      6
    );
    expect(result.details.totalContributed).toBeCloseTo(1200, 6);
    expect(result.details.totalInvested).toBeCloseTo(2200, 6);
  });
});

describe("3) somente aportes", () => {
  it("calcula corretamente quando o valor inicial é zero", () => {
    const input = baseInput({ initialAmount: 0, monthlyContribution: 100 });
    const result = calculateCompoundInterest(input);
    expect(result.finalAmount).toBeCloseTo(
      expectedFutureValue(0, 100, 0.01, 12),
      6
    );
    expect(result.details.initialAmount).toBe(0);
  });
});

describe("4) taxa zero", () => {
  it("não gera nenhum juro — valor final é só capital + aportes", () => {
    const input = baseInput({ monthlyContribution: 100, rate: 0 });
    const result = calculateCompoundInterest(input);
    expect(result.finalAmount).toBeCloseTo(2200, 9);
    expect(result.details.totalInterest).toBeCloseTo(0, 9);
  });
});

describe("5) taxa mensal", () => {
  it("usa a taxa informada diretamente, sem nenhuma conversão", () => {
    expect(toMonthlyRate(2, "mensal")).toBeCloseTo(0.02, 12);
    const result = calculateCompoundInterest(
      baseInput({ rate: 2, period: 1 })
    );
    expect(result.finalAmount).toBeCloseTo(1020, 9);
  });
});

describe("6) taxa anual convertida para mensal", () => {
  it("converte a taxa anual para a mensal equivalente antes de simular", () => {
    const monthlyRate = toMonthlyRate(12, "anual");
    expect(monthlyRate).toBeCloseTo(Math.pow(1.12, 1 / 12) - 1, 12);

    // 12 meses a essa taxa mensal equivalente devem fechar exatamente em 12% ao ano.
    const result = calculateCompoundInterest(
      baseInput({ rate: 12, rateType: "anual", period: 12, periodType: "meses" })
    );
    expect(result.finalAmount).toBeCloseTo(1120, 6);
  });
});

describe("7) 1 mês", () => {
  it("calcula corretamente um único mês", () => {
    const result = calculateCompoundInterest(baseInput({ period: 1 }));
    expect(result.finalAmount).toBeCloseTo(1010, 9);
    expect(result.months).toHaveLength(1);
  });
});

describe("8) vários anos", () => {
  it("converte o período em anos para meses corretamente", () => {
    const input = baseInput({
      monthlyContribution: 50,
      rate: 0.8,
      period: 5,
      periodType: "anos",
    });
    const result = calculateCompoundInterest(input);
    expect(result.months).toHaveLength(60);
    expect(result.finalAmount).toBeCloseTo(
      expectedFutureValue(1000, 50, 0.008, 60),
      6
    );
  });
});

describe("9) valores decimais", () => {
  it("lida corretamente com valores com centavos", () => {
    const input = baseInput({
      initialAmount: 1234.56,
      monthlyContribution: 78.9,
      rate: 0.75,
      period: 6,
    });
    const result = calculateCompoundInterest(input);
    expect(result.finalAmount).toBeCloseTo(
      expectedFutureValue(1234.56, 78.9, 0.0075, 6),
      6
    );
  });
});

describe("10) entradas inválidas", () => {
  it("rejeita valor inicial negativo", () => {
    const errors = validateCompoundInterestInput(
      baseInput({ initialAmount: -1 })
    );
    expect(errors.initialAmount).toBeTruthy();
  });

  it("rejeita aporte mensal negativo", () => {
    const errors = validateCompoundInterestInput(
      baseInput({ monthlyContribution: -10 })
    );
    expect(errors.monthlyContribution).toBeTruthy();
  });

  it("rejeita taxa negativa", () => {
    const errors = validateCompoundInterestInput(baseInput({ rate: -1 }));
    expect(errors.rate).toBeTruthy();
  });

  it("rejeita período zero ou negativo", () => {
    expect(validateCompoundInterestInput(baseInput({ period: 0 })).period).toBeTruthy();
    expect(validateCompoundInterestInput(baseInput({ period: -3 })).period).toBeTruthy();
  });

  it("rejeita período não inteiro", () => {
    expect(validateCompoundInterestInput(baseInput({ period: 2.5 })).period).toBeTruthy();
  });

  it("rejeita valor inicial e aporte mensal ambos zero", () => {
    const errors = validateCompoundInterestInput(
      baseInput({ initialAmount: 0, monthlyContribution: 0 })
    );
    expect(errors.initialAmount).toBeTruthy();
  });

  it("aceita valor inicial zero quando há aporte mensal positivo", () => {
    expect(
      isCompoundInterestInputValid(
        baseInput({ initialAmount: 0, monthlyContribution: 50 })
      )
    ).toBe(true);
  });

  it("aceita taxa zero (não é um valor inválido)", () => {
    expect(isCompoundInterestInputValid(baseInput({ rate: 0 }))).toBe(true);
  });

  it("rejeita entradas não numéricas (NaN)", () => {
    const errors = validateCompoundInterestInput(
      baseInput({ initialAmount: NaN, rate: NaN, period: NaN })
    );
    expect(errors.initialAmount).toBeTruthy();
    expect(errors.rate).toBeTruthy();
    expect(errors.period).toBeTruthy();
  });
});

describe("cálculo não arredonda valores intermediários", () => {
  it("mantém casas decimais completas nos meses (arredondamento é só de exibição)", () => {
    // Taxa escolhida de propósito para gerar um valor com muitas casas
    // decimais no meio da simulação, e comparada com o valor exato
    // calculado de forma independente (sem passar pela implementação).
    const result = calculateCompoundInterest(
      baseInput({ initialAmount: 1000, rate: 0.33, period: 2 })
    );
    const month1Interest = 1000 * 0.0033;
    const month2StartingBalance = 1000 + month1Interest;
    const month2Interest = month2StartingBalance * 0.0033;

    expect(result.months[1].interest).toBeCloseTo(month2Interest, 12);
    // O valor exato tem mais de duas casas decimais — não foi arredondado.
    expect(result.months[1].interest).not.toBe(
      Math.round(result.months[1].interest * 100) / 100
    );
  });
});
