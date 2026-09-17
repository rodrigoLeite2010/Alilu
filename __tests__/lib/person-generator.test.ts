import { describe, expect, it } from "vitest";
import {
  generatePerson,
  generatePersonBatch,
  validatePersonGeneratorInput,
  isPersonGeneratorInputValid,
  PERSON_GENERATOR_MAX_BATCH,
} from "@/lib/calculators/person-generator";
import { isValidCPF } from "@/lib/validators/document";

describe("person-generator", () => {
  it("gera uma pessoa com nome, cpf válido, rg, data de nascimento, cep, telefone e e-mail", () => {
    for (let i = 0; i < 30; i += 1) {
      const person = generatePerson("aleatorio");
      expect(person.name.length).toBeGreaterThan(0);
      expect(["masculino", "feminino"]).toContain(person.gender);
      expect(isValidCPF(person.cpf)).toBe(true);
      expect(person.rg).toMatch(/^\d{2}\.\d{3}\.\d{3}-[0-9X]$/);
      expect(person.birthDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
      expect(person.age).toBeGreaterThanOrEqual(18);
      expect(person.age).toBeLessThanOrEqual(80);
      expect(person.cep).toMatch(/^\d{5}-\d{3}$/);
      expect(person.phone).toMatch(/^\(\d{2}\) 9\d{4}-\d{4}$/);
      expect(person.email).toMatch(/^[a-z.]+\d+@[a-z.]+$/);
    }
  });

  it("respeita o gênero pedido quando não é 'aleatorio'", () => {
    const person = generatePerson("feminino");
    expect(person.gender).toBe("feminino");
  });

  it("gera um lote com a quantidade pedida", () => {
    const batch = generatePersonBatch({ count: 10, gender: "aleatorio" });
    expect(batch).toHaveLength(10);
  });

  it("nunca gera um lote maior que PERSON_GENERATOR_MAX_BATCH", () => {
    const batch = generatePersonBatch({ count: 99999, gender: "aleatorio" });
    expect(batch).toHaveLength(PERSON_GENERATOR_MAX_BATCH);
  });

  it("valida quantidade fora do intervalo permitido", () => {
    expect(validatePersonGeneratorInput({ count: 0, gender: "aleatorio" }).count).toBeDefined();
    expect(isPersonGeneratorInputValid({ count: 1, gender: "aleatorio" })).toBe(true);
  });
});
