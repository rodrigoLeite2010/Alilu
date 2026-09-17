import { describe, expect, it } from "vitest";
import { validateStateTaxIdFormat } from "@/lib/validators/state-tax-id";

describe("validateStateTaxIdFormat", () => {
  it("aceita um valor com quantidade de dígitos compatível para uma UF conhecida", () => {
    expect(validateStateTaxIdFormat("SP", "123456789")).toEqual({
      valid: true,
      unknownUf: false,
    });
  });

  it("aceita valor com pontuação/barra, considerando só os dígitos", () => {
    expect(validateStateTaxIdFormat("RJ", "12.345.67-8")).toEqual({
      valid: true,
      unknownUf: false,
    });
  });

  it("rejeita valor vazio", () => {
    expect(validateStateTaxIdFormat("SP", "")).toEqual({ valid: false, unknownUf: false });
  });

  it("rejeita quantidade de dígitos fora do intervalo aceito", () => {
    expect(validateStateTaxIdFormat("SP", "123")).toEqual({ valid: false, unknownUf: false });
    expect(validateStateTaxIdFormat("SP", "123456789012345")).toEqual({
      valid: false,
      unknownUf: false,
    });
  });

  it("sinaliza UF desconhecida", () => {
    expect(validateStateTaxIdFormat("XX", "123456789")).toEqual({
      valid: false,
      unknownUf: true,
    });
  });
});
