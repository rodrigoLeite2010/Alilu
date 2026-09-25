"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { formatCurrencyBRL, centsDigitsToAmount } from "@/lib/formatters/currency";
import { parseLocaleNumberBRL } from "@/lib/validators/number";
import {
  DEFAULT_COMPARISON_TERMS,
  compareFinancingTerms,
  validateTermComparisonInput,
  type FinancingRateType,
  type TermComparisonFieldErrors,
  type TermComparisonInput,
  type TermComparisonResult,
} from "@/lib/calculators/vehicle-financing";

/**
 * Comparador de prazos de financiamento (24x/36x/48x/60x + prazo
 * personalizado). Gera a tabela automaticamente a partir dos prazos padrão
 * (DEFAULT_COMPARISON_TERMS, lib/calculators/vehicle-financing.ts) e, se o
 * usuário informar um prazo extra, adiciona uma linha a mais — sem nunca
 * duplicar a fórmula da Tabela Price já usada pelas outras calculadoras do
 * cluster.
 */
export function ComparadorPrazosFinanciamentoTool() {
  const [vehiclePriceDigits, setVehiclePriceDigits] = useState("");
  const [downPaymentDigits, setDownPaymentDigits] = useState("");
  const [rateText, setRateText] = useState("");
  const [rateType, setRateType] = useState<FinancingRateType>("mensal");
  const [customTermText, setCustomTermText] = useState("");
  const [errors, setErrors] = useState<TermComparisonFieldErrors>({});
  const [result, setResult] = useState<TermComparisonResult | null>(null);

  function clearError(field: keyof TermComparisonFieldErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleClear() {
    setVehiclePriceDigits("");
    setDownPaymentDigits("");
    setRateText("");
    setRateType("mensal");
    setCustomTermText("");
    setErrors({});
    setResult(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Prazo personalizado é opcional: só entra na lista de prazos a
    // comparar quando o campo não está vazio — e, se o usuário digitou algo
    // que não é um número válido (ou um número fora do intervalo aceito,
    // como 0), entra mesmo assim como NaN/valor inválido, para que
    // validateTermComparisonInput aponte o erro no campo certo em vez de
    // simplesmente ignorar o que foi digitado.
    const rawCustomTerm = customTermText.trim();
    const terms: number[] = [...DEFAULT_COMPARISON_TERMS];
    if (rawCustomTerm) {
      terms.push(parseLocaleNumberBRL(rawCustomTerm) ?? NaN);
    }

    const input: TermComparisonInput = {
      vehiclePrice: centsDigitsToAmount(vehiclePriceDigits),
      downPayment: centsDigitsToAmount(downPaymentDigits),
      rate: parseLocaleNumberBRL(rateText) ?? NaN,
      rateType,
      terms,
    };

    const nextErrors = validateTermComparisonInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }

    setResult(compareFinancingTerms(input));
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="comparar-prazos-preco"
          label="Preço do veículo"
          inputMode="decimal"
          placeholder="R$ 0,00"
          value={vehiclePriceDigits ? formatCurrencyBRL(centsDigitsToAmount(vehiclePriceDigits)) : ""}
          onChange={(event) => {
            setVehiclePriceDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
            clearError("vehiclePrice");
          }}
          error={errors.vehiclePrice}
        />

        <TextField
          id="comparar-prazos-entrada"
          label="Entrada"
          inputMode="decimal"
          placeholder="R$ 0,00"
          hint="Opcional"
          value={downPaymentDigits ? formatCurrencyBRL(centsDigitsToAmount(downPaymentDigits)) : ""}
          onChange={(event) => {
            setDownPaymentDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
            clearError("downPayment");
          }}
          error={errors.downPayment}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberField
            id="comparar-prazos-taxa"
            label="Taxa de juros"
            suffix="%"
            placeholder="0,00"
            value={rateText}
            onChange={(event) => {
              setRateText(event.target.value);
              clearError("rate");
            }}
            error={errors.rate}
          />
          <SelectField
            id="comparar-prazos-taxa-tipo"
            label="Tipo da taxa"
            value={rateType}
            onChange={(event) => setRateType(event.target.value as FinancingRateType)}
          >
            <option value="mensal">Mensal</option>
            <option value="anual">Anual</option>
          </SelectField>
        </div>

        <NumberField
          id="comparar-prazos-personalizado"
          label="Prazo personalizado (meses)"
          placeholder="Ex.: 72"
          hint="Opcional — além de 24x, 36x, 48x e 60x, mostrados sempre"
          value={customTermText}
          onChange={(event) => {
            setCustomTermText(event.target.value);
            clearError("terms");
          }}
          error={errors.terms}
        />

        <div className="flex flex-wrap gap-3">
          <Button type="submit">Comparar</Button>
          <Button type="button" variant="secondary" onClick={handleClear}>
            Limpar
          </Button>
        </div>
      </form>

      {result ? (
        <div className="mt-8 space-y-4">
          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            Os resultados são estimativas e podem diferir das condições realmente oferecidas por
            bancos e financeiras.
          </p>

          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Prazo
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Parcela
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Juros
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Total pago
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {result.rows.map((row) => (
                  <tr key={row.term}>
                    <td className="px-4 py-3 font-medium text-zinc-900">{row.term}x</td>
                    <td className="px-4 py-3 text-zinc-700">{formatCurrencyBRL(row.installment)}</td>
                    <td className="px-4 py-3 text-zinc-700">{formatCurrencyBRL(row.totalInterest)}</td>
                    <td className="px-4 py-3 font-semibold text-zinc-900">
                      {formatCurrencyBRL(row.totalPaid)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-zinc-500">
            Valor financiado em todos os prazos: {formatCurrencyBRL(result.financedAmount)}.
          </p>
        </div>
      ) : null}
    </div>
  );
}
