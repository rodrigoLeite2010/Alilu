import "server-only";
import { getInstagramAccountForUser } from "@/lib/instagram/backend/instagram-account-repository";
import { getInstagramMediaById, getInstagramMediaByStorageUrl } from "@/lib/instagram/backend/media-repository";
import {
  cancelPost as cancelPostInDb,
  createDraftCarouselPost,
  createDraftImagePost,
  createDraftReelPost,
  deletePostForUser,
  listPostsForUser as listPostsForUserInDb,
  reschedulePost as reschedulePostInDb,
  type PostSummary,
} from "@/lib/instagram/backend/instagram-post-repository";

/**
 * Cria e gerencia posts a partir de mídia já enviada (instagram_media) e
 * da conta do Instagram já conectada do usuário — validação de posse
 * antes de gravar (nunca cria/altera um post com uma mídia ou conta de
 * outro usuário). A publicação de verdade com a Meta fica em
 * instagram-publish-service.ts.
 */

export class InstagramPostValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstagramPostValidationError";
  }
}

/** Limites de itens de um carrossel — os mesmos da própria Meta (confirmados na documentação oficial, consultada em 22/09/2026: "Carousels are limited to 10 images, videos, or a mix of the two"). O mínimo de 2 é uma decisão do ALILU: um "carrossel" de 1 item só confundiria o usuário — para isso já existe o post de imagem única. */
export const MIN_CAROUSEL_ITEMS = 2;
export const MAX_CAROUSEL_ITEMS = 10;

/**
 * Valida e converte a data agendada (string ISO vinda do formulário) para
 * `Date` em UTC. `null`/`undefined`/string vazia significam "sem
 * agendamento" (post nasce DRAFT). Uma data inválida ou no passado é
 * rejeitada aqui mesmo — nunca chega a gravar um agendamento sem sentido
 * no banco. Não define um limite máximo no futuro: o usuário pode
 * planejar quanto quiser à frente.
 */
function parseScheduledAt(scheduledAt: string | null | undefined): Date | null {
  if (!scheduledAt) return null;
  const parsed = new Date(scheduledAt);
  if (Number.isNaN(parsed.getTime())) {
    throw new InstagramPostValidationError("Data de agendamento inválida.");
  }
  if (parsed.getTime() <= Date.now()) {
    throw new InstagramPostValidationError(
      "A data de agendamento precisa ser no futuro. Para publicar agora, deixe o campo de agendamento em branco.",
    );
  }
  return parsed;
}

export interface CreateImagePostInput {
  userId: string;
  mediaId: string;
  caption: string;
  /** ISO 8601. Omitido/vazio = sem agendamento (post nasce DRAFT). */
  scheduledAt?: string | null;
}

/**
 * Cria um post de imagem única (DRAFT ou SCHEDULED, conforme
 * `scheduledAt`). Confere que o usuário tem uma conta do Instagram
 * conectada e que a mídia informada é dele e é uma imagem
 * (vídeo/Reels vem em etapa futura).
 */
export async function createImagePost(input: CreateImagePostInput): Promise<string> {
  const scheduledAtUtc = parseScheduledAt(input.scheduledAt);

  const account = await getInstagramAccountForUser(input.userId);
  if (!account) {
    throw new InstagramPostValidationError(
      "Nenhuma conta do Instagram conectada. Conecte uma conta antes de criar um post.",
    );
  }

  const media = await getInstagramMediaById(input.mediaId, input.userId);
  if (!media) {
    throw new InstagramPostValidationError("Mídia não encontrada.");
  }
  if (media.mediaType !== "image") {
    throw new InstagramPostValidationError("Esta etapa só cria posts de imagem única.");
  }

  return createDraftImagePost({
    userId: input.userId,
    instagramAccountId: account.id,
    mediaId: media.id,
    caption: input.caption,
    scheduledAtUtc,
  });
}

const MEDIA_RESOLVE_POLL_INTERVAL_MS = 500;
const MEDIA_RESOLVE_MAX_POLL_ATTEMPTS = 6; // ~3s

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolve a URL de um blob recém-enviado para o id de mídia
 * correspondente, com um poll curto (a gravação de `instagram_media`
 * acontece no webhook `onUploadCompleted` do Vercel Blob, quase
 * simultânea ao fim do upload, mas não instantânea — ver
 * media/upload/route.ts). Compartilhado por createImagePostFromUpload e
 * createCarouselPostFromUpload.
 */
