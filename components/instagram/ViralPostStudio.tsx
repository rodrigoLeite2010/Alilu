"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ArrowLeft, ImagePlus, Type } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PostEditorTool } from "@/components/tools/instagram-post-creator/PostEditorTool";
import {
  deserializeEditorState,
  serializeEditorState,
  type PostEditorState,
} from "@/lib/instagram/editor-state";
import type { PostFormat } from "@/lib/instagram/formats";
import { clearLocalDraft, loadLocalDraft, saveLocalDraft } from "@/lib/instagram/draft-store";
import { getBrowserTimeZone, utcToZonedInputs } from "@/lib/instagram/schedule-time";
import {
  VIRAL_TEMPLATES,
  createViralInitialState,
  getViralTemplateById,
  type ViralTemplate,
} from "@/lib/instagram/viral/viral-templates";
import { PublicationComposerPanel, type ComposerInitialValues } from "./PublicationComposerPanel";

type Phase = "loading" | "choose" | "edit" | "blocked";

interface EditorSession {
  key: number;
  initialState: PostEditorState;
  viralTemplateId: string | null;
  editingPostId: string | null;
  initialValues?: ComposerInitialValues;
}

const RETURN_PATH_BASE = "/instagram/posts-virais";

async function blobToObjectUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    return URL.createObjectURL(await response.blob());
  } catch {
    return null;
  }
}

/**
 * Estúdio de Posts Virais: escolher template → personalizar (inclusive a
 * própria foto, com zoom e enquadramento) → prévia → publicar agora ou
 * agendar. Também reabre uma publicação salva (`editId`) para editar a
 * arte enquanto ela ainda não foi publicada, e restaura o rascunho local
 * depois do login/conexão com o Instagram.
 */
