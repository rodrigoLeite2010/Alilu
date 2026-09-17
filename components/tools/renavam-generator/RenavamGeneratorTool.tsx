"use client";

import { useState, type FormEvent } from "react";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import {
  generateRenavamBatch,
  validateRenavamGeneratorInput,
  RENAVAM_GENERATOR_MAX_BATCH,
  type RenavamGeneratorFieldErrors,
  type RenavamGeneratorInput,
} from "@/lib/calculators/renavam-generator";

/**
 * Componente principal do Gerador de RENAVAM (categoria Geradores). Toda a
 * geração acontece 100% no navegador do usuário — nenhum valor gerado é
 * enviado para servidor algum, armazenado ou registrado em log.
 *
 * Os números gerados são SINTÉTICOS: a validade matemática do dígito
 * verificador não indica que exista um veículo real com esse RENAVAM. Esta
 * ferramenta não consulta o DETRAN nem qualquer cadastro de veículos.
 */
export function RenavamGeneratorTool() {
  const [countText, setCountText] = useState("1");
  const [formatted, setFormatted] = useState(true);
  const [errors, setErrors] = useState<RenavamGeneratorFieldErrors>({});
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
    const input: RenavamGeneratorInput = {
      count: Number(countText) || 0,
      formatted,
    };

    const nextErrors = validateRenavamGeneratorInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResults(null);
      return;
    }

    setResults(generateRenavamBatch(input));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runGeneration();
  }

  return (
    <div>
      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Os números gerados são sintéticos e destinados exclusivamente a
        testes. A validade matemática não indica que exista um veículo real
        com esse RENAVAM.
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberField
            id="renavam-generator-count"
            label="Quantidade"
            placeholder="1"
            hint={`Máximo de ${RENAVAM_GENERATOR_MAX_BATCH} por vez.`}
            maxLength={String(RENAVAM_GENERATOR_MAX_BATCH).length}
            value={countText}
            onChange={(event) =>
              setCountText(event.target.value.replace(/\D/g, "").slice(0, String(RENAVAM_GENERATOR_MAX_BATCH).length))
            }
            error={errors.count}
          />
          <SelectField
            id="renavam-generator-format"
            label="Formato"
            value={formatted ? "formatted" : "digits"}
            onChange={(event) => setFormatted(event.target.value === "formatted")}
          >
            <option value="formatted">Com hífen (0000000000-0)</option>
            <option value="digits">Somente números (00000000000)</option>
          </SelectField>
        </div>

        <Button type="submit" className="w-full sm:w-auto">
          Gerar RENAVAM
        </Button>
      </form>

      {results && results.length > 0 ? (
        <div className="mt-8 space-y-4">
          {results.length === 1 ? (
            <>
              <ResultHighlight label="RENAVAM gerado" value={results[0]} />
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={() => copyText(results[0], "single")}>
                  Copiar RENAVAM
                </Button>
                <Button type="button" variant="secondary" onClick={runGeneration}>
                  Gerar novamente
                </Button>
                {copiedKey === "single" ? (
                  <span role="status" className="text-sm text-emerald-600">
                    RENAVAM copiado!
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-zinc-200">
              <ul className="divide-y divide-zinc-100">
                {results.map((renavam, index) => (
                  <li
                    key={`${renavam}-${index}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <span className="font-mono text-sm text-zinc-900">{renavam}</span>
                    <button
                      type="button"
                      onClick={() => copyText(renavam, `row-${index}`)}
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
                    Todos os RENAVAM copiados!
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
