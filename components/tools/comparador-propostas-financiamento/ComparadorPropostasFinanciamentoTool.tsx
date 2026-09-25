"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { formatCurrencyBRL, centsDigitsToAmount } from "@/lib/formatters/currency";
import { parseLocaleNumberBRL } from "@/lib/validators/number";
import {
  compareFinancingProposals,
  MAX_FINANCING_PROPOSALS,
  MIN_FINANCING_PROPOSALS,
  validateFinancingProposalInput,
  type FinancingProposalInput,
  type FinancingProposalResult,
  type FinancingRateType,
} from "@/lib/calculators/vehicle-financing";

interface ProposalSlot {
  label: string;
  financedAmountDigits: string;
  rateText: string;
  rateType: FinancingRateType;
  installmentsText: string;
}

interface SlotErrors {
  financedAmount?: string;
  rate?: string;
  installments?: string;
}

function emptySlot(defaultLabel: string): ProposalSlot {
  return { label: defaultLabel, financedAmountDigits: "", rateText: "", rateType: "mensal", installmentsText: "" };
}

function isSlotEmpty(slot: ProposalSlot): boolean {
  return !slot.financedAmountDigits && !slot.rateText && !slot.installmentsText;
}

/**
 * Comparador de propostas de financiamento (até 3 propostas). A função de
 * cálculo (compareFinancingProposals, lib/calculators/vehicle-financing.ts)
 * só devolve os números de cada proposta, na ordem informada — esta
 * interface, de propósito, nunca destaca uma proposta como "a melhor": o
 * total pago aqui não inclui tarifas, seguros nem o CET real de cada banco.
 */
export function ComparadorPropostasFinanciamentoTool() {
  const [slots, setSlots] = useState<ProposalSlot[]>([
    emptySlot("Proposta 1"),
    emptySlot("Proposta 2"),
  ]);
  const [slotErrors, setSlotErrors] = useState<SlotErrors[]>([{}, {}]);
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [results, setResults] = useState<FinancingProposalResult[] | null>(null);

  function updateSlot(index: number, patch: Partial<ProposalSlot>) {
    setSlots((current) => current.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
    setSlotErrors((current) => current.map((errors, i) => (i === index ? {} : errors)));
  }

  function addSlot() {
    if (slots.length >= MAX_FINANCING_PROPOSALS) return;
    setSlots((current) => [...current, emptySlot(`Proposta ${current.length + 1}`)]);
    setSlotErrors((current) => [...current, {}]);
  }

  function handleClear() {
    setSlots([emptySlot("Proposta 1"), emptySlot("Proposta 2")]);
    setSlotErrors([{}, {}]);
    setFormError(undefined);
    setResults(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextSlotErrors: SlotErrors[] = slots.map(() => ({}));
    const validInputs: FinancingProposalInput[] = [];

    slots.forEach((slot, index) => {
      if (isSlotEmpty(slot)) return;

      const input: FinancingProposalInput = {
        label: slot.label.trim() || `Proposta ${index + 1}`,
        financedAmount: centsDigitsToAmount(slot.financedAmountDigits),
        rate: parseLocaleNumberBRL(slot.rateText) ?? NaN,
        rateType: slot.rateType,
        installments: parseLocaleNumberBRL(slot.installmentsText) ?? NaN,
      };

      const errors = validateFinancingProposalInput(input);
      if (Object.keys(errors).length > 0) {
        nextSlotErrors[index] = errors;
        return;
      }
      validInputs.push(input);
    });

    setSlotErrors(nextSlotErrors);

    const hasFieldErrors = nextSlotErrors.some((errors) => Object.keys(errors).length > 0);
    if (hasFieldErrors) {
      setFormError(undefined);
      setResults(null);
      return;
    }
    if (validInputs.length < MIN_FINANCING_PROPOSALS) {
      setFormError(`Preencha pelo menos ${MIN_FINANCING_PROPOSALS} propostas para comparar.`);
      setResults(null);
      return;
    }

    setFormError(undefined);
    setResults(compareFinancingProposals(validInputs));
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-8">
        {slots.map((slot, index) => (
          <fieldset key={index} className="space-y-5 rounded-lg border border-zinc-200 p-4">
            <TextField
              id={`proposta-${index}-label`}
              label="Nome da proposta"
              placeholder={`Proposta ${index + 1}`}
              hint="Opcional — ex.: nome do banco"
              value={slot.label}
              onChange={(event) => updateSlot(index, { label: event.target.value })}
            />

            <TextField
              id={`proposta-${index}-valor`}
              label="Valor financiado"
              inputMode="decimal"
              placeholder="R$ 0,00"
              value={
                slot.financedAmountDigits
                  ? formatCurrencyBRL(centsDigitsToAmount(slot.financedAmountDigits))
                  : ""
              }
              onChange={(event) =>
                updateSlot(index, { financedAmountDigits: event.target.value.replace(/\D/g, "").slice(0, 12) })
              }
              error={slotErrors[index]?.financedAmount}
            />

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <NumberField
                id={`proposta-${index}-taxa`}
                label="Taxa de juros"
                suffix="%"
                placeholder="0,00"
                value={slot.rateText}
                onChange={(event) => updateSlot(index, { rateText: event.target.value })}
                error={slotErrors[index]?.rate}
              />
              <SelectField
                id={`proposta-${index}-taxa-tipo`}
                label="Tipo da taxa"
                value={slot.rateType}
                onChange={(event) => updateSlot(index, { rateType: event.target.value as FinancingRateType })}
              >
                <option value="mensal">Mensal</option>
                <option value="anual">Anual</option>
              </SelectField>
            </div>

            <NumberField
              id={`proposta-${index}-prazo`}
              label="Prazo (número de parcelas)"
              placeholder="0"
              value={slot.installmentsText}
              onChange={(event) => updateSlot(index, { installmentsText: event.target.value })}
              error={slotErrors[index]?.installments}
            />
          </fieldset>
        ))}

        {formError ? <p className="text-sm text-red-600">{formError}</p> : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit">Comparar</Button>
          {slots.length < MAX_FINANCING_PROPOSALS ? (
            <Button type="button" variant="secondary" onClick={addSlot}>
              + Adicionar 3ª proposta
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={handleClear}>
            Limpar
          </Button>
        </div>
      </form>

      {results ? (
        <div className="mt-8 space-y-4">
          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            Os resultados são estimativas e não incluem tarifas, seguros nem o CET de cada proposta —
            esta comparação não indica qual proposta é a melhor.
          </p>

          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Proposta
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
                {results.map((result) => (
                  <tr key={result.label}>
                    <td className="px-4 py-3 font-medium text-zinc-900">{result.label}</td>
                    <td className="px-4 py-3 text-zinc-700">{formatCurrencyBRL(result.installment)}</td>
                    <td className="px-4 py-3 text-zinc-700">{formatCurrencyBRL(result.totalInterest)}</td>
                    <td className="px-4 py-3 font-semibold text-zinc-900">
                      {formatCurrencyBRL(result.totalPaid)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
