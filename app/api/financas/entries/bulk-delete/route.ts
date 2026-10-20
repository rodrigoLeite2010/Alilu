import { BulkNotFoundError } from "@/lib/bulk-delete/core";
import { createBulkDeleteHandler } from "@/lib/bulk-delete/server";
import { deleteEntry } from "@/lib/financas/backend/repository";

export const dynamic = "force-dynamic";

/** POST { ids } — exclui receitas/despesas do próprio usuário (recorrentes levam todas as repetições, como na individual). */
export const POST = createBulkDeleteHandler({
  module: "financas-entries",
  async deleteOne(id, userId) {
    if (!(await deleteEntry(userId, id))) throw new BulkNotFoundError();
  },
});
