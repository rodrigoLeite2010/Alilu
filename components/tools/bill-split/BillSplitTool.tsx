"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import { centsDigitsToAmount, formatCurrencyBRL } from "@/lib/formatters/currency";
import { parseLocaleNumberBRL } from "@/lib/validators/number";
import {
  calculateBillSplit,
  validateBillSplitInput,
  type BillSplitFieldErrors,
  type BillSplitInput,
  type BillSplitParticipant,
  type BillSplitResult,
} from "@/lib/calculators/bill-split";

/** Componente principal do Divisor de Conta/Despesas. Não armazena nomes/valores. */
export function BillSplitTool() {
  const [mode, setMode] = useState<"equal" | "custom">("equal");
  const [totalDigits, setTotalDigits] = useState("");
  const [peopleCountText, setPeopleCountText] = useState("");
  const [serviceFeeText, setServiceFeeText] = useState("");
  const [discountText, setDiscountText] = useState("");
  const [participants, setParticipants] = useState<BillSplitParticipant[]>([
    { name: "", amount: 0 },
    { name: "", amount: 0 },
  ]);
  const [errors, setErrors] = useState<BillSplitFieldErrors>({});
  const [result, setResult] = useState<BillSplitResult | null>(null);

  function updateParticipant(index: number, patch: Partial<BillSplitParticipant>) {
    setParticipants((current) =>
      current.map((participant, i) => (i === index ? { ...participant, ...patch } : participant))
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input: BillSplitInput = {
      mode,
      total: centsDigitsToAmount(totalDigits),
      peopleCount: parseLocaleNumberBRL(peopleCountText) ?? NaN,
      serviceFeePercent: parseLocaleNumberBRL(serviceFeeText) ?? 0,
      discountPercent: parseLocaleNumberBRL(discountText) ?? 0,
      participants,
    };

    const nextErrors = validateBillSplitInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }

    setResult(calculateBillSplit(input));
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <SelectField
          id="bill-split-mode"
          label="Como dividir?"
          value={mode}
          onChange={(event) => setMode(event.target.value as "equal" | "custom")}
        >
          <option value="equal">Dividir igualmente entre todos</option>
          <option value="custom">Cada um paga o que consumiu</option>
        </SelectField>

        {mode === "equal" ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TextField
              id="bill-split-total"
              label="Valor total da conta"
              inputMode="decimal"
              placeholder="R$ 0,00"
              value={totalDigits ? formatCurrencyBRL(centsDigitsToAmount(totalDigits)) : ""}
              onChange={(event) => setTotalDigits(event.target.value.replace(/\D/g, "").slice(0, 12))}
              error={errors.total}
            />
            <NumberField
              id="bill-split-people"
              label="Número de pessoas"
              placeholder="0"
              value={peopleCountText}
              onChange={(event) => setPeopleCountText(event.target.value)}
              error={errors.peopleCount}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {participants.map((participant, index) => (
              <div key={index} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px]">
                <TextField
                  id={`bill-split-participant-name-${index}`}
                  label={`Participante ${index + 1}`}
                  placeholder="Nome"
                  value={participant.name}
                  onChange={(event) => updateParticipant(index, { name: event.target.value })}
                />
                <TextField
                  id={`bill-split-participant-amount-${index}`}
                  label="Consumiu"
                  inputMode="decimal"
                  placeholder="R$ 0,00"
                  value={participant.amount ? formatCurrencyBRL(participant.amount) : ""}
                  onChange={(event) =>
                    updateParticipant(index, {
                      amount: centsDigitsToAmount(event.target.value.replace(/\D/g, "")),
                    })
                  }
                />
              </div>
            ))}
            {errors.participants ? (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {errors.participants}
              </p>
            ) : null}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setParticipants((current) => [...current, { name: "", amount: 0 }])}
              >
                Adicionar participante
              </Button>
              {participants.length > 2 ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setParticipants((current) => current.slice(0, -1))}
                >
                  Remover último
                </Button>
              ) : null}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberField
            id="bill-split-service-fee"
            label="Taxa de serviço"
            suffix="%"
            hint="Opcional"
            placeholder="0"
            value={serviceFeeText}
            onChange={(event) => setServiceFeeText(event.target.value)}
            error={errors.serviceFeePercent}
          />
          <NumberField
            id="bill-split-discount"
            label="Desconto"
            suffix="%"
            hint="Opcional"
            placeholder="0"
            value={discountText}
            onChange={(event) => setDiscountText(event.target.value)}
            error={errors.discountPercent}
          />
        </div>

        <Button type="submit" className="w-full sm:w-auto">
          Calcular
        </Button>
      </form>

      {result ? (
        <div className="mt-8 space-y-4">
          <ResultHighlight label="Total final da conta" value={formatCurrencyBRL(result.headline)} />

          {result.amountPerPerson !== undefined ? (
            <ResultHighlight label="Valor por pessoa" value={formatCurrencyBRL(result.amountPerPerson)} />
          ) : null}

          {result.participants ? (
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Participante</th>
                    <th className="px-3 py-2 font-medium">Consumiu</th>
                    <th className="px-3 py-2 font-medium">A pagar</th>
                  </tr>
                </thead>
                <tbody>
                  {result.participants.map((participant, index) => (
                    <tr key={index} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{participant.name}</td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                        {formatCurrencyBRL(participant.amount)}
                      </td>
                      <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-50">
                        {formatCurrencyBRL(participant.amountToPay)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
