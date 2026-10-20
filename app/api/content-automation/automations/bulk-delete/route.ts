import { BulkNotFoundError } from "@/lib/bulk-delete/core";
import { createBulkDeleteHandler } from "@/lib/bulk-delete/server";
import { getAutomationForUser } from "@/lib/content-automation/backend/automation-repository";
import { cancelPendingRunsForAutomation } from "@/lib/content-automation/backend/automation-run-repository";
import { AutomationValidationError, deleteAutomation } from "@/lib/content-automation/backend/automation-service";

export const dynamic = "force-dynamic";

/**
 * POST { ids } — exclui automações do Alilu. Confirma a posse e cancela as
 * execuções pendentes ANTES de excluir, para nada ser gerado/publicado
 * depois. Publicações já criadas ou feitas no Instagram não são tocadas.
 */
export const POST = createBulkDeleteHandler({
  module: "content-automations",
  isUserError: (error) => error instanceof AutomationValidationError,
  async deleteOne(id, userId) {
    if (!(await getAutomationForUser(id, userId))) throw new BulkNotFoundError();
    await cancelPendingRunsForAutomation(id);
    await deleteAutomation(id, userId);
  },
});
