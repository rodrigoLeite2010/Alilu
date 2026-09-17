import { describe, expect, it } from "vitest";
import {
  generateNickname,
  generateNicknameBatch,
  validateNicknameGeneratorInput,
  isNicknameGeneratorInputValid,
  NICKNAME_GENERATOR_MAX_BATCH,
} from "@/lib/calculators/nickname-generator";

describe("nickname-generator", () => {
  it("gera um nick sem separador e sem número por padrão", () => {
    for (let i = 0; i < 30; i += 1) {
      const nick = generateNickname({ separator: "nenhum", includeNumber: false });
      expect(nick).toMatch(/^[A-Za-z]+$/);
    }
  });

  it("aplica o separador 'underline'", () => {
    const nick = generateNickname({ separator: "underline", includeNumber: false });
    expect(nick).toMatch(/^[A-Za-z]+_[A-Za-z]+$/);
  });

  it("aplica o separador 'ponto'", () => {
    const nick = generateNickname({ separator: "ponto", includeNumber: false });
    expect(nick).toMatch(/^[A-Za-z]+\.[A-Za-z]+$/);
  });

  it("inclui um número quando includeNumber é true", () => {
    const nick = generateNickname({ separator: "nenhum", includeNumber: true });
    expect(nick).toMatch(/^[A-Za-z]+\d+$/);
  });

  it("gera um lote com a quantidade pedida", () => {
    const batch = generateNicknameBatch({ count: 15, separator: "nenhum", includeNumber: false });
    expect(batch).toHaveLength(15);
  });

  it("nunca gera um lote maior que NICKNAME_GENERATOR_MAX_BATCH", () => {
    const batch = generateNicknameBatch({ count: 99999, separator: "nenhum", includeNumber: false });
    expect(batch).toHaveLength(NICKNAME_GENERATOR_MAX_BATCH);
  });

  it("valida quantidade fora do intervalo permitido", () => {
    expect(
      validateNicknameGeneratorInput({ count: 0, separator: "nenhum", includeNumber: false }).count
    ).toBeDefined();
    expect(isNicknameGeneratorInputValid({ count: 1, separator: "nenhum", includeNumber: false })).toBe(true);
  });
});
