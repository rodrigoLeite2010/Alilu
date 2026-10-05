import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  END_MEDIA_IMAGE_CONTENT_TYPES,
  END_MEDIA_MAX_VIDEO_BYTES,
  END_MEDIA_VIDEO_CONTENT_TYPES,
  endMediaUploadPrefix,
} from "@/lib/brand-end-media/end-media-config";

const SIGNED_TOKEN_VALID_MS = 5 * 60 * 1000;
const CONTENT_TYPES = [...END_MEDIA_IMAGE_CONTENT_TYPES, ...END_MEDIA_VIDEO_CONTENT_TYPES];

/**
 * Upload direto do navegador para o Blob (mesmo padrão de
 * app/api/videos/instagram-import/upload): só usuário logado, só no
 * prefixo brand-end-media/{usuário}/. O conteúdo é validado depois em
 * POST /api/brand-end-media/assets (ffprobe / decodificação de imagem).
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
        const userId = (await auth())?.user?.id;
        if (!userId) throw new Error("Não autenticado.");
        const prefix = endMediaUploadPrefix(userId);
        if (!pathname.startsWith(prefix) || pathname.length <= prefix.length || pathname.includes("..") || pathname.startsWith(`${prefix}normalized/`)) {
          throw new Error("Caminho de upload inválido.");
        }
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          allowedContentTypes: CONTENT_TYPES,
          maximumSizeInBytes: END_MEDIA_MAX_VIDEO_BYTES,
          validUntil: Date.now() + SIGNED_TOKEN_VALID_MS,
        });
        return { token, urlOptions: { allowedContentTypes: CONTENT_TYPES, maximumSizeInBytes: END_MEDIA_MAX_VIDEO_BYTES, addRandomSuffix: true } };
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível processar o upload." }, { status: 400 });
  }
}
