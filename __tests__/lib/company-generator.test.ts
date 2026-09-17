import { describe, expect, it } from "vitest";
import {
  generateCompany,
  generateCompanyBatch,
  validateCompanyGeneratorInput,
  isCompanyGeneratorInputValid,
  COMPANY_GENERATOR_MAX_BATCH,
} from "@/lib/calculators/company-generator";
import { isValidCNPJ } from "@/lib/validators/document";

describe("company-generator", () => {
  it("gera uma empresa com nome fantasia, razão social, cnpj válido, ie, cep, telefone e e-mail", () => {
    for (let i = 0; i < 30; i += 1) {
      const company = generateCompany();
      expect(company.fantasyName.length).toBeGreaterThan(0);
      expect(company.legalName).toContain(company.fantasyName);
      expect(isValidCNPJ(company.cnpj)).toBe(true);
      expect(company.stateTaxId.value).toMatch(/^\d{9}$/);
      expect(company.cep).toMatch(/^\d{5}-\d{3}$/);
      expect(company.phone).toMatch(/^\(\d{2}\) \d{4}-\d{4}$/);
      expect(company.email).toMatch(/^contato@[a-z]+\.com\.br$/);
    }
  });

  it("gera um lote com a quantidade pedida", () => {
    const batch = generateCompanyBatch({ count: 10 });
    expect(batch).toHaveLength(10);
  });

  it("nunca gera um lote maior que COMPANY_GENERATOR_MAX_BATCH", () => {
    const batch = generateCompanyBatch({ count: 99999 });
    expect(batch).toHaveLength(COMPANY_GENERATOR_MAX_BATCH);
  });

  it("valida quantidade fora do intervalo permitido", () => {
    expect(validateCompanyGeneratorInput({ count: 0 }).count).toBeDefined();
    expect(isCompanyGeneratorInputValid({ count: 1 })).toBe(true);
  });
});
