import { describe, expect, it } from "vitest";
import {
  calculateBillSplit,
  isBillSplitInputValid,
  validateBillSplitInput,
  type BillSplitInput,
} from "@/lib/calculators/bill-split";

const equalBase = (overrides: Partial<BillSplitInput> = {}): BillSplitInput => ({
  mode: "equal",
  total: 100,
  peopleCount: 4,
  serviceFeePercent: 0,
  discountPercent: 0,
  participants: [],
  ...overrides,
});

describe("modo igual (equal)", () => {
  it("100 dividido por 4, sem taxa nem desconto = 25 por pessoa", () => {
    const result = calculateBillSplit(equalBase());
    expect(result.headline).toBeCloseTo(100, 10);
    expect(result.amountPerPerson).toBeCloseTo(25, 10);
  });

  it("100 com 10% de taxa de serviço = 110 total, 27,50 por pessoa (4 pessoas)", () => {
    const result = calculateBillSplit(equalBase({ serviceFeePercent: 10 }));
    expect(result.serviceFeeAmount).toBeCloseTo(10, 10);
    expect(result.headline).toBeCloseTo(110, 10);
    expect(result.amountPerPerson).toBeCloseTo(27.5, 10);
  });

  it("100 com 10% de desconto = 90 total, 22,50 por pessoa (4 pessoas)", () => {
    const result = calculateBillSplit(equalBase({ discountPercent: 10 }));
    expect(result.discountAmount).toBeCloseTo(10, 10);
    expect(result.headline).toBeCloseTo(90, 10);
    expect(result.amountPerPerson).toBeCloseTo(22.5, 10);
  });

  it("taxa de serviço e desconto combinados", () => {
    const result = calculateBillSplit(
      equalBase({ total: 200, peopleCount: 5, serviceFeePercent: 10, discountPercent: 5 })
    );
    // 200 + 20 (10%) - 10 (5%) = 210; 210/5 = 42
    expect(result.headline).toBeCloseTo(210, 10);
    expect(result.amountPerPerson).toBeCloseTo(42, 10);
  });

  it("1 pessoa: valor por pessoa é o total inteiro", () => {
    const result = calculateBillSplit(equalBase({ peopleCount: 1 }));
    expect(result.amountPerPerson).toBeCloseTo(result.headline, 10);
  });

  it("total zero/negativo é inválido", () => {
    expect(validateBillSplitInput(equalBase({ total: 0 })).total).toBeDefined();
    expect(validateBillSplitInput(equalBase({ total: -10 })).total).toBeDefined();
  });

  it("número de pessoas zero, negativo ou decimal é inválido", () => {
    expect(validateBillSplitInput(equalBase({ peopleCount: 0 })).peopleCount).toBeDefined();
    expect(validateBillSplitInput(equalBase({ peopleCount: -1 })).peopleCount).toBeDefined();
    expect(validateBillSplitInput(equalBase({ peopleCount: 2.5 })).peopleCount).toBeDefined();
  });

  it("desconto acima de 100% é inválido", () => {
    expect(validateBillSplitInput(equalBase({ discountPercent: 150 })).discountPercent).toBeDefined();
  });

  it("entrada válida não gera erros", () => {
    expect(isBillSplitInputValid(equalBase())).toBe(true);
  });
});

describe("modo personalizado (custom)", () => {
  const customBase = (overrides: Partial<BillSplitInput> = {}): BillSplitInput => ({
    mode: "custom",
    total: 0,
    peopleCount: 0,
    serviceFeePercent: 0,
    discountPercent: 0,
    participants: [
      { name: "Ana", amount: 60 },
      { name: "Bruno", amount: 40 },
    ],
    ...overrides,
  });

  it("divide proporcionalmente ao consumo de cada um, sem taxa/desconto", () => {
    const result = calculateBillSplit(customBase());
    expect(result.subtotal).toBeCloseTo(100, 10);
    expect(result.participants).toHaveLength(2);
    expect(result.participants?.[0].amountToPay).toBeCloseTo(60, 10);
    expect(result.participants?.[1].amountToPay).toBeCloseTo(40, 10);
  });

  it("rateia a taxa de serviço proporcionalmente ao consumo (60/40) e fecha o total", () => {
    const result = calculateBillSplit(customBase({ serviceFeePercent: 10 }));
    expect(result.headline).toBeCloseTo(110, 10);
    // Ana consumiu 60% do total, Bruno 40%.
    expect(result.participants?.[0].amountToPay).toBeCloseTo(66, 10);
    expect(result.participants?.[1].amountToPay).toBeCloseTo(44, 10);
    const sum = result.participants!.reduce((acc, p) => acc + p.amountToPay, 0);
    expect(sum).toBeCloseTo(result.headline, 8);
  });

  it("ignora participantes com nome vazio", () => {
    const result = calculateBillSplit(
      customBase({
        participants: [
          { name: "Ana", amount: 50 },
          { name: "", amount: 999 },
        ],
      })
    );
    expect(result.participants).toHaveLength(1);
    expect(result.subtotal).toBeCloseTo(50, 10);
  });

  it("nenhum participante válido é inválido", () => {
    const errors = validateBillSplitInput(customBase({ participants: [] }));
    expect(errors.participants).toBeDefined();
  });

  it("valor negativo de participante é inválido", () => {
    const errors = validateBillSplitInput(
      customBase({ participants: [{ name: "Ana", amount: -10 }] })
    );
    expect(errors.participants).toBeDefined();
  });

  it("todos os participantes com consumo zero é inválido (nada para ratear)", () => {
    const errors = validateBillSplitInput(
      customBase({
        participants: [
          { name: "Ana", amount: 0 },
          { name: "Bruno", amount: 0 },
        ],
      })
    );
    expect(errors.participants).toBeDefined();
  });
});
