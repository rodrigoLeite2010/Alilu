"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { NumberField } from "@/components/forms/NumberField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import { centsDigitsToAmount, formatCurrencyBRL } from "@/lib/formatters/currency";
import { parseLocaleNumberBRL } from "@/lib/validators/number";
import {
  calculateNetSalary,
  validateNetSalaryInput,
  type NetSalaryFieldErrors,
  type NetSalaryInput,
  type NetSalaryResult,
} from "@/lib/calculators/net-salary";
import { PAYROLL_TABLE_REFERENCE_YEAR } from "@/lib/calculators/payroll-tables";

/**
 * Componente principal da Calculadora de Salário Líquido. Usa as tabelas de
 * INSS e IRRF centralizadas e documentadas em lib/calculators/payroll-tables.ts
 * (PROMPT MESTRE, REGRA ESPECIAL — nunca inventar tabela/alíquota; sempre citar
 * a fonte e o ano de referência para o usuário).
 */
export function NetSalaryTool() {
  const [grossDigits, setGrossDigits] = useState("");
  const [dependentsText, setDependentsText] = useState("");
  const [otherDeductionsDigits, setOtherDeductionsDigits] = useState("");
  const [errors, setErrors] = useState<NetSalaryFieldErrors>({});
  const [result, setResult] = useState<NetSalaryResult | null>(null);

  function clearError(field: keyof NetSalaryFieldErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input: NetSalaryInput = {
      grossSalary: centsDigitsToAmount(grossDigits),
      dependents: dependentsText ? parseLocaleNumberBRL(dependentsText) ?? NaN : 0,
      otherDeductions: otherDeductionsDigits ? centsDigitsToAmount(otherDeductionsDigits) : 0,
    };

    const nextErrors = validateNetSalaryInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }

    setResult(calculateNetSalary(input));
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="net-salary-gross"
          label="Salário bruto"
          inputMode="decimal"
          placeholder="R$ 0,00"
          value={grossDigits ? formatCurrencyBRL(centsDigitsToAmount(grossDigits)) : ""}
          onChange={(event) => {
            setGrossDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
            clearError("grossSalary");
          }}
          error={errors.grossSalary}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberField
            id="net-salary-dependents"
            label="Número de dependentes"
            hint="Para fins de IRRF"
            placeholder="0"
            value={dependentsText}
            onChange={(event) => {
              setDependentsText(event.target.value);
              clearError("dependents");
            }}
            error={errors.dependents}
          />
          <TextField
            id="net-salary-other-deductions"
            label="Outros descontos"
            inputMode="decimal"
            placeholder="R$ 0,00"
            hint="Vale-transporte, plano de saúde, pensão etc. (opcional)"
            value={
              otherDeductionsDigits
                ? formatCurrencyBRL(centsDigitsToAmount(otherDeductionsDigits))
                : ""
            }
            onChange={(event) => {
              setOtherDeductionsDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
              clearError("otherDeductions");
            }}
            error={errors.otherDeductions}
          />
        </div>

        <Button type="submit" className="w-full sm:w-auto">
          Calcular
        </Button>
      </form>

      {result ? (
        <div className="mt-8 space-y-4">
          <ResultHighlight label="Salário líquido" value={formatCurrencyBRL(result.headline)} />

          <div>
            <h3 className="mb-2 text-sm font-semibold text-zinc-900">
              Memória de cálculo
            </h3>
            <dl className="divide-y divide-zinc-200 rounded-lg border border-zinc-200">
              <div className="flex items-center justify-between p-3">
                <dt className="text-sm text-zinc-600">Salário bruto</dt>
                <dd className="text-sm font-medium text-zinc-900">
                  {formatCurrencyBRL(result.grossSalary)}
                </dd>
              </div>
              <div className="flex items-center justify-between p-3">
                <dt className="text-sm text-zinc-600">(−) INSS</dt>
                <dd className="text-sm font-medium text-red-700">
                  {formatCurrencyBRL(result.inss)}
                </dd>
              </div>
              {result.dependentsDeduction > 0 ? (
                <div className="flex items-center justify-between p-3">
                  <dt className="text-sm text-zinc-600">
                    (−) Dedução por dependentes (base do IRRF)
                  </dt>
                  <dd className="text-sm font-medium text-zinc-900">
                    {formatCurrencyBRL(result.dependentsDeduction)}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between p-3">
                <dt className="text-sm text-zinc-600">(−) IRRF</dt>
                <dd className="text-sm font-medium text-red-700">
                  {formatCurrencyBRL(result.irrf)}
                </dd>
              </div>
              {result.otherDeductions > 0 ? (
                <div className="flex items-center justify-between p-3">
                  <dt className="text-sm text-zinc-600">(−) Outros descontos</dt>
                  <dd className="text-sm font-medium text-red-700">
                    {formatCurrencyBRL(result.otherDeductions)}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between p-3">
                <dt className="text-sm font-semibold text-zinc-900">
                  Total de descontos
                </dt>
                <dd className="text-sm font-semibold text-zinc-900">
                  {formatCurrencyBRL(result.totalDeductions)}
                </dd>
              </div>
              <div className="flex items-center justify-between bg-emerald-50 p-3">
                <dt className="text-sm font-semibold text-emerald-800">
                  Salário líquido
                </dt>
                <dd className="text-sm font-semibold text-emerald-800">
                  {formatCurrencyBRL(result.headline)}
                </dd>
              </div>
            </dl>
          </div>

          <p className="text-xs text-zinc-500">
            Cálculo com base nas tabelas oficiais de INSS e IRRF vigentes em{" "}
            {PAYROLL_TABLE_REFERENCE_YEAR}. Considera apenas o desconto mensal padrão sobre o
            salário bruto informado — não substitui o holerite oficial, que pode incluir outras
            rubricas (horas extras, comissões, adicionais, pensão alimentícia etc.), nem o ajuste
            anual da declaração de Imposto de Renda.
          </p>
        </div>
      ) : null}
    </div>
  );
}
