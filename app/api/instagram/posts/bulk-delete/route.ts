import { BulkNotFoundError } from "@/lib/bulk-delete/core";
import { createBulkDeleteHandler } from "@/lib/bulk-delete/server";
import { InstagramPostValidationError, deletePost } from "@/lib/instagram/backend/instagram-post-service";
import { cancelPost, getPostStatusForUser } from "@/lib/instagram/backend/instagram-post-repository";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST { ids } — exclui publicações do HISTÓRICO DO ALILU (rascunhos,
 * agendadas, publicadas, falhas, canceladas). Nunca apaga nada no Instagram:
 * publicadas continuam lá. Agendadas são canceladas antes (next_attempt_at
 * zerado), então nada é publicado depois da exclusão. PROCESSING é recusada.
 */
export const POST = createBulkDeleteHandler({
  module: "instagram-posts",
  isUserError: (error) => error instanceof InstagramPostValidationError,
  async deleteOne(id, userId) {
    const status = await getPostStatusForUser(id, userId);
    if (!status) throw new BulkNotFoundError();
    if (status === "PROCESSING") {
      throw new InstagramPostValidationError("Está em processamento no Instagram agora. Tente de novo em instantes.");
    }
    if (status === "SCHEDULED" || status === "NEEDS_REVIEW") await cancelPost(id, userId);
    await deletePost(id, userId);
  },
});
