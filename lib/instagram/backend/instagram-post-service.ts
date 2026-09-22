import "server-only";
import { getInstagramAccountForUser } from "@/lib/instagram/backend/instagram-account-repository";
import { getInstagramMediaById, getInstagramMediaByStorageUrl } from "@/lib/instagram/backend/media-repository";
import {
  cancelPost as cancelPostInDb,
  createDraftImagePost,
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
 * (carrossel/vídeo vêm em etapas futuras).
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
 * calendário editorial).
 *
 * O upload client-side do Vercel Blob (`uploadPresigned()` do
 * `@vercel/blob/client`) só devolve a URL do blob para o navegador quando
 * o arquivo termina de subir; a gravação da linha em `instagram_media`
 * (com o id que createImagePost precisa) acontece separadamente, via o
 * webhook `onUploadCompleted` da própria rota de upload — quase imediata,
 * mas não simultânea. Por isso, em vez de exigir que o chamador já tenha
 * o id, fazemos um poll curto por essa mídia pela URL exata antes de criar
 * o post; se não aparecer a tempo, falha de forma clara (nunca cria um
 * post "solto", sem mídia).
 */
export async function createImagePostFromUpload(input: CreateImagePostFromUploadInput): Promise<string> {
  let media = null;
  for (let attempt = 0; attempt < MEDIA_RESOLVE_MAX_POLL_ATTEMPTS; attempt++) {
    media = await getInstagramMediaByStorageUrl(input.mediaUrl, input.userId);
    if (media) break;
    if (attempt < MEDIA_RESOLVE_MAX_POLL_ATTEMPTS - 1) {
      await sleep(MEDIA_RESOLVE_POLL_INTERVAL_MS);
    }
  }
  if (!media) {
    throw new InstagramPostValidationError(
      "O upload ainda não terminou de ser registrado. Aguarde alguns segundos e tente de novo.",
    );
  }

  return createImagePost({
    userId: input.userId,
    mediaId: media.id,
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
