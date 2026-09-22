import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { InstagramPublishError, publishPost } from "@/lib/instagram/backend/instagram-publish-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Dispara a publicação de verdade de um post já criado (ver
 * app/api/instagram/posts) — imagem única ou carrossel, `publishPost`
 * despacha para a orquestração certa conforme o tipo do post
 * (instagram-publish-service.ts); Reels ainda não é suportado. Publica de
 * fato no Instagram do usuário autenticado, nunca no de outro (os
 * serviços chamados já restringem por userId). Idempotente: chamar de
 * novo um post já PUBLISHED só confirma o status, não publica duas
 * vezes; chamar de novo um post PROCESSING retoma o polling do mesmo
 * container em vez de criar um novo.
 */
export async function POST(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const status = await publishPost(id, userId);
    return NextResponse.json({ status });
  } catch (error) {
    console.error("[instagram/posts/publish] falha ao publicar", error);
    const message =
      error instanceof InstagramPublishError ? error.message : "Não foi possível publicar no Instagram.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
