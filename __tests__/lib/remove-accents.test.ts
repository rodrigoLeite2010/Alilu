import { describe, expect, it } from "vitest";
import { removeAccents } from "@/lib/formatters/remove-accents";

describe("removeAccents", () => {
  it("remove acentos preservando a caixa original", () => {
    expect(removeAccents("São José")).toBe("Sao Jose");
  });

  it("remove til, cedilha e acentos agudo/circunflexo", () => {
    expect(removeAccents("ação, informação, você, área")).toBe("acao, informacao, voce, area");
  });

  it("não altera texto sem acentos", () => {
    expect(removeAccents("texto sem acentos")).toBe("texto sem acentos");
  });

  it("não afeta números e pontuação", () => {
    expect(removeAccents("R$ 1.234,56 (à vista)")).toBe("R$ 1.234,56 (a vista)");
  });

  it("retorna string vazia para entrada vazia", () => {
    expect(removeAccents("")).toBe("");
  });
});
