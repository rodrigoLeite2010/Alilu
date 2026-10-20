import { BulkNotFoundError } from "@/lib/bulk-delete/core";
import { createBulkDeleteHandler } from "@/lib/bulk-delete/server";
import { deleteGenerationForUser } from "@/lib/ai-video/backend/generation-delete-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST { ids } — "Excluir vídeo" em massa (vídeos em andamento ficam de fora, como na individual). */
export const POST = createBulkDeleteHandler({
  module: "ai-video-generations",
  async deleteOne(id, userId) {
    if (!(await deleteGenerationForUser(id, userId))) throw new BulkNotFoundError();
  },
});
