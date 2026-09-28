"use client";

import type { ReactNode } from "react";
import { useDonation } from "./DonationProvider";

/**
 * Botão genérico que abre o modal de doação — usado tanto pelo botão
 * flutuante (DonationFloatingButton) quanto pelo cartão do rodapé
 * (DonationCard), sempre reaproveitando o mesmo DonationModal (ver
 * DonationProvider). Não renderiza nada quando a doação está
 * desabilitada (NEXT_PUBLIC_DONATION_ENABLED=false ou dados essenciais
 * ausentes) — nunca aparece um botão quebrado.
 */
export function DonationButton({
  children,
  className,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  const { enabled, openDonationModal } = useDonation();

  if (!enabled) return null;

  return (
    <button type="button" onClick={openDonationModal} aria-label={ariaLabel} className={className}>
      {children}
    </button>
  );
}
