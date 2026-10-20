import { BulkNotFoundError } from "@/lib/bulk-delete/core";
import { createBulkDeleteHandler } from "@/lib/bulk-delete/server";
import { deleteYoutubeImportWithFile } from "@/lib/youtube-import/backend/import-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST { ids } — apaga importações do YouTube (registro + arquivo no Blob) do próprio usuário. */
export const POST = createBulkDeleteHandler({
  module: "youtube-imports",
  async deleteOne(id, userId) {
    if (!(await deleteYoutubeImportWithFile(userId, id))) throw new BulkNotFoundError();
  },
});
