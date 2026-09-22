"use client";

import { useMemo } from "react";
import {
  CarouselEditorTool,
  type CarouselPublishPanelSlotProps,
} from "@/components/tools/instagram-carousel-creator/CarouselEditorTool";
import { CarouselPublishPanel } from "@/components/instagram/CarouselPublishPanel";

export interface AuthenticatedCarouselComposerProps {
  /** session.user.id — a única coisa que precisa atravessar de Server para Client Component aqui (uma string simples, sempre serializável). */
  userId: string;
}

/**
 * Composição client-side do editor visual público de carrossel
 * (CarouselEditorTool) com o painel de publicação real
 * (CarouselPublishPanel), usada só na área autenticada do calendário
 * editorial (app/instagram/painel/calendario/novo-carrossel) — mesmo
 * padrão já usado para imagem única em AuthenticatedPostComposer.tsx (ver
 * esse arquivo para o porquê da composição não acontecer direto no
 * Server Component da página: React Server Components não permitem
 * passar uma função/componente como prop de um Server Component para um
 * Client Component).
 *
 * `useMemo` mantém a identidade do componente do slot estável entre
 * re-renderizações (enquanto `userId` não mudar) — um componente
 * recriado a cada render remontaria o CarouselPublishPanel e perderia o
 * que o usuário já tinha digitado.
 */
export function AuthenticatedCarouselComposer({ userId }: AuthenticatedCarouselComposerProps) {
  const PublishPanelSlot = useMemo(() => {
    function BoundCarouselPublishPanel({ slides, formatId }: CarouselPublishPanelSlotProps) {
      return <CarouselPublishPanel slides={slides} formatId={formatId} userId={userId} />;
    }
    return BoundCarouselPublishPanel;
  }, [userId]);

  return <CarouselEditorTool publishPanel={PublishPanelSlot} />;
}
