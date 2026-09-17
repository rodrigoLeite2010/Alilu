import type { QuoteView } from "@/lib/quote/build-quote";

/**
 * Prévia visual do orçamento gerado — é este componente (e só ele) que deve
 * aparecer na impressão/PDF, seguindo o mesmo padrão do Gerador de Recibo.
 * Usa sempre um tema claro fixo, independente do modo claro/escuro do
 * restante do site, por representar um documento a ser impresso em papel
 * branco A4.
 */
export function QuotePreview({ quote }: { quote: QuoteView }) {
  return (
    <div
      id="quote-preview"
      className="mx-auto max-w-2xl rounded-xl border border-zinc-300 bg-white p-6 text-zinc-900 shadow-sm sm:p-8 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
    >
      <p className="text-center text-sm font-semibold tracking-[0.3em] text-zinc-500">
        ORÇAMENTO
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">De</p>
          <p className="text-sm font-medium text-zinc-900">{quote.issuerName}</p>
          {quote.issuerDocumentLine ? (
            <p className="text-xs text-zinc-600">{quote.issuerDocumentLine}</p>
          ) : null}
          {quote.issuerContactLine ? (
            <p className="text-xs text-zinc-600">{quote.issuerContactLine}</p>
          ) : null}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Para</p>
          <p className="text-sm font-medium text-zinc-900">{quote.clientName}</p>
          {quote.clientDocumentLine ? (
            <p className="text-xs text-zinc-600">{quote.clientDocumentLine}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-600">
        <span>Data: {quote.dateLine}</span>
        {quote.validUntilLine ? <span>Válido até: {quote.validUntilLine}</span> : null}
      </div>

      <div className="mt-6 overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-300 text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="py-2 pr-2">Descrição</th>
              <th className="py-2 pr-2 text-right">Qtd.</th>
              <th className="py-2 pr-2 text-right">Valor unit.</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item, index) => (
              <tr key={index} className="border-b border-zinc-100">
                <td className="py-2 pr-2 text-zinc-800">{item.description}</td>
                <td className="py-2 pr-2 text-right text-zinc-800">{item.quantityFormatted}</td>
                <td className="py-2 pr-2 text-right text-zinc-800">{item.unitValueFormatted}</td>
                <td className="py-2 text-right font-medium text-zinc-900">
                  {item.totalValueFormatted}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Total geral</p>
          <p className="text-2xl font-bold text-zinc-900">{quote.totalFormatted}</p>
        </div>
      </div>

      {quote.notes ? (
        <p className="mt-8 border-t border-dashed border-zinc-200 pt-3 text-xs text-zinc-500">
          Observações: {quote.notes}
        </p>
      ) : null}
    </div>
  );
}
