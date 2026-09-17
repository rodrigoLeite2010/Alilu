"use client";

import { useState, type FormEvent } from "react";
import { NumberField } from "@/components/forms/NumberField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import {
  generateCompanyBatch,
  validateCompanyGeneratorInput,
  COMPANY_GENERATOR_MAX_BATCH,
  type CompanyGeneratorFieldErrors,
  type CompanyGeneratorInput,
  type GeneratedCompany,
} from "@/lib/calculators/company-generator";

function formatCompanyText(company: GeneratedCompany): string {
  return [
    `Nome fantasia: ${company.fantasyName}`,
    `Razão social: ${company.legalName}`,
    `Segmento: ${company.segment}`,
    `CNPJ: ${company.cnpj}`,
    `Inscrição Estadual: ${company.stateTaxId.value} (${company.stateTaxId.uf})`,
    `CEP: ${company.cep}`,
    `Telefone: ${company.phone}`,
    `E-mail: ${company.email}`,
  ].join("\n");
}

const FIELD_ROWS: { label: string; value: (company: GeneratedCompany) => string }[] = [
  { label: "Razão social", value: (c) => c.legalName },
  { label: "Segmento", value: (c) => c.segment },
  { label: "CNPJ", value: (c) => c.cnpj },
  { label: "Inscrição Estadual", value: (c) => `${c.stateTaxId.value} (${c.stateTaxId.uf})` },
  { label: "CEP", value: (c) => c.cep },
  { label: "Telefone", value: (c) => c.phone },
  { label: "E-mail", value: (c) => c.email },
];

/**
 * Componente principal do Gerador de Empresas (categoria Geradores).
 * Combina os geradores de CNPJ, Inscrição Estadual e CEP já existentes com
 * nome fantasia, telefone e e-mail sintéticos. Toda a geração acontece
 * 100% no navegador — nenhum dado é enviado, armazenado ou registrado em
 * log.
 */
export function CompanyGeneratorTool() {
  const [countText, setCountText] = useState("1");
  const [errors, setErrors] = useState<CompanyGeneratorFieldErrors>({});
  const [results, setResults] = useState<GeneratedCompany[] | null>(null);
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
    const input: CompanyGeneratorInput = { count: Number(countText) || 0 };

    const nextErrors = validateCompanyGeneratorInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResults(null);
      return;
    }

    setResults(generateCompanyBatch(input));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runGeneration();
  }

  return (
    <div>
      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Perfis fictícios: nome fantasia, razão social, CNPJ, Inscrição
        Estadual, CEP, telefone e e-mail são sintéticos e combinados apenas
        para preencher formulários de teste. Não pertencem a nenhuma
        empresa real.
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <NumberField
          id="company-generator-count"
          label="Quantidade"
          placeholder="1"
          hint={`Máximo de ${COMPANY_GENERATOR_MAX_BATCH} por vez.`}
          maxLength={String(COMPANY_GENERATOR_MAX_BATCH).length}
          value={countText}
          onChange={(event) =>
            setCountText(event.target.value.replace(/\D/g, "").slice(0, String(COMPANY_GENERATOR_MAX_BATCH).length))
          }
          error={errors.count}
        />

        <Button type="submit" className="w-full sm:w-auto">
          Gerar empresa
        </Button>
      </form>

      {results && results.length > 0 ? (
        <div className="mt-8 space-y-4">
          {results.length === 1 ? (
            <>
              <ResultHighlight label="Empresa gerada" value={results[0].fantasyName} />
              <div className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border border-zinc-200 p-4 text-sm sm:grid-cols-2">
                {FIELD_ROWS.map((row) => (
                  <div key={row.label} className="flex justify-between gap-2">
                    <span className="text-zinc-500">{row.label}</span>
                    <span className="font-medium text-zinc-900">{row.value(results[0])}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button type="button" onClick={() => copyText(formatCompanyText(results[0]), "single")}>
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
            <div className="space-y-3">
              {results.map((company, index) => (
                <div key={`${company.cnpj}-${index}`} className="rounded-lg border border-zinc-200 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="font-semibold text-zinc-900">{company.fantasyName}</span>
                    <button
                      type="button"
                      onClick={() => copyText(formatCompanyText(company), `row-${index}`)}
                      className="text-sm font-medium text-teal-700 hover:text-teal-900"
                    >
                      {copiedKey === `row-${index}` ? "Copiado!" : "Copiar"}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    {FIELD_ROWS.map((row) => (
                      <div key={row.label} className="flex justify-between gap-2">
                        <span className="text-zinc-500">{row.label}</span>
                        <span className="text-zinc-900">{row.value(company)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={() =>
                    copyText(results.map((company) => formatCompanyText(company)).join("\n\n"), "all")
                  }
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
