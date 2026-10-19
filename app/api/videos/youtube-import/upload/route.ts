import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getImportSettings } from "@/lib/instagram-import/backend/import-repository";
import { assertImportAcceptsUpload, parseYoutubeUploadPathname, YoutubeImportError } from "@/lib/youtube-import/backend/import-service";
import { YOUTUBE_UPLOAD_CONTENT_TYPES } from "@/lib/youtube-import/types";

const SIGNED_TOKEN_VALID_MS = 10 * 60 * 1000;
const CONTENT_TYPES = [...YOUTUBE_UPLOAD_CONTENT_TYPES];

/** Erro conhecido (mensagem pensada para a tela) — qualquer outro vira mensagem genérica. */
class UploadRefused extends Error {}

/**
 * Token de upload direto navegador → Vercel Blob (o arquivo não passa pela
 * function, então não esbarra no limite de corpo da Vercel). Exige login e
 * só vale para videos/imports/{userId}/youtube/{importId}/…, de uma
 * importação do próprio usuário que ainda não tem arquivo. Tamanho e tipos
 * são travados no próprio token.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: HandleUploadPresignedBody;
  try {
    body = (await request.json()) as HandleUploadPresignedBody;
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  try {
    const jsonResponse = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname) => {
        const session = await auth();
        const userId = session?.user?.id;
        if (!userId) throw new UploadRefused("Entre na sua conta para enviar o vídeo.");
        const target = parseYoutubeUploadPathname(pathname, userId);
        if (!target) throw new UploadRefused("Caminho de upload inválido.");
        try {
          await assertImportAcceptsUpload(userId, target.importId);
        } catch (error) {
          throw error instanceof YoutubeImportError ? new UploadRefused(error.message) : error;
        }
        const maxBytes = (await getImportSettings()).maxImportedVideoSizeMb * 1024 * 1024;
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          allowedContentTypes: CONTENT_TYPES,
          maximumSizeInBytes: maxBytes,
          validUntil: Date.now() + SIGNED_TOKEN_VALID_MS,
        });
        return { token, urlOptions: { allowedContentTypes: CONTENT_TYPES, maximumSizeInBytes: maxBytes, addRandomSuffix: true } };
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    if (!(error instanceof UploadRefused)) {
      console.error(JSON.stringify({ scope: "youtube-import", event: "upload-token.crash", message: (error as Error)?.message?.slice(0, 300) }));
    }
    return NextResponse.json({ error: error instanceof UploadRefused ? error.message : "Não foi possível preparar o upload. Tente de novo." }, { status: 400 });
  }
}
