"use client";

import type { SelectHTMLAttributes } from "react";

/**
 * Select genérico com label real e mensagem de erro associada, seguindo o
 * mesmo padrão visual de TextField/NumberField.
 */
export function SelectField({
  label,
  id,
  error,
  hint,
  children,
  className = "",
  ...rest
}: {
  label: string;
  id: string;
  error?: string;
  hint?: string;
  className?: string;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  const describedBy =
    [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className={`block ${className}`}>
      {/* Ver comentário equivalente em components/forms/TextField.tsx */}
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-zinc-700"
      >
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`w-full rounded-lg border bg-white py-3 px-4 text-base text-zinc-900 focus:outline-none focus:ring-2 ${
          error
            ? "border-red-400 focus:border-red-500 focus:ring-red-500/30"
            : "border-zinc-300 focus:border-teal-700 focus:ring-teal-700/20"
        }`}
        {...rest}
      >
        {children}
      </select>
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