export function ViralPostStudio({ editId, notice: initialNotice }: { editId: string | null; notice: string | null }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<EditorSession | null>(null);
  const [notice, setNotice] = useState<string | null>(initialNotice);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const latestStateRef = useRef<PostEditorState | null>(null);
  const sessionCounter = useRef(0);

  const startSession = useCallback((next: Omit<EditorSession, "key">) => {
    sessionCounter.current += 1;
    latestStateRef.current = next.initialState;
    setSession({ ...next, key: sessionCounter.current });
    setPhase("edit");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (editId) {
        const response = await fetch(`/api/instagram/posts/${editId}`, { cache: "no-store" });
        if (cancelled) return;
        if (!response.ok) {
          setBlockedMessage(response.status === 401 ? "Entre na sua conta para editar esta publicação." : "Publicação não encontrada.");
          setPhase("blocked");
          return;
        }
        const { post } = (await response.json()) as {
          post: { id: string; status: string; caption: string; scheduledAtUtc: string | null; templateData: unknown; source: string };
        };
        if (post.status === "PROCESSING") {
          setBlockedMessage("Esta publicação já está sendo processada.");
          setPhase("blocked");
          return;
        }
        if (!["DRAFT", "SCHEDULED", "FAILED"].includes(post.status)) {
          setBlockedMessage("Esta publicação não pode mais ser editada.");
          setPhase("blocked");
          return;
        }
        const storageUrl = (post.templateData as { state?: { backgroundImage?: { storageUrl?: string } } } | null)?.state
          ?.backgroundImage?.storageUrl;
        const localUrl = storageUrl ? await blobToObjectUrl(storageUrl) : null;
        if (cancelled) return;
        const restored = deserializeEditorState(post.templateData, localUrl);
        if (!restored) {
          setBlockedMessage("Esta publicação não tem uma arte editável. Use \"Editar\" em Minhas publicações.");
          setPhase("blocked");
          return;
        }
        if (storageUrl && !localUrl) {
          setNotice("Não foi possível carregar a sua imagem original. Adicione a imagem novamente.");
          restored.backgroundImage = { ...restored.backgroundImage, url: null, storageUrl: null };
        }
        const zone = getBrowserTimeZone();
        startSession({
          initialState: restored,
          viralTemplateId: null,
          editingPostId: post.id,
          initialValues: {
            caption: post.caption,
            mode: post.status === "SCHEDULED" ? "schedule" : "now",
            schedule: post.scheduledAtUtc ? utcToZonedInputs(post.scheduledAtUtc, zone) : undefined,
          },
        });
        return;
      }

      const draft = await loadLocalDraft();
      if (cancelled) return;
      if (draft) {
        const localUrl = draft.image ? URL.createObjectURL(draft.image) : null;
        const restored = deserializeEditorState(draft.editor, localUrl);
        if (restored) {
          setNotice((current) => current ?? "Continuando de onde você parou.");
          startSession({
            initialState: restored,
            viralTemplateId: draft.viralTemplateId,
            editingPostId: null,
            initialValues: { caption: draft.caption, mode: draft.mode, schedule: draft.schedule },
          });
          return;
        }
      }
      setPhase("choose");
    }

    boot().catch(() => {
      if (!cancelled) setPhase("choose");
    });
    return () => {
      cancelled = true;
    };
  }, [editId, startSession]);

  function chooseTemplate(template: ViralTemplate) {
    setNotice(null);
    startSession({ initialState: createViralInitialState(template), viralTemplateId: template.id, editingPostId: null });
  }

  const handleStateChange = useCallback((state: PostEditorState) => {
    latestStateRef.current = state;
  }, []);

  const returnPath = session?.editingPostId ? `${RETURN_PATH_BASE}?editar=${session.editingPostId}` : RETURN_PATH_BASE;

  const PanelSlot = useMemo(() => {
    if (!session) return undefined;
    const current = session;
    function BoundComposerPanel({
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
          source="VIRAL_POST"
          editingPostId={current.editingPostId}
          initialValues={current.initialValues}
          returnPath={returnPath}
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
            await saveLocalDraft({
              viralTemplateId: current.viralTemplateId,
              editor: serializeEditorState(latest),
              caption: draft.caption,
              mode: draft.mode,
              schedule: draft.schedule,
              image,
            });
          }}
          onCompleted={() => void clearLocalDraft()}
        />
      );
    }
    return BoundComposerPanel;
  }, [session, returnPath]);

  if (phase === "loading") {
    return <p className="py-10 text-center text-sm text-zinc-500">Carregando…</p>;
  }

  if (phase === "blocked") {
    return (
      <div className="mx-auto max-w-md space-y-3 rounded-lg border border-zinc-200 p-6 text-center">
        <p className="text-sm text-zinc-700">{blockedMessage}</p>
        <a href="/instagram/painel/calendario" className="text-sm font-medium text-teal-700 underline">
          Voltar para Minhas publicações
        </a>
      </div>
    );
  }

  if (phase === "choose" || !session) {
    return (
      <div className="space-y-4">
        {notice ? (
          <p role="status" className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
            {notice}
          </p>
        ) : null}
        <h2 className="text-base font-semibold text-zinc-900">Escolha um template</h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {VIRAL_TEMPLATES.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                onClick={() => chooseTemplate(template)}
                className="flex h-full w-full flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 text-left transition-colors hover:border-teal-600 hover:bg-teal-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                  {template.wantsPhoto ? (
                    <ImagePlus className="h-4 w-4 text-teal-700" aria-hidden />
                  ) : (
                    <Type className="h-4 w-4 text-teal-700" aria-hidden />
                  )}
                  {template.name}
                </span>
                <span className="text-sm text-zinc-600">{template.description}</span>
                <span className="mt-auto text-xs text-zinc-500">
                  {template.wantsPhoto ? "Com a sua foto" : "Só texto"} · 1080 × 1350
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const viral = getViralTemplateById(session.viralTemplateId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-600">
          {session.editingPostId ? "Editando publicação salva" : viral ? `Template: ${viral.name}` : "Seu rascunho"}
        </p>
        {!session.editingPostId ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              void clearLocalDraft();
              setSession(null);
              setPhase("choose");
            }}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Trocar template
          </Button>
        ) : null}
      </div>
      {notice ? (
        <p role="status" className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {notice}
        </p>
      ) : null}
      <PostEditorTool
        key={session.key}
        initialState={session.initialState}
        onStateChange={handleStateChange}
        publishPanel={PanelSlot}
      />
    </div>
  );
}
