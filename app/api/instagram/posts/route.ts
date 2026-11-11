import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { parseCarouselEndMediaChoice } from "@/lib/brand-end-media/backend/end-media-service";
import {
  InstagramPostValidationError,
  createCarouselPostFromUpload,
  createImagePostFromUpload,
  createReelPostFromUpload,
  listPostsForUser,
} from "@/lib/instagram/backend/instagram-post-service";
import { readPostExtraFields } from "@/lib/instagram/backend/post-request";
import { deleteUnsentPostForUser, getPostDetailsForUser } from "@/lib/instagram/backend/instagram-post-repository";
import {
  SocialDestinationsError,
  applyFacebookDestinations,
  assertFacebookSupports,
  readSocialDestinations,
  resolveFacebookPages,
} from "@/lib/facebook/backend/social-destinations-service";

const MAX_CAPTION_LENGTH = 2200; // limite real do Instagram para legendas

/**
 * GET: lista os posts do usuário autenticado, para o calendário editorial
 * (ver app/instagram/painel/calendario). POST: cria um post a partir de
 * mídia já enviada ao Vercel Blob (ver app/api/instagram/media/upload) —
 * DRAFT, ou SCHEDULED se `scheduledAt` for informado. Aceita `mediaUrl`
 * (post de imagem única ou Reel, conforme `postType`) OU `mediaUrls`
 * (carrossel, 2 a 10 imagens na ordem de exibição) — nunca os dois ao
 * mesmo tempo.
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
  const { mediaUrl, mediaUrls, caption, scheduledAt, postType, endMedia, endMediaRenderId, instagramAccountId } = body as {
    instagramAccountId?: unknown;
    mediaUrl?: unknown;
    mediaUrls?: unknown;
    caption?: unknown;
    scheduledAt?: unknown;
    postType?: unknown;
    endMedia?: unknown;
    endMediaRenderId?: unknown;
  };
  const normalizedPostType = postType === undefined ? (mediaUrls !== undefined ? "carousel" : "image") : postType;

  if (mediaUrl !== undefined && mediaUrls !== undefined) {
    return NextResponse.json(
      { error: "Informe mediaUrl (post único) ou mediaUrls (carrossel), nunca os dois." },
      { status: 400 },
    );
  }
  if (mediaUrl === undefined && mediaUrls === undefined) {
    return NextResponse.json({ error: "mediaUrl ou mediaUrls é obrigatório." }, { status: 400 });
  }
  if (normalizedPostType !== "image" && normalizedPostType !== "carousel" && normalizedPostType !== "reels") {
    return NextResponse.json({ error: "postType precisa ser image, carousel ou reels." }, { status: 400 });
  }
  if (mediaUrls !== undefined && normalizedPostType !== "carousel") {
    return NextResponse.json({ error: "mediaUrls só pode ser usado com postType carousel." }, { status: 400 });
  }
  if (mediaUrl !== undefined && normalizedPostType === "carousel") {
    return NextResponse.json({ error: "Carrosséis precisam usar mediaUrls." }, { status: 400 });
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

  const extra = readPostExtraFields(body as Record<string, unknown>);
  if ("error" in extra) {
    return NextResponse.json({ error: extra.error }, { status: 400 });
  }
  // "Publicar nas redes sociais": ausente = só Instagram (comportamento histórico).
  const destinationsResult = readSocialDestinations((body as Record<string, unknown>).destinations);
  if ("error" in destinationsResult) {
    return NextResponse.json({ error: destinationsResult.error }, { status: 400 });
  }
  const destinations = destinationsResult.value;
  if (destinations && destinations.facebookPageIds.length > 0) {
    try {
      // Valida as Páginas ANTES de criar qualquer coisa.
      await resolveFacebookPages(userId, destinations.facebookPageIds);
    } catch (error) {
      const message = error instanceof SocialDestinationsError ? error.message : "Não foi possível validar a Página do Facebook.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
  if (destinations) extra.fields.publishToInstagram = destinations.instagram;

  try {
    const postId = normalizedPostType === "carousel"
      ? await createCarouselPostFromUpload({
          userId,
          mediaUrls: mediaUrls as string[],
          caption,
          scheduledAt: (scheduledAt as string | null | undefined) ?? null,
          endMedia: parseCarouselEndMediaChoice(endMedia),
          ...extra.fields,
        })
      : normalizedPostType === "reels"
        ? await createReelPostFromUpload({
            userId,
            mediaUrl: mediaUrl as string,
            caption,
            scheduledAt: (scheduledAt as string | null | undefined) ?? null,
            endMediaRenderId: typeof endMediaRenderId === "string" ? endMediaRenderId : null,
            instagramAccountId:
              typeof instagramAccountId === "string" && /^[0-9a-f-]{36}$/i.test(instagramAccountId) ? instagramAccountId : null,
            ...extra.fields,
          })
      : await createImagePostFromUpload({
          userId,
          mediaUrl: mediaUrl as string,
          caption,
          scheduledAt: (scheduledAt as string | null | undefined) ?? null,
          ...extra.fields,
        });
    if (destinations && destinations.facebookPageIds.length > 0) {
      try {
        const created = await getPostDetailsForUser(postId, userId);
        assertFacebookSupports(normalizedPostType, Boolean(created?.items.some((item) => item.mediaType === "video")));
        await applyFacebookDestinations(postId, userId, destinations);
      } catch (error) {
        // Nada foi enviado à Meta ainda: desfaz a criação para não deixar
        // uma publicação com destinos pela metade.
        await deleteUnsentPostForUser(postId, userId).catch(() => undefined);
        const message = error instanceof SocialDestinationsError ? error.message : "Não foi possível configurar a publicação no Facebook.";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }
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
