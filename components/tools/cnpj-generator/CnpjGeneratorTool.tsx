"use client";

import { useState, type FormEvent } from "react";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import { CopyFeedbackMessage, GenerateAndCopyButton } from "@/components/tools/generator-shared/GenerateAndCopyButton";
import { useGenerateAndCopy } from "@/components/tools/generator-shared/useGenerateAndCopy";
import {
  generateCnpjBatch,
  validateCnpjGeneratorInput,
  CNPJ_GENERATOR_MAX_BATCH,
  type CnpjGeneratorFieldErrors,
  type CnpjGeneratorFormat,
  type CnpjGeneratorInput,
} from "@/lib/calculators/cnpj-generator";

const COPY_FAILED_AUTO = "Gerado, mas não foi possível copiar automaticamente. Use o botão Copiar.";
const COPY_FAILED_MANUAL = "Não foi possível copiar. Selecione o número e copie manualmente.";

/**
 * Componente principal do Gerador de CNPJ (ETAPA 4 da categoria Geradores). Toda
 * a geração acontece 100% no navegador do usuário — nenhum valor gerado é
 * enviado para servidor algum, armazenado ou registrado em log.
 *
 * Fluxo principal: GERAR + COPIAR em um clique. O valor é gerado numa variável
 * local, mostrado e copiado exatamente como aparece na tela (com ou sem
 * pontuação, conforme o formato escolhido) — nunca se copia o `results` do
 * state, que ainda teria o valor anterior.
 *
 * Suporta o CNPJ numérico tradicional e o novo CNPJ alfanumérico da
 * Receita Federal. Os números gerados são SINTÉTICOS: a validade
 * matemática dos dígitos verificadores não comprova cadastro ou
 * existência de empresa alguma. Esta ferramenta não consulta cadastros
 * empresariais.
 */
export function CnpjGeneratorTool() {
  const [countText, setCountText] = useState("1");
  const [format, setFormat] = useState<CnpjGeneratorFormat>("numeric");
  const [formatted, setFormatted] = useState(true);
  const [errors, setErrors] = useState<CnpjGeneratorFieldErrors>({});
  const [results, setResults] = useState<string[] | null>(null);
  const { feedback, copy, clear } = useGenerateAndCopy();

  function copyManual(text: string, key: string, successMessage: string) {
    void copy(text, { key, successMessage, failureMessage: COPY_FAILED_MANUAL });
  }

  function runGeneration() {
    const input: CnpjGeneratorInput = {
      count: Number(countText) || 0,
      format,
      formatted,
    };

    const nextErrors = validateCnpjGeneratorInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResults(null);
      clear();
      return;
    }

    const generated = generateCnpjBatch(input);
    setResults(generated);
    void copy(generated.join("\n"), {
      key: "generate",
      successMessage: generated.length === 1 ? "Gerado e copiado!" : `${generated.length} CNPJs gerados e copiados!`,
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
        CNPJ gerado apenas para testes. A validade matemática não comprova
        cadastro ou existência de empresa.
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <NumberField
            id="cnpj-generator-count"
            label="Quantidade"
            placeholder="1"
            hint={`Máximo de ${CNPJ_GENERATOR_MAX_BATCH} por vez.`}
            maxLength={String(CNPJ_GENERATOR_MAX_BATCH).length}
            value={countText}
            onChange={(event) =>
              setCountText(event.target.value.replace(/\D/g, "").slice(0, String(CNPJ_GENERATOR_MAX_BATCH).length))
            }
            error={errors.count}
          />
          <SelectField
            id="cnpj-generator-type"
            label="Tipo de CNPJ"
            value={format}
            onChange={(event) => setFormat(event.target.value as CnpjGeneratorFormat)}
          >
            <option value="numeric">Numérico (tradicional)</option>
            <option value="alphanumeric">Alfanumérico (novo formato)</option>
          </SelectField>
          <SelectField
            id="cnpj-generator-format"
            label="Formato"
            value={formatted ? "formatted" : "digits"}
            onChange={(event) => setFormatted(event.target.value === "formatted")}
          >
            <option value="formatted">Com pontuação</option>
            <option value="digits">Somente caracteres</option>
          </SelectField>
        </div>

        <div>
          <GenerateAndCopyButton label="Gerar e copiar CNPJ" copied={justGenerated} />
          <p className="mt-2 text-xs text-zinc-500">Gera e copia automaticamente.</p>
          <CopyFeedbackMessage feedback={feedback} className="mt-1" />
        </div>
      </form>

      {results && results.length > 0 ? (
        <div className="mt-6 space-y-4">
          {results.length === 1 ? (
            <>
              <ResultHighlight label="CNPJ gerado" value={results[0]} />
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => copyManual(results[0], "single", "CNPJ copiado!")}
                >
                  Copiar CNPJ
                </Button>
                <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={runGeneration}>
                  Gerar e copiar novamente
                </Button>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-zinc-200">
              <ul className="divide-y divide-zinc-100">
                {results.map((cnpj, index) => (
                  <li
                    key={`${cnpj}-${index}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <span className="font-mono text-sm text-zinc-900">{cnpj}</span>
                    <button
                      type="button"
                      onClick={() => copyManual(cnpj, `row-${index}`, "CNPJ copiado!")}
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
                  onClick={() => copyManual(results.join("\n"), "all", "Todos os CNPJs copiados!")}
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