async function resolveUploadedMediaId(mediaUrl: string, userId: string): Promise<string> {
  for (let attempt = 0; attempt < MEDIA_RESOLVE_MAX_POLL_ATTEMPTS; attempt++) {
    const media = await getInstagramMediaByStorageUrl(mediaUrl, userId);
    if (media) return media.id;
    if (attempt < MEDIA_RESOLVE_MAX_POLL_ATTEMPTS - 1) {
      await sleep(MEDIA_RESOLVE_POLL_INTERVAL_MS);
    }
  }
  throw new InstagramPostValidationError(
    "O upload ainda não terminou de ser registrado. Aguarde alguns segundos e tente de novo.",
  );
}

export interface CreateImagePostFromUploadInput {
  userId: string;
  mediaUrl: string;
  caption: string;
  /** ISO 8601. Omitido/vazio = sem agendamento (post nasce DRAFT). */
  scheduledAt?: string | null;
}

/**
 * Cria um post de imagem única a partir da URL de um blob que acabou de
 * ser enviado pelo navegador (fluxo de publicação real — ver painel e o
 * calendário editorial). Ver resolveUploadedMediaId para o porquê do
 * poll.
 */
export async function createImagePostFromUpload(input: CreateImagePostFromUploadInput): Promise<string> {
  const mediaId = await resolveUploadedMediaId(input.mediaUrl, input.userId);

  return createImagePost({
    userId: input.userId,
    mediaId,
    caption: input.caption,
    scheduledAt: input.scheduledAt,
  });
}

export interface CreateCarouselPostInput {
  userId: string;
  /** De 2 a 10 ids de mídia, na ordem de exibição do carrossel. */
  mediaIds: string[];
  caption: string;
  /** ISO 8601. Omitido/vazio = sem agendamento (post nasce DRAFT). */
  scheduledAt?: string | null;
}

/**
 * Cria um post de carrossel (2 a 10 imagens, na ordem informada).
 * Confere a conta conectada e que CADA mídia é do usuário e é imagem —
 * carrossel com vídeo (a Meta permite misturar) fica para quando o
 * projeto suportar upload de vídeo do zero, junto com Reels.
 */
export async function createCarouselPost(input: CreateCarouselPostInput): Promise<string> {
  const scheduledAtUtc = parseScheduledAt(input.scheduledAt);

  if (input.mediaIds.length < MIN_CAROUSEL_ITEMS || input.mediaIds.length > MAX_CAROUSEL_ITEMS) {
    throw new InstagramPostValidationError(
      `Um carrossel precisa ter entre ${MIN_CAROUSEL_ITEMS} e ${MAX_CAROUSEL_ITEMS} imagens (este tem ${input.mediaIds.length}).`,
    );
  }

  const account = await getInstagramAccountForUser(input.userId);
  if (!account) {
    throw new InstagramPostValidationError(
      "Nenhuma conta do Instagram conectada. Conecte uma conta antes de criar um post.",
    );
  }

  const resolvedMediaIds: string[] = [];
  for (const mediaId of input.mediaIds) {
    const media = await getInstagramMediaById(mediaId, input.userId);
    if (!media) {
      throw new InstagramPostValidationError("Uma das imagens do carrossel não foi encontrada.");
    }
    if (media.mediaType !== "image") {
      throw new InstagramPostValidationError("Esta etapa só cria carrosséis de imagem.");
    }
    resolvedMediaIds.push(media.id);
  }

  return createDraftCarouselPost({
    userId: input.userId,
    instagramAccountId: account.id,
    mediaIds: resolvedMediaIds,
    caption: input.caption,
    scheduledAtUtc,
  });
}

export interface CreateCarouselPostFromUploadInput {
  userId: string;
  /** De 2 a 10 URLs de blobs recém-enviados, na mesma ordem dos slides exibidos no carrossel. */
  mediaUrls: string[];
  caption: string;
  /** ISO 8601. Omitido/vazio = sem agendamento (post nasce DRAFT). */
  scheduledAt?: string | null;
}

