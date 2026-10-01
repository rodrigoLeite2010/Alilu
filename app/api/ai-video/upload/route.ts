import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAiVideoUploadPathnameAllowed } from "@/lib/ai-video/backend/ai-video-storage";
import { AI_VIDEO_IMAGE_CONTENT_TYPES, AI_VIDEO_MAX_IMAGE_BYTES } from "@/lib/ai-video/types";

const SIGNED_TOKEN_VALID_MS = 5 * 60 * 1000;

/**
 * Upload da imagem de entrada direto do navegador para o Vercel Blob —
 * mesmo padrão de app/api/instagram/media/upload (handleUploadPresigned +
 * issueSignedToken), exigindo login e restrito ao prefixo
 * ai-video/{userId}/input/ do próprio usuário. Só imagens (JPEG/PNG/WebP),
 * até 16 MB.
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
        if (!isAiVideoUploadPathnameAllowed(pathname, userId)) throw new Error("Caminho de upload inválido.");
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          allowedContentTypes: AI_VIDEO_IMAGE_CONTENT_TYPES,
          maximumSizeInBytes: AI_VIDEO_MAX_IMAGE_BYTES,
          validUntil: Date.now() + SIGNED_TOKEN_VALID_MS,
        });
        return {
          token,
          urlOptions: {
            allowedContentTypes: AI_VIDEO_IMAGE_CONTENT_TYPES,
            maximumSizeInBytes: AI_VIDEO_MAX_IMAGE_BYTES,
            addRandomSuffix: true,
          },
        };
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível processar o upload." },
      { status: 400 },
    );
  }
}
