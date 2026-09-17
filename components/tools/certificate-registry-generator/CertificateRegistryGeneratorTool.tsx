"use client";

import { useState, type FormEvent } from "react";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import {
  generateCertificateRegistryBatch,
  validateCertificateRegistryGeneratorInput,
  CERTIFICATE_REGISTRY_GENERATOR_MAX_BATCH,
  CERTIFICATE_REGISTRY_TYPE_LABELS,
  type CertificateRegistryGeneratorFieldErrors,
  type CertificateRegistryGeneratorInput,
  type CertificateRegistryType,
  type GeneratedCertificateRegistry,
} from "@/lib/calculators/certificate-registry-generator";

/**
 * Componente principal do Gerador de Certidões (categoria Geradores). Toda
 * a geração acontece 100% no navegador do usuário — nenhum número gerado
 * é enviado, armazenado ou registrado em log.
 *
 * Esta ferramenta gera apenas um NÚMERO de matrícula sintético (32
 * dígitos, formato genérico) — nunca uma imagem ou documento de certidão,
 * e não consulta a Central Nacional de Informações do Registro Civil nem
 * nenhum cartório real. Ver limitação detalhada em
 * lib/calculators/certificate-registry-generator.ts.
 */
export function CertificateRegistryGeneratorTool() {
  const [countText, setCountText] = useState("1");
  const [type, setType] = useState<CertificateRegistryType>("nascimento");
  const [errors, setErrors] = useState<CertificateRegistryGeneratorFieldErrors>({});
  const [results, setResults] = useState<GeneratedCertificateRegistry[] | null>(null);
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
    const input: CertificateRegistryGeneratorInput = {
      count: Number(countText) || 0,
      type,
    };

    const nextErrors = validateCertificateRegistryGeneratorInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResults(null);
      return;
    }

    setResults(generateCertificateRegistryBatch(input));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runGeneration();
  }

  return (
    <div>
      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Esta ferramenta gera apenas um NÚMERO de matrícula sintético (32
        dígitos), nunca uma imagem ou documento de certidão. Não representa
        um registro real e não consulta nenhum cartório ou a Central
        Nacional de Informações do Registro Civil. O agrupamento em blocos é
        só para leitura — não reproduz a divisão oficial exata do CNJ.
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SelectField
            id="certificate-registry-generator-type"
            label="Tipo de certidão"
            value={type}
            onChange={(event) => setType(event.target.value as CertificateRegistryType)}
          >
            {(Object.keys(CERTIFICATE_REGISTRY_TYPE_LABELS) as CertificateRegistryType[]).map((key) => (
              <option key={key} value={key}>
                {CERTIFICATE_REGISTRY_TYPE_LABELS[key]}
              </option>
            ))}
          </SelectField>
          <NumberField
            id="certificate-registry-generator-count"
            label="Quantidade"
            placeholder="1"
            hint={`Máximo de ${CERTIFICATE_REGISTRY_GENERATOR_MAX_BATCH} por vez.`}
            maxLength={String(CERTIFICATE_REGISTRY_GENERATOR_MAX_BATCH).length}
            value={countText}
            onChange={(event) =>
              setCountText(
                event.target.value
                  .replace(/\D/g, "")
                  .slice(0, String(CERTIFICATE_REGISTRY_GENERATOR_MAX_BATCH).length)
              )
            }
            error={errors.count}
          />
        </div>

        <Button type="submit" className="w-full sm:w-auto">
          Gerar número de matrícula
        </Button>
      </form>

      {results && results.length > 0 ? (
        <div className="mt-8 space-y-4">
          {results.length === 1 ? (
            <>
              <ResultHighlight
                label={`Matrícula gerada (${CERTIFICATE_REGISTRY_TYPE_LABELS[results[0].type]})`}
                value={results[0].formatted}
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
                    <span className="font-mono text-sm text-zinc-900">{entry.formatted}</span>
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
                  onClick={() => copyText(results.map((entry) => entry.value).join("\n"), "all")}
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
