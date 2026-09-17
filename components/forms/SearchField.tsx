"use client";

import type { InputHTMLAttributes } from "react";
import { Icon } from "@/components/ui/Icon";

/**
 * Campo de busca genérico e reutilizável. Controlado externamente (value +
 * onChange) para poder ser usado tanto na busca do catálogo de ferramentas
 * quanto em formulários futuros.
 */
export function SearchField({
  label,
  ...rest
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <span className="relative flex items-center">
        <Icon
          name="search"
          className="pointer-events-none absolute left-3 h-5 w-5 text-zinc-400"
        />
        <input
          type="search"
          placeholder={label}
          inputMode="search"
          className="w-full rounded-lg border border-zinc-300 bg-white py-3 pl-10 pr-4 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
          {...rest}
        />
      </span>
    </label>
  );
}
