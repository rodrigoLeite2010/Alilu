import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { InstagramPublishError, publishImagePost } from "@/lib/instagram/backend/instagram-publish-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Dispara a publicação de verdade de um post de imagem única já criado
 * (ver app/api/instagram/posts). Rota provisória de teste ponta a ponta
 * (ver app/instagram/painel) — publica de fato no Instagram do usuário
 * autenticado, nunca no de outro (publishImagePost já restringe por
 * userId). Idempotente: chamar de novo um post já PUBLISHED só confirma o
 * status, não publica duas vezes; chamar de novo um post PROCESSING
 * retoma o polling do mesmo container em vez de criar um novo.
 */
export async function POST(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const status = await publishImagePost(id, userId);
    return NextResponse.json({ status });
  } catch (error) {
    console.error("[instagram/posts/publish] falha ao publicar", error);
    const message =
      error instanceof InstagramPublishError ? error.message : "Não foi possível publicar no Instagram.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
