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
  calculateEmployeeCost,
  validateEmployeeCostInput,
  EMPLOYEE_COST_SUGGESTED_THIRD_PARTY_PERCENT,
  type EmployeeCostFieldErrors,
  type EmployeeCostInput,
  type EmployeeCostRegime,
  type EmployeeCostResult,
} from "@/lib/calculators/employee-cost";

/**
 * Componente principal da Calculadora de Custo de Funcionário. O usuário
 * escolhe explicitamente o regime tributário — o componente NUNCA presume um
 * regime silenciosamente (PROMPT MESTRE, "Custo de Funcionário"). Separa
 * claramente salário, encargos, provisões, benefícios e custo total estimado.
 */
export function EmployeeCostTool() {
  const [grossDigits, setGrossDigits] = useState("");
  const [regime, setRegime] = useState<EmployeeCostRegime>("geral");
  const [ratText, setRatText] = useState("1");
  const [thirdPartyText, setThirdPartyText] = useState(
    EMPLOYEE_COST_SUGGESTED_THIRD_PARTY_PERCENT.toString().replace(".", ",")
  );
  const [benefitsDigits, setBenefitsDigits] = useState("");
  const [errors, setErrors] = useState<EmployeeCostFieldErrors>({});
  const [result, setResult] = useState<EmployeeCostResult | null>(null);

  function clearError(field: keyof EmployeeCostFieldErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const chargesCPPAndRAT = regime === "geral" || regime === "simples_anexo_iv";
    const input: EmployeeCostInput = {
      grossSalary: centsDigitsToAmount(grossDigits),
      regime,
      ratPercent: chargesCPPAndRAT ? parseLocaleNumberBRL(ratText) ?? NaN : 0,
      thirdPartyPercent: regime === "geral" ? parseLocaleNumberBRL(thirdPartyText) ?? NaN : 0,
      monthlyBenefits: benefitsDigits ? centsDigitsToAmount(benefitsDigits) : 0,
    };

    const nextErrors = validateEmployeeCostInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }

    setResult(calculateEmployeeCost(input));
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="employee-cost-gross"
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

        <SelectField
          id="employee-cost-regime"
          label="Regime tributário da empresa"
          value={regime}
          onChange={(event) => setRegime(event.target.value as EmployeeCostRegime)}
        >
          <option value="geral">Lucro Presumido/Real (regime geral)</option>
          <option value="simples_anexo_iv">
            Simples Nacional — Anexo IV (construção, limpeza, vigilância etc.)
          </option>
          <option value="simples_outros">Simples Nacional — Anexos I, II, III ou V</option>
        </SelectField>

        {regime === "geral" || regime === "simples_anexo_iv" ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <SelectField
              id="employee-cost-rat"
              label="RAT (Risco Ambiental do Trabalho)"
              value={ratText}
              onChange={(event) => setRatText(event.target.value)}
            >
              <option value="1">1% (risco leve)</option>
              <option value="2">2% (risco médio)</option>
              <option value="3">3% (risco grave)</option>
            </SelectField>
            {regime === "geral" ? (
              <NumberField
                id="employee-cost-third-party"
                label="Contribuições a terceiros"
                suffix="%"
                hint="Sugerido — varia conforme o CNAE da empresa"
                value={thirdPartyText}
                onChange={(event) => {
                  setThirdPartyText(event.target.value);
                  clearError("thirdPartyPercent");
                }}
                error={errors.thirdPartyPercent}
              />
            ) : null}
          </div>
        ) : null}

        {regime === "simples_anexo_iv" ? (
          <p className="rounded-lg bg-teal-50 p-3 text-xs text-teal-800">
            No Anexo IV do Simples Nacional, a CPP (INSS patronal) e o RAT NÃO estão embutidos na
            alíquota do DAS — a empresa recolhe os dois separadamente, como no regime geral. Já as
            contribuições a terceiros/&quot;Sistema S&quot; nunca são cobradas de nenhuma empresa
            do Simples Nacional, nem mesmo do Anexo IV — por isso não aparecem aqui.
          </p>
        ) : null}

        {regime === "simples_outros" ? (
          <p className="rounded-lg bg-teal-50 p-3 text-xs text-teal-800">
            Nos Anexos I, II, III e V do Simples Nacional, o INSS patronal, o RAT e as
            contribuições a terceiros já estão todos embutidos na alíquota unificada do DAS — por
            isso não são somados separadamente aqui, para não contar o mesmo encargo duas vezes.
          </p>
        ) : null}

        <TextField
          id="employee-cost-benefits"
          label="Benefícios mensais"
          inputMode="decimal"
          placeholder="R$ 0,00"
          hint="Vale-transporte, vale-refeição, plano de saúde etc. (opcional)"
          value={benefitsDigits ? formatCurrencyBRL(centsDigitsToAmount(benefitsDigits)) : ""}
          onChange={(event) => {
            setBenefitsDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
            clearError("monthlyBenefits");
          }}
          error={errors.monthlyBenefits}
        />

        <Button type="submit" className="w-full sm:w-auto">
          Calcular
        </Button>
      </form>

      {result ? (
        <div className="mt-8 space-y-4">
          <ResultHighlight
            label="Custo total estimado da empresa"
            value={formatCurrencyBRL(result.headline)}
          />

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
              {result.employerINSS > 0 ? (
                <div className="flex items-center justify-between p-3">
                  <dt className="text-sm text-zinc-600">(+) INSS patronal</dt>
                  <dd className="text-sm font-medium text-zinc-900">
                    {formatCurrencyBRL(result.employerINSS)}
                  </dd>
                </div>
              ) : null}
              {result.rat > 0 ? (
                <div className="flex items-center justify-between p-3">
                  <dt className="text-sm text-zinc-600">(+) RAT</dt>
                  <dd className="text-sm font-medium text-zinc-900">
                    {formatCurrencyBRL(result.rat)}
                  </dd>
                </div>
              ) : null}
              {result.thirdParty > 0 ? (
                <div className="flex items-center justify-between p-3">
                  <dt className="text-sm text-zinc-600">
                    (+) Contribuições a terceiros
                  </dt>
                  <dd className="text-sm font-medium text-zinc-900">
                    {formatCurrencyBRL(result.thirdParty)}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between p-3">
                <dt className="text-sm text-zinc-600">(+) FGTS sobre o salário</dt>
                <dd className="text-sm font-medium text-zinc-900">
                  {formatCurrencyBRL(result.fgtsOnSalary)}
                </dd>
              </div>
              <div className="flex items-center justify-between p-3">
                <dt className="text-sm text-zinc-600">
                  (+) Provisão de férias (+ 1/3)
                </dt>
                <dd className="text-sm font-medium text-zinc-900">
                  {formatCurrencyBRL(result.vacationProvision + result.vacationOneThirdProvision)}
                </dd>
              </div>
              <div className="flex items-center justify-between p-3">
                <dt className="text-sm text-zinc-600">(+) Provisão de 13º</dt>
                <dd className="text-sm font-medium text-zinc-900">
                  {formatCurrencyBRL(result.thirteenthProvision)}
                </dd>
              </div>
              <div className="flex items-center justify-between p-3">
                <dt className="text-sm text-zinc-600">
                  (+) FGTS sobre as provisões
                </dt>
                <dd className="text-sm font-medium text-zinc-900">
                  {formatCurrencyBRL(result.fgtsOnProvisions)}
                </dd>
              </div>
              {result.monthlyBenefits > 0 ? (
                <div className="flex items-center justify-between p-3">
                  <dt className="text-sm text-zinc-600">(+) Benefícios mensais</dt>
                  <dd className="text-sm font-medium text-zinc-900">
                    {formatCurrencyBRL(result.monthlyBenefits)}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between bg-emerald-50 p-3">
                <dt className="text-sm font-semibold text-emerald-800">
                  Custo total estimado
                </dt>
                <dd className="text-sm font-semibold text-emerald-800">
                  {formatCurrencyBRL(result.headline)}
                </dd>
              </div>
            </dl>
          </div>

          <p className="text-xs text-zinc-500">
            As provisões de férias e 13º são estimativas contábeis do custo médio mensal desses
            direitos (1/12 do valor anual de cada um), não um desconto do salário do funcionário.
            Quando aplicável, o INSS patronal, o RAT e as contribuições a terceiros já consideram
            a incidência sobre essas provisões (13º e férias + terço), além do salário do mês.
            Este é um cálculo estimado — não substitui a apuração de um contador.
          </p>
        </div>
      ) : null}
    </div>
  );
}
