"use client";

import { useState, type FormEvent } from "react";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import {
  generatePersonBatch,
  validatePersonGeneratorInput,
  PERSON_GENERATOR_MAX_BATCH,
  type GeneratedPerson,
  type PersonGeneratorFieldErrors,
  type PersonGeneratorInput,
} from "@/lib/calculators/person-generator";
import type { NameGeneratorGender } from "@/lib/calculators/name-generator";

function formatPersonText(person: GeneratedPerson): string {
  return [
    `Nome: ${person.name}`,
    `Gênero: ${person.gender}`,
    `CPF: ${person.cpf}`,
    `RG: ${person.rg}`,
    `Data de nascimento: ${person.birthDate} (${person.age} anos)`,
    `CEP: ${person.cep}`,
    `Telefone: ${person.phone}`,
    `E-mail: ${person.email}`,
  ].join("\n");
}

const FIELD_ROWS: { label: string; value: (person: GeneratedPerson) => string }[] = [
  { label: "Gênero", value: (p) => p.gender },
  { label: "CPF", value: (p) => p.cpf },
  { label: "RG", value: (p) => p.rg },
  { label: "Data de nascimento", value: (p) => `${p.birthDate} (${p.age} anos)` },
  { label: "CEP", value: (p) => p.cep },
  { label: "Telefone", value: (p) => p.phone },
  { label: "E-mail", value: (p) => p.email },
];

/**
 * Componente principal do Gerador de Pessoas (categoria Geradores). Combina
 * os geradores de nome, CPF, RG e CEP já existentes com data de
 * nascimento, telefone e e-mail sintéticos, formando um perfil fictício
 * completo. Toda a geração acontece 100% no navegador — nenhum dado é
 * enviado, armazenado ou registrado em log.
 */
export function PersonGeneratorTool() {
  const [countText, setCountText] = useState("1");
  const [gender, setGender] = useState<NameGeneratorGender>("aleatorio");
  const [errors, setErrors] = useState<PersonGeneratorFieldErrors>({});
  const [results, setResults] = useState<GeneratedPerson[] | null>(null);
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
    const input: PersonGeneratorInput = {
      count: Number(countText) || 0,
      gender,
    };

    const nextErrors = validatePersonGeneratorInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResults(null);
      return;
    }

    setResults(generatePersonBatch(input));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runGeneration();
  }

  return (
    <div>
      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Perfis fictícios: nome, CPF, RG, data de nascimento, CEP, telefone
        e e-mail são sintéticos e combinados apenas para preencher formulários
        de teste. Não pertencem a nenhuma pessoa real e não são consultados
        em nenhuma base de dados.
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SelectField
            id="person-generator-gender"
            label="Gênero"
            value={gender}
            onChange={(event) => setGender(event.target.value as NameGeneratorGender)}
          >
            <option value="aleatorio">Aleatório</option>
            <option value="feminino">Feminino</option>
            <option value="masculino">Masculino</option>
          </SelectField>
          <NumberField
            id="person-generator-count"
            label="Quantidade"
            placeholder="1"
            hint={`Máximo de ${PERSON_GENERATOR_MAX_BATCH} por vez.`}
            maxLength={String(PERSON_GENERATOR_MAX_BATCH).length}
            value={countText}
            onChange={(event) =>
              setCountText(event.target.value.replace(/\D/g, "").slice(0, String(PERSON_GENERATOR_MAX_BATCH).length))
            }
            error={errors.count}
          />
        </div>

        <Button type="submit" className="w-full sm:w-auto">
          Gerar pessoa
        </Button>
      </form>

      {results && results.length > 0 ? (
        <div className="mt-8 space-y-4">
          {results.length === 1 ? (
            <>
              <ResultHighlight label="Pessoa gerada" value={results[0].name} />
              <div className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border border-zinc-200 p-4 text-sm sm:grid-cols-2">
                {FIELD_ROWS.map((row) => (
                  <div key={row.label} className="flex justify-between gap-2">
                    <span className="text-zinc-500">{row.label}</span>
                    <span className="font-medium text-zinc-900">{row.value(results[0])}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button type="button" onClick={() => copyText(formatPersonText(results[0]), "single")}>
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
              {results.map((person, index) => (
                <div key={`${person.cpf}-${index}`} className="rounded-lg border border-zinc-200 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="font-semibold text-zinc-900">{person.name}</span>
                    <button
                      type="button"
                      onClick={() => copyText(formatPersonText(person), `row-${index}`)}
                      className="text-sm font-medium text-teal-700 hover:text-teal-900"
                    >
                      {copiedKey === `row-${index}` ? "Copiado!" : "Copiar"}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    {FIELD_ROWS.map((row) => (
                      <div key={row.label} className="flex justify-between gap-2">
                        <span className="text-zinc-500">{row.label}</span>
                        <span className="text-zinc-900">{row.value(person)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={() =>
                    copyText(results.map((person) => formatPersonText(person)).join("\n\n"), "all")
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
