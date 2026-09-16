import { describe, expect, it } from "vitest";
import { moneyToWordsBRL } from "@/lib/formatters/money-words";

/**
 * Testes do conversor de valores monetários para texto por extenso
 * (PROMPT ETAPA 2, seção 21). Cobre todos os valores exigidos pela
 * auditoria, além dos exemplos apresentados na seção 7 do prompt mestre.
 */
describe("moneyToWordsBRL", () => {
  it.each([
    [0.01, "um centavo"],
    [1.0, "um real"],
    [2.0, "dois reais"],
    [10.5, "dez reais e cinquenta centavos"],
    [21.0, "vinte e um reais"],
    [100.0, "cem reais"],
    [101.0, "cento e um reais"],
    [999.99, "novecentos e noventa e nove reais e noventa e nove centavos"],
    [1000.0, "mil reais"],
    [1001.0, "mil e um reais"],
    [1100.0, "mil e cem reais"],
    [1250.75, "mil duzentos e cinquenta reais e setenta e cinco centavos"],
    [10000.0, "dez mil reais"],
    [100000.0, "cem mil reais"],
    [1000000.0, "um milhão de reais"],
  ])("converte %s para \"%s\"", (value, expected) => {
    expect(moneyToWordsBRL(value)).toBe(expected);
  });

  it("trata zero como \"zero reais\"", () => {
    expect(moneyToWordsBRL(0)).toBe("zero reais");
  });

  it("trata valores não finitos ou negativos como zero", () => {
    expect(moneyToWordsBRL(NaN)).toBe("zero reais");
    expect(moneyToWordsBRL(-50)).toBe("zero reais");
  });

  it("arredonda corretamente valores com mais de duas casas decimais", () => {
    expect(moneyToWordsBRL(10.005)).toBe("dez reais e um centavo");
  });

  it("usa singular para dois milhões exatos apenas no plural correto", () => {
    expect(moneyToWordsBRL(2000000)).toBe("dois milhões de reais");
  });
});
