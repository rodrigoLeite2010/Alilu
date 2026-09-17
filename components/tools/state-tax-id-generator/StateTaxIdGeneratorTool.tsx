"use client";

import { useState, type FormEvent } from "react";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import {
  generateStateTaxIdBatch,
  validateStateTaxIdGeneratorInput,
  STATE_TAX_ID_GENERATOR_MAX_BATCH,
  type GeneratedStateTaxId,
  type StateTaxIdGeneratorFieldErrors,
  type StateTaxIdGeneratorInput,
} from "@/lib/calculators/state-tax-id-generator";
import { BRAZILIAN_STATES } from "@/lib/data/brazilian-states";

function formatEntry(entry: GeneratedStateTaxId): string {
  return `${entry.value} (${entry.uf})`;
}

/**
 * Componente principal do Gerador de Inscrição Estadual (categoria
 * Geradores). Toda a geração acontece 100% no navegador do usuário —
 * nenhum número gerado é enviado, armazenado ou registrado em log.
 *
 * LIMITAÇÃO CONHECIDA: cada UF tem seu próprio algoritmo de dígito
 * verificador. Esta ferramenta entrega a estrutura escalável pedida —
 * seletor de UF + geração genérica de 9 dígitos — sem aplicar o algoritmo
 * específico de nenhum estado (ver lib/calculators/state-tax-id-generator.ts).
 */
export function StateTaxIdGeneratorTool() {
  const [countText, setCountText] = useState("1");
  const [uf, setUf] = useState("random");
  const [errors, setErrors] = useState<StateTaxIdGeneratorFieldErrors>({});
  const [results, setResults] = useState<GeneratedStateTaxId[] | null>(null);
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
    const input: StateTaxIdGeneratorInput = {
      count: Number(countText) || 0,
      uf,
    };

    const nextErrors = validateStateTaxIdGeneratorInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResults(null);
      return;
    }

    setResults(generateStateTaxIdBatch(input));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runGeneration();
  }

  return (
    <div>
      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Cada estado brasileiro define seu próprio formato e algoritmo de
        Inscrição Estadual. Esta ferramenta gera um número genérico de 9
        dígitos (sem o dígito verificador oficial de nenhuma UF
        específica), útil para testar campos de formulário que aceitam o
        valor como texto livre — não representa um cadastro real.
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SelectField
            id="state-tax-id-generator-uf"
            label="Estado (UF)"
            value={uf}
            onChange={(event) => setUf(event.target.value)}
          >
            <option value="random">Sortear estado</option>
            {BRAZILIAN_STATES.map((state) => (
              <option key={state.uf} value={state.uf}>
                {state.name} ({state.uf})
              </option>
            ))}
          </SelectField>
          <NumberField
            id="state-tax-id-generator-count"
            label="Quantidade"
            placeholder="1"
            hint={`Máximo de ${STATE_TAX_ID_GENERATOR_MAX_BATCH} por vez.`}
            maxLength={String(STATE_TAX_ID_GENERATOR_MAX_BATCH).length}
            value={countText}
            onChange={(event) =>
              setCountText(
                event.target.value.replace(/\D/g, "").slice(0, String(STATE_TAX_ID_GENERATOR_MAX_BATCH).length)
              )
            }
            error={errors.count}
          />
        </div>

        <Button type="submit" className="w-full sm:w-auto">
          Gerar Inscrição Estadual
        </Button>
      </form>

      {results && results.length > 0 ? (
        <div className="mt-8 space-y-4">
          {results.length === 1 ? (
            <>
              <ResultHighlight
                label={`Inscrição Estadual gerada (${results[0].uf})`}
                value={results[0].value}
              />
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button type="button" onClick={() => copyText(results[0].value, "single")}>
                  Copiar número
                </Button>
                <Button type="button" variant="secondary" onClick={runGeneration}>
                  Gerar novamente
                </Button>
                {copiedKey === "single" ? (
                  <span role="status" className="text-sm text-emerald-600">
                    Número copiado!
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-zinc-200">
              <ul className="divide-y divide-zinc-100">
                {results.map((entry, index) => (
                  <li
                    key={`${entry.value}-${index}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <span className="font-mono text-sm text-zinc-900">
                      {entry.value}
                      <span className="ml-2 text-xs font-sans text-zinc-500">{entry.uf}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => copyText(entry.value, `row-${index}`)}
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
                  onClick={() => copyText(results.map((entry) => formatEntry(entry)).join("\n"), "all")}
                >
                  Copiar todos
                </Button>
                <Button type="button" variant="secondary" onClick={runGeneration}>
                  Gerar novamente
                </Button>
                {copiedKey === "all" ? (
                  <span role="status" className="text-sm text-emerald-600">
                    Todos os números copiados!
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
