"use client";

import { DonationButton } from "./DonationButton";

/**
 * Botão flutuante discreto ("☕ Apoie o Alilu"), canto inferior direito.
 * Fica dentro da pilha de widgets flutuantes de app/layout.tsx (junto com
 * SuggestionPrompt) para nunca ficar sobreposto a outro botão — a pilha
 * empurra os dois para cima um do outro em vez de ocupar o mesmo espaço.
 * Compacto no celular: só o ícone, em um botão circular; no desktop,
 * ícone + texto.
 */
export function DonationFloatingButton() {
  return (
    <DonationButton
      aria-label="Apoiar o Alilu com uma doação via Pix"
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-lg shadow-lg ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:w-auto sm:gap-2 sm:px-5"
    >
      <span aria-hidden="true">☕</span>
      <span className="hidden text-sm font-semibold text-zinc-800 sm:inline">Apoie o Alilu</span>
    </DonationButton>
  );
}
