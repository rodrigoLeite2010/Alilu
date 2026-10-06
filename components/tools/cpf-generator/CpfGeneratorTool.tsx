"use client";

import { useState, type FormEvent } from "react";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import { CopyFeedbackMessage, GenerateAndCopyButton } from "@/components/tools/generator-shared/GenerateAndCopyButton";
import { useGenerateAndCopy } from "@/components/tools/generator-shared/useGenerateAndCopy";
import {
  generateCpfBatch,
  validateCpfGeneratorInput,
  CPF_GENERATOR_MAX_BATCH,
  type CpfGeneratorFieldErrors,
  type CpfGeneratorInput,
} from "@/lib/calculators/cpf-generator";

const COPY_FAILED_AUTO = "Gerado, mas não foi possível copiar automaticamente. Use o botão Copiar.";
const COPY_FAILED_MANUAL = "Não foi possível copiar. Selecione o número e copie manualmente.";

/**
 * Componente principal do Gerador de CPF (ETAPA 3 da categoria Geradores,
 * ex-"Devs"). Toda
 * a geração acontece 100% no navegador do usuário — nenhum valor gerado é
 * enviado para servidor algum, armazenado ou registrado em log.
 *
 * Fluxo principal: GERAR + COPIAR em um clique. O valor é gerado numa variável
 * local, mostrado e copiado exatamente como aparece na tela (com ou sem
 * pontuação, conforme o formato escolhido) — nunca se copia o `results` do
 * state, que ainda teria o valor anterior.
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
  const { feedback, copy, clear } = useGenerateAndCopy();

  function copyManual(text: string, key: string, successMessage: string) {
    void copy(text, { key, successMessage, failureMessage: COPY_FAILED_MANUAL });
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
      clear();
      return;
    }

    const generated = generateCpfBatch(input);
    setResults(generated);
    void copy(generated.join("\n"), {
      key: "generate",
      successMessage: generated.length === 1 ? "Gerado e copiado!" : `${generated.length} CPFs gerados e copiados!`,
      failureMessage: COPY_FAILED_AUTO,
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runGeneration();
  }

  const justGenerated = feedback?.key === "generate" && feedback.ok;

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

        <div>
          <GenerateAndCopyButton label="Gerar e copiar CPF" copied={justGenerated} />
          <p className="mt-2 text-xs text-zinc-500">Gera e copia automaticamente.</p>
          <CopyFeedbackMessage feedback={feedback} className="mt-1" />
        </div>
      </form>

      {results && results.length > 0 ? (
        <div className="mt-6 space-y-4">
          {results.length === 1 ? (
            <>
              <ResultHighlight label="CPF gerado" value={results[0]} />
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => copyManual(results[0], "single", "CPF copiado!")}
                >
                  Copiar CPF
                </Button>
                <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={runGeneration}>
                  Gerar e copiar novamente
                </Button>
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
                      onClick={() => copyManual(cpf, `row-${index}`, "CPF copiado!")}
                      className="min-h-9 px-2 text-sm font-medium text-teal-700 hover:text-teal-900"
                    >
                      {feedback?.key === `row-${index}` && feedback.ok ? "Copiado!" : "Copiar"}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-3 border-t border-zinc-200 p-4 sm:flex-row sm:flex-wrap sm:items-center">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => copyManual(results.join("\n"), "all", "Todos os CPFs copiados!")}
                >
                  Copiar todos
                </Button>
                <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={runGeneration}>
                  Gerar e copiar novamente
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
