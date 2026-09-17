import { ResultHighlight } from "@/components/results/ResultHighlight";
import { formatCurrencyBRL, formatPercentage } from "@/lib/formatters/currency";
import type { PercentageResult } from "@/lib/calculators/percentage";

const HEADLINE_LABEL: Record<PercentageResult["mode"], string> = {
  "percent-of": "Resultado",
  "what-percent": "Percentual",
  increase: "Novo valor",
  decrease: "Novo valor",
  variation: "Variação percentual",
};

/** Exibe o resultado da Calculadora de Porcentagem, com o significado certo para cada modo. */
export function PercentageResultView({ result }: { result: PercentageResult }) {
  const isPercentageHeadline = result.mode === "what-percent" || result.mode === "variation";

  return (
    <div className="mt-8 space-y-4">
      <ResultHighlight
        label={HEADLINE_LABEL[result.mode]}
        value={
          isPercentageHeadline
            ? formatPercentage(result.headline)
            : formatCurrencyBRL(result.headline)
        }
      />

      {result.difference !== undefined ? (
        <div className="rounded-lg border border-zinc-200 p-3 text-sm">
          <span className="text-zinc-500">
            {result.mode === "variation" ? "Diferença absoluta: " : "Diferença em relação ao valor original: "}
          </span>
          <span
            className={`font-semibold ${
              result.difference >= 0
                ? "text-emerald-700"
                : "text-red-700"
            }`}
          >
            {formatCurrencyBRL(result.difference)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
