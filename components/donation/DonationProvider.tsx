"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { getDonationConfig } from "@/lib/donation/config";
import { DonationModal } from "./DonationModal";

interface DonationContextValue {
  enabled: boolean;
  openDonationModal: () => void;
}

const DonationContext = createContext<DonationContextValue | null>(null);

/**
 * Dono único do estado do modal de doação — para que o botão flutuante e
 * o botão do rodapé abram exatamente o MESMO modal, sem duplicar lógica
 * (ver PROMPT: "Não duplicar lógica"). Envolve toda a página em
 * app/layout.tsx; se a doação estiver desabilitada (`getDonationConfig()`),
 * nenhum modal chega a ser montado e `useDonation().enabled` fica false
 * para quem usa o contexto (DonationButton, DonationCard) simplesmente
 * não renderizar nada.
 */
export function DonationProvider({ children }: { children: ReactNode }) {
  const config = useMemo(() => getDonationConfig(), []);
  const [open, setOpen] = useState(false);

  const openDonationModal = useCallback(() => setOpen(true), []);
  const closeDonationModal = useCallback(() => setOpen(false), []);

  const value = useMemo<DonationContextValue>(
    () => ({ enabled: config.enabled, openDonationModal }),
    [config.enabled, openDonationModal],
  );

  return (
    <DonationContext.Provider value={value}>
      {children}
      {config.enabled && open ? <DonationModal onClose={closeDonationModal} config={config} /> : null}
    </DonationContext.Provider>
  );
}

/**
 * Fora do DonationProvider (ex.: um teste de componente isolado que não
 * envolve a árvore inteira), devolve um estado "desligado" em vez de
 * lançar — quem usa (`DonationButton`, `DonationCard`) só deixa de
 * renderizar nada, nunca quebra a página.
 */
export function useDonation(): DonationContextValue {
  const context = useContext(DonationContext);
  if (!context) {
    return { enabled: false, openDonationModal: () => undefined };
  }
  return context;
}
