import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  STORY_BRAND_CONTENT_TYPES,
  STORY_BRAND_MAX_UPLOAD_BYTES,
  storyBrandUploadPrefix,
} from "@/lib/content-automation/backend/smart-story-brand-service";

export const runtime = "nodejs";

const SIGNED_TOKEN_VALID_MS = 5 * 60 * 1000;

/**
 * Upload direto do navegador para o Blob (mesmo padrão da mídia final):
 * só usuário logado, só no prefixo smart-story-brand/{usuário}/, só imagem
 * até 5 MB. O conteúdo é validado/reduzido depois em /brand/assets.
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
        const prefix = storyBrandUploadPrefix(userId);
        if (!pathname.startsWith(prefix) || pathname.length <= prefix.length || pathname.includes("..")) {
          throw new Error("Caminho de upload inválido.");
        }
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          allowedContentTypes: STORY_BRAND_CONTENT_TYPES,
          maximumSizeInBytes: STORY_BRAND_MAX_UPLOAD_BYTES,
          validUntil: Date.now() + SIGNED_TOKEN_VALID_MS,
        });
        return { token, urlOptions: { allowedContentTypes: STORY_BRAND_CONTENT_TYPES, maximumSizeInBytes: STORY_BRAND_MAX_UPLOAD_BYTES, addRandomSuffix: true } };
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível processar o upload." }, { status: 400 });
  }
}
