import { BulkNotFoundError } from "@/lib/bulk-delete/core";
import { createBulkDeleteHandler } from "@/lib/bulk-delete/server";
import { AgendaError, deleteAgendaEvent } from "@/lib/agenda/backend/agenda-service";

export const dynamic = "force-dynamic";

/**
 * POST { ids } — exclui compromissos do próprio usuário. Usa a mesma regra da
 * individual: cancela os lembretes pendentes ANTES do soft delete, para nenhum
 * e-mail/aviso sair depois da exclusão.
 */
export const POST = createBulkDeleteHandler({
  module: "agenda-events",
  isUserError: (error) => error instanceof AgendaError,
  async deleteOne(id, userId) {
    try {
      await deleteAgendaEvent(userId, id);
    } catch (error) {
      if (error instanceof AgendaError && error.httpStatus === 404) throw new BulkNotFoundError();
      throw error;
    }
  },
});
