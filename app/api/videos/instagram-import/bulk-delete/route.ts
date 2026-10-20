import { BulkNotFoundError } from "@/lib/bulk-delete/core";
import { createBulkDeleteHandler } from "@/lib/bulk-delete/server";
import { deleteInstagramImport } from "@/lib/instagram-import/backend/import-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST { ids } — apaga importações do Instagram (registro + arquivo no Blob) do próprio usuário. */
export const POST = createBulkDeleteHandler({
  module: "instagram-imports",
  async deleteOne(id, userId) {
    if (!(await deleteInstagramImport(userId, id))) throw new BulkNotFoundError();
  },
});
