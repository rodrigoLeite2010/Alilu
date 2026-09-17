"use client";

import { useState, type FormEvent } from "react";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import {
  generateNameBatch,
  validateNameGeneratorInput,
  NAME_GENERATOR_MAX_BATCH,
  type NameGeneratorFieldErrors,
  type NameGeneratorGender,
  type NameGeneratorInput,
  type NameGeneratorKind,
} from "@/lib/calculators/name-generator";

/**
 * Componente principal do Gerador de Nomes (categoria Geradores). Toda a
 * geração acontece 100% no navegador do usuário — nenhum nome gerado é
 * enviado, armazenado ou registrado em log.
 *
 * Os nomes são combinações FICTÍCIAS de listas de primeiro nome + sobrenome
 * comuns no Brasil — não estão vinculados a nenhuma pessoa real.
 */
export function NameGeneratorTool() {
  const [countText, setCountText] = useState("1");
  const [gender, setGender] = useState<NameGeneratorGender>("aleatorio");
  const [kind, setKind] = useState<NameGeneratorKind>("completo");
  const [surnameCount, setSurnameCount] = useState<1 | 2>(1);
  const [errors, setErrors] = useState<NameGeneratorFieldErrors>({});
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
    const input: NameGeneratorInput = {
      count: Number(countText) || 0,
      gender,
      kind,
      surnameCount,
    };

    const nextErrors = validateNameGeneratorInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResults(null);
      return;
    }

    setResults(generateNameBatch(input));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runGeneration();
  }

  return (
    <div>
      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Os nomes gerados são combinações fictícias de nomes e sobrenomes
        comuns no Brasil, sorteadas ao acaso. Qualquer semelhança com uma
        pessoa real é coincidência, não intencional.
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <SelectField
            id="name-generator-kind"
            label="Tipo"
            value={kind}
            onChange={(event) => setKind(event.target.value as NameGeneratorKind)}
          >
            <option value="completo">Nome completo</option>
            <option value="primeiro-nome">Somente primeiro nome</option>
          </SelectField>
          <SelectField
            id="name-generator-gender"
            label="Gênero"
            value={gender}
            onChange={(event) => setGender(event.target.value as NameGeneratorGender)}
          >
            <option value="aleatorio">Aleatório</option>
            <option value="feminino">Feminino</option>
            <option value="masculino">Masculino</option>
          </SelectField>
          <SelectField
            id="name-generator-surname-count"
            label="Sobrenomes"
            hint={kind === "primeiro-nome" ? "Não se aplica ao tipo escolhido." : undefined}
            disabled={kind === "primeiro-nome"}
            value={String(surnameCount)}
            onChange={(event) => setSurnameCount(Number(event.target.value) === 2 ? 2 : 1)}
          >
            <option value="1">1 sobrenome</option>
            <option value="2">2 sobrenomes</option>
          </SelectField>
        </div>

        <NumberField
          id="name-generator-count"
          label="Quantidade"
          placeholder="1"
          hint={`Máximo de ${NAME_GENERATOR_MAX_BATCH} por vez.`}
          maxLength={String(NAME_GENERATOR_MAX_BATCH).length}
          value={countText}
          onChange={(event) =>
            setCountText(event.target.value.replace(/\D/g, "").slice(0, String(NAME_GENERATOR_MAX_BATCH).length))
          }
          error={errors.count}
        />

        <Button type="submit" className="w-full sm:w-auto">
          Gerar nome
        </Button>
      </form>

      {results && results.length > 0 ? (
        <div className="mt-8 space-y-4">
          {results.length === 1 ? (
            <>
              <ResultHighlight label="Nome gerado" value={results[0]} />
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button type="button" onClick={() => copyText(results[0], "single")}>
                  Copiar nome
                </Button>
                <Button type="button" variant="secondary" onClick={runGeneration}>
                  Gerar novamente
                </Button>
                {copiedKey === "single" ? (
                  <span role="status" className="text-sm text-emerald-600">
                    Nome copiado!
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-zinc-200">
              <ul className="divide-y divide-zinc-100">
                {results.map((name, index) => (
                  <li
                    key={`${name}-${index}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <span className="text-sm text-zinc-900">{name}</span>
                    <button
                      type="button"
                      onClick={() => copyText(name, `row-${index}`)}
                      className="text-sm font-medium text-teal-700 hover:text-teal-900"
                    >
                      {copiedKey === `row-${index}` ? "Copiado!" : "Copiar"}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 p-4">
                <Button type="button" onClick={() => copyText(results.join("\n"), "all")}>
                  Copiar todos
                </Button>
                <Button type="button" variant="secondary" onClick={runGeneration}>
                  Gerar novamente
                </Button>
                {copiedKey === "all" ? (
                  <span role="status" className="text-sm text-emerald-600">
                    Todos os nomes copiados!
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
