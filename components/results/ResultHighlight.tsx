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
      className={`rounded-lg border p-6 text-center ${
        placeholder
          ? "border-dashed border-zinc-300 bg-zinc-50"
          : "border-teal-800/15 bg-teal-50"
      }`}
    >
      <p className="text-sm font-medium text-zinc-600">{label}</p>
      <p
        className={`mt-2 text-3xl font-bold tracking-tight sm:text-4xl ${
          placeholder ? "text-zinc-400" : "text-teal-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
