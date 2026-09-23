"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { PostEditorTool } from "@/components/tools/instagram-post-creator/PostEditorTool";
import { deserializeEditorState, serializeEditorState, type PostEditorState } from "@/lib/instagram/editor-state";
import type { PostFormat } from "@/lib/instagram/formats";
import { clearLocalDraft, loadLocalDraft, saveLocalDraft } from "@/lib/instagram/draft-store";
import { PublicationComposerPanel, type ComposerInitialValues } from "./PublicationComposerPanel";

const RETURN_PATH = "/instagram/criar-post?continuar=1";

/**
 * Criador de Posts público (/instagram/criar-post): o editor continua
 * 100% sem login — criar, editar, ver e baixar. Logo abaixo do download
 * aparecem "Publicar no Instagram" e "Agendar publicação"; só nesse
 * clique o usuário entra/conecta a conta. Antes de sair para o login ou
 * para a Meta, a arte (estado + foto) e a legenda ficam num rascunho local
 * (IndexedDB) e são restauradas quando ele volta com `?continuar=1`.
 */
export function PublicPostCreator() {
  const [session, setSession] = useState<{ key: number; state?: PostEditorState; values?: ComposerInitialValues }>({ key: 0 });
  const [notice, setNotice] = useState<string | null>(null);
  const latestStateRef = useRef<PostEditorState | null>(null);

  // Lido no navegador (e não via searchParams no servidor) para a página
  // continuar estática — importante para SEO e velocidade.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("continuar") !== "1") return;
    let cancelled = false;
    const status = params.get("status");
    loadLocalDraft("post").then((draft) => {
      if (cancelled) return;
      if (status === "erro") setNotice(params.get("mensagem") ?? "Não foi possível conectar o Instagram.");
      if (!draft) return;
      const localUrl = draft.image ? URL.createObjectURL(draft.image) : null;
      const restored = deserializeEditorState(draft.editor, localUrl);
      if (!restored) return;
      setSession({ key: 1, state: restored, values: { caption: draft.caption, mode: draft.mode, schedule: draft.schedule } });
      setNotice(
        status === "conectado"
          ? "Instagram conectado! Sua arte foi restaurada — agora é só publicar ou agendar."
          : status === "erro"
            ? `${params.get("mensagem") ?? "Não foi possível conectar o Instagram."} Sua arte foi restaurada.`
            : "Sua arte foi restaurada. Continue de onde parou.",
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStateChange = useCallback((state: PostEditorState) => {
    latestStateRef.current = state;
  }, []);

  const PanelSlot = useMemo(() => {
    const values = session.values;
    function BoundPanel({ canvasRef, format, state }: { canvasRef: RefObject<HTMLCanvasElement | null>; format: PostFormat; state: PostEditorState }) {
      return (
        <PublicationComposerPanel
          canvasRef={canvasRef}
          format={format}
          state={state}
          source="MANUAL"
          returnPath={RETURN_PATH}
          initialValues={values}
          onPersistLocalDraft={async (draft) => {
            const latest = latestStateRef.current ?? state;
            let image: Blob | null = null;
            if (latest.backgroundImage.url) {
              try {
                image = await (await fetch(latest.backgroundImage.url)).blob();
              } catch {
                image = null;
              }
            }
            await saveLocalDraft(
              { viralTemplateId: null, editor: serializeEditorState(latest), caption: draft.caption, mode: draft.mode, schedule: draft.schedule, image },
              "post",
            );
          }}
          onCompleted={() => void clearLocalDraft("post")}
        />
      );
    }
    return BoundPanel;
  }, [session]);

  return (
    <div className="space-y-4">
      {notice ? (
        <p role="status" className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {notice}
        </p>
      ) : null}
      <PostEditorTool key={session.key} initialState={session.state} onStateChange={handleStateChange} publishPanel={PanelSlot} />
    </div>
  );
}