/**
 * Igual a createImagePostFromUpload, mas para os N slides de um
 * carrossel — resolve cada URL de blob para o id de mídia correspondente
 * (um poll por slide, preservando a ordem recebida) antes de criar o
 * post. A validação de quantidade (2 a 10) acontece em createCarouselPost.
 */
export async function createCarouselPostFromUpload(input: CreateCarouselPostFromUploadInput): Promise<string> {
  const mediaIds: string[] = [];
  for (const mediaUrl of input.mediaUrls) {
    mediaIds.push(await resolveUploadedMediaId(mediaUrl, input.userId));
  }

  return createCarouselPost({
    userId: input.userId,
    mediaIds,
    caption: input.caption,
    scheduledAt: input.scheduledAt,
  });
}

export interface CreateReelPostInput {
  userId: string;
  mediaId: string;
  caption: string;
  scheduledAt?: string | null;
}

export async function createReelPost(input: CreateReelPostInput): Promise<string> {
  const scheduledAtUtc = parseScheduledAt(input.scheduledAt);

  const account = await getInstagramAccountForUser(input.userId);
  if (!account) {
    throw new InstagramPostValidationError(
      "Nenhuma conta do Instagram conectada. Conecte uma conta antes de criar um Reel.",
    );
  }

  const media = await getInstagramMediaById(input.mediaId, input.userId);
  if (!media) {
    throw new InstagramPostValidationError("Vídeo não encontrado.");
  }
  if (media.mediaType !== "video") {
    throw new InstagramPostValidationError("Reels precisam usar um arquivo de vídeo.");
  }

  return createDraftReelPost({
    userId: input.userId,
    instagramAccountId: account.id,
    mediaId: media.id,
    caption: input.caption,
    scheduledAtUtc,
  });
}

export interface CreateReelPostFromUploadInput {
  userId: string;
  mediaUrl: string;
  caption: string;
  scheduledAt?: string | null;
}

export async function createReelPostFromUpload(input: CreateReelPostFromUploadInput): Promise<string> {
  const mediaId = await resolveUploadedMediaId(input.mediaUrl, input.userId);
  return createReelPost({
    userId: input.userId,
    mediaId,
    caption: input.caption,
    scheduledAt: input.scheduledAt,
  });
}

/** Lista os posts do usuário para o calendário editorial (mais recentes/próximos primeiro). */
export async function listPostsForUser(userId: string): Promise<PostSummary[]> {
  return listPostsForUserInDb(userId);
}

/**
 * Cancela um post do usuário. Lança `InstagramPostValidationError` (em vez
 * de devolver um booleano) quando não há nada para cancelar — mensagem
 * pensada para ir direto pra tela, sem vazar se o post não existe versus
 * não pertence ao usuário versus já não pode mais ser cancelado (nenhuma
 * dessas distinções muda o que o usuário deveria fazer a seguir).
 */
export async function cancelPost(postId: string, userId: string): Promise<void> {
  const cancelled = await cancelPostInDb(postId, userId);
  if (!cancelled) {
    throw new InstagramPostValidationError(
      "Não foi possível cancelar este post — ele pode já ter sido publicado, estar em processamento, ou não existir mais.",
    );
  }
}

export async function deletePost(postId: string, userId: string): Promise<void> {
  const deleted = await deletePostForUser(postId, userId);
  if (!deleted) {
    throw new InstagramPostValidationError(
      "Não foi possível excluir esta publicação — ela pode estar em processamento, não existir mais, ou pertencer a outra conta.",
    );
  }
}

/**
 * Reagenda um post (ou remove o agendamento, passando `scheduledAt:
 * null`). Mesma validação de data futura de `createImagePost`.
 */
export async function reschedulePost(
  postId: string,
  userId: string,
  scheduledAt: string | null,
): Promise<void> {
  const scheduledAtUtc = parseScheduledAt(scheduledAt);
  const rescheduled = await reschedulePostInDb(postId, userId, scheduledAtUtc);
  if (!rescheduled) {
    throw new InstagramPostValidationError(
      "Não foi possível reagendar este post — ele pode já estar em processamento, publicado, ou não existir mais.",
    );
  }
}
