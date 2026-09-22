import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  InstagramPostValidationError,
  createCarouselPostFromUpload,
  createImagePostFromUpload,
  listPostsForUser,
} from "@/lib/instagram/backend/instagram-post-service";

const MAX_CAPTION_LENGTH = 2200; // limite real do Instagram para legendas

/**
 * GET: lista os posts do usuário autenticado, para o calendário editorial
 * (ver app/instagram/painel/calendario). POST: cria um post a partir de
 * mídia já enviada ao Vercel Blob (ver app/api/instagram/media/upload) —
 * DRAFT, ou SCHEDULED se `scheduledAt` for informado. Aceita `mediaUrl`
 * (post de imagem única) OU `mediaUrls` (carrossel, 2 a 10 imagens na
 * ordem de exibição) — nunca os dois ao mesmo tempo. A validação de
 * quantidade do carrossel acontece no serviço (instagram-post-service.ts).
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
  const { mediaUrl, mediaUrls, caption, scheduledAt } = body as {
    mediaUrl?: unknown;
    mediaUrls?: unknown;
    caption?: unknown;
    scheduledAt?: unknown;
  };

  if (mediaUrl !== undefined && mediaUrls !== undefined) {
    return NextResponse.json(
      { error: "Informe mediaUrl (post único) ou mediaUrls (carrossel), nunca os dois." },
      { status: 400 },
    );
  }
  if (mediaUrl === undefined && mediaUrls === undefined) {
    return NextResponse.json({ error: "mediaUrl ou mediaUrls é obrigatório." }, { status: 400 });
  }
  if (mediaUrls !== undefined && (!Array.isArray(mediaUrls) || mediaUrls.some((url) => typeof url !== "string" || !url))) {
    return NextResponse.json({ error: "mediaUrls precisa ser uma lista de URLs em texto." }, { status: 400 });
  }
  if (mediaUrl !== undefined && (typeof mediaUrl !== "string" || !mediaUrl)) {
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
    const postId = mediaUrls
      ? await createCarouselPostFromUpload({
          userId,
          mediaUrls: mediaUrls as string[],
          caption,
          scheduledAt: (scheduledAt as string | null | undefined) ?? null,
        })
      : await createImagePostFromUpload({
          userId,
          mediaUrl: mediaUrl as string,
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
