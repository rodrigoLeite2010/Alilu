"use client";

import { useRef, useState } from "react";
import { ReceiptForm } from "@/components/tools/receipt/ReceiptForm";
import { ReceiptPreview } from "@/components/tools/receipt/ReceiptPreview";
import { ReceiptActions } from "@/components/tools/receipt/ReceiptActions";
import { buildReceiptView, type ReceiptView } from "@/lib/receipt/build-receipt";

/**
 * Componente principal do Gerador de Recibo (primeira ferramenta funcional
 * do ALILU Utilitários — ETAPA 2). Orquestra o formulário e a prévia, mas
 * mantém toda a lógica de cálculo/formatação em lib/ (ver
 * lib/receipt/build-receipt.ts), conforme a arquitetura definida na
 * ETAPA 1.
 *
 * Todo o estado vive apenas na memória do navegador: nada é enviado para
 * servidor, salvo em cookies ou em localStorage/sessionStorage.
 */
export function ReceiptTool() {
  const [receipt, setReceipt] = useState<ReceiptView | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleReset() {
    setReceipt(null);
    requestAnimationFrame(() => {
      containerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  return (
    <div ref={containerRef}>
      {receipt ? (
        <div>
          <ReceiptPreview receipt={receipt} />
          <ReceiptActions onReset={handleReset} />
        </div>
      ) : (
        <ReceiptForm
          onGenerate={(input) => setReceipt(buildReceiptView(input))}
        />
      )}
    </div>
  );
}
