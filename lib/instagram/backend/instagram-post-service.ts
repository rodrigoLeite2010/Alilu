import "server-only";
import { getInstagramAccountForUser } from "@/lib/instagram/backend/instagram-account-repository";
import { getInstagramMediaById } from "@/lib/instagram/backend/media-repository";
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
