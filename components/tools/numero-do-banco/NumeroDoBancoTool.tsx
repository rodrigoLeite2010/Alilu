"use client";

import { useState } from "react";
import { SearchField } from "@/components/forms/SearchField";
import { BRAZILIAN_BANKS, searchBrazilianBanks } from "@/lib/data/brazilian-banks";

/**
 * Consulta de código de bancos brasileiros (categoria Utilidades/"outros").
 * É um catálogo estático e pesquisável de códigos de instituição (COMPE) —
 * não consulta, valida nem exibe dados de conta bancária de ninguém. Toda a
 * busca acontece 100% no navegador do usuário, sobre lib/data/brazilian-banks.ts
 * (um subconjunto curado dos bancos, fintechs e cooperativas mais
 * conhecidos — não é o cadastro completo do Banco Central).
 */
export function NumeroDoBancoTool() {
  const [query, setQuery] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const results = query.trim().length > 0 ? searchBrazilianBanks(query) : BRAZILIAN_BANKS;

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((current) => (current === code ? null : current)), 2000);
    } catch {
      setCopiedCode(null);
    }
  }

  return (
    <div>
      <SearchField
        label="Buscar por nome ou código do banco (ex.: Nubank, 341, Itaú)"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <p role="status" className="sr-only">
        {copiedCode ? `Código ${copiedCode} copiado!` : ""}
      </p>

      <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200">
        {results.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Código
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Banco
                </th>
                <th scope="col" className="px-4 py-3 font-medium text-right">
                  Copiar
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {results.map((bank) => (
                <tr key={bank.code} className="hover:bg-zinc-50">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-zinc-900">{bank.code}</td>
                  <td className="px-4 py-3 text-zinc-700">
                    {bank.name}
                    {bank.shortName ? (
                      <span className="ml-1 text-zinc-400">({bank.shortName})</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => copyCode(bank.code)}
                      className="text-sm font-medium text-teal-700 hover:text-teal-900"
                    >
                      {copiedCode === bank.code ? "Copiado!" : "Copiar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-4 text-sm text-zinc-500">
            Nenhum banco encontrado para &quot;{query}&quot;.
          </p>
        )}
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        Lista com os bancos, fintechs e cooperativas mais conhecidos, para consulta rápida do código
        de instituição (COMPE/ISPB). Não é o cadastro oficial completo do Banco Central e não serve
        para consultar dados de conta ou agência de ninguém.
      </p>
    </div>
  );
}
