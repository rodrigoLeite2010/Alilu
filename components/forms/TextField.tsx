"use client";

import type { InputHTMLAttributes } from "react";

/**
 * Campo de texto genérico com label real, mensagem de erro associada
 * (aria-describedby/aria-invalid) e área de toque confortável — padrão
 * visual e de acessibilidade reutilizável por qualquer formulário de
 * ferramenta (PROMPT MESTRE, seções 6, 7 e 10).
 */
export function TextField({
  label,
  id,
  error,
  hint,
  suffix,
  className = "",
  ...rest
}: {
  label: string;
  id: string;
  error?: string;
  hint?: string;
  suffix?: string;
  className?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const describedBy =
    [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className={`block ${className}`}>
      {/*
        O rótulo contém só o texto do nome do campo — dica ("Opcional") e
        erro ficam fora dele, ligados via aria-describedby, para que o nome
        acessível do campo (e o texto usado por getByLabelText nos testes)
        seja exatamente o label, sem texto extra concatenado.
      */}
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-zinc-700"
      >
        {label}
      </label>
      <span className="relative flex items-center">
        <input
          id={id}
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
