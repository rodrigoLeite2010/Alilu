import { describe, expect, it } from "vitest";
import {
  isCertificateRegistryFormatValid,
  formatCertificateRegistryInput,
  CERTIFICATE_REGISTRY_VALIDATOR_DIGIT_COUNT,
} from "@/lib/validators/certificate-registry";

describe("isCertificateRegistryFormatValid", () => {
  it("aceita exatamente 32 dígitos, com ou sem separadores", () => {
    const digits = "1".repeat(32);
    expect(isCertificateRegistryFormatValid(digits)).toBe(true);
    expect(isCertificateRegistryFormatValid(formatCertificateRegistryInput(digits))).toBe(true);
  });

  it("rejeita valor vazio", () => {
    expect(isCertificateRegistryFormatValid("")).toBe(false);
  });

  it("rejeita quantidade de dígitos incorreta", () => {
    expect(isCertificateRegistryFormatValid("1".repeat(31))).toBe(false);
    expect(isCertificateRegistryFormatValid("1".repeat(33))).toBe(false);
  });

  it("rejeita caracteres não numéricos (são ignorados, então sobram menos de 32 dígitos)", () => {
    expect(isCertificateRegistryFormatValid("abcd" + "1".repeat(28))).toBe(false);
  });
});

describe("formatCertificateRegistryInput", () => {
  it("agrupa os dígitos em blocos de 4 separados por hífen", () => {
    expect(formatCertificateRegistryInput("12345678")).toBe("1234-5678");
  });

  it("limita ao comprimento oficial de 32 dígitos", () => {
    const digits = "1".repeat(40);
    const formatted = formatCertificateRegistryInput(digits);
    expect(formatted.replace(/-/g, "")).toHaveLength(CERTIFICATE_REGISTRY_VALIDATOR_DIGIT_COUNT);
  });
});
