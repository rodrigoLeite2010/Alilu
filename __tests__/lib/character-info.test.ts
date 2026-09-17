import { describe, expect, it } from "vitest";
import { getCharacterInfo } from "@/lib/formatters/character-info";

describe("getCharacterInfo", () => {
  it("retorna as informações corretas para a letra A", () => {
    const info = getCharacterInfo("A");
    expect(info).toEqual({
      char: "A",
      codePoint: 65,
      hex: "0041",
      decimal: 65,
      htmlEntityDecimal: "&#65;",
      htmlEntityHex: "&#x0041;",
      utf8Bytes: [65],
    });
  });

  it("calcula corretamente um caractere acentuado", () => {
    const info = getCharacterInfo("ç");
    expect(info?.codePoint).toBe(231);
    expect(info?.utf8Bytes).toEqual([195, 167]);
  });

  it("considera apenas o primeiro caractere de uma entrada com vários", () => {
    expect(getCharacterInfo("ABC")?.char).toBe("A");
  });

  it("lida corretamente com um emoji (fora do plano básico)", () => {
    const info = getCharacterInfo("😀");
    expect(info?.char).toBe("😀");
    expect(info?.codePoint).toBe(0x1f600);
  });

  it("retorna null para entrada vazia", () => {
    expect(getCharacterInfo("")).toBeNull();
  });
});
