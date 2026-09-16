import { describe, expect, it } from "vitest";
import { normalizeForSearch, slugify } from "@/lib/formatters/text";

describe("slugify", () => {
  it("converte espaços em hífens e remove acentos", () => {
    expect(slugify("Calculadora de Rescisão")).toBe("calculadora-de-rescisao");
  });

  it("remove caracteres especiais", () => {
    expect(slugify("SAC x Price (comparador)")).toBe("sac-x-price-comparador");
  });

  it("colapsa hífens duplicados e remove das pontas", () => {
    expect(slugify("  -- Juros   Compostos -- ")).toBe("juros-compostos");
  });

  it("retorna string vazia para entrada vazia", () => {
    expect(slugify("")).toBe("");
  });
});

describe("normalizeForSearch", () => {
  it("remove acentuação e caixa alta para comparação de busca", () => {
    expect(normalizeForSearch("Divisão de Despesas")).toBe(
      "divisao de despesas"
    );
  });

  it("mantém números intactos", () => {
    expect(normalizeForSearch("13º Salário")).toBe("13º salario");
  });
});
