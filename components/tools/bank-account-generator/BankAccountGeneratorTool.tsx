"use client";

import { useState, type FormEvent } from "react";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import {
  generateBankAccountBatch,
  validateBankAccountGeneratorInput,
  BANK_LABELS,
  BANK_ACCOUNT_GENERATOR_MAX_BATCH,
  type BankAccountGeneratorFieldErrors,
  type BankAccountGeneratorInput,
  type BankAccountType,
  type GeneratedBankAccount,
} from "@/lib/calculators/bank-account-generator";

function formatAccount(account: GeneratedBankAccount): string {
  return `Ag. ${account.agency} / Conta ${account.account}-${account.accountDigit}`;
}

/**
 * Componente principal do Gerador de Conta Bancária (categoria Geradores).
 * Toda a geração acontece 100% no navegador do usuário — nenhum dado
 * gerado é enviado, armazenado ou registrado em log.
 *
 * Os dados são SINTÉTICOS: agência, conta e dígito são sorteados ao acaso
 * e não reproduzem o algoritmo interno de nenhum banco real. Os nomes de
 * banco servem apenas como rótulo de exemplo.
 */
export function BankAccountGeneratorTool() {
  const [countText, setCountText] = useState("1");
  const [bankCode, setBankCode] = useState("random");
  const [type, setType] = useState<BankAccountType>("corrente");
  const [errors, setErrors] = useState<BankAccountGeneratorFieldErrors>({});
  const [results, setResults] = useState<GeneratedBankAccount[] | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 2000);
    } catch {
      setCopiedKey(null);
    }
  }

  function runGeneration() {
    const input: BankAccountGeneratorInput = {
      count: Number(countText) || 0,
      bankCode,
      type,
    };

    const nextErrors = validateBankAccountGeneratorInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResults(null);
      return;
    }

    setResults(generateBankAccountBatch(input));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runGeneration();
  }

  return (
    <div>
      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Agência, conta e dígito são sintéticos e sorteados ao acaso — não
        reproduzem o algoritmo real de nenhum banco. Os nomes de banco
        servem apenas como rótulo de exemplo para testar campos de
        formulário.
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SelectField
            id="bank-account-generator-bank"
            label="Banco"
            value={bankCode}
            onChange={(event) => setBankCode(event.target.value)}
          >
            <option value="random">Sortear banco</option>
            {BANK_LABELS.map((bank) => (
              <option key={bank.code} value={bank.code}>
                {bank.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="bank-account-generator-type"
            label="Tipo de conta"
            value={type}
            onChange={(event) => setType(event.target.value as BankAccountType)}
          >
            <option value="corrente">Conta corrente</option>
            <option value="poupanca">Conta poupança</option>
          </SelectField>
        </div>

        <NumberField
          id="bank-account-generator-count"
          label="Quantidade"
          placeholder="1"
          hint={`Máximo de ${BANK_ACCOUNT_GENERATOR_MAX_BATCH} por vez.`}
          maxLength={String(BANK_ACCOUNT_GENERATOR_MAX_BATCH).length}
          value={countText}
          onChange={(event) =>
            setCountText(
              event.target.value.replace(/\D/g, "").slice(0, String(BANK_ACCOUNT_GENERATOR_MAX_BATCH).length)
            )
          }
          error={errors.count}
        />

        <Button type="submit" className="w-full sm:w-auto">
          Gerar conta bancária
        </Button>
      </form>

      {results && results.length > 0 ? (
        <div className="mt-8 space-y-4">
          {results.length === 1 ? (
            <>
              <ResultHighlight
                label={`Conta gerada (${results[0].bank.name})`}
                value={formatAccount(results[0])}
              />
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button type="button" onClick={() => copyText(formatAccount(results[0]), "single")}>
                  Copiar dados
                </Button>
                <Button type="button" variant="secondary" onClick={runGeneration}>
                  Gerar novamente
                </Button>
                {copiedKey === "single" ? (
                  <span role="status" className="text-sm text-emerald-600">
                    Dados copiados!
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-zinc-200">
              <ul className="divide-y divide-zinc-100">
                {results.map((account, index) => (
                  <li
                    key={`${account.agency}-${account.account}-${index}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <span className="font-mono text-sm text-zinc-900">
                      {formatAccount(account)}
                      <span className="ml-2 text-xs font-sans text-zinc-500">{account.bank.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => copyText(formatAccount(account), `row-${index}`)}
                      className="text-sm font-medium text-teal-700 hover:text-teal-900"
                    >
                      {copiedKey === `row-${index}` ? "Copiado!" : "Copiar"}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 p-4">
                <Button
                  type="button"
                  onClick={() => copyText(results.map((account) => formatAccount(account)).join("\n"), "all")}
                >
                  Copiar todos
                </Button>
                <Button type="button" variant="secondary" onClick={runGeneration}>
                  Gerar novamente
                </Button>
                {copiedKey === "all" ? (
                  <span role="status" className="text-sm text-emerald-600">
                    Todos os dados copiados!
                  </span>
                ) : null}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
