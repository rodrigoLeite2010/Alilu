"use client";

import { useState, type FormEvent } from "react";
import { NumberField } from "@/components/forms/NumberField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import {
  generatePassword,
  estimatePasswordStrength,
  validatePasswordGeneratorInput,
  PASSWORD_STRENGTH_LABELS,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  type PasswordGeneratorFieldErrors,
  type PasswordGeneratorInput,
  type PasswordStrength,
} from "@/lib/calculators/password-generator";

const STRENGTH_BAR_CLASSES: Record<PasswordStrength, string> = {
  fraca: "w-1/4 bg-red-500",
  media: "w-2/4 bg-amber-500",
  forte: "w-3/4 bg-teal-600",
  "muito-forte": "w-full bg-emerald-600",
};

/**
 * Componente principal do Gerador de Senha (categoria Geradores). Toda a
 * geração acontece 100% no navegador do usuário, com `crypto.getRandomValues`
 * (ver lib/random/secure-random.ts) — nenhuma senha gerada é enviada,
 * armazenada ou registrada em log.
 */
export function PasswordGeneratorTool() {
  const [lengthText, setLengthText] = useState("16");
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [errors, setErrors] = useState<PasswordGeneratorFieldErrors>({});
  const [password, setPassword] = useState<string | null>(null);
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

  function currentInput(): PasswordGeneratorInput {
    return {
      length: Number(lengthText) || 0,
      includeUppercase,
      includeLowercase,
      includeNumbers,
      includeSymbols,
    };
  }

  function runGeneration() {
    const input = currentInput();
    const nextErrors = validatePasswordGeneratorInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setPassword(null);
      return;
    }

    setPassword(generatePassword(input));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runGeneration();
  }

  const { strength } = estimatePasswordStrength(currentInput());

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <NumberField
          id="password-generator-length"
          label="Tamanho da senha"
          placeholder="16"
          hint={`Entre ${PASSWORD_MIN_LENGTH} e ${PASSWORD_MAX_LENGTH} caracteres.`}
          maxLength={2}
          value={lengthText}
          onChange={(event) => setLengthText(event.target.value.replace(/\D/g, "").slice(0, 2))}
          error={errors.length}
        />

        <fieldset className="space-y-3">
          <legend className="mb-1 text-sm font-medium text-zinc-700">
            Tipos de caractere
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-300 text-teal-700 focus:ring-teal-700/40"
                checked={includeUppercase}
                onChange={(event) => setIncludeUppercase(event.target.checked)}
              />
              Letras maiúsculas (A-Z)
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-300 text-teal-700 focus:ring-teal-700/40"
                checked={includeLowercase}
                onChange={(event) => setIncludeLowercase(event.target.checked)}
              />
              Letras minúsculas (a-z)
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-300 text-teal-700 focus:ring-teal-700/40"
                checked={includeNumbers}
                onChange={(event) => setIncludeNumbers(event.target.checked)}
              />
              Números (0-9)
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-300 text-teal-700 focus:ring-teal-700/40"
                checked={includeSymbols}
                onChange={(event) => setIncludeSymbols(event.target.checked)}
              />
              Símbolos (!@#$%...)
            </label>
          </div>
          {errors.charset ? (
            <p role="alert" className="text-sm text-red-600">
              {errors.charset}
            </p>
          ) : null}
        </fieldset>

        <Button type="submit" className="w-full sm:w-auto">
          Gerar senha
        </Button>
      </form>

      {password ? (
        <div className="mt-8 space-y-4">
          <ResultHighlight
            label="Senha gerada"
            value={<span className="font-mono">{password}</span>}
          />

          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-600">Força estimada</span>
              <span className="font-medium text-zinc-900">
                {PASSWORD_STRENGTH_LABELS[strength]}
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-200">
              <div
                className={`h-full rounded-full transition-all ${STRENGTH_BAR_CLASSES[strength]}`}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => copyText(password)}>
              Copiar senha
            </Button>
            <Button type="button" variant="secondary" onClick={runGeneration}>
              Gerar novamente
            </Button>
            {copied ? (
              <span role="status" className="text-sm text-emerald-600">
                Senha copiada!
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
