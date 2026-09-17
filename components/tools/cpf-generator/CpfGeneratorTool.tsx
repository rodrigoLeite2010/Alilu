"use client";

import { useState, type FormEvent } from "react";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import {
  generateCpfBatch,
  validateCpfGeneratorInput,
  CPF_GENERATOR_MAX_BATCH,
  type CpfGeneratorFieldErrors,
  type CpfGeneratorInput,
} from "@/lib/calculators/cpf-generator";

/**
 * Componente principal do Gerador de CPF (ETAPA 3 da categoria Devs). Toda
 * a geração acontece 100% no navegador do usuário — nenhum valor gerado é
 * enviado para servidor algum, armazenado ou registrado em log.
 *
 * Os CPFs gerados são SINTÉTICOS: a validade matemática dos dígitos
 * verificadores não indica que o número exista ou pertença a uma pessoa
 * real. Esta ferramenta não consulta a Receita Federal nem qualquer base
 * de dados de pessoas.
 */
export function CpfGeneratorTool() {
  const [countText, setCountText] = useState("1");
  const [formatted, setFormatted] = useState(true);
  const [errors, setErrors] = useState<CpfGeneratorFieldErrors>({});
  const [results, setResults] = useState<string[] | null>(null);
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
    const input: CpfGeneratorInput = {
      count: Number(countText) || 0,
      formatted,
    };

    const nextErrors = validateCpfGeneratorInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResults(null);
      return;
    }

    setResults(generateCpfBatch(input));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runGeneration();
  }

  return (
    <div>
      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Os números gerados são sintéticos e destinados exclusivamente a
        testes. A validade matemática não indica que o CPF exista ou
        pertença a uma pessoa.
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberField
            id="cpf-generator-count"
            label="Quantidade"
            placeholder="1"
            hint={`Máximo de ${CPF_GENERATOR_MAX_BATCH} por vez.`}
            maxLength={String(CPF_GENERATOR_MAX_BATCH).length}
            value={countText}
            onChange={(event) =>
              setCountText(event.target.value.replace(/\D/g, "").slice(0, String(CPF_GENERATOR_MAX_BATCH).length))
            }
            error={errors.count}
          />
          <SelectField
            id="cpf-generator-format"
            label="Formato"
            value={formatted ? "formatted" : "digits"}
            onChange={(event) => setFormatted(event.target.value === "formatted")}
          >
            <option value="formatted">Com pontuação (000.000.000-00)</option>
            <option value="digits">Somente números (00000000000)</option>
          </SelectField>
        </div>

        <Button type="submit" className="w-full sm:w-auto">
          Gerar CPF
        </Button>
      </form>

      {results && results.length > 0 ? (
        <div className="mt-8 space-y-4">
          {results.length === 1 ? (
            <>
              <ResultHighlight label="CPF gerado" value={results[0]} />
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={() => copyText(results[0], "single")}>
                  Copiar CPF
                </Button>
                <Button type="button" variant="secondary" onClick={runGeneration}>
                  Gerar novamente
                </Button>
                {copiedKey === "single" ? (
                  <span role="status" className="text-sm text-emerald-600">
                    CPF copiado!
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-zinc-200">
              <ul className="divide-y divide-zinc-100">
                {results.map((cpf, index) => (
                  <li
                    key={`${cpf}-${index}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <span className="font-mono text-sm text-zinc-900">{cpf}</span>
                    <button
                      type="button"
                      onClick={() => copyText(cpf, `row-${index}`)}
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
                  onClick={() => copyText(results.join("\n"), "all")}
                >
                  Copiar todos
                </Button>
                <Button type="button" variant="secondary" onClick={runGeneration}>
                  Gerar novamente
                </Button>
                {copiedKey === "all" ? (
                  <span role="status" className="text-sm text-emerald-600">
                    Todos os CPFs copiados!
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
