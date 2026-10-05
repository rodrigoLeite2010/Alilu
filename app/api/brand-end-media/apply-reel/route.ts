import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { END_MEDIA_FAILED_MESSAGE } from "@/lib/brand-end-media/end-media-config";
import { EndMediaValidationError, applyEndMediaToVideoMedia } from "@/lib/brand-end-media/backend/end-media-service";
import { recordEndMediaEvent } from "@/lib/brand-end-media/backend/end-media-repository";
import { InstagramPostValidationError, resolveUploadedMediaId } from "@/lib/instagram/backend/instagram-post-service";

export const runtime = "nodejs";
// Emenda o encerramento no Reel (FFmpeg) ANTES de criar a publicação.
export const maxDuration = 200;

/**
 * Recebe o vídeo do Reel já enviado (URL do Blob do próprio usuário) e
 * devolve um NOVO vídeo com o encerramento + o id do registro (renderId),
 * que vai junto na criação do post para gravar o histórico. Falhou →
 * o cliente oferece "Publicar sem encerramento" / "Tentar novamente".
 */
export async function POST(request: Request): Promise<NextResponse> {
  const userId = (await auth())?.user?.id;
  if (!userId) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  let body: { mediaUrl?: unknown };
  try {
    body = (await request.json()) as { mediaUrl?: unknown };
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  if (typeof body.mediaUrl !== "string" || !body.mediaUrl) return NextResponse.json({ error: "Vídeo não informado." }, { status: 400 });
  const startedAt = Date.now();
  try {
    const mediaId = await resolveUploadedMediaId(body.mediaUrl, userId);
    const applied = await applyEndMediaToVideoMedia(userId, mediaId, { context: "REEL", timeoutMs: 170_000 });
    return NextResponse.json({ mediaUrl: applied.resultUrl, renderId: applied.render.id, cached: applied.cached });
  } catch (error) {
    if (error instanceof EndMediaValidationError || error instanceof InstagramPostValidationError) {
      return NextResponse.json({ error: error.message, code: "END_MEDIA_INVALID" }, { status: 400 });
    }
    await recordEndMediaEvent({
      userId,
      context: "REEL",
      applied: false,
      processingMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: END_MEDIA_FAILED_MESSAGE, code: "END_MEDIA_FAILED" }, { status: 500 });
  }
}
