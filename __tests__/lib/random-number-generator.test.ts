import { describe, expect, it } from "vitest";
import {
  generateRandomNumbers,
  validateRandomNumberGeneratorInput,
  isRandomNumberGeneratorInputValid,
  RANDOM_NUMBER_GENERATOR_MAX_COUNT,
} from "@/lib/calculators/random-number-generator";

describe("random-number-generator", () => {
  it("gera a quantidade pedida de números dentro do intervalo, com repetição", () => {
    const numbers = generateRandomNumbers({ min: 1, max: 10, count: 30, allowRepeat: true });
    expect(numbers).toHaveLength(30);
    for (const n of numbers) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(10);
    }
  });

  it("sem repetição, nunca repete um número no mesmo lote", () => {
    const numbers = generateRandomNumbers({ min: 1, max: 20, count: 20, allowRepeat: false });
    expect(numbers).toHaveLength(20);
    expect(new Set(numbers).size).toBe(20);
  });

  it("funciona com min === max", () => {
    const numbers = generateRandomNumbers({ min: 7, max: 7, count: 5, allowRepeat: true });
    expect(numbers).toEqual([7, 7, 7, 7, 7]);
  });

  it("valida min/max/count inválidos", () => {
    expect(
      validateRandomNumberGeneratorInput({ min: 10, max: 5, count: 1, allowRepeat: true }).max
    ).toBeDefined();
    expect(
      validateRandomNumberGeneratorInput({
        min: 1,
        max: 5,
        count: RANDOM_NUMBER_GENERATOR_MAX_COUNT + 1,
        allowRepeat: true,
      }).count
    ).toBeDefined();
    expect(
      isRandomNumberGeneratorInputValid({ min: 1, max: 10, count: 5, allowRepeat: true })
    ).toBe(true);
  });

  it("sem repetição, rejeita quantidade maior que o intervalo disponível", () => {
    const errors = validateRandomNumberGeneratorInput({
      min: 1,
      max: 5,
      count: 10,
      allowRepeat: false,
    });
    expect(errors.count).toBeDefined();
  });
});
