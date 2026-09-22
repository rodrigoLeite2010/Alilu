"use client";

import { useMemo, type RefObject } from "react";
import { PostEditorTool } from "@/components/tools/instagram-post-creator/PostEditorTool";
import { PublishPanel } from "@/components/instagram/PublishPanel";
import type { PostFormat } from "@/lib/instagram/formats";

export interface AuthenticatedPostComposerProps {
  /** session.user.id — a única coisa que precisa atravessar de Server para Client Component aqui (uma string simples, sempre serializável). */
  userId: string;
}

/**
 * Composição client-side do editor visual público (PostEditorTool) com o
 * painel de publicação real (PublishPanel), usada só na área autenticada
 * do calendário editorial (app/instagram/painel/calendario/novo).
 *
 * Existe como componente próprio (em vez de compor os dois direto na
 * página, que é um Server Component) porque React Server Components não
 * permitem passar uma função/componente como prop de um Server Component
 * para um Client Component — só valores serializáveis (como `userId`,
 * aqui) cruzam essa fronteira. A composição de fato — passar `userId` para
 * dentro do slot `publishPanel` que PostEditorTool espera (ver
 * PostEditorTool.tsx) — acontece inteiramente do lado do cliente.
 *
 * `useMemo` mantém a identidade do componente do slot estável entre
 * re-renderizações (enquanto `userId` não mudar, o que nunca acontece
 * numa mesma sessão) — um componente recriado a cada render
 * remontaria o PublishPanel e perderia o que o usuário já tinha digitado.
 */
export function AuthenticatedPostComposer({ userId }: AuthenticatedPostComposerProps) {
  const PublishPanelSlot = useMemo(() => {
    function BoundPublishPanel({
      canvasRef,
      format,
    }: {
      canvasRef: RefObject<HTMLCanvasElement | null>;
      format: PostFormat;
    }) {
      return <PublishPanel canvasRef={canvasRef} format={format} userId={userId} />;
    }
    return BoundPublishPanel;
  }, [userId]);

  return <PostEditorTool publishPanel={PublishPanelSlot} />;
}
