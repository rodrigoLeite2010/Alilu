import { describe, expect, it } from "vitest";
import {
  generatePassword,
  estimatePasswordStrength,
  validatePasswordGeneratorInput,
  isPasswordGeneratorInputValid,
  LOWERCASE_CHARSET,
  UPPERCASE_CHARSET,
  NUMBERS_CHARSET,
  SYMBOLS_CHARSET,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from "@/lib/calculators/password-generator";

const allTrue = {
  length: 16,
  includeUppercase: true,
  includeLowercase: true,
  includeNumbers: true,
  includeSymbols: true,
};

describe("password-generator", () => {
  it("gera uma senha com o tamanho pedido", () => {
    for (const length of [4, 8, 16, 32, 64]) {
      const password = generatePassword({ ...allTrue, length });
      expect(password).toHaveLength(length);
    }
  });

  it("inclui pelo menos um caractere de cada conjunto selecionado", () => {
    for (let i = 0; i < 50; i += 1) {
      const password = generatePassword(allTrue);
      expect([...password].some((c) => LOWERCASE_CHARSET.includes(c))).toBe(true);
      expect([...password].some((c) => UPPERCASE_CHARSET.includes(c))).toBe(true);
      expect([...password].some((c) => NUMBERS_CHARSET.includes(c))).toBe(true);
      expect([...password].some((c) => SYMBOLS_CHARSET.includes(c))).toBe(true);
    }
  });

  it("usa apenas os conjuntos selecionados", () => {
    const password = generatePassword({
      length: 20,
      includeUppercase: false,
      includeLowercase: true,
      includeNumbers: false,
      includeSymbols: false,
    });
    expect(password).toMatch(new RegExp(`^[${LOWERCASE_CHARSET}]+$`));
  });

  it("gera senha só com números, respeitando o tamanho mínimo permitido", () => {
    const password = generatePassword({
      length: PASSWORD_MIN_LENGTH,
      includeUppercase: false,
      includeLowercase: false,
      includeNumbers: true,
      includeSymbols: false,
    });
    expect(password).toHaveLength(PASSWORD_MIN_LENGTH);
    expect(password).toMatch(/^\d+$/);
  });

  it("generatePassword lança erro quando nenhum conjunto é selecionado", () => {
    expect(() =>
      generatePassword({
        length: 8,
        includeUppercase: false,
        includeLowercase: false,
        includeNumbers: false,
        includeSymbols: false,
      })
    ).toThrow();
  });

  it("estimatePasswordStrength cresce com tamanho e variedade de caracteres", () => {
    const weak = estimatePasswordStrength({
      length: 4,
      includeUppercase: false,
      includeLowercase: true,
      includeNumbers: false,
      includeSymbols: false,
    });
    const strong = estimatePasswordStrength({
      length: 32,
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: true,
    });
    expect(strong.entropyBits).toBeGreaterThan(weak.entropyBits);
    expect(weak.strength).toBe("fraca");
    expect(strong.strength).toBe("muito-forte");
  });

  it("valida tamanho fora do intervalo permitido", () => {
    expect(
      validatePasswordGeneratorInput({ ...allTrue, length: PASSWORD_MIN_LENGTH - 1 }).length
    ).toBeDefined();
    expect(
      validatePasswordGeneratorInput({ ...allTrue, length: PASSWORD_MAX_LENGTH + 1 }).length
    ).toBeDefined();
    expect(isPasswordGeneratorInputValid(allTrue)).toBe(true);
  });

  it("valida que ao menos um conjunto de caracteres foi selecionado", () => {
    const errors = validatePasswordGeneratorInput({
      length: 8,
      includeUppercase: false,
      includeLowercase: false,
      includeNumbers: false,
      includeSymbols: false,
    });
    expect(errors.charset).toBeDefined();
  });
});
