import { describe, expect, it, vi } from "vitest";
import {
  secureRandomInt,
  secureRandomIntRange,
  secureRandomDigit,
  secureRandomChar,
  secureRandomChoice,
  secureRandomSample,
  secureRandomSampleRange,
} from "@/lib/random/secure-random";

/**
 * Testes do módulo central de aleatoriedade segura, extraído dos geradores
 * de CPF/CNPJ/Cartão (que tinham essa mesma função duplicada três vezes) e
 * reutilizado por todos os novos geradores das fases B/C/D.
 */
describe("secure-random", () => {
  it("rejeita a borda que introduziria viés no resto da divisão", () => {
    const random = vi.spyOn(globalThis.crypto, "getRandomValues");
    let calls = 0;
    random.mockImplementation((array) => {
      (array as Uint32Array)[0] = calls++ === 0 ? 4_294_967_295 : 5;
      return array;
    });
    try {
      expect(secureRandomInt(3)).toBe(2);
      expect(random).toHaveBeenCalledTimes(2);
    } finally {
      random.mockRestore();
    }
  });

  it("amostra de intervalo inclui todas as pontas sem repetição", () => {
    expect(secureRandomSampleRange(-2, 2, 5).sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2]);
    expect(secureRandomSampleRange(7, 7, 1)).toEqual([7]);
    expect(secureRandomSampleRange(0, 10, 0)).toEqual([]);
    expect(() => secureRandomSampleRange(0, 2, 4)).toThrow();
  });
  it("secureRandomInt nunca retorna um valor fora de [0, maxExclusive)", () => {
    for (let i = 0; i < 500; i += 1) {
      const value = secureRandomInt(7);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it("secureRandomInt rejeita maxExclusive inválido", () => {
    expect(() => secureRandomInt(0)).toThrow();
    expect(() => secureRandomInt(-3)).toThrow();
    expect(() => secureRandomInt(1.5)).toThrow();
  });

  it("secureRandomIntRange respeita os limites [min, max]", () => {
    for (let i = 0; i < 300; i += 1) {
      const value = secureRandomIntRange(10, 15);
      expect(value).toBeGreaterThanOrEqual(10);
      expect(value).toBeLessThanOrEqual(15);
    }
  });

  it("secureRandomIntRange funciona quando min === max", () => {
    expect(secureRandomIntRange(5, 5)).toBe(5);
  });

  it("secureRandomIntRange rejeita min > max", () => {
    expect(() => secureRandomIntRange(10, 5)).toThrow();
  });

  it("secureRandomDigit sempre retorna um dígito 0-9", () => {
    for (let i = 0; i < 300; i += 1) {
      const digit = secureRandomDigit();
      expect(digit).toBeGreaterThanOrEqual(0);
      expect(digit).toBeLessThanOrEqual(9);
    }
  });

  it("secureRandomChar sempre retorna um caractere do charset informado", () => {
    const charset = "ABC";
    for (let i = 0; i < 100; i += 1) {
      expect(charset).toContain(secureRandomChar(charset));
    }
  });

  it("secureRandomChar rejeita charset vazio", () => {
    expect(() => secureRandomChar("")).toThrow();
  });

  it("secureRandomChoice sempre retorna um item da lista", () => {
    const items = ["a", "b", "c"];
    for (let i = 0; i < 100; i += 1) {
      expect(items).toContain(secureRandomChoice(items));
    }
  });

  it("secureRandomChoice rejeita array vazio", () => {
    expect(() => secureRandomChoice([])).toThrow();
  });

  it("secureRandomSample retorna a quantidade pedida, sem repetição", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const sample = secureRandomSample(items, 5);
    expect(sample).toHaveLength(5);
    expect(new Set(sample).size).toBe(5);
    for (const value of sample) {
      expect(items).toContain(value);
    }
  });

  it("secureRandomSample com count igual ao tamanho retorna uma permutação completa", () => {
    const items = [1, 2, 3, 4, 5];
    const sample = secureRandomSample(items, 5);
    expect([...sample].sort()).toEqual(items);
  });

  it("secureRandomSample com count 0 retorna array vazio", () => {
    expect(secureRandomSample([1, 2, 3], 0)).toEqual([]);
  });

  it("secureRandomSample rejeita count fora de [0, length]", () => {
    expect(() => secureRandomSample([1, 2], 3)).toThrow();
    expect(() => secureRandomSample([1, 2], -1)).toThrow();
  });
});
