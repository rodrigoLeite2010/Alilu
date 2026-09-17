"use client";

import { useState, type FormEvent } from "react";
import { NumberField } from "@/components/forms/NumberField";
import { Button } from "@/components/ui/Button";
import {
  generateRandomNumbers,
  validateRandomNumberGeneratorInput,
  RANDOM_NUMBER_GENERATOR_MAX_COUNT,
  type RandomNumberGeneratorFieldErrors,
  type RandomNumberGeneratorInput,
} from "@/lib/calculators/random-number-generator";

/**
 * Componente principal do Gerador de Números Aleatórios (categoria
 * Geradores). Toda a geração acontece 100% no navegador do usuário, com
 * `crypto.getRandomValues` (ver lib/random/secure-random.ts).
 *
 * Focado em uso geral (testes, amostragem, sorteios simples): permite
 * repetição por padrão. Para sorteios/rifas com resultado sempre sem
 * repetição, veja o Sorteador de Números.
 */
export function RandomNumberGeneratorTool() {
  const [minText, setMinText] = useState("1");
  const [maxText, setMaxText] = useState("100");
  const [countText, setCountText] = useState("5");
  const [allowRepeat, setAllowRepeat] = useState(true);
  const [errors, setErrors] = useState<RandomNumberGeneratorFieldErrors>({});
  const [results, setResults] = useState<number[] | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function runGeneration() {
    const input: RandomNumberGeneratorInput = {
      min: Number(minText),
      max: Number(maxText),
      count: Number(countText) || 0,
      allowRepeat,
    };

    const nextErrors = validateRandomNumberGeneratorInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResults(null);
      return;
    }

    setResults(generateRandomNumbers(input));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runGeneration();
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <NumberField
            id="random-number-min"
            label="Número mínimo"
            placeholder="1"
            value={minText}
            onChange={(event) => setMinText(event.target.value.replace(/[^-\d]/g, ""))}
            error={errors.min}
          />
          <NumberField
            id="random-number-max"
            label="Número máximo"
            placeholder="100"
            value={maxText}
            onChange={(event) => setMaxText(event.target.value.replace(/[^-\d]/g, ""))}
            error={errors.max}
          />
          <NumberField
            id="random-number-count"
            label="Quantidade"
            placeholder="5"
            hint={`Máximo de ${RANDOM_NUMBER_GENERATOR_MAX_COUNT} por vez.`}
            value={countText}
            onChange={(event) => setCountText(event.target.value.replace(/\D/g, ""))}
            error={errors.count}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-zinc-300 text-teal-700 focus:ring-teal-700/40"
            checked={allowRepeat}
            onChange={(event) => setAllowRepeat(event.target.checked)}
          />
          Permitir números repetidos no resultado
        </label>

        <Button type="submit" className="w-full sm:w-auto">
          Gerar números
        </Button>
      </form>

      {results && results.length > 0 ? (
        <div className="mt-8 space-y-4">
          <div className="rounded-lg border border-teal-800/15 bg-teal-50 p-6">
            <p className="mb-3 text-sm font-medium text-zinc-600">Números gerados</p>
            <div className="flex flex-wrap gap-2">
              {results.map((n, index) => (
                <span
                  key={`${n}-${index}`}
                  className="inline-flex min-w-10 items-center justify-center rounded-md bg-white px-3 py-1.5 font-mono text-base font-semibold text-teal-900 ring-1 ring-inset ring-teal-800/15"
                >
                  {n}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => copyText(results.join(", "))}>
              Copiar números
            </Button>
            <Button type="button" variant="secondary" onClick={runGeneration}>
              Gerar novamente
            </Button>
            {copied ? (
              <span role="status" className="text-sm text-emerald-600">
                Números copiados!
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
