import { describe, expect, it } from "vitest";
import {
  calculateBillSplit,
  isBillSplitInputValid,
  validateBillSplitInput,
  BILL_SPLIT_MAX_PEOPLE,
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

  it("CASO OBRIGATÓRIO DE AUDITORIA: R$100 entre 3 pessoas fecha em centavos exatos (sem perder nem duplicar centavo)", () => {
    const result = calculateBillSplit(equalBase({ total: 100, peopleCount: 3 }));

    // Não deve haver um único "amountPerPerson" igual para todos, pois
    // 100/3 = 33,333...; a divisão real precisa ser 2 pessoas em R$33,33 e
    // 1 pessoa em R$33,34 (ou qualquer combinação que some R$100,00 exato).
    expect(result.amountPerPerson).toBeUndefined();
    expect(result.equalShares).toBeDefined();

    const totalPeople = result.equalShares!.reduce((sum, share) => sum + share.peopleCount, 0);
    expect(totalPeople).toBe(3);

    const totalCents = result.equalShares!.reduce(
      (sum, share) => sum + Math.round(share.amount * 100) * share.peopleCount,
      0
    );
    expect(totalCents).toBe(10000); // R$100,00 em centavos, exatamente — nenhum centavo perdido.

    for (const share of result.equalShares!) {
      expect([33.33, 33.34]).toContain(share.amount);
    }
  });

  it("divisão exata (100/4) continua retornando um único valor por pessoa", () => {
    const result = calculateBillSplit(equalBase({ total: 100, peopleCount: 4 }));
    expect(result.equalShares).toEqual([{ amount: 25, peopleCount: 4 }]);
  });

  it("CASO OBRIGATÓRIO DE AUDITORIA: peopleCount = 1.000.000.000 é rejeitado pela validação (sem travar nem alocar memória excessiva)", () => {
    const start = Date.now();

    const errors = validateBillSplitInput(equalBase({ peopleCount: 1_000_000_000 }));
    expect(errors.peopleCount).toBeDefined();
    expect(isBillSplitInputValid(equalBase({ peopleCount: 1_000_000_000 }))).toBe(false);

    // calculateBillSplit nunca deveria ser chamado com um input inválido,
    // mas mesmo que algum chamador pule a validação, ele precisa continuar
    // O(1) — nunca materializar um array/estrutura do tamanho de
    // peopleCount — e retornar um resultado coerente (nunca travar).
    const result = calculateBillSplit(equalBase({ total: 100, peopleCount: 1_000_000_000 }));
    const totalPeople = result.equalShares!.reduce((sum, share) => sum + share.peopleCount, 0);
    expect(totalPeople).toBeLessThanOrEqual(BILL_SPLIT_MAX_PEOPLE);

    // Sanidade: isso não pode ter demorado nem perto do que levaria para
    // alocar um array de 1 bilhão de posições.
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it("número de pessoas acima do limite máximo é inválido", () => {
    expect(
      validateBillSplitInput(equalBase({ peopleCount: BILL_SPLIT_MAX_PEOPLE + 1 })).peopleCount
    ).toBeDefined();
  });

  it("número de pessoas dentro do limite (incluindo o limite exato) continua funcionando", () => {
    expect(isBillSplitInputValid(equalBase({ peopleCount: BILL_SPLIT_MAX_PEOPLE }))).toBe(true);

    const result = calculateBillSplit(equalBase({ total: 100, peopleCount: BILL_SPLIT_MAX_PEOPLE }));
    const totalPeople = result.equalShares!.reduce((sum, share) => sum + share.peopleCount, 0);
    expect(totalPeople).toBe(BILL_SPLIT_MAX_PEOPLE);
    const totalCents = result.equalShares!.reduce(
      (sum, share) => sum + Math.round(share.amount * 100) * share.peopleCount,
      0
    );
    expect(totalCents).toBe(10000);
  });

  it("número de pessoas decimal, negativo, zero ou excessivo é sempre inválido", () => {
    expect(validateBillSplitInput(equalBase({ peopleCount: 0 })).peopleCount).toBeDefined();
    expect(validateBillSplitInput(equalBase({ peopleCount: -5 })).peopleCount).toBeDefined();
    expect(validateBillSplitInput(equalBase({ peopleCount: 3.5 })).peopleCount).toBeDefined();
    expect(validateBillSplitInput(equalBase({ peopleCount: NaN })).peopleCount).toBeDefined();
    expect(validateBillSplitInput(equalBase({ peopleCount: Infinity })).peopleCount).toBeDefined();
    expect(
      validateBillSplitInput(equalBase({ peopleCount: BILL_SPLIT_MAX_PEOPLE + 1 })).peopleCount
    ).toBeDefined();
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

  it("CASO OBRIGATÓRIO DE AUDITORIA: a soma dos valores arredondados bate exatamente com o total em centavos, mesmo com rateio fracionário", () => {
    const result = calculateBillSplit(
      customBase({
        serviceFeePercent: 10,
        participants: [
          { name: "Ana", amount: 33 },
          { name: "Bruno", amount: 33 },
          { name: "Carla", amount: 34 },
        ],
      })
    );

    const sumCents = result.participants!.reduce(
      (sum, participant) => sum + Math.round(participant.amountToPay * 100),
      0
    );
    const totalCents = Math.round(result.headline * 100);
    expect(sumCents).toBe(totalCents);
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
