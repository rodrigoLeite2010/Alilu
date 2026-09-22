import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  ALLOWED_MEDIA_CONTENT_TYPES,
  MAX_MEDIA_UPLOAD_BYTES,
  buildMediaTokenPayload,
  isPathnameAllowedForUser,
  parseMediaTokenPayload,
} from "@/lib/instagram/backend/media-service";
import { insertInstagramMedia } from "@/lib/instagram/backend/media-repository";

/**
 * Endpoint de "client upload" do Vercel Blob (Fase 3, ETAPA de
 * armazenamento persistente). O arquivo em si NUNCA passa pelo corpo desta
 * função — vai direto do navegador para o Blob, contornando o limite de
 * 4.5 MB de payload das Vercel Functions. Esta rota participa só de duas
 * conversas curtas em JSON, ambas via `handleUpload`:
 *
 * 1. onBeforeGenerateToken — chamada síncrona dentro da MESMA requisição
 *    do navegador logado: aqui (e só aqui) checamos a sessão via `auth()`,
 *    porque é a única chamada que carrega os cookies do usuário.
 * 2. onUploadCompleted — um webhook do próprio Vercel Blob para esta
 *    mesma URL, DEPOIS que o arquivo já foi recebido; não tem cookies de
 *    sessão nenhuma (por isso nunca chamamos `auth()` aqui), só o
 *    `tokenPayload` que nós mesmos assinamos no passo 1.
 *
 * Nunca aceitamos vídeo aqui ainda — Reels/vídeo é uma etapa futura, com
 * suas próprias regras (não declarar publicado enquanto a Meta processa).
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const session = await auth();
        const userId = session?.user?.id;
        if (!userId) {
          throw new Error("Não autenticado.");
        }
        if (!isPathnameAllowedForUser(pathname, userId)) {
          throw new Error("Caminho de upload inválido.");
        }

        return {
          allowedContentTypes: ALLOWED_MEDIA_CONTENT_TYPES,
          maximumSizeInBytes: MAX_MEDIA_UPLOAD_BYTES,
          addRandomSuffix: true,
          tokenPayload: buildMediaTokenPayload(userId, clientPayload),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const parsed = parseMediaTokenPayload(tokenPayload);
        if (!parsed) {
          // Não deveria acontecer com o nosso próprio cliente — registra e
          // sai sem gravar nada, em vez de lançar (o Blob tentaria de novo
          // 5 vezes por um erro que nunca vai se resolver sozinho).
          console.error("[instagram/media/upload] tokenPayload inválido no callback de conclusão");
          return;
        }

        await insertInstagramMedia({
          userId: parsed.userId,
          storageUrl: blob.url,
          mediaType: "image",
          fileSizeBytes: parsed.fileSizeBytes,
          originalFilename: parsed.originalFilename,
        });
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("[instagram/media/upload] falha ao gerar token ou processar conclusão", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível processar o upload." },
      { status: 400 },
    );
  }
}
