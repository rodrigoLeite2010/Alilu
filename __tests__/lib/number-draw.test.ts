import { describe, expect, it } from "vitest";
import {
  drawNumbers,
  validateNumberDrawInput,
  isNumberDrawInputValid,
  NUMBER_DRAW_MAX_COUNT,
} from "@/lib/calculators/number-draw";

describe("number-draw", () => {
  it("sorteia a quantidade pedida, sem repetição por padrão", () => {
    const result = drawNumbers({ min: 1, max: 60, count: 6, allowRepeat: false });
    expect(result).toHaveLength(6);
    expect(new Set(result).size).toBe(6);
    for (const n of result) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(60);
    }
  });

  it("com repetição habilitada, pode repetir números", () => {
    const result = drawNumbers({ min: 1, max: 2, count: 20, allowRepeat: true });
    expect(result).toHaveLength(20);
  });

  it("valida quantidade maior que o intervalo quando sem repetição", () => {
    const errors = validateNumberDrawInput({ min: 1, max: 3, count: 5, allowRepeat: false });
    expect(errors.count).toBeDefined();
  });

  it("valida quantidade acima do limite máximo", () => {
    const errors = validateNumberDrawInput({
      min: 1,
      max: 100,
      count: NUMBER_DRAW_MAX_COUNT + 1,
      allowRepeat: true,
    });
    expect(errors.count).toBeDefined();
  });

  it("isNumberDrawInputValid aceita uma entrada válida", () => {
    expect(isNumberDrawInputValid({ min: 1, max: 60, count: 6, allowRepeat: false })).toBe(true);
  });
});
