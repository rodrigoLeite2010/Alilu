"use client";

import { useId, useState, type FormEvent } from "react";
import { uploadPresigned } from "@vercel/blob/client";
import { buildMediaPathnamePrefix, sanitizeOriginalFilename } from "@/lib/instagram/backend/media-service";

type Stage = "idle" | "uploading" | "criando-post" | "publicando" | "sucesso" | "erro";

const STAGE_LABEL: Record<Stage, string | null> = {
  idle: null,
  uploading: "Enviando a imagem…",
  "criando-post": "Registrando o post…",
  publicando: "Publicando no Instagram…",
  sucesso: null,
  erro: null,
};

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" && body.error ? body.error : fallback;
  } catch {
    return fallback;
  }
}

interface InstagramPublishTestFormProps {
  /**
   * Id do usuário autenticado (`session.user.id`), lido no Server Component
   * pai (`app/instagram/painel/page.tsx`) e passado como prop — nunca
   * obtido no cliente. É usado só para montar o `pathname` do upload
   * (`instagram-media/{userId}/{arquivo}`); quem de fato autoriza o upload
   * é a rota do servidor, comparando contra a própria sessão (nunca contra
   * este valor vindo do cliente) — ver `isPathnameAllowedForUser` em
   * `lib/instagram/backend/media-service.ts`.
   */
  userId: string;
}

/**
 * Formulário PROVISÓRIO para testar a publicação real de imagem única de
 * ponta a ponta (etapa do InstagramService, e106491) — sobe a imagem pro
 * Vercel Blob, cria o post e dispara a publicação de verdade no Instagram
 * do usuário autenticado. Não é a UI final (essa vem com o calendário
 * editorial, etapa futura do roteiro); existe só para o fluxo de
 * publicação ser testável antes de mais camadas se acumularem em cima
 * dele sem nunca terem sido verificadas contra a Meta de verdade.
 *
 * Publica de fato — nunca é chamado automaticamente por esta sessão;
 * exige o usuário escolher um arquivo, escrever (ou não) uma legenda e
 * clicar em "Publicar agora" conscientemente.
 */
export function InstagramPublishTestForm({ userId }: InstagramPublishTestFormProps) {
  const fileInputId = useId();
  const captionInputId = useId();

  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const busy = stage === "uploading" || stage === "criando-post" || stage === "publicando";

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!file || busy) return;

    setMessage(null);

    try {
      setStage("uploading");
      // O pathname precisa vir prefixado com a pasta do usuário logado —
      // `isPathnameAllowedForUser`, do lado do servidor, rejeita qualquer
      // outro valor (nunca confia no pathname vindo do cliente sem validar
      // contra a sessão real).
      const pathname = `${buildMediaPathnamePrefix(userId)}${sanitizeOriginalFilename(file.name) ?? "arquivo"}`;
      const blob = await uploadPresigned(pathname, file, {
        access: "public", // precisa ser pública — a Meta busca a imagem pela URL (image_url), não recebe o arquivo
        handleUploadUrl: "/api/instagram/media/upload",
        clientPayload: JSON.stringify({ originalFilename: file.name, fileSizeBytes: file.size }),
      });

      setStage("criando-post");
      const createResponse = await fetch("/api/instagram/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaUrl: blob.url, caption }),
      });
      if (!createResponse.ok) {
        throw new Error(await readErrorMessage(createResponse, "Não foi possível criar o post."));
      }
      const { postId } = (await createResponse.json()) as { postId: string };

      setStage("publicando");
      const publishResponse = await fetch(`/api/instagram/posts/${postId}/publish`, { method: "POST" });
      if (!publishResponse.ok) {
        throw new Error(await readErrorMessage(publishResponse, "Não foi possível publicar no Instagram."));
      }
      const { status } = (await publishResponse.json()) as { status: "PUBLISHED" | "PROCESSING" };

      setStage("sucesso");
      setMessage(
        status === "PUBLISHED"
          ? "Publicado com sucesso no Instagram."
          : "A Meta ainda está processando a imagem — o post já foi criado; clique em \"Publicar agora\" de novo em alguns instantes para concluir (não vai criar um post duplicado).",
      );
      setFile(null);
      setCaption("");
    } catch (error) {
      setStage("erro");
      setMessage(error instanceof Error ? error.message : "Erro inesperado ao publicar.");
    }
  }

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="text-sm font-medium text-amber-900">Publicar teste (provisório)</p>
      <p className="mt-1 text-xs text-amber-800">
        Isto publica de verdade na sua conta do Instagram conectada. Não é a tela final — existe só
        para testar o fluxo de publicação ponta a ponta antes do calendário editorial. Só aceita
        imagem JPEG por enquanto — é o único formato que a Content Publishing API da Meta aceita
        para posts de imagem.
      </p>

      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={fileInputId} className="text-xs font-medium text-zinc-700">
            Imagem
          </label>
          <input
            id={fileInputId}
            type="file"
            accept="image/jpeg"
            disabled={busy}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="text-sm text-zinc-700"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={captionInputId} className="text-xs font-medium text-zinc-700">
            Legenda
          </label>
          <textarea
            id={captionInputId}
            value={caption}
            disabled={busy}
            onChange={(event) => setCaption(event.target.value)}
            rows={3}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
          />
        </div>

        <button
          type="submit"
          disabled={!file || busy}
          className="flex h-10 items-center justify-center rounded-md bg-zinc-900 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {STAGE_LABEL[stage] ?? "Publicar agora"}
        </button>
      </form>

      {message ? (
        <p
          role={stage === "erro" ? "alert" : "status"}
          className={
            stage === "erro"
              ? "mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
              : "mt-3 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
