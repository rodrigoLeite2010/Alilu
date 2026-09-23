"use client";

import { useMemo, type RefObject } from "react";
import { PostEditorTool } from "@/components/tools/instagram-post-creator/PostEditorTool";
import { PublicationComposerPanel } from "@/components/instagram/PublicationComposerPanel";
import type { PostEditorState } from "@/lib/instagram/editor-state";
import type { PostFormat } from "@/lib/instagram/formats";

export interface AuthenticatedPostComposerProps {
  /** session.user.id — mantido na assinatura por compatibilidade; o painel confirma a sessão pela API. */
  userId: string;
}

/**
 * Composição client-side do editor visual público (PostEditorTool) com o
 * painel de publicação (PublicationComposerPanel — o MESMO usado pelos
 * Posts Virais: prévia, rascunho, publicar agora e agendar), usada na área
 * autenticada (app/instagram/painel/calendario/novo).
 *
 * Existe como componente próprio porque Server Components não podem passar
 * funções/componentes para Client Components. `useMemo` mantém a
 * identidade do slot estável — um slot recriado a cada render remontaria
 * o painel e perderia a legenda digitada.
 */
export function AuthenticatedPostComposer({ userId }: AuthenticatedPostComposerProps) {
  const PublishPanelSlot = useMemo(() => {
    function BoundPublishPanel({
      canvasRef,
      format,
      state,
    }: {
      canvasRef: RefObject<HTMLCanvasElement | null>;
      format: PostFormat;
      state: PostEditorState;
    }) {
      return (
        <PublicationComposerPanel
          canvasRef={canvasRef}
          format={format}
          state={state}
          source="MANUAL"
          returnPath="/instagram/painel/calendario/novo"
        />
      );
    }
    return BoundPublishPanel;
  }, []);

  void userId;
  return <PostEditorTool publishPanel={PublishPanelSlot} />;
}
