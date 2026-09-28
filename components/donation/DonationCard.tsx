"use client";

import { DonationButton } from "./DonationButton";
import { useDonation } from "./DonationProvider";

/**
 * Cartão de apoio do rodapé — "❤️ O Alilu é gratuito..." + botão que abre
 * o mesmo modal do botão flutuante. Nunca mostra o QR Code diretamente no
 * rodapé (só dentro do modal, ver PROMPT).
 */
export function DonationCard() {
  const { enabled } = useDonation();

  if (!enabled) return null;

  return (
    <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
      <p className="text-sm text-zinc-700">❤️ O Alilu é gratuito. Quer ajudar a manter o projeto?</p>
      <DonationButton
        aria-label="Apoiar o Alilu com uma doação via Pix"
        className="inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-zinc-900 px-4 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      >
        Apoiar o Alilu
      </DonationButton>
    </div>
  );
}
