import "server-only";
import { getInstagramAccountForUser } from "@/lib/instagram/backend/instagram-account-repository";
import { getInstagramMediaById, getInstagramMediaByStorageUrl } from "@/lib/instagram/backend/media-repository";
import { isValidTimeZone, parseAbsoluteIso } from "@/lib/instagram/schedule-time";
import {
  cancelPost as cancelPostInDb,
  getPostDetailsForUser,
  updatePostContent,
  type PostDetails,
  type PostExtraFields,
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
export function parseScheduledAt(scheduledAt: string | null | undefined): Date | null {
  if (!scheduledAt) return null;
  // Só instantes absolutos (com Z ou offset): "2026-09-24T15:00" sem fuso
  // é ambíguo e poderia publicar horas antes/depois do esperado.
  const parsed = parseAbsoluteIso(scheduledAt);
  if (!parsed) {
    throw new InstagramPostValidationError(
      "Data de agendamento inválida: envie a data com fuso horário (ISO 8601 com Z ou offset).",
    );
  }
  if (parsed.getTime() <= Date.now()) {
    throw new InstagramPostValidationError(
      "A data de agendamento precisa ser no futuro. Para publicar agora, deixe o campo de agendamento em branco.",
    );
  }
  return parsed;
}

/** Valida o fuso IANA vindo do navegador; ausente = padrão do banco. */
export function normalizeTimezone(timezone: string | null | undefined): string | null {
  if (timezone === undefined || timezone === null || timezone === "") return null;
  if (!isValidTimeZone(timezone)) {
    throw new InstagramPostValidationError("Fuso horário inválido.");
  }
  return timezone;
}

function extraFields(input: PostExtraFields): PostExtraFields {
  return {
    source: input.source === "VIRAL_POST" ? "VIRAL_POST" : "MANUAL",
    templateId: input.templateId ?? null,
    templateData: input.templateData ?? null,
    timezone: normalizeTimezone(input.timezone),
  };
}

export interface CreateImagePostInput extends PostExtraFields {
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
    ...extraFields(input),
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

export interface CreateImagePostFromUploadInput extends PostExtraFields {
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
    ...input,
    userId: input.userId,
    mediaId,
    caption: input.caption,
    scheduledAt: input.scheduledAt,
  });
}

export interface CreateCarouselPostInput extends PostExtraFields {
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
    ...extraFields(input),
    userId: input.userId,
    instagramAccountId: account.id,
    mediaIds: resolvedMediaIds,
    caption: input.caption,
    scheduledAtUtc,
  });
}

export interface CreateCarouselPostFromUploadInput extends PostExtraFields {
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
    ...input,
    userId: input.userId,
    mediaIds,
    caption: input.caption,
    scheduledAt: input.scheduledAt,
  });
}

export interface CreateReelPostInput extends PostExtraFields {
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
    ...extraFields(input),
    userId: input.userId,
    instagramAccountId: account.id,
    mediaId: media.id,
    caption: input.caption,
    scheduledAtUtc,
  });
}

export interface CreateReelPostFromUploadInput extends PostExtraFields {
  userId: string;
  mediaUrl: string;
  caption: string;
  scheduledAt?: string | null;
}

export async function createReelPostFromUpload(input: CreateReelPostFromUploadInput): Promise<string> {
  const mediaId = await resolveUploadedMediaId(input.mediaUrl, input.userId);
  return createReelPost({
    ...input,
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
  timezone?: string | null,
): Promise<void> {
  const scheduledAtUtc = parseScheduledAt(scheduledAt);
  const rescheduled = await reschedulePostInDb(postId, userId, scheduledAtUtc, normalizeTimezone(timezone));
  if (!rescheduled) {
    throw new InstagramPostValidationError(
      "Não foi possível reagendar este post — ele pode já estar em processamento, publicado, ou não existir mais.",
    );
  }
}

export interface UpdatePostInput {
  postId: string;
  userId: string;
  caption?: string;
  /** `undefined` = mantém; `null` = remove agendamento; ISO com fuso = agenda. */
  scheduledAt?: string | null;
  timezone?: string | null;
  templateId?: string | null;
  templateData?: unknown;
  /** URLs de blobs recém-enviados que substituem TODAS as mídias do post, na ordem. */
  mediaUrls?: string[];
}

/**
 * Edita uma publicação ainda não enviada (rascunho, agendada ou com
 * falha). Valida posse e tipo das novas mídias antes de gravar; o
 * repositório recusa atomicamente PROCESSING/PUBLISHED/CANCELLED.
 */
export async function updatePost(input: UpdatePostInput): Promise<{ status: string }> {
  const scheduledAtUtc = input.scheduledAt === undefined ? undefined : parseScheduledAt(input.scheduledAt);
  const current = await getPostDetailsForUser(input.postId, input.userId);
  if (!current) {
    throw new InstagramPostValidationError("Publicação não encontrada.");
  }
  if (current.status === "PROCESSING") {
    throw new InstagramPostValidationError("Esta publicação já está sendo processada.");
  }

  let mediaIds: string[] | undefined;
  if (input.mediaUrls !== undefined) {
    const expected = current.postType === "reels" ? "video" : "image";
    if (current.postType === "carousel") {
      if (input.mediaUrls.length < MIN_CAROUSEL_ITEMS || input.mediaUrls.length > MAX_CAROUSEL_ITEMS) {
        throw new InstagramPostValidationError(
          `Um carrossel precisa ter entre ${MIN_CAROUSEL_ITEMS} e ${MAX_CAROUSEL_ITEMS} imagens.`,
        );
      }
    } else if (input.mediaUrls.length !== 1) {
      throw new InstagramPostValidationError("Este tipo de publicação aceita exatamente uma mídia.");
    }
    mediaIds = [];
    for (const url of input.mediaUrls) {
      const mediaId = await resolveUploadedMediaId(url, input.userId);
      const media = await getInstagramMediaById(mediaId, input.userId);
      if (!media || media.mediaType !== expected) {
        throw new InstagramPostValidationError(
          expected === "video" ? "Reels precisam usar um arquivo de vídeo." : "Envie uma imagem JPG.",
        );
      }
      mediaIds.push(media.id);
    }
  }

  const updated = await updatePostContent(input.postId, input.userId, {
    caption: input.caption,
    scheduledAtUtc,
    timezone: normalizeTimezone(input.timezone),
    templateId: input.templateId,
    templateData: input.templateData,
    mediaIds,
  });
  if (!updated) {
    throw new InstagramPostValidationError(
      "Não foi possível editar esta publicação — ela pode já estar em processamento, publicada ou cancelada.",
    );
  }
  return updated;
}

/** Detalhes de uma publicação do próprio usuário (para a tela de edição). */
export async function getPostDetails(postId: string, userId: string): Promise<PostDetails> {
  const details = await getPostDetailsForUser(postId, userId);
  if (!details) {
    throw new InstagramPostValidationError("Publicação não encontrada.");
  }
  return details;
}
