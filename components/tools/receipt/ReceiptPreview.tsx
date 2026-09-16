import type { ReceiptView } from "@/lib/receipt/build-receipt";

/**
 * Prévia visual do recibo gerado — é este componente (e só ele) que deve
 * aparecer na impressão/PDF (ETAPA 2, seções 9 e 10). Por representar um
 * documento a ser impresso em papel branco A4, usa sempre um tema claro
 * fixo, independente do modo claro/escuro do restante do site (ETAPA 2,
 * seção 9: "usar fundo branco").
 */
export function ReceiptPreview({ receipt }: { receipt: ReceiptView }) {
  return (
    <div
      id="receipt-preview"
      className="mx-auto max-w-xl rounded-xl border border-zinc-300 bg-white p-6 text-zinc-900 shadow-sm sm:p-8 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
    >
      <p className="text-center text-sm font-semibold tracking-[0.3em] text-zinc-500">
        RECIBO
      </p>
      <p className="mt-2 text-center text-3xl font-bold tracking-tight text-zinc-900">
        {receipt.amountFormatted}
      </p>

      <p className="mt-6 text-base leading-relaxed text-zinc-800">
        {receipt.paragraph}
      </p>

      {receipt.paymentMethodLabel ? (
        <p className="mt-4 text-sm text-zinc-700">
          Forma de pagamento: {receipt.paymentMethodLabel}.
        </p>
      ) : null}

      {receipt.dateLine ? (
        <p className="mt-6 text-sm text-zinc-700">{receipt.dateLine}</p>
      ) : null}

      <div className="mt-12 text-center">
        <p className="mx-auto w-full max-w-xs border-t border-zinc-400 pt-2 text-sm font-medium text-zinc-900">
          {receipt.payeeName}
        </p>
        {receipt.payeeDocumentLine ? (
          <p className="text-xs text-zinc-600">{receipt.payeeDocumentLine}</p>
        ) : null}
      </div>

      {receipt.notes ? (
        <p className="mt-8 border-t border-dashed border-zinc-200 pt-3 text-xs text-zinc-500">
          Observações: {receipt.notes}
        </p>
      ) : null}
    </div>
  );
}
