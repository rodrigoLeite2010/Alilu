"use client";

import { useState, type FormEvent } from "react";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import {
  generateCardBatch,
  validateCreditCardGeneratorInput,
  CARD_BRAND_LABELS,
  CREDIT_CARD_GENERATOR_MAX_BATCH,
  type CardBrand,
  type CreditCardGeneratorFieldErrors,
  type CreditCardGeneratorInput,
  type CreditCardGeneratorMode,
  type GeneratedCard,
} from "@/lib/calculators/credit-card-generator";

/**
 * Componente principal do Gerador de Cartão de Crédito de Teste (ETAPA 5 da
 * categoria Geradores, ex-"Devs"). Toda a geração acontece 100% no navegador — nenhum
 * número gerado é enviado, armazenado ou registrado em log.
 *
 * Esta ferramenta NUNCA gera validade (mês/ano) ou CVV — apenas o número
 * do cartão — e nunca consulta saldo, autorização ou gateways de
 * pagamento, reais ou de sandbox. Os números do modo "Teste oficial" são
 * publicamente documentados por processadores de pagamento (não
 * inventados por esta ferramenta); os do modo "Sintético" seguem apenas o
 * padrão de comprimento e o dígito de rede de cada bandeira, validados
 * pelo algoritmo de Luhn.
 */
export function CreditCardGeneratorTool() {
  const [mode, setMode] = useState<CreditCardGeneratorMode>("official");
  const [brand, setBrand] = useState<CardBrand | "any">("any");
  const [countText, setCountText] = useState("1");
  const [formatted, setFormatted] = useState(true);
  const [errors, setErrors] = useState<CreditCardGeneratorFieldErrors>({});
  const [results, setResults] = useState<GeneratedCard[] | null>(null);
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
    const input: CreditCardGeneratorInput = {
      mode,
      brand,
      count: Number(countText) || 0,
      formatted,
    };

    const nextErrors = validateCreditCardGeneratorInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResults(null);
      return;
    }

    setResults(generateCardBatch(input));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runGeneration();
  }

  return (
    <div>
      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Cartões exclusivamente para testes de formulários e validação. Não
        são cartões emitidos e não devem ser utilizados em transações
        reais. Para testar pagamentos, utilize os cartões oficiais do
        ambiente sandbox do seu provedor.
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SelectField
            id="card-generator-mode"
            label="Origem do número"
            hint="Teste oficial: números documentados por processadores de pagamento. Sintético: gerado aleatoriamente, apenas Luhn-válido."
            value={mode}
            onChange={(event) => setMode(event.target.value as CreditCardGeneratorMode)}
          >
            <option value="official">Teste oficial (recomendado)</option>
            <option value="synthetic">Sintético (aleatório)</option>
          </SelectField>
          <SelectField
            id="card-generator-brand"
            label="Bandeira"
            value={brand}
            onChange={(event) => setBrand(event.target.value as CardBrand | "any")}
          >
            <option value="any">Qualquer bandeira</option>
            {(Object.keys(CARD_BRAND_LABELS) as CardBrand[]).map((key) => (
              <option key={key} value={key}>
                {CARD_BRAND_LABELS[key]}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberField
            id="card-generator-count"
            label="Quantidade"
            placeholder="1"
            hint={`Máximo de ${CREDIT_CARD_GENERATOR_MAX_BATCH} por vez.`}
            maxLength={String(CREDIT_CARD_GENERATOR_MAX_BATCH).length}
            value={countText}
            onChange={(event) =>
              setCountText(
                event.target.value.replace(/\D/g, "").slice(0, String(CREDIT_CARD_GENERATOR_MAX_BATCH).length)
              )
            }
            error={errors.count}
          />
          <SelectField
            id="card-generator-format"
            label="Formato"
            value={formatted ? "formatted" : "digits"}
            onChange={(event) => setFormatted(event.target.value === "formatted")}
          >
            <option value="formatted">Com espaços</option>
            <option value="digits">Somente números</option>
          </SelectField>
        </div>

        <Button type="submit" className="w-full sm:w-auto">
          Gerar cartão
        </Button>
      </form>

      {results && results.length > 0 ? (
        <div className="mt-8 space-y-4">
          {results.length === 1 ? (
            <>
              <ResultHighlight
                label={`Número gerado (${CARD_BRAND_LABELS[results[0].brand]})`}
                value={results[0].number}
              />
              {results[0].source ? (
                <p className="text-center text-xs text-zinc-500">{results[0].source}</p>
              ) : null}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button type="button" onClick={() => copyText(results[0].number, "single")}>
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
                {results.map((card, index) => (
                  <li
                    key={`${card.number}-${index}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <span className="font-mono text-sm text-zinc-900">
                      {card.number}
                      <span className="ml-2 text-xs font-sans text-zinc-500">
                        {CARD_BRAND_LABELS[card.brand]}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => copyText(card.number, `row-${index}`)}
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
                  onClick={() => copyText(results.map((c) => c.number).join("\n"), "all")}
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
          <p className="text-xs text-zinc-500">
            O algoritmo de Luhn verifica apenas a estrutura matemática do
            número — não indica a existência ou autorização de um cartão.
          </p>
        </div>
      ) : null}
    </div>
  );
}
