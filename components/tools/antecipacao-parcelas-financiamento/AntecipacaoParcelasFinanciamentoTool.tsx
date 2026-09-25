"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import { formatCurrencyBRL, centsDigitsToAmount } from "@/lib/formatters/currency";
import { parseLocaleNumberBRL } from "@/lib/validators/number";
import {
  calculateEarlyPayoff,
  validateEarlyPayoffInput,
  type EarlyPayoffFieldErrors,
  type EarlyPayoffInput,
  type EarlyPayoffResult,
  type FinancingRateType,
} from "@/lib/calculators/vehicle-financing";

/**
 * "Antecipação de parcelas" (cluster Financiamento de Veículos). Estima
 * quanto custaria quitar o financiamento agora — o saldo devedor é o valor
 * presente das parcelas que ainda faltam, descontado pela mesma taxa do
 * contrato. O valor OFICIAL de liquidação antecipada só a instituição
 * financeira pode informar (pode incluir descontos ou critérios diferentes
 * de cálculo) — por isso o disclaimer abaixo é sempre exibido.
 */
export function AntecipacaoParcelasFinanciamentoTool() {
  const [financedAmountDigits, setFinancedAmountDigits] = useState("");
  const [rateText, setRateText] = useState("");
  const [rateType, setRateType] = useState<FinancingRateType>("mensal");
  const [installmentsText, setInstallmentsText] = useState("");
  const [paidInstallmentsText, setPaidInstallmentsText] = useState("");
  const [errors, setErrors] = useState<EarlyPayoffFieldErrors>({});
  const [result, setResult] = useState<EarlyPayoffResult | null>(null);

  function clearError(field: keyof EarlyPayoffFieldErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleClear() {
    setFinancedAmountDigits("");
    setRateText("");
    setRateType("mensal");
    setInstallmentsText("");
    setPaidInstallmentsText("");
    setErrors({});
    setResult(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input: EarlyPayoffInput = {
      financedAmount: centsDigitsToAmount(financedAmountDigits),
      rate: parseLocaleNumberBRL(rateText) ?? NaN,
      rateType,
      installments: parseLocaleNumberBRL(installmentsText) ?? NaN,
      paidInstallments: paidInstallmentsText ? (parseLocaleNumberBRL(paidInstallmentsText) ?? NaN) : 0,
    };

    const nextErrors = validateEarlyPayoffInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }

    setResult(calculateEarlyPayoff(input));
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="antecipacao-valor-financiado"
          label="Valor financiado (original)"
          inputMode="decimal"
          placeholder="R$ 0,00"
          value={financedAmountDigits ? formatCurrencyBRL(centsDigitsToAmount(financedAmountDigits)) : ""}
          onChange={(event) => {
            setFinancedAmountDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
            clearError("financedAmount");
          }}
          error={errors.financedAmount}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberField
            id="antecipacao-taxa"
            label="Taxa de juros do contrato"
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
            id="antecipacao-taxa-tipo"
            label="Tipo da taxa"
            value={rateType}
            onChange={(event) => setRateType(event.target.value as FinancingRateType)}
          >
            <option value="mensal">Mensal</option>
            <option value="anual">Anual</option>
          </SelectField>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberField
            id="antecipacao-prazo"
            label="Prazo total (número de parcelas)"
            placeholder="0"
            value={installmentsText}
            onChange={(event) => {
              setInstallmentsText(event.target.value);
              clearError("installments");
            }}
            error={errors.installments}
          />
          <NumberField
            id="antecipacao-pagas"
            label="Parcelas já pagas"
            placeholder="0"
            hint="Deixe 0 se ainda não pagou nenhuma"
            value={paidInstallmentsText}
            onChange={(event) => {
              setPaidInstallmentsText(event.target.value);
              clearError("paidInstallments");
            }}
            error={errors.paidInstallments}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="submit">Calcular</Button>
          <Button type="button" variant="secondary" onClick={handleClear}>
            Limpar
          </Button>
        </div>
      </form>

      {result ? (
        <div className="mt-8 space-y-6">
          <ResultHighlight
            label="Valor aproximado para quitar agora"
            value={formatCurrencyBRL(result.estimatedPayoffAmount)}
          />

          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            Esta é uma simulação. O valor oficial de liquidação ou antecipação deve ser consultado
            junto à instituição financeira.
          </p>

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Parcelas restantes</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">{result.remainingInstallments}</dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Total sem antecipar</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">
                {formatCurrencyBRL(result.nominalRemainingTotal)}
              </dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Economia estimada em juros</dt>
              <dd className="mt-1 text-sm font-semibold text-emerald-700">
                {formatCurrencyBRL(result.estimatedSavings)}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
