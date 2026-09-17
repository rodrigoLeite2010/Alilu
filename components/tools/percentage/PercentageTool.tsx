"use client";

import { useState } from "react";
import { PercentageForm } from "@/components/tools/percentage/PercentageForm";
import { PercentageResultView } from "@/components/tools/percentage/PercentageResultView";
import type { PercentageResult } from "@/lib/calculators/percentage";

/** Componente principal da Calculadora de Porcentagem. */
export function PercentageTool() {
  const [result, setResult] = useState<PercentageResult | null>(null);

  return (
    <div>
      <PercentageForm onCalculate={setResult} />
      {result ? <PercentageResultView result={result} /> : null}
    </div>
  );
}
