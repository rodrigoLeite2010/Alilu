import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createCarouselPostFromImport } from "@/lib/instagram-import/backend/repost-service";
import { InstagramImportError } from "@/lib/instagram-import/backend/import-service";
import { InstagramPostValidationError } from "@/lib/instagram/backend/instagram-post-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST { importId, order: number[], caption, scheduledAt?, timezone? } —
 * cria o post de carrossel a partir de um carrossel importado do Instagram.
 * Devolve { postId }; "Publicar agora" segue por POST /api/instagram/posts/{id}/publish.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  try {
    return NextResponse.json(await createCarouselPostFromImport(userId, body), { status: 201 });
  } catch (error) {
    if (error instanceof InstagramImportError) return NextResponse.json({ error: error.message }, { status: error.httpStatus });
    if (error instanceof InstagramPostValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error(JSON.stringify({ scope: "instagram-import", event: "carousel_repost.crash", message: (error as Error)?.message?.slice(0, 200) }));
    return NextResponse.json({ error: "Não foi possível criar o carrossel agora." }, { status: 500 });
  }
}
