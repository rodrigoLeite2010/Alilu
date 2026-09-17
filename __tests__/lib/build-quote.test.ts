import { describe, expect, it } from "vitest";
import {
  buildQuoteView,
  calculateItemTotal,
  calculateQuoteTotal,
  type QuoteInput,
  type QuoteItem,
} from "@/lib/quote/build-quote";

const item = (overrides: Partial<QuoteItem> = {}): QuoteItem => ({
  description: "Serviço de consultoria",
  quantity: 1,
  unitValue: 100,
  ...overrides,
});

describe("calculateItemTotal", () => {
  it("2 unidades a 50 = 100", () => {
    expect(calculateItemTotal(item({ quantity: 2, unitValue: 50 }))).toBeCloseTo(100, 10);
  });

  it("quantidade decimal (ex.: 2,5 horas a 40/h) = 100", () => {
    expect(calculateItemTotal(item({ quantity: 2.5, unitValue: 40 }))).toBeCloseTo(100, 10);
  });

  it("quantidade zero resulta em total zero", () => {
    expect(calculateItemTotal(item({ quantity: 0, unitValue: 100 }))).toBe(0);
  });
});

describe("calculateQuoteTotal", () => {
  it("soma o total de múltiplos itens", () => {
    const items = [item({ quantity: 1, unitValue: 100 }), item({ quantity: 2, unitValue: 50 })];
    expect(calculateQuoteTotal(items)).toBeCloseTo(200, 10);
  });

  it("lista vazia resulta em total zero", () => {
    expect(calculateQuoteTotal([])).toBe(0);
  });
});

describe("buildQuoteView", () => {
  const baseInput: QuoteInput = {
    issuerName: "Empresa Exemplo Ltda",
    issuerDocument: "12.345.678/0001-99",
    issuerContact: "(11) 99999-9999",
    clientName: "Cliente Exemplo",
    clientDocument: "123.456.789-00",
    date: "2026-09-16",
    validUntil: "2026-09-30",
    items: [
      item({ description: "Item A", quantity: 2, unitValue: 100 }),
      item({ description: "Item B", quantity: 1, unitValue: 50 }),
    ],
    notes: "Pagamento em até 30 dias.",
  };

  it("monta a prévia com total geral correto (250) e datas por extenso", () => {
    const view = buildQuoteView(baseInput);
    expect(view.items).toHaveLength(2);
    expect(view.totalFormatted).toContain("250,00");
    expect(view.dateLine).toContain("2026");
    expect(view.validUntilLine).toContain("2026");
    expect(view.notes).toBe("Pagamento em até 30 dias.");
  });

  it("ignora itens com descrição vazia (linha em branco do formulário)", () => {
    const view = buildQuoteView({
      ...baseInput,
      items: [...baseInput.items, item({ description: "   ", quantity: 999, unitValue: 999 })],
    });
    expect(view.items).toHaveLength(2);
  });

  it("campos opcionais ausentes viram null, não string vazia", () => {
    const view = buildQuoteView({
      ...baseInput,
      issuerDocument: undefined,
      issuerContact: undefined,
      clientDocument: undefined,
      validUntil: undefined,
      notes: undefined,
    });
    expect(view.issuerDocumentLine).toBeNull();
    expect(view.issuerContactLine).toBeNull();
    expect(view.clientDocumentLine).toBeNull();
    expect(view.validUntilLine).toBeNull();
    expect(view.notes).toBeNull();
  });
});
