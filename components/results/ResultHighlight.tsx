import type { ReactNode } from "react";

/**
 * Destaque visual do resultado principal de uma calculadora (PROMPT MESTRE,
 * seção 6: "resultado principal muito evidente"). Também é usado, em estado
 * de rascunho (`placeholder`), para pré-visualizar o layout de ferramentas
 * que ainda estão "Em breve", sem inventar nenhum valor calculado.
 */
export function ResultHighlight({
  label,
  value,
  placeholder = false,
}: {
  label: string;
  value: ReactNode;
  placeholder?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-6 text-center ${
        placeholder
          ? "border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
          : "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40"
      }`}
    >
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </p>
      <p
        className={`mt-2 text-3xl font-bold tracking-tight sm:text-4xl ${
          placeholder
            ? "text-zinc-400 dark:text-zinc-600"
            : "text-blue-700 dark:text-blue-300"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
