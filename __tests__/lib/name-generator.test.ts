import { describe, expect, it } from "vitest";
import {
  generateName,
  generateNameBatch,
  validateNameGeneratorInput,
  isNameGeneratorInputValid,
  FIRST_NAMES_MALE,
  FIRST_NAMES_FEMALE,
  NAME_GENERATOR_MAX_BATCH,
} from "@/lib/calculators/name-generator";

describe("name-generator", () => {
  it("gera apenas o primeiro nome quando kind === 'primeiro-nome'", () => {
    for (let i = 0; i < 50; i += 1) {
      const name = generateName({ gender: "aleatorio", kind: "primeiro-nome", surnameCount: 1 });
      expect(name.split(" ")).toHaveLength(1);
    }
  });

  it("gera nome completo com o número de sobrenomes pedido", () => {
    const name1 = generateName({ gender: "aleatorio", kind: "completo", surnameCount: 1 });
    expect(name1.split(" ")).toHaveLength(2);

    const name2 = generateName({ gender: "aleatorio", kind: "completo", surnameCount: 2 });
    expect(name2.split(" ")).toHaveLength(3);
  });

  it("respeita o gênero pedido para o primeiro nome", () => {
    for (let i = 0; i < 50; i += 1) {
      const name = generateName({ gender: "masculino", kind: "primeiro-nome", surnameCount: 1 });
      expect(FIRST_NAMES_MALE).toContain(name);
    }
    for (let i = 0; i < 50; i += 1) {
      const name = generateName({ gender: "feminino", kind: "primeiro-nome", surnameCount: 1 });
      expect(FIRST_NAMES_FEMALE).toContain(name);
    }
  });

  it("gera um lote com a quantidade pedida", () => {
    const batch = generateNameBatch({
      count: 15,
      gender: "aleatorio",
      kind: "completo",
      surnameCount: 1,
    });
    expect(batch).toHaveLength(15);
  });

  it("nunca gera um lote maior que NAME_GENERATOR_MAX_BATCH", () => {
    const batch = generateNameBatch({
      count: 99999,
      gender: "aleatorio",
      kind: "completo",
      surnameCount: 1,
    });
    expect(batch).toHaveLength(NAME_GENERATOR_MAX_BATCH);
  });

  it("valida quantidade fora do intervalo permitido", () => {
    expect(
      validateNameGeneratorInput({
        count: 0,
        gender: "aleatorio",
        kind: "completo",
        surnameCount: 1,
      }).count
    ).toBeDefined();
    expect(
      isNameGeneratorInputValid({
        count: 1,
        gender: "aleatorio",
        kind: "completo",
        surnameCount: 1,
      })
    ).toBe(true);
  });
});
