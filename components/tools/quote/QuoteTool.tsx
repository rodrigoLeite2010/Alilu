"use client";

import { useRef, useState } from "react";
import { QuoteForm } from "@/components/tools/quote/QuoteForm";
import { QuotePreview } from "@/components/tools/quote/QuotePreview";
import { QuoteActions } from "@/components/tools/quote/QuoteActions";
import { buildQuoteView, type QuoteView } from "@/lib/quote/build-quote";

/**
 * Componente principal do Gerador de Orçamento. Segue o mesmo padrão do
 * Gerador de Recibo: formulário e prévia se alternam, toda a lógica de
 * cálculo/formatação fica em lib/ (lib/quote/build-quote.ts), e todo o
 * estado vive apenas na memória do navegador.
 */
export function QuoteTool() {
  const [quote, setQuote] = useState<QuoteView | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleReset() {
    setQuote(null);
    requestAnimationFrame(() => {
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div ref={containerRef}>
      {quote ? (
        <div>
          <QuotePreview quote={quote} />
          <QuoteActions onReset={handleReset} />
        </div>
      ) : (
        <QuoteForm onGenerate={(input) => setQuote(buildQuoteView(input))} />
      )}
    </div>
  );
}
