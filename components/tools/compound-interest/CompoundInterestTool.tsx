"use client";

import { useState } from "react";
import { CompoundInterestForm } from "@/components/tools/compound-interest/CompoundInterestForm";
import { CompoundInterestResultView } from "@/components/tools/compound-interest/CompoundInterestResultView";
import type { CompoundInterestResult } from "@/lib/calculators/compound-interest";

/**
 * Componente principal da Calculadora de Juros Compostos (ETAPA 3). Ao
 * contrário do Gerador de Recibo (que troca formulário por prévia),
 * formulário e resultado ficam visíveis juntos, permitindo recalcular
 * ajustando os campos e clicando em "Calcular" novamente.
 */
export function CompoundInterestTool() {
  const [result, setResult] = useState<CompoundInterestResult | null>(null);

  return (
    <div>
      <CompoundInterestForm onCalculate={setResult} />
      {result ? <CompoundInterestResultView result={result} /> : null}
    </div>
  );
}
