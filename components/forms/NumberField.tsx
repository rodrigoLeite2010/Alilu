"use client";

import type { InputHTMLAttributes } from "react";

/**
 * Campo numérico genérico, usado pelas calculadoras. Usa teclado numérico
 * no mobile (inputMode="decimal") e aceita vírgula como separador decimal
 * (padrão brasileiro), deixando a conversão para lib/validators/number.ts
 * (parseLocaleNumberBRL).
 *
 * Label, dica e erro seguem o mesmo padrão de acessibilidade de
 * components/forms/TextField.tsx: o rótulo (<label>) contém só o nome do
 * campo — dica/erro ficam fora dele, ligados via aria-describedby — para
 * que o nome acessível do campo não inclua texto extra (PROMPT MESTRE,
 * seções 6, 7 e 10; usado pela primeira vez na Calculadora de Juros
 * Compostos, ETAPA 3).
 */
export function NumberField({
  label,
  id,
  suffix,
  error,
  hint,
  className = "",
  ...rest
}: {
  label: string;
  id: string;
  suffix?: string;
  error?: string;
  hint?: string;
  className?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const describedBy =
    [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className={`block ${className}`}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-zinc-700"
      >
        {label}
      </label>
      <span className="relative flex items-center">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`w-full rounded-lg border bg-white py-3 px-4 text-base text-zinc-900 focus:outline-none focus:ring-2 ${
            error
              ? "border-red-400 focus:border-red-500 focus:ring-red-500/30"
              : "border-zinc-300 focus:border-teal-700 focus:ring-teal-700/20"
          }`}
          {...rest}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-4 text-sm text-zinc-400">
            {suffix}
          </span>
        ) : null}
      </span>
      {hint && !error ? (
        <span id={`${id}-hint`} className="mt-1.5 block text-xs text-zinc-500">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 block text-sm text-red-600"
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
