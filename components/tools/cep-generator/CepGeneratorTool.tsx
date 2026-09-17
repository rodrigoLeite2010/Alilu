"use client";

import { useState, type FormEvent } from "react";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import {
  generateCepBatch,
  validateCepGeneratorInput,
  CEP_GENERATOR_MAX_BATCH,
  type CepGeneratorFieldErrors,
  type CepGeneratorInput,
} from "@/lib/calculators/cep-generator";

/**
 * Componente principal do Gerador de CEP (categoria Geradores). Toda a
 * geração acontece 100% no navegador do usuário — nenhum CEP gerado é
 * enviado, armazenado ou registrado em log.
 *
 * Os CEPs gerados são SINTÉTICOS (8 dígitos aleatórios no formato de CEP):
 * esta ferramenta não consulta os Correios nem qualquer base de endereços
 * real, e não garante que o número corresponda a um endereço existente.
 */
export function CepGeneratorTool() {
  const [countText, setCountText] = useState("1");
  const [formatted, setFormatted] = useState(true);
  const [errors, setErrors] = useState<CepGeneratorFieldErrors>({});
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
    const input: CepGeneratorInput = {
      count: Number(countText) || 0,
      formatted,
    };

    const nextErrors = validateCepGeneratorInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResults(null);
      return;
    }

    setResults(generateCepBatch(input));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runGeneration();
  }

  return (
    <div>
      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Os CEPs gerados são sintéticos (dígitos aleatórios no formato de
        CEP) e destinados a testes. Esta ferramenta não consulta os
        Correios e não garante que o número corresponda a um endereço real.
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberField
            id="cep-generator-count"
            label="Quantidade"
            placeholder="1"
            hint={`Máximo de ${CEP_GENERATOR_MAX_BATCH} por vez.`}
            maxLength={String(CEP_GENERATOR_MAX_BATCH).length}
            value={countText}
            onChange={(event) =>
              setCountText(event.target.value.replace(/\D/g, "").slice(0, String(CEP_GENERATOR_MAX_BATCH).length))
            }
            error={errors.count}
          />
          <SelectField
            id="cep-generator-format"
            label="Formato"
            value={formatted ? "formatted" : "digits"}
            onChange={(event) => setFormatted(event.target.value === "formatted")}
          >
            <option value="formatted">Com máscara (00000-000)</option>
            <option value="digits">Somente números (00000000)</option>
          </SelectField>
        </div>

        <Button type="submit" className="w-full sm:w-auto">
          Gerar CEP
        </Button>
      </form>

      {results && results.length > 0 ? (
        <div className="mt-8 space-y-4">
          {results.length === 1 ? (
            <>
              <ResultHighlight label="CEP gerado" value={results[0]} />
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button type="button" onClick={() => copyText(results[0], "single")}>
                  Copiar CEP
                </Button>
                <Button type="button" variant="secondary" onClick={runGeneration}>
                  Gerar novamente
                </Button>
                {copiedKey === "single" ? (
                  <span role="status" className="text-sm text-emerald-600">
                    CEP copiado!
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-zinc-200">
              <ul className="divide-y divide-zinc-100">
                {results.map((cep, index) => (
                  <li
                    key={`${cep}-${index}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <span className="font-mono text-sm text-zinc-900">{cep}</span>
                    <button
                      type="button"
                      onClick={() => copyText(cep, `row-${index}`)}
                      className="text-sm font-medium text-teal-700 hover:text-teal-900"
                    >
                      {copiedKey === `row-${index}` ? "Copiado!" : "Copiar"}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 p-4">
                <Button type="button" onClick={() => copyText(results.join("\n"), "all")}>
                  Copiar todos
                </Button>
                <Button type="button" variant="secondary" onClick={runGeneration}>
                  Gerar novamente
                </Button>
                {copiedKey === "all" ? (
                  <span role="status" className="text-sm text-emerald-600">
                    Todos os CEPs copiados!
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
