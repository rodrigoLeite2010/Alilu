import { describe, expect, it } from "vitest";
import {
  calculateFinancing,
  isFinancingInputValid,
  MAX_INSTALLMENTS,
  toMonthlyRate,
  validateFinancingInput,
  type FinancingInput,
} from "@/lib/calculators/financing";

/**
 * Testes do Simulador de Financiamento SAC x Price (ETAPA 4, seção
 * "TESTES"). Os valores esperados são verificados por caminhos
 * independentes da implementação (fórmula de valor presente para o Price,
 * somas diretas para o SAC), não apenas checando se a função executa.
 */

function baseInput(overrides: Partial<FinancingInput> = {}): FinancingInput {
  return {
    assetValue: 10000,
    downPayment: 0,
    rate: 2,
    rateType: "mensal",
    installments: 12,
    system: "comparar",
    ...overrides,
  };
}

/**
 * Valor presente de uma série de prestações, descontada à taxa mensal `i`.
 * Para o sistema Price (prestação constante), esse valor presente deve
 * fechar exatamente no valor financiado — uma verificação matemática
 * independente da fórmula usada para gerar a prestação.
 */
function presentValue(payments: number[], monthlyRate: number): number {
  return payments.reduce(
    (sum, payment, index) => sum + payment / Math.pow(1 + monthlyRate, index + 1),
    0
  );
}

describe("1) Price sem entrada", () => {
  it("financia o valor total do bem e o valor presente das prestações fecha no financiado", () => {
    const input = baseInput({ assetValue: 10000, downPayment: 0, system: "price" });
    const result = calculateFinancing(input);

    expect(result.financedAmount).toBe(10000);
    expect(result.price).toBeDefined();
    const payments = result.price!.installments.map((row) => row.payment);
    expect(presentValue(payments, result.monthlyRate)).toBeCloseTo(10000, 6);
  });
});

describe("2) Price com entrada", () => {
  it("financia somente o valor do bem menos a entrada", () => {
    const input = baseInput({ assetValue: 10000, downPayment: 2000, system: "price" });
    const result = calculateFinancing(input);

    expect(result.financedAmount).toBe(8000);
    const payments = result.price!.installments.map((row) => row.payment);
    expect(presentValue(payments, result.monthlyRate)).toBeCloseTo(8000, 6);
  });
});

describe("3) SAC sem entrada", () => {
  it("financia o valor total e a soma das amortizações fecha no financiado", () => {
    const input = baseInput({ assetValue: 10000, downPayment: 0, system: "sac" });
    const result = calculateFinancing(input);

    expect(result.financedAmount).toBe(10000);
    const totalAmortization = result.sac!.installments.reduce(
      (sum, row) => sum + row.amortization,
      0
    );
    expect(totalAmortization).toBeCloseTo(10000, 6);
  });
});

describe("4) SAC com entrada", () => {
  it("financia somente o valor do bem menos a entrada", () => {
    const input = baseInput({ assetValue: 10000, downPayment: 2000, system: "sac" });
    const result = calculateFinancing(input);

    expect(result.financedAmount).toBe(8000);
    const totalAmortization = result.sac!.installments.reduce(
      (sum, row) => sum + row.amortization,
      0
    );
    expect(totalAmortization).toBeCloseTo(8000, 6);
  });
});

describe("5) taxa zero", () => {
  it("gera prestações idênticas (sem juros) e iguais em Price e SAC", () => {
    const input = baseInput({ assetValue: 12000, rate: 0, system: "comparar" });
    const result = calculateFinancing(input);

    for (const row of result.price!.installments) {
      expect(row.interest).toBeCloseTo(0, 9);
      expect(row.payment).toBeCloseTo(1000, 9);
    }
    for (const row of result.sac!.installments) {
      expect(row.interest).toBeCloseTo(0, 9);
      expect(row.payment).toBeCloseTo(1000, 9);
    }
    // Sem juros, Price e SAC são idênticos (ambos viram parcelas iguais).
    expect(result.price!.totalPaid).toBeCloseTo(result.sac!.totalPaid, 9);
  });
});

describe("6) 1 parcela", () => {
  it("Price e SAC produzem o mesmo resultado com uma única parcela", () => {
    const input = baseInput({ assetValue: 1000, rate: 5, installments: 1, system: "comparar" });
    const result = calculateFinancing(input);

    expect(result.price!.installments).toHaveLength(1);
    expect(result.sac!.installments).toHaveLength(1);
    expect(result.price!.installments[0].payment).toBeCloseTo(1050, 9);
    expect(result.sac!.installments[0].payment).toBeCloseTo(1050, 9);
    expect(result.price!.installments[0].balance).toBeCloseTo(0, 6);
    expect(result.sac!.installments[0].balance).toBeCloseTo(0, 6);
  });
});

describe("7) taxa mensal", () => {
  it("usa a taxa informada diretamente, sem nenhuma conversão", () => {
    expect(toMonthlyRate(2, "mensal")).toBeCloseTo(0.02, 12);
  });
});

describe("8) taxa anual equivalente", () => {
  it("converte a taxa anual para a mensal equivalente antes de simular", () => {
    const monthlyRate = toMonthlyRate(12, "anual");
    expect(monthlyRate).toBeCloseTo(Math.pow(1.12, 1 / 12) - 1, 12);

    const viaAnual = calculateFinancing(
      baseInput({ rate: 12, rateType: "anual", system: "price" })
    );
    const viaMensalEquivalente = calculateFinancing(
      baseInput({ rate: monthlyRate * 100, rateType: "mensal", system: "price" })
    );
    expect(viaAnual.price!.firstPayment).toBeCloseTo(
      viaMensalEquivalente.price!.firstPayment,
      6
    );
  });
});

