import { BulkNotFoundError } from "@/lib/bulk-delete/core";
import { createBulkDeleteHandler } from "@/lib/bulk-delete/server";
import { deleteBet } from "@/lib/lotteries/backend/repository";

export const dynamic = "force-dynamic";

/** POST { ids } — exclui apostas (e, em cascata, os jogos delas) do próprio usuário. */
export const POST = createBulkDeleteHandler({
  module: "loterias-apostas",
  async deleteOne(id, userId) {
    if (!(await deleteBet(userId, id))) throw new BulkNotFoundError();
  },
});
