import { describe, expect, it } from "vitest";
import {
  generateVehicle,
  generateVehicleBatch,
  validateVehicleGeneratorInput,
  isVehicleGeneratorInputValid,
  VEHICLE_MODELS,
  VEHICLE_COLORS,
  VEHICLE_CATEGORIES,
  VEHICLE_FUEL_TYPES,
  VEHICLE_GENERATOR_MAX_BATCH,
} from "@/lib/calculators/vehicle-generator";

describe("vehicle-generator", () => {
  it("gera um veículo com marca+modelo, ano, cor, categoria e combustível válidos", () => {
    for (let i = 0; i < 50; i += 1) {
      const vehicle = generateVehicle();
      expect(
        VEHICLE_MODELS.some((m) => m.brand === vehicle.brand && m.model === vehicle.model)
      ).toBe(true);
      expect(vehicle.year).toBeGreaterThanOrEqual(2010);
      expect(vehicle.year).toBeLessThanOrEqual(2026);
      expect(VEHICLE_COLORS).toContain(vehicle.color);
      expect(VEHICLE_CATEGORIES).toContain(vehicle.category);
      expect(VEHICLE_FUEL_TYPES).toContain(vehicle.fuel);
    }
  });

  it("gera um lote com a quantidade pedida", () => {
    const batch = generateVehicleBatch({ count: 15 });
    expect(batch).toHaveLength(15);
  });

  it("nunca gera um lote maior que VEHICLE_GENERATOR_MAX_BATCH", () => {
    const batch = generateVehicleBatch({ count: 99999 });
    expect(batch).toHaveLength(VEHICLE_GENERATOR_MAX_BATCH);
  });

  it("valida quantidade fora do intervalo permitido", () => {
    expect(validateVehicleGeneratorInput({ count: 0 }).count).toBeDefined();
    expect(isVehicleGeneratorInputValid({ count: 1 })).toBe(true);
  });
});
