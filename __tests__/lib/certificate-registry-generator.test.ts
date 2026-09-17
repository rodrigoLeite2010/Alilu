import { describe, expect, it } from "vitest";
import {
  generateCertificateRegistry,
  generateCertificateRegistryBatch,
  validateCertificateRegistryGeneratorInput,
  isCertificateRegistryGeneratorInputValid,
  CERTIFICATE_REGISTRY_DIGIT_COUNT,
  CERTIFICATE_REGISTRY_GENERATOR_MAX_BATCH,
} from "@/lib/calculators/certificate-registry-generator";

describe("certificate-registry-generator", () => {
  it("gera um valor com CERTIFICATE_REGISTRY_DIGIT_COUNT dígitos", () => {
    for (let i = 0; i < 30; i += 1) {
      const result = generateCertificateRegistry("nascimento");
      expect(result.value).toMatch(new RegExp(`^\\d{${CERTIFICATE_REGISTRY_DIGIT_COUNT}}$`));
    }
  });

  it("formata os dígitos em blocos de 4 separados por hífen", () => {
    const result = generateCertificateRegistry("casamento");
    expect(result.formatted).toMatch(/^\d{4}(-\d{4}){7}$/);
    expect(result.formatted.replace(/-/g, "")).toBe(result.value);
  });

  it("mantém o tipo pedido", () => {
    expect(generateCertificateRegistry("obito").type).toBe("obito");
  });

  it("gera um lote com a quantidade pedida", () => {
    const batch = generateCertificateRegistryBatch({ count: 15, type: "nascimento" });
    expect(batch).toHaveLength(15);
  });

  it("nunca gera um lote maior que CERTIFICATE_REGISTRY_GENERATOR_MAX_BATCH", () => {
    const batch = generateCertificateRegistryBatch({ count: 99999, type: "nascimento" });
    expect(batch).toHaveLength(CERTIFICATE_REGISTRY_GENERATOR_MAX_BATCH);
  });

  it("valida quantidade fora do intervalo permitido", () => {
    expect(
      validateCertificateRegistryGeneratorInput({ count: 0, type: "nascimento" }).count
    ).toBeDefined();
    expect(isCertificateRegistryGeneratorInputValid({ count: 1, type: "nascimento" })).toBe(true);
  });
});
