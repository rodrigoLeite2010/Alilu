/**
 * Lógica de montagem do Gerador de Recibo, isolada da interface (PROMPT
 * MESTRE, seção 14; ETAPA 2, seção 20). Todo o processamento aqui é síncrono
 * e client-side: nenhum dado do recibo é enviado para servidor algum
 * (ETAPA 2, seção 2).
 */

import { formatCurrencyBRL } from "@/lib/formatters/currency";
import { moneyToWordsBRL } from "@/lib/formatters/money-words";
import { documentTypeLabel } from "@/lib/validators/document";

export type PaymentMethod =
  | "pix"
  | "dinheiro"
  | "transferencia"
  | "cartao"
  | "cheque"
  | "outro";

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] =
  [
    { value: "pix", label: "Pix" },
    { value: "dinheiro", label: "Dinheiro" },
    { value: "transferencia", label: "Transferência bancária" },
    { value: "cartao", label: "Cartão" },
    { value: "cheque", label: "Cheque" },
    { value: "outro", label: "Outro" },
  ];

export interface ReceiptInput {
  amount: number;
  payerName: string;
  payerDocument?: string;
  reference: string;
  paymentMethod?: PaymentMethod | "";
  /** Data no formato yyyy-mm-dd (valor nativo de <input type="date">) */
  date: string;
  city?: string;
  payeeName: string;
  payeeDocument?: string;
  notes?: string;
}

export interface ReceiptView {
  amountFormatted: string;
  amountInWords: string;
  paragraph: string;
  paymentMethodLabel: string | null;
  dateLine: string;
  payeeName: string;
  payeeDocumentLine: string | null;
  notes: string | null;
}

function paymentMethodLabel(method?: PaymentMethod | ""): string | null {
  if (!method) return null;
  return (
    PAYMENT_METHOD_OPTIONS.find((option) => option.value === method)?.label ??
    null
  );
}

/** Formata uma data yyyy-mm-dd por extenso, ex.: "15 de setembro de 2026". */
export function formatDateLong(dateISO: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO.trim());
  if (!match) {
    return "";
  }
  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Monta a linha de local e data do recibo: "Cidade, 15 de setembro de
 * 2026." quando a cidade foi informada, ou apenas "15 de setembro de
 * 2026." caso contrário (ETAPA 2, seção 8).
 */
export function buildDateLine(dateISO: string, city?: string): string {
  const dateWords = formatDateLong(dateISO);
  if (!dateWords) {
    return "";
  }
  const trimmedCity = city?.trim();
  return trimmedCity ? `${trimmedCity}, ${dateWords}.` : `${dateWords}.`;
}

/**
 * Monta o parágrafo principal do recibo, omitindo partes opcionais que não
 * foram informadas (ex.: sem "CPF ..." quando o pagador não informou
 * documento) — ETAPA 2, seção 8.
 */
export function buildReceiptParagraph(input: ReceiptInput): string {
  const payerDocument = input.payerDocument?.trim();
  const documentLabel = payerDocument ? documentTypeLabel(payerDocument) : null;

  const payerPart =
    payerDocument && documentLabel
      ? `${input.payerName}, ${documentLabel} ${payerDocument},`
      : `${input.payerName},`;

  return `Recebi de ${payerPart} a importância de ${formatCurrencyBRL(
    input.amount
  )} (${moneyToWordsBRL(input.amount)}), referente a ${input.reference}.`;
}

/** Monta todos os dados prontos para exibição na prévia do recibo. */
export function buildReceiptView(input: ReceiptInput): ReceiptView {
  const payeeDocument = input.payeeDocument?.trim();
  const payeeDocumentLabel = payeeDocument
    ? documentTypeLabel(payeeDocument)
    : null;

  return {
    amountFormatted: formatCurrencyBRL(input.amount),
    amountInWords: moneyToWordsBRL(input.amount),
    paragraph: buildReceiptParagraph(input),
    paymentMethodLabel: paymentMethodLabel(input.paymentMethod),
    dateLine: buildDateLine(input.date, input.city),
    payeeName: input.payeeName,
    payeeDocumentLine:
      payeeDocument && payeeDocumentLabel
        ? `${payeeDocumentLabel}: ${payeeDocument}`
        : null,
    notes: input.notes?.trim() ? input.notes.trim() : null,
  };
}
