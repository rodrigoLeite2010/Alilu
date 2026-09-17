"use client";

import { useState, type FormEvent } from "react";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import {
  generateLicensePlateBatch,
  validateLicensePlateGeneratorInput,
  LICENSE_PLATE_GENERATOR_MAX_BATCH,
  type LicensePlateFormat,
  type LicensePlateGeneratorFieldErrors,
  type LicensePlateGeneratorInput,
} from "@/lib/calculators/license-plate-generator";

/**
 * Componente principal do Gerador de Placa de Veículos (categoria
 * Geradores). Toda a geração acontece 100% no navegador do usuário —
 * nenhum valor gerado é enviado para servidor algum, armazenado ou
 * registrado em log.
 *
 * As placas geradas são combinações aleatórias de letras e números dentro
 * do formato oficial (Mercosul ou antigo) — não indicam a existência de
 * nenhum veículo real. Esta ferramenta não consulta o DETRAN.
 */
export function LicensePlateGeneratorTool() {
  const [countText, setCountText] = useState("1");
  const [format, setFormat] = useState<LicensePlateFormat>("mercosul");
  const [errors, setErrors] = useState<LicensePlateGeneratorFieldErrors>({});
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
    const input: LicensePlateGeneratorInput = {
      count: Number(countText) || 0,
      format,
    };

    const nextErrors = validateLicensePlateGeneratorInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResults(null);
      return;
    }

    setResults(generateLicensePlateBatch(input));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runGeneration();
  }

  return (
    <div>
      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        As placas geradas são fictícias e destinadas exclusivamente a
        testes. Não indicam a existência de nenhum veículo real.
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberField
            id="license-plate-generator-count"
            label="Quantidade"
            placeholder="1"
            hint={`Máximo de ${LICENSE_PLATE_GENERATOR_MAX_BATCH} por vez.`}
            maxLength={String(LICENSE_PLATE_GENERATOR_MAX_BATCH).length}
            value={countText}
            onChange={(event) =>
              setCountText(event.target.value.replace(/\D/g, "").slice(0, String(LICENSE_PLATE_GENERATOR_MAX_BATCH).length))
            }
            error={errors.count}
          />
          <SelectField
            id="license-plate-generator-format"
            label="Formato da placa"
            value={format}
            onChange={(event) => setFormat(event.target.value as LicensePlateFormat)}
          >
            <option value="mercosul">Mercosul (ABC1D23)</option>
            <option value="antiga">Antigo (ABC-1234)</option>
          </SelectField>
        </div>

        <Button type="submit" className="w-full sm:w-auto">
          Gerar placa
        </Button>
      </form>

      {results && results.length > 0 ? (
        <div className="mt-8 space-y-4">
          {results.length === 1 ? (
            <>
              <ResultHighlight label="Placa gerada" value={results[0]} />
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={() => copyText(results[0], "single")}>
                  Copiar placa
                </Button>
                <Button type="button" variant="secondary" onClick={runGeneration}>
                  Gerar novamente
                </Button>
                {copiedKey === "single" ? (
                  <span role="status" className="text-sm text-emerald-600">
                    Placa copiada!
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-zinc-200">
              <ul className="divide-y divide-zinc-100">
                {results.map((plate, index) => (
                  <li
                    key={`${plate}-${index}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <span className="font-mono text-sm text-zinc-900">{plate}</span>
                    <button
                      type="button"
                      onClick={() => copyText(plate, `row-${index}`)}
                      className="text-sm font-medium text-teal-700 hover:text-teal-900"
                    >
                      {copiedKey === `row-${index}` ? "Copiado!" : "Copiar"}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 p-4">
                <Button type="button" onClick={() => copyText(results.join("\n"), "all")}>
                  Copiar todas
                </Button>
                <Button type="button" variant="secondary" onClick={runGeneration}>
                  Gerar novamente
                </Button>
                {copiedKey === "all" ? (
                  <span role="status" className="text-sm text-emerald-600">
                    Todas as placas copiadas!
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
