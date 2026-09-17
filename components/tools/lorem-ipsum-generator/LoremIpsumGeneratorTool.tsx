"use client";

import { useState, type FormEvent } from "react";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import {
  generateLoremIpsum,
  validateLoremIpsumGeneratorInput,
  LOREM_IPSUM_MAX_COUNT,
  type LoremIpsumGeneratorFieldErrors,
  type LoremIpsumGeneratorInput,
  type LoremIpsumUnit,
} from "@/lib/calculators/lorem-ipsum-generator";

/**
 * Componente principal do Gerador de Lorem Ipsum (categoria Geradores).
 * Toda a geração acontece 100% no navegador do usuário — nenhum texto
 * gerado é enviado, armazenado ou registrado em log.
 */
export function LoremIpsumGeneratorTool() {
  const [countText, setCountText] = useState("3");
  const [unit, setUnit] = useState<LoremIpsumUnit>("paragrafos");
  const [startWithLorem, setStartWithLorem] = useState(true);
  const [errors, setErrors] = useState<LoremIpsumGeneratorFieldErrors>({});
  const [result, setResult] = useState<string | null>(null);
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
    const input: LoremIpsumGeneratorInput = {
      unit,
      count: Number(countText) || 0,
      startWithLorem,
    };

    const nextErrors = validateLoremIpsumGeneratorInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }

    setResult(generateLoremIpsum(input));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runGeneration();
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <SelectField
            id="lorem-ipsum-generator-unit"
            label="Unidade"
            value={unit}
            onChange={(event) => setUnit(event.target.value as LoremIpsumUnit)}
          >
            <option value="palavras">Palavras</option>
            <option value="frases">Frases</option>
            <option value="paragrafos">Parágrafos</option>
          </SelectField>
          <NumberField
            id="lorem-ipsum-generator-count"
            label="Quantidade"
            placeholder="3"
            hint={`Máximo de ${LOREM_IPSUM_MAX_COUNT}.`}
            maxLength={String(LOREM_IPSUM_MAX_COUNT).length}
            value={countText}
            onChange={(event) =>
              setCountText(event.target.value.replace(/\D/g, "").slice(0, String(LOREM_IPSUM_MAX_COUNT).length))
            }
            error={errors.count}
          />
          <SelectField
            id="lorem-ipsum-generator-start"
            label="Começar com 'Lorem ipsum...'"
            value={startWithLorem ? "sim" : "nao"}
            onChange={(event) => setStartWithLorem(event.target.value === "sim")}
          >
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </SelectField>
        </div>

        <Button type="submit" className="w-full sm:w-auto">
          Gerar texto
        </Button>
      </form>

      {result ? (
        <div className="mt-8 space-y-4">
          <div className="whitespace-pre-line rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-sm leading-relaxed text-zinc-800">
            {result}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => copyText(result)}>
              Copiar texto
            </Button>
            <Button type="button" variant="secondary" onClick={runGeneration}>
              Gerar novamente
            </Button>
            {copied ? (
              <span role="status" className="text-sm text-emerald-600">
                Texto copiado!
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
