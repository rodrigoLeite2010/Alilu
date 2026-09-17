"use client";

import { useState, type FormEvent } from "react";
import { NumberField } from "@/components/forms/NumberField";
import { Button } from "@/components/ui/Button";
import {
  drawNumbers,
  validateNumberDrawInput,
  NUMBER_DRAW_MAX_COUNT,
  type NumberDrawFieldErrors,
  type NumberDrawInput,
} from "@/lib/calculators/number-draw";

/**
 * Componente principal do Sorteador de Números (categoria Geradores). Toda
 * a geração acontece 100% no navegador do usuário, com
 * `crypto.getRandomValues` (ver lib/random/secure-random.ts).
 *
 * Focado em sorteios/rifas: por padrão, cada número sorteado aparece uma
 * única vez no resultado (sem repetição). Para geração geral de números
 * aleatórios com repetição, veja o Gerador de Números Aleatórios.
 */
export function NumberDrawTool() {
  const [minText, setMinText] = useState("1");
  const [maxText, setMaxText] = useState("60");
  const [countText, setCountText] = useState("6");
  const [allowRepeat, setAllowRepeat] = useState(false);
  const [errors, setErrors] = useState<NumberDrawFieldErrors>({});
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

  function runDraw() {
    const input: NumberDrawInput = {
      min: Number(minText),
      max: Number(maxText),
      count: Number(countText) || 0,
      allowRepeat,
    };

    const nextErrors = validateNumberDrawInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResults(null);
      return;
    }

    setResults(drawNumbers(input));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runDraw();
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <NumberField
            id="number-draw-min"
            label="Número mínimo"
            placeholder="1"
            value={minText}
            onChange={(event) => setMinText(event.target.value.replace(/[^-\d]/g, ""))}
            error={errors.min}
          />
          <NumberField
            id="number-draw-max"
            label="Número máximo"
            placeholder="60"
            value={maxText}
            onChange={(event) => setMaxText(event.target.value.replace(/[^-\d]/g, ""))}
            error={errors.max}
          />
          <NumberField
            id="number-draw-count"
            label="Quantidade a sortear"
            placeholder="6"
            hint={`Máximo de ${NUMBER_DRAW_MAX_COUNT} por vez.`}
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
          Permitir números repetidos no sorteio
        </label>

        <Button type="submit" className="w-full sm:w-auto">
          Sortear números
        </Button>
      </form>

      {results && results.length > 0 ? (
        <div className="mt-8 space-y-4">
          <div className="rounded-lg border border-teal-800/15 bg-teal-50 p-6">
            <p className="mb-4 text-center text-sm font-medium text-zinc-600">
              Resultado do sorteio
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {results.map((n, index) => (
                <span
                  key={`${n}-${index}`}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-teal-900 font-mono text-lg font-bold text-white shadow-sm"
                >
                  {n}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => copyText(results.join(", "))}>
              Copiar resultado
            </Button>
            <Button type="button" variant="secondary" onClick={runDraw}>
              Sortear novamente
            </Button>
            {copied ? (
              <span role="status" className="text-sm text-emerald-600">
                Resultado copiado!
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
