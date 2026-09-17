/**
 * Geração de dados de veículo FICTÍCIOS (marca, modelo, ano, cor, categoria
 * e combustível) para testes de formulários e massa de dados (categoria
 * Geradores). Mantido isolado da interface (PROMPT MESTRE, seção 14).
 *
 * Nenhum dado é vinculado a um veículo real: são combinações aleatórias a
 * partir de listas de marcas/modelos populares no mercado brasileiro,
 * sorteadas com `crypto.getRandomValues` (ver lib/random/secure-random.ts).
 */

import { secureRandomChoice, secureRandomIntRange } from "@/lib/random/secure-random";

export const VEHICLE_GENERATOR_MAX_BATCH = 100;

export interface VehicleModel {
  brand: string;
  model: string;
}

export const VEHICLE_MODELS: VehicleModel[] = [
  { brand: "Volkswagen", model: "Gol" },
  { brand: "Volkswagen", model: "Polo" },
  { brand: "Volkswagen", model: "T-Cross" },
  { brand: "Fiat", model: "Mobi" },
  { brand: "Fiat", model: "Argo" },
  { brand: "Fiat", model: "Strada" },
  { brand: "Chevrolet", model: "Onix" },
  { brand: "Chevrolet", model: "Tracker" },
  { brand: "Toyota", model: "Corolla" },
  { brand: "Toyota", model: "Hilux" },
  { brand: "Honda", model: "Civic" },
  { brand: "Honda", model: "HR-V" },
  { brand: "Hyundai", model: "HB20" },
  { brand: "Hyundai", model: "Creta" },
  { brand: "Renault", model: "Kwid" },
  { brand: "Renault", model: "Duster" },
  { brand: "Ford", model: "Ka" },
  { brand: "Jeep", model: "Renegade" },
  { brand: "Jeep", model: "Compass" },
  { brand: "Nissan", model: "Kicks" },
];

export const VEHICLE_COLORS = [
  "Branco", "Prata", "Preto", "Cinza", "Vermelho", "Azul", "Verde", "Bege", "Amarelo",
];

export const VEHICLE_CATEGORIES = ["Hatch", "Sedã", "SUV", "Picape"] as const;
export type VehicleCategory = (typeof VEHICLE_CATEGORIES)[number];

export const VEHICLE_FUEL_TYPES = ["Flex", "Gasolina", "Diesel", "Elétrico", "Híbrido"] as const;
export type VehicleFuelType = (typeof VEHICLE_FUEL_TYPES)[number];

const MIN_YEAR = 2010;
const MAX_YEAR = 2026;

export interface GeneratedVehicle {
  brand: string;
  model: string;
  year: number;
  color: string;
  category: VehicleCategory;
  fuel: VehicleFuelType;
}

export interface VehicleGeneratorInput {
  count: number;
}

export interface VehicleGeneratorFieldErrors {
  count?: string;
}

/** Gera um único veículo fictício. */
export function generateVehicle(): GeneratedVehicle {
  const { brand, model } = secureRandomChoice(VEHICLE_MODELS);

  return {
    brand,
    model,
    year: secureRandomIntRange(MIN_YEAR, MAX_YEAR),
    color: secureRandomChoice(VEHICLE_COLORS),
    category: secureRandomChoice(VEHICLE_CATEGORIES),
    fuel: secureRandomChoice(VEHICLE_FUEL_TYPES),
  };
}

export function validateVehicleGeneratorInput(
  input: VehicleGeneratorInput
): VehicleGeneratorFieldErrors {
  const errors: VehicleGeneratorFieldErrors = {};

  if (!Number.isFinite(input.count) || !Number.isInteger(input.count) || input.count < 1) {
    errors.count = "Informe uma quantidade inteira de pelo menos 1.";
  } else if (input.count > VEHICLE_GENERATOR_MAX_BATCH) {
    errors.count = `A quantidade não pode ser maior que ${VEHICLE_GENERATOR_MAX_BATCH}.`;
  }

  return errors;
}

export function isVehicleGeneratorInputValid(input: VehicleGeneratorInput): boolean {
  return Object.keys(validateVehicleGeneratorInput(input)).length === 0;
}

/**
 * Gera um lote de veículos fictícios. O limite (VEHICLE_GENERATOR_MAX_BATCH)
 * é aplicado ANTES de qualquer geração, então nunca é criado um array maior
 * que o limite, mesmo que a validação seja pulada por algum chamador.
 */
export function generateVehicleBatch(input: VehicleGeneratorInput): GeneratedVehicle[] {
  const safeCount = Math.min(
    Math.max(1, Math.trunc(input.count) || 1),
    VEHICLE_GENERATOR_MAX_BATCH
  );

  return Array.from({ length: safeCount }, () => generateVehicle());
}
