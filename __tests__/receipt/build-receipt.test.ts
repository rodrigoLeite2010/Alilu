import { describe, expect, it } from "vitest";
import {
  buildDateLine,
  buildReceiptParagraph,
  buildReceiptView,
  formatDateLong,
  type ReceiptInput,
} from "@/lib/receipt/build-receipt";
import { formatCurrencyBRL } from "@/lib/formatters/currency";

// R$ é formatado pelo Intl.NumberFormat do próprio Node/navegador, que usa
// um espaço especial (não-quebrável) entre "R$" e o valor — por isso os
// testes comparam com formatCurrencyBRL(...) em vez de digitar "R$ 850,00"
// à mão, para não depender de qual caractere de espaço a engine usa.

const baseInput: ReceiptInput = {
  amount: 850,
  payerName: "João da Silva",
  reference: "serviços de manutenção",
  date: "2026-09-15",
  payeeName: "Carlos da Silva",
};

describe("formatDateLong", () => {
  it("formata uma data yyyy-mm-dd por extenso em pt-BR", () => {
    expect(formatDateLong("2026-09-15")).toBe("15 de setembro de 2026");
  });

  it("retorna string vazia para data inválida ou vazia", () => {
    expect(formatDateLong("")).toBe("");
    expect(formatDateLong("data-invalida")).toBe("");
  });
});

describe("buildDateLine", () => {
  it("inclui a cidade quando informada", () => {
    expect(buildDateLine("2026-09-15", "São José dos Campos")).toBe(
      "São José dos Campos, 15 de setembro de 2026."
    );
  });

  it("omite a cidade quando não informada", () => {
    expect(buildDateLine("2026-09-15", undefined)).toBe(
      "15 de setembro de 2026."
    );
    expect(buildDateLine("2026-09-15", "   ")).toBe("15 de setembro de 2026.");
  });
});

describe("buildReceiptParagraph", () => {
  it("monta o parágrafo principal sem CPF/CNPJ do pagador quando não informado", () => {
    const paragraph = buildReceiptParagraph(baseInput);
    expect(paragraph).toBe(
      `Recebi de João da Silva, a importância de ${formatCurrencyBRL(
        850
      )} (oitocentos e cinquenta reais), referente a serviços de manutenção.`
    );
    expect(paragraph).not.toContain("CPF");
    expect(paragraph).not.toContain("CNPJ");
  });

  it("inclui o CPF do pagador, rotulado corretamente, quando informado", () => {
    const paragraph = buildReceiptParagraph({
      ...baseInput,
      payerDocument: "111.444.777-35",
    });
    // A rotulagem (CPF/CNPJ) depende só da quantidade de dígitos — a
    // validade matemática é responsabilidade de lib/validators/document.ts,
    // testada separadamente.
    expect(paragraph).toContain("CPF 111.444.777-35");
  });

  it("inclui o CNPJ do pagador, rotulado corretamente, quando informado", () => {
    const paragraph = buildReceiptParagraph({
      ...baseInput,
      payerDocument: "11.222.333/0001-81",
    });
    expect(paragraph).toContain("CNPJ 11.222.333/0001-81");
  });
});

describe("buildReceiptView", () => {
  it("preenche valor formatado e por extenso corretamente", () => {
    const view = buildReceiptView(baseInput);
    expect(view.amountFormatted).toBe(formatCurrencyBRL(850));
    expect(view.amountInWords).toBe("oitocentos e cinquenta reais");
  });

  it("omite forma de pagamento quando não informada", () => {
    const view = buildReceiptView(baseInput);
    expect(view.paymentMethodLabel).toBeNull();
  });

  it("traduz a forma de pagamento para o rótulo correto quando informada", () => {
    const view = buildReceiptView({ ...baseInput, paymentMethod: "pix" });
    expect(view.paymentMethodLabel).toBe("Pix");
  });

  it("omite a linha de CPF/CNPJ do recebedor quando não informado", () => {
    const view = buildReceiptView(baseInput);
    expect(view.payeeDocumentLine).toBeNull();
  });

  it("inclui a linha de CPF/CNPJ do recebedor, rotulada, quando informado", () => {
    const view = buildReceiptView({
      ...baseInput,
      payeeDocument: "11.222.333/0001-81",
    });
    expect(view.payeeDocumentLine).toBe("CNPJ: 11.222.333/0001-81");
  });

  it("omite observações quando não informadas ou só com espaços", () => {
    expect(buildReceiptView(baseInput).notes).toBeNull();
    expect(buildReceiptView({ ...baseInput, notes: "   " }).notes).toBeNull();
  });

  it("inclui observações, sem espaços nas pontas, quando informadas", () => {
    const view = buildReceiptView({ ...baseInput, notes: "  pago à vista  " });
    expect(view.notes).toBe("pago à vista");
  });

  it("monta a linha de data com a cidade quando informada", () => {
    const view = buildReceiptView({
      ...baseInput,
      city: "São José dos Campos",
    });
    expect(view.dateLine).toBe("São José dos Campos, 15 de setembro de 2026.");
  });
});
