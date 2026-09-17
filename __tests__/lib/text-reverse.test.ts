import { describe, expect, it } from "vitest";
import { reverseText } from "@/lib/formatters/text-reverse";

describe("reverseText", () => {
  it("inverte os caracteres do texto", () => {
    expect(reverseText("Olá", "characters")).toBe("álO");
  });

  it("inverte a ordem das palavras, mantendo cada palavra intacta", () => {
    expect(reverseText("bom dia mundo", "words")).toBe("mundo dia bom");
  });

  it("inverte a ordem das linhas", () => {
    expect(reverseText("linha 1\nlinha 2\nlinha 3", "lines")).toBe("linha 3\nlinha 2\nlinha 1");
  });

  it("lida corretamente com emojis ao inverter por caracteres (sem quebrar pares substitutos)", () => {
    expect(reverseText("a😀b", "characters")).toBe("b😀a");
  });

  it("retorna string vazia para entrada vazia", () => {
    expect(reverseText("", "characters")).toBe("");
    expect(reverseText("", "words")).toBe("");
  });
});
