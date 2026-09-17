import { describe, expect, it } from "vitest";
import {
  generateLicensePlate,
  generateLicensePlateBatch,
  validateLicensePlateGeneratorInput,
  isLicensePlateGeneratorInputValid,
  LICENSE_PLATE_GENERATOR_MAX_BATCH,
} from "@/lib/calculators/license-plate-generator";

describe("license-plate-generator", () => {
  it("gera placa no formato Mercosul (LLL0L00)", () => {
    for (let i = 0; i < 100; i += 1) {
      const plate = generateLicensePlate("mercosul");
      expect(plate).toMatch(/^[A-Z]{3}\d[A-Z]\d{2}$/);
    }
  });

  it("gera placa no formato antigo (LLL-0000)", () => {
    for (let i = 0; i < 100; i += 1) {
      const plate = generateLicensePlate("antiga");
      expect(plate).toMatch(/^[A-Z]{3}-\d{4}$/);
    }
  });

  it("gera um lote com a quantidade pedida", () => {
    const batch = generateLicensePlateBatch({ count: 15, format: "mercosul" });
    expect(batch).toHaveLength(15);
    for (const plate of batch) {
      expect(plate).toMatch(/^[A-Z]{3}\d[A-Z]\d{2}$/);
    }
  });

  it("nunca gera um lote maior que LICENSE_PLATE_GENERATOR_MAX_BATCH", () => {
    const batch = generateLicensePlateBatch({ count: 99999, format: "antiga" });
    expect(batch).toHaveLength(LICENSE_PLATE_GENERATOR_MAX_BATCH);
  });

  it("valida quantidade fora do intervalo permitido", () => {
    expect(
      validateLicensePlateGeneratorInput({ count: 0, format: "mercosul" }).count
    ).toBeDefined();
    expect(isLicensePlateGeneratorInputValid({ count: 1, format: "mercosul" })).toBe(true);
  });
});
