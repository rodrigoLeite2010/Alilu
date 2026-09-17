import type { ReactNode } from "react";

/**
 * Resultado visual (✓/✕) de uma ferramenta da categoria Validadores.
 * Reaproveita o mesmo espírito visual de ResultHighlight (borda + fundo
 * suave + texto grande), mas com estado positivo/negativo — nunca depende
 * só da cor: o texto sempre traz "válido"/"inválido" por extenso junto do
 * ícone ✓/✕ (PROMPT MESTRE Validadores, seção "Resultado").
 */
export function ValidatorResult({
  valid,
  validLabel,
  invalidLabel,
  detail,
}: {
  valid: boolean;
  validLabel: string;
  invalidLabel: string;
  detail?: ReactNode;
}) {
  return (
    <div
      role="status"
      className={`rounded-lg border p-6 text-center ${
        valid
          ? "border-emerald-300 bg-emerald-50"
          : "border-red-300 bg-red-50"
      }`}
    >
      <p
        className={`text-xl font-bold tracking-tight sm:text-2xl ${
          valid ? "text-emerald-800" : "text-red-800"
        }`}
      >
        <span aria-hidden>{valid ? "✓" : "✕"}</span>{" "}
        {valid ? validLabel : invalidLabel}
      </p>
      {detail ? (
        <p className="mt-2 text-sm text-zinc-600">{detail}</p>
      ) : null}
    </div>
  );
}
