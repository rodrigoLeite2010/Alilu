import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  InstagramPostValidationError,
  createImagePostFromUpload,
} from "@/lib/instagram/backend/instagram-post-service";

const MAX_CAPTION_LENGTH = 2200; // limite real do Instagram para legendas

/**
 * Cria um post de imagem única em DRAFT a partir de uma mídia já enviada
 * ao Vercel Blob (ver app/api/instagram/media/upload). Rota provisória de
 * teste ponta a ponta (ver app/instagram/painel) — a UI de verdade é o
 * calendário editorial, etapa futura.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  const { mediaUrl, caption } = body as { mediaUrl?: unknown; caption?: unknown };

  if (typeof mediaUrl !== "string" || !mediaUrl) {
    return NextResponse.json({ error: "mediaUrl é obrigatório." }, { status: 400 });
  }
  if (typeof caption !== "string") {
    return NextResponse.json({ error: "caption é obrigatório (pode ser vazio)." }, { status: 400 });
  }
  if (caption.length > MAX_CAPTION_LENGTH) {
    return NextResponse.json(
      { error: `A legenda excede o limite de ${MAX_CAPTION_LENGTH} caracteres do Instagram.` },
      { status: 400 },
    );
  }

  try {
    const postId = await createImagePostFromUpload({ userId, mediaUrl, caption });
    return NextResponse.json({ postId }, { status: 201 });
  } catch (error) {
    console.error("[instagram/posts] falha ao criar o post", error);
    const message =
      error instanceof InstagramPostValidationError
        ? error.message
        : "Não foi possível criar o post.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
