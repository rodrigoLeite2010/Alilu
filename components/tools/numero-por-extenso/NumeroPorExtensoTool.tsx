"use client";

import { useMemo, useState } from "react";
import { TextField } from "@/components/forms/TextField";
import { integerToWords, moneyToWordsBRL } from "@/lib/formatters/money-words";
import { parseLocaleNumberBRL } from "@/lib/validators/number";

type Mode = "plain" | "money";

/**
 * Limite seguro para a conversão por extenso: bem dentro da faixa de
 * escalas nomeadas por lib/formatters/money-words.ts (até "quatrilhão") e
 * também dentro de Number.MAX_SAFE_INTEGER, para nunca produzir um
 * resultado com erro de arredondamento de ponto flutuante.
 */
const NUMERO_POR_EXTENSO_MAX = 999_999_999_999_999;

/**
 * Número por Extenso (categoria Funções String). Reaproveita o mesmo
 * conversor já usado pelo Gerador de Recibo (lib/formatters/money-words.ts):
 * `integerToWords` para números simples e `moneyToWordsBRL` para o modo
 * monetário (reais e centavos).
 */
export function NumeroPorExtensoTool() {
  const [rawValue, setRawValue] = useState("");
  const [mode, setMode] = useState<Mode>("plain");

  const parsed = parseLocaleNumberBRL(rawValue);

  const { text, error } = useMemo(() => {
    if (rawValue.trim() === "") {
      return { text: "", error: undefined as string | undefined };
    }
    if (parsed === null || parsed < 0) {
      return { text: "", error: "Digite um número válido e não negativo." };
    }
    if (parsed > NUMERO_POR_EXTENSO_MAX) {
      return {
        text: "",
        error: `Este conversor aceita valores até ${NUMERO_POR_EXTENSO_MAX.toLocaleString("pt-BR")}.`,
      };
    }
    try {
      if (mode === "money") {
        return { text: moneyToWordsBRL(parsed), error: undefined };
      }
      return { text: integerToWords(Math.trunc(parsed)), error: undefined };
    } catch {
      return { text: "", error: "Não foi possível converter este valor." };
    }
  }, [rawValue, parsed, mode]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="radio"
            name="numero-por-extenso-mode"
            checked={mode === "plain"}
            onChange={() => setMode("plain")}
          />
          Número (ex.: 123 → cento e vinte e três)
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="radio"
            name="numero-por-extenso-mode"
            checked={mode === "money"}
            onChange={() => setMode("money")}
          />
          Valor em reais (ex.: 123,45 → cento e vinte e três reais e quarenta e cinco centavos)
        </label>
      </div>

      <TextField
        id="numero-por-extenso-input"
        label={mode === "money" ? "Valor em reais" : "Número"}
        inputMode="decimal"
        placeholder={mode === "money" ? "0,00" : "0"}
        value={rawValue}
        onChange={(event) => setRawValue(event.target.value)}
        error={error}
        hint={
          mode === "plain"
            ? `Aceita números inteiros até ${NUMERO_POR_EXTENSO_MAX.toLocaleString("pt-BR")} (a parte decimal, se houver, é ignorada neste modo).`
            : `Aceita valores até ${NUMERO_POR_EXTENSO_MAX.toLocaleString("pt-BR")}.`
        }
      />

      {text ? (
        <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-lg text-zinc-900">{text}</p>
        </div>
      ) : null}
    </div>
  );
}
