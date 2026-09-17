/**
 * Lógica de montagem do Gerador de Orçamento, isolada da interface (PROMPT
 * MESTRE, seção 14). Segue o mesmo padrão de privacidade do Gerador de
 * Recibo (lib/receipt/build-receipt.ts): todo o processamento é síncrono e
 * client-side — nenhum dado do orçamento é enviado para servidor algum.
 */

import { formatCurrencyBRL } from "@/lib/formatters/currency";
import { formatDateLong } from "@/lib/receipt/build-receipt";

export interface QuoteItem {
  description: string;
  quantity: number;
  unitValue: number;
}

export interface QuoteItemView extends QuoteItem {
  totalValue: number;
  quantityFormatted: string;
  unitValueFormatted: string;
  totalValueFormatted: string;
}

export interface QuoteInput {
  issuerName: string;
  issuerDocument?: string;
  issuerContact?: string;
  clientName: string;
  clientDocument?: string;
  /** Data do orçamento, no formato yyyy-mm-dd. */
  date: string;
  /** Data de validade da proposta, no formato yyyy-mm-dd (opcional). */
  validUntil?: string;
  items: QuoteItem[];
  notes?: string;
}

export interface QuoteView {
  issuerName: string;
  issuerDocumentLine: string | null;
  issuerContactLine: string | null;
  clientName: string;
  clientDocumentLine: string | null;
  dateLine: string;
  validUntilLine: string | null;
  items: QuoteItemView[];
  totalFormatted: string;
  notes: string | null;
}

/** Calcula o total de um item (quantidade × valor unitário). Nunca arredonda antes da exibição. */
export function calculateItemTotal(item: QuoteItem): number {
  return item.quantity * item.unitValue;
}

/** Calcula o total geral do orçamento, somando o total de cada item. */
export function calculateQuoteTotal(items: QuoteItem[]): number {
  return items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
}

/** Monta todos os dados prontos para exibição na prévia do orçamento. */
export function buildQuoteView(input: QuoteInput): QuoteView {
  const validItems = input.items.filter(
    (item) => item.description.trim() !== ""
  );

  const items: QuoteItemView[] = validItems.map((item) => {
    const totalValue = calculateItemTotal(item);
    return {
      ...item,
      totalValue,
      quantityFormatted: new Intl.NumberFormat("pt-BR").format(item.quantity),
      unitValueFormatted: formatCurrencyBRL(item.unitValue),
      totalValueFormatted: formatCurrencyBRL(totalValue),
    };
  });

  const issuerDocument = input.issuerDocument?.trim();
  const clientDocument = input.clientDocument?.trim();
  const issuerContact = input.issuerContact?.trim();

  return {
    issuerName: input.issuerName,
    issuerDocumentLine: issuerDocument ? issuerDocument : null,
    issuerContactLine: issuerContact ? issuerContact : null,
    clientName: input.clientName,
    clientDocumentLine: clientDocument ? clientDocument : null,
    dateLine: formatDateLong(input.date),
    validUntilLine: input.validUntil ? formatDateLong(input.validUntil) : null,
    items,
    totalFormatted: formatCurrencyBRL(calculateQuoteTotal(validItems)),
    notes: input.notes?.trim() ? input.notes.trim() : null,
  };
}
