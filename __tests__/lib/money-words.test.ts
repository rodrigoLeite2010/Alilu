import { describe, expect, it } from "vitest";
import { moneyToWordsBRL, integerToWords } from "@/lib/formatters/money-words";

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

  // Correção pré-commit da ETAPA 3: valores >= 1 bilhão estavam incorretos
  // (o grupo de milhar de "bilhões" não era reconhecido, gerando texto como
  // " milhões de reais" para 1 bilhão). A correção generaliza a quebra em
  // grupos de três dígitos para qualquer escala (mil, milhão, bilhão,
  // trilhão, ...), não apenas um patch pontual para bilhões.
  describe("valores na casa dos bilhões (e acima)", () => {
    it.each([
      [1_000_000_000, "um bilhão de reais"],
      [1_000_000_001, "um bilhão e um reais"],
      [2_000_000_000, "dois bilhões de reais"],
      [1_500_000_000, "um bilhão e quinhentos milhões de reais"],
      [999_999_999_999, "novecentos e noventa e nove bilhões novecentos e noventa e nove milhões novecentos e noventa e nove mil novecentos e noventa e nove reais"],
    ])("converte %s para \"%s\"", (value, expected) => {
      expect(moneyToWordsBRL(value)).toBe(expected);
    });

    it("mantém o singular do substantivo apenas quando o total é exatamente 1", () => {
      expect(moneyToWordsBRL(1_000_000_000)).not.toContain("reais de");
      expect(moneyToWordsBRL(1_000_000_000)).toContain("um bilhão");
    });

    it("respeita plural de milhão dentro de um valor em bilhões", () => {
      expect(moneyToWordsBRL(1_001_000_000)).toBe(
        "um bilhão e um milhão de reais"
      );
    });

    it("preserva o comportamento já correto para milhares e milhões isolados", () => {
      expect(moneyToWordsBRL(1000)).toBe("mil reais");
      expect(moneyToWordsBRL(1_000_000)).toBe("um milhão de reais");
      expect(moneyToWordsBRL(1_500_000)).toBe("um milhão e quinhentos mil reais");
    });
  });
});

/**
 * Testes de `integerToWords`, exportado para reuso pela ferramenta Número
 * por Extenso (categoria Funções String).
 */
describe("integerToWords", () => {
  it.each([
    [0, "zero"],
    [1, "um"],
    [15, "quinze"],
    [21, "vinte e um"],
    [100, "cem"],
    [101, "cento e um"],
    [123, "cento e vinte e três"],
    [250, "duzentos e cinquenta"],
    [1000, "mil"],
    [1001, "mil e um"],
    [1250, "mil duzentos e cinquenta"],
    [1_000_000, "um milhão"],
    [2_000_000, "dois milhões"],
  ])("converte %s para \"%s\"", (value, expected) => {
    expect(integerToWords(value)).toBe(expected);
  });
});
