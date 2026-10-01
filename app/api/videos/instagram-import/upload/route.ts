import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getImportSettings } from "@/lib/instagram-import/backend/import-repository";
import { IMPORT_IMAGE_CONTENT_TYPES, IMPORT_VIDEO_CONTENT_TYPES, manualUploadPrefix } from "@/lib/instagram-import/backend/import-service";

const SIGNED_TOKEN_VALID_MS = 5 * 60 * 1000;
const CONTENT_TYPES = [...IMPORT_VIDEO_CONTENT_TYPES, ...IMPORT_IMAGE_CONTENT_TYPES];

/**
 * Fallback "Fazer upload do vídeo": token de upload direto navegador → Blob
 * (mesmo padrão de app/api/ai-video/upload), com login e restrito a
 * videos/imports/{userId}/manual/. Tamanho máximo = configuração do admin.
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
        if (!userId) throw new Error("Não autenticado.");
        const prefix = manualUploadPrefix(userId);
        if (!pathname.startsWith(prefix) || pathname.length <= prefix.length || pathname.includes("..")) {
          throw new Error("Caminho de upload inválido.");
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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível processar o upload." }, { status: 400 });
  }
}
