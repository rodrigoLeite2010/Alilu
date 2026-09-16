"use client";

import type { InputHTMLAttributes } from "react";

/**
 * Campo numérico genérico, pronto para ser usado pelas futuras
 * calculadoras. Usa teclado numérico no mobile (inputMode="decimal") e
 * aceita vírgula como separador decimal (padrão brasileiro), deixando a
 * conversão para lib/validators/number.ts (parseLocaleNumberBRL).
 *
 * Ainda não é utilizado por nenhuma página nesta primeira entrega — nenhuma
 * calculadora foi implementada ainda —, mas fixa o padrão visual e de
 * acessibilidade (label real, área de toque confortável) que as próximas
 * ferramentas devem seguir (PROMPT MESTRE, seções 6 e 7).
 */
export function NumberField({
  label,
  id,
  suffix,
  ...rest
}: {
  label: string;
  id: string;
  suffix?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      <span className="relative flex items-center">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          className="w-full rounded-lg border border-zinc-300 bg-white py-3 px-4 text-base text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          {...rest}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-4 text-sm text-zinc-400">
            {suffix}
          </span>
        ) : null}
      </span>
    </label>
  );
}
