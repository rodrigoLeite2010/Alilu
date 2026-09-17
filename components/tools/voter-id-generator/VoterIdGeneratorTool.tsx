"use client";

import { useState, type FormEvent } from "react";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import {
  generateVoterIdBatch,
  validateVoterIdGeneratorInput,
  VOTER_ID_STATES,
  VOTER_ID_GENERATOR_MAX_BATCH,
  type VoterIdGeneratorFieldErrors,
  type VoterIdGeneratorInput,
} from "@/lib/calculators/voter-id-generator";

/**
 * Componente principal do Gerador de Título de Eleitor (categoria
 * Geradores). Toda a geração acontece 100% no navegador do usuário —
 * nenhum valor gerado é enviado para servidor algum, armazenado ou
 * registrado em log.
 *
 * Os números gerados são SINTÉTICOS: a validade matemática dos dígitos
 * verificadores não indica que exista um título real com esse número. Esta
 * ferramenta não consulta o TSE nem o cadastro de eleitores.
 */
export function VoterIdGeneratorTool() {
  const [countText, setCountText] = useState("1");
  const [state, setState] = useState("random");
  const [formatted, setFormatted] = useState(true);
  const [errors, setErrors] = useState<VoterIdGeneratorFieldErrors>({});
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
    const input: VoterIdGeneratorInput = {
      count: Number(countText) || 0,
      state,
      formatted,
    };

    const nextErrors = validateVoterIdGeneratorInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResults(null);
      return;
    }

    setResults(generateVoterIdBatch(input));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runGeneration();
  }

  return (
    <div>
      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Os números gerados são sintéticos e destinados exclusivamente a
        testes. A validade matemática não indica que exista um título de
        eleitor real com esse número.
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <NumberField
            id="voter-id-generator-count"
            label="Quantidade"
            placeholder="1"
            hint={`Máximo de ${VOTER_ID_GENERATOR_MAX_BATCH} por vez.`}
            maxLength={String(VOTER_ID_GENERATOR_MAX_BATCH).length}
            value={countText}
            onChange={(event) =>
              setCountText(event.target.value.replace(/\D/g, "").slice(0, String(VOTER_ID_GENERATOR_MAX_BATCH).length))
            }
            error={errors.count}
          />
          <SelectField
            id="voter-id-generator-state"
            label="Estado (UF)"
            value={state}
            onChange={(event) => setState(event.target.value)}
          >
            <option value="random">Sortear estado</option>
            {VOTER_ID_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.uf} — {s.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="voter-id-generator-format"
            label="Formato"
            value={formatted ? "formatted" : "digits"}
            onChange={(event) => setFormatted(event.target.value === "formatted")}
          >
            <option value="formatted">Com espaços (0000 0000 0000)</option>
            <option value="digits">Somente números (000000000000)</option>
          </SelectField>
        </div>

        <Button type="submit" className="w-full sm:w-auto">
          Gerar Título de Eleitor
        </Button>
      </form>

      {results && results.length > 0 ? (
        <div className="mt-8 space-y-4">
          {results.length === 1 ? (
            <>
              <ResultHighlight label="Título de Eleitor gerado" value={results[0]} />
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={() => copyText(results[0], "single")}>
                  Copiar título
                </Button>
                <Button type="button" variant="secondary" onClick={runGeneration}>
                  Gerar novamente
                </Button>
                {copiedKey === "single" ? (
                  <span role="status" className="text-sm text-emerald-600">
                    Título copiado!
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-zinc-200">
              <ul className="divide-y divide-zinc-100">
                {results.map((voterId, index) => (
                  <li
                    key={`${voterId}-${index}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <span className="font-mono text-sm text-zinc-900">{voterId}</span>
                    <button
                      type="button"
                      onClick={() => copyText(voterId, `row-${index}`)}
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
                    Todos os títulos copiados!
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
