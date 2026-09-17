"use client";

import { useState, type FormEvent } from "react";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import {
  generateCnhBatch,
  validateCnhGeneratorInput,
  CNH_GENERATOR_MAX_BATCH,
  type CnhGeneratorFieldErrors,
  type CnhGeneratorInput,
} from "@/lib/calculators/cnh-generator";

/**
 * Componente principal do Gerador de CNH (categoria Geradores). Toda a
 * geração acontece 100% no navegador do usuário — nenhum valor gerado é
 * enviado para servidor algum, armazenado ou registrado em log.
 *
 * Os números gerados são SINTÉTICOS: a validade matemática dos dígitos
 * verificadores não indica que exista uma CNH real com esse número. Esta
 * ferramenta não consulta o DENATRAN nem o RENACH.
 */
export function CnhGeneratorTool() {
  const [countText, setCountText] = useState("1");
  const [formatted, setFormatted] = useState(true);
  const [errors, setErrors] = useState<CnhGeneratorFieldErrors>({});
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
    const input: CnhGeneratorInput = {
      count: Number(countText) || 0,
      formatted,
    };

    const nextErrors = validateCnhGeneratorInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResults(null);
      return;
    }

    setResults(generateCnhBatch(input));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runGeneration();
  }

  return (
    <div>
      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Os números gerados são sintéticos e destinados exclusivamente a
        testes. A validade matemática não indica que exista uma CNH real
        com esse número.
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberField
            id="cnh-generator-count"
            label="Quantidade"
            placeholder="1"
            hint={`Máximo de ${CNH_GENERATOR_MAX_BATCH} por vez.`}
            maxLength={String(CNH_GENERATOR_MAX_BATCH).length}
            value={countText}
            onChange={(event) =>
              setCountText(event.target.value.replace(/\D/g, "").slice(0, String(CNH_GENERATOR_MAX_BATCH).length))
            }
            error={errors.count}
          />
          <SelectField
            id="cnh-generator-format"
            label="Formato"
            value={formatted ? "formatted" : "digits"}
            onChange={(event) => setFormatted(event.target.value === "formatted")}
          >
            <option value="formatted">Com hífen (000000000-00)</option>
            <option value="digits">Somente números (00000000000)</option>
          </SelectField>
        </div>

        <Button type="submit" className="w-full sm:w-auto">
          Gerar CNH
        </Button>
      </form>

      {results && results.length > 0 ? (
        <div className="mt-8 space-y-4">
          {results.length === 1 ? (
            <>
              <ResultHighlight label="CNH gerada" value={results[0]} />
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={() => copyText(results[0], "single")}>
                  Copiar CNH
                </Button>
                <Button type="button" variant="secondary" onClick={runGeneration}>
                  Gerar novamente
                </Button>
                {copiedKey === "single" ? (
                  <span role="status" className="text-sm text-emerald-600">
                    CNH copiada!
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-zinc-200">
              <ul className="divide-y divide-zinc-100">
                {results.map((cnh, index) => (
                  <li
                    key={`${cnh}-${index}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <span className="font-mono text-sm text-zinc-900">{cnh}</span>
                    <button
                      type="button"
                      onClick={() => copyText(cnh, `row-${index}`)}
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
                    Todas as CNH copiadas!
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
