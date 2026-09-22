import "server-only";
import { getInstagramAccountForUser } from "@/lib/instagram/backend/instagram-account-repository";
import { getInstagramMediaById, getInstagramMediaByStorageUrl } from "@/lib/instagram/backend/media-repository";
import { createDraftImagePost } from "@/lib/instagram/backend/instagram-post-repository";

/**
 * Cria posts a partir de mídia já enviada (instagram_media) e da conta do
 * Instagram já conectada do usuário — validação de posse antes de gravar
 * (nunca cria um post com uma mídia ou conta de outro usuário). A
 * publicação de verdade com a Meta fica em instagram-publish-service.ts.
 */

export class InstagramPostValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstagramPostValidationError";
  }
}

export interface CreateImagePostInput {
  userId: string;
  mediaId: string;
  caption: string;
}

/**
 * Cria um post de imagem única em DRAFT. Confere que o usuário tem uma
 * conta do Instagram conectada e que a mídia informada é dele e é uma
 * imagem (carrossel/vídeo vêm em etapas futuras).
 */
export async function createImagePost(input: CreateImagePostInput): Promise<string> {
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
}

/**
 * Cria um post de imagem única a partir da URL de um blob que acabou de
 * ser enviado pelo navegador (fluxo de "publicar teste" — ver painel).
 *
 * O upload client-side do Vercel Blob (`upload()` do `@vercel/blob/client`)
 * só devolve a URL do blob para o navegador quando o arquivo termina de
 * subir; a gravação da linha em `instagram_media` (com o id que
 * createImagePost precisa) acontece separadamente, via o webhook
 * `onUploadCompleted` da própria rota de upload — quase imediata, mas não
 * simultânea. Por isso, em vez de exigir que o chamador já tenha o id,
 * fazemos um poll curto por essa mídia pela URL exata antes de criar o
 * post; se não aparecer a tempo, falha de forma clara (nunca cria um post
 * "solto", sem mídia).
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

  return createImagePost({ userId: input.userId, mediaId: media.id, caption: input.caption });
}
