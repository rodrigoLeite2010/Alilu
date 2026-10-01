import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { saveDraft } from "@/lib/ai-video/backend/generation-repository";
import { isAiVideoInputPathForUser } from "@/lib/ai-video/backend/ai-video-storage";
import { AI_VIDEO_MAX_PROMPT_LENGTH } from "@/lib/ai-video/types";

/** PUT: guarda o rascunho (imagem já enviada + configurações) antes de ir comprar créditos. */
export async function PUT(request: Request): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = ((await request.json()) as Record<string, unknown>) ?? {};
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  const imageUrl = typeof body.imageUrl === "string" && isAiVideoInputPathForUser(body.imageUrl, userId) ? body.imageUrl : null;
  await saveDraft(userId, {
    inputImageUrl: imageUrl,
    prompt: typeof body.prompt === "string" ? body.prompt.slice(0, AI_VIDEO_MAX_PROMPT_LENGTH) : "",
    tier: typeof body.tier === "string" ? body.tier.slice(0, 20) : null,
    durationSeconds: typeof body.durationSeconds === "number" ? Math.round(body.durationSeconds) : null,
    aspectRatio: typeof body.aspectRatio === "string" ? body.aspectRatio.slice(0, 10) : null,
  });
  return NextResponse.json({ saved: true });
}
