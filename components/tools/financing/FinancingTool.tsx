"use client";

import { useState } from "react";
import { FinancingForm } from "@/components/tools/financing/FinancingForm";
import { FinancingResultView } from "@/components/tools/financing/FinancingResultView";
import type { FinancingResult } from "@/lib/calculators/financing";

/**
 * Componente principal do Simulador de Financiamento SAC x Price (ETAPA 4).
 * Segue o mesmo padrão da Calculadora de Juros Compostos (ETAPA 3):
 * formulário e resultado ficam visíveis juntos, permitindo recalcular ao
 * ajustar os campos e simular novamente.
 */
export function FinancingTool() {
  const [result, setResult] = useState<FinancingResult | null>(null);

  return (
    <div>
      <FinancingForm onCalculate={setResult} />
      {result ? <FinancingResultView result={result} /> : null}
    </div>
  );
}
