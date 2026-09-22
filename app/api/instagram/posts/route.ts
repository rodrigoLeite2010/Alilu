import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  InstagramPostValidationError,
  createImagePostFromUpload,
  listPostsForUser,
} from "@/lib/instagram/backend/instagram-post-service";

const MAX_CAPTION_LENGTH = 2200; // limite real do Instagram para legendas

/**
 * GET: lista os posts do usuário autenticado, para o calendário editorial
 * (ver app/instagram/painel/calendario). POST: cria um post de imagem
 * única a partir de uma mídia já enviada ao Vercel Blob (ver
 * app/api/instagram/media/upload) — DRAFT, ou SCHEDULED se `scheduledAt`
 * for informado.
 */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const posts = await listPostsForUser(userId);
    return NextResponse.json({ posts });
  } catch (error) {
    console.error("[instagram/posts] falha ao listar posts", error);
    return NextResponse.json({ error: "Não foi possível carregar os posts." }, { status: 500 });
  }
}

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
  const { mediaUrl, caption, scheduledAt } = body as {
    mediaUrl?: unknown;
    caption?: unknown;
    scheduledAt?: unknown;
  };

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
  if (scheduledAt !== undefined && scheduledAt !== null && typeof scheduledAt !== "string") {
    return NextResponse.json({ error: "scheduledAt precisa ser uma data em texto (ISO 8601) ou nulo." }, { status: 400 });
  }

  try {
    const postId = await createImagePostFromUpload({
      userId,
      mediaUrl,
      caption,
      scheduledAt: (scheduledAt as string | null | undefined) ?? null,
    });
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