describe("9) saldo final próximo de zero", () => {
  it("o saldo devedor da última parcela é (quase) zero em Price e SAC", () => {
    const result = calculateFinancing(baseInput({ system: "comparar" }));
    expect(result.price!.installments.at(-1)!.balance).toBeCloseTo(0, 6);
    expect(result.sac!.installments.at(-1)!.balance).toBeCloseTo(0, 6);
  });
});

describe("10) soma das amortizações = principal", () => {
  it("a soma de todas as amortizações fecha no valor financiado, em ambos os sistemas", () => {
    const result = calculateFinancing(
      baseInput({ assetValue: 25000, downPayment: 5000, system: "comparar" })
    );
    const priceTotal = result.price!.installments.reduce(
      (sum, row) => sum + row.amortization,
      0
    );
    const sacTotal = result.sac!.installments.reduce(
      (sum, row) => sum + row.amortization,
      0
    );
    expect(priceTotal).toBeCloseTo(result.financedAmount, 6);
    expect(sacTotal).toBeCloseTo(result.financedAmount, 6);
  });
});

describe("11) total de juros", () => {
  it("o total de juros é igual à diferença entre o total pago e o valor financiado", () => {
    const result = calculateFinancing(baseInput({ system: "comparar" }));
    expect(result.price!.totalInterest).toBeCloseTo(
      result.price!.totalPaid - result.financedAmount,
      6
    );
    expect(result.sac!.totalInterest).toBeCloseTo(
      result.sac!.totalPaid - result.financedAmount,
      6
    );
    // Com juros positivos, o SAC paga menos juros totais que o Price
    // (amortiza mais rápido no início) — verificação de sanidade cruzada.
    expect(result.sac!.totalInterest).toBeLessThan(result.price!.totalInterest);
  });
});

describe("12) prestação Price constante", () => {
  it("todas as prestações do Price têm o mesmo valor", () => {
    const result = calculateFinancing(baseInput({ system: "price" }));
    const firstPayment = result.price!.installments[0].payment;
    for (const row of result.price!.installments) {
      expect(row.payment).toBeCloseTo(firstPayment, 9);
    }
  });
});

describe("13) amortização SAC constante", () => {
  it("todas as amortizações do SAC têm o mesmo valor", () => {
    const result = calculateFinancing(baseInput({ system: "sac" }));
    const firstAmortization = result.sac!.installments[0].amortization;
    for (const row of result.sac!.installments) {
      expect(row.amortization).toBeCloseTo(firstAmortization, 9);
    }
  });
});

describe("14) prestação SAC decrescente", () => {
  it("a prestação do SAC diminui estritamente a cada mês (com juros > 0)", () => {
    const result = calculateFinancing(baseInput({ system: "sac" }));
    const payments = result.sac!.installments.map((row) => row.payment);
    for (let i = 1; i < payments.length; i += 1) {
      expect(payments[i]).toBeLessThan(payments[i - 1]);
    }
  });
});

describe("15) entradas inválidas", () => {
  it("rejeita valor do bem zero ou negativo", () => {
    expect(
      validateFinancingInput(baseInput({ assetValue: 0 })).assetValue
    ).toBeTruthy();
    expect(
      validateFinancingInput(baseInput({ assetValue: -100 })).assetValue
    ).toBeTruthy();
  });

  it("rejeita entrada negativa", () => {
    expect(
      validateFinancingInput(baseInput({ downPayment: -1 })).downPayment
    ).toBeTruthy();
  });

  it("rejeita entrada maior ou igual ao valor do bem", () => {
    expect(
      validateFinancingInput(baseInput({ assetValue: 5000, downPayment: 5000 }))
        .downPayment
    ).toBeTruthy();
    expect(
      validateFinancingInput(baseInput({ assetValue: 5000, downPayment: 6000 }))
        .downPayment
    ).toBeTruthy();
  });

  it("rejeita taxa negativa", () => {
    expect(validateFinancingInput(baseInput({ rate: -1 })).rate).toBeTruthy();
  });

  it("aceita taxa zero (não é um valor inválido)", () => {
    expect(isFinancingInputValid(baseInput({ rate: 0 }))).toBe(true);
  });

  it("rejeita número de parcelas zero, negativo ou não inteiro", () => {
    expect(
      validateFinancingInput(baseInput({ installments: 0 })).installments
    ).toBeTruthy();
    expect(
      validateFinancingInput(baseInput({ installments: -5 })).installments
    ).toBeTruthy();
    expect(
      validateFinancingInput(baseInput({ installments: 2.5 })).installments
    ).toBeTruthy();
  });

  it("rejeita número de parcelas acima do limite razoável", () => {
    expect(
      validateFinancingInput(baseInput({ installments: MAX_INSTALLMENTS + 1 }))
        .installments
    ).toBeTruthy();
    expect(
      isFinancingInputValid(baseInput({ installments: MAX_INSTALLMENTS }))
    ).toBe(true);
  });

  it("rejeita entradas não numéricas (NaN)", () => {
    const errors = validateFinancingInput(
      baseInput({ assetValue: NaN, rate: NaN, installments: NaN })
    );
    expect(errors.assetValue).toBeTruthy();
    expect(errors.rate).toBeTruthy();
    expect(errors.installments).toBeTruthy();
  });
});

describe("cálculo não arredonda valores intermediários", () => {
  it("mantém casas decimais completas nas parcelas (arredondamento é só de exibição)", () => {
    const result = calculateFinancing(
      baseInput({ assetValue: 10000, rate: 1.33, installments: 6, system: "price" })
    );
    const payment = result.price!.installments[0].payment;
    expect(payment).not.toBe(Math.round(payment * 100) / 100);
  });
});
