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
  calculateSeverance,
  validateSeveranceInput,
  type SeveranceDismissalType,
  type SeveranceFieldErrors,
  type SeveranceInput,
  type SeveranceResult,
} from "@/lib/calculators/severance";

/**
 * Componente principal da Calculadora de Rescisão CLT. Ferramenta trabalhista
 * mais sensível do catálogo: o escopo é deliberadamente limitado a dois tipos
 * de desligamento (dispensa sem justa causa e pedido de demissão), com essa
 * limitação exibida de forma clara e permanente na interface, junto do aviso
 * de que o resultado não substitui um contador/RH/advogado (PROMPT MESTRE,
 * "Rescisão CLT").
 */
export function SeveranceTool() {
  const [grossDigits, setGrossDigits] = useState("");
  const [dismissalType, setDismissalType] = useState<SeveranceDismissalType>("sem_justa_causa");
  const [completedYearsText, setCompletedYearsText] = useState("0");
  const [workedDaysText, setWorkedDaysText] = useState("");
  const [vacationMonthsText, setVacationMonthsText] = useState("0");
  const [thirteenthMonthsText, setThirteenthMonthsText] = useState("0");
  const [hasExpiredVacation, setHasExpiredVacation] = useState(false);
  const [fgtsBalanceDigits, setFgtsBalanceDigits] = useState("");
  const [dependentsText, setDependentsText] = useState("");
  const [errors, setErrors] = useState<SeveranceFieldErrors>({});
  const [result, setResult] = useState<SeveranceResult | null>(null);

  function clearError(field: keyof SeveranceFieldErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input: SeveranceInput = {
      grossSalary: centsDigitsToAmount(grossDigits),
      dismissalType,
      completedYears: parseLocaleNumberBRL(completedYearsText) ?? NaN,
      workedDaysInMonth: parseLocaleNumberBRL(workedDaysText) ?? NaN,
      vacationProportionalMonths: parseLocaleNumberBRL(vacationMonthsText) ?? NaN,
      thirteenthProportionalMonths: parseLocaleNumberBRL(thirteenthMonthsText) ?? NaN,
      hasExpiredVacation,
      fgtsBalance: fgtsBalanceDigits ? centsDigitsToAmount(fgtsBalanceDigits) : 0,
      dependents: dependentsText ? parseLocaleNumberBRL(dependentsText) ?? NaN : 0,
    };

    const nextErrors = validateSeveranceInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }

    setResult(calculateSeverance(input));
  }

  const isWithoutCause = dismissalType === "sem_justa_causa";

  return (
    <div>
      <p className="mb-5 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        Esta calculadora cobre apenas dois tipos de desligamento: dispensa sem justa causa e
        pedido de demissão. Ela NÃO cobre justa causa, acordo mútuo (distrato), término de
        contrato de experiência, aposentadoria ou falecimento. O resultado é uma estimativa e não
        substitui o Termo de Rescisão do Contrato de Trabalho (TRCT) oficial, a homologação ou a
        orientação de um contador, sindicato ou advogado.
      </p>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="severance-gross"
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
          id="severance-dismissal-type"
          label="Tipo de desligamento"
          value={dismissalType}
          onChange={(event) => setDismissalType(event.target.value as SeveranceDismissalType)}
        >
          <option value="sem_justa_causa">Dispensa sem justa causa (pelo empregador)</option>
          <option value="pedido_demissao">Pedido de demissão (pelo empregado)</option>
        </SelectField>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberField
            id="severance-worked-days"
            label="Dias trabalhados no mês da rescisão"
            hint="De 0 a 30, para o saldo de salário"
            placeholder="0"
            value={workedDaysText}
            onChange={(event) => {
              setWorkedDaysText(event.target.value);
              clearError("workedDaysInMonth");
            }}
            error={errors.workedDaysInMonth}
          />
          {isWithoutCause ? (
            <NumberField
              id="severance-completed-years"
              label="Anos completos de casa"
              hint="Para o aviso prévio proporcional"
              placeholder="0"
              value={completedYearsText}
              onChange={(event) => {
                setCompletedYearsText(event.target.value);
                clearError("completedYears");
              }}
              error={errors.completedYears}
            />
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberField
            id="severance-vacation-months"
            label="Meses trabalhados no período aquisitivo atual"
            hint="De 0 a 12, para férias proporcionais"
            placeholder="0"
            value={vacationMonthsText}
            onChange={(event) => {
              setVacationMonthsText(event.target.value);
              clearError("vacationProportionalMonths");
            }}
            error={errors.vacationProportionalMonths}
          />
          <NumberField
            id="severance-thirteenth-months"
            label="Meses trabalhados no ano civil"
            hint="De 0 a 12, para o 13º proporcional"
            placeholder="0"
            value={thirteenthMonthsText}
            onChange={(event) => {
              setThirteenthMonthsText(event.target.value);
              clearError("thirteenthProportionalMonths");
            }}
            error={errors.thirteenthProportionalMonths}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={hasExpiredVacation}
            onChange={(event) => setHasExpiredVacation(event.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
          />
          Há férias vencidas (período aquisitivo completo ainda não gozado)
        </label>

        {isWithoutCause ? (
          <TextField
            id="severance-fgts-balance"
            label="Saldo do FGTS depositado"
            inputMode="decimal"
            placeholder="R$ 0,00"
            hint="Opcional — consulte o extrato do FGTS, usado só para calcular a multa de 40%"
            value={fgtsBalanceDigits ? formatCurrencyBRL(centsDigitsToAmount(fgtsBalanceDigits)) : ""}
            onChange={(event) => {
              setFgtsBalanceDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
              clearError("fgtsBalance");
            }}
            error={errors.fgtsBalance}
          />
        ) : null}

        <NumberField
          id="severance-dependents"
          label="Número de dependentes"
          hint="Para fins de IRRF (opcional)"
          placeholder="0"
          value={dependentsText}
          onChange={(event) => {
            setDependentsText(event.target.value);
            clearError("dependents");
          }}
          error={errors.dependents}
        />

        <Button type="submit" className="w-full sm:w-auto">
          Calcular
        </Button>
      </form>

      {result ? (
        <div className="mt-8 space-y-4">
          <ResultHighlight
            label="Total líquido estimado a receber"
            value={formatCurrencyBRL(result.headline)}
          />

          <div>
            <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Memória de cálculo das verbas
            </h3>
            <dl className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              <div className="flex items-center justify-between p-3">
                <dt className="text-sm text-zinc-600 dark:text-zinc-400">
                  Saldo de salário (líquido)
                </dt>
                <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {formatCurrencyBRL(result.balanceSalaryNet)}
                </dd>
              </div>
              {result.noticePeriodAmount > 0 ? (
                <div className="flex items-center justify-between p-3">
                  <dt className="text-sm text-zinc-600 dark:text-zinc-400">
                    Aviso prévio indenizado ({result.noticePeriodDays} dias)
                  </dt>
                  <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {formatCurrencyBRL(result.noticePeriodAmount)}
                  </dd>
                </div>
              ) : null}
              {result.expiredVacationAmount > 0 ? (
                <div className="flex items-center justify-between p-3">
                  <dt className="text-sm text-zinc-600 dark:text-zinc-400">
                    Férias vencidas (+ 1/3)
                  </dt>
                  <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {formatCurrencyBRL(result.expiredVacationAmount)}
                  </dd>
                </div>
              ) : null}
              {result.proportionalVacationAmount > 0 ? (
                <div className="flex items-center justify-between p-3">
                  <dt className="text-sm text-zinc-600 dark:text-zinc-400">
                    Férias proporcionais (+ 1/3)
                  </dt>
                  <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {formatCurrencyBRL(result.proportionalVacationAmount)}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between p-3">
                <dt className="text-sm text-zinc-600 dark:text-zinc-400">
                  13º proporcional (líquido)
                </dt>
                <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {formatCurrencyBRL(result.thirteenthNet)}
                </dd>
              </div>
              {result.fgtsFineAmount > 0 ? (
                <div className="flex items-center justify-between p-3">
                  <dt className="text-sm text-zinc-600 dark:text-zinc-400">
                    Multa de 40% do FGTS
                  </dt>
                  <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {formatCurrencyBRL(result.fgtsFineAmount)}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between p-3">
                <dt className="text-sm text-zinc-600 dark:text-zinc-400">
                  (−) INSS + IRRF (saldo de salário e 13º)
                </dt>
                <dd className="text-sm font-medium text-red-700 dark:text-red-400">
                  {formatCurrencyBRL(result.totalDeductions)}
                </dd>
              </div>
              <div className="flex items-center justify-between bg-emerald-50 p-3 dark:bg-emerald-950/40">
                <dt className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  Total líquido estimado
                </dt>
                <dd className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  {formatCurrencyBRL(result.totalNet)}
                </dd>
              </div>
            </dl>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {isWithoutCause
              ? "No pedido de demissão, não há aviso prévio indenizado a receber nem multa de 40% do FGTS."
              : "No pedido de demissão, o empregado não recebe aviso prévio nem a multa de 40% do FGTS; se não cumprir o aviso, o empregador pode descontar o período correspondente."}{" "}
            Verbas indenizatórias (aviso prévio, férias e o respectivo 1/3) são isentas de
            INSS/IRRF. Este é um cálculo estimado e não substitui o TRCT oficial, a homologação ou
            a orientação de um contador, sindicato ou advogado.
          </p>
        </div>
      ) : null}
    </div>
  );
}
