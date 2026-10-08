import { formatCents } from "@/lib/allowance/money";

export { call, formatDateBr } from "@/components/mesada/api";

export function budgetLabel(min: number | null, max: number | null): string | null {
  if (min !== null && max !== null) return `${formatCents(min)} a ${formatCents(max)}`;
  if (max !== null) return `até ${formatCents(max)}`;
  if (min !== null) return `a partir de ${formatCents(min)}`;
  return null;
}

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  OPEN: "Aberto para entrar",
  READY_TO_DRAW: "Pronto para sortear",
  DRAWN: "Sorteio realizado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

export const PROGRESS_LABEL: Record<string, string> = {
  PARTICIPANDO: "Participando",
  AMIGO_SORTEADO: "Amigo sorteado",
  PRESENTE_ESCOLHIDO: "Presente escolhido",
  PRESENTE_COMPRADO: "Presente comprado",
};

export function inviteUrl(token: string): string {
  return `${typeof window === "undefined" ? "https://www.alilu.com.br" : window.location.origin}/amigo-secreto/convite/${token}`;
}

export const cardClass = "rounded-lg border border-zinc-200 bg-white p-4 sm:p-5";
export const inputClass =
  "mt-1 block min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 focus:border-rose-700 focus:outline focus:outline-2 focus:outline-rose-700/30";
